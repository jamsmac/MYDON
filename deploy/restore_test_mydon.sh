#!/usr/bin/env bash
# Restore-test the latest MYDON dump in an isolated, disposable PostgreSQL 17.
# The active database and the local rollback database are only read, never
# modified. The restore container has no network and stores all data in tmpfs.
set -uo pipefail
umask 077

BACKUP_DIR="${RESTORE_BACKUP_DIR:-/opt/backups/extra}"
DUMP="${RESTORE_DUMP_PATH:-}"
MAX_DUMP_AGE_HOURS="${RESTORE_DUMP_MAX_AGE_HOURS:-48}"
DB_HELPER="${DB_HELPER:-/opt/backups/db_access.sh}"
DOCKER_BIN="${RESTORE_DOCKER_BIN:-docker}"
MIG_DIR="${RESTORE_MIGRATIONS_DIR:-/opt/mydon-app/packages/db/drizzle}"
CLIENT_IMAGE="${DB_CLIENT_IMAGE:-postgres:17-alpine}"
RESTORE_CONTAINER="mydon-restore-test-$(date +%s)-$$"
TEMP_ROOT="${RESTORE_TEMP_ROOT:-/opt/backups}"
TMP_DIR=""
CONTAINER_CREATED=0
FAILED=0
NEW_TABLES=0
LAST_FAIL=""
# Пути переопределяемы ТОЛЬКО ради тестов (deploy/tests/restore-test-alarm.test.sh):
# на сервере переменные не выставляются и действуют боевые значения.
MYDON_ENV="${MYDON_ENV_FILE:-/opt/mydon-app/.env}"
ALERT_ENV="${WATCHDOG_ENV_FILE:-/etc/mydon-heartbeat.env}"
CORE_INGEST="${CORE_INGEST_URL:-http://127.0.0.1:3001/ingest}"

# say запоминает последнюю строку «ПРОВАЛ»: тревоге нужна причина, а не только
# код возврата — «проверка упала» без причины заставляет лезть в лог руками.
say() {
  printf '%s\n' "$1"
  case "$1" in *ПРОВАЛ*) LAST_FAIL="$1" ;; esac
}

env_value() {  # env_value <ключ> <файл>
  [ -r "$2" ] || return 0
  grep "^$1=" "$2" 2>/dev/null | tail -1 | cut -d= -f2-
}

# Тревога о провале проверки восстановления.
#
# Канал тот же, что у disk_guard/healthz_guard: событие в Core, а если Core не
# ответил — напрямую в Telegram. Тревога об инфраструктуре не должна зависеть от
# той же инфраструктуры: если сервер лежит, событие в Core о лежащем сервере
# отправить некому.
#
# Лесенка секретов повторяет backup_extra.sh: свои TG_BACKUP_* в .env mydon,
# затем аварийный бот сторожа из /etc/mydon-heartbeat.env.
alert() {  # alert <код возврата>
  local rc=$1 reason safe payload bot chat
  reason="${LAST_FAIL:-проверка завершилась с кодом ${rc}, строки «ПРОВАЛ» в выводе нет}"

  if [ -n "${INGEST_KEY:-}" ]; then
    # Причина едет внутрь JSON-строки: кавычки и слэши убираем подстановкой
    # bash, а не внешним tr — из имён таблиц и путей ничего осмысленного не
    # теряется, зато битый JSON не превращает тревогу в тишину.
    safe=${reason//\\/}
    safe=${safe//\"/}
    safe=${safe//$'\n'/ }
    payload=$(printf '{"type":"infra.restore_test","source":"restore_test_mydon","payload":{"status":"failed","exitCode":%d,"reason":"%s"}}' \
      "$rc" "$safe")
    if curl -sf -m 15 -X POST "${CORE_INGEST}/${INGEST_KEY}" \
        -H 'Content-Type: application/json' -d "$payload" >/dev/null 2>&1; then
      return 0
    fi
  fi

  bot=$(env_value TG_BACKUP_BOT_TOKEN "$MYDON_ENV")
  chat=$(env_value TG_BACKUP_CHAT_ID "$MYDON_ENV")
  if [ -z "${bot:-}" ] || [ -z "${chat:-}" ]; then
    bot=$(env_value WATCHDOG_BOT_TOKEN "$ALERT_ENV")
    # WATCHDOG_CHAT_IDS — список через запятую; сообщению нужен один чат — первый.
    chat=$(env_value WATCHDOG_CHAT_IDS "$ALERT_ENV" | cut -d, -f1 | tr -d '[:space:]')
  fi
  if [ -z "${bot:-}" ] || [ -z "${chat:-}" ]; then
    printf '%s\n' "ОШИБКА: проверка восстановления провалена, MYDON не ответил, аварийного канала нет — тревога никуда не ушла" >&2
    return 1
  fi
  # Токен не попадает в argv (виден в ps): URL уходит через stdin (curl -K-).
  curl -sf -m 30 -F chat_id="${chat}" \
    -F text="🚨 Проверка восстановления бэкапа MYDON провалена. ${reason} Смотри: /opt/backups/restore_test.log" \
    -K- <<< "url = \"https://api.telegram.org/bot${bot}/sendMessage\"" >/dev/null ||
    printf '%s\n' "ОШИБКА: Telegram не принял тревогу о проваленной проверке восстановления" >&2
}

cleanup() {
  if [ "$CONTAINER_CREATED" -eq 1 ]; then
    "$DOCKER_BIN" rm -f "$RESTORE_CONTAINER" >/dev/null 2>&1 || true
    CONTAINER_CREATED=0
  fi
  if [ -n "$TMP_DIR" ] && [ -d "$TMP_DIR" ]; then
    rm -rf -- "$TMP_DIR"
    TMP_DIR=""
  fi
}

# Тревога висит на EXIT, а не дописана к каждому `exit 1`.
# Точек выхода в скрипте больше десяти, и 07.09.2026 провал случился ровно в той,
# про которую забыли бы: проверка упала, а узнал об этом никто и через двое суток.
# Один обработчик покрывает и существующие выходы, и те, что допишут потом.
on_exit() {
  local rc=$?
  cleanup
  [ "$rc" -ne 0 ] && alert "$rc"
  exit "$rc"
}
trap on_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

q_live() {
  "$DB_HELPER" query "$1" 2>/dev/null | tr -d '[:space:]'
}
q_restore() {
  "$DOCKER_BIN" exec "$RESTORE_CONTAINER" psql -U mydon -d restore \
    -v ON_ERROR_STOP=1 -Atc "$1" 2>/dev/null | tr -d '[:space:]'
}
# Создаёт ли одна из ПОСЛЕДНИХ (live − restored) миграций таблицу $1.
# Счётчик журнала — лишь прокси «что-то новее дампа»: без проверки по файлам
# ЛЮБАЯ пост-дамповая миграция (хоть одна колонка) амнистировала бы таблицу,
# которую дамп на самом деле потерял. Файлы нумерованы и сортируются
# синхронно с журналом.
newer_migrations_create_table() {
  n=$(( live_migrations - restored_migrations ))
  printf '%s\n' "$MIG_DIR"/*.sql | sort | tail -n "$n" |
    xargs grep -sl "CREATE TABLE.*\"$1\"" >/dev/null 2>&1
}

say "=== Проверка восстановления базы MYDON · $(date '+%d.%m.%Y %H:%M') ==="

# Каналы проверяются ДО работы, как в disk_guard: сторож без канала молчит ровно
# до дня аварии, а в этот день молчит тоже. Узнать о сломанной конфигурации в
# момент настоящего провала — значит не узнать вообще.
INGEST_KEY=$(env_value INGEST_KEY "$MYDON_ENV")
if [ -z "${INGEST_KEY:-}" ] &&
   { [ -z "$(env_value TG_BACKUP_BOT_TOKEN "$MYDON_ENV")" ] || [ -z "$(env_value TG_BACKUP_CHAT_ID "$MYDON_ENV")" ]; } &&
   { [ -z "$(env_value WATCHDOG_BOT_TOKEN "$ALERT_ENV")" ] || [ -z "$(env_value WATCHDOG_CHAT_IDS "$ALERT_ENV")" ]; }; then
  say "ПРОВАЛ: нет ни INGEST_KEY в $MYDON_ENV, ни аварийного бота (TG_BACKUP_* там же или WATCHDOG_* в $ALERT_ENV) — о проваленной проверке сказать будет некому"
  exit 1
fi

if [ -z "$DUMP" ]; then
  DUMP=$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'mydon-app_*.sql.gz' \
    -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -n 1 | cut -d' ' -f2-)
fi
if [ -z "${DUMP:-}" ] || [ ! -f "$DUMP" ]; then
  say "ПРОВАЛ: дамп MYDON не найден"
  exit 1
fi
if ! [[ "$MAX_DUMP_AGE_HOURS" =~ ^[1-9][0-9]*$ ]]; then
  say "ПРОВАЛ: RESTORE_DUMP_MAX_AGE_HOURS должен быть целым числом больше нуля"
  exit 1
fi
dump_age_seconds=$(( $(date +%s) - $(stat -c %Y "$DUMP") ))
if [ "$dump_age_seconds" -lt 0 ]; then dump_age_seconds=0; fi
dump_age_hours=$(( dump_age_seconds / 3600 ))
if [ "$dump_age_hours" -gt "$MAX_DUMP_AGE_HOURS" ]; then
  say "ПРОВАЛ: свежему дампу уже ${dump_age_hours} ч (порог ${MAX_DUMP_AGE_HOURS} ч)"
  exit 1
fi
say "1. Дамп: $(basename "$DUMP") ($(du -h "$DUMP" | cut -f1)), снят $(stat -c %y "$DUMP" | cut -d. -f1)"

if ! gunzip -t "$DUMP" 2>/dev/null; then
  say "ПРОВАЛ: архив повреждён"
  exit 1
fi
if ! gunzip -c "$DUMP" | tail -10 | grep -q 'dump complete'; then
  say "ПРОВАЛ: в SQL нет финального маркера pg_dump"
  exit 1
fi
[ -x "$DB_HELPER" ] || { say "ПРОВАЛ: helper $DB_HELPER не установлен"; exit 1; }
if ! "$DB_HELPER" ping >/dev/null 2>&1; then
  say "ПРОВАЛ: активная БД недоступна для контрольного чтения"
  exit 1
fi
say "   архив целый, активная БД отвечает"

mkdir -p "$TEMP_ROOT"
TMP_DIR=$(mktemp -d "$TEMP_ROOT/.mydon-restore.XXXXXX") || {
  say "ПРОВАЛ: не удалось создать временный каталог"
  exit 1
}
password=$(openssl rand -hex 24) || { say "ПРОВАЛ: openssl не создал пароль"; exit 1; }
printf 'POSTGRES_USER=mydon\nPOSTGRES_PASSWORD=%s\nPOSTGRES_DB=restore\n' "$password" \
  > "$TMP_DIR/postgres.env"
unset password
chmod 600 "$TMP_DIR/postgres.env"

if ! "$DOCKER_BIN" run -d --name "$RESTORE_CONTAINER" --network none \
  --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=768m \
  --env-file "$TMP_DIR/postgres.env" "$CLIENT_IMAGE" >/dev/null; then
  say "ПРОВАЛ: не удалось запустить изолированный PostgreSQL"
  exit 1
fi
CONTAINER_CREATED=1
# Готовность проверяется тем самым запросом, которым потом разворачивают дамп,
# а НЕ через pg_isready.
#
# Образ postgres во время initdb поднимает служебный сервер на unix-сокете и
# только потом создаёт POSTGRES_DB. pg_isready в это окно отвечает «принимает
# соединения» — сервер-то живой, — и скрипт шёл дальше к psql, который получал
# FATAL: database "restore" does not exist. Так упала проверка 07.09.2026 при
# целом бэкапе: гейт проверял живость сервера, а пользовались базой.
ready=0
for _ in $(seq 1 60); do
  if "$DOCKER_BIN" exec "$RESTORE_CONTAINER" \
      psql -U mydon -d restore -v ON_ERROR_STOP=1 -Atc 'select 1' >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [ "$ready" -ne 1 ]; then
  "$DOCKER_BIN" logs --tail 30 "$RESTORE_CONTAINER" >&2 || true
  say "ПРОВАЛ: временный PostgreSQL не принял запрос к базе restore за 60 секунд"
  exit 1
fi
say "2. Изолированный PostgreSQL 17 готов (network=none, data=tmpfs)"

RESTORE_LOG="$TMP_DIR/restore.log"
if ! gunzip -c "$DUMP" | "$DOCKER_BIN" exec -i "$RESTORE_CONTAINER" \
  psql -U mydon -d restore -v ON_ERROR_STOP=1 --single-transaction \
  >/dev/null 2>"$RESTORE_LOG"; then
  say "ПРОВАЛ: psql не смог восстановить дамп целиком"
  tail -30 "$RESTORE_LOG" >&2 || true
  exit 1
fi
say "3. Дамп развёрнут атомарно"

say "4. Сверка данных (активная база → восстановленная):"
# Журнал миграций — арбитр для «таблицы нет в дампе». Пустой ответ q_restore
# раньше означал сразу три разных вещи (новая таблица / дамп потерял таблицу /
# сбой docker exec) и все три шли в безобидные NEW_TABLES: бэкап, молча
# потерявший таблицу, проходил weekly-проверку зелёным.
live_migrations=$(q_live "select count(*) from drizzle.__drizzle_migrations")
restored_migrations=$(q_restore "select count(*) from drizzle.__drizzle_migrations")
if ! [[ "$live_migrations" =~ ^[0-9]+$ ]] || ! [[ "$restored_migrations" =~ ^[0-9]+$ ]]; then
  say "   ПРОВАЛ: журнал миграций не читается (активная: '${live_migrations}', дамп: '${restored_migrations}')"
  FAILED=1
  live_migrations=-1
  restored_migrations=-1
else
  say "   миграций: активная $live_migrations, в дампе $restored_migrations"
fi
for table in entity collection sale purchase machine_stock person task audit_log; do
  live=$(q_live "select count(*) from $table")
  restored=$(q_restore "select count(*) from $table")
  if ! [[ "$live" =~ ^[0-9]+$ ]]; then
    say "   ПРОВАЛ $table: таблица не читается в активной базе"
    FAILED=1
  elif [ -z "$restored" ]; then
    exists=$(q_restore "select count(*) from information_schema.tables where table_schema='public' and table_name='$table'")
    if [ "$exists" != "0" ]; then
      say "   ПРОВАЛ $table: запрос к восстановленной базе не отработал (docker exec/psql)"
      FAILED=1
    elif [ "$live_migrations" -lt 0 ]; then
      say "   ПРОВАЛ $table: отсутствует в дампе, а журнал миграций не читается — происхождение не проверить"
      FAILED=1
    elif [ "$live_migrations" -le "$restored_migrations" ]; then
      say "   ПРОВАЛ $table: отсутствует в дампе при совпадающем журнале миграций — дамп ПОТЕРЯЛ таблицу"
      FAILED=1
    elif [ ! -d "$MIG_DIR" ]; then
      say "   ПРОВАЛ $table: миграции новее дампа, но каталог $MIG_DIR недоступен — происхождение не проверить"
      FAILED=1
    elif newer_migrations_create_table "$table"; then
      # Единственный законный случай «в дампе нет»: таблицу создала миграция,
      # применённая после снятия дампа — следующий ночной дамп её покроет.
      say "   новая $table: создана миграцией новее дампа, в активной базе $live"
      NEW_TABLES=$((NEW_TABLES + 1))
    else
      say "   ПРОВАЛ $table: миграции новее дампа её НЕ создают — дамп ПОТЕРЯЛ таблицу"
      FAILED=1
    fi
  elif ! [[ "$restored" =~ ^[0-9]+$ ]]; then
    say "   ПРОВАЛ $table: восстановленное значение некорректно"
    FAILED=1
  elif [ "$restored" -eq 0 ] && [ "$live" -gt 0 ]; then
    say "   ПРОВАЛ $table: в дампе пусто, а в активной базе $live"
    FAILED=1
  else
    say "   ок $table: активная $live → из дампа $restored"
  fi
done

live_sum=$(q_live "select coalesce(sum(amount),0)::bigint from collection where status='received'")
restored_sum=$(q_restore "select coalesce(sum(amount),0)::bigint from collection where status='received'")
if ! [[ "$live_sum" =~ ^-?[0-9]+$ ]] || ! [[ "$restored_sum" =~ ^-?[0-9]+$ ]]; then
  say "   ПРОВАЛ инкассации: таблица или сумма не читается"
  FAILED=1
elif [ "$restored_sum" -eq 0 ] && [ "$live_sum" -gt 0 ]; then
  say "   ПРОВАЛ инкассации: суммы в дампе нулевые"
  FAILED=1
else
  say "   ок суммы инкассаций: активная $live_sum → из дампа $restored_sum"
fi

cleanup
if "$DOCKER_BIN" ps -a --format '{{.Names}}' | grep -qx "$RESTORE_CONTAINER"; then
  say "ПРОВАЛ: временный контейнер остался после проверки"
  exit 1
fi
say "5. Временный контейнер и данные удалены"

if [ "$FAILED" -ne 0 ]; then
  say "ИТОГ: ЕСТЬ ПРОБЛЕМЫ — смотри строки «ПРОВАЛ» выше."
  exit 1
fi
if [ "$NEW_TABLES" -gt 0 ]; then
  say "ИТОГ: бэкап восстанавливается. Новых таблиц вне дампа: $NEW_TABLES."
else
  say "ИТОГ: бэкап базы MYDON восстанавливается, данные на месте."
fi

# Weekly cron:
#   45 3 * * 1 /opt/backups/restore_test_mydon.sh >> /opt/backups/restore_test_mydon.log 2>&1

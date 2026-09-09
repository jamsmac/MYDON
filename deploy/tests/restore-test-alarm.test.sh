#!/usr/bin/env bash
# Проверка восстановления бэкапа не молчит о своём провале и ждёт настоящую базу.
#
# Проверяется ровно то, что сломалось в бою 07.09.2026:
#   1) проверка упала и никто не узнал — у скрипта не было канала тревоги,
#      в отличие от disk_guard/healthz_guard/backup_extra;
#   2) упала она потому, что готовность мерилась через pg_isready: образ
#      postgres во время initdb поднимает служебный сервер на сокете и только
#      потом создаёт POSTGRES_DB, а pg_isready в это окно уже отвечает «жив».
#
# Сценарий Г — ловушка на регресс: если гейт вернуть на pg_isready, разворот
# дампа начнётся до появления базы и тест покраснеет.
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
SCRIPT="$ROOT/deploy/restore_test_mydon.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
fail() { printf 'restore-test-alarm: FAIL %s\n' "$*" >&2; exit 1; }

mkdir -p "$TMP/bin" "$TMP/backups"

# ── Фикстуры внешних команд ───────────────────────────────────────────────────

# curl: Telegram отличается флагом -K-, через который в настоящем скрипте уходит
# URL с токеном (он не должен попадать в argv — там его видно в ps).
cat > "$TMP/bin/curl" <<'FAKE'
#!/usr/bin/env bash
set -u
tg=0
for a in "$@"; do [ "$a" = "-K-" ] && tg=1; done
{
  printf 'ARGS %s\n' "$*"
  if [ "$tg" -eq 1 ]; then printf 'STDIN '; cat; printf '\n'; fi
} >> "$FAKE_CURL_LOG"
[ "$tg" -eq 1 ] && exit "${FAKE_CURL_TG_RC:-0}"
exit "${FAKE_CURL_INGEST_RC:-0}"
FAKE

# stat -c: скрипт написан под GNU stat, а тест обязан идти и на macOS.
cat > "$TMP/bin/stat" <<'FAKE'
#!/usr/bin/env bash
set -u
case "${1:-}" in
  -c) case "$2" in
        %Y) date +%s ;;
        %y) date '+%F %T.000000000 +0000' ;;
        *)  printf '0\n' ;;
      esac ;;
  *) printf '0\n' ;;
esac
FAKE

# sleep: гейт готовности крутит до 60 итераций — тест не должен их отсиживать.
printf '#!/bin/sh\nexit 0\n' > "$TMP/bin/sleep"

# db_access.sh: активная база отвечает, все счётчики — единицы.
cat > "$TMP/bin/db_access.sh" <<'FAKE'
#!/usr/bin/env bash
set -u
case "${1:-}" in
  ping)  exit "${FAKE_DB_PING_RC:-0}" ;;
  query) printf '1\n' ;;
  *)     exit 1 ;;
esac
FAKE

# docker: контейнер поднимается, но база restore появляется не сразу.
#
# psql -Atc 'select 1'  — гейт готовности: до FAKE_READY_AFTER попыток отвечает
#                         отказом, как настоящий psql при отсутствующей базе;
# pg_isready            — всегда «жив», как настоящий во время initdb;
# psql со stdin         — разворот дампа: если базы ещё нет, повторяет боевую
#                         ошибку «database restore does not exist».
cat > "$TMP/bin/docker" <<'FAKE'
#!/usr/bin/env bash
set -u
log() { printf '%s\n' "$*" >> "$FAKE_DOCKER_LOG"; }
case "${1:-}" in
  run) log "RUN"; printf 'fixture-container\n'; exit 0 ;;
  rm)  log "RM"; exit 0 ;;
  ps)  exit 0 ;;
  exec) ;;
  *) exit 0 ;;
esac
shift
args="$*"
case "$args" in
  *pg_isready*)
    log "ISREADY"
    exit 0 ;;
  *"select 1"*)
    n=0
    [ -f "$FAKE_READY_COUNT" ] && n=$(cat "$FAKE_READY_COUNT")
    n=$((n + 1)); printf '%s' "$n" > "$FAKE_READY_COUNT"
    if [ "$n" -lt "${FAKE_READY_AFTER:-3}" ]; then
      log "READY_MISS $n"
      exit 1
    fi
    log "READY_OK $n"
    printf '1\n'
    exit 0 ;;
  *-Atc*)
    # Сверка данных после разворота: любое число, лишь бы совпадало с активной.
    printf '1\n'
    exit 0 ;;
  *)
    # Разворот дампа: без базы — та самая боевая ошибка.
    cat > /dev/null
    log "RESTORE_ATTEMPT"
    if ! grep -q '^READY_OK' "$FAKE_DOCKER_LOG"; then
      printf 'psql: error: FATAL: database "restore" does not exist\n' >&2
      exit 1
    fi
    log "RESTORE_OK"
    exit 0 ;;
esac
FAKE

chmod +x "$TMP/bin"/*

# Настоящий дамп: gzip, у которого в хвосте есть маркер конца pg_dump.
DUMP="$TMP/backups/mydon-app_fixture.sql.gz"
printf 'SELECT 1;\n--\n-- PostgreSQL database dump complete\n--\n' | gzip > "$DUMP"

MYDON_ENV="$TMP/mydon.env"
ALERT_ENV="$TMP/heartbeat.env"
printf '%s\n' 'WATCHDOG_BOT_TOKEN=fixture-watchdog-token' \
  'WATCHDOG_CHAT_IDS=5551,5552' > "$ALERT_ENV"

run() {  # run [доп. переменные окружения через env]
  : > "$TMP/curl.log"
  : > "$TMP/docker.log"
  rm -f "$TMP/ready.count"
  env \
    PATH="$TMP/bin:$PATH" \
    MYDON_ENV_FILE="$MYDON_ENV" \
    WATCHDOG_ENV_FILE="$ALERT_ENV" \
    CORE_INGEST_URL="http://ingest.fixture/ingest" \
    RESTORE_DUMP_PATH="$DUMP" \
    RESTORE_TEMP_ROOT="$TMP/backups" \
    RESTORE_MIGRATIONS_DIR="$TMP/migrations" \
    DB_HELPER="$TMP/bin/db_access.sh" \
    RESTORE_DOCKER_BIN="$TMP/bin/docker" \
    FAKE_CURL_LOG="$TMP/curl.log" \
    FAKE_DOCKER_LOG="$TMP/docker.log" \
    FAKE_READY_COUNT="$TMP/ready.count" \
    "$@" \
    bash "$SCRIPT" > "$TMP/out.log" 2>&1
}

# ── А. Провал без каналов: скрипт не притворяется здоровым ────────────────────
# Пусты оба источника секретов — и .env mydon, и аварийный бот сторожа.
: > "$MYDON_ENV"
if run WATCHDOG_ENV_FILE="$TMP/нет-такого.env"; then
  fail "А: без каналов скрипт вышел с кодом 0"
fi
grep -q 'ПРОВАЛ: нет ни INGEST_KEY' "$TMP/out.log" ||
  fail "А: не сказано, что тревогу отправить некому: $(tail -2 "$TMP/out.log")"

# Дальше каналы есть.
printf '%s\n' 'INGEST_KEY=fixture-ingest-key' > "$MYDON_ENV"

# ── Б. Провал уходит событием в Core, с причиной ──────────────────────────────
if run RESTORE_DUMP_PATH="$TMP/backups/нет-такого.sql.gz"; then
  fail "Б: отсутствующий дамп не считается провалом"
fi
grep -q 'ingest.fixture/ingest/fixture-ingest-key' "$TMP/curl.log" ||
  fail "Б: событие в Core не отправлено: $(cat "$TMP/curl.log")"
grep -q 'infra.restore_test' "$TMP/curl.log" ||
  fail "Б: у события нет типа infra.restore_test"
grep -q 'дамп MYDON не найден' "$TMP/curl.log" ||
  fail "Б: в тревогу не попала причина провала"

# ── В. Core молчит — тревога идёт в Telegram, токен не в argv ─────────────────
if run FAKE_CURL_INGEST_RC=7 RESTORE_DUMP_PATH="$TMP/backups/нет-такого.sql.gz"; then
  fail "В: отсутствующий дамп не считается провалом"
fi
grep -q 'STDIN .*api.telegram.org/botfixture-watchdog-token' "$TMP/curl.log" ||
  fail "В: тревога не ушла в Telegram аварийным ботом: $(cat "$TMP/curl.log")"
if grep '^ARGS' "$TMP/curl.log" | grep -q 'fixture-watchdog-token'; then
  fail "В: токен бота попал в argv — он виден в ps"
fi

# ── Г. Гейт готовности ждёт базу, а не живость сервера ────────────────────────
# Ловушка: верните pg_isready — разворот дампа начнётся до появления базы,
# фикстура ответит боевым «database restore does not exist», и тест покраснеет.
run || true
grep -q '^READY_OK' "$TMP/docker.log" ||
  fail "Г: гейт ни разу не дождался ответа от базы restore: $(cat "$TMP/docker.log")"
grep -q '^READY_MISS' "$TMP/docker.log" ||
  fail "Г: гейт не сделал ни одной неуспешной попытки — фикстура не сработала"
if [ "$(grep -n '^RESTORE_ATTEMPT' "$TMP/docker.log" | cut -d: -f1 | head -1)" -lt \
     "$(grep -n '^READY_OK' "$TMP/docker.log" | cut -d: -f1 | head -1)" ]; then
  fail "Г: разворот дампа начался ДО того, как база restore ответила"
fi

# ── Д. Успешный прогон молчит: ложная тревога обесценивает настоящую ──────────
run || fail "Д: успешный прогон вышел с ненулевым кодом: $(tail -3 "$TMP/out.log")"
grep -q 'ИТОГ: бэкап базы MYDON восстанавливается' "$TMP/out.log" ||
  fail "Д: нет итоговой строки успеха: $(tail -3 "$TMP/out.log")"
if [ -s "$TMP/curl.log" ]; then
  fail "Д: при успехе всё равно ушла тревога: $(cat "$TMP/curl.log")"
fi

printf 'restore-test-alarm: OK (А, Б, В, Г, Д)\n'

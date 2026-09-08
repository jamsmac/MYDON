"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { AGENTS_SNAPSHOT_INTERVAL_MS } from "@mydon/shared";
import { saveSystemConfig } from "../app/system/actions";
import { PAUSE_LED, PAUSE_WORD } from "../lib/state";

/**
 * Пауза агентского слоя прямо на доске рутин.
 *
 * Два тумблера, а не один: расписания и назначенные задачи глушатся по
 * отдельности — так написано в самих настройках Core, и объединять их здесь
 * значило бы дать владельцу рубильник, которого в системе нет.
 *
 * Подписи скопированы ДОСЛОВНО из `config-spec.ts` (ключи
 * `AGENTS_SCHEDULES_PAUSED` / `AGENTS_TASKS_PAUSED`): на `/system` и на
 * `/crons` один и тот же тумблер обязан объясняться одинаково.
 */
const TOGGLES = [
  {
    key: "AGENTS_SCHEDULES_PAUSED",
    label: "Расписания cron",
    help: "1 — запуски по cron выключены; 0 — работают расписания из паспортов. На назначенные агентам через Core задачи не влияет.",
  },
  {
    key: "AGENTS_TASKS_PAUSED",
    label: "Назначенные задачи",
    help: "1 — Agents прекращает новые claims задач, назначенных через Core; уже начатая задача завершается, durable outbox доставляется. 0 — task-worker опрашивает очередь. На cron-расписания не влияет.",
  },
] as const;

/**
 * Настройку агенты перечитывают своим циклом, а не по сигналу от панели.
 * «Сохранено» без срока владелец прочитал бы как «уже выключено» — и пошёл бы
 * искать поломку, увидев следующий запуск по расписанию.
 */
const APPLIED = `Сохранено · применится в течение ${AGENTS_SNAPSHOT_INTERVAL_MS / 60_000} мин (агенты перечитывают настройки).`;

function Toggle({ item, paused }: { item: (typeof TOGGLES)[number]; paused: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(paused);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  /**
   * Инициализатор `useState` выполняется ОДИН раз — при монтировании (ловушка
   * App Router из памяти проекта). Без этой синхронизации тумблер застывал бы
   * на значении первого рендера: правка из «Системы», из другой вкладки или
   * прямо в `.env` доехала бы до сервера, а на доске владелец видел бы старое
   * состояние и считал, что пауза снята. Побеждает сервер.
   */
  useEffect(() => setOn(paused), [paused]);

  function toggle() {
    const next = !on;
    start(async () => {
      const res = await saveSystemConfig(item.key, next ? "1" : "0");
      if (!res.ok) {
        // Состояние НЕ трогаем: тумблер, показавший «работают» после отказа
        // Core, врёт о системе — владелец уйдёт с доски в уверенности, что
        // расписания включены.
        setMsg({ kind: "err", text: res.error ?? "Не удалось сохранить" });
        return;
      }
      setOn(next);
      setMsg({ kind: "ok", text: APPLIED });
      router.refresh();
    });
  }

  return (
    <div className="row" style={{ display: "block" }}>
      <div className="form-actions">
        <button
          type="button"
          role="switch"
          aria-checked={on}
          className="btn"
          onClick={toggle}
          disabled={pending}
        >
          {item.label}
        </button>
        <span className={PAUSE_LED[on ? "on" : "off"]}>{PAUSE_WORD[on ? "on" : "off"]}</span>
        {pending && <span className="hint">Сохраняю…</span>}
      </div>
      <small className="hint">{item.help}</small>
      {msg && (
        <small
          className={msg.kind === "ok" ? "hint" : "err-text"}
          style={{ display: "block", marginTop: 6 }}
        >
          {msg.text}
        </small>
      )}
    </div>
  );
}

export function PauseToggles({ schedules, tasks }: { schedules: boolean; tasks: boolean }) {
  const state = { AGENTS_SCHEDULES_PAUSED: schedules, AGENTS_TASKS_PAUSED: tasks };
  return (
    <div className="rows">
      {TOGGLES.map((item) => (
        <Toggle key={item.key} item={item} paused={state[item.key]} />
      ))}
    </div>
  );
}

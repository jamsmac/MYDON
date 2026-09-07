"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { AutonomyTier } from "@mydon/shared";
import { deleteAgent, saveAgent, setAgentAutonomy, toggleAgent } from "../app/agents/actions";
import type { AgentCard } from "../lib/core";
import { CARD_PILL, CARD_WORD } from "../lib/state";

const TIERS: { value: AutonomyTier; label: string }[] = [
  { value: "T0", label: "T0 — только спрашивает" },
  { value: "T1", label: "T1 — предлагает, решаешь ты" },
  { value: "T2", label: "T2 — мелкое делает сам" },
  { value: "T3", label: "T3 — многое делает сам" },
  { value: "T4", label: "T4 — почти всё сам" },
];

const BUSINESSES = [
  { value: "shared", label: "Общий" },
  { value: "globerent", label: "GLOBERENT" },
  { value: "vendhub", label: "VendHub" },
  { value: "personal", label: "Личное" },
  { value: "mydon", label: "MYDON" },
];

/**
 * Общий порог системы (`AGENT_AUTONOMY_MAX` из `GET /system/config`) глазами
 * карточки — ТРИ разных случая, а не «значение или null».
 *
 * Прежний `null` смешивал «ответ пришёл, ключа в нём нет» и «ответа не было
 * вовсе», а причину отказа карточка молча выбрасывала — единственный блок из
 * шести, который отказывался объяснять себя. Отказ обязан назвать причину
 * своими словами; отсутствие ключа — сказать про ключ. Не знаем — говорим
 * прямо, а не выдаём одно за другое.
 *
 * `tier` — строка, а не `AutonomyTier`: в настройках лежит то, что записали, и
 * подсказка честно печатает записанное. Сравнивать порядком можно только
 * после `isAutonomyTier` (карточка агента, отметка «урезан потолком»).
 */
export type AutonomyMax =
  | { kind: "value"; tier: string }
  | { kind: "missing" }
  | { kind: "unreadable"; detail: string };

/**
 * Настройки агента.
 *
 * `autonomyMax` — ДЕЙСТВУЮЩИЙ общий порог системы, а не константа: подсказка
 * про порог была захардкожена значением «T0» и соврала бы в тот же день, когда
 * владелец порог поднимет (дефект Р-7).
 */
export function AgentEditor({ agent, autonomyMax }: { agent: AgentCard; autonomyMax: AutonomyMax }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Тир — управляемое поле: при отказе Core селект возвращается к прежнему
  // значению, иначе экран показывал бы тир, которого у агента нет.
  const [tier, setTier] = useState(agent.autonomyDefault);
  // Свой ответ у своего поля: тир сохраняется отдельно от кнопки «Сохранить»,
  // и одно сообщение на два действия читалось бы как ответ не на то нажатие.
  const [tierMsg, setTierMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const scheduleText = agent.schedule.map((s) => `${s.cron} | ${s.skill}`).join("\n");
  const on = agent.status === "active";

  function onSave(form: FormData) {
    start(async () => {
      const res = await saveAgent(agent.name, form);
      setMsg(res.ok ? { kind: "ok", text: "Сохранено" } : { kind: "err", text: res.error ?? "Ошибка" });
      if (res.ok) router.refresh();
    });
  }

  /**
   * Самостоятельность сохраняется СРАЗУ и своим маршрутом: в общем patch'е
   * карточки Core это поле отбрасывает, и кнопка «Сохранить» рапортовала
   * «Сохранено» над неизменённым тиром.
   */
  function onTier(next: AutonomyTier) {
    const было = tier;
    setTier(next);
    start(async () => {
      const res = await setAgentAutonomy(agent.name, next);
      if (res.ok) {
        setTierMsg({ kind: "ok", text: "Самостоятельность изменена" });
        router.refresh();
      } else {
        setTier(было);
        setTierMsg({ kind: "err", text: res.error ?? "Ошибка" });
      }
    });
  }

  function onToggle() {
    start(async () => {
      const res = await toggleAgent(agent.name, !on);
      if (res.ok) router.refresh();
      else setMsg({ kind: "err", text: res.error ?? "Ошибка" });
    });
  }

  function onDelete() {
    start(async () => {
      const res = await deleteAgent(agent.name);
      if (res.ok && res.goTo) router.push(res.goTo);
      else setMsg({ kind: "err", text: res.error ?? "Ошибка" });
    });
  }

  return (
    <div className="card">
      <div className="card-top">
        {/* Пилюля читает СТАТУС, а не булев `on`: у `draft` и `deprecated`
            свои слова, а «выключен» на них врал. `on` остаётся для кнопки —
            она предлагает ровно два действия. */}
        <span className={CARD_PILL[agent.status]}>{CARD_WORD[agent.status]}</span>
        <button type="button" className="btn" onClick={onToggle} disabled={pending}>
          {on ? "Выключить" : "Включить"}
        </button>
      </div>

      {/* Самостоятельность — ВНЕ общей формы: она меняется своим маршрутом и
          сохраняется сразу, а не кнопкой «Сохранить». Поле в форме было бы
          обещанием, которого Core не исполняет (дефект Р-7). */}
      <div className="form">
        <label>
          <span>Самостоятельность</span>
          <select
            value={tier}
            disabled={pending}
            // Тир берём из САМОГО списка, а не приводим типом: селект не умеет
            // вернуть значение, которого не рисовал, и каст здесь был бы
            // обещанием за Core — тир уезжает в owner-маршрут смены автономии.
            onChange={(event) => {
              const выбран = TIERS.find((t) => t.value === event.target.value);
              if (выбран) onTier(выбран.value);
            }}
          >
            {TIERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <small className="hint">
            {autonomyMax.kind === "unreadable"
              ? `Общий порог системы прочитать не удалось: ${autonomyMax.detail}. Что действует сейчас — видно в Системе.`
              : autonomyMax.kind === "missing"
                ? "Общий порог системы Core не назвал: ключа AGENT_AUTONOMY_MAX в настройках нет. Какой порог действует, отсюда не видно — смотри Систему."
                : `Общий порог системы сейчас ${autonomyMax.tier}${
                    autonomyMax.tier === "T0"
                      ? " — что бы ни стояло здесь, агент только предлагает."
                      : "."
                  }`}
          </small>
        </label>
        {/* Ответ — ВНЕ label: иначе он попадал бы в подпись самого селекта. */}
        {tierMsg && (
          <span className={tierMsg.kind === "ok" ? "ok-text" : "err-text"}>{tierMsg.text}</span>
        )}
      </div>

      <form
        className="form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(new FormData(event.currentTarget));
        }}
      >
        <label>
          <span>Направление</span>
          <select name="business" defaultValue={agent.business}>
            {BUSINESSES.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </label>

        {/* Статус меняется кнопкой выше; в форме — скрытым полем, чтобы сохранение не сбрасывало его. */}
        <input type="hidden" name="status" value={agent.status} />

        <label>
          <span>Короткое описание</span>
          <input name="description" defaultValue={agent.description ?? ""} maxLength={512} />
        </label>

        <label>
          <span>Зачем нужен (миссия)</span>
          <textarea name="mission" rows={2} defaultValue={agent.mission ?? ""} maxLength={2000} />
        </label>

        <label>
          <span>Чего НЕ делает</span>
          <textarea
            name="nonGoals"
            rows={3}
            defaultValue={agent.nonGoals.join("\n")}
            placeholder="По одному на строку. Например: НЕ закупает товар"
          />
          <small className="hint">Границы важнее возможностей: тут пишем, куда агент не лезет.</small>
        </label>

        <label>
          <span>Навыки</span>
          <textarea
            name="skills"
            rows={3}
            defaultValue={agent.skills.join("\n")}
            placeholder="По одному на строку. Например: monitor-stock"
          />
        </label>

        <label>
          <span>Страницы знаний (KB)</span>
          <textarea
            name="kbPages"
            rows={3}
            defaultValue={(agent.kbPages ?? []).join("\n")}
            placeholder="По одной на строку. Например: shared/kb/globerent/heli-models.md"
          />
          <small className="hint">
            Что агент читает перед ответом: пути внутри apps/agents/shared (только shared/…/*.md). Нужны
            навыкам с исполнителем llm — например qualify-lead.
          </small>
        </label>

        <label>
          <span>Расписания</span>
          <textarea
            name="schedule"
            rows={3}
            defaultValue={scheduleText}
            placeholder="0 9 * * 1 | watch-receivables"
          />
          <small className="hint">
            Строка = «когда | что делать». Время ташкентское. Примеры: «0 9 * * *» — каждый день в
            09:00; «0 9 * * 1» — по понедельникам в 09:00; «30 7 * * *» — в 07:30.
          </small>
        </label>

        <label>
          <span>Потолок трат в день, $</span>
          <input
            name="budgetPerDayUsd"
            defaultValue={agent.budgetPerDayUsd ?? ""}
            placeholder="например 3"
            inputMode="decimal"
          />
        </label>

        <label>
          <span>При исчерпании бюджета</span>
          <select name="budgetOnExceeded" defaultValue={agent.budgetOnExceeded ?? ""}>
            <option value="">по умолчанию</option>
            <option value="pause">пауза — остановиться</option>
            <option value="downgrade">упростить — модель дешевле</option>
            <option value="ask">спросить владельца</option>
          </select>
        </label>

        <label>
          <span>Каналы идей (Telegram)</span>
          <textarea
            name="ideaChannels"
            rows={2}
            defaultValue={agent.ideaChannels.join("\n")}
            placeholder="По одному на строку. Например: promtjam"
          />
          <small className="hint">Публичные каналы, откуда агент берёт фишки (навыки scan-ideas / assess-ideas).</small>
        </label>

        <label>
          <span>Веб-источники (только чтение)</span>
          <textarea
            name="webSources"
            rows={3}
            defaultValue={agent.webSources.map((s) => `${s.name} | ${s.url}`).join("\n")}
            placeholder="Имя | https://адрес — по одному на строку"
          />
          <small className="hint">Сайты, которые агенту разрешено читать (навык read-sources).</small>
        </label>

        <label>
          <span>Навыки только через согласование (break-glass)</span>
          <textarea
            name="breakGlass"
            rows={2}
            defaultValue={agent.breakGlass.join("\n")}
            placeholder="По одному на строку. Эти навыки всегда спрашивают, даже на высокой автономии."
          />
        </label>

        <div className="form-actions">
          <button type="submit" className="btn primary" disabled={pending}>
            {pending ? "Сохраняю…" : "Сохранить"}
          </button>
          {msg && <span className={msg.kind === "ok" ? "ok-text" : "err-text"}>{msg.text}</span>}
        </div>
      </form>

      <div className="danger">
        {confirmDelete ? (
          <>
            <span className="err-text">Удалить «{agent.name}»? История его действий сохранится.</span>
            <button type="button" className="btn danger-btn" onClick={onDelete} disabled={pending}>
              Да, удалить
            </button>
            <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>
              Отмена
            </button>
          </>
        ) : (
          <button type="button" className="btn" onClick={() => setConfirmDelete(true)}>
            Удалить агента
          </button>
        )}
      </div>
    </div>
  );
}

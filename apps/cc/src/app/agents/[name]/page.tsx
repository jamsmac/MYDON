import Link from "next/link";
import { AUTONOMY_TIERS, isAutonomyTier, type AutonomyTier } from "@mydon/shared";
import {
  core,
  CoreUnavailable,
  type AgentCard,
  type AgentMemoryEvent,
  type AgentRun,
  type AgentStatusRow,
  type AuditEntry,
  type SkillDeck,
  type SystemConfigItem,
} from "../../../lib/core";
import { CoreDown } from "../../../components/core-down";
import { AgentEditor, type AutonomyMax } from "../../../components/agent-editor";
import { STATE_LED, STATE_WORD } from "../../../components/agent-grid";
import { Av8 } from "../../../components/av8";
import { RunSkillButton } from "../../../components/run-skill-button";
import { outcomeTone, runWhen } from "../../../lib/crons";
import { runPhrase } from "../../../lib/flows";
import { plural, when } from "../../../lib/format";
import { BUSINESS_LABEL, TIER_LABEL } from "../../../lib/labels";
import { runnable } from "../../../lib/skills";

export const dynamic = "force-dynamic";

/**
 * Карточка агента (волна A2, R-A2-5).
 *
 * Отвечает на вопрос «что этот агент такое и что он делает»: состояние с
 * причиной, что умеет, что делал по расписанию, что помнит и что с ним делал
 * владелец. КАЖДЫЙ БЛОК ЧИТАЕТСЯ СВОИМ ЗАПРОСОМ И В СВОЁМ try: пять источников
 * на странице, и отказ одного (журнал прогонов за отдельным гардом, память —
 * за своим) не имеет права уносить карточку целиком. Молчащий блок обязан
 * назвать, что именно не прочиталось, иначе пустой блок читается как «ничего
 * не было».
 */

/** Результат чтения одного блока: значение либо причина, почему его нет. */
type Прочитано<T> = { value: T; error: null } | { value: null; error: string };

async function прочитать<T>(fn: () => Promise<T>): Promise<Прочитано<T>> {
  try {
    return { value: await fn(), error: null };
  } catch (err) {
    // Причину показываем ЧЕЛОВЕКУ: у отказа Core это его объяснение
    // (`HTTP 401 на /events`), у прочего — сообщение ошибки без служебного
    // префикса `Error:`, который владельцу ничего не говорит.
    const detail =
      err instanceof CoreUnavailable ? err.detail : err instanceof Error ? err.message : String(err);
    return { value: null, error: detail };
  }
}

/**
 * Сколько записей журнала действий просим у Core.
 *
 * Фильтр по актору Core применяет САМ (`?actor=` — подстрока `actorRef`), и
 * окно относится уже к отобранным записям. До этой волны панель брала 200
 * последних записей ВСЕГО журнала и фильтровала их у себя: в шумный день
 * записи агента в это окно не попадали вовсе, и блок показывал «Пока ничего»
 * над работавшим агентом.
 */
const AUDIT_LIMIT = 100;

/** Сколько строк показываем: карточка отвечает «что было», а не «всё». */
const TRAIL_ROWS = 12;

/**
 * Запись журнала — про ЭТОГО агента?
 *
 * Проверяем обе формы `actorRef`: Core пишет и `agent:<имя>` (durable-исполнение
 * задач), и голое имя (запрос согласования). И проверяем ТОЧНО: фильтр Core —
 * подстрока, поэтому по имени «vendhub-ops» приезжает и «vendhub-ops-2».
 */
const егоЗапись = (e: AuditEntry, name: string): boolean =>
  e.actorRef === name || e.actorRef === `agent:${name}`;

/**
 * Что агент делал: его собственные записи плюс ЗАПУСКИ ЕГО НАВЫКОВ.
 *
 * Запуски — отдельным запросом намеренно: у них `actorRef` = владелец (запуск
 * делает человек), а агент назван в `target` как «<агент>/<навык>». Фильтра по
 * target у Core нет, поэтому берём все запуски и оставляем свои — иначе блок
 * молчал бы о том, что навык вообще запускали (дефект Р-7).
 */
async function trailOf(name: string): Promise<AuditEntry[]> {
  const [свои, запуски] = await Promise.all([
    core.audit(AUDIT_LIMIT, { actor: name }),
    core.audit(AUDIT_LIMIT, { action: "agent.skill.run" }),
  ]);
  const строки = new Map<string, AuditEntry>();
  for (const e of свои) if (егоЗапись(e, name)) строки.set(e.id, e);
  for (const e of запуски) if (e.target?.startsWith(`${name}/`)) строки.set(e.id, e);
  return [...строки.values()]
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .slice(0, TRAIL_ROWS);
}

/** Параметры хука одной строкой: имя хука уже стоит заголовком. */
function hookParams(hook: Record<string, unknown>, skip: readonly string[]): string {
  return Object.entries(hook)
    .filter(([key]) => !skip.includes(key))
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(" · ");
}

/**
 * Хуки, которые рантайм умеет исполнять (`apps/agents/src/hooks.ts`).
 *
 * Всё остальное он помечает `unknown` — и на `pre_run` это ЗАКРЫТЫЙ отказ:
 * навык не запускается вовсе (правило Р-4, паспорт попросил проверку, которой
 * движок не умеет). Поэтому список держим здесь, а не молчим: именно он
 * объясняет замолчавшего агента.
 */
const KNOWN_HOOKS = {
  preRun: ["source_fresh", "quiet_hours"],
  postRun: ["coach_lite"],
} as const;

interface HookRow {
  phase: "до прогона" | "после прогона";
  name: string;
  params: string;
  /** Рантайм такой хук не умеет: на pre_run это блокировка запуска. */
  unknown: boolean;
}

/**
 * Одна ветка хуков в строки карточки.
 *
 * Форму проверяем ПО ФАКТУ, а не по объявленному типу: в карточке Core это
 * json-колонка, куда попадало значение из сида паспорта, и одна кривая запись
 * (строка вместо списка, `null` вместо объекта) не должна ронять всю карточку
 * агента вместе с журналом и настройками.
 */
function hookRows(value: unknown, phase: HookRow["phase"], known: readonly string[]): HookRow[] {
  if (!Array.isArray(value)) return [];
  const rows: HookRow[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const hook = item as Record<string, unknown>;
    const kind = typeof hook.kind === "string" ? hook.kind : "";
    if (kind === "") continue;
    // Чужой kind рантайм нормализует в `{ kind: "unknown", raw: "<имя>" }` —
    // владельцу показываем имя из паспорта, а не слово «unknown».
    const raw = kind === "unknown" && typeof hook.raw === "string" ? hook.raw : null;
    rows.push({
      phase,
      name: raw ?? kind,
      params: hookParams(hook, raw === null ? ["kind"] : ["kind", "raw"]),
      unknown: !known.includes(kind),
    });
  }
  return rows;
}

/**
 * Хуки прогона паспорта (волна R): что проверяется ДО навыка и что делается
 * ПОСЛЕ. Показываем списком, потому что именно они объясняют исход
 * «остановлено хуком» в журнале прогонов — иначе владелец видит отказ без
 * причины. Правка — в паспорте агента, панель их только читает.
 */
function runHooks(agent: AgentCard): HookRow[] {
  // Обе формы имени, camelCase и snake_case: `tools/apply-passport-fields.mjs`
  // — единственный документированный путь доставки хуков в уже существующие
  // карточки — кладёт в Core СЫРОЙ раздел паспорта (`pre_run`/`post_run`), и
  // рантайм читает его обеими формами. Панель, знавшая только camelCase, на
  // документированной проверке выката всегда отвечала «не доехало».
  return [
    ...hookRows(agent.hooks?.preRun ?? agent.hooks?.pre_run, "до прогона", KNOWN_HOOKS.preRun),
    ...hookRows(agent.hooks?.postRun ?? agent.hooks?.post_run, "после прогона", KNOWN_HOOKS.postRun),
  ];
}

/**
 * Действие журнала → слова владельца.
 *
 * Здесь ровно то, что под фильтром по актору РЕАЛЬНО приезжает для агента:
 * четыре записи исполнения задач (`tasks.service.ts`) и запрос согласования.
 *
 * Убраны подписи, которые не приедут никогда, — они обещали блоку содержимое,
 * которого в нём нет: `agent.create/update/archive` пишет владелец, правя
 * карточку (`actorRef` = владелец, имя агента — в `target`), а
 * `approval.approved/rejected` пишутся как решение ЧЕЛОВЕКА (`actorKind:
 * "human"`, `target` = id запроса). Пока их подписи лежали здесь, четыре
 * самых частых действия агента падали в фолбэк и печатались владельцу
 * машинной строкой вида `task.agent_run.claimed`.
 */
const ACTION_LABEL: Record<string, string> = {
  "task.agent_run.claimed": "взял задачу в работу",
  "task.agent_execution.blocked": "застрял: исполнение задачи остановлено",
  "task.agent_run.action_capped": "упёрся в потолок действий — задача вернулась в очередь",
  "task.agent_run.released": "отпустил задачу",
  "approval.request": "попросил разрешения",
};

/** Действие словами. У запуска навыка имя навыка стоит в `target`. */
function действие(e: AuditEntry): string {
  if (e.action === "agent.skill.run") {
    const skill = e.target?.split("/")[1];
    return skill ? `запущен навык ${skill}` : "запущен навык";
  }
  return ACTION_LABEL[e.action] ?? e.action;
}

/** Навык, который агент запомнил: событие называется `agent.memory:<навык>`. */
const памятьНавыка = (e: AgentMemoryEvent): string =>
  e.type.slice("agent.memory:".length) || e.type;

/**
 * Действующий общий порог автономии — из конфига, а не из константы (Р-7).
 *
 * Три исхода вместо прежнего `null` на всё сразу: отказ чтения обязан назвать
 * причину, как это делают остальные пять блоков карточки, а «ключа в ответе
 * нет» — не то же самое, что «ответа не было». Раньше `конфиг.error`
 * выбрасывался молча, и редактор одинаково молчал в обоих случаях.
 */
function autonomyMaxOf(конфиг: Прочитано<SystemConfigItem[]>): AutonomyMax {
  if (конфиг.value === null) return { kind: "unreadable", detail: конфиг.error };
  const row = конфиг.value.find((i) => i.key === "AGENT_AUTONOMY_MAX");
  if (!row) return { kind: "missing" };
  // `effective` — действующее значение с учётом фолбэков ядра; его нет у
  // ключей без фолбэка, и тогда действует записанное.
  return { kind: "value", tier: row.effective ?? row.value };
}

/**
 * Потолок системы, который РЕЖЕТ номинальный тир агента, — или `null`.
 *
 * Пилюля в шапке — самый крупный текст экрана, и до этой правки она называла
 * номинальный тир действующим, хотя порог системы уже прочитан на этой же
 * странице и способен пинить агента в T0.
 *
 * Молчим во всех случаях, где потолок неизвестен: не прочитан, ключа нет или в
 * настройках лежит не тир. Объявить тир урезанным, не зная потолка, хуже, чем
 * не сказать ничего. Сравниваем ПОРЯДКОМ по `AUTONOMY_TIERS`, а не строками.
 */
function потолокНиже(nominal: AutonomyTier, порог: AutonomyMax): AutonomyTier | null {
  if (порог.kind !== "value" || !isAutonomyTier(порог.tier)) return null;
  return AUTONOMY_TIERS.indexOf(порог.tier) < AUTONOMY_TIERS.indexOf(nominal) ? порог.tier : null;
}

export default async function AgentPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;

  // Карточка — единственный обязательный источник: без неё показывать нечего.
  let agent: AgentCard;
  try {
    agent = await core.agent(name);
  } catch (err) {
    return <CoreDown detail={err instanceof CoreUnavailable ? err.detail : String(err)} />;
  }

  const [статус, навыки, прогоны, память, журнал, конфиг] = await Promise.all([
    прочитать<AgentStatusRow | null>(async () => {
      const { agents } = await core.agentsStatus();
      return agents.find((a) => a.name === name) ?? null;
    }),
    прочитать<SkillDeck>(() => core.skillDeck(name)),
    прочитать<AgentRun[]>(async () => (await core.agentRuns(name)).runs),
    прочитать<AgentMemoryEvent[]>(() => core.agentMemory(name)),
    прочитать<AuditEntry[]>(() => trailOf(name)),
    прочитать<SystemConfigItem[]>(() => core.systemConfig()),
  ]);

  const состояние = статус.value;
  const hooks = runHooks(agent);
  const порог = autonomyMaxOf(конфиг);
  // Потолок системы, если он режет номинальный тир: тогда шапка называет
  // ДЕЙСТВУЮЩИЙ тир, а не тот, что записан в карточке.
  const потолок = потолокНиже(agent.autonomyDefault, порог);
  const действующийТир = потолок ?? agent.autonomyDefault;
  // Час рендера — только для подписи дня прогона («сегодня 08:00» против
  // «03.09 08:00»): голое время читалось бы как сегодняшнее.
  const now = new Date();

  return (
    <>
      <div className="page-head">
        <Link href="/agents" className="back">
          ← Все агенты
        </Link>
      </div>

      <section className="panel console aghead" aria-labelledby="agent-name">
        <Av8 name={agent.name} />
        <div className="agb">
          <div className="eyebrow">{BUSINESS_LABEL[agent.business] ?? agent.business}</div>
          <h1 className="agn" id="agent-name">
            {agent.name}
          </h1>
          {состояние !== null ? (
            <>
              {/* Слова и лампа — из словаря сетки агентов: одно состояние
                  обязано называться одинаково на главной и в карточке. */}
              <div className="agled">
                <span className={STATE_LED[состояние.state]}>{STATE_WORD[состояние.state]}</span>
              </div>
              <div className="agr">{состояние.reason}</div>
            </>
          ) : (
            <div className="agr">
              {статус.error !== null
                ? `Состояние не прочиталось: ${статус.error}`
                : "Занятость: состояние Core не назвал — этого агента нет в ответе /agents/status (архивный или скрыт личным контуром)."}
            </div>
          )}
          <div className="tags">
            <span className="pill">{TIER_LABEL[действующийТир] ?? действующийТир}</span>
            {/* Отметка СЛОВАМИ и на экране, а не в `title`: подсказка при
                наведении не читается взглядом и не существует на телефоне. */}
            {потолок !== null && (
              <span className="pill warn">
                {`урезан потолком системы ${потолок} · в карточке ${agent.autonomyDefault}`}
              </span>
            )}
            <span className="pill num">
              {agent.skills.length} {plural(agent.skills.length, "навык", "навыка", "навыков")}
            </span>
            <span className="pill num">
              {agent.schedule.length}{" "}
              {plural(agent.schedule.length, "расписание", "расписания", "расписаний")}
            </span>
          </div>
          <p className="hint">{agent.description ?? "Описание не задано."}</p>
        </div>
      </section>

      <section aria-labelledby="agent-skills">
        <div className="section-title" id="agent-skills">
          Навыки
        </div>
        {навыки.error !== null ? (
          <p className="warn-text">{`Навыки не прочитались: ${навыки.error}`}</p>
        ) : навыки.value.items.length === 0 ? (
          <div className="empty">
            <b>Каталог навыков пуст</b>
            Каталог пишут сами агенты при старте — либо этот ещё не отчитывался, либо навыков у
            него нет.
          </div>
        ) : (
          <div className="rows">
            {навыки.value.items.map((item) => {
              const { canRun, reason } = runnable(item);
              return (
                <div className="row" key={item.skill}>
                  <div className="t">
                    <b>{item.skill}</b>
                    <small>{item.description}</small>
                  </div>
                  <span className="pill">{item.executor === "llm" ? "модель" : "код"}</span>
                  <span className="pill">
                    {item.tier ? (TIER_LABEL[item.tier] ?? item.tier) : "тир не задан"}
                  </span>
                  {/* Расписания — выражениями, а не числом: «2 расписания» не
                      отвечает на вопрос «когда он сработает». */}
                  <span className="when">
                    {item.crons.length > 0 ? item.crons.join(" · ") : "без расписания"}
                  </span>
                  <RunSkillButton
                    agent={agent.name}
                    skill={item.skill}
                    {...(canRun ? {} : { disabledReason: reason ?? "Запускать нечем" })}
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="agent-runs">
        <div className="section-title" id="agent-runs">
          Последние прогоны
        </div>
        {прогоны.error !== null ? (
          <p className="warn-text">{`Прогоны не прочитались: ${прогоны.error}`}</p>
        ) : прогоны.value.length === 0 ? (
          <div className="empty">
            <b>Прогонов ещё нет</b>
            Журнал заполняют сами агенты: первая сработавшая рутина появится здесь. Ноль прогонов —
            это не «всё в порядке», а «ещё ничего не было».
          </div>
        ) : (
          <div className="rows">
            {прогоны.value.map((r) => (
              <Link
                className="row"
                key={r.id}
                href={`/flows?${new URLSearchParams({ agent: agent.name, run: r.id }).toString()}`}
              >
                <div className="t">
                  <b>{r.skill}</b>
                  <small>
                    {/* Исход словами — общий словарь с доской рутин и ботом. */}
                    <span className={`led run-led ${outcomeTone(r)}`}>{runPhrase(r)}</span>
                  </small>
                </div>
                <span className="when">{runWhen(r.startedAt, now)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="agent-memory">
        <div className="section-title" id="agent-memory">
          Память
        </div>
        {память.error !== null ? (
          <p className="warn-text">{`Память не прочиталась: ${память.error}`}</p>
        ) : память.value.length === 0 ? (
          <div className="empty">
            <b>Агент ещё ничего не запомнил</b>
            Память пишется после поданного результата навыка — по ней агент понимает, изменилось ли
            что-то с прошлого раза.
          </div>
        ) : (
          <div className="rows">
            {память.value.map((e) => (
              <div className="row" key={e.id}>
                <div className="t">
                  <b>{памятьНавыка(e)}</b>
                  <small>запомнил повод прошлого результата</small>
                </div>
                <span className="when">{when(e.occurredAt)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {hooks.length > 0 && (
        <section aria-labelledby="agent-hooks">
          <div className="section-title" id="agent-hooks">
            Хуки прогона
          </div>
          <div className="rows">
            {hooks.map((h, i) => (
              <div className="row" key={`${h.phase}/${h.name}/${i}`}>
                <div className="t">
                  <b>{h.name}</b>
                  <small>{h.params || "без параметров"}</small>
                </div>
                {/* Неизвестный pre_run — это не «мелочь в паспорте»: рантайм
                    фейлится закрыто и навык не запускается ВООБЩЕ. Молчащий
                    агент объясняется здесь, иначе владелец ищет поломку в cron. */}
                {h.unknown && (
                  <span className={h.phase === "до прогона" ? "chip h" : "chip"}>
                    {h.phase === "до прогона"
                      ? "блокирует запуск: неизвестный kind"
                      : "неизвестный kind — рантайм пропустит"}
                  </span>
                )}
                <span className="when">{h.phase}</span>
              </div>
            ))}
          </div>
          <p className="hint" style={{ marginTop: 8 }}>
            Хуки приходят из паспорта агента и хранятся в его карточке — здесь только просмотр.
            Сработавший pre-run хук виден в <Link href="/crons">рутинах</Link> как «остановлено
            хуком».
          </p>
        </section>
      )}

      <section aria-labelledby="agent-trail">
        <div className="section-title" id="agent-trail">
          Что делал
        </div>
        {/* Блок называет своё содержимое честно: журнал сужен по актору, и
            правок карточки здесь нет — их делал владелец, а не агент. Иначе
            владелец будет искать тут след собственной смены тира. */}
        <p className="hint">
          Собственные действия агента и запуски его навыков. Правки карточки — тир, включение,
          описание — делает владелец, и в этот список они не попадают.
        </p>
        {журнал.error !== null ? (
          <p className="warn-text">{`Журнал действий не прочитался: ${журнал.error}`}</p>
        ) : журнал.value.length === 0 ? (
          <div className="empty">
            <b>Пока ничего</b>
            Действия появятся, когда агент отработает по расписанию или когда его навык запустят
            вручную.
          </div>
        ) : (
          <div className="rows">
            {журнал.value.map((e) => (
              <div className="row" key={e.id}>
                <div className="t">
                  <b>{действие(e)}</b>
                  <small>{e.actorRef ?? ""}</small>
                </div>
                <span className="when">{when(e.ts)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* `key` по имени агента — не украшение: у редактора есть собственное
          состояние (выбранный тир, подтверждение удаления), а при переходе с
          карточки на карточку React сохранил бы его на прежнем месте дерева, и
          селект показывал бы тир ПРОШЛОГО агента. */}
      <AgentEditor key={agent.name} agent={agent} autonomyMax={порог} />
    </>
  );
}

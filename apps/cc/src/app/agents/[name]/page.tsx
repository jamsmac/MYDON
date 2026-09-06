import Link from "next/link";
import { core, CoreUnavailable, type AgentCard, type AuditEntry } from "../../../lib/core";
import { CoreDown } from "../../../components/core-down";
import { AgentEditor } from "../../../components/agent-editor";
import { when } from "../../../lib/format";

export const dynamic = "force-dynamic";

/** Последние действия именно этого агента — «что он вообще делал». */
function ownTrail(all: AuditEntry[], name: string): AuditEntry[] {
  return all
    .filter((e) => e.actorRef === `agent:${name}` || e.actorRef === name || e.target === name)
    .slice(0, 12);
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
  return [
    ...hookRows(agent.hooks?.preRun, "до прогона", KNOWN_HOOKS.preRun),
    ...hookRows(agent.hooks?.postRun, "после прогона", KNOWN_HOOKS.postRun),
  ];
}

const ACTION_LABEL: Record<string, string> = {
  "agent.create": "заведён",
  "agent.update": "изменены настройки",
  "agent.archive": "удалён из работы",
  "approval.request": "попросил разрешения",
  "approval.approved": "получил одобрение",
  "approval.rejected": "получил отказ",
};

export default async function AgentPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;

  let agent: AgentCard;
  let trail: AuditEntry[] = [];
  try {
    agent = await core.agent(name);
    // Журнал не критичен для карточки: не показать историю — не повод падать.
    try {
      trail = ownTrail(await core.audit(200), name);
    } catch {
      trail = [];
    }
  } catch (err) {
    return <CoreDown detail={err instanceof CoreUnavailable ? err.detail : String(err)} />;
  }

  const hooks = runHooks(agent);

  return (
    <>
      <div className="page-head">
        <Link href="/agents" className="back">
          ← Все агенты
        </Link>
        <h1>{agent.name}</h1>
        <p>{agent.description ?? "Описание не задано."}</p>
      </div>

      <AgentEditor agent={agent} />

      {hooks.length > 0 && (
        <>
          <div className="section-title">Хуки прогона</div>
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
        </>
      )}

      <div className="section-title">Что делал</div>
      {trail.length === 0 ? (
        <div className="empty">
          <b>Пока ничего</b>
          Действия появятся, когда агент отработает по расписанию.
        </div>
      ) : (
        <div className="rows">
          {trail.map((e) => (
            <div className="row" key={e.id}>
              <div className="t">
                <b>{ACTION_LABEL[e.action] ?? e.action}</b>
                <small>{e.actorRef ?? ""}</small>
              </div>
              <span className="when">{when(e.ts)}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

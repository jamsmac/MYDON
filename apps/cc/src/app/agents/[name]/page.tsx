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

/** Параметры хука одной строкой: сам `kind` стоит заголовком. */
function hookParams(hook: Record<string, unknown>): string {
  return Object.entries(hook)
    .filter(([key]) => key !== "kind")
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(" · ");
}

/**
 * Хуки прогона паспорта (волна R): что проверяется ДО навыка и что делается
 * ПОСЛЕ. Показываем списком, потому что именно они объясняют исход
 * «остановлено хуком» в журнале прогонов — иначе владелец видит отказ без
 * причины. Правка — в паспорте агента, панель их только читает.
 */
function runHooks(agent: AgentCard): { phase: string; kind: string; params: string }[] {
  return [
    ...(agent.hooks?.preRun ?? []).map((h) => ({ phase: "до прогона", kind: h.kind, params: hookParams(h) })),
    ...(agent.hooks?.postRun ?? []).map((h) => ({ phase: "после прогона", kind: h.kind, params: hookParams(h) })),
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
              <div className="row" key={`${h.phase}/${h.kind}/${i}`}>
                <div className="t">
                  <b>{h.kind}</b>
                  <small>{h.params || "без параметров"}</small>
                </div>
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

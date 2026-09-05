import { BrainGraph } from "../../components/brain-graph";
import { ConsoleTheme } from "../../components/console-theme";
import { CoreDown } from "../../components/core-down";
import { core, CoreUnavailable, type DocsGraph } from "../../lib/core";
import { plural, when } from "../../lib/format";

export const dynamic = "force-dynamic";

/**
 * Экран «Мозг» — граф знаний репозитория глазами владельца (R-M-6).
 *
 * Отвечает на вопрос, на который не отвечает ни дерево документов, ни список
 * агентов: что с чем связано — какой роутер держит направление, чей это навык
 * и каким инструментом он лезет наружу.
 *
 * Тёмная тема: «Мозг» — агентский слой (§4 правил дизайна), как `/skills` и
 * `/agents`, а не бизнес-экран.
 */
export default async function BrainPage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string }>;
}) {
  const sp = await searchParams;
  // `?focus=` приходит по ссылке «Открыть в Мозге» из карточки документа:
  // владелец пришёл смотреть на конкретный узел, и экран открывается сразу
  // на нём, а не на всём графе.
  const focus = typeof sp.focus === "string" && sp.focus.length > 0 ? sp.focus : undefined;

  let graph: DocsGraph;
  try {
    graph = await core.docsGraph();
  } catch (err) {
    return <CoreDown detail={err instanceof CoreUnavailable ? err.detail : String(err)} />;
  }

  return (
    <>
      <ConsoleTheme />
      <div className="page-head">
        <h1>Мозг</h1>
        <p className="lead">
          {graph.nodes.length === 0
            ? "Core отдал пустой граф"
            : `${graph.nodes.length} ${plural(graph.nodes.length, "узел", "узла", "узлов")} · ${
                graph.edges.length
              } ${plural(graph.edges.length, "связь", "связи", "связей")} · собран ${when(
                graph.builtAt,
              )}`}
        </p>
      </div>

      {graph.nodes.length === 0 ? (
        <div className="empty">
          <b>Граф пуст</b>
          Core не видит документов — проверь сборку образа: без{" "}
          <span className="mono">docs/</span>, <span className="mono">memory/</span> и{" "}
          <span className="mono">routers/</span> связывать нечего.
        </div>
      ) : (
        <BrainGraph graph={graph} focus={focus} />
      )}
    </>
  );
}

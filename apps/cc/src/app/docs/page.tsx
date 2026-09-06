import Link from "next/link";
import { CoreDown } from "../../components/core-down";
import { DocView } from "../../components/doc-view";
import { DocsTree } from "../../components/docs-tree";
import { core, CoreUnavailable, type DocFileResult, type DocsTreeItem } from "../../lib/core";
import { plural, when } from "../../lib/format";

export const dynamic = "force-dynamic";

/**
 * Правая колонка: сам документ или объяснение, почему его нет.
 *
 * Четыре исхода вместо вложенных тернарников на экране — их видно списком, и
 * ни один не сводится к другому: «личное» и «не найден» говорят разное.
 */
function body(doc: DocFileResult | null, path: string | null, known: ReadonlySet<string>) {
  if (doc?.kind === "ok") return <DocView file={doc.file} known={known} />;
  if (doc?.kind === "forbidden") {
    // НЕ `.notice`: тот блок на `--hot-soft` — цвет просрочек и расхождений, а
    // закрытый личный контур не поломка, а правило, которое сработало верно.
    // Нейтральная карточка сообщает, не пугая (то же решение, что у метки
    // «личное» в дереве).
    return (
      <div className="empty">
        <b>Личный контур — только владельцу</b>
        <span className="mono">{path}</span> — содержимое памяти и личных роутеров Core отдаёт
        только тебе. Открой панель со своего входа.
      </div>
    );
  }
  if (doc?.kind === "missing") {
    return (
      <div className="notice">
        <b>Файл не найден или вне белого списка</b>
        <span className="mono">{path}</span> — Core отдаёт только документы, память, роутеры,
        движок, паспорта агентов и навыки.
      </div>
    );
  }
  return (
    <div className="empty">
      <b>Документ не выбран</b>
      Выбери файл в дереве — например <Link href="/docs?path=CLAUDE.md">CLAUDE.md</Link>, главный
      роутер репозитория.
    </div>
  );
}

/**
 * Экран «Документы» — репозиторий знаний глазами владельца (R-M-5).
 *
 * Читает только Core (Р-2): ни GitHub, ни файловой системы у панели нет.
 * Пустое дерево здесь значит не «документов нет», а «образ собрали без них» —
 * и экран говорит именно это, потому что чинить надо сборку, а не документы.
 */
export default async function DocsPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string }>;
}) {
  const sp = await searchParams;
  const path = typeof sp.path === "string" && sp.path.length > 0 ? sp.path : null;

  let tree: DocsTreeItem[];
  let doc: DocFileResult | null;
  try {
    // Дерево грузим всегда: даже когда запрошенного файла нет, владелец должен
    // остаться со списком документов, а не с пустым экраном.
    [tree, doc] = await Promise.all([
      core.docsTree(),
      path ? core.docFile(path) : Promise.resolve(null),
    ]);
  } catch (err) {
    return <CoreDown detail={err instanceof CoreUnavailable ? err.detail : String(err)} />;
  }

  // `reading` — не украшение: по нему на телефоне документ встаёт ПЕРЕД деревом
  // (globals.css). Иначе каждый переход по `?path=` высаживал владельца на верх
  // 46vh-дерева, а не на текст, за которым он и нажимал.
  const layout = path ? "docs-layout reading" : "docs-layout";

  const roots = new Set(tree.map((i) => i.root)).size;
  // ISO-строки Core одного формата, поэтому «самая свежая» — просто максимум.
  const updated = tree.reduce((max, i) => (i.updatedAt > max ? i.updatedAt : max), "");

  return (
    <>
      <div className="page-head">
        <h1>Документы</h1>
        <p className="lead">
          {tree.length === 0
            ? "Core отдал пустое дерево"
            : `${tree.length} ${plural(tree.length, "файл", "файла", "файлов")} в ${roots} ${plural(
                roots,
                "корне",
                "корнях",
                "корнях",
              )} · обновлено ${when(updated)}`}
        </p>
      </div>

      {tree.length === 0 ? (
        <div className="empty">
          <b>Документов нет</b>
          Образ собран без <span className="mono">docs/</span>, <span className="mono">memory/</span>{" "}
          и <span className="mono">routers/</span> — проверь сборку.
        </div>
      ) : (
        <div className={layout}>
          <DocsTree items={tree} active={path ?? undefined} />
          <div className="docs-body">{body(doc, path, new Set(tree.map((i) => i.path)))}</div>
        </div>
      )}
    </>
  );
}

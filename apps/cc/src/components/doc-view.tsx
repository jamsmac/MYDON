import Link from "next/link";
import type { DocFile } from "../lib/core";
import { count, when } from "../lib/format";
import { renderMarkdown } from "../lib/markdown";

/**
 * Чтение одного документа репозитория (R-M-5).
 *
 * Серверный компонент: `marked` остаётся на сервере, в браузер уезжает готовый
 * HTML, а не библиотека рендера.
 *
 * `known` — пути из дерева: по ним рендер оживляет упоминания документов в
 * обратных кавычках и не заводит ссылок на то, чего Core не отдаёт.
 */
export function DocView({ file, known }: { file: DocFile; known: ReadonlySet<string> }) {
  const html = renderMarkdown(file.markdown, file.path, known);
  // Заголовок в шапке — только если документ не называет себя сам. Почти у
  // всех первый блок — `# Заголовок`, и дублировать его над текстом значит
  // писать название дважды; у `engine/*.yaml` и заметок без `#` шапка остаётся
  // единственным местом, где документ подписан.
  const selfTitled = /^#\s+/m.test(file.markdown);
  return (
    <div className="doc-wrap">
      <div className="doc-head">
        <div className="doc-meta">
          {!selfTitled && <b>{file.title}</b>}
          <small className="mono">
            {file.path} · {count(Math.max(1, Math.round(file.bytes / 1024)))} КБ · обновлён{" "}
            {when(file.updatedAt)}
          </small>
        </div>
        {/* Тот же документ, но как узел графа: кто на него ссылается и что он тянет. */}
        <Link className="doc-brain" href={`/brain?focus=${encodeURIComponent(file.path)}`}>
          Открыть в Мозге
        </Link>
      </div>
      {/*
        dangerouslySetInnerHTML здесь допустим осознанно (Р-4): HTML собирает
        `renderMarkdown`, и весь сырой HTML документа он ЭКРАНИРУЕТ — в разметку
        попадает только то, что построил сам рендерер (заголовки, списки,
        таблицы, ссылки с проверенным href). Источник тоже свой: файл с диска
        образа по белому списку Core, а не пользовательский ввод.
      */}
      <article className="doc" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

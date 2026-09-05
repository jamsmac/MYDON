"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { DocsTreeItem } from "../lib/core";

/**
 * Дерево документов репозитория: корень → файлы (R-M-5).
 *
 * Плоский список из Core группируем по корню и сворачиваем: 200 файлов одной
 * лентой — не дерево, а стена. Фильтр ищет и по пути, и по заголовку: путь
 * латиницей (`routers/vendhub.md`), заголовок русский («VendHub — роутер»), и
 * владелец помнит то одно, то другое.
 */
export function DocsTree({ items, active }: { items: DocsTreeItem[]; active?: string }) {
  const [query, setQuery] = useState("");
  // Свёрнутые корни держим списком: по умолчанию открыты все — дерево должно
  // отвечать «что вообще есть», а не прятать это за восемью кликами.
  const [closed, setClosed] = useState<readonly string[]>([]);

  // Открытый документ подкручиваем в видимую часть дерева: в корне `docs`
  // сотня файлов, и без этого владелец не видит, где он находится.
  const box = useRef<HTMLElement | null>(null);
  const activeRow = useRef<HTMLAnchorElement | null>(null);
  useEffect(() => {
    const list = box.current;
    const row = activeRow.current;
    if (!list || !row) return;
    // Крутим САМО дерево, а не `scrollIntoView`: тот заодно сдвигает страницу,
    // и заголовок экрана уезжал за верхний край при каждом открытии документа.
    const offset = row.getBoundingClientRect().top - list.getBoundingClientRect().top;
    list.scrollTop += offset - list.clientHeight / 2 + row.offsetHeight / 2;
  }, [active]);

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? items.filter(
        (i) => i.path.toLowerCase().includes(needle) || i.title.toLowerCase().includes(needle),
      )
    : items;

  const groups = new Map<string, DocsTreeItem[]>();
  for (const item of shown) {
    const list = groups.get(item.root);
    if (list) list.push(item);
    else groups.set(item.root, [item]);
  }

  const toggle = (root: string, open: boolean) =>
    setClosed((prev) =>
      open ? prev.filter((r) => r !== root) : prev.includes(root) ? prev : [...prev, root],
    );

  return (
    <nav className="docs-tree" aria-label="Документы репозитория" ref={box}>
      <div className="search docs-filter">
        <input
          type="search"
          aria-label="Фильтр документов"
          placeholder="Фильтр по пути или заголовку"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {shown.length === 0 ? (
        <div className="empty">
          <b>Ничего не нашлось</b>
          Сотри часть запроса — фильтр ищет по пути и по заголовку документа.
        </div>
      ) : (
        [...groups.entries()].map(([root, list]) => (
          <details
            key={root}
            className="docs-group"
            // Фильтр раскрывает всё: искать в свёрнутом корне бессмысленно.
            open={needle.length > 0 || !closed.includes(root)}
            onToggle={(e) => toggle(root, e.currentTarget.open)}
          >
            <summary>
              <span className="docs-root">{root}</span>
              <span className="docs-count num">{list.length}</span>
            </summary>
            <div className="rows">
              {list.map((i) => (
                <Link
                  key={i.path}
                  ref={i.path === active ? activeRow : undefined}
                  className="row rowlink"
                  href={`/docs?path=${encodeURIComponent(i.path)}`}
                  aria-current={i.path === active ? "page" : undefined}
                >
                  <span className="t">
                    <b>{i.title}</b>
                    <small>
                      {relPath(i)}
                      {/* Личное Core отдаёт только владельцу — отказ не должен
                          быть сюрпризом уже после клика. */}
                      {i.personal && <em className="docs-personal">личное</em>}
                    </small>
                  </span>
                </Link>
              ))}
            </div>
          </details>
        ))
      )}
    </nav>
  );
}

/** Путь без корня: корень уже написан в заголовке группы, второй раз не нужен. */
function relPath(item: DocsTreeItem): string {
  const prefix = `${item.root}/`;
  return item.path.startsWith(prefix) ? item.path.slice(prefix.length) : item.path;
}

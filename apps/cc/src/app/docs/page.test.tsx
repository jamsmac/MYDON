import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DocsTreeItem } from "../../lib/core";

// `page.tsx` тянет клиент Core, а тот первой строкой импортирует пакет
// `server-only`, которого вне RSC не существует.
const docsTree = vi.hoisted(() => vi.fn());
const docFile = vi.hoisted(() => vi.fn());
vi.mock("../../lib/core", () => ({
  core: { docsTree, docFile },
  CoreUnavailable: class CoreUnavailable extends Error {
    constructor(readonly detail: string) {
      super("Core недоступен");
    }
  },
}));

import DocsPage from "./page";

const tree: DocsTreeItem[] = [
  {
    path: "CLAUDE.md",
    root: "CLAUDE.md",
    title: "MYDON — контекст монорепо",
    bytes: 1024,
    updatedAt: "2026-09-06T08:00:00.000Z",
  },
  {
    path: "memory/glossary.md",
    root: "memory",
    title: "Словарь",
    bytes: 2048,
    updatedAt: "2026-09-06T08:00:00.000Z",
    personal: true,
  },
];

/** Экран как его отдаёт App Router: серверный компонент уже выполнен. */
const screenFor = (path?: string) =>
  DocsPage({ searchParams: Promise.resolve(path === undefined ? {} : { path }) });

/*
 * Реализацию задаём ТОЛЬКО через `mockImplementation`: `mockResolvedValue`
 * заставляет vitest 3.2 отслеживать промисы мока, и соседний тест с
 * синхронным исключением падает «необработанным» отказом.
 */
beforeEach(() => {
  docsTree.mockImplementation(async () => tree);
  docFile.mockImplementation(async () => null);
});

describe("Экран «Документы»: отказы Core", () => {
  it("личный контур объясняется НЕЙТРАЛЬНО, без цвета тревоги", async () => {
    // `.notice` — блок на `--hot-soft`, тем же цветом панель показывает
    // просрочки и расхождения. Закрытый личный контур — не поломка, а
    // сработавшее правило: пугать им нельзя (то же решение, что у метки
    // «личное» в дереве).
    docFile.mockImplementation(async () => ({ kind: "forbidden" }));
    const { container } = render(await screenFor("memory/glossary.md"));
    const block = screen.getByText(/только владельцу/i).closest("div");
    expect(block).toHaveClass("empty");
    expect(container.querySelector(".notice")).toBeNull();
  });

  it("файл вне белого списка остаётся предупреждением", async () => {
    // А вот «не нашли» — именно ненормальность: ссылка ведёт в никуда, и
    // владельцу есть что чинить.
    docFile.mockImplementation(async () => ({ kind: "missing" }));
    render(await screenFor("apps/core/src/main.ts"));
    expect(screen.getByText(/вне белого списка/i).closest("div")).toHaveClass("notice");
  });
});

describe("Экран «Документы»: порядок колонок на телефоне", () => {
  it("выбранный документ помечает раскладку как «читаем»", async () => {
    // По классу `reading` CSS ставит документ ПЕРЕД деревом ниже 900px: иначе
    // каждый переход по `?path=` высаживал владельца на верх 46vh-дерева.
    docFile.mockImplementation(async () => ({
      kind: "ok",
      file: { ...tree[0], markdown: "# MYDON — контекст монорепо" },
    }));
    const { container } = render(await screenFor("CLAUDE.md"));
    expect(container.querySelector(".docs-layout")).toHaveClass("reading");
  });

  it("без документа раскладка обычная — дерево первое", async () => {
    const { container } = render(await screenFor());
    expect(container.querySelector(".docs-layout")).not.toHaveClass("reading");
  });
});

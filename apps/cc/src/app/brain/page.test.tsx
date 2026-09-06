import { render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { DocsGraph } from "../../lib/core";
import { stubCanvasEnvironment } from "../../test/canvas";

// `page.tsx` тянет клиент Core, а тот первой строкой импортирует пакет
// `server-only`, которого вне RSC не существует.
const docsGraph = vi.hoisted(() => vi.fn());
vi.mock("../../lib/core", () => ({
  core: { docsGraph },
  CoreUnavailable: class CoreUnavailable extends Error {
    constructor(readonly detail: string) {
      super("Core недоступен");
    }
  },
}));
// Предпросмотр — серверное действие; здесь проверяется маршрутизация экрана,
// а не чтение файла.
vi.mock("./actions", () => ({ previewDoc: vi.fn(async () => ({ ok: false, reason: "core" })) }));

// Типы берутся у настоящего модуля, реализация — у мока выше.
import { CoreUnavailable } from "../../lib/core";
import BrainPage from "./page";

const graph: DocsGraph = {
  builtAt: "2026-09-06T08:00:00.000Z",
  nodes: [
    { id: "CLAUDE.md", kind: "root", label: "MYDON — контекст монорепо", path: "CLAUDE.md" },
    { id: "docs/DEPLOY.md", kind: "doc", label: "Деплой MYDON", path: "docs/DEPLOY.md" },
    { id: "memory/glossary.md", kind: "memory", label: "Словарь", path: "memory/glossary.md" },
  ],
  edges: [{ from: "memory/glossary.md", to: "CLAUDE.md", kind: "mentions" }],
};

/** Экран как его отдаёт App Router: серверный компонент уже выполнен. */
const screenFor = (focus?: string) =>
  BrainPage({ searchParams: Promise.resolve(focus === undefined ? {} : { focus }) });

beforeAll(stubCanvasEnvironment);
/*
 * Реализацию задаём ТОЛЬКО через `mockImplementation`, никогда через
 * `mockResolvedValue`. Иначе vitest 3.2 навешивает на мок отслеживание
 * промисов, и следующий тест, где реализация бросает синхронно, падает с
 * «необработанным» отказом — при полностью зелёном теле теста.
 */
beforeEach(() => {
  docsGraph.mockImplementation(async () => graph);
});

describe("Экран «Мозг»", () => {
  it("шапка отвечает, сколько узлов, сколько связей и когда собран граф", async () => {
    render(await screenFor());
    expect(screen.getByRole("heading", { name: "Мозг" })).toBeInTheDocument();
    expect(screen.getByText(/3 узла · 1 связь · собран/)).toBeInTheDocument();
  });

  it("пустой граф говорит, что чинить сборку, а не документы", async () => {
    docsGraph.mockImplementation(async () => ({ nodes: [], edges: [], builtAt: graph.builtAt }));
    render(await screenFor());
    expect(screen.getByText(/граф пуст/i)).toBeInTheDocument();
    expect(screen.getByText(/проверь сборку образа/i)).toBeInTheDocument();
  });

  it("Core недоступен — экран не белый, а с деталью отказа", async () => {
    docsGraph.mockImplementation(async () => {
      throw new CoreUnavailable("connect ECONNREFUSED");
    });
    render(await screenFor());
    expect(screen.getByText(/нет связи с ядром/i)).toBeInTheDocument();
    // Деталь обязательна: «не работает» без причины владелец чинить не может.
    expect(screen.getByText(/ECONNREFUSED/)).toBeInTheDocument();
  });

  it("?focus= сразу открывает карточку нужного узла", async () => {
    render(await screenFor("docs/DEPLOY.md"));
    expect(await screen.findByRole("complementary", { name: /узел/i })).toHaveTextContent(
      "Деплой MYDON",
    );
  });

  it("повторный вход с другим ?focus= показывает НОВЫЙ узел, а не прежний", async () => {
    // Ловушка App Router из памяти проекта: `?focus=` компонент читает в
    // инициализаторах `useState`, а те выполняются только при монтировании.
    // Без `key` по focus SPA-переход `/brain?focus=A` → `/brain?focus=B`
    // переиспользовал бы тот же экземпляр, и владелец второй раз подряд
    // смотрел бы на узел A. Этот тест падает, если ключ убрать.
    const { rerender } = render(await screenFor("docs/DEPLOY.md"));
    expect(await screen.findByRole("complementary", { name: /узел/i })).toHaveTextContent(
      "Деплой MYDON",
    );

    rerender(await screenFor("memory/glossary.md"));
    const card = await screen.findByRole("complementary", { name: /узел/i });
    expect(card).toHaveTextContent("Словарь");
    expect(card).not.toHaveTextContent("Деплой MYDON");
    expect(screen.getByLabelText(/поиск/i)).toHaveValue("memory/glossary.md");
  });
});

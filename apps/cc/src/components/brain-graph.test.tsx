import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { DocsGraph } from "../lib/core";
import { stubCanvasEnvironment } from "../test/canvas";
import { BrainGraph } from "./brain-graph";

/**
 * Предпросмотр документа ходит в Core серверным действием — в тесте его
 * подменяем: проверяем поведение карточки, а не сеть.
 */
const previewDoc = vi.hoisted(() => vi.fn());
vi.mock("../app/brain/actions", () => ({ previewDoc }));

const SKILL = "apps/agents/agents/parts-keeper/skills/parts-audit.md";

const graph: DocsGraph = {
  builtAt: "2026-09-06T08:00:00.000Z",
  nodes: [
    { id: "CLAUDE.md", kind: "root", label: "MYDON — контекст монорепо", path: "CLAUDE.md" },
    { id: "domain:vendhub", kind: "domain", label: "vendhub" },
    { id: "agent:parts-keeper", kind: "agent", label: "parts-keeper", href: "/agents/parts-keeper" },
    { id: SKILL, kind: "skill", label: "Ревизия узлов", path: SKILL, href: "/skills" },
    { id: "tool:read", kind: "tool", label: "read" },
    { id: "docs/DEPLOY.md", kind: "doc", label: "Деплой MYDON", path: "docs/DEPLOY.md" },
    { id: "memory/glossary.md", kind: "memory", label: "Словарь", path: "memory/glossary.md" },
  ],
  edges: [
    { from: "CLAUDE.md", to: "domain:vendhub", kind: "routes" },
    { from: "domain:vendhub", to: "agent:parts-keeper", kind: "owns" },
    { from: "agent:parts-keeper", to: SKILL, kind: "has_skill" },
    { from: SKILL, to: "tool:read", kind: "uses_tool" },
    { from: "memory/glossary.md", to: "CLAUDE.md", kind: "mentions" },
  ],
};

/**
 * jsdom не рисует — заглушки холста, ResizeObserver и matchMedia общие с
 * тестом страницы (`app/brain/page.test.tsx`). Контекст держим под рукой:
 * по нему видно, что кнопка масштаба довела дело до перерисовки.
 */
let ctx: ReturnType<typeof stubCanvasEnvironment>;
beforeAll(() => {
  ctx = stubCanvasEnvironment();
});

const результаты = (): string[] =>
  screen
    .getAllByRole("button", { name: /./ })
    .map((b) => b.textContent ?? "")
    .filter((t) => t.length > 0);

describe("Граф знаний: поиск", () => {
  it("показывает узлы списком — путь к графу без canvas", () => {
    render(<BrainGraph graph={graph} />);
    expect(screen.getByRole("button", { name: /Деплой MYDON/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ревизия узлов/ })).toBeInTheDocument();
  });

  it("ввод в поиск сужает список результатов", async () => {
    const user = userEvent.setup();
    render(<BrainGraph graph={graph} />);
    await user.type(screen.getByLabelText(/поиск/i), "ревизия");
    expect(screen.getByRole("button", { name: /Ревизия узлов/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Деплой MYDON/ })).not.toBeInTheDocument();
    expect(результаты().some((t) => t.includes("Словарь"))).toBe(false);
  });

  it("пустой результат поиска говорит, что сделать", async () => {
    const user = userEvent.setup();
    render(<BrainGraph graph={graph} />);
    await user.type(screen.getByLabelText(/поиск/i), "такого узла нет");
    expect(screen.getByText(/ничего не нашлось/i)).toBeInTheDocument();
  });

  it("легенда считает виды узлов показанного графа", async () => {
    const user = userEvent.setup();
    render(<BrainGraph graph={graph} />);
    const legend = screen.getByRole("group", { name: /виды узлов/i });
    expect(legend).toHaveTextContent(/агент/);
    expect(legend).toHaveTextContent(/навык/);
    // Сузили до навыка и соседей — «память» из легенды уходит вместе с узлом.
    await user.type(screen.getByLabelText(/поиск/i), "ревизия");
    expect(screen.getByRole("group", { name: /виды узлов/i })).not.toHaveTextContent(/память/);
  });
});

describe("Граф знаний: масштаб кнопками", () => {
  it("«+» приближает граф: холст перерисован с бо́льшим масштабом", async () => {
    // На телефоне колеса нет, а щипок отдан браузеру — кнопки остаются
    // единственным способом изменить масштаб.
    ctx.scale.mockClear();
    const user = userEvent.setup();
    render(<BrainGraph graph={graph} />);
    await user.click(screen.getByRole("button", { name: "Приблизить" }));
    const scales = ctx.scale.mock.calls.map((call) => Number(call[0]));
    expect(scales.length).toBeGreaterThan(0);
    expect(Math.max(...scales)).toBeGreaterThan(1);
  });

  it("«−» отдаляет, «Вписать» на месте — обе кнопки доступны с клавиатуры", async () => {
    ctx.scale.mockClear();
    const user = userEvent.setup();
    render(<BrainGraph graph={graph} />);
    await user.click(screen.getByRole("button", { name: "Отдалить" }));
    expect(Math.min(...ctx.scale.mock.calls.map((call) => Number(call[0])))).toBeLessThan(1);
    await user.click(screen.getByRole("button", { name: "Вписать" }));
    expect(screen.getByRole("group", { name: /масштаб графа/i })).toBeInTheDocument();
  });

  it("подпись объясняет, что колесо масштабирует только с Ctrl", () => {
    render(<BrainGraph graph={graph} />);
    expect(screen.getByText(/Ctrl\+колесо/)).toBeInTheDocument();
  });

  it("легенда объясняет и виды связей, а не только цвета узлов", () => {
    render(<BrainGraph graph={graph} />);
    const edges = screen.getByRole("group", { name: /виды связей/i });
    expect(edges).toHaveTextContent(/структура/);
    expect(edges).toHaveTextContent(/ссылки/);
    expect(edges).toHaveTextContent(/упоминания/);
  });
});

describe("Граф знаний: карточка узла", () => {
  it("клик по агенту открывает карточку с видом словами и ссылкой на агента", async () => {
    const user = userEvent.setup();
    render(<BrainGraph graph={graph} />);
    await user.click(screen.getByRole("button", { name: /^parts-keeper/ }));

    const card = screen.getByRole("complementary", { name: /узел/i });
    expect(card).toHaveTextContent("parts-keeper");
    expect(card).toHaveTextContent("агент");
    expect(screen.getByRole("link", { name: /карточка агента/i })).toHaveAttribute(
      "href",
      "/agents/parts-keeper",
    );
  });

  it("клик по документу даёт ссылку в «Документы» и предпросмотр первых строк", async () => {
    previewDoc.mockResolvedValue({
      ok: true,
      title: "Деплой MYDON",
      lines: ["# Деплой MYDON", "Разворачиваем на Hetzner."],
    });
    const user = userEvent.setup();
    render(<BrainGraph graph={graph} />);
    await user.click(screen.getByRole("button", { name: /Деплой MYDON/ }));

    expect(screen.getByRole("link", { name: /читать документ/i })).toHaveAttribute(
      "href",
      "/docs?path=docs%2FDEPLOY.md",
    );
    expect(await screen.findByText(/Разворачиваем на Hetzner/)).toBeInTheDocument();
    expect(previewDoc).toHaveBeenCalledWith("docs/DEPLOY.md");
  });

  it("личный документ объясняет отказ, а не показывает ошибку", async () => {
    previewDoc.mockResolvedValue({ ok: false, reason: "forbidden" });
    const user = userEvent.setup();
    render(<BrainGraph graph={graph} />);
    await user.click(screen.getByRole("button", { name: /Словарь/ }));
    expect(
      await screen.findByText(/личный документ — доступен только владельцу/i),
    ).toBeInTheDocument();
  });

  it("у навыка — ссылка на витрину навыков и на файл навыка", async () => {
    previewDoc.mockResolvedValue({ ok: true, title: "Ревизия узлов", lines: ["# Ревизия узлов"] });
    const user = userEvent.setup();
    render(<BrainGraph graph={graph} />);
    await user.click(screen.getByRole("button", { name: /Ревизия узлов/ }));
    expect(screen.getByRole("link", { name: /витрина навыков/i })).toHaveAttribute("href", "/skills");
    expect(screen.getByRole("link", { name: /читать документ/i })).toHaveAttribute(
      "href",
      `/docs?path=${encodeURIComponent(SKILL)}`,
    );
  });

  it("у синтетического узла ссылок нет, но вид назван", async () => {
    const user = userEvent.setup();
    render(<BrainGraph graph={graph} />);
    await user.click(screen.getByRole("button", { name: /^vendhub/ }));
    const card = screen.getByRole("complementary", { name: /узел/i });
    expect(card).toHaveTextContent("направление");
    expect(screen.queryByRole("link", { name: /читать документ/i })).not.toBeInTheDocument();
    expect(previewDoc).not.toHaveBeenCalledWith("domain:vendhub");
  });

  it("поиск не закрывает уже открытую карточку", async () => {
    // Узел ищется в ПОЛНОМ графе, а не в показанном: сузив поиск, владелец
    // не должен терять карточку, которую только что открыл.
    const user = userEvent.setup();
    render(<BrainGraph graph={graph} />);
    await user.click(screen.getByRole("button", { name: /^parts-keeper/ }));
    await user.type(screen.getByLabelText(/поиск/i), "деплой");
    expect(screen.getByRole("complementary", { name: /узел/i })).toHaveTextContent("parts-keeper");
  });

  it("нажатие на строку уводит фокус на заголовок карточки, Esc возвращает его строке", async () => {
    // Карточка появляется НИЖЕ (а на телефоне и вовсе в другом месте): без
    // переноса фокуса скринридер и клавиатура остаются на прежней строке, и
    // «открылось» слышно не было бы. Esc обязан вернуть фокус туда же, откуда
    // его забрали, иначе следующий Tab начинает страницу заново.
    const user = userEvent.setup();
    render(<BrainGraph graph={graph} />);
    const row = screen.getByRole("button", { name: /^parts-keeper/ });
    await user.click(row);

    const title = screen.getByRole("heading", { name: "parts-keeper" });
    expect(document.activeElement).toBe(title);
    expect(row).toHaveAttribute("aria-expanded", "true");
    expect(row).toHaveAttribute("aria-controls", title.closest("aside")?.id);

    await user.keyboard("{Escape}");
    expect(document.activeElement).toBe(row);
    expect(row).toHaveAttribute("aria-expanded", "false");
  });

  it("Esc закрывает карточку", async () => {
    const user = userEvent.setup();
    render(<BrainGraph graph={graph} />);
    await user.click(screen.getByRole("button", { name: /^parts-keeper/ }));
    expect(screen.getByRole("complementary", { name: /узел/i })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("complementary", { name: /узел/i })).not.toBeInTheDocument();
  });
});

describe("Граф знаний: приход из «Документов»", () => {
  it("focus сразу открывает карточку документа и подставляет его в поиск", async () => {
    previewDoc.mockResolvedValue({ ok: true, title: "Деплой MYDON", lines: ["# Деплой MYDON"] });
    render(<BrainGraph graph={graph} focus="docs/DEPLOY.md" />);
    const card = await screen.findByRole("complementary", { name: /узел/i });
    expect(card).toHaveTextContent("Деплой MYDON");
    expect(screen.getByLabelText(/поиск/i)).toHaveValue("docs/DEPLOY.md");
  });

  it("focus на узел, которого в графе нет, экран не роняет", () => {
    render(<BrainGraph graph={graph} focus="docs/НЕТ-ТАКОГО.md" />);
    expect(screen.getByText(/ничего не нашлось/i)).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: /узел/i })).not.toBeInTheDocument();
  });
});

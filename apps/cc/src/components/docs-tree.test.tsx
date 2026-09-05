import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { DocsTreeItem } from "../lib/core";
import { DocsTree } from "./docs-tree";

function item(over: Partial<DocsTreeItem> & { path: string; root: string }): DocsTreeItem {
  return {
    title: over.path,
    bytes: 1024,
    updatedAt: "2026-09-06T08:00:00.000Z",
    ...over,
  };
}

const items: DocsTreeItem[] = [
  item({ path: "CLAUDE.md", root: "CLAUDE.md", title: "MYDON — контекст монорепо" }),
  item({ path: "routers/vendhub.md", root: "routers", title: "VendHub — роутер направления" }),
  item({ path: "routers/globerent.md", root: "routers", title: "GLOBERENT — роутер направления" }),
  item({ path: "docs/DEPLOY.md", root: "docs", title: "Деплой MYDON" }),
];

describe("Дерево документов", () => {
  it("показывает все документы, сгруппированные по корням", () => {
    render(<DocsTree items={items} />);
    expect(screen.getByRole("link", { name: /контекст монорепо/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /GLOBERENT/i })).toBeInTheDocument();
    // Корень виден отдельной строкой со счётчиком: их восемь, и владелец
    // должен понимать, откуда документ, не читая путь целиком.
    expect(screen.getByText("routers")).toBeInTheDocument();
  });

  it("фильтр сужает список до совпадений по пути и заголовку", async () => {
    const user = userEvent.setup();
    render(<DocsTree items={items} />);
    await user.type(screen.getByLabelText(/фильтр/i), "vendhub");
    expect(screen.getByRole("link", { name: /VendHub/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /GLOBERENT/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Деплой/i })).not.toBeInTheDocument();
  });

  it("фильтр находит и по заголовку, когда путь латиницей", async () => {
    const user = userEvent.setup();
    render(<DocsTree items={items} />);
    await user.type(screen.getByLabelText(/фильтр/i), "деплой");
    expect(screen.getByRole("link", { name: /Деплой/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /GLOBERENT/i })).not.toBeInTheDocument();
  });

  it("пустой результат фильтра говорит, что сделать", async () => {
    const user = userEvent.setup();
    render(<DocsTree items={items} />);
    await user.type(screen.getByLabelText(/фильтр/i), "такого нет");
    expect(screen.getByText(/ничего не нашлось/i)).toBeInTheDocument();
  });

  it("открытый документ помечен как активный пункт", () => {
    render(<DocsTree items={items} active="routers/vendhub.md" />);
    expect(screen.getByRole("link", { name: /VendHub/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /GLOBERENT/i })).not.toHaveAttribute("aria-current");
  });

  it("ссылка ведёт в панель по репо-пути", () => {
    render(<DocsTree items={items} />);
    expect(screen.getByRole("link", { name: /VendHub/i })).toHaveAttribute(
      "href",
      "/docs?path=routers%2Fvendhub.md",
    );
  });
});

describe("Дерево документов: личный контур", () => {
  it("личный документ помечен — владелец видит, что содержимое за owner-токеном", () => {
    render(
      <DocsTree
        items={[
          item({ path: "memory/glossary.md", root: "memory", title: "Словарь", personal: true }),
          item({ path: "docs/DEPLOY.md", root: "docs", title: "Деплой MYDON" }),
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: /Словарь/i })).toHaveTextContent(/личное/i);
    expect(screen.getByRole("link", { name: /Деплой/i })).not.toHaveTextContent(/личное/i);
  });
});

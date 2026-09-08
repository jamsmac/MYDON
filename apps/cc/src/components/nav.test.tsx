import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// `usePathname` живёт только внутри маршрутизатора Next; вне него — подмена.
const mocks = vi.hoisted(() => ({ pathname: "/artifacts" }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));

import { Sidebar, TabBar } from "./nav";

describe("Навигация: пункт «Артефакты» (срез A3)", () => {
  it("сайдбар ведёт на /artifacts и подсвечивает его как текущий", () => {
    render(<Sidebar pendingCount={0} />);
    const пункт = screen.getByRole("link", { name: "Артефакты" });
    expect(пункт).toHaveAttribute("href", "/artifacts");
    expect(пункт).toHaveAttribute("aria-current", "page");
  });

  it("в таббар телефона пункт НЕ попадает: он сквозной, а таббар занят семью", () => {
    render(<TabBar pendingCount={0} />);
    expect(screen.queryByRole("link", { name: "Артефакты" })).toBeNull();
  });
});

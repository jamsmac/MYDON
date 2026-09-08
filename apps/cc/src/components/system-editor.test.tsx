import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SystemConfigItem } from "../lib/core";
import { SystemEditor } from "./system-editor";

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), saveSystemConfig: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("../app/system/actions", () => ({ saveSystemConfig: mocks.saveSystemConfig }));

/** Тумблер источника учёта — единственный сегодня с фолбэком ядра. */
const ИСТОЧНИК: SystemConfigItem = {
  key: "OURVEND_ACCOUNTING_SOURCE",
  label: "Источник учёта OurVend",
  kind: "select",
  options: ["stock", "own"],
  value: "stock",
  source: "db",
};

describe("«Система»: действующее значение рядом с записанным (R-FW-S5)", () => {
  it("зеркала нет — панель говорит «действует: own (без зеркала)», а не «stock»", () => {
    // Прод-случай на пути катовера: после шага 3 рунбука `STOCK_DATABASE_URL`
    // удалён, и записанный `stock` действует как `own`. Панель, печатающая
    // только записанное, отправила бы владельца искать погашенное зеркало.
    render(<SystemEditor items={[{ ...ИСТОЧНИК, effective: "own" }]} />);
    expect(screen.getByText("действует: own (без зеркала)")).toBeVisible();
    // Записанное значение при этом не подменяется: чинить владелец будет его.
    expect(screen.getByText("задано в панели")).toBeVisible();
  });

  it("действующее совпадает с записанным — второй пилюли нет", () => {
    render(<SystemEditor items={[{ ...ИСТОЧНИК, value: "own", effective: "own" }]} />);
    expect(screen.queryByText(/действует:/)).toBeNull();
  });

  it("поля нет вовсе (Core прошлой сборки) — подписи нет, а не «неизвестно»", () => {
    render(<SystemEditor items={[ИСТОЧНИК]} />);
    expect(screen.queryByText(/действует:/)).toBeNull();
  });

  it("чужой ключ с фолбэком — «действует: X» без придуманной причины", () => {
    render(
      <SystemEditor
        items={[{ key: "SOME_OTHER", label: "Другой", kind: "text", value: "a", source: "env", effective: "b" }]}
      />,
    );
    expect(screen.getByText("действует: b")).toBeVisible();
  });
});

/**
 * Подписи булева тумблера — срез Д1, находка Ф-3 ревью.
 *
 * `/system` и `/crons` показывают ОДНИ И ТЕ ЖЕ ключи `AGENTS_*_PAUSED`: доска
 * рутин через `pause-toggles`, эта витрина — выпадающим списком. Слова обязаны
 * приходить из одного словаря (`lib/state`), иначе правка формулировки разведёт
 * два экрана про один факт молча.
 */
describe("«Система»: булев тумблер и слово паузы (срез Д1)", () => {
  const булев = (key: string, label: string): SystemConfigItem => ({
    key,
    label,
    kind: "bool",
    value: "1",
    source: "db",
  });

  it("ключ паузы уточняет обе стороны словами доски рутин", () => {
    render(<SystemEditor items={[булев("AGENTS_SCHEDULES_PAUSED", "Расписания на паузе")]} />);
    expect(screen.getByRole("option", { name: "Да (на паузе)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Нет (работают)" })).toBeInTheDocument();
  });

  it("прочие булевы настройки — просто «Да»/«Нет», без чужого уточнения", () => {
    // `kind: "bool"` носят ещё пять настроек, и до среза список писал им то же
    // «Да (на паузе)»: «этап «сушка» после мойки — Да (на паузе)» не значит
    // ничего. Уточнение принадлежит ключам паузы, а не типу контрола.
    render(<SystemEditor items={[булев("PARTS_DRYING_STAGE", "Узлы: этап «сушка» после мойки")]} />);
    expect(screen.getByRole("option", { name: "Да" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Нет" })).toBeInTheDocument();
    expect(screen.queryByText(/на паузе/)).toBeNull();
  });
});

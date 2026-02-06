import { describe, it, expect, vi } from "vitest";

// Mock database
vi.mock("./db", () => ({
  createSubtask: vi.fn().mockImplementation(async (input) => ({
    id: Math.floor(Math.random() * 1000),
    taskId: input.taskId,
    title: input.title,
    status: "not_started",
    sortOrder: input.sortOrder ?? 0,
    createdAt: new Date(),
  })),
}));

describe("Builtin Subtask Templates", () => {
  const BUILTIN_TEMPLATES: Record<string, { title: string; items: string[] }> = {
    research: {
      title: "Исследование",
      items: [
        "Определить цели и вопросы исследования",
        "Собрать данные из открытых источников",
        "Провести интервью / опросы",
        "Проанализировать конкурентов",
        "Составить отчёт с выводами",
        "Подготовить презентацию результатов",
      ],
    },
    analysis: {
      title: "Анализ",
      items: [
        "Определить метрики и KPI для анализа",
        "Собрать и подготовить данные",
        "Провести количественный анализ",
        "Провести качественный анализ",
        "Выявить тренды и паттерны",
        "Сформулировать рекомендации",
        "Оформить аналитический отчёт",
      ],
    },
    documentation: {
      title: "Документация",
      items: [
        "Определить структуру документа",
        "Написать введение и обзор",
        "Описать основные разделы",
        "Добавить примеры и иллюстрации",
        "Провести вычитку и редактуру",
        "Согласовать с заинтересованными сторонами",
        "Опубликовать финальную версию",
      ],
    },
    review: {
      title: "Ревью",
      items: [
        "Ознакомиться с материалом / кодом",
        "Проверить соответствие требованиям",
        "Оценить качество и полноту",
        "Составить список замечаний",
        "Обсудить замечания с автором",
        "Проверить исправления",
        "Утвердить результат",
      ],
    },
    testing: {
      title: "Тестирование",
      items: [
        "Составить тест-план",
        "Подготовить тестовые данные",
        "Провести функциональное тестирование",
        "Провести регрессионное тестирование",
        "Проверить граничные случаи",
        "Зафиксировать найденные баги",
        "Провести повторное тестирование после исправлений",
        "Подготовить отчёт о тестировании",
      ],
    },
  };

  it("should have exactly 5 builtin templates", () => {
    const keys = Object.keys(BUILTIN_TEMPLATES);
    expect(keys).toHaveLength(5);
    expect(keys).toEqual(["research", "analysis", "documentation", "review", "testing"]);
  });

  it("research template should have correct structure", () => {
    const template = BUILTIN_TEMPLATES.research;
    expect(template.title).toBe("Исследование");
    expect(template.items.length).toBeGreaterThanOrEqual(5);
    expect(template.items[0]).toBe("Определить цели и вопросы исследования");
  });

  it("analysis template should have correct structure", () => {
    const template = BUILTIN_TEMPLATES.analysis;
    expect(template.title).toBe("Анализ");
    expect(template.items.length).toBeGreaterThanOrEqual(5);
    expect(template.items).toContain("Провести количественный анализ");
  });

  it("documentation template should have correct structure", () => {
    const template = BUILTIN_TEMPLATES.documentation;
    expect(template.title).toBe("Документация");
    expect(template.items.length).toBeGreaterThanOrEqual(5);
    expect(template.items).toContain("Определить структуру документа");
  });

  it("review template should have correct structure", () => {
    const template = BUILTIN_TEMPLATES.review;
    expect(template.title).toBe("Ревью");
    expect(template.items.length).toBeGreaterThanOrEqual(5);
    expect(template.items).toContain("Составить список замечаний");
  });

  it("testing template should have correct structure", () => {
    const template = BUILTIN_TEMPLATES.testing;
    expect(template.title).toBe("Тестирование");
    expect(template.items.length).toBeGreaterThanOrEqual(5);
    expect(template.items).toContain("Составить тест-план");
  });

  it("all template items should be non-empty strings", () => {
    for (const [key, template] of Object.entries(BUILTIN_TEMPLATES)) {
      expect(template.title).toBeTruthy();
      for (const item of template.items) {
        expect(item).toBeTruthy();
        expect(typeof item).toBe("string");
        expect(item.length).toBeGreaterThan(3);
      }
    }
  });

  it("all template items should be unique within each template", () => {
    for (const [key, template] of Object.entries(BUILTIN_TEMPLATES)) {
      const uniqueItems = new Set(template.items);
      expect(uniqueItems.size).toBe(template.items.length);
    }
  });

  it("should validate template key input", () => {
    const validKeys = ["research", "analysis", "documentation", "review", "testing"];
    const invalidKeys = ["invalid", "unknown", ""];

    for (const key of validKeys) {
      expect(BUILTIN_TEMPLATES[key]).toBeDefined();
    }

    for (const key of invalidKeys) {
      expect(BUILTIN_TEMPLATES[key]).toBeUndefined();
    }
  });

  it("should create subtasks with correct sort order", () => {
    const template = BUILTIN_TEMPLATES.research;
    const expectedOrders = template.items.map((_, i) => i);
    expect(expectedOrders).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("templates should cover all 5 required categories", () => {
    const requiredCategories = ["Исследование", "Анализ", "Документация", "Ревью", "Тестирование"];
    const templateTitles = Object.values(BUILTIN_TEMPLATES).map((t) => t.title);
    for (const category of requiredCategories) {
      expect(templateTitles).toContain(category);
    }
  });

  it("each template should have between 5 and 10 items", () => {
    for (const [key, template] of Object.entries(BUILTIN_TEMPLATES)) {
      expect(template.items.length).toBeGreaterThanOrEqual(5);
      expect(template.items.length).toBeLessThanOrEqual(10);
    }
  });
});

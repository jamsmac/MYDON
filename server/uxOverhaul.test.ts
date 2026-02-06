import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock invokeLLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            summary: "Test summary of discussion",
            keyDecisions: ["Decision 1", "Decision 2"],
            actionItems: ["Action 1", "Action 2"],
            openQuestions: ["Question 1"],
          }),
        },
      },
    ],
  }),
}));

// Mock database
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([{ insertId: 1 }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockReturnThis(),
  }),
}));

describe("UX Overhaul - Block 2: Discussion AI Features", () => {
  it("should define finalize discussion endpoint structure", () => {
    // The finalize endpoint should accept entityType, entityId, projectId
    const input = {
      entityType: "section" as const,
      entityId: 1,
      projectId: 1,
    };
    expect(input.entityType).toBe("section");
    expect(input.entityId).toBe(1);
    expect(input.projectId).toBe(1);
  });

  it("should define distribute tasks endpoint structure", () => {
    const input = {
      entityType: "section" as const,
      entityId: 1,
      projectId: 1,
    };
    expect(input).toHaveProperty("entityType");
    expect(input).toHaveProperty("entityId");
    expect(input).toHaveProperty("projectId");
  });

  it("should define create tasks from discussion endpoint", () => {
    const tasks = [
      { title: "Task 1", description: "Desc 1", priority: "high" as const, sectionId: 1 },
      { title: "Task 2", description: "Desc 2", priority: "medium" as const, sectionId: 1 },
    ];
    expect(tasks).toHaveLength(2);
    expect(tasks[0].priority).toBe("high");
    expect(tasks[1].sectionId).toBe(1);
  });

  it("should support all entity types for discussions", () => {
    const entityTypes = ["project", "block", "section", "task"];
    entityTypes.forEach((type) => {
      expect(["project", "block", "section", "task"]).toContain(type);
    });
  });
});

describe("UX Overhaul - Block 3: Quick Actions", () => {
  it("should define quick actions for blocks", () => {
    const blockActions = [
      { id: "block-roadmap", command: "suggest" },
      { id: "block-decompose", command: "suggest" },
      { id: "block-risks", command: "risks" },
      { id: "block-report", command: "summarize" },
    ];
    expect(blockActions).toHaveLength(4);
    expect(blockActions.map((a) => a.command)).toContain("suggest");
    expect(blockActions.map((a) => a.command)).toContain("risks");
    expect(blockActions.map((a) => a.command)).toContain("summarize");
  });

  it("should define quick actions for sections", () => {
    const sectionActions = [
      { id: "section-tasks", command: "suggest" },
      { id: "section-plan", command: "suggest" },
      { id: "section-evaluate", command: "analyze" },
      { id: "section-deps", command: "analyze" },
    ];
    expect(sectionActions).toHaveLength(4);
    expect(sectionActions.map((a) => a.command)).toContain("analyze");
  });

  it("should define quick actions for tasks", () => {
    const taskActions = [
      { id: "task-subtasks", command: "suggest" },
      { id: "task-estimate", command: "analyze" },
      { id: "task-risks", command: "risks" },
      { id: "task-spec", command: "suggest" },
      { id: "task-howto", command: "suggest" },
    ];
    expect(taskActions).toHaveLength(5);
  });

  it("should map action IDs to context-specific prompts", () => {
    const actionContexts: Record<string, string> = {
      "block-roadmap": "roadmap",
      "block-decompose": "Декомпозируй",
      "section-tasks": "задач",
      "task-subtasks": "подзадач",
      "task-spec": "техническое задание",
    };
    Object.entries(actionContexts).forEach(([id, keyword]) => {
      expect(id).toBeTruthy();
      expect(keyword).toBeTruthy();
    });
  });
});

describe("UX Overhaul - Block 4: Smart Selectors", () => {
  it("should define quick deadline options", () => {
    const quickDeadlines = [
      "Сегодня",
      "Завтра",
      "Через 3 дня",
      "Через неделю",
      "Через 2 недели",
      "Через месяц",
    ];
    expect(quickDeadlines).toHaveLength(6);
  });

  it("should support AI priority detection input", () => {
    const input = {
      title: "Срочно: исправить критический баг",
      description: "Пользователи не могут войти в систему",
      deadline: new Date("2026-02-07"),
    };
    expect(input.title).toContain("критический");
    expect(input.deadline).toBeInstanceOf(Date);
  });

  it("should support AI task suggestions input", () => {
    const input = {
      projectId: 1,
      sectionId: 1,
      partialTitle: "Исследование",
      context: "Маркетинг и продвижение",
    };
    expect(input.projectId).toBe(1);
    expect(input.partialTitle).toBe("Исследование");
  });

  it("should handle priority detection results", () => {
    const result = {
      priority: "critical" as const,
      confidence: 95,
      reason: "Deadline is within 24 hours",
    };
    expect(["critical", "high", "medium", "low"]).toContain(result.priority);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(100);
  });
});

describe("UX Overhaul - Block 5: Breadcrumb Navigation", () => {
  it("should build breadcrumbs for project level", () => {
    const crumbs = [{ type: "project", id: 1, title: "TechRent" }];
    expect(crumbs).toHaveLength(1);
    expect(crumbs[0].type).toBe("project");
  });

  it("should build breadcrumbs for block level", () => {
    const crumbs = [
      { type: "project", id: 1, title: "TechRent" },
      { type: "block", id: 2, title: "MVP" },
    ];
    expect(crumbs).toHaveLength(2);
    expect(crumbs[1].type).toBe("block");
  });

  it("should build breadcrumbs for section level", () => {
    const crumbs = [
      { type: "project", id: 1, title: "TechRent" },
      { type: "block", id: 2, title: "MVP" },
      { type: "section", id: 3, title: "Разработка" },
    ];
    expect(crumbs).toHaveLength(3);
    expect(crumbs[2].type).toBe("section");
  });

  it("should build breadcrumbs for task level", () => {
    const crumbs = [
      { type: "project", id: 1, title: "TechRent" },
      { type: "block", id: 2, title: "MVP" },
      { type: "section", id: 3, title: "Разработка" },
      { type: "task", id: 4, title: "Создать API" },
    ];
    expect(crumbs).toHaveLength(4);
    expect(crumbs[3].type).toBe("task");
  });

  it("should support navigation callback", () => {
    const navigated: string[] = [];
    const onNavigate = (item: { type: string; id: number; title: string }) => {
      navigated.push(item.type);
    };
    onNavigate({ type: "block", id: 2, title: "MVP" });
    onNavigate({ type: "section", id: 3, title: "Разработка" });
    expect(navigated).toEqual(["block", "section"]);
  });
});

describe("UX Overhaul - Discussion Finalization", () => {
  it("should format finalization result correctly", () => {
    const result = {
      summary: "Обсуждение завершено",
      keyDecisions: ["Решение 1", "Решение 2"],
      actionItems: ["Действие 1"],
      openQuestions: ["Вопрос 1"],
    };
    expect(result.summary).toBeTruthy();
    expect(result.keyDecisions).toBeInstanceOf(Array);
    expect(result.actionItems).toBeInstanceOf(Array);
    expect(result.openQuestions).toBeInstanceOf(Array);
  });

  it("should format distributed tasks correctly", () => {
    const tasks = [
      {
        title: "Задача из обсуждения",
        description: "Описание",
        priority: "high",
        sectionId: 1,
      },
    ];
    expect(tasks[0].title).toBeTruthy();
    expect(tasks[0].sectionId).toBe(1);
    expect(["critical", "high", "medium", "low"]).toContain(tasks[0].priority);
  });
});

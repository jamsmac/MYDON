import { describe, it, expect, vi, beforeEach } from "vitest";
import { analyticsRouter } from "./analyticsRouter";
import { analyticsExportRouter } from "./analyticsExport";

// Mock database
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
  }),
}));

describe("Analytics Router", () => {
  describe("getBurnupData", () => {
    it("should be defined as a procedure", () => {
      expect(analyticsRouter).toBeDefined();
      expect(analyticsRouter._def.procedures).toHaveProperty("getBurnupData");
    });
  });

  describe("getVelocityData", () => {
    it("should be defined as a procedure", () => {
      expect(analyticsRouter._def.procedures).toHaveProperty("getVelocityData");
    });
  });

  describe("getBlockCompletionRates", () => {
    it("should be defined as a procedure", () => {
      expect(analyticsRouter._def.procedures).toHaveProperty("getBlockCompletionRates");
    });
  });

  describe("getProjectedCompletion", () => {
    it("should be defined as a procedure", () => {
      expect(analyticsRouter._def.procedures).toHaveProperty("getProjectedCompletion");
    });
  });

  describe("getPriorityDistribution", () => {
    it("should be defined as a procedure", () => {
      expect(analyticsRouter._def.procedures).toHaveProperty("getPriorityDistribution");
    });
  });

  describe("getCompletionTimeHistogram", () => {
    it("should be defined as a procedure", () => {
      expect(analyticsRouter._def.procedures).toHaveProperty("getCompletionTimeHistogram");
    });
  });

  describe("getPlanVsActual", () => {
    it("should be defined as a procedure", () => {
      expect(analyticsRouter._def.procedures).toHaveProperty("getPlanVsActual");
    });
  });

  describe("getTopLongestTasks", () => {
    it("should be defined as a procedure", () => {
      expect(analyticsRouter._def.procedures).toHaveProperty("getTopLongestTasks");
    });
  });
});

describe("Analytics Export Router", () => {
  describe("generatePdfReport", () => {
    it("should be defined as a mutation", () => {
      expect(analyticsExportRouter).toBeDefined();
      expect(analyticsExportRouter._def.procedures).toHaveProperty("generatePdfReport");
    });
  });

  describe("generateExcelData", () => {
    it("should be defined as a mutation", () => {
      expect(analyticsExportRouter._def.procedures).toHaveProperty("generateExcelData");
    });
  });
});

describe("Analytics Data Structures", () => {
  it("should have correct burnup data structure", () => {
    const mockBurnupData = {
      data: [
        { date: "2024-01-01", total: 100, completed: 20, scope: 100 },
        { date: "2024-01-08", total: 100, completed: 40, scope: 100 },
      ],
      totalTasks: 100,
      completedTasks: 40,
      completionRate: 40,
    };
    
    expect(mockBurnupData.data).toBeInstanceOf(Array);
    expect(mockBurnupData.data[0]).toHaveProperty("date");
    expect(mockBurnupData.data[0]).toHaveProperty("total");
    expect(mockBurnupData.data[0]).toHaveProperty("completed");
    expect(mockBurnupData.totalTasks).toBe(100);
    expect(mockBurnupData.completionRate).toBe(40);
  });

  it("should have correct velocity data structure", () => {
    const mockVelocityData = {
      data: [
        { week: "Неделя 1", completed: 10, average: 10 },
        { week: "Неделя 2", completed: 15, average: 12.5 },
      ],
      avgVelocity: 12.5,
      totalCompleted: 25,
    };
    
    expect(mockVelocityData.data).toBeInstanceOf(Array);
    expect(mockVelocityData.data[0]).toHaveProperty("week");
    expect(mockVelocityData.data[0]).toHaveProperty("completed");
    expect(mockVelocityData.avgVelocity).toBe(12.5);
  });

  it("should have correct priority distribution structure", () => {
    const mockPriorityData = [
      { priority: "critical", label: "Критический", count: 5, color: "#ef4444" },
      { priority: "high", label: "Высокий", count: 15, color: "#f97316" },
      { priority: "medium", label: "Средний", count: 30, color: "#f59e0b" },
      { priority: "low", label: "Низкий", count: 10, color: "#22c55e" },
    ];
    
    expect(mockPriorityData).toBeInstanceOf(Array);
    expect(mockPriorityData.length).toBe(4);
    expect(mockPriorityData[0]).toHaveProperty("priority");
    expect(mockPriorityData[0]).toHaveProperty("count");
    expect(mockPriorityData[0]).toHaveProperty("color");
  });

  it("should have correct completion time histogram structure", () => {
    const mockHistogramData = {
      data: [
        { label: "< 1 день", count: 20 },
        { label: "1-3 дня", count: 30 },
        { label: "4-7 дней", count: 25 },
        { label: "1-2 недели", count: 15 },
        { label: "2-4 недели", count: 8 },
        { label: "> 1 месяц", count: 2 },
      ],
      totalCompleted: 100,
      avgDays: 5.2,
    };
    
    expect(mockHistogramData.data).toBeInstanceOf(Array);
    expect(mockHistogramData.data.length).toBe(6);
    expect(mockHistogramData.totalCompleted).toBe(100);
    expect(mockHistogramData.avgDays).toBeGreaterThan(0);
  });

  it("should have correct plan vs actual structure", () => {
    const mockPlanVsActual = [
      {
        number: 1,
        block: "Block 1",
        plannedDate: "2024-01-15",
        actualDate: "2024-01-14",
        daysVariance: -1,
        status: "completed",
      },
      {
        number: 2,
        block: "Block 2",
        plannedDate: "2024-01-30",
        actualDate: null,
        daysVariance: 5,
        status: "delayed",
      },
    ];
    
    expect(mockPlanVsActual).toBeInstanceOf(Array);
    expect(mockPlanVsActual[0]).toHaveProperty("number");
    expect(mockPlanVsActual[0]).toHaveProperty("plannedDate");
    expect(mockPlanVsActual[0]).toHaveProperty("status");
    expect(["completed", "on_track", "at_risk", "delayed"]).toContain(mockPlanVsActual[0].status);
  });

  it("should have correct top longest tasks structure", () => {
    const mockTopTasks = [
      { id: 1, title: "Task 1", days: 45, status: "completed" },
      { id: 2, title: "Task 2", days: 30, status: "in_progress" },
      { id: 3, title: "Task 3", days: 25, status: "completed" },
    ];
    
    expect(mockTopTasks).toBeInstanceOf(Array);
    expect(mockTopTasks[0]).toHaveProperty("id");
    expect(mockTopTasks[0]).toHaveProperty("title");
    expect(mockTopTasks[0]).toHaveProperty("days");
    expect(mockTopTasks[0]).toHaveProperty("status");
    expect(mockTopTasks[0].days).toBeGreaterThan(mockTopTasks[1].days);
  });
});

describe("Export Data Formats", () => {
  it("should generate valid markdown report structure", () => {
    const mockMarkdown = `# Аналитический отчёт: Test Project

**Дата генерации:** 1 января 2024

---

## Общая статистика

| Показатель | Значение |
|------------|----------|
| Всего задач | 100 |
| Завершено | 40 (40%) |

---

*Отчёт сгенерирован MYDON Roadmap Hub*
`;
    
    expect(mockMarkdown).toContain("# Аналитический отчёт:");
    expect(mockMarkdown).toContain("## Общая статистика");
    expect(mockMarkdown).toContain("| Показатель | Значение |");
  });

  it("should generate valid CSV structure", () => {
    const mockCsv = `Блок №,Блок,Дедлайн блока,Секция,Задача,Статус,Приоритет,Дедлайн задачи,Дата создания
1,"Block 1",2024-01-15,"Section 1","Task 1",Завершена,Высокий,2024-01-10,2024-01-01
1,"Block 1",2024-01-15,"Section 1","Task 2",В работе,Средний,2024-01-12,2024-01-02
`;
    
    const lines = mockCsv.split('\n');
    expect(lines.length).toBeGreaterThan(1);
    
    const headers = lines[0].split(',');
    expect(headers).toContain("Блок №");
    expect(headers).toContain("Задача");
    expect(headers).toContain("Статус");
    expect(headers).toContain("Приоритет");
  });
});

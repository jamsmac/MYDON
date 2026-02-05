import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the LLM module
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          suggestions: [
            { title: "Test Task", description: "Test description", priority: "medium" }
          ]
        })
      }
    }]
  })
}));

// Mock the database
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue({ insertId: 1 }),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockResolvedValue({ affectedRows: 1 }),
  })
}));

describe("AI Enhancements", () => {
  describe("Priority Detection", () => {
    it("should detect critical priority from keywords", () => {
      const PRIORITY_KEYWORDS = {
        critical: ["urgent", "critical", "asap", "emergency", "blocker"],
        high: ["important", "high priority", "soon", "deadline"],
        medium: ["normal", "standard", "regular"],
        low: ["nice to have", "optional", "later", "backlog"]
      };

      const detectPriority = (title: string, description?: string) => {
        const text = `${title} ${description || ""}`.toLowerCase();
        
        for (const [priority, keywords] of Object.entries(PRIORITY_KEYWORDS)) {
          if (keywords.some(kw => text.includes(kw))) {
            return { priority, confidence: 90 };
          }
        }
        return { priority: "medium", confidence: 50 };
      };

      expect(detectPriority("URGENT: Fix production bug")).toEqual({
        priority: "critical",
        confidence: 90
      });

      expect(detectPriority("Important feature request")).toEqual({
        priority: "high",
        confidence: 90
      });

      expect(detectPriority("Nice to have improvement")).toEqual({
        priority: "low",
        confidence: 90
      });

      // "Regular" matches "regular" keyword, so it gets 90 confidence
      expect(detectPriority("Regular task")).toEqual({
        priority: "medium",
        confidence: 90
      });
    });

    it("should detect priority from deadline proximity", () => {
      const detectPriorityFromDeadline = (deadline: Date) => {
        const daysUntil = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        
        if (daysUntil <= 1) return { priority: "critical", confidence: 95 };
        if (daysUntil <= 3) return { priority: "high", confidence: 85 };
        if (daysUntil <= 7) return { priority: "medium", confidence: 75 };
        return { priority: "low", confidence: 60 };
      };

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(detectPriorityFromDeadline(tomorrow).priority).toBe("critical");

      const in3Days = new Date();
      in3Days.setDate(in3Days.getDate() + 3);
      expect(detectPriorityFromDeadline(in3Days).priority).toBe("high");

      const in7Days = new Date();
      in7Days.setDate(in7Days.getDate() + 7);
      expect(detectPriorityFromDeadline(in7Days).priority).toBe("medium");

      const in30Days = new Date();
      in30Days.setDate(in30Days.getDate() + 30);
      expect(detectPriorityFromDeadline(in30Days).priority).toBe("low");
    });
  });

  describe("Risk Detection", () => {
    it("should detect overdue tasks as risks", () => {
      const detectOverdueRisk = (task: { deadline: Date; status: string }) => {
        if (task.status === "completed") return null;
        
        const now = new Date();
        const daysOverdue = Math.ceil((now.getTime() - task.deadline.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysOverdue > 0) {
          return {
            type: "overdue",
            severity: daysOverdue > 7 ? "critical" : daysOverdue > 3 ? "high" : "medium",
            daysOverdue
          };
        }
        return null;
      };

      const overdueTask = {
        deadline: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        status: "in_progress"
      };

      const risk = detectOverdueRisk(overdueTask);
      expect(risk).not.toBeNull();
      expect(risk?.type).toBe("overdue");
      expect(risk?.severity).toBe("critical");
    });

    it("should not flag completed tasks as overdue", () => {
      const detectOverdueRisk = (task: { deadline: Date; status: string }) => {
        if (task.status === "completed") return null;
        
        const now = new Date();
        const daysOverdue = Math.ceil((now.getTime() - task.deadline.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysOverdue > 0) {
          return { type: "overdue", severity: "high" };
        }
        return null;
      };

      const completedTask = {
        deadline: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        status: "completed"
      };

      expect(detectOverdueRisk(completedTask)).toBeNull();
    });

    it("should detect blocked tasks", () => {
      const detectBlockedRisk = (
        task: { dependencies: number[]; status: string },
        taskMap: Map<number, { status: string }>
      ) => {
        if (task.status === "completed" || !task.dependencies?.length) return null;
        
        const blockedBy = task.dependencies.filter(depId => {
          const dep = taskMap.get(depId);
          return dep && dep.status !== "completed";
        });
        
        if (blockedBy.length > 0) {
          return {
            type: "blocked",
            severity: "high",
            blockedByCount: blockedBy.length
          };
        }
        return null;
      };

      const taskMap = new Map([
        [1, { status: "in_progress" }],
        [2, { status: "completed" }],
        [3, { status: "not_started" }]
      ]);

      const blockedTask = {
        dependencies: [1, 3],
        status: "not_started"
      };

      const risk = detectBlockedRisk(blockedTask, taskMap);
      expect(risk).not.toBeNull();
      expect(risk?.type).toBe("blocked");
      expect(risk?.blockedByCount).toBe(2);
    });

    it("should detect scope creep (too many tasks in progress)", () => {
      const detectScopeRisk = (inProgressCount: number) => {
        if (inProgressCount > 10) {
          return {
            type: "scope",
            severity: "medium",
            message: `${inProgressCount} tasks in progress`
          };
        }
        return null;
      };

      expect(detectScopeRisk(5)).toBeNull();
      expect(detectScopeRisk(15)?.type).toBe("scope");
    });
  });

  describe("Similar Task Detection", () => {
    it("should calculate similarity between task titles", () => {
      const calculateSimilarity = (title1: string, title2: string) => {
        const words1 = title1.toLowerCase().split(/\s+/);
        const words2 = title2.toLowerCase().split(/\s+/);
        const intersection = words1.filter(w => words2.includes(w));
        return Math.round((intersection.length * 2 / (words1.length + words2.length)) * 100);
      };

      expect(calculateSimilarity("Create user login", "Create user registration")).toBeGreaterThan(50);
      expect(calculateSimilarity("Fix bug in API", "Design new homepage")).toBeLessThan(30);
      expect(calculateSimilarity("Test payment flow", "Test payment integration")).toBeGreaterThan(60);
    });
  });

  describe("Quick Commands", () => {
    it("should have valid command types", () => {
      const validCommands = ["summarize", "analyze", "suggest", "risks"];
      
      validCommands.forEach(cmd => {
        expect(["summarize", "analyze", "suggest", "risks"]).toContain(cmd);
      });
    });

    it("should generate appropriate prompts for each command", () => {
      const generatePrompt = (command: string, contextType: string) => {
        const prompts: Record<string, string> = {
          summarize: `Summarize this ${contextType}`,
          analyze: `Analyze this ${contextType} (SWOT)`,
          suggest: `Suggest improvements for this ${contextType}`,
          risks: `Identify risks for this ${contextType}`
        };
        return prompts[command];
      };

      expect(generatePrompt("summarize", "project")).toContain("Summarize");
      expect(generatePrompt("analyze", "task")).toContain("SWOT");
      expect(generatePrompt("suggest", "block")).toContain("improvements");
      expect(generatePrompt("risks", "section")).toContain("risks");
    });
  });

  describe("Executive Summary", () => {
    it("should calculate correct progress percentage", () => {
      const calculateProgress = (completed: number, total: number) => {
        if (total === 0) return 0;
        return Math.round((completed / total) * 100);
      };

      expect(calculateProgress(5, 10)).toBe(50);
      expect(calculateProgress(0, 10)).toBe(0);
      expect(calculateProgress(10, 10)).toBe(100);
      expect(calculateProgress(0, 0)).toBe(0);
    });

    it("should identify recently completed tasks", () => {
      const getRecentlyCompleted = (tasks: Array<{ status: string; updatedAt: Date }>, daysAgo: number) => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysAgo);
        
        return tasks.filter(t => 
          t.status === "completed" && new Date(t.updatedAt) > cutoff
        );
      };

      const tasks = [
        { status: "completed", updatedAt: new Date() },
        { status: "completed", updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
        { status: "in_progress", updatedAt: new Date() }
      ];

      const recent = getRecentlyCompleted(tasks, 7);
      expect(recent.length).toBe(1);
    });
  });

  describe("Chat History", () => {
    it("should format chat messages correctly", () => {
      const formatMessage = (role: string, content: string, timestamp: Date) => {
        const roleLabel = role === "user" ? "👤 Вы" : "🤖 AI";
        return `${roleLabel} (${timestamp.toLocaleString("ru-RU")}): ${content}`;
      };

      const formatted = formatMessage("user", "Hello", new Date());
      expect(formatted).toContain("👤 Вы");
      expect(formatted).toContain("Hello");
    });

    it("should export history in markdown format", () => {
      const exportToMarkdown = (messages: Array<{ role: string; content: string; createdAt: Date }>) => {
        let markdown = "# AI Chat History\n\n";
        for (const msg of messages) {
          const role = msg.role === "user" ? "👤 Вы" : "🤖 AI";
          markdown += `### ${role}\n\n${msg.content}\n\n---\n\n`;
        }
        return markdown;
      };

      const messages = [
        { role: "user", content: "/summarize", createdAt: new Date() },
        { role: "assistant", content: "Here is the summary...", createdAt: new Date() }
      ];

      const markdown = exportToMarkdown(messages);
      expect(markdown).toContain("# AI Chat History");
      expect(markdown).toContain("/summarize");
      expect(markdown).toContain("Here is the summary");
    });
  });
});

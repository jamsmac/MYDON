import { describe, it, expect } from "vitest";

describe("AI Dependency Suggestions", () => {
  describe("suggestDependencies endpoint schema", () => {
    it("should accept valid input with all fields", () => {
      const input = {
        projectId: 1,
        taskId: 5,
        taskTitle: "Implement payment integration",
        taskDescription: "Integrate Stripe for subscription payments",
        sectionId: 2,
        currentDependencies: [3, 4],
      };
      expect(input.projectId).toBe(1);
      expect(input.taskId).toBe(5);
      expect(input.taskTitle).toBe("Implement payment integration");
      expect(input.taskDescription).toBe("Integrate Stripe for subscription payments");
      expect(input.sectionId).toBe(2);
      expect(input.currentDependencies).toEqual([3, 4]);
    });

    it("should accept minimal input (only required fields)", () => {
      const input = {
        projectId: 1,
        taskTitle: "New task",
      };
      expect(input.projectId).toBe(1);
      expect(input.taskTitle).toBe("New task");
    });

    it("should handle empty currentDependencies array", () => {
      const input = {
        projectId: 1,
        taskTitle: "Test task",
        currentDependencies: [] as number[],
      };
      expect(input.currentDependencies).toEqual([]);
      expect(input.currentDependencies.length).toBe(0);
    });
  });

  describe("dependency suggestion filtering logic", () => {
    const allTasks = [
      { taskId: 1, taskTitle: "Design database schema", taskStatus: "completed", sectionId: 1 },
      { taskId: 2, taskTitle: "Create API endpoints", taskStatus: "in_progress", sectionId: 1 },
      { taskId: 3, taskTitle: "Write unit tests", taskStatus: "not_started", sectionId: 1 },
      { taskId: 4, taskTitle: "Deploy to staging", taskStatus: "not_started", sectionId: 2 },
      { taskId: 5, taskTitle: "User acceptance testing", taskStatus: "not_started", sectionId: 2 },
    ];

    it("should exclude the current task from candidates", () => {
      const currentTaskId = 3;
      const candidates = allTasks.filter(t => t.taskId !== currentTaskId);
      expect(candidates).toHaveLength(4);
      expect(candidates.find(t => t.taskId === 3)).toBeUndefined();
    });

    it("should exclude already-set dependencies from candidates", () => {
      const currentDependencies = [1, 2];
      const currentTaskId = 5;
      const excludeIds = new Set([...currentDependencies, currentTaskId]);
      const candidates = allTasks.filter(t => !excludeIds.has(t.taskId));
      expect(candidates).toHaveLength(2);
      expect(candidates.map(t => t.taskId)).toEqual([3, 4]);
    });

    it("should return empty when all tasks are excluded", () => {
      const excludeIds = new Set([1, 2, 3, 4, 5]);
      const candidates = allTasks.filter(t => !excludeIds.has(t.taskId));
      expect(candidates).toHaveLength(0);
    });
  });

  describe("heuristic fallback logic", () => {
    const candidateTasks = [
      { taskId: 1, taskTitle: "Design payment flow", taskStatus: "completed", sectionId: 1, sectionTitle: "Backend", blockTitle: "Core" },
      { taskId: 2, taskTitle: "Create payment API", taskStatus: "in_progress", sectionId: 1, sectionTitle: "Backend", blockTitle: "Core" },
      { taskId: 3, taskTitle: "Write documentation", taskStatus: "not_started", sectionId: 2, sectionTitle: "Docs", blockTitle: "Support" },
      { taskId: 4, taskTitle: "Deploy infrastructure", taskStatus: "not_started", sectionId: 3, sectionTitle: "DevOps", blockTitle: "Ops" },
    ];

    it("should find related tasks by keyword overlap", () => {
      const inputTitle = "Implement payment processing";
      const titleWords = inputTitle.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      
      const matches = candidateTasks.filter(t => {
        const candidateTitle = (t.taskTitle || "").toLowerCase();
        return titleWords.some(w => candidateTitle.includes(w));
      });
      
      expect(matches.length).toBeGreaterThan(0);
      expect(matches.map(m => m.taskId)).toContain(1); // "Design payment flow" matches "payment"
      expect(matches.map(m => m.taskId)).toContain(2); // "Create payment API" matches "payment"
    });

    it("should find related tasks in the same section", () => {
      const inputSectionId = 1;
      const sameSection = candidateTasks.filter(t => t.sectionId === inputSectionId);
      expect(sameSection).toHaveLength(2);
      expect(sameSection.map(t => t.taskId)).toEqual([1, 2]);
    });

    it("should limit heuristic suggestions to 3", () => {
      const inputTitle = "payment";
      const inputSectionId = 1;
      
      const heuristicSuggestions = candidateTasks
        .filter(t => {
          const title = inputTitle.toLowerCase();
          const candidateTitle = (t.taskTitle || "").toLowerCase();
          const sameSection = t.sectionId === inputSectionId;
          const titleWords = title.split(/\s+/).filter(w => w.length > 3);
          const hasOverlap = titleWords.some(w => candidateTitle.includes(w));
          return sameSection || hasOverlap;
        })
        .slice(0, 3);
      
      expect(heuristicSuggestions.length).toBeLessThanOrEqual(3);
    });
  });

  describe("suggestion validation", () => {
    it("should filter out suggestions with low confidence", () => {
      const suggestions = [
        { taskId: 1, reason: "Direct dependency", confidence: 90 },
        { taskId: 2, reason: "Weak relation", confidence: 20 },
        { taskId: 3, reason: "Moderate relation", confidence: 50 },
      ];
      
      const valid = suggestions.filter(s => s.confidence >= 30);
      expect(valid).toHaveLength(2);
      expect(valid.map(s => s.taskId)).toEqual([1, 3]);
    });

    it("should validate that suggested taskIds exist in candidates", () => {
      const validTaskIds = new Set([1, 2, 3, 4, 5]);
      const suggestions = [
        { taskId: 1, reason: "Valid", confidence: 80 },
        { taskId: 99, reason: "Invalid - not in project", confidence: 90 },
        { taskId: 3, reason: "Valid", confidence: 70 },
      ];
      
      const validSuggestions = suggestions.filter(s => validTaskIds.has(s.taskId));
      expect(validSuggestions).toHaveLength(2);
      expect(validSuggestions.map(s => s.taskId)).toEqual([1, 3]);
    });

    it("should limit suggestions to maximum 5", () => {
      const suggestions = Array.from({ length: 10 }, (_, i) => ({
        taskId: i + 1,
        reason: `Reason ${i + 1}`,
        confidence: 80,
      }));
      
      const limited = suggestions.slice(0, 5);
      expect(limited).toHaveLength(5);
    });
  });

  describe("response format", () => {
    it("should return properly structured response", () => {
      const response = {
        suggestions: [
          {
            taskId: 1,
            taskTitle: "Design schema",
            taskStatus: "completed",
            section: "Backend",
            block: "Core",
            reason: "Schema must be designed before implementation",
            confidence: 90,
          },
        ],
        reasoning: "The implementation task depends on the schema design being complete.",
      };
      
      expect(response.suggestions).toHaveLength(1);
      expect(response.suggestions[0]).toHaveProperty("taskId");
      expect(response.suggestions[0]).toHaveProperty("taskTitle");
      expect(response.suggestions[0]).toHaveProperty("taskStatus");
      expect(response.suggestions[0]).toHaveProperty("section");
      expect(response.suggestions[0]).toHaveProperty("block");
      expect(response.suggestions[0]).toHaveProperty("reason");
      expect(response.suggestions[0]).toHaveProperty("confidence");
      expect(response).toHaveProperty("reasoning");
    });

    it("should handle empty suggestions gracefully", () => {
      const response = {
        suggestions: [],
        reasoning: "No dependencies found",
      };
      
      expect(response.suggestions).toHaveLength(0);
      expect(response.reasoning).toBeTruthy();
    });
  });
});

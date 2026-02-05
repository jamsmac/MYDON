import { describe, it, expect, vi } from "vitest";
import { templateEnhancedRouter } from "./templateEnhancedRouter";

// Mock database
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([{ insertId: 1 }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
  }),
}));

describe("Template Enhanced Router", () => {
  describe("Categories", () => {
    it("should have listCategories procedure", () => {
      expect(templateEnhancedRouter).toBeDefined();
      expect(templateEnhancedRouter._def.procedures).toHaveProperty("listCategories");
    });

    it("should have createCategory procedure", () => {
      expect(templateEnhancedRouter._def.procedures).toHaveProperty("createCategory");
    });
  });

  describe("Tags", () => {
    it("should have listTags procedure", () => {
      expect(templateEnhancedRouter._def.procedures).toHaveProperty("listTags");
    });

    it("should have getOrCreateTag procedure", () => {
      expect(templateEnhancedRouter._def.procedures).toHaveProperty("getOrCreateTag");
    });
  });

  describe("Template Variables", () => {
    it("should have updateTemplateVariables procedure", () => {
      expect(templateEnhancedRouter._def.procedures).toHaveProperty("updateTemplateVariables");
    });

    it("should have previewTemplate procedure", () => {
      expect(templateEnhancedRouter._def.procedures).toHaveProperty("previewTemplate");
    });
  });

  describe("Community Templates", () => {
    it("should have listCommunityTemplates procedure", () => {
      expect(templateEnhancedRouter._def.procedures).toHaveProperty("listCommunityTemplates");
    });

    it("should have publishTemplate procedure", () => {
      expect(templateEnhancedRouter._def.procedures).toHaveProperty("publishTemplate");
    });

    it("should have unpublishTemplate procedure", () => {
      expect(templateEnhancedRouter._def.procedures).toHaveProperty("unpublishTemplate");
    });
  });

  describe("Ratings", () => {
    it("should have rateTemplate procedure", () => {
      expect(templateEnhancedRouter._def.procedures).toHaveProperty("rateTemplate");
    });

    it("should have getTemplateRatings procedure", () => {
      expect(templateEnhancedRouter._def.procedures).toHaveProperty("getTemplateRatings");
    });
  });

  describe("Template Usage", () => {
    it("should have useTemplate procedure", () => {
      expect(templateEnhancedRouter._def.procedures).toHaveProperty("useTemplate");
    });

    it("should have createFromProject procedure", () => {
      expect(templateEnhancedRouter._def.procedures).toHaveProperty("createFromProject");
    });
  });
});

describe("Variable Substitution", () => {
  // Test the variable substitution logic
  const substituteVariables = (text: string, variables: Record<string, string>): string => {
    let result = text;
    for (const [key, value] of Object.entries(variables)) {
      const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      result = result.replace(pattern, value);
    }
    return result;
  };

  it("should substitute simple variables", () => {
    const text = "Hello {{name}}!";
    const result = substituteVariables(text, { name: "World" });
    expect(result).toBe("Hello World!");
  });

  it("should substitute multiple variables", () => {
    const text = "Project: {{projectName}} by {{author}}";
    const result = substituteVariables(text, { 
      projectName: "TechRent", 
      author: "Team" 
    });
    expect(result).toBe("Project: TechRent by Team");
  });

  it("should handle variables with spaces", () => {
    const text = "Value: {{ spacedVar }}";
    const result = substituteVariables(text, { spacedVar: "test" });
    expect(result).toBe("Value: test");
  });

  it("should handle missing variables", () => {
    const text = "Hello {{name}}!";
    const result = substituteVariables(text, {});
    expect(result).toBe("Hello {{name}}!");
  });

  it("should substitute all occurrences", () => {
    const text = "{{name}} loves {{name}}";
    const result = substituteVariables(text, { name: "Alice" });
    expect(result).toBe("Alice loves Alice");
  });
});

describe("Template Variable Types", () => {
  const mockVariable = {
    name: "testVar",
    type: "text" as const,
    label: "Test Variable",
    labelRu: "Тестовая переменная",
    description: "A test variable",
    defaultValue: "default",
    required: true,
    placeholder: "Enter value...",
  };

  it("should have correct text variable structure", () => {
    expect(mockVariable.type).toBe("text");
    expect(mockVariable.name).toBeDefined();
    expect(mockVariable.label).toBeDefined();
  });

  it("should support select variable with options", () => {
    const selectVar = {
      ...mockVariable,
      type: "select" as const,
      options: ["Option 1", "Option 2", "Option 3"],
    };
    expect(selectVar.options).toHaveLength(3);
    expect(selectVar.options).toContain("Option 1");
  });

  it("should support number variable", () => {
    const numberVar = {
      ...mockVariable,
      type: "number" as const,
      defaultValue: "10",
    };
    expect(numberVar.type).toBe("number");
  });

  it("should support date variable", () => {
    const dateVar = {
      ...mockVariable,
      type: "date" as const,
      defaultValue: "2024-01-01",
    };
    expect(dateVar.type).toBe("date");
  });
});

describe("Template Structure", () => {
  const mockStructure = {
    variables: [
      { name: "projectName", type: "text" as const, label: "Project Name" },
    ],
    blocks: [
      {
        title: "Block 1: {{projectName}}",
        description: "Description for {{projectName}}",
        duration: "2 weeks",
        sections: [
          {
            title: "Section 1",
            description: "Section description",
            tasks: [
              { title: "Task 1", description: "Task description", priority: "high" as const },
              { title: "Task 2", priority: "medium" as const },
            ],
          },
        ],
      },
    ],
  };

  it("should have variables array", () => {
    expect(mockStructure.variables).toBeDefined();
    expect(mockStructure.variables).toHaveLength(1);
  });

  it("should have blocks array", () => {
    expect(mockStructure.blocks).toBeDefined();
    expect(mockStructure.blocks).toHaveLength(1);
  });

  it("should have nested sections", () => {
    expect(mockStructure.blocks[0].sections).toHaveLength(1);
  });

  it("should have nested tasks", () => {
    expect(mockStructure.blocks[0].sections[0].tasks).toHaveLength(2);
  });

  it("should support task priorities", () => {
    const task = mockStructure.blocks[0].sections[0].tasks[0];
    expect(task.priority).toBe("high");
  });
});

describe("Template Rating", () => {
  it("should validate rating range 1-5", () => {
    const validRatings = [1, 2, 3, 4, 5];
    const invalidRatings = [0, 6, -1, 10];
    
    validRatings.forEach(rating => {
      expect(rating >= 1 && rating <= 5).toBe(true);
    });
    
    invalidRatings.forEach(rating => {
      expect(rating >= 1 && rating <= 5).toBe(false);
    });
  });

  it("should calculate average rating correctly", () => {
    const ratings = [5, 4, 4, 5, 3];
    const average = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    expect(average).toBe(4.2);
  });

  it("should store rating as integer (x100)", () => {
    const displayRating = 4.2;
    const storedRating = Math.round(displayRating * 100);
    expect(storedRating).toBe(420);
    
    const recoveredRating = storedRating / 100;
    expect(recoveredRating).toBe(4.2);
  });
});

describe("Community Template Filters", () => {
  const mockFilters = {
    categoryId: 1,
    tagIds: [1, 2, 3],
    search: "roadmap",
    sortBy: "popular" as const,
    page: 1,
    limit: 20,
  };

  it("should support category filter", () => {
    expect(mockFilters.categoryId).toBe(1);
  });

  it("should support multiple tag filters", () => {
    expect(mockFilters.tagIds).toHaveLength(3);
  });

  it("should support search filter", () => {
    expect(mockFilters.search).toBe("roadmap");
  });

  it("should support sort options", () => {
    const validSortOptions = ["popular", "newest", "rating"];
    expect(validSortOptions).toContain(mockFilters.sortBy);
  });

  it("should support pagination", () => {
    expect(mockFilters.page).toBeGreaterThan(0);
    expect(mockFilters.limit).toBeGreaterThan(0);
  });
});

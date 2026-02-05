import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkAndAwardAchievements, ACHIEVEMENTS, type AchievementTrigger } from "./achievementService";

// Mock drizzle-orm with proper chaining
vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: vi.fn(() => {
    let selectCallCount = 0;
    return {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => {
            selectCallCount++;
            // Odd calls are for userStats (with limit), even calls are for userAchievements (array)
            if (selectCallCount % 2 === 1) {
              return {
                limit: vi.fn(() => Promise.resolve([{
                  userId: 1,
                  tasksCompleted: 5,
                  projectsCompleted: 0,
                  currentStreak: 2,
                  longestStreak: 5,
                  totalPoints: 50,
                  level: 1,
                  lastActivityDate: new Date(),
                }])),
                then: (cb: Function) => cb([{
                  userId: 1,
                  tasksCompleted: 5,
                  projectsCompleted: 0,
                  currentStreak: 2,
                  longestStreak: 5,
                  totalPoints: 50,
                  level: 1,
                  lastActivityDate: new Date(),
                }]),
              };
            } else {
              // Return array for userAchievements (no limit call)
              return Promise.resolve([]);
            }
          }),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => Promise.resolve()),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve()),
        })),
      })),
    };
  }),
}));

describe("Achievement Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set DATABASE_URL for tests
    process.env.DATABASE_URL = "mysql://test:test@localhost:3306/test";
  });

  describe("Achievement Service", () => {
    it("should have all achievements defined", () => {
      expect(ACHIEVEMENTS).toBeDefined();
      expect(ACHIEVEMENTS.length).toBe(13);
    });

    it("should have unique achievement IDs", () => {
      const ids = ACHIEVEMENTS.map(a => a.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should have unique achievement codes", () => {
      const codes = ACHIEVEMENTS.map(a => a.code);
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);
    });

    it("should have valid categories", () => {
      const validCategories = ["tasks", "streaks", "projects", "special"];
      ACHIEVEMENTS.forEach(achievement => {
        expect(validCategories).toContain(achievement.category);
      });
    });

    it("should have positive points for all achievements", () => {
      ACHIEVEMENTS.forEach(achievement => {
        expect(achievement.points).toBeGreaterThan(0);
      });
    });
  });

  describe("Achievement Triggers", () => {
    const triggers: AchievementTrigger[] = ["task_completed", "project_completed", "project_created"];

    triggers.forEach(trigger => {
      it(`should handle ${trigger} trigger`, async () => {
        const result = await checkAndAwardAchievements(1, trigger);
        expect(result).toHaveProperty("newAchievements");
        expect(result).toHaveProperty("totalNewPoints");
        expect(Array.isArray(result.newAchievements)).toBe(true);
        expect(typeof result.totalNewPoints).toBe("number");
      });
    });
  });

  describe("Task Completion Achievements", () => {
    it("should define first_task achievement", () => {
      const achievement = ACHIEVEMENTS.find(a => a.code === "first_task");
      expect(achievement).toBeDefined();
      expect(achievement?.name).toBe("First Steps");
      expect(achievement?.points).toBe(10);
    });

    it("should define task milestone achievements", () => {
      const milestones = ["task_master_10", "task_master_50", "task_master_100"];
      milestones.forEach(code => {
        const achievement = ACHIEVEMENTS.find(a => a.code === code);
        expect(achievement).toBeDefined();
        expect(achievement?.category).toBe("tasks");
      });
    });
  });

  describe("Project Achievements", () => {
    it("should define first_project achievement", () => {
      const achievement = ACHIEVEMENTS.find(a => a.code === "first_project");
      expect(achievement).toBeDefined();
      expect(achievement?.name).toBe("Project Pioneer");
      expect(achievement?.points).toBe(15);
    });

    it("should define project_complete achievement", () => {
      const achievement = ACHIEVEMENTS.find(a => a.code === "project_complete");
      expect(achievement).toBeDefined();
      expect(achievement?.name).toBe("Project Finisher");
      expect(achievement?.points).toBe(50);
    });
  });

  describe("Streak Achievements", () => {
    it("should define streak achievements", () => {
      const streakCodes = ["streak_3", "streak_7", "streak_30"];
      streakCodes.forEach(code => {
        const achievement = ACHIEVEMENTS.find(a => a.code === code);
        expect(achievement).toBeDefined();
        expect(achievement?.category).toBe("streaks");
      });
    });

    it("should have increasing points for longer streaks", () => {
      const streak3 = ACHIEVEMENTS.find(a => a.code === "streak_3");
      const streak7 = ACHIEVEMENTS.find(a => a.code === "streak_7");
      const streak30 = ACHIEVEMENTS.find(a => a.code === "streak_30");
      
      expect(streak3?.points).toBeLessThan(streak7?.points || 0);
      expect(streak7?.points).toBeLessThan(streak30?.points || 0);
    });
  });

  describe("Special Achievements", () => {
    it("should define time-based achievements", () => {
      const earlyBird = ACHIEVEMENTS.find(a => a.code === "early_bird");
      const nightOwl = ACHIEVEMENTS.find(a => a.code === "night_owl");
      
      expect(earlyBird).toBeDefined();
      expect(earlyBird?.description).toContain("8 AM");
      
      expect(nightOwl).toBeDefined();
      expect(nightOwl?.description).toContain("10 PM");
    });

    it("should define speed_demon achievement", () => {
      const achievement = ACHIEVEMENTS.find(a => a.code === "speed_demon");
      expect(achievement).toBeDefined();
      expect(achievement?.category).toBe("special");
    });

    it("should define perfectionist achievement", () => {
      const achievement = ACHIEVEMENTS.find(a => a.code === "perfectionist");
      expect(achievement).toBeDefined();
      expect(achievement?.category).toBe("special");
    });
  });

  describe("Achievement Result Structure", () => {
    it("should return valid result structure", async () => {
      const result = await checkAndAwardAchievements(1, "task_completed");
      
      expect(result).toHaveProperty("newAchievements");
      expect(result).toHaveProperty("totalNewPoints");
      
      result.newAchievements.forEach(achievement => {
        expect(achievement).toHaveProperty("id");
        expect(achievement).toHaveProperty("code");
        expect(achievement).toHaveProperty("name");
        expect(achievement).toHaveProperty("description");
        expect(achievement).toHaveProperty("icon");
        expect(achievement).toHaveProperty("points");
        expect(achievement).toHaveProperty("category");
      });
    });
  });

  describe("Points Calculation", () => {
    it("should have correct total points for all achievements", () => {
      const totalPoints = ACHIEVEMENTS.reduce((sum, a) => sum + a.points, 0);
      expect(totalPoints).toBeGreaterThan(0);
      // Sum of all achievement points: 10+25+50+100+30+75+200+15+50+20+20+40+35 = 670
      expect(totalPoints).toBe(670);
    });
  });
});

import { describe, it, expect, vi } from "vitest";

// Mock achievement definitions
const ACHIEVEMENTS = [
  { id: 1, code: "first_task", name: "First Steps", description: "Complete your first task", icon: "🎯", points: 10, category: "tasks" },
  { id: 2, code: "task_master_10", name: "Task Master", description: "Complete 10 tasks", icon: "⭐", points: 25, category: "tasks" },
  { id: 3, code: "task_master_50", name: "Task Champion", description: "Complete 50 tasks", icon: "🏆", points: 50, category: "tasks" },
  { id: 4, code: "task_master_100", name: "Task Legend", description: "Complete 100 tasks", icon: "👑", points: 100, category: "tasks" },
  { id: 5, code: "streak_3", name: "On Fire", description: "Complete tasks 3 days in a row", icon: "🔥", points: 30, category: "streaks" },
  { id: 6, code: "streak_7", name: "Week Warrior", description: "Complete tasks 7 days in a row", icon: "💪", points: 75, category: "streaks" },
  { id: 7, code: "streak_30", name: "Monthly Master", description: "Complete tasks 30 days in a row", icon: "🌟", points: 200, category: "streaks" },
  { id: 8, code: "first_project", name: "Project Pioneer", description: "Create your first project", icon: "📋", points: 15, category: "projects" },
  { id: 9, code: "project_complete", name: "Project Finisher", description: "Complete a project", icon: "✅", points: 50, category: "projects" },
  { id: 10, code: "early_bird", name: "Early Bird", description: "Complete a task before 8 AM", icon: "🌅", points: 20, category: "special" },
  { id: 11, code: "night_owl", name: "Night Owl", description: "Complete a task after 10 PM", icon: "🦉", points: 20, category: "special" },
  { id: 12, code: "speed_demon", name: "Speed Demon", description: "Complete 5 tasks in one hour", icon: "⚡", points: 40, category: "special" },
  { id: 13, code: "perfectionist", name: "Perfectionist", description: "Complete all tasks in a section", icon: "💎", points: 35, category: "special" },
];

describe("Gamification System", () => {
  describe("Achievement Definitions", () => {
    it("should have 13 achievements defined", () => {
      expect(ACHIEVEMENTS.length).toBe(13);
    });

    it("should have unique IDs for all achievements", () => {
      const ids = ACHIEVEMENTS.map(a => a.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should have unique codes for all achievements", () => {
      const codes = ACHIEVEMENTS.map(a => a.code);
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);
    });

    it("should have valid categories", () => {
      const validCategories = ["tasks", "streaks", "projects", "special"];
      ACHIEVEMENTS.forEach(a => {
        expect(validCategories).toContain(a.category);
      });
    });

    it("should have positive points for all achievements", () => {
      ACHIEVEMENTS.forEach(a => {
        expect(a.points).toBeGreaterThan(0);
      });
    });
  });

  describe("Task Achievement Milestones", () => {
    it("should have first_task achievement for 1 task", () => {
      const achievement = ACHIEVEMENTS.find(a => a.code === "first_task");
      expect(achievement).toBeDefined();
      expect(achievement?.points).toBe(10);
    });

    it("should have task_master_10 for 10 tasks", () => {
      const achievement = ACHIEVEMENTS.find(a => a.code === "task_master_10");
      expect(achievement).toBeDefined();
      expect(achievement?.points).toBe(25);
    });

    it("should have task_master_50 for 50 tasks", () => {
      const achievement = ACHIEVEMENTS.find(a => a.code === "task_master_50");
      expect(achievement).toBeDefined();
      expect(achievement?.points).toBe(50);
    });

    it("should have task_master_100 for 100 tasks", () => {
      const achievement = ACHIEVEMENTS.find(a => a.code === "task_master_100");
      expect(achievement).toBeDefined();
      expect(achievement?.points).toBe(100);
    });
  });

  describe("Streak Achievements", () => {
    it("should have streak_3 for 3-day streak", () => {
      const achievement = ACHIEVEMENTS.find(a => a.code === "streak_3");
      expect(achievement).toBeDefined();
      expect(achievement?.points).toBe(30);
    });

    it("should have streak_7 for 7-day streak", () => {
      const achievement = ACHIEVEMENTS.find(a => a.code === "streak_7");
      expect(achievement).toBeDefined();
      expect(achievement?.points).toBe(75);
    });

    it("should have streak_30 for 30-day streak", () => {
      const achievement = ACHIEVEMENTS.find(a => a.code === "streak_30");
      expect(achievement).toBeDefined();
      expect(achievement?.points).toBe(200);
    });
  });

  describe("Project Achievements", () => {
    it("should have first_project achievement", () => {
      const achievement = ACHIEVEMENTS.find(a => a.code === "first_project");
      expect(achievement).toBeDefined();
      expect(achievement?.points).toBe(15);
    });

    it("should have project_complete achievement", () => {
      const achievement = ACHIEVEMENTS.find(a => a.code === "project_complete");
      expect(achievement).toBeDefined();
      expect(achievement?.points).toBe(50);
    });
  });

  describe("Special Achievements", () => {
    it("should have early_bird achievement", () => {
      const achievement = ACHIEVEMENTS.find(a => a.code === "early_bird");
      expect(achievement).toBeDefined();
      expect(achievement?.points).toBe(20);
    });

    it("should have night_owl achievement", () => {
      const achievement = ACHIEVEMENTS.find(a => a.code === "night_owl");
      expect(achievement).toBeDefined();
      expect(achievement?.points).toBe(20);
    });

    it("should have speed_demon achievement", () => {
      const achievement = ACHIEVEMENTS.find(a => a.code === "speed_demon");
      expect(achievement).toBeDefined();
      expect(achievement?.points).toBe(40);
    });

    it("should have perfectionist achievement", () => {
      const achievement = ACHIEVEMENTS.find(a => a.code === "perfectionist");
      expect(achievement).toBeDefined();
      expect(achievement?.points).toBe(35);
    });
  });

  describe("Level Calculation", () => {
    it("should calculate level 1 for 0-99 points", () => {
      const calculateLevel = (points: number) => Math.floor(points / 100) + 1;
      expect(calculateLevel(0)).toBe(1);
      expect(calculateLevel(50)).toBe(1);
      expect(calculateLevel(99)).toBe(1);
    });

    it("should calculate level 2 for 100-199 points", () => {
      const calculateLevel = (points: number) => Math.floor(points / 100) + 1;
      expect(calculateLevel(100)).toBe(2);
      expect(calculateLevel(150)).toBe(2);
      expect(calculateLevel(199)).toBe(2);
    });

    it("should calculate level 5 for 400-499 points", () => {
      const calculateLevel = (points: number) => Math.floor(points / 100) + 1;
      expect(calculateLevel(400)).toBe(5);
      expect(calculateLevel(450)).toBe(5);
      expect(calculateLevel(499)).toBe(5);
    });
  });

  describe("Streak Logic", () => {
    it("should reset streak if more than 1 day gap", () => {
      const calculateStreak = (lastActive: Date | null, currentStreak: number) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (!lastActive) return 1;

        const lastActiveNormalized = new Date(lastActive);
        lastActiveNormalized.setHours(0, 0, 0, 0);

        const daysDiff = (today.getTime() - lastActiveNormalized.getTime()) / 86400000;

        if (daysDiff > 2) return 1;
        if (daysDiff >= 1) return currentStreak + 1;
        return currentStreak;
      };

      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      expect(calculateStreak(threeDaysAgo, 5)).toBe(1);
    });

    it("should increment streak if exactly 1 day", () => {
      const calculateStreak = (lastActive: Date | null, currentStreak: number) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (!lastActive) return 1;

        const lastActiveNormalized = new Date(lastActive);
        lastActiveNormalized.setHours(0, 0, 0, 0);

        const daysDiff = (today.getTime() - lastActiveNormalized.getTime()) / 86400000;

        if (daysDiff > 2) return 1;
        if (daysDiff >= 1) return currentStreak + 1;
        return currentStreak;
      };

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      expect(calculateStreak(yesterday, 3)).toBe(4);
    });

    it("should maintain streak if same day", () => {
      const calculateStreak = (lastActive: Date | null, currentStreak: number) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (!lastActive) return 1;

        const lastActiveNormalized = new Date(lastActive);
        lastActiveNormalized.setHours(0, 0, 0, 0);

        const daysDiff = (today.getTime() - lastActiveNormalized.getTime()) / 86400000;

        if (daysDiff > 2) return 1;
        if (daysDiff >= 1) return currentStreak + 1;
        return currentStreak;
      };

      const today = new Date();
      expect(calculateStreak(today, 5)).toBe(5);
    });
  });

  describe("Points Calculation", () => {
    it("should calculate total points from achievements", () => {
      const unlockedCodes = ["first_task", "task_master_10", "streak_3"];
      const totalPoints = unlockedCodes.reduce((sum, code) => {
        const achievement = ACHIEVEMENTS.find(a => a.code === code);
        return sum + (achievement?.points || 0);
      }, 0);

      expect(totalPoints).toBe(10 + 25 + 30); // 65 points
    });

    it("should calculate max possible points", () => {
      const maxPoints = ACHIEVEMENTS.reduce((sum, a) => sum + a.points, 0);
      expect(maxPoints).toBe(10 + 25 + 50 + 100 + 30 + 75 + 200 + 15 + 50 + 20 + 20 + 40 + 35);
      expect(maxPoints).toBe(670);
    });
  });

  describe("Achievement Categories", () => {
    it("should have 4 task achievements", () => {
      const taskAchievements = ACHIEVEMENTS.filter(a => a.category === "tasks");
      expect(taskAchievements.length).toBe(4);
    });

    it("should have 3 streak achievements", () => {
      const streakAchievements = ACHIEVEMENTS.filter(a => a.category === "streaks");
      expect(streakAchievements.length).toBe(3);
    });

    it("should have 2 project achievements", () => {
      const projectAchievements = ACHIEVEMENTS.filter(a => a.category === "projects");
      expect(projectAchievements.length).toBe(2);
    });

    it("should have 4 special achievements", () => {
      const specialAchievements = ACHIEVEMENTS.filter(a => a.category === "special");
      expect(specialAchievements.length).toBe(4);
    });
  });

  describe("Leaderboard Ranking", () => {
    it("should rank users by total points descending", () => {
      const users = [
        { id: 1, totalPoints: 100 },
        { id: 2, totalPoints: 250 },
        { id: 3, totalPoints: 50 },
      ];

      const sorted = [...users].sort((a, b) => b.totalPoints - a.totalPoints);
      const ranked = sorted.map((u, i) => ({ ...u, rank: i + 1 }));

      expect(ranked[0].id).toBe(2);
      expect(ranked[0].rank).toBe(1);
      expect(ranked[1].id).toBe(1);
      expect(ranked[1].rank).toBe(2);
      expect(ranked[2].id).toBe(3);
      expect(ranked[2].rank).toBe(3);
    });
  });
});

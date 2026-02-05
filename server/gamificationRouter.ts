import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { eq, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { userAchievements, userStats } from "../drizzle/schema";

// Achievement definitions - using numeric IDs to match schema
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

// Map code to id for easy lookup
const ACHIEVEMENT_CODE_TO_ID: Record<string, number> = {};
ACHIEVEMENTS.forEach(a => { ACHIEVEMENT_CODE_TO_ID[a.code] = a.id; });

const getDatabase = () => {
  if (!process.env.DATABASE_URL) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not configured" });
  }
  return drizzle(process.env.DATABASE_URL);
};

export const gamificationRouter = router({
  // Get all achievements with user progress
  getAchievements: protectedProcedure.query(async ({ ctx }) => {
    const db = getDatabase();

    const userAchievementsList = await db.select()
      .from(userAchievements)
      .where(eq(userAchievements.userId, ctx.user.id));

    const unlockedIds = new Set(userAchievementsList.map(a => a.achievementId));

    return ACHIEVEMENTS.map(achievement => ({
      ...achievement,
      unlocked: unlockedIds.has(achievement.id),
      unlockedAt: userAchievementsList.find(a => a.achievementId === achievement.id)?.unlockedAt || null,
    }));
  }),

  // Get user stats
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const db = getDatabase();

    const [stats] = await db.select()
      .from(userStats)
      .where(eq(userStats.userId, ctx.user.id))
      .limit(1);

    if (!stats) {
      // Create initial stats
      await db.insert(userStats).values({
        userId: ctx.user.id,
        tasksCompleted: 0,
        projectsCompleted: 0,
        currentStreak: 0,
        longestStreak: 0,
        totalPoints: 0,
        level: 1,
      });

      return {
        tasksCompleted: 0,
        projectsCompleted: 0,
        currentStreak: 0,
        longestStreak: 0,
        totalPoints: 0,
        level: 1,
        nextLevelPoints: 100,
      };
    }

    const level = Math.floor((stats.totalPoints ?? 0) / 100) + 1;
    const nextLevelPoints = level * 100;

    return {
      ...stats,
      level,
      nextLevelPoints,
    };
  }),

  // Get leaderboard
  getLeaderboard: protectedProcedure
    .input(z.object({ limit: z.number().default(10) }))
    .query(async ({ input }) => {
      const db = getDatabase();

      const leaderboard = await db.select({
        odUserId: userStats.userId,
        totalPoints: userStats.totalPoints,
        tasksCompleted: userStats.tasksCompleted,
        currentStreak: userStats.currentStreak,
        level: sql<number>`FLOOR(${userStats.totalPoints} / 100) + 1`,
      })
        .from(userStats)
        .orderBy(desc(userStats.totalPoints))
        .limit(input.limit);

      return leaderboard.map((entry, index) => ({
        odUserId: entry.odUserId,
        totalPoints: entry.totalPoints,
        tasksCompleted: entry.tasksCompleted,
        currentStreak: entry.currentStreak,
        level: entry.level,
        rank: index + 1,
      }));
    }),

  // Check and award achievements (called after task completion)
  checkAchievements: protectedProcedure
    .input(z.object({ trigger: z.enum(["task_completed", "project_completed", "project_created"]) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDatabase();
      const newAchievementCodes: string[] = [];

      // Get current stats
      let [stats] = await db.select()
        .from(userStats)
        .where(eq(userStats.userId, ctx.user.id))
        .limit(1);

      if (!stats) {
        await db.insert(userStats).values({
          userId: ctx.user.id,
          tasksCompleted: 0,
          projectsCompleted: 0,
          currentStreak: 0,
          longestStreak: 0,
          totalPoints: 0,
          level: 1,
        });
        [stats] = await db.select()
          .from(userStats)
          .where(eq(userStats.userId, ctx.user.id))
          .limit(1);
      }

      // Get already unlocked achievements
      const unlockedList = await db.select()
        .from(userAchievements)
        .where(eq(userAchievements.userId, ctx.user.id));
      const unlockedIds = new Set(unlockedList.map(a => a.achievementId));

      // Helper to award achievement by code
      const awardAchievement = async (code: string) => {
        const achievementId = ACHIEVEMENT_CODE_TO_ID[code];
        if (!achievementId || unlockedIds.has(achievementId)) return;
        
        const achievement = ACHIEVEMENTS.find(a => a.code === code);
        if (!achievement) return;

        await db.insert(userAchievements).values({
          userId: ctx.user.id,
          achievementId: achievementId,
          unlockedAt: new Date(),
        });

        await db.update(userStats)
          .set({ totalPoints: sql`${userStats.totalPoints} + ${achievement.points}` })
          .where(eq(userStats.userId, ctx.user.id));

        newAchievementCodes.push(code);
        unlockedIds.add(achievementId);
      };

      if (input.trigger === "task_completed") {
        // Update task count
        await db.update(userStats)
          .set({ tasksCompleted: sql`${userStats.tasksCompleted} + 1` })
          .where(eq(userStats.userId, ctx.user.id));

        const newTaskCount = (stats?.tasksCompleted || 0) + 1;

        // Check task milestones
        if (newTaskCount >= 1) await awardAchievement("first_task");
        if (newTaskCount >= 10) await awardAchievement("task_master_10");
        if (newTaskCount >= 50) await awardAchievement("task_master_50");
        if (newTaskCount >= 100) await awardAchievement("task_master_100");

        // Check time-based achievements
        const hour = new Date().getHours();
        if (hour < 8) await awardAchievement("early_bird");
        if (hour >= 22) await awardAchievement("night_owl");
      }

      if (input.trigger === "project_completed") {
        await db.update(userStats)
          .set({ projectsCompleted: sql`${userStats.projectsCompleted} + 1` })
          .where(eq(userStats.userId, ctx.user.id));

        await awardAchievement("project_complete");
      }

      if (input.trigger === "project_created") {
        await awardAchievement("first_project");
      }

      return {
        newAchievements: newAchievementCodes.map(code => ACHIEVEMENTS.find(a => a.code === code)!),
        totalNewPoints: newAchievementCodes.reduce((sum, code) => {
          const achievement = ACHIEVEMENTS.find(a => a.code === code);
          return sum + (achievement?.points || 0);
        }, 0),
      };
    }),

  // Update streak (called daily)
  updateStreak: protectedProcedure.mutation(async ({ ctx }) => {
    const db = getDatabase();

    const [stats] = await db.select()
      .from(userStats)
      .where(eq(userStats.userId, ctx.user.id))
      .limit(1);

    if (!stats) return { currentStreak: 0 };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastActive = stats.lastActivityDate ? new Date(stats.lastActivityDate) : null;
    if (lastActive) lastActive.setHours(0, 0, 0, 0);

    let newStreak = stats.currentStreak ?? 0;

    if (!lastActive || today.getTime() - lastActive.getTime() > 86400000 * 2) {
      // More than 1 day gap - reset streak
      newStreak = 1;
    } else if (today.getTime() - lastActive.getTime() >= 86400000) {
      // Exactly 1 day - increment streak
      newStreak = (stats.currentStreak ?? 0) + 1;
    }

    const longestStreak = Math.max(stats.longestStreak ?? 0, newStreak);

    await db.update(userStats)
      .set({
        currentStreak: newStreak,
        longestStreak,
        lastActivityDate: today,
      })
      .where(eq(userStats.userId, ctx.user.id));

    // Check streak achievements
    const newAchievementCodes: string[] = [];
    const unlockedList = await db.select()
      .from(userAchievements)
      .where(eq(userAchievements.userId, ctx.user.id));
    const unlockedIds = new Set(unlockedList.map(a => a.achievementId));

    const checkStreakAchievement = async (code: string, required: number) => {
      const achievementId = ACHIEVEMENT_CODE_TO_ID[code];
      if (newStreak >= required && achievementId && !unlockedIds.has(achievementId)) {
        const achievement = ACHIEVEMENTS.find(a => a.code === code);
        if (achievement) {
          await db.insert(userAchievements).values({
            userId: ctx.user.id,
            achievementId: achievementId,
            unlockedAt: new Date(),
          });
          await db.update(userStats)
            .set({ totalPoints: sql`${userStats.totalPoints} + ${achievement.points}` })
            .where(eq(userStats.userId, ctx.user.id));
          newAchievementCodes.push(code);
        }
      }
    };

    await checkStreakAchievement("streak_3", 3);
    await checkStreakAchievement("streak_7", 7);
    await checkStreakAchievement("streak_30", 30);

    return {
      currentStreak: newStreak,
      longestStreak,
      newAchievements: newAchievementCodes.map(code => ACHIEVEMENTS.find(a => a.code === code)!),
    };
  }),

  // Get recent activity for gamification feed
  getRecentActivity: protectedProcedure
    .input(z.object({ limit: z.number().default(10) }))
    .query(async ({ ctx, input }) => {
      const db = getDatabase();

      const recentAchievements = await db.select({
        achievementId: userAchievements.achievementId,
        unlockedAt: userAchievements.unlockedAt,
      })
        .from(userAchievements)
        .where(eq(userAchievements.userId, ctx.user.id))
        .orderBy(desc(userAchievements.unlockedAt))
        .limit(input.limit);

      return recentAchievements.map(a => ({
        type: "achievement_unlocked" as const,
        achievement: ACHIEVEMENTS.find(ach => ach.id === a.achievementId),
        timestamp: a.unlockedAt,
      }));
    }),
});

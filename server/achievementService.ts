import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { userAchievements, userStats } from "../drizzle/schema";

// Achievement definitions
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

export type AchievementTrigger = "task_completed" | "project_completed" | "project_created";

export interface AchievementResult {
  newAchievements: Array<{
    id: number;
    code: string;
    name: string;
    description: string;
    icon: string;
    points: number;
    category: string;
  }>;
  totalNewPoints: number;
}

/**
 * Check and award achievements for a user based on a trigger event.
 * This is a server-side function that can be called from any router.
 */
export async function checkAndAwardAchievements(
  userId: number,
  trigger: AchievementTrigger
): Promise<AchievementResult> {
  if (!process.env.DATABASE_URL) {
    return { newAchievements: [], totalNewPoints: 0 };
  }

  const db = drizzle(process.env.DATABASE_URL);
  const newAchievementCodes: string[] = [];

  // Get current stats
  let [stats] = await db.select()
    .from(userStats)
    .where(eq(userStats.userId, userId))
    .limit(1);

  if (!stats) {
    await db.insert(userStats).values({
      userId: userId,
      tasksCompleted: 0,
      projectsCompleted: 0,
      currentStreak: 0,
      longestStreak: 0,
      totalPoints: 0,
      level: 1,
    });
    [stats] = await db.select()
      .from(userStats)
      .where(eq(userStats.userId, userId))
      .limit(1);
  }

  // Get already unlocked achievements
  const unlockedList = await db.select()
    .from(userAchievements)
    .where(eq(userAchievements.userId, userId));
  const unlockedIds = new Set(unlockedList.map(a => a.achievementId));

  // Helper to award achievement by code
  const awardAchievement = async (code: string) => {
    const achievementId = ACHIEVEMENT_CODE_TO_ID[code];
    if (!achievementId || unlockedIds.has(achievementId)) return;

    const achievement = ACHIEVEMENTS.find(a => a.code === code);
    if (!achievement) return;

    try {
      await db.insert(userAchievements).values({
        userId: userId,
        achievementId: achievementId,
        unlockedAt: new Date(),
      });

      await db.update(userStats)
        .set({ totalPoints: sql`${userStats.totalPoints} + ${achievement.points}` })
        .where(eq(userStats.userId, userId));

      newAchievementCodes.push(code);
      unlockedIds.add(achievementId);
    } catch {
      // Achievement definitions might not be seeded - ignore FK errors
    }
  };

  if (trigger === "task_completed") {
    // Update task count
    await db.update(userStats)
      .set({ tasksCompleted: sql`${userStats.tasksCompleted} + 1` })
      .where(eq(userStats.userId, userId));

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

    // Update streak
    await updateStreak(db, userId);
  }

  if (trigger === "project_completed") {
    await db.update(userStats)
      .set({ projectsCompleted: sql`${userStats.projectsCompleted} + 1` })
      .where(eq(userStats.userId, userId));

    await awardAchievement("project_complete");
  }

  if (trigger === "project_created") {
    await awardAchievement("first_project");
  }

  return {
    newAchievements: newAchievementCodes.map(code => ACHIEVEMENTS.find(a => a.code === code)!),
    totalNewPoints: newAchievementCodes.reduce((sum, code) => {
      const achievement = ACHIEVEMENTS.find(a => a.code === code);
      return sum + (achievement?.points || 0);
    }, 0),
  };
}

/**
 * Update user's streak based on activity
 */
async function updateStreak(db: ReturnType<typeof drizzle>, userId: number): Promise<void> {
  const [stats] = await db.select()
    .from(userStats)
    .where(eq(userStats.userId, userId))
    .limit(1);

  if (!stats) return;

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
  // Same day - keep streak unchanged

  const longestStreak = Math.max(stats.longestStreak ?? 0, newStreak);

  await db.update(userStats)
    .set({
      currentStreak: newStreak,
      longestStreak,
      lastActivityDate: today,
    })
    .where(eq(userStats.userId, userId));
}

export { ACHIEVEMENTS };

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, gte, lte, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { timeEntries, timeGoals, tasks, projects, sections, blocks } from "../drizzle/schema";

// Get database connection
const getDatabase = () => {
  if (!process.env.DATABASE_URL) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not configured" });
  }
  return drizzle(process.env.DATABASE_URL);
};

export const timeTrackingRouter = router({
  // Start timer for a task
  startTimer: protectedProcedure
    .input(z.object({
      taskId: z.number(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDatabase();

      // Check for running timer
      const [runningEntry] = await db.select()
        .from(timeEntries)
        .where(and(eq(timeEntries.userId, ctx.user.id), eq(timeEntries.isRunning, true)))
        .limit(1);

      if (runningEntry) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You already have a running timer. Stop it first." });
      }

      // Get task with project info
      const [task] = await db.select({
        id: tasks.id,
        title: tasks.title,
        projectId: blocks.projectId,
      })
        .from(tasks)
        .innerJoin(sections, eq(tasks.sectionId, sections.id))
        .innerJoin(blocks, eq(sections.blockId, blocks.id))
        .where(eq(tasks.id, input.taskId))
        .limit(1);

      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      if (!task.projectId) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found for task" });

      const [result] = await db.insert(timeEntries).values({
        userId: ctx.user.id,
        taskId: input.taskId,
        projectId: task.projectId,
        startTime: new Date(),
        notes: input.notes || null,
        isRunning: true,
      });

      return { id: result.insertId, started: true };
    }),

  // Stop running timer
  stopTimer: protectedProcedure
    .input(z.object({ entryId: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDatabase();

      const whereClause = input.entryId
        ? and(eq(timeEntries.id, input.entryId), eq(timeEntries.userId, ctx.user.id))
        : and(eq(timeEntries.userId, ctx.user.id), eq(timeEntries.isRunning, true));

      const [entry] = await db.select().from(timeEntries).where(whereClause).limit(1);

      if (!entry) throw new TRPCError({ code: "NOT_FOUND", message: "No running timer found" });

      const endTime = new Date();
      const duration = Math.floor((endTime.getTime() - entry.startTime.getTime()) / 1000);

      await db.update(timeEntries)
        .set({ endTime, duration, isRunning: false })
        .where(eq(timeEntries.id, entry.id));

      return { id: entry.id, duration, stopped: true };
    }),

  // Get currently running timer
  getRunningTimer: protectedProcedure.query(async ({ ctx }) => {
    const db = getDatabase();

    const [entry] = await db.select({
      id: timeEntries.id,
      taskId: timeEntries.taskId,
      projectId: timeEntries.projectId,
      startTime: timeEntries.startTime,
      notes: timeEntries.notes,
      taskTitle: tasks.title,
    })
      .from(timeEntries)
      .leftJoin(tasks, eq(timeEntries.taskId, tasks.id))
      .where(and(eq(timeEntries.userId, ctx.user.id), eq(timeEntries.isRunning, true)))
      .limit(1);

    if (!entry) return null;

    return {
      ...entry,
      taskTitle: entry.taskTitle || "Unknown Task",
      elapsedSeconds: Math.floor((Date.now() - entry.startTime.getTime()) / 1000),
    };
  }),

  // Add manual time entry
  addManualEntry: protectedProcedure
    .input(z.object({
      taskId: z.number(),
      startTime: z.string(),
      endTime: z.string(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDatabase();

      const [task] = await db.select({
        id: tasks.id,
        projectId: blocks.projectId,
      })
        .from(tasks)
        .innerJoin(sections, eq(tasks.sectionId, sections.id))
        .innerJoin(blocks, eq(sections.blockId, blocks.id))
        .where(eq(tasks.id, input.taskId))
        .limit(1);

      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      if (!task.projectId) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });

      const startTime = new Date(input.startTime);
      const endTime = new Date(input.endTime);
      const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

      const [result] = await db.insert(timeEntries).values({
        userId: ctx.user.id,
        taskId: input.taskId,
        projectId: task.projectId,
        startTime,
        endTime,
        duration,
        notes: input.notes || null,
        isRunning: false,
      });

      return { id: result.insertId };
    }),

  // Get time entries with filters
  getEntries: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
      taskId: z.number().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      const db = getDatabase();

      const conditions = [eq(timeEntries.userId, ctx.user.id)];
      if (input.projectId) conditions.push(eq(timeEntries.projectId, input.projectId));
      if (input.taskId) conditions.push(eq(timeEntries.taskId, input.taskId));
      if (input.startDate) conditions.push(gte(timeEntries.startTime, new Date(input.startDate)));
      if (input.endDate) conditions.push(lte(timeEntries.startTime, new Date(input.endDate)));

      const entries = await db.select({
        id: timeEntries.id,
        taskId: timeEntries.taskId,
        projectId: timeEntries.projectId,
        startTime: timeEntries.startTime,
        endTime: timeEntries.endTime,
        duration: timeEntries.duration,
        notes: timeEntries.notes,
        isRunning: timeEntries.isRunning,
        taskTitle: tasks.title,
        projectName: projects.name,
      })
        .from(timeEntries)
        .leftJoin(tasks, eq(timeEntries.taskId, tasks.id))
        .leftJoin(projects, eq(timeEntries.projectId, projects.id))
        .where(and(...conditions))
        .orderBy(desc(timeEntries.startTime))
        .limit(input.limit);

      return entries.map(e => ({
        ...e,
        taskTitle: e.taskTitle || "Unknown",
        projectName: e.projectName || "Unknown",
      }));
    }),

  // Get weekly timesheet
  getWeeklyTimesheet: protectedProcedure
    .input(z.object({ weekStart: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = getDatabase();

      const weekStart = new Date(input.weekStart);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const entries = await db.select()
        .from(timeEntries)
        .where(and(
          eq(timeEntries.userId, ctx.user.id),
          gte(timeEntries.startTime, weekStart),
          lte(timeEntries.startTime, weekEnd),
          eq(timeEntries.isRunning, false)
        ));

      const dayMap = new Map<string, number>();
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + i);
        dayMap.set(date.toISOString().split("T")[0], 0);
      }

      let totalSeconds = 0;
      for (const entry of entries) {
        const key = entry.startTime.toISOString().split("T")[0];
        dayMap.set(key, (dayMap.get(key) || 0) + (entry.duration || 0));
        totalSeconds += entry.duration || 0;
      }

      const days = Array.from(dayMap.entries()).map(([date, seconds]) => ({
        date,
        dayName: dayNames[new Date(date).getDay()],
        seconds,
        hours: Math.round((seconds / 3600) * 10) / 10,
      }));

      return { days, totalSeconds };
    }),

  // Get productivity statistics
  getProductivityStats: protectedProcedure
    .input(z.object({ period: z.enum(["day", "week", "month"]).default("week") }))
    .query(async ({ ctx, input }) => {
      const db = getDatabase();

      const now = new Date();
      let startDate: Date;

      switch (input.period) {
        case "day":
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case "week":
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 7);
          break;
        case "month":
          startDate = new Date(now);
          startDate.setMonth(startDate.getMonth() - 1);
          break;
      }

      const entries = await db.select({
        id: timeEntries.id,
        projectId: timeEntries.projectId,
        duration: timeEntries.duration,
        projectName: projects.name,
      })
        .from(timeEntries)
        .leftJoin(projects, eq(timeEntries.projectId, projects.id))
        .where(and(
          eq(timeEntries.userId, ctx.user.id),
          gte(timeEntries.startTime, startDate),
          eq(timeEntries.isRunning, false)
        ));

      const totalSeconds = entries.reduce((sum, e) => sum + (e.duration || 0), 0);
      const totalHours = Math.round((totalSeconds / 3600) * 10) / 10;
      const avgPerDay = input.period === "day" ? totalHours : totalHours / (input.period === "week" ? 7 : 30);

      const projectMap = new Map<number, { seconds: number; name: string }>();
      for (const entry of entries) {
        const existing = projectMap.get(entry.projectId) || { seconds: 0, name: entry.projectName || "Unknown" };
        existing.seconds += entry.duration || 0;
        projectMap.set(entry.projectId, existing);
      }

      const projectStats = Array.from(projectMap.entries()).map(([projectId, data]) => ({
        projectId,
        projectName: data.name,
        seconds: data.seconds,
        hours: Math.round((data.seconds / 3600) * 10) / 10,
        percentage: totalSeconds > 0 ? Math.round((data.seconds / totalSeconds) * 100) : 0,
      })).sort((a, b) => b.seconds - a.seconds);

      return {
        totalSeconds,
        totalHours,
        avgPerDay: Math.round(avgPerDay * 10) / 10,
        entriesCount: entries.length,
        projectStats,
      };
    }),

  // Delete time entry
  deleteEntry: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDatabase();

      const [entry] = await db.select()
        .from(timeEntries)
        .where(and(eq(timeEntries.id, input.id), eq(timeEntries.userId, ctx.user.id)))
        .limit(1);

      if (!entry) throw new TRPCError({ code: "NOT_FOUND", message: "Time entry not found" });

      await db.delete(timeEntries).where(eq(timeEntries.id, input.id));
      return { deleted: true };
    }),

  // Set time goal
  setGoal: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
      targetHours: z.number().min(1).max(24),
      period: z.enum(["daily", "weekly", "monthly"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDatabase();

      // Deactivate existing goals for same scope
      const deactivateConditions = [
        eq(timeGoals.userId, ctx.user.id),
        eq(timeGoals.period, input.period),
      ];
      if (input.projectId) {
        deactivateConditions.push(eq(timeGoals.projectId, input.projectId));
      } else {
        deactivateConditions.push(isNull(timeGoals.projectId));
      }

      await db.update(timeGoals)
        .set({ isActive: false })
        .where(and(...deactivateConditions));

      const [result] = await db.insert(timeGoals).values({
        userId: ctx.user.id,
        projectId: input.projectId || null,
        targetHours: input.targetHours,
        period: input.period,
        isActive: true,
      });

      return { id: result.insertId };
    }),

  // Get active goals
  getGoals: protectedProcedure.query(async ({ ctx }) => {
    const db = getDatabase();

    return await db.select()
      .from(timeGoals)
      .where(and(eq(timeGoals.userId, ctx.user.id), eq(timeGoals.isActive, true)));
  }),
});

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { projects, blocks, sections, tasks, subtasks, activityLog } from "../drizzle/schema";
import { eq, and, gte, lte, desc, sql, count } from "drizzle-orm";

// Helper to get week number
const getWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

// Helper to format week label
const formatWeekLabel = (date: Date): string => {
  const weekNum = getWeekNumber(date);
  return `W${weekNum} ${date.getFullYear()}`;
};

export const analyticsRouter = router({
  // Get burnup chart data
  getBurnupData: protectedProcedure
    .input(z.object({ 
      projectId: z.number(),
      weeks: z.number().default(12) // Last N weeks
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Verify project access
      const [project] = await db.select().from(projects)
        .where(and(
          eq(projects.id, input.projectId),
          eq(projects.userId, ctx.user.id)
        ));
      
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      
      // Get all tasks for project
      const projectBlocks = await db.select({ id: blocks.id })
        .from(blocks)
        .where(eq(blocks.projectId, input.projectId));
      
      const blockIds = projectBlocks.map(b => b.id);
      
      if (blockIds.length === 0) {
        return { data: [], totalScope: 0 };
      }
      
      const projectSections = await db.select({ id: sections.id })
        .from(sections)
        .where(sql`${sections.blockId} IN (${sql.join(blockIds.map(id => sql`${id}`), sql`, `)})`);
      
      const sectionIds = projectSections.map(s => s.id);
      
      if (sectionIds.length === 0) {
        return { data: [], totalScope: 0 };
      }
      
      // Get all tasks with their completion status
      const allTasks = await db.select({
        id: tasks.id,
        status: tasks.status,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
      }).from(tasks)
        .where(sql`${tasks.sectionId} IN (${sql.join(sectionIds.map(id => sql`${id}`), sql`, `)})`);
      
      const totalScope = allTasks.length;
      const completedTasks = allTasks.filter(t => t.status === "completed");
      
      // Generate weekly data points
      const now = new Date();
      const data: Array<{ week: string; date: string; completed: number; scope: number }> = [];
      
      for (let i = input.weeks - 1; i >= 0; i--) {
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() - (i * 7));
        weekEnd.setHours(23, 59, 59, 999);
        
        // Count tasks completed by this date
        const completedByDate = completedTasks.filter(t => {
          const updatedAt = t.updatedAt ? new Date(t.updatedAt) : null;
          return updatedAt && updatedAt <= weekEnd;
        }).length;
        
        // Count tasks created by this date (scope)
        const scopeByDate = allTasks.filter(t => {
          const createdAt = t.createdAt ? new Date(t.createdAt) : null;
          return createdAt && createdAt <= weekEnd;
        }).length;
        
        data.push({
          week: formatWeekLabel(weekEnd),
          date: weekEnd.toISOString().split('T')[0],
          completed: completedByDate,
          scope: scopeByDate,
        });
      }
      
      return { data, totalScope };
    }),
  
  // Get velocity data (tasks completed per week)
  getVelocityData: protectedProcedure
    .input(z.object({ 
      projectId: z.number(),
      weeks: z.number().default(8)
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Get activity log for completed tasks
      const activities = await db.select({
        createdAt: activityLog.createdAt,
        action: activityLog.action,
      }).from(activityLog)
        .where(and(
          eq(activityLog.projectId, input.projectId),
          eq(activityLog.action, "task_completed")
        ))
        .orderBy(activityLog.createdAt);
      
      // Group by week
      const now = new Date();
      const data: Array<{ week: string; completed: number; average: number }> = [];
      let totalCompleted = 0;
      
      for (let i = input.weeks - 1; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - ((i + 1) * 7));
        weekStart.setHours(0, 0, 0, 0);
        
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() - (i * 7));
        weekEnd.setHours(23, 59, 59, 999);
        
        const weekCompleted = activities.filter(a => {
          const date = new Date(a.createdAt);
          return date >= weekStart && date <= weekEnd;
        }).length;
        
        totalCompleted += weekCompleted;
        const weekIndex = input.weeks - i;
        
        data.push({
          week: formatWeekLabel(weekEnd),
          completed: weekCompleted,
          average: Math.round((totalCompleted / weekIndex) * 10) / 10,
        });
      }
      
      // Calculate average velocity
      const avgVelocity = data.length > 0 
        ? Math.round((totalCompleted / data.length) * 10) / 10 
        : 0;
      
      return { data, avgVelocity, totalCompleted };
    }),
  
  // Get completion rate by blocks
  getBlockCompletionRates: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Get all blocks
      const projectBlocks = await db.select({
        id: blocks.id,
        title: blocks.title,
        number: blocks.number,
      }).from(blocks)
        .where(eq(blocks.projectId, input.projectId))
        .orderBy(blocks.sortOrder);
      
      const data: Array<{
        id: number;
        title: string;
        number: number;
        total: number;
        completed: number;
        inProgress: number;
        notStarted: number;
        rate: number;
      }> = [];
      
      for (const block of projectBlocks) {
        // Get sections for this block
        const blockSections = await db.select({ id: sections.id })
          .from(sections)
          .where(eq(sections.blockId, block.id));
        
        const sectionIds = blockSections.map(s => s.id);
        
        if (sectionIds.length === 0) {
          data.push({
            id: block.id,
            title: block.title,
            number: block.number,
            total: 0,
            completed: 0,
            inProgress: 0,
            notStarted: 0,
            rate: 0,
          });
          continue;
        }
        
        // Get tasks for these sections
        const blockTasks = await db.select({
          status: tasks.status,
        }).from(tasks)
          .where(sql`${tasks.sectionId} IN (${sql.join(sectionIds.map(id => sql`${id}`), sql`, `)})`);
        
        const total = blockTasks.length;
        const completed = blockTasks.filter(t => t.status === "completed").length;
        const inProgress = blockTasks.filter(t => t.status === "in_progress").length;
        const notStarted = blockTasks.filter(t => t.status === "not_started").length;
        
        data.push({
          id: block.id,
          title: block.title,
          number: block.number,
          total,
          completed,
          inProgress,
          notStarted,
          rate: total > 0 ? Math.round((completed / total) * 100) : 0,
        });
      }
      
      return data;
    }),
  
  // Get projected completion date
  getProjectedCompletion: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Get project
      const [project] = await db.select().from(projects)
        .where(eq(projects.id, input.projectId));
      
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      
      // Get all tasks
      const projectBlocks = await db.select({ id: blocks.id })
        .from(blocks)
        .where(eq(blocks.projectId, input.projectId));
      
      const blockIds = projectBlocks.map(b => b.id);
      
      if (blockIds.length === 0) {
        return { 
          projectedDate: null, 
          remainingTasks: 0, 
          avgVelocity: 0,
          weeksRemaining: 0,
          targetDate: project.targetDate,
          onTrack: true
        };
      }
      
      const projectSections = await db.select({ id: sections.id })
        .from(sections)
        .where(sql`${sections.blockId} IN (${sql.join(blockIds.map(id => sql`${id}`), sql`, `)})`);
      
      const sectionIds = projectSections.map(s => s.id);
      
      if (sectionIds.length === 0) {
        return { 
          projectedDate: null, 
          remainingTasks: 0, 
          avgVelocity: 0,
          weeksRemaining: 0,
          targetDate: project.targetDate,
          onTrack: true
        };
      }
      
      const allTasks = await db.select({ status: tasks.status })
        .from(tasks)
        .where(sql`${tasks.sectionId} IN (${sql.join(sectionIds.map(id => sql`${id}`), sql`, `)})`);
      
      const remainingTasks = allTasks.filter(t => t.status !== "completed").length;
      
      // Calculate velocity from last 4 weeks
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
      
      const recentCompletions = await db.select()
        .from(activityLog)
        .where(and(
          eq(activityLog.projectId, input.projectId),
          eq(activityLog.action, "task_completed"),
          gte(activityLog.createdAt, fourWeeksAgo)
        ));
      
      const avgVelocity = recentCompletions.length / 4; // tasks per week
      
      // Calculate projected completion
      let projectedDate: Date | null = null;
      let weeksRemaining = 0;
      
      if (avgVelocity > 0 && remainingTasks > 0) {
        weeksRemaining = Math.ceil(remainingTasks / avgVelocity);
        projectedDate = new Date();
        projectedDate.setDate(projectedDate.getDate() + (weeksRemaining * 7));
      }
      
      // Check if on track
      const onTrack = project.targetDate 
        ? (projectedDate ? projectedDate <= project.targetDate : true)
        : true;
      
      return {
        projectedDate,
        remainingTasks,
        avgVelocity: Math.round(avgVelocity * 10) / 10,
        weeksRemaining,
        targetDate: project.targetDate,
        onTrack,
      };
    }),
  
  // Get priority distribution
  getPriorityDistribution: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Get all tasks for project
      const projectBlocks = await db.select({ id: blocks.id })
        .from(blocks)
        .where(eq(blocks.projectId, input.projectId));
      
      const blockIds = projectBlocks.map(b => b.id);
      
      if (blockIds.length === 0) {
        return [
          { priority: "critical", count: 0, color: "#ef4444" },
          { priority: "high", count: 0, color: "#f97316" },
          { priority: "medium", count: 0, color: "#eab308" },
          { priority: "low", count: 0, color: "#22c55e" },
        ];
      }
      
      const projectSections = await db.select({ id: sections.id })
        .from(sections)
        .where(sql`${sections.blockId} IN (${sql.join(blockIds.map(id => sql`${id}`), sql`, `)})`);
      
      const sectionIds = projectSections.map(s => s.id);
      
      if (sectionIds.length === 0) {
        return [
          { priority: "critical", count: 0, color: "#ef4444" },
          { priority: "high", count: 0, color: "#f97316" },
          { priority: "medium", count: 0, color: "#eab308" },
          { priority: "low", count: 0, color: "#22c55e" },
        ];
      }
      
      const allTasks = await db.select({ priority: tasks.priority })
        .from(tasks)
        .where(sql`${tasks.sectionId} IN (${sql.join(sectionIds.map(id => sql`${id}`), sql`, `)})`);
      
      const priorityCounts = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      };
      
      allTasks.forEach(t => {
        const p = t.priority || "medium";
        if (p in priorityCounts) {
          priorityCounts[p as keyof typeof priorityCounts]++;
        }
      });
      
      return [
        { priority: "critical", label: "Критический", count: priorityCounts.critical, color: "#ef4444" },
        { priority: "high", label: "Высокий", count: priorityCounts.high, color: "#f97316" },
        { priority: "medium", label: "Средний", count: priorityCounts.medium, color: "#eab308" },
        { priority: "low", label: "Низкий", count: priorityCounts.low, color: "#22c55e" },
      ];
    }),
  
  // Get task completion time histogram
  getCompletionTimeHistogram: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Get completed tasks with timestamps
      const projectBlocks = await db.select({ id: blocks.id })
        .from(blocks)
        .where(eq(blocks.projectId, input.projectId));
      
      const blockIds = projectBlocks.map(b => b.id);
      
      if (blockIds.length === 0) {
        return { data: [], avgDays: 0 };
      }
      
      const projectSections = await db.select({ id: sections.id })
        .from(sections)
        .where(sql`${sections.blockId} IN (${sql.join(blockIds.map(id => sql`${id}`), sql`, `)})`);
      
      const sectionIds = projectSections.map(s => s.id);
      
      if (sectionIds.length === 0) {
        return { data: [], avgDays: 0 };
      }
      
      const completedTasks = await db.select({
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
      }).from(tasks)
        .where(and(
          sql`${tasks.sectionId} IN (${sql.join(sectionIds.map(id => sql`${id}`), sql`, `)})`,
          eq(tasks.status, "completed")
        ));
      
      // Calculate completion times in days
      const completionTimes: number[] = [];
      
      completedTasks.forEach(t => {
        if (t.createdAt && t.updatedAt) {
          const created = new Date(t.createdAt);
          const updated = new Date(t.updatedAt);
          const days = Math.ceil((updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
          if (days >= 0) {
            completionTimes.push(days);
          }
        }
      });
      
      // Create histogram buckets
      const buckets = [
        { range: "0-1", label: "0-1 дн", min: 0, max: 1, count: 0 },
        { range: "2-3", label: "2-3 дн", min: 2, max: 3, count: 0 },
        { range: "4-7", label: "4-7 дн", min: 4, max: 7, count: 0 },
        { range: "8-14", label: "1-2 нед", min: 8, max: 14, count: 0 },
        { range: "15-30", label: "2-4 нед", min: 15, max: 30, count: 0 },
        { range: "31+", label: "1+ мес", min: 31, max: Infinity, count: 0 },
      ];
      
      completionTimes.forEach(days => {
        for (const bucket of buckets) {
          if (days >= bucket.min && days <= bucket.max) {
            bucket.count++;
            break;
          }
        }
      });
      
      const avgDays = completionTimes.length > 0
        ? Math.round((completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length) * 10) / 10
        : 0;
      
      return { 
        data: buckets.map(b => ({ range: b.range, label: b.label, count: b.count })),
        avgDays,
        totalCompleted: completionTimes.length
      };
    }),
  
  // Get plan vs actual comparison
  getPlanVsActual: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Get blocks with deadlines
      const projectBlocks = await db.select({
        id: blocks.id,
        title: blocks.title,
        number: blocks.number,
        deadline: blocks.deadline,
      }).from(blocks)
        .where(eq(blocks.projectId, input.projectId))
        .orderBy(blocks.sortOrder);
      
      const data: Array<{
        block: string;
        number: number;
        plannedDate: Date | null;
        actualDate: Date | null;
        status: "completed" | "on_track" | "delayed" | "at_risk";
        daysVariance: number;
      }> = [];
      
      for (const block of projectBlocks) {
        // Get sections and tasks for this block
        const blockSections = await db.select({ id: sections.id })
          .from(sections)
          .where(eq(sections.blockId, block.id));
        
        const sectionIds = blockSections.map(s => s.id);
        
        let allCompleted = false;
        let lastCompletedDate: Date | null = null;
        
        if (sectionIds.length > 0) {
          const blockTasks = await db.select({
            status: tasks.status,
            updatedAt: tasks.updatedAt,
          }).from(tasks)
            .where(sql`${tasks.sectionId} IN (${sql.join(sectionIds.map(id => sql`${id}`), sql`, `)})`);
          
          allCompleted = blockTasks.length > 0 && blockTasks.every(t => t.status === "completed");
          
          if (allCompleted) {
            // Find the latest completion date
            const completedDates = blockTasks
              .filter(t => t.updatedAt)
              .map(t => new Date(t.updatedAt!));
            
            if (completedDates.length > 0) {
              lastCompletedDate = new Date(Math.max(...completedDates.map(d => d.getTime())));
            }
          }
        }
        
        let status: "completed" | "on_track" | "delayed" | "at_risk" = "on_track";
        let daysVariance = 0;
        
        if (allCompleted && lastCompletedDate) {
          status = "completed";
          if (block.deadline) {
            daysVariance = Math.ceil((lastCompletedDate.getTime() - new Date(block.deadline).getTime()) / (1000 * 60 * 60 * 24));
          }
        } else if (block.deadline) {
          const deadline = new Date(block.deadline);
          const now = new Date();
          daysVariance = Math.ceil((now.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysVariance > 0) {
            status = "delayed";
          } else if (daysVariance > -7) {
            status = "at_risk";
          }
        }
        
        data.push({
          block: block.title,
          number: block.number,
          plannedDate: block.deadline,
          actualDate: lastCompletedDate,
          status,
          daysVariance,
        });
      }
      
      return data;
    }),
  
  // Get top 5 longest tasks
  getTopLongestTasks: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Get all tasks for project
      const projectBlocks = await db.select({ id: blocks.id })
        .from(blocks)
        .where(eq(blocks.projectId, input.projectId));
      
      const blockIds = projectBlocks.map(b => b.id);
      
      if (blockIds.length === 0) {
        return [];
      }
      
      const projectSections = await db.select({ id: sections.id })
        .from(sections)
        .where(sql`${sections.blockId} IN (${sql.join(blockIds.map(id => sql`${id}`), sql`, `)})`);
      
      const sectionIds = projectSections.map(s => s.id);
      
      if (sectionIds.length === 0) {
        return [];
      }
      
      const allTasks = await db.select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
      }).from(tasks)
        .where(sql`${tasks.sectionId} IN (${sql.join(sectionIds.map(id => sql`${id}`), sql`, `)})`);
      
      // Calculate duration for each task
      const tasksWithDuration = allTasks.map(t => {
        let days = 0;
        if (t.createdAt) {
          const created = new Date(t.createdAt);
          const end = t.status === "completed" && t.updatedAt 
            ? new Date(t.updatedAt) 
            : new Date();
          days = Math.ceil((end.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        }
        return { ...t, days };
      });
      
      // Sort by duration and take top 5
      return tasksWithDuration
        .sort((a, b) => b.days - a.days)
        .slice(0, 5)
        .map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          days: t.days,
        }));
    }),
  
  // Get full analytics summary for export
  getFullAnalytics: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Get project
      const [project] = await db.select().from(projects)
        .where(eq(projects.id, input.projectId));
      
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      
      // Get all blocks
      const projectBlocks = await db.select().from(blocks)
        .where(eq(blocks.projectId, input.projectId))
        .orderBy(blocks.sortOrder);
      
      // Get all sections
      const blockIds = projectBlocks.map(b => b.id);
      let allSections: any[] = [];
      let allTasks: any[] = [];
      
      if (blockIds.length > 0) {
        allSections = await db.select().from(sections)
          .where(sql`${sections.blockId} IN (${sql.join(blockIds.map(id => sql`${id}`), sql`, `)})`);
        
        const sectionIds = allSections.map(s => s.id);
        
        if (sectionIds.length > 0) {
          allTasks = await db.select().from(tasks)
            .where(sql`${tasks.sectionId} IN (${sql.join(sectionIds.map(id => sql`${id}`), sql`, `)})`);
        }
      }
      
      // Calculate summary stats
      const totalTasks = allTasks.length;
      const completedTasks = allTasks.filter(t => t.status === "completed").length;
      const inProgressTasks = allTasks.filter(t => t.status === "in_progress").length;
      const notStartedTasks = allTasks.filter(t => t.status === "not_started").length;
      const overdueTasks = allTasks.filter(t => {
        if (!t.deadline) return false;
        return new Date(t.deadline) < new Date() && t.status !== "completed";
      }).length;
      
      return {
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          createdAt: project.createdAt,
          targetDate: project.targetDate,
        },
        summary: {
          totalBlocks: projectBlocks.length,
          totalSections: allSections.length,
          totalTasks,
          completedTasks,
          inProgressTasks,
          notStartedTasks,
          overdueTasks,
          completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        },
        blocks: projectBlocks.map(b => ({
          id: b.id,
          number: b.number,
          title: b.title,
          deadline: b.deadline,
        })),
      };
    }),
});

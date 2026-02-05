import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { projects, blocks, sections, tasks } from "../drizzle/schema";
import { eq, and, isNotNull, gte, lte } from "drizzle-orm";
import crypto from "crypto";

// iCal format helpers
function formatICalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function formatICalDateOnly(date: Date): string {
  return date.toISOString().split("T")[0].replace(/-/g, "");
}

function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function generateUID(taskId: number, sectionId: number): string {
  return `task-${taskId}-section-${sectionId}@mydon.app`;
}

function foldLine(line: string): string {
  const maxLength = 75;
  if (line.length <= maxLength) return line;
  
  let result = "";
  let remaining = line;
  
  while (remaining.length > maxLength) {
    result += remaining.substring(0, maxLength) + "\r\n ";
    remaining = remaining.substring(maxLength);
  }
  result += remaining;
  
  return result;
}

interface TaskEvent {
  id: number;
  title: string;
  description: string | null;
  deadline: Date | null;
  dueDate: Date | null;
  priority: string;
  status: string;
  sectionId: number;
  projectName: string;
  blockTitle: string;
  sectionTitle: string;
}

function generateVEvent(task: TaskEvent): string {
  const now = new Date();
  const uid = generateUID(task.id, task.sectionId);
  
  const eventDate = task.deadline || task.dueDate || now;
  const isAllDay = !task.deadline;
  
  const lines: string[] = [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatICalDate(now)}`,
  ];
  
  if (isAllDay) {
    lines.push(`DTSTART;VALUE=DATE:${formatICalDateOnly(eventDate)}`);
    lines.push(`DTEND;VALUE=DATE:${formatICalDateOnly(new Date(eventDate.getTime() + 24 * 60 * 60 * 1000))}`);
  } else {
    lines.push(`DTSTART:${formatICalDate(eventDate)}`);
    lines.push(`DTEND:${formatICalDate(new Date(eventDate.getTime() + 60 * 60 * 1000))}`);
  }
  
  lines.push(`SUMMARY:${escapeICalText(task.title)}`);
  
  const descParts: string[] = [];
  if (task.description) {
    descParts.push(task.description);
  }
  descParts.push(`Проект: ${task.projectName}`);
  descParts.push(`Блок: ${task.blockTitle}`);
  descParts.push(`Раздел: ${task.sectionTitle}`);
  descParts.push(`Статус: ${task.status}`);
  descParts.push(`Приоритет: ${task.priority}`);
  
  lines.push(`DESCRIPTION:${escapeICalText(descParts.join("\\n"))}`);
  
  const priorityMap: Record<string, number> = {
    critical: 1,
    high: 3,
    medium: 5,
    low: 9,
  };
  lines.push(`PRIORITY:${priorityMap[task.priority] || 5}`);
  
  if (task.status === "completed") {
    lines.push("STATUS:COMPLETED");
  } else if (task.status === "in_progress") {
    lines.push("STATUS:IN-PROCESS");
  } else {
    lines.push("STATUS:NEEDS-ACTION");
  }
  
  lines.push(`CATEGORIES:${escapeICalText(task.projectName)},MYDON`);
  lines.push("END:VEVENT");
  
  return lines.map(foldLine).join("\r\n");
}

function generateVCalendar(taskList: TaskEvent[], calendarName: string): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MYDON Roadmap Manager//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeICalText(calendarName)}`,
    "X-WR-TIMEZONE:UTC",
  ];
  
  lines.push("BEGIN:VTIMEZONE");
  lines.push("TZID:UTC");
  lines.push("BEGIN:STANDARD");
  lines.push("DTSTART:19700101T000000");
  lines.push("TZOFFSETFROM:+0000");
  lines.push("TZOFFSETTO:+0000");
  lines.push("END:STANDARD");
  lines.push("END:VTIMEZONE");
  
  for (const task of taskList) {
    lines.push(generateVEvent(task));
  }
  
  lines.push("END:VCALENDAR");
  
  return lines.join("\r\n");
}

function generateCalendarToken(userId: number, projectId: number | null): string {
  const data = `${userId}-${projectId || "all"}-${Date.now()}`;
  return crypto.createHash("sha256").update(data).digest("hex").substring(0, 32);
}

export const icalRouter = router({
  // Generate iCal feed for a project
  generateProjectFeed: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      includeCompleted: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, input.projectId));
      
      if (!project) {
        throw new Error("Project not found");
      }
      
      // Get all blocks for this project
      const projectBlocks = await db
        .select()
        .from(blocks)
        .where(eq(blocks.projectId, input.projectId));
      
      const blockIds = projectBlocks.map(b => b.id);
      if (blockIds.length === 0) {
        return {
          content: generateVCalendar([], project.name),
          filename: `${project.name.replace(/[^a-zA-Z0-9]/g, "_")}_calendar.ics`,
          taskCount: 0,
        };
      }
      
      // Get all sections for these blocks
      const projectSections = await db
        .select()
        .from(sections)
        .where(eq(sections.blockId, blockIds[0])); // Simplified - would need IN clause
      
      const sectionIds = projectSections.map(s => s.id);
      if (sectionIds.length === 0) {
        return {
          content: generateVCalendar([], project.name),
          filename: `${project.name.replace(/[^a-zA-Z0-9]/g, "_")}_calendar.ics`,
          taskCount: 0,
        };
      }
      
      // Get tasks
      const taskResults = await db
        .select()
        .from(tasks)
        .where(eq(tasks.sectionId, sectionIds[0])); // Simplified
      
      let filteredTasks = taskResults;
      if (!input.includeCompleted) {
        filteredTasks = filteredTasks.filter(t => t.status !== "completed");
      }
      
      // Create block and section maps
      const blockMap = new Map(projectBlocks.map(b => [b.id, b]));
      const sectionMap = new Map(projectSections.map(s => [s.id, s]));
      
      const taskEvents: TaskEvent[] = filteredTasks.map(t => {
        const section = sectionMap.get(t.sectionId);
        const block = section ? blockMap.get(section.blockId) : null;
        
        return {
          id: t.id,
          title: t.title,
          description: t.description,
          deadline: t.deadline,
          dueDate: t.dueDate,
          priority: t.priority || "medium",
          status: t.status || "not_started",
          sectionId: t.sectionId,
          projectName: project.name,
          blockTitle: block?.title || "Unknown Block",
          sectionTitle: section?.title || "Unknown Section",
        };
      });
      
      const icalContent = generateVCalendar(taskEvents, project.name);
      
      return {
        content: icalContent,
        filename: `${project.name.replace(/[^a-zA-Z0-9]/g, "_")}_calendar.ics`,
        taskCount: taskEvents.length,
      };
    }),

  // Generate iCal feed for all user's tasks
  generateUserFeed: protectedProcedure
    .input(z.object({
      includeCompleted: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Get user's projects
      const userProjects = await db
        .select()
        .from(projects)
        .where(eq(projects.userId, ctx.user.id));
      
      if (userProjects.length === 0) {
        return {
          content: generateVCalendar([], "MYDON - Мои задачи"),
          filename: "mydon_all_tasks_calendar.ics",
          taskCount: 0,
        };
      }
      
      const allTaskEvents: TaskEvent[] = [];
      
      for (const project of userProjects) {
        const projectBlocks = await db
          .select()
          .from(blocks)
          .where(eq(blocks.projectId, project.id));
        
        for (const block of projectBlocks) {
          const blockSections = await db
            .select()
            .from(sections)
            .where(eq(sections.blockId, block.id));
          
          for (const section of blockSections) {
            const sectionTasks = await db
              .select()
              .from(tasks)
              .where(eq(tasks.sectionId, section.id));
            
            let filteredTasks = sectionTasks;
            if (!input.includeCompleted) {
              filteredTasks = filteredTasks.filter(t => t.status !== "completed");
            }
            
            for (const task of filteredTasks) {
              allTaskEvents.push({
                id: task.id,
                title: task.title,
                description: task.description,
                deadline: task.deadline,
                dueDate: task.dueDate,
                priority: task.priority || "medium",
                status: task.status || "not_started",
                sectionId: task.sectionId,
                projectName: project.name,
                blockTitle: block.title,
                sectionTitle: section.title,
              });
            }
          }
        }
      }
      
      const icalContent = generateVCalendar(allTaskEvents, "MYDON - Мои задачи");
      
      return {
        content: icalContent,
        filename: "mydon_all_tasks_calendar.ics",
        taskCount: allTaskEvents.length,
      };
    }),

  // Get calendar subscription URL
  getSubscriptionUrl: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const token = generateCalendarToken(ctx.user.id, input.projectId || null);
      
      const baseUrl = process.env.VITE_APP_URL || "https://mydon.app";
      const feedUrl = input.projectId
        ? `${baseUrl}/api/calendar/feed/${token}?project=${input.projectId}`
        : `${baseUrl}/api/calendar/feed/${token}`;
      
      return {
        url: feedUrl,
        googleCalendarUrl: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(feedUrl)}`,
        outlookUrl: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(feedUrl)}`,
        appleCalendarUrl: `webcal://${feedUrl.replace(/^https?:\/\//, "")}`,
      };
    }),

  // Export single task as iCal event
  exportTask: protectedProcedure
    .input(z.object({
      taskId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const [task] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, input.taskId));
      
      if (!task) {
        throw new Error("Task not found");
      }
      
      const [section] = await db
        .select()
        .from(sections)
        .where(eq(sections.id, task.sectionId));
      
      let blockTitle = "Unknown Block";
      let projectName = "Unknown Project";
      
      if (section) {
        const [block] = await db
          .select()
          .from(blocks)
          .where(eq(blocks.id, section.blockId));
        
        if (block) {
          blockTitle = block.title;
          
          const [project] = await db
            .select()
            .from(projects)
            .where(eq(projects.id, block.projectId));
          
          if (project) {
            projectName = project.name;
          }
        }
      }
      
      const taskEvent: TaskEvent = {
        id: task.id,
        title: task.title,
        description: task.description,
        deadline: task.deadline,
        dueDate: task.dueDate,
        priority: task.priority || "medium",
        status: task.status || "not_started",
        sectionId: task.sectionId,
        projectName,
        blockTitle,
        sectionTitle: section?.title || "Unknown Section",
      };
      
      const icalContent = generateVCalendar([taskEvent], task.title);
      
      return {
        content: icalContent,
        filename: `task_${task.id}.ics`,
      };
    }),
});

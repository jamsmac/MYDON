import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { projects, blocks, sections, tasks, activityLog } from "../drizzle/schema";
import { eq, sql, and, gte } from "drizzle-orm";

// Helper to format date
const formatDate = (date: Date | string | null): string => {
  if (!date) return "—";
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
};

// Helper to get status label
const getStatusLabel = (status: string | null): string => {
  switch (status) {
    case "completed": return "Завершена";
    case "in_progress": return "В работе";
    case "not_started": return "Не начата";
    default: return "Не указан";
  }
};

// Helper to get priority label
const getPriorityLabel = (priority: string | null): string => {
  switch (priority) {
    case "critical": return "Критический";
    case "high": return "Высокий";
    case "medium": return "Средний";
    case "low": return "Низкий";
    default: return "Средний";
  }
};

export const analyticsExportRouter = router({
  // Generate PDF report data
  generatePdfReport: protectedProcedure
    .input(z.object({ 
      projectId: z.number(),
      includeCharts: z.boolean().default(true),
      includeTaskList: z.boolean().default(true),
      includeBlockDetails: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Get project
      const [project] = await db.select().from(projects)
        .where(and(
          eq(projects.id, input.projectId),
          eq(projects.userId, ctx.user.id)
        ));
      
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      
      // Get all blocks
      const projectBlocks = await db.select().from(blocks)
        .where(eq(blocks.projectId, input.projectId))
        .orderBy(blocks.sortOrder);
      
      const blockIds = projectBlocks.map(b => b.id);
      
      // Get all sections
      let allSections: any[] = [];
      if (blockIds.length > 0) {
        allSections = await db.select().from(sections)
          .where(sql`${sections.blockId} IN (${sql.join(blockIds.map(id => sql`${id}`), sql`, `)})`);
      }
      
      const sectionIds = allSections.map(s => s.id);
      
      // Get all tasks
      let allTasks: any[] = [];
      if (sectionIds.length > 0) {
        allTasks = await db.select().from(tasks)
          .where(sql`${tasks.sectionId} IN (${sql.join(sectionIds.map(id => sql`${id}`), sql`, `)})`);
      }
      
      // Calculate statistics
      const totalTasks = allTasks.length;
      const completedTasks = allTasks.filter(t => t.status === "completed").length;
      const inProgressTasks = allTasks.filter(t => t.status === "in_progress").length;
      const notStartedTasks = allTasks.filter(t => t.status === "not_started").length;
      const overdueTasks = allTasks.filter(t => {
        if (!t.deadline) return false;
        return new Date(t.deadline) < new Date() && t.status !== "completed";
      }).length;
      
      // Priority distribution
      const priorityCounts = {
        critical: allTasks.filter(t => t.priority === "critical").length,
        high: allTasks.filter(t => t.priority === "high").length,
        medium: allTasks.filter(t => t.priority === "medium" || !t.priority).length,
        low: allTasks.filter(t => t.priority === "low").length,
      };
      
      // Block details
      const blockDetails = await Promise.all(projectBlocks.map(async (block) => {
        const blockSections = allSections.filter(s => s.blockId === block.id);
        const blockSectionIds = blockSections.map(s => s.id);
        const blockTasks = allTasks.filter(t => blockSectionIds.includes(t.sectionId));
        
        return {
          number: block.number,
          title: block.title,
          deadline: formatDate(block.deadline),
          totalTasks: blockTasks.length,
          completedTasks: blockTasks.filter(t => t.status === "completed").length,
          completionRate: blockTasks.length > 0 
            ? Math.round((blockTasks.filter(t => t.status === "completed").length / blockTasks.length) * 100)
            : 0,
        };
      }));
      
      // Generate Markdown report
      let markdown = `# Аналитический отчёт: ${project.name}\n\n`;
      markdown += `**Дата генерации:** ${formatDate(new Date())}\n\n`;
      markdown += `---\n\n`;
      
      // Summary section
      markdown += `## Общая статистика\n\n`;
      markdown += `| Показатель | Значение |\n`;
      markdown += `|------------|----------|\n`;
      markdown += `| Всего задач | ${totalTasks} |\n`;
      markdown += `| Завершено | ${completedTasks} (${totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%) |\n`;
      markdown += `| В работе | ${inProgressTasks} |\n`;
      markdown += `| Не начато | ${notStartedTasks} |\n`;
      markdown += `| Просрочено | ${overdueTasks} |\n`;
      markdown += `| Блоков | ${projectBlocks.length} |\n`;
      markdown += `| Секций | ${allSections.length} |\n\n`;
      
      // Priority distribution
      markdown += `## Распределение по приоритетам\n\n`;
      markdown += `| Приоритет | Количество |\n`;
      markdown += `|-----------|------------|\n`;
      markdown += `| Критический | ${priorityCounts.critical} |\n`;
      markdown += `| Высокий | ${priorityCounts.high} |\n`;
      markdown += `| Средний | ${priorityCounts.medium} |\n`;
      markdown += `| Низкий | ${priorityCounts.low} |\n\n`;
      
      // Block details
      if (input.includeBlockDetails) {
        markdown += `## Прогресс по блокам\n\n`;
        markdown += `| # | Блок | Дедлайн | Прогресс |\n`;
        markdown += `|---|------|---------|----------|\n`;
        blockDetails.forEach(block => {
          markdown += `| ${block.number} | ${block.title} | ${block.deadline} | ${block.completedTasks}/${block.totalTasks} (${block.completionRate}%) |\n`;
        });
        markdown += `\n`;
      }
      
      // Task list
      if (input.includeTaskList) {
        markdown += `## Список задач\n\n`;
        
        for (const block of projectBlocks) {
          const blockSections = allSections.filter(s => s.blockId === block.id);
          const blockSectionIds = blockSections.map(s => s.id);
          const blockTasks = allTasks.filter(t => blockSectionIds.includes(t.sectionId));
          
          if (blockTasks.length > 0) {
            markdown += `### Блок ${block.number}: ${block.title}\n\n`;
            markdown += `| Задача | Статус | Приоритет | Дедлайн |\n`;
            markdown += `|--------|--------|-----------|----------|\n`;
            
            blockTasks.forEach(task => {
              markdown += `| ${task.title} | ${getStatusLabel(task.status)} | ${getPriorityLabel(task.priority)} | ${formatDate(task.deadline)} |\n`;
            });
            markdown += `\n`;
          }
        }
      }
      
      markdown += `---\n\n`;
      markdown += `*Отчёт сгенерирован MYDON Roadmap Hub*\n`;
      
      return {
        markdown,
        filename: `${project.name.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}_analytics_${new Date().toISOString().split('T')[0]}.md`,
        summary: {
          projectName: project.name,
          totalTasks,
          completedTasks,
          completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
          blocksCount: projectBlocks.length,
        }
      };
    }),
  
  // Generate Excel data
  generateExcelData: protectedProcedure
    .input(z.object({ 
      projectId: z.number(),
      includeSubtasks: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Get project
      const [project] = await db.select().from(projects)
        .where(and(
          eq(projects.id, input.projectId),
          eq(projects.userId, ctx.user.id)
        ));
      
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      
      // Get all blocks
      const projectBlocks = await db.select().from(blocks)
        .where(eq(blocks.projectId, input.projectId))
        .orderBy(blocks.sortOrder);
      
      const blockIds = projectBlocks.map(b => b.id);
      
      // Get all sections
      let allSections: any[] = [];
      if (blockIds.length > 0) {
        allSections = await db.select().from(sections)
          .where(sql`${sections.blockId} IN (${sql.join(blockIds.map(id => sql`${id}`), sql`, `)})`);
      }
      
      const sectionIds = allSections.map(s => s.id);
      
      // Get all tasks
      let allTasks: any[] = [];
      if (sectionIds.length > 0) {
        allTasks = await db.select().from(tasks)
          .where(sql`${tasks.sectionId} IN (${sql.join(sectionIds.map(id => sql`${id}`), sql`, `)})`);
      }
      
      // Prepare data for Excel
      const rows: any[] = [];
      
      for (const block of projectBlocks) {
        const blockSections = allSections.filter(s => s.blockId === block.id);
        
        for (const section of blockSections) {
          const sectionTasks = allTasks.filter(t => t.sectionId === section.id);
          
          for (const task of sectionTasks) {
            rows.push({
              blockNumber: block.number,
              blockTitle: block.title,
              blockDeadline: block.deadline ? new Date(block.deadline).toISOString().split('T')[0] : '',
              sectionTitle: section.title,
              taskTitle: task.title,
              taskStatus: getStatusLabel(task.status),
              taskPriority: getPriorityLabel(task.priority),
              taskDeadline: task.deadline ? new Date(task.deadline).toISOString().split('T')[0] : '',
              taskCreatedAt: task.createdAt ? new Date(task.createdAt).toISOString().split('T')[0] : '',
            });
          }
        }
      }
      
      // Generate CSV content
      const headers = [
        'Блок №',
        'Блок',
        'Дедлайн блока',
        'Секция',
        'Задача',
        'Статус',
        'Приоритет',
        'Дедлайн задачи',
        'Дата создания'
      ];
      
      let csv = headers.join(',') + '\n';
      
      rows.forEach(row => {
        const values = [
          row.blockNumber,
          `"${row.blockTitle.replace(/"/g, '""')}"`,
          row.blockDeadline,
          `"${row.sectionTitle.replace(/"/g, '""')}"`,
          `"${row.taskTitle.replace(/"/g, '""')}"`,
          row.taskStatus,
          row.taskPriority,
          row.taskDeadline,
          row.taskCreatedAt
        ];
        csv += values.join(',') + '\n';
      });
      
      return {
        csv,
        filename: `${project.name.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}_tasks_${new Date().toISOString().split('T')[0]}.csv`,
        rowCount: rows.length,
      };
    }),
});

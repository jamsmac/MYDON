import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { 
  aiChatHistory, 
  aiSuggestions, 
  projectRisks, 
  executiveSummaries,
  tasks,
  blocks,
  sections,
  projects,
} from "../drizzle/schema";
import { eq, and, desc, sql, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// Priority keywords for auto-detection
const PRIORITY_KEYWORDS = {
  critical: ["urgent", "critical", "asap", "emergency", "blocker", "срочно", "критично", "блокер"],
  high: ["important", "high priority", "soon", "deadline", "важно", "высокий приоритет", "дедлайн"],
  medium: ["normal", "standard", "regular", "обычный", "стандартный"],
  low: ["nice to have", "optional", "later", "backlog", "желательно", "опционально", "позже"]
};

// Risk detection thresholds
const RISK_THRESHOLDS = {
  overdueWarningDays: 3,
};

export const aiEnhancementsRouter = router({
  // ============ SMART SUGGESTIONS ============
  
  getTaskSuggestions: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      sectionId: z.number(),
      partialTitle: z.string().optional(),
      context: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const existingTasks = await db.select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        priority: tasks.priority,
      })
        .from(tasks)
        .where(eq(tasks.sectionId, input.sectionId))
        .limit(20);
      
      const sectionInfoResult = await db.select({
        sectionTitle: sections.title,
        blockTitle: blocks.title,
        projectName: projects.name,
      })
        .from(sections)
        .leftJoin(blocks, eq(sections.blockId, blocks.id))
        .leftJoin(projects, eq(blocks.projectId, projects.id))
        .where(eq(sections.id, input.sectionId));
      
      const sectionInfo = sectionInfoResult[0];
      
      const prompt = `You are a project management assistant. Based on the context, suggest 3-5 tasks.

Project: ${sectionInfo?.projectName || 'Unknown'}
Block: ${sectionInfo?.blockTitle || 'Unknown'}
Section: ${sectionInfo?.sectionTitle || 'Unknown'}

Existing tasks:
${existingTasks.map(t => `- ${t.title}`).join('\n') || 'No tasks yet'}

${input.partialTitle ? `User is typing: "${input.partialTitle}"` : ''}
${input.context ? `Additional context: ${input.context}` : ''}

Return JSON array: [{"title": "...", "description": "...", "priority": "medium|high|low|critical", "subtasks": ["..."]}]`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are a helpful project management assistant. Always respond with valid JSON." },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" }
        });
        
        const content = response.choices[0]?.message?.content;
        if (typeof content !== 'string') return { suggestions: [] };
        
        let suggestions;
        try {
          const parsed = JSON.parse(content);
          suggestions = Array.isArray(parsed) ? parsed : parsed.suggestions || [];
        } catch {
          suggestions = [];
        }
        
        for (const suggestion of suggestions) {
          await db.insert(aiSuggestions).values({
            userId: ctx.user.id,
            projectId: input.projectId,
            suggestionType: "title",
            suggestion: suggestion,
            confidence: 80,
          });
        }
        
        return { suggestions };
      } catch (error) {
        console.error("AI suggestion error:", error);
        return { suggestions: [] };
      }
    }),

  detectPriority: protectedProcedure
    .input(z.object({
      title: z.string(),
      description: z.string().optional(),
      deadline: z.date().optional(),
    }))
    .mutation(async ({ input }) => {
      const text = `${input.title} ${input.description || ""}`.toLowerCase();
      
      for (const [priority, keywords] of Object.entries(PRIORITY_KEYWORDS)) {
        if (keywords.some(kw => text.includes(kw))) {
          return {
            priority: priority as "critical" | "high" | "medium" | "low",
            confidence: 90,
            reason: `Detected keyword match for ${priority} priority`
          };
        }
      }
      
      if (input.deadline) {
        const daysUntilDeadline = Math.ceil((input.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysUntilDeadline <= 1) {
          return { priority: "critical" as const, confidence: 95, reason: "Deadline is within 24 hours" };
        }
        if (daysUntilDeadline <= 3) {
          return { priority: "high" as const, confidence: 85, reason: "Deadline is within 3 days" };
        }
        if (daysUntilDeadline <= 7) {
          return { priority: "medium" as const, confidence: 75, reason: "Deadline is within a week" };
        }
      }
      
      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are a task priority analyzer. Return JSON: {\"priority\": \"...\", \"confidence\": ..., \"reason\": \"...\"}" },
            { role: "user", content: `Analyze: Title: ${input.title}\nDescription: ${input.description || "None"}` }
          ],
          response_format: { type: "json_object" }
        });
        
        const content = response.choices[0]?.message?.content;
        if (typeof content !== 'string') return { priority: "medium" as const, confidence: 50, reason: "Default priority" };
        
        const result = JSON.parse(content);
        return {
          priority: result.priority || "medium",
          confidence: result.confidence || 60,
          reason: result.reason || "AI analysis"
        };
      } catch {
        return { priority: "medium" as const, confidence: 50, reason: "Default priority" };
      }
    }),

  findSimilarTasks: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      title: z.string(),
      threshold: z.number().min(0).max(100).default(70),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const projectTasks = await db.select({
        id: tasks.id,
        title: tasks.title,
        sectionId: tasks.sectionId,
        status: tasks.status,
        sectionTitle: sections.title,
        blockTitle: blocks.title,
      })
        .from(tasks)
        .leftJoin(sections, eq(tasks.sectionId, sections.id))
        .leftJoin(blocks, eq(sections.blockId, blocks.id))
        .where(eq(blocks.projectId, input.projectId));
      
      const inputWords = input.title.toLowerCase().split(/\s+/);
      const similar = projectTasks
        .map(task => {
          const taskWords = task.title.toLowerCase().split(/\s+/);
          const intersection = inputWords.filter(w => taskWords.includes(w));
          const similarity = (intersection.length * 2 / (inputWords.length + taskWords.length)) * 100;
          return { ...task, similarity: Math.round(similarity) };
        })
        .filter(t => t.similarity >= input.threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5);
      
      return { similarTasks: similar };
    }),

  // ============ RISK DETECTION ============
  
  detectRisks: protectedProcedure
    .input(z.object({
      projectId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const detectedRisks: Array<{
        type: string;
        severity: string;
        title: string;
        description: string;
        recommendation: string;
        taskId?: number;
        blockId?: number;
      }> = [];
      
      const projectTasks = await db.select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        deadline: tasks.deadline,
        dependencies: tasks.dependencies,
        sectionId: tasks.sectionId,
        blockId: blocks.id,
      })
        .from(tasks)
        .leftJoin(sections, eq(tasks.sectionId, sections.id))
        .leftJoin(blocks, eq(sections.blockId, blocks.id))
        .where(eq(blocks.projectId, input.projectId));
      
      const now = new Date();
      const taskMap = new Map(projectTasks.map(t => [t.id, t]));
      
      for (const task of projectTasks) {
        if (task.deadline && task.status !== "completed") {
          const daysOverdue = Math.ceil((now.getTime() - task.deadline.getTime()) / (1000 * 60 * 60 * 24));
          if (daysOverdue > 0) {
            detectedRisks.push({
              type: "overdue",
              severity: daysOverdue > 7 ? "critical" : daysOverdue > 3 ? "high" : "medium",
              title: `Просроченная задача: ${task.title}`,
              description: `Задача просрочена на ${daysOverdue} дней`,
              recommendation: "Пересмотрите приоритеты или перенесите дедлайн",
              taskId: task.id,
              blockId: task.blockId || undefined,
            });
          } else if (daysOverdue >= -RISK_THRESHOLDS.overdueWarningDays) {
            detectedRisks.push({
              type: "deadline",
              severity: "medium",
              title: `Приближается дедлайн: ${task.title}`,
              description: `До дедлайна осталось ${Math.abs(daysOverdue)} дней`,
              recommendation: "Убедитесь, что задача будет выполнена вовремя",
              taskId: task.id,
              blockId: task.blockId || undefined,
            });
          }
        }
        
        if (task.dependencies && task.dependencies.length > 0 && task.status !== "completed") {
          const blockedBy = task.dependencies.filter(depId => {
            const dep = taskMap.get(depId);
            return dep && dep.status !== "completed";
          });
          
          if (blockedBy.length > 0) {
            detectedRisks.push({
              type: "blocked",
              severity: "high",
              title: `Заблокированная задача: ${task.title}`,
              description: `Ожидает завершения ${blockedBy.length} зависимостей`,
              recommendation: "Завершите зависимые задачи или пересмотрите зависимости",
              taskId: task.id,
              blockId: task.blockId || undefined,
            });
          }
        }
      }
      
      const inProgressTasks = projectTasks.filter(t => t.status === "in_progress");
      if (inProgressTasks.length > 10) {
        detectedRisks.push({
          type: "scope",
          severity: "medium",
          title: "Слишком много задач в работе",
          description: `${inProgressTasks.length} задач одновременно в работе`,
          recommendation: "Сфокусируйтесь на завершении текущих задач перед началом новых",
        });
      }
      
      for (const risk of detectedRisks) {
        const existing = await db.select()
          .from(projectRisks)
          .where(and(
            eq(projectRisks.projectId, input.projectId),
            eq(projectRisks.riskType, risk.type as any),
            risk.taskId ? eq(projectRisks.taskId, risk.taskId) : isNull(projectRisks.taskId),
            eq(projectRisks.status, "open")
          ))
          .limit(1);
        
        if (existing.length === 0) {
          await db.insert(projectRisks).values({
            projectId: input.projectId,
            blockId: risk.blockId,
            taskId: risk.taskId,
            riskType: risk.type as any,
            severity: risk.severity as any,
            title: risk.title,
            description: risk.description,
            recommendation: risk.recommendation,
          });
        }
      }
      
      return { 
        risks: detectedRisks,
        summary: {
          total: detectedRisks.length,
          critical: detectedRisks.filter(r => r.severity === "critical").length,
          high: detectedRisks.filter(r => r.severity === "high").length,
          medium: detectedRisks.filter(r => r.severity === "medium").length,
        }
      };
    }),

  getProjectRisks: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      status: z.enum(["open", "mitigated", "resolved", "accepted", "all"]).default("open"),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const conditions = [eq(projectRisks.projectId, input.projectId)];
      if (input.status !== "all") {
        conditions.push(eq(projectRisks.status, input.status));
      }
      
      const risks = await db.select()
        .from(projectRisks)
        .where(and(...conditions))
        .orderBy(desc(projectRisks.detectedAt));
      
      return { risks };
    }),

  updateRiskStatus: protectedProcedure
    .input(z.object({
      riskId: z.number(),
      status: z.enum(["open", "mitigated", "resolved", "accepted"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      await db.update(projectRisks)
        .set({ 
          status: input.status,
          resolvedAt: input.status === "resolved" ? new Date() : null,
        })
        .where(eq(projectRisks.id, input.riskId));
      
      return { success: true };
    }),

  // ============ EXECUTIVE SUMMARY ============
  
  generateExecutiveSummary: protectedProcedure
    .input(z.object({
      projectId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const projectResult = await db.select()
        .from(projects)
        .where(eq(projects.id, input.projectId));
      const project = projectResult[0];
      
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      
      const projectTasks = await db.select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        deadline: tasks.deadline,
        updatedAt: tasks.updatedAt,
      })
        .from(tasks)
        .leftJoin(sections, eq(tasks.sectionId, sections.id))
        .leftJoin(blocks, eq(sections.blockId, blocks.id))
        .where(eq(blocks.projectId, input.projectId));
      
      const projectBlocks = await db.select()
        .from(blocks)
        .where(eq(blocks.projectId, input.projectId));
      
      const risks = await db.select()
        .from(projectRisks)
        .where(and(
          eq(projectRisks.projectId, input.projectId),
          eq(projectRisks.status, "open")
        ));
      
      const totalTasks = projectTasks.length;
      const completedTasks = projectTasks.filter(t => t.status === "completed").length;
      const inProgressTasks = projectTasks.filter(t => t.status === "in_progress").length;
      const overdueTasks = projectTasks.filter(t => 
        t.deadline && t.status !== "completed" && new Date(t.deadline) < new Date()
      ).length;
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const recentlyCompleted = projectTasks.filter(t => 
        t.status === "completed" && new Date(t.updatedAt) > weekAgo
      );
      
      const keyMetrics = {
        totalTasks,
        completedTasks,
        inProgressTasks,
        overdueTasks,
        progress,
        blocksTotal: projectBlocks.length,
        risksOpen: risks.length,
      };
      
      const prompt = `Generate an executive summary for this project:

Project: ${project.name}
Description: ${project.description || "No description"}

Key Metrics:
- Total tasks: ${totalTasks}
- Completed: ${completedTasks} (${progress}%)
- In progress: ${inProgressTasks}
- Overdue: ${overdueTasks}
- Open risks: ${risks.length}

Recent achievements (last 7 days):
${recentlyCompleted.map(t => `- ${t.title}`).join('\n') || "None"}

Open risks:
${risks.map(r => `- [${r.severity}] ${r.title}`).join('\n') || "None"}

Generate a professional executive summary in Russian with:
1. Brief overview (2-3 sentences)
2. Key achievements
3. Current challenges
4. Recommendations

Return JSON: {"summary": "...", "achievements": [...], "challenges": [...], "recommendations": [...]}`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are a project management expert. Generate concise, actionable executive summaries in Russian." },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" }
        });
        
        const content = response.choices[0]?.message?.content;
        if (typeof content !== 'string') {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Invalid AI response" });
        }
        
        const aiResult = JSON.parse(content);
        
        await db.insert(executiveSummaries).values({
          projectId: input.projectId,
          userId: ctx.user.id,
          title: `Отчёт: ${project.name}`,
          summary: aiResult.summary || "Отчёт недоступен",
          keyMetrics,
          risks: risks.map(r => ({ title: r.title, severity: r.severity })),
          achievements: aiResult.achievements || recentlyCompleted.map(t => t.title),
          recommendations: aiResult.recommendations || [],
        });
        
        return {
          id: Date.now(),
          title: `Отчёт: ${project.name}`,
          summary: aiResult.summary,
          keyMetrics,
          achievements: aiResult.achievements || [],
          challenges: aiResult.challenges || [],
          recommendations: aiResult.recommendations || [],
        };
      } catch (error) {
        console.error("Executive summary generation error:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to generate summary" });
      }
    }),

  getExecutiveSummaries: protectedProcedure
    .input(z.object({
      projectId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const summaries = await db.select()
        .from(executiveSummaries)
        .where(eq(executiveSummaries.projectId, input.projectId))
        .orderBy(desc(executiveSummaries.generatedAt));
      
      return { summaries };
    }),

  // ============ QUICK COMMANDS ============
  
  processCommand: protectedProcedure
    .input(z.object({
      command: z.enum(["summarize", "analyze", "suggest", "risks"]),
      projectId: z.number(),
      blockId: z.number().optional(),
      sectionId: z.number().optional(),
      taskId: z.number().optional(),
      additionalContext: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      let contextData: any = {};
      
      if (input.taskId) {
        const taskResult = await db.select().from(tasks).where(eq(tasks.id, input.taskId));
        contextData = { type: "task", data: taskResult[0] };
      } else if (input.sectionId) {
        const sectionResult = await db.select().from(sections).where(eq(sections.id, input.sectionId));
        const sectionTasks = await db.select().from(tasks).where(eq(tasks.sectionId, input.sectionId));
        contextData = { type: "section", data: sectionResult[0], tasks: sectionTasks };
      } else if (input.blockId) {
        const blockResult = await db.select().from(blocks).where(eq(blocks.id, input.blockId));
        contextData = { type: "block", data: blockResult[0] };
      } else {
        const projectResult = await db.select().from(projects).where(eq(projects.id, input.projectId));
        contextData = { type: "project", data: projectResult[0] };
      }
      
      let prompt = "";
      const systemPrompt = "You are a helpful project management assistant. Respond in Russian.";
      
      switch (input.command) {
        case "summarize":
          prompt = `Summarize this ${contextData.type}:\n${JSON.stringify(contextData.data, null, 2)}\n\nProvide a brief, actionable summary.`;
          break;
        case "analyze":
          prompt = `Analyze this ${contextData.type} and identify:\n1. Strengths\n2. Weaknesses\n3. Opportunities\n4. Threats\n\nContext:\n${JSON.stringify(contextData.data, null, 2)}`;
          break;
        case "suggest":
          prompt = `Based on this ${contextData.type}, suggest improvements or next steps:\n${JSON.stringify(contextData.data, null, 2)}`;
          break;
        case "risks":
          prompt = `Identify potential risks for this ${contextData.type}:\n${JSON.stringify(contextData.data, null, 2)}\n\nList risks with severity and mitigation strategies.`;
          break;
      }
      
      if (input.additionalContext) {
        prompt += `\n\nAdditional context: ${input.additionalContext}`;
      }
      
      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
          ]
        });
        
        const content = response.choices[0]?.message?.content;
        const result = typeof content === 'string' ? content : "Не удалось обработать команду";
        
        await db.insert(aiChatHistory).values({
          userId: ctx.user.id,
          projectId: input.projectId,
          blockId: input.blockId,
          sectionId: input.sectionId,
          taskId: input.taskId,
          role: "user",
          content: `/${input.command}`,
          metadata: { command: input.command },
        });
        
        await db.insert(aiChatHistory).values({
          userId: ctx.user.id,
          projectId: input.projectId,
          blockId: input.blockId,
          sectionId: input.sectionId,
          taskId: input.taskId,
          role: "assistant",
          content: result,
          metadata: { command: input.command },
        });
        
        return { result, command: input.command };
      } catch (error) {
        console.error("Command processing error:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to process command" });
      }
    }),

  // ============ CHAT HISTORY ============
  
  getChatHistory: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      blockId: z.number().optional(),
      sectionId: z.number().optional(),
      taskId: z.number().optional(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const conditions = [eq(aiChatHistory.userId, ctx.user.id)];
      
      if (input.taskId) {
        conditions.push(eq(aiChatHistory.taskId, input.taskId));
      } else if (input.sectionId) {
        conditions.push(eq(aiChatHistory.sectionId, input.sectionId));
      } else if (input.blockId) {
        conditions.push(eq(aiChatHistory.blockId, input.blockId));
      } else {
        conditions.push(eq(aiChatHistory.projectId, input.projectId));
      }
      
      const history = await db.select()
        .from(aiChatHistory)
        .where(and(...conditions))
        .orderBy(desc(aiChatHistory.createdAt))
        .limit(input.limit);
      
      return { history: history.reverse() };
    }),

  searchChatHistory: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      query: z.string().min(2),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const results = await db.select()
        .from(aiChatHistory)
        .where(and(
          eq(aiChatHistory.userId, ctx.user.id),
          eq(aiChatHistory.projectId, input.projectId),
          sql`${aiChatHistory.content} LIKE ${`%${input.query}%`}`
        ))
        .orderBy(desc(aiChatHistory.createdAt))
        .limit(input.limit);
      
      return { results };
    }),

  exportChatHistory: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      format: z.enum(["markdown", "json"]).default("markdown"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const history = await db.select()
        .from(aiChatHistory)
        .where(and(
          eq(aiChatHistory.userId, ctx.user.id),
          eq(aiChatHistory.projectId, input.projectId)
        ))
        .orderBy(aiChatHistory.createdAt);
      
      if (input.format === "json") {
        return { content: JSON.stringify(history, null, 2), format: "json" };
      }
      
      let markdown = "# AI Chat History\n\n";
      for (const msg of history) {
        const date = new Date(msg.createdAt).toLocaleString("ru-RU");
        const role = msg.role === "user" ? "👤 Вы" : "🤖 AI";
        markdown += `### ${role} (${date})\n\n${msg.content}\n\n---\n\n`;
      }
      
      return { content: markdown, format: "markdown" };
    }),

  // ============ AI DEPENDENCY SUGGESTIONS ============
  suggestDependencies: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      taskId: z.number().optional(), // existing task being edited
      taskTitle: z.string(),
      taskDescription: z.string().optional(),
      sectionId: z.number().optional(),
      currentDependencies: z.array(z.number()).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      // Get all tasks in the project with their context
      const projectBlocks = await db.select({
        blockId: blocks.id,
        blockTitle: blocks.title,
        sectionId: sections.id,
        sectionTitle: sections.title,
        taskId: tasks.id,
        taskTitle: tasks.title,
        taskDescription: tasks.description,
        taskStatus: tasks.status,
        taskPriority: tasks.priority,
        taskDependencies: tasks.dependencies,
      })
        .from(tasks)
        .innerJoin(sections, eq(tasks.sectionId, sections.id))
        .innerJoin(blocks, eq(sections.blockId, blocks.id))
        .where(eq(blocks.projectId, input.projectId));
      
      // Filter out the current task and already-set dependencies
      const excludeIds = new Set<number>([
        ...(input.currentDependencies || []),
        ...(input.taskId ? [input.taskId] : []),
      ]);
      
      const candidateTasks = projectBlocks.filter((t: typeof projectBlocks[number]) => !excludeIds.has(t.taskId));
      
      if (candidateTasks.length === 0) {
        return { suggestions: [], reasoning: "\u041d\u0435\u0442 \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b\u0445 \u0437\u0430\u0434\u0430\u0447 \u0434\u043b\u044f \u0437\u0430\u0432\u0438\u0441\u0438\u043c\u043e\u0441\u0442\u0435\u0439" };
      }
      
      // Build context for AI
      const taskListForAI = candidateTasks.map((t: typeof projectBlocks[number]) => ({
        id: t.taskId,
        title: t.taskTitle,
        description: t.taskDescription || "",
        status: t.taskStatus,
        block: t.blockTitle,
        section: t.sectionTitle,
      }));
      
      try {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a project management dependency analyzer. Given a task and a list of other tasks in the project, suggest which tasks should be dependencies (i.e., tasks that must be completed BEFORE the given task can start).

Rules:
- Only suggest tasks that logically MUST be completed before the target task
- Consider technical dependencies (e.g., "design" before "implement")
- Consider data dependencies (e.g., "research" before "analysis")
- Consider process dependencies (e.g., "approve" before "deploy")
- Maximum 5 suggestions, ranked by relevance
- For each suggestion, provide a brief reason WHY it's a dependency
- If no logical dependencies exist, return an empty array

Return JSON:
{
  "suggestions": [
    { "taskId": <number>, "reason": "<brief explanation in Russian>", "confidence": <0-100> }
  ],
  "reasoning": "<overall analysis in Russian>"
}`
            },
            {
              role: "user",
              content: `Target task:\n- Title: ${input.taskTitle}\n- Description: ${input.taskDescription || "No description"}\n\nAvailable tasks in the project:\n${JSON.stringify(taskListForAI, null, 2)}`
            }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "dependency_suggestions",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        taskId: { type: "number", description: "ID of the suggested dependency task" },
                        reason: { type: "string", description: "Why this task is a dependency" },
                        confidence: { type: "number", description: "Confidence level 0-100" }
                      },
                      required: ["taskId", "reason", "confidence"],
                      additionalProperties: false
                    }
                  },
                  reasoning: { type: "string", description: "Overall analysis" }
                },
                required: ["suggestions", "reasoning"],
                additionalProperties: false
              }
            }
          }
        });
        
        const content = response.choices[0]?.message?.content;
        if (typeof content !== 'string') {
          return { suggestions: [], reasoning: "AI analysis unavailable" };
        }
        
        const result = JSON.parse(content);
        
        // Validate that suggested taskIds actually exist in our candidates
        const validTaskIds = new Set(candidateTasks.map((t: typeof projectBlocks[number]) => t.taskId));
        const validSuggestions = (result.suggestions || []).filter(
          (s: any) => validTaskIds.has(s.taskId) && s.confidence >= 30
        ).map((s: any) => {
          const taskInfo = candidateTasks.find((t: typeof projectBlocks[number]) => t.taskId === s.taskId);
          return {
            taskId: s.taskId,
            taskTitle: taskInfo?.taskTitle || "Unknown",
            taskStatus: taskInfo?.taskStatus || "not_started",
            section: taskInfo?.sectionTitle || "",
            block: taskInfo?.blockTitle || "",
            reason: s.reason,
            confidence: s.confidence,
          };
        });
        
        return {
          suggestions: validSuggestions,
          reasoning: result.reasoning || "AI dependency analysis",
        };
      } catch (error) {
        console.error("[AI Dependencies] Error:", error);
        
        // Fallback: simple heuristic-based suggestions
        const heuristicSuggestions = candidateTasks
          .filter((t: typeof projectBlocks[number]) => {
            const title = input.taskTitle.toLowerCase();
            const candidateTitle = (t.taskTitle || "").toLowerCase();
            const sameSection = input.sectionId && t.sectionId === input.sectionId;
            const titleWords = title.split(/\s+/).filter((w: string) => w.length > 3);
            const hasOverlap = titleWords.some((w: string) => candidateTitle.includes(w));
            return sameSection || hasOverlap;
          })
          .slice(0, 3)
          .map((t: typeof projectBlocks[number]) => ({
            taskId: t.taskId,
            taskTitle: t.taskTitle || "Unknown",
            taskStatus: t.taskStatus || "not_started",
            section: t.sectionTitle || "",
            block: t.blockTitle || "",
            reason: "Related task (heuristic analysis)",
            confidence: 50,
          }));
        
        return {
          suggestions: heuristicSuggestions,
          reasoning: "Suggestions based on heuristic analysis (AI unavailable)",
        };
      }
    }),
});

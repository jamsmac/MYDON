import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { z } from "zod";
import * as db from "./db";

// ============ PROJECT ROUTER ============
const projectRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.getProjectsByUser(ctx.user.id);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.getProjectById(input.id, ctx.user.id);
    }),

  getFull: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.getFullProject(input.id, ctx.user.id);
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      icon: z.string().optional(),
      color: z.string().optional(),
      startDate: z.date().optional(),
      targetDate: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return db.createProject({
        ...input,
        userId: ctx.user.id,
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      icon: z.string().optional(),
      color: z.string().optional(),
      status: z.enum(["active", "archived", "completed"]).optional(),
      startDate: z.date().optional(),
      targetDate: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return db.updateProject(id, ctx.user.id, data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return db.deleteProject(input.id, ctx.user.id);
    }),
});

// ============ BLOCK ROUTER ============
const blockRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      return db.getBlocksByProject(input.projectId);
    }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      number: z.number(),
      title: z.string().min(1).max(255),
      titleRu: z.string().optional(),
      description: z.string().optional(),
      icon: z.string().optional(),
      duration: z.string().optional(),
      deadline: z.date().optional(),
      reminderDays: z.number().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      return db.createBlock(input);
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1).max(255).optional(),
      titleRu: z.string().optional(),
      description: z.string().optional(),
      icon: z.string().optional(),
      duration: z.string().optional(),
      deadline: z.date().nullable().optional(),
      reminderDays: z.number().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return db.updateBlock(id, data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return db.deleteBlock(input.id);
    }),
});

// ============ SECTION ROUTER ============
const sectionRouter = router({
  list: protectedProcedure
    .input(z.object({ blockId: z.number() }))
    .query(async ({ input }) => {
      return db.getSectionsByBlock(input.blockId);
    }),

  create: protectedProcedure
    .input(z.object({
      blockId: z.number(),
      title: z.string().min(1).max(255),
      description: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      return db.createSection(input);
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return db.updateSection(id, data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return db.deleteSection(input.id);
    }),

  move: protectedProcedure
    .input(z.object({
      id: z.number(),
      blockId: z.number(),
      sortOrder: z.number(),
    }))
    .mutation(async ({ input }) => {
      return db.moveSection(input.id, input.blockId, input.sortOrder);
    }),
});

// ============ TASK ROUTER ============
const taskRouter = router({
  list: protectedProcedure
    .input(z.object({ sectionId: z.number() }))
    .query(async ({ input }) => {
      return db.getTasksBySection(input.sectionId);
    }),

  create: protectedProcedure
    .input(z.object({
      sectionId: z.number(),
      title: z.string().min(1).max(500),
      description: z.string().optional(),
      status: z.enum(["not_started", "in_progress", "completed"]).optional(),
      notes: z.string().optional(),
      summary: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      return db.createTask(input);
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1).max(500).optional(),
      description: z.string().optional(),
      status: z.enum(["not_started", "in_progress", "completed"]).optional(),
      notes: z.string().optional(),
      summary: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return db.updateTask(id, data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return db.deleteTask(input.id);
    }),

  move: protectedProcedure
    .input(z.object({
      id: z.number(),
      sectionId: z.number(),
      sortOrder: z.number(),
    }))
    .mutation(async ({ input }) => {
      return db.moveTask(input.id, input.sectionId, input.sortOrder);
    }),
});

// ============ SUBTASK ROUTER ============
const subtaskRouter = router({
  list: protectedProcedure
    .input(z.object({ taskId: z.number() }))
    .query(async ({ input }) => {
      return db.getSubtasksByTask(input.taskId);
    }),

  create: protectedProcedure
    .input(z.object({
      taskId: z.number(),
      title: z.string().min(1).max(500),
      status: z.enum(["not_started", "in_progress", "completed"]).optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      return db.createSubtask(input);
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1).max(500).optional(),
      status: z.enum(["not_started", "in_progress", "completed"]).optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return db.updateSubtask(id, data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return db.deleteSubtask(input.id);
    }),
});

// ============ AI SETTINGS ROUTER ============
const aiSettingsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.getAiSettingsByUser(ctx.user.id);
  }),

  upsert: protectedProcedure
    .input(z.object({
      provider: z.enum(["anthropic", "openai", "google", "groq", "mistral"]),
      apiKey: z.string().optional(),
      model: z.string().optional(),
      isDefault: z.boolean().optional(),
      isEnabled: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return db.upsertAiSetting({
        ...input,
        userId: ctx.user.id,
      });
    }),

  setDefault: protectedProcedure
    .input(z.object({
      provider: z.enum(["anthropic", "openai", "google", "groq", "mistral"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.setDefaultAiProvider(ctx.user.id, input.provider);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return db.deleteAiSetting(input.id, ctx.user.id);
    }),

  // Validate API key by making a test request
  validate: protectedProcedure
    .input(z.object({
      provider: z.enum(["anthropic", "openai", "google", "groq", "mistral"]),
      apiKey: z.string(),
    }))
    .mutation(async ({ input }) => {
      // Simple validation - just check format
      const { provider, apiKey } = input;
      
      const patterns: Record<string, RegExp> = {
        anthropic: /^sk-ant-/,
        openai: /^sk-/,
        google: /^AI/,
        groq: /^gsk_/,
        mistral: /^[a-zA-Z0-9]+$/,
      };

      const pattern = patterns[provider];
      if (pattern && !pattern.test(apiKey)) {
        return { valid: false, error: "Invalid API key format" };
      }

      return { valid: true };
    }),
});

// ============ CHAT ROUTER ============

const chatRouter = router({
  history: protectedProcedure
    .input(z.object({
      contextType: z.enum(["project", "block", "section", "task"]),
      contextId: z.number(),
      limit: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return db.getChatHistory(
        input.contextType,
        input.contextId,
        ctx.user.id,
        input.limit
      );
    }),

  send: protectedProcedure
    .input(z.object({
      contextType: z.enum(["project", "block", "section", "task"]),
      contextId: z.number(),
      content: z.string().min(1),
      projectContext: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Save user message
      const userMessage = await db.createChatMessage({
        userId: ctx.user.id,
        contextType: input.contextType,
        contextId: input.contextId,
        role: "user",
        content: input.content,
      });

      // Get chat history for context (excluding the message we just saved)
      const history = await db.getChatHistory(
        input.contextType,
        input.contextId,
        ctx.user.id,
        10
      );

      // Build messages for LLM
      const systemPrompt = `Ты AI-ассистент для управления проектами и дорожными картами в платформе MAYDON Roadmap Hub.
Ты помогаешь пользователю планировать, анализировать и выполнять задачи.
${input.projectContext ? `Контекст проекта: ${input.projectContext}` : ""}

Отвечай на русском языке, если пользователь пишет на русском.
Будь конкретным и полезным. Если нужна дополнительная информация, спроси.
Форматируй ответы с использованием markdown для лучшей читаемости.`;

      // Filter out the current message from history to avoid duplication
      const filteredHistory = history.filter(msg => msg.id !== userMessage.id);

      const messages = [
        { role: "system" as const, content: systemPrompt },
        ...filteredHistory.reverse().map(msg => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
        { role: "user" as const, content: input.content },
      ];

      try {
        // Call the built-in Manus LLM (always available)
        const response = await invokeLLM({ messages });
        const aiContent = typeof response.choices[0]?.message?.content === 'string' 
          ? response.choices[0].message.content 
          : 'Не удалось получить ответ от AI';

        const assistantMessage = await db.createChatMessage({
          userId: ctx.user.id,
          contextType: input.contextType,
          contextId: input.contextId,
          role: "assistant",
          content: aiContent,
          provider: "manus",
          model: "gemini-2.5-flash",
        });

        return { userMessage, assistantMessage };
      } catch (error) {
        console.error("AI call failed:", error);
        const assistantMessage = await db.createChatMessage({
          userId: ctx.user.id,
          contextType: input.contextType,
          contextId: input.contextId,
          role: "assistant",
          content: "⚠️ Произошла ошибка при обращении к AI. Попробуйте позже.",
        });
        return { userMessage, assistantMessage };
      }
    }),

  clear: protectedProcedure
    .input(z.object({
      contextType: z.enum(["project", "block", "section", "task"]),
      contextId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      return db.clearChatHistory(input.contextType, input.contextId, ctx.user.id);
    }),
});

// ============ MAIN ROUTER ============
export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  project: projectRouter,
  block: blockRouter,
  section: sectionRouter,
  task: taskRouter,
  subtask: subtaskRouter,
  aiSettings: aiSettingsRouter,
  chat: chatRouter,
});

export type AppRouter = typeof appRouter;

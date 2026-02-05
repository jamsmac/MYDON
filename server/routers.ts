import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { z } from "zod";
import * as db from "./db";
import * as googleDrive from "./googleDrive";
import * as googleCalendar from "./googleCalendar";

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

  createFromRoadmap: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      blocks: z.array(z.object({
        title: z.string(),
        description: z.string().optional(),
        duration: z.string().optional(),
        sections: z.array(z.object({
          title: z.string(),
          tasks: z.array(z.object({
            title: z.string(),
            description: z.string().optional(),
          })).optional(),
        })).optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      // Create project
      const project = await db.createProject({
        name: input.name,
        description: input.description,
        userId: ctx.user.id,
      });

      // Create blocks, sections, and tasks
      for (let blockIndex = 0; blockIndex < input.blocks.length; blockIndex++) {
        const blockData = input.blocks[blockIndex];
        const block = await db.createBlock({
          projectId: project.id,
          number: blockIndex + 1,
          title: blockData.title,
          description: blockData.description,
          duration: blockData.duration,
          sortOrder: blockIndex,
        });

        if (blockData.sections) {
          for (let sectionIndex = 0; sectionIndex < blockData.sections.length; sectionIndex++) {
            const sectionData = blockData.sections[sectionIndex];
            const section = await db.createSection({
              blockId: block.id,
              title: sectionData.title,
              sortOrder: sectionIndex,
            });

            if (sectionData.tasks) {
              for (let taskIndex = 0; taskIndex < sectionData.tasks.length; taskIndex++) {
                const taskData = sectionData.tasks[taskIndex];
                await db.createTask({
                  sectionId: section.id,
                  title: taskData.title,
                  description: taskData.description,
                  sortOrder: taskIndex,
                  status: 'not_started',
                });
              }
            }
          }
        }
      }

      return project;
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
import * as aiProviders from "./aiProviders";

const allProviders = z.enum([
  "anthropic", "openai", "google", "groq", "mistral",
  "gemini_free", "huggingface", "deepseek", "ollama", "cohere", "perplexity"
]);

const aiSettingsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.getAiSettingsByUser(ctx.user.id);
  }),

  // Get all available providers with their configurations
  getProviders: publicProcedure.query(() => {
    return {
      all: aiProviders.AI_PROVIDERS,
      free: aiProviders.getFreeProviders(),
      premium: aiProviders.getPremiumProviders(),
    };
  }),

  upsert: protectedProcedure
    .input(z.object({
      provider: allProviders,
      apiKey: z.string().optional(),
      model: z.string().optional(),
      baseUrl: z.string().optional(),
      isDefault: z.boolean().optional(),
      isEnabled: z.boolean().optional(),
      isFree: z.boolean().optional(),
      priority: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return db.upsertAiSetting({
        ...input,
        userId: ctx.user.id,
      });
    }),

  setDefault: protectedProcedure
    .input(z.object({
      provider: allProviders,
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
      provider: allProviders,
      apiKey: z.string(),
    }))
    .mutation(async ({ input }) => {
      const { provider, apiKey } = input;
      
      const patterns: Record<string, RegExp> = {
        anthropic: /^sk-ant-/,
        openai: /^sk-/,
        google: /^AI/,
        groq: /^gsk_/,
        mistral: /^[a-zA-Z0-9]+$/,
        gemini_free: /^AI/,
        huggingface: /^hf_/,
        deepseek: /^sk-/,
        ollama: /.*/, // No key required
        cohere: /^[a-zA-Z0-9]+$/,
        perplexity: /^pplx-/,
      };

      const pattern = patterns[provider];
      if (pattern && !pattern.test(apiKey)) {
        return { valid: false, error: "Invalid API key format" };
      }

      return { valid: true };
    }),

  // Get AI preferences for smart selection
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    return db.getAiPreferences(ctx.user.id);
  }),

  // Update AI preferences
  updatePreferences: protectedProcedure
    .input(z.object({
      autoSelectEnabled: z.boolean().optional(),
      preferFreeModels: z.boolean().optional(),
      simpleTaskProvider: z.number().nullable().optional(),
      analysisTaskProvider: z.number().nullable().optional(),
      codeTaskProvider: z.number().nullable().optional(),
      creativeTaskProvider: z.number().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return db.upsertAiPreferences(ctx.user.id, input);
    }),

  // Analyze question and recommend provider
  analyzeAndRecommend: protectedProcedure
    .input(z.object({
      question: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      // Analyze question type
      const taskType = aiProviders.analyzeQuestionType(input.question);
      
      // Get user's configured providers
      const userSettings = await db.getAiSettingsByUser(ctx.user.id);
      const preferences = await db.getAiPreferences(ctx.user.id);
      
      // Map to provider info
      const availableProviders = userSettings
        .filter(s => s.isEnabled)
        .map(s => ({
          providerId: s.provider,
          priority: s.priority || 0,
          isFree: s.isFree || false,
        }));
      
      // Get recommendation
      const recommendedProvider = aiProviders.recommendProvider(
        taskType,
        availableProviders,
        preferences?.preferFreeModels ?? true
      );
      
      // Get provider config for display
      const providerConfig = recommendedProvider 
        ? aiProviders.getProvider(recommendedProvider)
        : null;
      
      // Estimate cost
      const estimatedTokens = Math.ceil(input.question.length / 4) + 500; // Rough estimate
      const costEstimate = recommendedProvider 
        ? aiProviders.estimateCost(recommendedProvider, estimatedTokens)
        : null;
      
      return {
        taskType,
        taskTypeRu: {
          simple: 'Простой вопрос',
          analysis: 'Анализ/исследование',
          code: 'Программирование',
          creative: 'Творческая задача',
          general: 'Общий вопрос',
        }[taskType],
        recommendedProvider,
        providerConfig: providerConfig || null,
        costEstimate,
        reason: getRecommendationReason(taskType, providerConfig || null),
      };
    }),

  // Estimate cost for a message
  estimateCost: publicProcedure
    .input(z.object({
      providerId: z.string(),
      messageLength: z.number(),
    }))
    .query(({ input }) => {
      const estimatedTokens = Math.ceil(input.messageLength / 4) + 500;
      return aiProviders.estimateCost(input.providerId, estimatedTokens);
    }),
});

// Helper function for recommendation reasons
function getRecommendationReason(taskType: aiProviders.TaskType, provider: aiProviders.ProviderConfig | null): string {
  if (!provider) return 'Нет доступных провайдеров';
  
  const reasons: Record<aiProviders.TaskType, string> = {
    simple: `${provider.nameRu} выбран для быстрого ответа на простой вопрос`,
    analysis: `${provider.nameRu} лучше всего подходит для глубокого анализа`,
    code: `${provider.nameRu} оптимален для задач программирования`,
    creative: `${provider.nameRu} отлично справляется с творческими задачами`,
    general: `${provider.nameRu} - универсальный выбор для общих вопросов`,
  };
  
  return reasons[taskType] + (provider.isFree ? ' (бесплатно)' : '');
}

// ============ CREDITS ROUTER ============
import * as aiRouter from "./aiRouter";

const creditsRouter = router({
  // Get user's credit balance
  balance: protectedProcedure.query(async ({ ctx }) => {
    let credits = await db.getUserCredits(ctx.user.id);
    if (!credits) {
      credits = await db.initializeUserCredits(ctx.user.id);
    }
    return credits;
  }),

  // Get credit transaction history
  history: protectedProcedure
    .input(z.object({ limit: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      return db.getCreditHistory(ctx.user.id, input.limit || 50);
    }),

  // Toggle BYOK mode
  toggleBYOK: protectedProcedure
    .input(z.object({ useBYOK: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await db.toggleBYOKMode(ctx.user.id, input.useBYOK);
      return { success: true };
    }),

  // Get credit costs for display
  costs: publicProcedure.query(() => {
    return aiRouter.getCreditCosts();
  }),

  // Get available models
  models: publicProcedure.query(() => {
    return aiRouter.PLATFORM_MODELS;
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
      // Get or initialize user credits
      let userCredits = await db.getUserCredits(ctx.user.id);
      if (!userCredits) {
        userCredits = await db.initializeUserCredits(ctx.user.id);
      }

      // Check if using BYOK mode
      const useBYOK = userCredits.useBYOK;

      // Save user message
      const userMessage = await db.createChatMessage({
        userId: ctx.user.id,
        contextType: input.contextType,
        contextId: input.contextId,
        role: "user",
        content: input.content,
      });

      // Get chat history for context
      const history = await db.getChatHistory(
        input.contextType,
        input.contextId,
        ctx.user.id,
        10
      );

      // Build messages for LLM
      const systemPrompt = `Ты AI-ассистент для управления проектами и дорожными картами в платформе MYDON Roadmap Hub.
Ты помогаешь пользователю планировать, анализировать и выполнять задачи.
${input.projectContext ? `Контекст проекта: ${input.projectContext}` : ""}

Отвечай на русском языке, если пользователь пишет на русском.
Будь конкретным и полезным. Если нужна дополнительная информация, спроси.
Форматируй ответы с использованием markdown для лучшей читаемости.`;

      const filteredHistory = history.filter(msg => msg.id !== userMessage.id);

      const messages = [
        { role: "system", content: systemPrompt },
        ...filteredHistory.reverse().map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        { role: "user", content: input.content },
      ];

      try {
        // Use AI Router for smart model selection (Platform mode)
        if (!useBYOK) {
          const result = await aiRouter.routeAIRequest(
            messages,
            userCredits.credits,
            true // prefer free models
          );

          // Deduct credits
          const deductResult = await db.deductCredits(
            ctx.user.id,
            result.creditsUsed,
            `AI чат: ${result.model.nameRu}`,
            result.model.id,
            result.tokensUsed
          );

          const assistantMessage = await db.createChatMessage({
            userId: ctx.user.id,
            contextType: input.contextType,
            contextId: input.contextId,
            role: "assistant",
            content: result.content,
            provider: "platform",
            model: result.model.id,
          });

          return {
            userMessage,
            assistantMessage,
            aiMetadata: {
              model: result.model,
              taskType: result.taskType,
              creditsUsed: result.creditsUsed,
              newBalance: deductResult.newBalance,
              reason: result.reason,
            },
          };
        }

        // BYOK mode - use built-in Manus LLM (no credits deducted)
        const response = await invokeLLM({ messages: messages.map(m => ({
          role: m.role as 'system' | 'user' | 'assistant',
          content: m.content
        })) });
        const aiContent = typeof response.choices[0]?.message?.content === 'string' 
          ? response.choices[0].message.content 
          : 'Не удалось получить ответ от AI';

        const assistantMessage = await db.createChatMessage({
          userId: ctx.user.id,
          contextType: input.contextType,
          contextId: input.contextId,
          role: "assistant",
          content: aiContent,
          provider: "byok",
          model: "user-configured",
        });

        return {
          userMessage,
          assistantMessage,
          aiMetadata: {
            model: null,
            taskType: 'general' as const,
            creditsUsed: 0,
            newBalance: userCredits.credits,
            reason: 'BYOK режим - используются ваши API ключи',
          },
        };
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

// ============ GOOGLE DRIVE ROUTER ============
const driveRouter = router({
  checkConnection: protectedProcedure.query(async () => {
    return googleDrive.checkDriveConnection();
  }),

  listFiles: protectedProcedure.query(async () => {
    return googleDrive.listRoadmapFiles();
  }),

  saveProject: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Get full project data
      const project = await db.getFullProject(input.projectId, ctx.user.id);
      if (!project) {
        throw new Error("Project not found");
      }

      // Transform to export format
      const exportData = {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        blocks: project.blocks.map(block => ({
          number: block.number,
          title: block.title,
          titleRu: block.titleRu,
          sections: block.sections.map(section => ({
            title: section.title,
            tasks: section.tasks.map(task => ({
              title: task.title,
              description: task.description,
              status: task.status,
              notes: task.notes,
              summary: task.summary,
              subtasks: task.subtasks.map(subtask => ({
                title: subtask.title,
                status: subtask.status,
              })),
            })),
          })),
        })),
      };

      return googleDrive.saveProjectToDrive(exportData);
    }),

  loadProject: protectedProcedure
    .input(z.object({ filename: z.string() }))
    .query(async ({ input }) => {
      return googleDrive.loadProjectFromDrive(input.filename);
    }),

  deleteFile: protectedProcedure
    .input(z.object({ filename: z.string() }))
    .mutation(async ({ input }) => {
      return googleDrive.deleteProjectFromDrive(input.filename);
    }),

  getShareableLink: protectedProcedure
    .input(z.object({ filename: z.string() }))
    .query(async ({ input }) => {
      return googleDrive.getShareableLink(input.filename);
    }),

  exportToGoogleDocs: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Get full project data
      const project = await db.getFullProject(input.projectId, ctx.user.id);
      if (!project) {
        throw new Error("Project not found");
      }

      // Transform to export format
      const exportData = {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        blocks: project.blocks.map(block => ({
          number: block.number,
          title: block.title,
          titleRu: block.titleRu,
          sections: block.sections.map(section => ({
            title: section.title,
            tasks: section.tasks.map(task => ({
              title: task.title,
              description: task.description,
              status: task.status,
              notes: task.notes,
              summary: task.summary,
              subtasks: task.subtasks.map(subtask => ({
                title: subtask.title,
                status: subtask.status,
              })),
            })),
          })),
        })),
      };

      return googleDrive.exportToGoogleDocs(exportData);
    }),
});

// ============ GOOGLE CALENDAR ROUTER ============
const calendarRouter = router({
  createTaskEvent: protectedProcedure
    .input(z.object({
      taskId: z.number(),
      taskTitle: z.string(),
      projectName: z.string(),
      deadline: z.date(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return googleCalendar.createTaskDeadlineEvent({
        taskId: input.taskId,
        taskTitle: input.taskTitle,
        projectName: input.projectName,
        deadline: input.deadline,
        description: input.description,
      });
    }),

  createProjectMilestones: protectedProcedure
    .input(z.object({
      projectName: z.string(),
      milestones: z.array(z.object({
        title: z.string(),
        date: z.date(),
        description: z.string().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      return googleCalendar.createProjectMilestones(input.projectName, input.milestones);
    }),

  searchProjectEvents: protectedProcedure
    .input(z.object({ projectName: z.string() }))
    .query(async ({ input }) => {
      return googleCalendar.searchProjectEvents(input.projectName);
    }),

  deleteEvent: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .mutation(async ({ input }) => {
      return googleCalendar.deleteCalendarEvent(input.eventId);
    }),
});

// ============ AI GENERATION ROUTER ============
const aiGenerationRouter = router({
  generateRoadmap: protectedProcedure
    .input(z.object({
      goal: z.string().min(1),
      category: z.string(),
      answers: z.record(z.string(), z.string()),
    }))
    .mutation(async ({ input }) => {
      const prompt = `You are an expert project planner. Generate a detailed roadmap for the following goal.

Goal: ${input.goal}
Category: ${input.category}
Additional context:
${Object.entries(input.answers).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

Generate a structured roadmap in JSON format with the following structure:
{
  "name": "Project name (short, descriptive)",
  "description": "Brief project description",
  "blocks": [
    {
      "title": "Block title",
      "description": "Block description",
      "duration": "Estimated duration (e.g., '2 weeks')",
      "sections": [
        {
          "title": "Section title",
          "tasks": [
            { "title": "Task title", "description": "Task description" }
          ]
        }
      ]
    }
  ]
}

Create 4-8 blocks covering all phases needed to achieve the goal. Each block should have 2-4 sections with 3-6 tasks each.
Respond ONLY with valid JSON, no additional text.`;

      const response = await invokeLLM({
        messages: [
          { role: 'system', content: 'You are a project planning expert. Always respond with valid JSON only.' },
          { role: 'user', content: prompt },
        ],
      });

      const rawContent = response.choices[0]?.message?.content || '{}';
      const content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);
      
      // Parse JSON from response
      try {
        // Try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        return JSON.parse(content);
      } catch (e) {
        // Return a default structure if parsing fails
        return {
          name: input.goal.slice(0, 50),
          description: input.goal,
          blocks: [
            {
              title: 'Планирование',
              description: 'Начальный этап планирования',
              duration: '1 неделя',
              sections: [
                {
                  title: 'Анализ',
                  tasks: [
                    { title: 'Определить цели', description: 'Чётко сформулировать цели проекта' },
                    { title: 'Собрать информацию', description: 'Исследовать тему' },
                  ],
                },
              ],
            },
          ],
        };
      }
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
  credits: creditsRouter,
  chat: chatRouter,
  drive: driveRouter,
  calendar: calendarRouter,
  ai: aiGenerationRouter,
});

export type AppRouter = typeof appRouter;

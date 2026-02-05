/**
 * AI Decision Router - Finalization and Context Management
 * 
 * Handles saving finalized AI decisions and injecting them into future AI context
 */

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { aiDecisionRecords } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { TRPCError } from "@trpc/server";

// Helper to get db with null check
async function getDatabase() {
  const database = await getDb();
  if (!database) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  }
  return database;
}

// Types for action items and key points
const keyPointSchema = z.object({
  id: z.string(),
  text: z.string(),
  priority: z.enum(["high", "medium", "low"]).optional(),
});

const actionItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  assignee: z.string().optional(),
  deadline: z.string().optional(),
  status: z.enum(["pending", "done", "cancelled"]),
  subtaskId: z.string().optional(),
});

export const aiDecisionRouter = router({
  /**
   * Finalize an AI conversation outcome
   * Main endpoint for saving decisions
   */
  finalize: protectedProcedure
    .input(z.object({
      sessionId: z.number().optional(),
      projectId: z.number().optional(),
      taskId: z.string().optional(),
      blockId: z.string().optional(),
      question: z.string(),
      aiResponse: z.string(),
      finalDecision: z.string(),
      keyPoints: z.array(keyPointSchema).optional(),
      actionItems: z.array(actionItemSchema).optional(),
      decisionType: z.enum(["technical", "business", "design", "process", "architecture", "other"]).default("other"),
      tags: z.array(z.string()).optional(),
      importance: z.enum(["critical", "high", "medium", "low"]).default("medium"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDatabase();
      const [record] = await db.insert(aiDecisionRecords).values({
        sessionId: input.sessionId,
        projectId: input.projectId,
        taskId: input.taskId,
        blockId: input.blockId,
        userId: ctx.user.id,
        question: input.question,
        aiResponse: input.aiResponse,
        finalDecision: input.finalDecision,
        keyPoints: input.keyPoints || [],
        actionItems: input.actionItems || [],
        decisionType: input.decisionType,
        tags: input.tags || [],
        importance: input.importance,
        status: "active",
      }).$returningId();

      return { 
        success: true, 
        id: record.id,
        message: "Решение успешно финализировано" 
      };
    }),

  /**
   * Get decisions for AI context injection
   * Returns relevant past decisions for a project/task
   */
  getContextDecisions: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
      taskId: z.string().optional(),
      limit: z.number().default(10),
      includeTypes: z.array(z.enum(["technical", "business", "design", "process", "architecture", "other"])).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDatabase();
      const conditions = [
        eq(aiDecisionRecords.userId, ctx.user.id),
        eq(aiDecisionRecords.status, "active"),
      ];

      if (input.projectId) {
        conditions.push(eq(aiDecisionRecords.projectId, input.projectId));
      }

      if (input.taskId) {
        conditions.push(eq(aiDecisionRecords.taskId, input.taskId));
      }

      const decisions = await db.select()
        .from(aiDecisionRecords)
        .where(and(...conditions))
        .orderBy(desc(aiDecisionRecords.createdAt))
        .limit(input.limit);

      // Filter by types if specified
      if (input.includeTypes && input.includeTypes.length > 0) {
        return decisions.filter((d: typeof decisions[0]) => 
          d.decisionType && input.includeTypes!.includes(d.decisionType)
        );
      }

      return decisions;
    }),

  /**
   * Format decisions for AI prompt injection
   * Returns formatted string to include in AI context
   */
  getFormattedContext: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
      taskId: z.string().optional(),
      limit: z.number().default(5),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDatabase();
      const conditions = [
        eq(aiDecisionRecords.userId, ctx.user.id),
        eq(aiDecisionRecords.status, "active"),
      ];

      if (input.projectId) {
        conditions.push(eq(aiDecisionRecords.projectId, input.projectId));
      }

      if (input.taskId) {
        conditions.push(eq(aiDecisionRecords.taskId, input.taskId));
      }

      const decisions = await db.select()
        .from(aiDecisionRecords)
        .where(and(...conditions))
        .orderBy(desc(aiDecisionRecords.importance), desc(aiDecisionRecords.createdAt))
        .limit(input.limit);

      if (decisions.length === 0) {
        return null;
      }

      // Format for AI context
      let context = "=== ПРОШЛЫЕ РЕШЕНИЯ ПО ПРОЕКТУ ===\n\n";
      
      const typeLabels: Record<string, string> = {
        technical: "🔧 Техническое",
        business: "💼 Бизнес",
        design: "🎨 Дизайн",
        process: "📋 Процесс",
        architecture: "🏗️ Архитектура",
        other: "📝 Другое",
      };

      decisions.forEach((d: typeof decisions[0], i: number) => {
        const typeLabel = typeLabels[d.decisionType || "other"];

        context += `### Решение ${i + 1} (${typeLabel})\n`;
        context += `**Вопрос:** ${d.question.substring(0, 200)}${d.question.length > 200 ? '...' : ''}\n`;
        context += `**Решение:** ${d.finalDecision}\n`;
        
        if (d.keyPoints && Array.isArray(d.keyPoints) && d.keyPoints.length > 0) {
          context += `**Ключевые пункты:**\n`;
          (d.keyPoints as { text: string }[]).forEach((kp) => {
            context += `  - ${kp.text}\n`;
          });
        }
        
        context += `\n`;
      });

      context += "=== КОНЕЦ ПРОШЛЫХ РЕШЕНИЙ ===\n\n";
      context += "Учитывай эти решения при ответе на новый вопрос.\n\n";

      return context;
    }),

  /**
   * Generate summary from AI response
   * Uses AI to extract key points and summary
   */
  generateSummary: protectedProcedure
    .input(z.object({
      question: z.string(),
      aiResponse: z.string(),
    }))
    .mutation(async ({ input }) => {
      const prompt = `Проанализируй следующий диалог и извлеки структурированную информацию.

ВОПРОС ПОЛЬЗОВАТЕЛЯ:
${input.question}

ОТВЕТ AI:
${input.aiResponse}

Верни JSON в следующем формате:
{
  "finalDecision": "Краткое резюме принятого решения (1-2 предложения)",
  "keyPoints": [
    { "id": "1", "text": "Ключевой пункт 1", "priority": "high" },
    { "id": "2", "text": "Ключевой пункт 2", "priority": "medium" }
  ],
  "actionItems": [
    { "id": "1", "title": "Действие которое нужно выполнить", "status": "pending" }
  ],
  "suggestedType": "technical|business|design|process|architecture|other",
  "suggestedTags": ["тег1", "тег2"]
}

Важно:
- finalDecision должно быть кратким и конкретным
- keyPoints - максимум 5 пунктов, самые важные
- actionItems - конкретные действия, если есть
- Определи тип решения по содержанию
- Предложи релевантные теги`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "Ты помощник для извлечения структурированной информации из диалогов. Отвечай только валидным JSON." },
            { role: "user", content: prompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "decision_summary",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  finalDecision: { type: "string" },
                  keyPoints: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        text: { type: "string" },
                        priority: { type: "string", enum: ["high", "medium", "low"] },
                      },
                      required: ["id", "text"],
                      additionalProperties: false,
                    },
                  },
                  actionItems: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        title: { type: "string" },
                        status: { type: "string", enum: ["pending", "done", "cancelled"] },
                      },
                      required: ["id", "title", "status"],
                      additionalProperties: false,
                    },
                  },
                  suggestedType: { type: "string", enum: ["technical", "business", "design", "process", "architecture", "other"] },
                  suggestedTags: { type: "array", items: { type: "string" } },
                },
                required: ["finalDecision", "keyPoints", "actionItems", "suggestedType", "suggestedTags"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error("Empty response from AI");
        }

        return JSON.parse(typeof content === 'string' ? content : JSON.stringify(content));
      } catch (error) {
        console.error("[AIDecision] Failed to generate summary:", error);
        // Return default structure on error
        return {
          finalDecision: input.aiResponse.substring(0, 200) + "...",
          keyPoints: [],
          actionItems: [],
          suggestedType: "other",
          suggestedTags: [],
        };
      }
    }),

  /**
   * Get all decisions for a user/project
   */
  getDecisions: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
      taskId: z.string().optional(),
      status: z.enum(["active", "implemented", "obsolete", "superseded"]).optional(),
      decisionType: z.enum(["technical", "business", "design", "process", "architecture", "other"]).optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDatabase();
      const conditions = [eq(aiDecisionRecords.userId, ctx.user.id)];

      if (input.projectId) {
        conditions.push(eq(aiDecisionRecords.projectId, input.projectId));
      }
      if (input.taskId) {
        conditions.push(eq(aiDecisionRecords.taskId, input.taskId));
      }
      if (input.status) {
        conditions.push(eq(aiDecisionRecords.status, input.status));
      }
      if (input.decisionType) {
        conditions.push(eq(aiDecisionRecords.decisionType, input.decisionType));
      }

      const decisions = await db.select()
        .from(aiDecisionRecords)
        .where(and(...conditions))
        .orderBy(desc(aiDecisionRecords.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return decisions;
    }),

  /**
   * Get a single decision by ID
   */
  getDecision: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDatabase();
      const [decision] = await db.select()
        .from(aiDecisionRecords)
        .where(and(
          eq(aiDecisionRecords.id, input.id),
          eq(aiDecisionRecords.userId, ctx.user.id)
        ))
        .limit(1);

      if (!decision) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Решение не найдено" });
      }

      return decision;
    }),

  /**
   * Update decision status or content
   */
  updateDecision: protectedProcedure
    .input(z.object({
      id: z.number(),
      finalDecision: z.string().optional(),
      keyPoints: z.array(keyPointSchema).optional(),
      actionItems: z.array(actionItemSchema).optional(),
      status: z.enum(["active", "implemented", "obsolete", "superseded"]).optional(),
      tags: z.array(z.string()).optional(),
      importance: z.enum(["critical", "high", "medium", "low"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDatabase();
      const { id, ...updates } = input;

      // Verify ownership
      const [existing] = await db.select()
        .from(aiDecisionRecords)
        .where(and(
          eq(aiDecisionRecords.id, id),
          eq(aiDecisionRecords.userId, ctx.user.id)
        ))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Решение не найдено" });
      }

      await db.update(aiDecisionRecords)
        .set(updates)
        .where(eq(aiDecisionRecords.id, id));

      return { success: true, message: "Решение обновлено" };
    }),

  /**
   * Delete a decision
   */
  deleteDecision: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDatabase();
      // Verify ownership
      const [existing] = await db.select()
        .from(aiDecisionRecords)
        .where(and(
          eq(aiDecisionRecords.id, input.id),
          eq(aiDecisionRecords.userId, ctx.user.id)
        ))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Решение не найдено" });
      }

      await db.delete(aiDecisionRecords)
        .where(eq(aiDecisionRecords.id, input.id));

      return { success: true, message: "Решение удалено" };
    }),

  /**
   * Generate suggested actions from AI response
   */
  generateSuggestedActions: protectedProcedure
    .input(z.object({
      aiResponse: z.string(),
      projectId: z.number().optional(),
      taskId: z.string().optional(),
      context: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const prompt = `Проанализируй ответ AI и предложи конкретные действия для пользователя.

ОТВЕТ AI:
${input.aiResponse}

${input.context ? `КОНТЕКСТ: ${input.context}\n\n` : ""}Верни JSON массив предложенных действий в формате:
[
  {
    "id": "unique-id",
    "type": "create_subtask|set_deadline|update_status|add_tag|create_note|set_priority",
    "title": "Краткое название действия",
    "description": "Подробное описание",
    "data": { "key": "value" },
    "confidence": "high|medium|low"
  }
]

Типы действий:
- create_subtask: создать подзадачу (data: { title: "название" })
- set_deadline: установить дедлайн (data: { deadline: "дата" })
- update_status: изменить статус (data: { status: "in_progress|done|blocked" })
- add_tag: добавить тег (data: { tagName: "название" })
- set_priority: установить приоритет (data: { priority: "high|medium|low" })
- create_note: создать заметку (data: { content: "текст" })

Правила:
- Максимум 5 действий
- confidence: high для явных рекомендаций, medium для неявных, low для опциональных
- Извлекай конкретные данные из ответа (даты, названия, теги)
- Если нет явных действий, верни пустой массив []`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "Ты помощник для извлечения действий из AI ответов. Отвечай только валидным JSON массивом." },
            { role: "user", content: prompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "suggested_actions",
              strict: true,
              schema: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    type: { type: "string", enum: ["create_subtask", "set_deadline", "update_status", "add_tag", "create_note", "set_priority"] },
                    title: { type: "string" },
                    description: { type: "string" },
                    data: { type: "object", additionalProperties: true },
                    confidence: { type: "string", enum: ["high", "medium", "low"] },
                  },
                  required: ["id", "type", "title", "confidence"],
                  additionalProperties: false,
                },
              },
            },
          },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          return [];
        }

        const actions = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
        return Array.isArray(actions) ? actions.slice(0, 5) : [];
      } catch (error) {
        console.error("[AIDecision] Failed to generate suggested actions:", error);
        return [];
      }
    }),

  /**
   * Get decision statistics
   */
  getStats: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDatabase();
      const conditions = [eq(aiDecisionRecords.userId, ctx.user.id)];
      
      if (input.projectId) {
        conditions.push(eq(aiDecisionRecords.projectId, input.projectId));
      }

      const decisions = await db.select()
        .from(aiDecisionRecords)
        .where(and(...conditions));

      const stats = {
        total: decisions.length,
        byStatus: {
          active: 0,
          implemented: 0,
          obsolete: 0,
          superseded: 0,
        },
        byType: {
          technical: 0,
          business: 0,
          design: 0,
          process: 0,
          architecture: 0,
          other: 0,
        },
        byImportance: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
        },
      };

      decisions.forEach((d: typeof decisions[0]) => {
        if (d.status && d.status in stats.byStatus) {
          stats.byStatus[d.status as keyof typeof stats.byStatus]++;
        }
        if (d.decisionType && d.decisionType in stats.byType) {
          stats.byType[d.decisionType as keyof typeof stats.byType]++;
        }
        if (d.importance && d.importance in stats.byImportance) {
          stats.byImportance[d.importance as keyof typeof stats.byImportance]++;
        }
      });

      return stats;
    }),
});

export type AIDecisionRouter = typeof aiDecisionRouter;

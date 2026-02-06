import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { streamLLM } from "./llmStream";
import { getUserFromRequest } from "./context";
import * as db from "../db";
import { serveStatic, setupVite } from "./vite";
import { generateMarkdownReport, generateHtmlReport } from "../export";
import { parseRoadmap, generateMarkdownTemplate, generateJsonTemplate } from "../import";
import { handleStripeWebhook } from "../stripe/webhookHandler";
import { checkAiRequestLimit, incrementAiUsage } from "../limits/limitsService";
import { initializeSocketServer } from "../realtime/socketServer";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // Stripe webhook must be registered BEFORE body parsers with raw body
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);
  
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // Streaming chat endpoint
  app.post("/api/chat/stream", async (req, res) => {
    try {
      const user = await getUserFromRequest(req);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { contextType, contextId, content, projectContext } = req.body;

      // Check AI request limit
      const limitCheck = await checkAiRequestLimit(user.id);
      if (!limitCheck.allowed) {
        res.status(403).json({ 
          error: limitCheck.message,
          limitReached: true,
          remaining: 0
        });
        return;
      }

      // Save user message
      const userMessage = await db.createChatMessage({
        userId: user.id,
        contextType,
        contextId,
        role: "user",
        content,
      });

      // Get chat history
      const history = await db.getChatHistory(contextType, contextId, user.id, 10);

      // Build messages for LLM
      const systemPrompt = `Ты AI-ассистент для управления проектами и дорожными картами в платформе MYDON Roadmap Hub.
Ты помогаешь пользователю планировать, анализировать и выполнять задачи.
${projectContext ? `Контекст проекта: ${projectContext}` : ""}

Отвечай на русском языке, если пользователь пишет на русском.
Будь конкретным и полезным. Если нужна дополнительная информация, спроси.
Форматируй ответы с использованием markdown для лучшей читаемости.`;

      const filteredHistory = history.filter(msg => msg.id !== userMessage.id);

      const messages = [
        { role: "system" as const, content: systemPrompt },
        ...filteredHistory.reverse().map(msg => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
        { role: "user" as const, content },
      ];

      // Set headers for SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-User-Message-Id", userMessage.id.toString());

      // Stream the response
      const stream = await streamLLM({ messages });
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          res.write(chunk);

          // Parse SSE to collect full content
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              try {
                const data = JSON.parse(line.slice(6));
                const content = data.choices?.[0]?.delta?.content;
                if (content) fullContent += content;
              } catch {}
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Save assistant message after streaming completes
      const assistantMessage = await db.createChatMessage({
        userId: user.id,
        contextType,
        contextId,
        role: "assistant",
        content: fullContent,
        provider: "manus",
        model: "gemini-2.5-flash",
      });

      // Increment AI usage counter
      await incrementAiUsage(user.id);

      // Send final event with message ID
      res.write(`\ndata: {"type":"done","assistantMessageId":${assistantMessage.id}}\n\n`);
      res.end();
    } catch (error) {
      console.error("Stream error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to stream response" });
      } else {
        res.write(`data: {"type":"error","message":"Stream failed"}\n\n`);
        res.end();
      }
    }
  });

  // AI Router streaming endpoint for AIChatPage
  app.post("/api/ai/stream", async (req, res) => {
    try {
      const user = await getUserFromRequest(req);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { messages, sessionId, taskType, projectContext } = req.body;

      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ error: "Messages array required" });
        return;
      }

      // Check AI request limit
      const limitCheck = await checkAiRequestLimit(user.id);
      if (!limitCheck.allowed) {
        res.status(403).json({ 
          error: limitCheck.message,
          limitReached: true,
          remaining: 0
        });
        return;
      }

      // Build system prompt based on task type
      const taskPrompts: Record<string, string> = {
        chat: "Ты полезный AI-ассистент. Отвечай на русском языке, если пользователь пишет на русском.",
        reasoning: "Ты аналитический AI-ассистент. Анализируй проблемы шаг за шагом, приводи логические аргументы.",
        coding: "Ты опытный программист. Пиши чистый, документированный код. Объясняй свои решения.",
        translation: "Ты профессиональный переводчик. Переводи точно, сохраняя стиль и контекст оригинала.",
        summarization: "Ты специалист по резюмированию. Выделяй ключевые моменты, создавай краткие и информативные сводки.",
        creative: "Ты креативный писатель. Генерируй оригинальные идеи, истории и контент.",
      };

      let systemPrompt = taskPrompts[taskType || 'chat'] || taskPrompts.chat;

      // Add project context if available
      if (projectContext) {
        systemPrompt += `\n\nКонтекст проекта пользователя:\n${projectContext}\n\nИспользуй эту информацию для ответов на вопросы о проекте, задачах и прогрессе.`;
      }

      const llmMessages = [
        { role: "system" as const, content: systemPrompt },
        ...messages.map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      // Set headers for SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Stream the response
      const stream = await streamLLM({ messages: llmMessages });
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      const startTime = Date.now();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          res.write(chunk);

          // Parse SSE to collect full content
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              try {
                const data = JSON.parse(line.slice(6));
                const content = data.choices?.[0]?.delta?.content;
                if (content) fullContent += content;
              } catch {}
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      const executionTime = Date.now() - startTime;

      // Log the request to aiRequests table
      const { getDb } = await import("../db");
      const schema = await import("../../drizzle/schema");
      const dbInstance = await getDb();
      if (dbInstance && fullContent) {
        const userPrompt = messages[messages.length - 1]?.content || '';
        await dbInstance.insert(schema.aiRequests).values({
          userId: user.id,
          sessionId: sessionId || null,
          prompt: userPrompt,
          response: fullContent,
          model: 'gemini-2.5-flash',
          taskType: taskType || 'chat',
          tokens: Math.ceil((userPrompt.length + fullContent.length) / 4),
          fromCache: false,
          executionTime,
        });
      }

      // Increment AI usage counter
      await incrementAiUsage(user.id);

      // Send final event
      res.write(`\ndata: {"type":"done","executionTime":${executionTime}}\n\n`);
      res.end();
    } catch (error) {
      console.error("AI Stream error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to stream response" });
      } else {
        res.write(`data: {"type":"error","message":"Stream failed"}\n\n`);
        res.end();
      }
    }
  });

  // Export endpoints
  app.get("/api/export/markdown/:projectId", async (req, res) => {
    try {
      const user = await getUserFromRequest(req);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const projectId = parseInt(req.params.projectId);
      const project = await db.getFullProject(projectId, user.id);
      
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const markdown = generateMarkdownReport(project as any);
      
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${project.name.replace(/[^a-zA-Z0-9а-яА-Я]/g, '_')}_report.md"`);
      res.send(markdown);
    } catch (error) {
      console.error("Export error:", error);
      res.status(500).json({ error: "Failed to export project" });
    }
  });

  app.get("/api/export/html/:projectId", async (req, res) => {
    try {
      const user = await getUserFromRequest(req);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const projectId = parseInt(req.params.projectId);
      const project = await db.getFullProject(projectId, user.id);
      
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const html = generateHtmlReport(project as any);
      
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${project.name.replace(/[^a-zA-Z0-9а-яА-Я]/g, '_')}_report.html"`);
      res.send(html);
    } catch (error) {
      console.error("Export error:", error);
      res.status(500).json({ error: "Failed to export project" });
    }
  });

  // JSON export endpoint
  app.get("/api/export/json/:projectId", async (req, res) => {
    try {
      const user = await getUserFromRequest(req);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const projectId = parseInt(req.params.projectId);
      const project = await db.getFullProject(projectId, user.id);
      
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      // Generate JSON export
      const exportData = {
        name: project.name,
        description: project.description,
        status: project.status,
        exportedAt: new Date().toISOString(),
        blocks: project.blocks?.map((block: any) => ({
          number: block.number,
          title: block.title,
          titleRu: block.titleRu,
          icon: block.icon,
          sections: block.sections?.map((section: any) => ({
            title: section.title,
            tasks: section.tasks?.map((task: any) => ({
              title: task.title,
              description: task.description,
              status: task.status,
              priority: task.priority,
              deadline: task.deadline,
              notes: task.notes,
              summary: task.summary,
              subtasks: task.subtasks?.map((subtask: any) => ({
                title: subtask.title,
                status: subtask.status
              }))
            }))
          }))
        }))
      };
      
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${project.name.replace(/[^a-zA-Z0-9а-яА-Я]/g, '_')}_export.json"`);
      res.send(JSON.stringify(exportData, null, 2));
    } catch (error) {
      console.error("Export error:", error);
      res.status(500).json({ error: "Failed to export project" });
    }
  });

  // CSV export endpoint (tasks only)
  app.get("/api/export/csv/:projectId", async (req, res) => {
    try {
      const user = await getUserFromRequest(req);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const projectId = parseInt(req.params.projectId);
      const project = await db.getFullProject(projectId, user.id);
      
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      // Generate CSV
      const headers = ['Block', 'Section', 'Task', 'Status', 'Priority', 'Deadline', 'Description'];
      const rows: string[][] = [];

      project.blocks?.forEach((block: any) => {
        block.sections?.forEach((section: any) => {
          section.tasks?.forEach((task: any) => {
            rows.push([
              block.titleRu || block.title,
              section.title,
              task.title,
              task.status || 'not_started',
              task.priority || '',
              task.deadline ? new Date(task.deadline).toISOString().split('T')[0] : '',
              (task.description || '').replace(/[\n\r,"]/g, ' ')
            ]);
          });
        });
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');
      
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${project.name.replace(/[^a-zA-Z0-9а-яА-Я]/g, '_')}_tasks.csv"`);
      res.send('\ufeff' + csvContent); // BOM for Excel UTF-8 support
    } catch (error) {
      console.error("Export error:", error);
      res.status(500).json({ error: "Failed to export project" });
    }
  });

  // Import roadmap endpoint
  app.post("/api/import/roadmap", async (req, res) => {
    try {
      const user = await getUserFromRequest(req);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { content, filename } = req.body;
      
      if (!content || typeof content !== 'string') {
        res.status(400).json({ error: "Missing or invalid content" });
        return;
      }

      // Parse the roadmap
      const parsed = parseRoadmap(content, filename);
      
      // Create the project
      const project = await db.createProject({
        userId: user.id,
        name: parsed.name,
        description: parsed.description || null,
        status: 'active'
      });

      // Create blocks, sections, tasks, and subtasks
      for (let blockIndex = 0; blockIndex < parsed.blocks.length; blockIndex++) {
        const blockData = parsed.blocks[blockIndex];
        
        const block = await db.createBlock({
          projectId: project.id,
          number: parseInt(blockData.number) || (blockIndex + 1),
          title: blockData.title,
          titleRu: blockData.titleRu || null,
          icon: blockData.icon || 'layers',
          sortOrder: blockIndex
        });

        if (blockData.sections) {
          for (let sectionIndex = 0; sectionIndex < blockData.sections.length; sectionIndex++) {
            const sectionData = blockData.sections[sectionIndex];
            
            const section = await db.createSection({
              blockId: block.id,
              title: sectionData.title,
              sortOrder: sectionIndex
            });

            if (sectionData.tasks) {
              for (let taskIndex = 0; taskIndex < sectionData.tasks.length; taskIndex++) {
                const taskData = sectionData.tasks[taskIndex];
                
                const task = await db.createTask({
                  sectionId: section.id,
                  title: taskData.title,
                  description: taskData.description || null,
                  status: taskData.status || 'not_started',
                  notes: taskData.notes || null,
                  summary: taskData.finalDocument || null,
                  sortOrder: taskIndex
                });

                if (taskData.subtasks) {
                  for (let subtaskIndex = 0; subtaskIndex < taskData.subtasks.length; subtaskIndex++) {
                    const subtaskData = taskData.subtasks[subtaskIndex];
                    
                    await db.createSubtask({
                      taskId: task.id,
                      title: subtaskData.title,
                      status: subtaskData.completed ? 'completed' : 'not_started',
                      sortOrder: subtaskIndex
                    });
                  }
                }
              }
            }
          }
        }
      }

      res.json({ 
        success: true, 
        projectId: project.id,
        stats: {
          blocks: parsed.blocks.length,
          sections: parsed.blocks.reduce((acc, b) => acc + (b.sections?.length || 0), 0),
          tasks: parsed.blocks.reduce((acc, b) => 
            acc + (b.sections?.reduce((sacc, s) => sacc + (s.tasks?.length || 0), 0) || 0), 0)
        }
      });
    } catch (error) {
      console.error("Import error:", error);
      res.status(400).json({ 
        error: error instanceof Error ? error.message : "Failed to import roadmap" 
      });
    }
  });

  // Preview import (parse without creating)
  app.post("/api/import/preview", async (req, res) => {
    try {
      const user = await getUserFromRequest(req);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { content, filename } = req.body;
      
      if (!content || typeof content !== 'string') {
        res.status(400).json({ error: "Missing or invalid content" });
        return;
      }

      const parsed = parseRoadmap(content, filename);
      
      res.json({ 
        success: true, 
        preview: parsed,
        stats: {
          blocks: parsed.blocks.length,
          sections: parsed.blocks.reduce((acc, b) => acc + (b.sections?.length || 0), 0),
          tasks: parsed.blocks.reduce((acc, b) => 
            acc + (b.sections?.reduce((sacc, s) => sacc + (s.tasks?.length || 0), 0) || 0), 0)
        }
      });
    } catch (error) {
      console.error("Preview error:", error);
      res.status(400).json({ 
        error: error instanceof Error ? error.message : "Failed to parse roadmap" 
      });
    }
  });

  // Get import templates
  app.get("/api/import/templates", async (req, res) => {
    res.json({
      markdown: generateMarkdownTemplate(),
      json: generateJsonTemplate()
    });
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Initialize Socket.io for real-time features
  initializeSocketServer(server);

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);

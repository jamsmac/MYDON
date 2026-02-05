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
      const systemPrompt = `Ты AI-ассистент для управления проектами и дорожными картами в платформе MAYDON Roadmap Hub.
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

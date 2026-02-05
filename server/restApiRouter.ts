import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { apiKeys, apiUsage, projects, blocks, sections, tasks, subtasks } from "../drizzle/schema";
import { eq, and, desc, gte, sql, lt } from "drizzle-orm";
import crypto from "crypto";

// API Scopes
export const API_SCOPES = [
  "projects:read",
  "projects:write",
  "tasks:read",
  "tasks:write",
  "blocks:read",
  "blocks:write",
  "sections:read",
  "sections:write",
  "subtasks:read",
  "subtasks:write",
  "analytics:read",
] as const;

export type ApiScope = typeof API_SCOPES[number];

// Generate API key
function generateApiKey(): { key: string; hash: string; prefix: string } {
  const key = `mr_${crypto.randomBytes(32).toString("hex")}`;
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  const prefix = key.substring(0, 11); // "mr_" + 8 chars
  return { key, hash, prefix };
}

// Verify API key
async function verifyApiKey(key: string): Promise<{
  valid: boolean;
  apiKey?: typeof apiKeys.$inferSelect;
  error?: string;
}> {
  const db = await getDb();
  if (!db) return { valid: false, error: "Database not available" };

  const hash = crypto.createHash("sha256").update(key).digest("hex");

  const [apiKey] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, hash));

  if (!apiKey) {
    return { valid: false, error: "Invalid API key" };
  }

  if (!apiKey.isActive) {
    return { valid: false, error: "API key is disabled" };
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return { valid: false, error: "API key has expired" };
  }

  // Check rate limit
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [usageCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(apiUsage)
    .where(
      and(
        eq(apiUsage.apiKeyId, apiKey.id),
        gte(apiUsage.createdAt, oneHourAgo)
      )
    );

  if (usageCount && usageCount.count >= (apiKey.rateLimit || 1000)) {
    return { valid: false, error: "Rate limit exceeded" };
  }

  // Update last used
  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, apiKey.id));

  return { valid: true, apiKey };
}

// OpenAPI/Swagger specification
export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "MYDON Roadmap API",
    description: "REST API for managing roadmaps, projects, tasks, and more",
    version: "1.0.0",
    contact: {
      name: "MYDON Support",
      email: "support@mydon.app",
    },
  },
  servers: [
    {
      url: "/api/v1",
      description: "Production server",
    },
  ],
  security: [
    {
      ApiKeyAuth: [],
    },
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "X-API-Key",
        description: "API key for authentication. Get one from Settings > API Keys",
      },
    },
    schemas: {
      Project: {
        type: "object",
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          description: { type: "string", nullable: true },
          icon: { type: "string" },
          color: { type: "string" },
          status: { type: "string", enum: ["active", "archived", "completed"] },
          startDate: { type: "string", format: "date-time", nullable: true },
          targetDate: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Block: {
        type: "object",
        properties: {
          id: { type: "integer" },
          projectId: { type: "integer" },
          number: { type: "integer" },
          title: { type: "string" },
          description: { type: "string", nullable: true },
          icon: { type: "string" },
          duration: { type: "string", nullable: true },
          deadline: { type: "string", format: "date-time", nullable: true },
          sortOrder: { type: "integer" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Section: {
        type: "object",
        properties: {
          id: { type: "integer" },
          blockId: { type: "integer" },
          title: { type: "string" },
          description: { type: "string", nullable: true },
          sortOrder: { type: "integer" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Task: {
        type: "object",
        properties: {
          id: { type: "integer" },
          sectionId: { type: "integer" },
          title: { type: "string" },
          description: { type: "string", nullable: true },
          status: { type: "string", enum: ["not_started", "in_progress", "completed"] },
          priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
          notes: { type: "string", nullable: true },
          dueDate: { type: "string", format: "date-time", nullable: true },
          deadline: { type: "string", format: "date-time", nullable: true },
          assignedTo: { type: "integer", nullable: true },
          sortOrder: { type: "integer" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Subtask: {
        type: "object",
        properties: {
          id: { type: "integer" },
          taskId: { type: "integer" },
          title: { type: "string" },
          status: { type: "string", enum: ["not_started", "in_progress", "completed"] },
          sortOrder: { type: "integer" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
          code: { type: "string" },
          details: { type: "object" },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: "Invalid or missing API key",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      RateLimited: {
        description: "Rate limit exceeded",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      NotFound: {
        description: "Resource not found",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
    },
  },
  paths: {
    "/projects": {
      get: {
        summary: "List all projects",
        tags: ["Projects"],
        responses: {
          "200": {
            description: "List of projects",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Project" },
                },
              },
            },
          },
        },
      },
      post: {
        summary: "Create a new project",
        tags: ["Projects"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  icon: { type: "string" },
                  color: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Project created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Project" },
              },
            },
          },
        },
      },
    },
    "/projects/{id}": {
      get: {
        summary: "Get project by ID",
        tags: ["Projects"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": {
            description: "Project details",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Project" },
              },
            },
          },
        },
      },
    },
    "/projects/{id}/blocks": {
      get: {
        summary: "List blocks in a project",
        tags: ["Blocks"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": {
            description: "List of blocks",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Block" },
                },
              },
            },
          },
        },
      },
    },
    "/blocks/{id}/sections": {
      get: {
        summary: "List sections in a block",
        tags: ["Sections"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": {
            description: "List of sections",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Section" },
                },
              },
            },
          },
        },
      },
    },
    "/sections/{id}/tasks": {
      get: {
        summary: "List tasks in a section",
        tags: ["Tasks"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": {
            description: "List of tasks",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Task" },
                },
              },
            },
          },
        },
      },
    },
    "/tasks/{id}": {
      get: {
        summary: "Get task by ID",
        tags: ["Tasks"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": {
            description: "Task details",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Task" },
              },
            },
          },
        },
      },
      patch: {
        summary: "Update task",
        tags: ["Tasks"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  status: { type: "string", enum: ["not_started", "in_progress", "completed"] },
                  priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Task updated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Task" },
              },
            },
          },
        },
      },
    },
    "/tasks/{id}/subtasks": {
      get: {
        summary: "List subtasks of a task",
        tags: ["Subtasks"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": {
            description: "List of subtasks",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Subtask" },
                },
              },
            },
          },
        },
      },
    },
  },
};

export const restApiRouter = router({
  // Get OpenAPI specification
  getOpenApiSpec: publicProcedure.query(() => {
    return openApiSpec;
  }),

  // Get available scopes
  getAvailableScopes: publicProcedure.query(() => {
    return API_SCOPES.map(scope => ({
      value: scope,
      label: scope.replace(":", " ").replace(/\b\w/g, c => c.toUpperCase()),
      category: scope.split(":")[0],
    }));
  }),

  // Verify API key (for testing)
  verifyKey: publicProcedure
    .input(z.object({ key: z.string() }))
    .mutation(async ({ input }) => {
      const result = await verifyApiKey(input.key);
      return {
        valid: result.valid,
        error: result.error,
        scopes: result.apiKey?.scopes,
        rateLimit: result.apiKey?.rateLimit,
      };
    }),
});

// Export for use in API middleware
export { verifyApiKey, generateApiKey };

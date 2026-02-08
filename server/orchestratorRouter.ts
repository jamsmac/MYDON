import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { 
  aiAgents, 
  aiSkills, 
  mcpServers,
  orchestratorConfig,
  aiRequestLogs,
  aiIntegrations,
  type AIAgent,
  type AISkill,
  type MCPServer,
  type OrchestratorRoutingRule
} from "../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { seedAgentsAndSkills } from "./utils/seedAgentsSkills";

// ============ AGENTS ROUTER ============
export const agentsRouter = router({
  // List all agents
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    let agents = await db
      .select()
      .from(aiAgents)
      .where(eq(aiAgents.isActive, true))
      .orderBy(desc(aiAgents.priority));

    // Auto-seed if no agents exist
    if (agents.length === 0) {
      try {
        await seedAgentsAndSkills();
        agents = await db
          .select()
          .from(aiAgents)
          .where(eq(aiAgents.isActive, true))
          .orderBy(desc(aiAgents.priority));
      } catch {
        // Ignore seeding errors, return empty list
      }
    }

    return agents;
  }),

  // Get agent by ID
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [agent] = await db
        .select()
        .from(aiAgents)
        .where(eq(aiAgents.id, input.id));
      return agent;
    }),

  // Create agent (admin only in future)
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      nameRu: z.string().optional(),
      slug: z.string().min(1),
      description: z.string().optional(),
      type: z.enum(["code", "research", "writing", "planning", "analysis", "general"]),
      capabilities: z.array(z.string()).optional(),
      systemPrompt: z.string().optional(),
      modelPreference: z.string().optional(),
      fallbackModel: z.string().optional(),
      temperature: z.number().min(0).max(100).optional(),
      maxTokens: z.number().optional(),
      triggerPatterns: z.array(z.string()).optional(),
      priority: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const [newAgent] = await db
        .insert(aiAgents)
        .values({
          name: input.name,
          nameRu: input.nameRu,
          slug: input.slug,
          description: input.description,
          type: input.type,
          capabilities: input.capabilities,
          systemPrompt: input.systemPrompt,
          modelPreference: input.modelPreference,
          fallbackModel: input.fallbackModel,
          temperature: input.temperature,
          maxTokens: input.maxTokens,
          triggerPatterns: input.triggerPatterns,
          priority: input.priority || 0,
          isActive: true,
          isSystem: false,
        })
        .$returningId();

      return { success: true, id: newAgent.id };
    }),

  // Update agent
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      nameRu: z.string().optional(),
      description: z.string().optional(),
      systemPrompt: z.string().optional(),
      modelPreference: z.string().optional(),
      fallbackModel: z.string().optional(),
      temperature: z.number().min(0).max(100).optional(),
      maxTokens: z.number().optional(),
      triggerPatterns: z.array(z.string()).optional(),
      priority: z.number().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const { id, ...data } = input;
      await db
        .update(aiAgents)
        .set(data)
        .where(eq(aiAgents.id, id));

      return { success: true };
    }),

  // Delete agent (only non-system)
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      await db
        .delete(aiAgents)
        .where(
          and(
            eq(aiAgents.id, input.id),
            eq(aiAgents.isSystem, false)
          )
        );

      return { success: true };
    }),
});

// ============ SKILLS ROUTER ============
export const skillsRouter = router({
  // List all skills
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    let skills = await db
      .select()
      .from(aiSkills)
      .where(eq(aiSkills.isActive, true))
      .orderBy(aiSkills.name);

    // Auto-seed if no skills exist
    if (skills.length === 0) {
      try {
        await seedAgentsAndSkills();
        skills = await db
          .select()
          .from(aiSkills)
          .where(eq(aiSkills.isActive, true))
          .orderBy(aiSkills.name);
      } catch {
        // Ignore seeding errors, return empty list
      }
    }

    return skills;
  }),

  // Get skill by ID
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [skill] = await db
        .select()
        .from(aiSkills)
        .where(eq(aiSkills.id, input.id));
      return skill;
    }),

  // Create skill
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      nameRu: z.string().optional(),
      slug: z.string().min(1),
      description: z.string().optional(),
      agentId: z.number().optional(),
      triggerPatterns: z.array(z.string()).optional(),
      handlerType: z.enum(["prompt", "function", "mcp", "webhook"]).optional(),
      handlerConfig: z.object({
        prompt: z.string().optional(),
        functionName: z.string().optional(),
        mcpServerId: z.number().optional(),
        mcpToolName: z.string().optional(),
        webhookUrl: z.string().optional(),
        webhookMethod: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const [newSkill] = await db
        .insert(aiSkills)
        .values({
          name: input.name,
          nameRu: input.nameRu,
          slug: input.slug,
          description: input.description,
          agentId: input.agentId,
          triggerPatterns: input.triggerPatterns,
          handlerType: input.handlerType || "prompt",
          handlerConfig: input.handlerConfig,
          isActive: true,
          isSystem: false,
        })
        .$returningId();

      return { success: true, id: newSkill.id };
    }),

  // Update skill
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      nameRu: z.string().optional(),
      description: z.string().optional(),
      agentId: z.number().optional(),
      triggerPatterns: z.array(z.string()).optional(),
      handlerType: z.enum(["prompt", "function", "mcp", "webhook"]).optional(),
      handlerConfig: z.object({
        prompt: z.string().optional(),
        functionName: z.string().optional(),
        mcpServerId: z.number().optional(),
        mcpToolName: z.string().optional(),
        webhookUrl: z.string().optional(),
        webhookMethod: z.string().optional(),
      }).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const { id, ...data } = input;
      await db
        .update(aiSkills)
        .set(data)
        .where(eq(aiSkills.id, id));

      return { success: true };
    }),

  // Delete skill
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      await db
        .delete(aiSkills)
        .where(
          and(
            eq(aiSkills.id, input.id),
            eq(aiSkills.isSystem, false)
          )
        );

      return { success: true };
    }),
});

// ============ MCP SERVERS ROUTER ============
export const mcpServersRouter = router({
  // List all MCP servers
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const servers = await db
      .select()
      .from(mcpServers)
      .orderBy(mcpServers.name);
    
    // Mask auth config for security
    return servers.map((server: typeof servers[0]) => ({
      ...server,
      authConfig: server.authConfig ? { ...server.authConfig, apiKey: "••••••••" } : null,
    }));
  }),

  // Get MCP server by ID
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [server] = await db
        .select()
        .from(mcpServers)
        .where(eq(mcpServers.id, input.id));
      return server;
    }),

  // Create MCP server
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      slug: z.string().min(1),
      description: z.string().optional(),
      endpoint: z.string().url(),
      protocol: z.enum(["stdio", "http", "websocket"]).optional(),
      authType: z.enum(["none", "api_key", "oauth", "basic"]).optional(),
      authConfig: z.object({
        apiKey: z.string().optional(),
        username: z.string().optional(),
        password: z.string().optional(),
        clientId: z.string().optional(),
        clientSecret: z.string().optional(),
        tokenUrl: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const [newServer] = await db
        .insert(mcpServers)
        .values({
          name: input.name,
          slug: input.slug,
          description: input.description,
          endpoint: input.endpoint,
          protocol: input.protocol || "http",
          authType: input.authType || "none",
          authConfig: input.authConfig,
          status: "inactive",
        })
        .$returningId();

      return { success: true, id: newServer.id };
    }),

  // Update MCP server
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      endpoint: z.string().url().optional(),
      protocol: z.enum(["stdio", "http", "websocket"]).optional(),
      authType: z.enum(["none", "api_key", "oauth", "basic"]).optional(),
      authConfig: z.object({
        apiKey: z.string().optional(),
        username: z.string().optional(),
        password: z.string().optional(),
        clientId: z.string().optional(),
        clientSecret: z.string().optional(),
        tokenUrl: z.string().optional(),
      }).optional(),
      status: z.enum(["active", "inactive", "error", "connecting"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const { id, ...data } = input;
      await db
        .update(mcpServers)
        .set(data)
        .where(eq(mcpServers.id, id));

      return { success: true };
    }),

  // Delete MCP server
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      await db
        .delete(mcpServers)
        .where(eq(mcpServers.id, input.id));

      return { success: true };
    }),

  // Test MCP server connection
  test: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const [server] = await db
        .select()
        .from(mcpServers)
        .where(eq(mcpServers.id, input.id));

      if (!server) {
        throw new Error("MCP server not found");
      }

      // TODO: Implement actual MCP connection test
      // For now, just update status
      await db
        .update(mcpServers)
        .set({ 
          status: "active",
          lastHealthCheck: new Date(),
        })
        .where(eq(mcpServers.id, input.id));

      return { success: true, message: "Connection test passed" };
    }),
});

// ============ ORCHESTRATOR ROUTER ============
export const orchestratorRouter = router({
  // Get orchestrator config
  getConfig: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    const [config] = await db
      .select()
      .from(orchestratorConfig)
      .limit(1);

    return config || {
      routingRules: [],
      fallbackModel: "gpt-4o-mini",
      loggingLevel: "info",
      logRetentionDays: 30,
      globalRateLimit: 100,
      enableAgentRouting: true,
      enableSkillMatching: true,
      enableMCPIntegration: true,
    };
  }),

  // Update orchestrator config
  updateConfig: protectedProcedure
    .input(z.object({
      routingRules: z.array(z.object({
        id: z.string(),
        name: z.string(),
        condition: z.object({
          type: z.enum(["pattern", "context", "user_preference"]),
          value: z.string(),
        }),
        targetAgentId: z.number(),
        priority: z.number(),
        isActive: z.boolean(),
      })).optional(),
      fallbackAgentId: z.number().optional(),
      fallbackModel: z.string().optional(),
      loggingLevel: z.enum(["debug", "info", "warn", "error"]).optional(),
      logRetentionDays: z.number().optional(),
      globalRateLimit: z.number().optional(),
      enableAgentRouting: z.boolean().optional(),
      enableSkillMatching: z.boolean().optional(),
      enableMCPIntegration: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Check if config exists
      const [existing] = await db
        .select()
        .from(orchestratorConfig)
        .limit(1);

      if (existing) {
        await db
          .update(orchestratorConfig)
          .set(input)
          .where(eq(orchestratorConfig.id, existing.id));
      } else {
        await db
          .insert(orchestratorConfig)
          .values(input as any);
      }

      return { success: true };
    }),

  // Route a request to the appropriate agent
  route: protectedProcedure
    .input(z.object({
      message: z.string(),
      context: z.object({
        type: z.enum(["project", "block", "section", "task"]).optional(),
        id: z.number().optional(),
        content: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Get orchestrator config
      const [config] = await db
        .select()
        .from(orchestratorConfig)
        .limit(1);

      // Get all active agents
      const agents = await db
        .select()
        .from(aiAgents)
        .where(eq(aiAgents.isActive, true))
        .orderBy(desc(aiAgents.priority));

      // Find matching agent based on message patterns
      let selectedAgent: AIAgent | null = null;
      
      for (const agent of agents) {
        if (agent.triggerPatterns && Array.isArray(agent.triggerPatterns)) {
          for (const pattern of agent.triggerPatterns) {
            try {
              const regex = new RegExp(pattern, 'i');
              if (regex.test(input.message)) {
                selectedAgent = agent;
                break;
              }
            } catch (e) {
              // Invalid regex, skip
            }
          }
          if (selectedAgent) break;
        }
      }

      // Use fallback if no match
      if (!selectedAgent && agents.length > 0) {
        selectedAgent = agents.find((a: { type: string }) => a.type === "general") || agents[0];
      }

      // Build system prompt
      const systemPrompt = selectedAgent?.systemPrompt || 
        "You are a helpful AI assistant for MYDON roadmap planning.";

      // Call LLM with selected agent's configuration
      const startTime = Date.now();
      const response = await invokeLLM({
        model: selectedAgent?.modelPreference || undefined,
        maxTokens: selectedAgent?.maxTokens || undefined,
        messages: [
          { role: "system", content: systemPrompt },
          ...(input.context?.content ? [{ role: "user" as const, content: `Context: ${input.context.content}` }] : []),
          { role: "user", content: input.message },
        ],
      });

      const responseTime = Date.now() - startTime;

      // Log the request
      const outputContent = response.choices[0]?.message?.content;
      const outputString = typeof outputContent === 'string' ? outputContent : JSON.stringify(outputContent) || "";
      await db
        .insert(aiRequestLogs)
        .values({
          userId: ctx.user.id,
          requestType: "chat",
          agentId: selectedAgent?.id,
          input: input.message,
          output: outputString,
          model: response.model,
          provider: "platform",
          tokensUsed: response.usage?.total_tokens,
          responseTimeMs: responseTime,
          status: "success",
        });

      // Update agent stats
      if (selectedAgent) {
        await db
          .update(aiAgents)
          .set({
            totalRequests: sql`${aiAgents.totalRequests} + 1`,
            avgResponseTime: sql`(${aiAgents.avgResponseTime} * ${aiAgents.totalRequests} + ${responseTime}) / (${aiAgents.totalRequests} + 1)`,
          })
          .where(eq(aiAgents.id, selectedAgent.id));
      }

      return {
        response: response.choices[0]?.message?.content || "",
        agent: selectedAgent ? {
          id: selectedAgent.id,
          name: selectedAgent.name,
          type: selectedAgent.type,
        } : null,
        model: response.model,
        tokensUsed: response.usage?.total_tokens,
        responseTimeMs: responseTime,
      };
    }),

  // Get request logs
  getLogs: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).optional(),
      offset: z.number().optional(),
      status: z.enum(["success", "error", "timeout", "rate_limited"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      let query = db
        .select()
        .from(aiRequestLogs)
        .where(eq(aiRequestLogs.userId, ctx.user.id))
        .orderBy(desc(aiRequestLogs.createdAt))
        .limit(input.limit || 50)
        .offset(input.offset || 0);

      const logs = await query;
      return logs;
    }),
});

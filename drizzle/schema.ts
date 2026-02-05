import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean, index } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  avatar: varchar("avatar", { length: 512 }), // User avatar URL
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // Stripe subscription fields
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  subscriptionPlan: mysqlEnum("subscriptionPlan", ["free", "pro", "enterprise"]).default("free"),
  subscriptionStatus: varchar("subscriptionStatus", { length: 32 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * AI Provider settings - BYOK (Bring Your Own Key) mode
 * Extended to support free providers and smart selection
 */
export const aiSettings = mysqlTable("ai_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  provider: mysqlEnum("provider", [
    // Premium providers
    "anthropic", "openai", "google", "groq", "mistral",
    // Free/cheap providers
    "gemini_free", "huggingface", "deepseek", "ollama", "cohere", "perplexity"
  ]).notNull(),
  apiKey: text("apiKey"), // Encrypted in production, null for Ollama
  model: varchar("model", { length: 64 }),
  baseUrl: varchar("baseUrl", { length: 255 }), // For Ollama custom endpoint
  isDefault: boolean("isDefault").default(false),
  isEnabled: boolean("isEnabled").default(true),
  isFree: boolean("isFree").default(false), // Mark free tier providers
  priority: int("priority").default(0), // Higher = preferred for auto-select
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * User AI preferences - for smart model selection
 */
export const aiPreferences = mysqlTable("ai_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  autoSelectEnabled: boolean("autoSelectEnabled").default(true),
  preferFreeModels: boolean("preferFreeModels").default(true),
  // Task type preferences (provider id for each type)
  simpleTaskProvider: int("simpleTaskProvider"), // Quick questions
  analysisTaskProvider: int("analysisTaskProvider"), // Research, analysis
  codeTaskProvider: int("codeTaskProvider"), // Programming tasks
  creativeTaskProvider: int("creativeTaskProvider"), // Writing, brainstorming
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AiPreference = typeof aiPreferences.$inferSelect;
export type InsertAiPreference = typeof aiPreferences.$inferInsert;

export type AiSetting = typeof aiSettings.$inferSelect;
export type InsertAiSetting = typeof aiSettings.$inferInsert;

/**
 * User Credits - Platform-First AI credit system
 * Each user gets free credits on registration
 */
export const userCredits = mysqlTable("user_credits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  credits: int("credits").default(1000).notNull(), // Starting credits
  totalEarned: int("totalEarned").default(1000).notNull(), // Total credits ever received
  totalSpent: int("totalSpent").default(0).notNull(), // Total credits spent
  useBYOK: boolean("useBYOK").default(false), // Use own API keys instead of platform
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserCredits = typeof userCredits.$inferSelect;
export type InsertUserCredits = typeof userCredits.$inferInsert;

/**
 * Credit Transactions - History of credit usage
 */
export const creditTransactions = mysqlTable("credit_transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  amount: int("amount").notNull(), // Positive = earned, Negative = spent
  balance: int("balance").notNull(), // Balance after transaction
  type: mysqlEnum("type", [
    "initial",      // Initial free credits
    "bonus",        // Bonus credits (referral, promo)
    "purchase",     // Purchased credits
    "ai_request",   // AI chat request
    "ai_generate",  // AI generation (roadmap, etc)
    "refund"        // Refund
  ]).notNull(),
  description: text("description"),
  // AI request metadata
  model: varchar("model", { length: 64 }),
  tokensUsed: int("tokensUsed"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type InsertCreditTransaction = typeof creditTransactions.$inferInsert;

/**
 * Projects - top level container for roadmaps
 */
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 64 }).default("folder"),
  color: varchar("color", { length: 32 }).default("#f59e0b"),
  status: mysqlEnum("status", ["active", "archived", "completed"]).default("active"),
  startDate: timestamp("startDate"),
  targetDate: timestamp("targetDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: index("user_idx").on(table.userId),
  statusIdx: index("project_status_idx").on(table.status),
}));

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

/**
 * Project Members - team collaboration with roles
 */
export const projectMembers = mysqlTable("project_members", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["owner", "admin", "editor", "viewer"]).default("viewer").notNull(),
  invitedBy: int("invitedBy"),
  invitedAt: timestamp("invitedAt").defaultNow().notNull(),
  joinedAt: timestamp("joinedAt"),
  status: mysqlEnum("status", ["pending", "active", "removed"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProjectMember = typeof projectMembers.$inferSelect;
export type InsertProjectMember = typeof projectMembers.$inferInsert;

/**
 * Project Invitations - invite by email/link
 */
export const projectInvitations = mysqlTable("project_invitations", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  email: varchar("email", { length: 320 }),
  inviteCode: varchar("inviteCode", { length: 64 }).notNull().unique(),
  role: mysqlEnum("role", ["admin", "editor", "viewer"]).default("viewer").notNull(),
  invitedBy: int("invitedBy").notNull(),
  expiresAt: timestamp("expiresAt"),
  usedAt: timestamp("usedAt"),
  usedBy: int("usedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProjectInvitation = typeof projectInvitations.$inferSelect;
export type InsertProjectInvitation = typeof projectInvitations.$inferInsert;

/**
 * Activity Log - track all actions for activity feed
 */
export const activityLog = mysqlTable("activity_log", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  action: mysqlEnum("action", [
    "task_created", "task_updated", "task_completed", "task_deleted",
    "subtask_created", "subtask_completed",
    "comment_added", "comment_edited",
    "member_invited", "member_joined", "member_removed",
    "block_created", "block_updated",
    "section_created", "section_updated",
    "project_updated", "deadline_set", "priority_changed",
    "assignment_changed"
  ]).notNull(),
  entityType: mysqlEnum("entityType", ["project", "block", "section", "task", "subtask", "comment", "member"]).notNull(),
  entityId: int("entityId").notNull(),
  entityTitle: varchar("entityTitle", { length: 500 }),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLog.$inferSelect;
export type InsertActivityLog = typeof activityLog.$inferInsert;

/**
 * Blocks - major phases/sections within a project roadmap
 */
export const blocks = mysqlTable("blocks", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  number: int("number").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  titleRu: varchar("titleRu", { length: 255 }),
  description: text("description"),
  icon: varchar("icon", { length: 64 }).default("layers"),
  duration: varchar("duration", { length: 64 }),
  deadline: timestamp("deadline"),
  reminderDays: int("reminderDays").default(3),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Block = typeof blocks.$inferSelect;
export type InsertBlock = typeof blocks.$inferInsert;

/**
 * Sections - groupings within blocks
 */
export const sections = mysqlTable("sections", {
  id: int("id").autoincrement().primaryKey(),
  blockId: int("blockId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Section = typeof sections.$inferSelect;
export type InsertSection = typeof sections.$inferInsert;

/**
 * Tasks - individual work items
 */
export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  sectionId: int("sectionId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["not_started", "in_progress", "completed"]).default("not_started"),
  priority: mysqlEnum("priority", ["critical", "high", "medium", "low"]).default("medium"),
  notes: text("notes"),
  summary: text("summary"), // AI-generated or user summary
  dueDate: timestamp("dueDate"), // Task due date for calendar and scheduling
  deadline: timestamp("deadline"), // Hard deadline for task completion
  dependencies: json("dependencies").$type<number[]>(), // Array of task IDs that must be completed first
  assignedTo: int("assignedTo"), // User ID of the person assigned to this task
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  sectionIdx: index("section_idx").on(table.sectionId),
  statusIdx: index("status_idx").on(table.status),
  deadlineIdx: index("deadline_idx").on(table.deadline),
  assignedToIdx: index("assigned_to_idx").on(table.assignedTo),
}));

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

/**
 * Subtasks - checklist items within tasks
 */
export const subtasks = mysqlTable("subtasks", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  status: mysqlEnum("status", ["not_started", "in_progress", "completed"]).default("not_started"),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Subtask = typeof subtasks.$inferSelect;
export type InsertSubtask = typeof subtasks.$inferInsert;

/**
 * Subtask Templates - reusable sets of subtasks for recurring tasks
 */
export const subtaskTemplates = mysqlTable("subtask_templates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }), // e.g., "Development", "Design", "Marketing"
  isPublic: boolean("isPublic").default(false), // Share with team
  usageCount: int("usageCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SubtaskTemplate = typeof subtaskTemplates.$inferSelect;
export type InsertSubtaskTemplate = typeof subtaskTemplates.$inferInsert;

/**
 * Subtask Template Items - individual items within a template
 */
export const subtaskTemplateItems = mysqlTable("subtask_template_items", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("templateId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SubtaskTemplateItem = typeof subtaskTemplateItems.$inferSelect;
export type InsertSubtaskTemplateItem = typeof subtaskTemplateItems.$inferInsert;

/**
 * Chat messages - AI conversations at any level (project, block, section, task)
 */
export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // Context - which entity this chat belongs to
  contextType: mysqlEnum("contextType", ["project", "block", "section", "task"]).notNull(),
  contextId: int("contextId").notNull(),
  // Message content
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: text("content").notNull(),
  // AI metadata
  provider: varchar("provider", { length: 32 }),
  model: varchar("model", { length: 64 }),
  tokensUsed: int("tokensUsed"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

/**
 * Template categories - for organizing templates
 */
export const templateCategories = mysqlTable("template_categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  nameRu: varchar("nameRu", { length: 100 }),
  icon: varchar("icon", { length: 64 }).default("folder"),
  color: varchar("color", { length: 32 }).default("#f59e0b"),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TemplateCategory = typeof templateCategories.$inferSelect;
export type InsertTemplateCategory = typeof templateCategories.$inferInsert;

/**
 * Project templates - reusable roadmap structures
 * Users can save their projects as templates and share with others
 */
export const projectTemplates = mysqlTable("project_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 64 }).default("layout-template"),
  color: varchar("color", { length: 32 }).default("#8b5cf6"),
  categoryId: int("categoryId"), // FK to template_categories
  structure: json("structure").$type<TemplateStructure>(), // Typed JSON structure
  // Visibility and ownership
  isPublic: boolean("isPublic").default(false),
  authorId: int("authorId").notNull(), // User who created the template
  authorName: varchar("authorName", { length: 255 }), // Cached author name
  // Metadata
  blocksCount: int("blocksCount").default(0),
  sectionsCount: int("sectionsCount").default(0),
  tasksCount: int("tasksCount").default(0),
  estimatedDuration: varchar("estimatedDuration", { length: 64 }), // e.g., "3 months"
  // Usage stats
  usageCount: int("usageCount").default(0),
  rating: int("rating").default(0), // Average rating (0-5 * 100 for precision)
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Type for template variable
export type TemplateVariable = {
  name: string; // Variable name (e.g., "projectName")
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect';
  label: string; // Display label
  labelRu?: string; // Russian label
  description?: string;
  defaultValue?: string;
  options?: string[]; // For select/multiselect types
  required?: boolean;
  placeholder?: string;
};

// Type for template structure JSON
export type TemplateStructure = {
  variables?: TemplateVariable[]; // Template variables for parameterization
  blocks: {
    title: string;
    description?: string;
    duration?: string;
    sections: {
      title: string;
      description?: string;
      tasks: {
        title: string;
        description?: string;
        priority?: 'critical' | 'high' | 'medium' | 'low';
        estimatedDays?: number;
      }[];
    }[];
  }[];
};

export type ProjectTemplate = typeof projectTemplates.$inferSelect;
export type InsertProjectTemplate = typeof projectTemplates.$inferInsert;

/**
 * Template Tags - for categorizing and searching templates
 */
export const templateTags = mysqlTable("template_tags", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(),
  nameRu: varchar("nameRu", { length: 64 }),
  usageCount: int("usageCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type TemplateTag = typeof templateTags.$inferSelect;
export type InsertTemplateTag = typeof templateTags.$inferInsert;

/**
 * Template to Tags mapping (many-to-many)
 */
export const templateToTags = mysqlTable("template_to_tags", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("templateId").notNull(),
  tagId: int("tagId").notNull(),
});

/**
 * Template Ratings - user ratings for templates
 */
export const templateRatings = mysqlTable("template_ratings", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("templateId").notNull(),
  userId: int("userId").notNull(),
  rating: int("rating").notNull(), // 1-5
  review: text("review"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type TemplateRating = typeof templateRatings.$inferSelect;
export type InsertTemplateRating = typeof templateRatings.$inferInsert;

/**
 * Template Downloads - tracks template usage
 */
export const templateDownloads = mysqlTable("template_downloads", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("templateId").notNull(),
  userId: int("userId").notNull(),
  createdProjectId: int("createdProjectId"), // Project created from template
  downloadedAt: timestamp("downloadedAt").defaultNow().notNull(),
});
export type TemplateDownload = typeof templateDownloads.$inferSelect;
export type InsertTemplateDownload = typeof templateDownloads.$inferInsert;


/**
 * Pitch Decks - AI-generated investor presentations
 */
export const pitchDecks = mysqlTable("pitch_decks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  subtitle: varchar("subtitle", { length: 500 }),
  // Slide content stored as JSON
  slides: json("slides").$type<PitchDeckSlide[]>().notNull(),
  // Generation metadata
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  lastEditedAt: timestamp("lastEditedAt").defaultNow().onUpdateNow().notNull(),
  // Export info
  exportedUrl: text("exportedUrl"),
  exportFormat: varchar("exportFormat", { length: 32 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PitchDeckSlide = {
  id: string;
  type: 'title' | 'problem' | 'solution' | 'market' | 'product' | 'business_model' | 'traction' | 'team' | 'roadmap' | 'financials' | 'ask' | 'contact';
  title: string;
  content: string;
  bullets?: string[];
  metrics?: { label: string; value: string }[];
  imagePrompt?: string;
};

export type PitchDeck = typeof pitchDecks.$inferSelect;
export type InsertPitchDeck = typeof pitchDecks.$inferInsert;


/**
 * Subscription Plans - defines available subscription tiers
 */
export const subscriptionPlans = mysqlTable("subscription_plans", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  nameRu: varchar("nameRu", { length: 100 }),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  price: int("price").default(0).notNull(), // Price in cents (0 = free)
  currency: varchar("currency", { length: 3 }).default("USD"),
  billingPeriod: mysqlEnum("billingPeriod", ["monthly", "yearly", "lifetime"]).default("monthly"),
  creditsPerMonth: int("creditsPerMonth").default(1000).notNull(),
  // Features as JSON
  features: json("features").$type<SubscriptionFeatures>(),
  // Limits
  maxProjects: int("maxProjects").default(3),
  maxAiRequests: int("maxAiRequests").default(100), // Per day
  maxTeamMembers: int("maxTeamMembers").default(1),
  // AI integrations allowed
  allowedIntegrations: json("allowedIntegrations").$type<string[]>(),
  // Status
  isActive: boolean("isActive").default(true),
  isPopular: boolean("isPopular").default(false),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SubscriptionFeatures = {
  aiChat: boolean;
  pitchDeck: boolean;
  templates: boolean;
  export: boolean;
  googleIntegration: boolean;
  adminPanel: boolean;
  customAgents: boolean;
  mcpServers: boolean;
  prioritySupport: boolean;
};

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = typeof subscriptionPlans.$inferInsert;

/**
 * User Subscriptions - tracks user subscription status
 */
export const userSubscriptions = mysqlTable("user_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  planId: int("planId").notNull(),
  status: mysqlEnum("status", ["active", "cancelled", "expired", "past_due", "trialing"]).default("active"),
  // Billing info
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  // Dates
  startDate: timestamp("startDate").defaultNow().notNull(),
  endDate: timestamp("endDate"),
  cancelledAt: timestamp("cancelledAt"),
  trialEndsAt: timestamp("trialEndsAt"),
  // Usage tracking
  currentPeriodStart: timestamp("currentPeriodStart"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type InsertUserSubscription = typeof userSubscriptions.$inferInsert;

/**
 * AI Integrations - user's connected AI services (BYOK)
 */
export const aiIntegrations = mysqlTable("ai_integrations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  provider: varchar("provider", { length: 50 }).notNull(), // claude_code, codex, perplexity, etc.
  displayName: varchar("displayName", { length: 100 }),
  // Authentication
  apiKey: text("apiKey"), // Encrypted
  accessToken: text("accessToken"), // For OAuth-based integrations
  refreshToken: text("refreshToken"),
  tokenExpiresAt: timestamp("tokenExpiresAt"),
  // Configuration
  config: json("config").$type<AIIntegrationConfig>(),
  // Status
  isActive: boolean("isActive").default(true),
  lastUsedAt: timestamp("lastUsedAt"),
  lastErrorAt: timestamp("lastErrorAt"),
  lastError: text("lastError"),
  // Usage stats
  totalRequests: int("totalRequests").default(0),
  totalTokens: int("totalTokens").default(0),
  totalCost: int("totalCost").default(0), // In cents
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AIIntegrationConfig = {
  model?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
  customHeaders?: Record<string, string>;
};

export type AIIntegration = typeof aiIntegrations.$inferSelect;
export type InsertAIIntegration = typeof aiIntegrations.$inferInsert;

/**
 * AI Agents - specialized AI entities for different tasks
 */
export const aiAgents = mysqlTable("ai_agents", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  nameRu: varchar("nameRu", { length: 100 }),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  description: text("description"),
  descriptionRu: text("descriptionRu"),
  // Agent type and capabilities
  type: mysqlEnum("type", ["code", "research", "writing", "planning", "analysis", "general"]).notNull(),
  capabilities: json("capabilities").$type<string[]>(),
  // AI configuration
  systemPrompt: text("systemPrompt"),
  modelPreference: varchar("modelPreference", { length: 50 }), // Preferred model
  fallbackModel: varchar("fallbackModel", { length: 50 }),
  temperature: int("temperature").default(70), // 0-100, stored as int
  maxTokens: int("maxTokens").default(4096),
  // Routing
  triggerPatterns: json("triggerPatterns").$type<string[]>(), // Regex patterns for auto-routing
  priority: int("priority").default(0), // Higher = checked first
  // Status
  isActive: boolean("isActive").default(true),
  isSystem: boolean("isSystem").default(false), // System agents can't be deleted
  // Stats
  totalRequests: int("totalRequests").default(0),
  avgResponseTime: int("avgResponseTime").default(0), // In ms
  successRate: int("successRate").default(100), // Percentage
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AIAgent = typeof aiAgents.$inferSelect;
export type InsertAIAgent = typeof aiAgents.$inferInsert;

/**
 * AI Skills - reusable capabilities that agents can invoke
 */
export const aiSkills = mysqlTable("ai_skills", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  nameRu: varchar("nameRu", { length: 100 }),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  description: text("description"),
  // Skill configuration
  agentId: int("agentId"), // Optional: assigned to specific agent
  triggerPatterns: json("triggerPatterns").$type<string[]>(),
  // Handler
  handlerType: mysqlEnum("handlerType", ["prompt", "function", "mcp", "webhook"]).default("prompt"),
  handlerConfig: json("handlerConfig").$type<SkillHandlerConfig>(),
  // Input/output schema
  inputSchema: json("inputSchema"),
  outputSchema: json("outputSchema"),
  // Status
  isActive: boolean("isActive").default(true),
  isSystem: boolean("isSystem").default(false),
  // Stats
  totalInvocations: int("totalInvocations").default(0),
  avgExecutionTime: int("avgExecutionTime").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SkillHandlerConfig = {
  prompt?: string;
  functionName?: string;
  mcpServerId?: number;
  mcpToolName?: string;
  webhookUrl?: string;
  webhookMethod?: string;
};

export type AISkill = typeof aiSkills.$inferSelect;
export type InsertAISkill = typeof aiSkills.$inferInsert;

/**
 * MCP Servers - Model Context Protocol server connections
 */
export const mcpServers = mysqlTable("mcp_servers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  description: text("description"),
  // Connection
  endpoint: varchar("endpoint", { length: 500 }).notNull(),
  protocol: mysqlEnum("protocol", ["stdio", "http", "websocket"]).default("http"),
  // Authentication
  authType: mysqlEnum("authType", ["none", "api_key", "oauth", "basic"]).default("none"),
  authConfig: json("authConfig").$type<MCPAuthConfig>(),
  // Available tools
  tools: json("tools").$type<MCPTool[]>(),
  // Status
  status: mysqlEnum("status", ["active", "inactive", "error", "connecting"]).default("inactive"),
  lastHealthCheck: timestamp("lastHealthCheck"),
  lastError: text("lastError"),
  // Stats
  totalRequests: int("totalRequests").default(0),
  avgResponseTime: int("avgResponseTime").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MCPAuthConfig = {
  apiKey?: string;
  username?: string;
  password?: string;
  clientId?: string;
  clientSecret?: string;
  tokenUrl?: string;
};

export type MCPTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type MCPServer = typeof mcpServers.$inferSelect;
export type InsertMCPServer = typeof mcpServers.$inferInsert;

/**
 * Orchestrator Config - global routing and fallback settings
 */
export const orchestratorConfig = mysqlTable("orchestrator_config", {
  id: int("id").autoincrement().primaryKey(),
  // Routing rules
  routingRules: json("routingRules").$type<OrchestratorRoutingRule[]>(),
  // Fallback behavior
  fallbackAgentId: int("fallbackAgentId"),
  fallbackModel: varchar("fallbackModel", { length: 50 }).default("gpt-4o-mini"),
  // Logging
  loggingLevel: mysqlEnum("loggingLevel", ["debug", "info", "warn", "error"]).default("info"),
  logRetentionDays: int("logRetentionDays").default(30),
  // Rate limiting
  globalRateLimit: int("globalRateLimit").default(100), // Requests per minute
  // Feature flags
  enableAgentRouting: boolean("enableAgentRouting").default(true),
  enableSkillMatching: boolean("enableSkillMatching").default(true),
  enableMCPIntegration: boolean("enableMCPIntegration").default(true),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OrchestratorRoutingRule = {
  id: string;
  name: string;
  condition: {
    type: "pattern" | "context" | "user_preference";
    value: string;
  };
  targetAgentId: number;
  priority: number;
  isActive: boolean;
};

export type OrchestratorConfig = typeof orchestratorConfig.$inferSelect;
export type InsertOrchestratorConfig = typeof orchestratorConfig.$inferInsert;

/**
 * AI Request Logs - detailed logging for debugging and analytics
 */
export const aiRequestLogs = mysqlTable("ai_request_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // Request info
  requestType: mysqlEnum("requestType", ["chat", "generate", "skill", "mcp"]).notNull(),
  agentId: int("agentId"),
  skillId: int("skillId"),
  mcpServerId: int("mcpServerId"),
  // Input/output
  input: text("input"),
  output: text("output"),
  // Model info
  model: varchar("model", { length: 64 }),
  provider: varchar("provider", { length: 50 }),
  // Performance
  tokensUsed: int("tokensUsed"),
  responseTimeMs: int("responseTimeMs"),
  // Status
  status: mysqlEnum("status", ["success", "error", "timeout", "rate_limited"]).default("success"),
  errorMessage: text("errorMessage"),
  // Cost
  creditsCost: int("creditsCost").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AIRequestLog = typeof aiRequestLogs.$inferSelect;
export type InsertAIRequestLog = typeof aiRequestLogs.$inferInsert;


/**
 * Daily AI usage tracking for subscription limits
 */
export const aiUsageTracking = mysqlTable("ai_usage_tracking", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD format
  requestCount: int("requestCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AiUsageTracking = typeof aiUsageTracking.$inferSelect;
export type InsertAiUsageTracking = typeof aiUsageTracking.$inferInsert;


// ============ COLLABORATION TABLES ============

/**
 * Task Comments - Discussion on tasks
 */
export const taskComments = mysqlTable("task_comments", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  userId: int("userId").notNull(),
  content: text("content").notNull(),
  parentId: int("parentId"), // For threaded replies
  mentions: json("mentions").$type<number[]>(), // Array of mentioned user IDs
  isEdited: boolean("isEdited").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TaskComment = typeof taskComments.$inferSelect;
export type InsertTaskComment = typeof taskComments.$inferInsert;

/**
 * Comment Reactions - Emoji reactions on comments
 */
export const commentReactions = mysqlTable("comment_reactions", {
  id: int("id").autoincrement().primaryKey(),
  commentId: int("commentId").notNull(),
  userId: int("userId").notNull(),
  emoji: varchar("emoji", { length: 32 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CommentReaction = typeof commentReactions.$inferSelect;
export type InsertCommentReaction = typeof commentReactions.$inferInsert;


// ============ NOTIFICATIONS ============

/**
 * User notifications
 */
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", [
    "task_assigned",
    "task_completed",
    "task_overdue",
    "comment_added",
    "comment_mention",
    "project_invite",
    "project_update",
    "deadline_reminder",
    "daily_digest",
    "system"
  ]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  data: json("data"), // Additional data (projectId, taskId, etc.)
  isRead: boolean("isRead").default(false),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

/**
 * User notification preferences
 */
export const notificationPreferences = mysqlTable("notification_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  // In-app notifications
  inAppEnabled: boolean("inAppEnabled").default(true),
  // Email notifications
  emailEnabled: boolean("emailEnabled").default(true),
  emailDigestFrequency: mysqlEnum("emailDigestFrequency", ["none", "daily", "weekly"]).default("daily"),
  emailDigestTime: varchar("emailDigestTime", { length: 5 }).default("09:00"), // HH:mm format
  // Telegram notifications
  telegramEnabled: boolean("telegramEnabled").default(false),
  telegramChatId: varchar("telegramChatId", { length: 64 }),
  telegramUsername: varchar("telegramUsername", { length: 64 }),
  // Browser push notifications
  pushEnabled: boolean("pushEnabled").default(false),
  pushSubscription: json("pushSubscription"), // Web Push subscription object
  // Notification types to receive
  notifyTaskAssigned: boolean("notifyTaskAssigned").default(true),
  notifyTaskCompleted: boolean("notifyTaskCompleted").default(true),
  notifyTaskOverdue: boolean("notifyTaskOverdue").default(true),
  notifyComments: boolean("notifyComments").default(true),
  notifyMentions: boolean("notifyMentions").default(true),
  notifyProjectUpdates: boolean("notifyProjectUpdates").default(true),
  notifyDeadlines: boolean("notifyDeadlines").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreference = typeof notificationPreferences.$inferInsert;

/**
 * Email digest queue
 */
export const emailDigestQueue = mysqlTable("email_digest_queue", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  scheduledFor: timestamp("scheduledFor").notNull(),
  status: mysqlEnum("status", ["pending", "sent", "failed"]).default("pending"),
  sentAt: timestamp("sentAt"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailDigestQueue = typeof emailDigestQueue.$inferSelect;
export type InsertEmailDigestQueue = typeof emailDigestQueue.$inferInsert;


/**
 * AI Chat History - stores conversation history per project
 */
export const aiChatHistory = mysqlTable("ai_chat_history", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId"),
  blockId: int("blockId"),
  sectionId: int("sectionId"),
  taskId: int("taskId"),
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: text("content").notNull(),
  model: varchar("model", { length: 100 }),
  creditsUsed: int("creditsUsed").default(0),
  metadata: json("metadata"), // Additional context like command used
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AiChatHistory = typeof aiChatHistory.$inferSelect;
export type InsertAiChatHistory = typeof aiChatHistory.$inferInsert;

/**
 * AI Suggestions - cached suggestions for tasks
 */
export const aiSuggestions = mysqlTable("ai_suggestions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId"),
  taskId: int("taskId"),
  suggestionType: mysqlEnum("suggestionType", ["title", "description", "subtasks", "priority", "deadline", "similar"]).notNull(),
  suggestion: json("suggestion").notNull(), // The actual suggestion content
  confidence: int("confidence").default(0), // 0-100 confidence score
  accepted: boolean("accepted").default(false),
  dismissed: boolean("dismissed").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"), // Suggestions can expire
});
export type AiSuggestion = typeof aiSuggestions.$inferSelect;
export type InsertAiSuggestion = typeof aiSuggestions.$inferInsert;

/**
 * Project Risks - detected risks for projects
 */
export const projectRisks = mysqlTable("project_risks", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  blockId: int("blockId"),
  taskId: int("taskId"),
  riskType: mysqlEnum("riskType", ["blocked", "overdue", "dependency", "resource", "scope", "deadline", "quality"]).notNull(),
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).default("medium"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  recommendation: text("recommendation"),
  status: mysqlEnum("status", ["open", "mitigated", "resolved", "accepted"]).default("open"),
  detectedAt: timestamp("detectedAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ProjectRisk = typeof projectRisks.$inferSelect;
export type InsertProjectRisk = typeof projectRisks.$inferInsert;

/**
 * Executive Summaries - generated project summaries
 */
export const executiveSummaries = mysqlTable("executive_summaries", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  summary: text("summary").notNull(),
  keyMetrics: json("keyMetrics"), // { tasksCompleted, tasksTotal, progress, velocity, etc. }
  risks: json("risks"), // Array of risk summaries
  achievements: json("achievements"), // Array of recent achievements
  recommendations: json("recommendations"), // AI recommendations
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"), // Summaries can be regenerated
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ExecutiveSummary = typeof executiveSummaries.$inferSelect;
export type InsertExecutiveSummary = typeof executiveSummaries.$inferInsert;


/**
 * Webhooks - external integrations
 */
export const webhooks = mysqlTable("webhooks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId"), // Optional - null means all projects
  name: varchar("name", { length: 255 }).notNull(),
  url: varchar("url", { length: 2048 }).notNull(),
  secret: varchar("secret", { length: 255 }), // For signature verification
  events: json("events").$type<string[]>().notNull(), // Array of event types
  headers: json("headers").$type<Record<string, string>>(), // Custom headers
  isActive: boolean("isActive").default(true),
  lastTriggeredAt: timestamp("lastTriggeredAt"),
  failureCount: int("failureCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Webhook = typeof webhooks.$inferSelect;
export type InsertWebhook = typeof webhooks.$inferInsert;

/**
 * Webhook Deliveries - log of webhook calls
 */
export const webhookDeliveries = mysqlTable("webhook_deliveries", {
  id: int("id").autoincrement().primaryKey(),
  webhookId: int("webhookId").notNull(),
  event: varchar("event", { length: 100 }).notNull(),
  payload: json("payload").notNull(),
  responseStatus: int("responseStatus"),
  responseBody: text("responseBody"),
  duration: int("duration"), // ms
  success: boolean("success").default(false),
  error: text("error"),
  attempts: int("attempts").default(1),
  nextRetryAt: timestamp("nextRetryAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type InsertWebhookDelivery = typeof webhookDeliveries.$inferInsert;

/**
 * API Keys - for external API access
 */
export const apiKeys = mysqlTable("api_keys", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  keyHash: varchar("keyHash", { length: 255 }).notNull(), // SHA-256 hash of the key
  keyPrefix: varchar("keyPrefix", { length: 12 }).notNull(), // First 8 chars for identification
  scopes: json("scopes").$type<string[]>().notNull(), // Array of allowed scopes
  rateLimit: int("rateLimit").default(1000), // Requests per hour
  expiresAt: timestamp("expiresAt"),
  lastUsedAt: timestamp("lastUsedAt"),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;

/**
 * API Usage - rate limiting and analytics
 */
export const apiUsage = mysqlTable("api_usage", {
  id: int("id").autoincrement().primaryKey(),
  apiKeyId: int("apiKeyId").notNull(),
  endpoint: varchar("endpoint", { length: 255 }).notNull(),
  method: varchar("method", { length: 10 }).notNull(),
  statusCode: int("statusCode"),
  responseTime: int("responseTime"), // ms
  requestSize: int("requestSize"), // bytes
  responseSize: int("responseSize"), // bytes
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: varchar("userAgent", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ApiUsage = typeof apiUsage.$inferSelect;
export type InsertApiUsage = typeof apiUsage.$inferInsert;

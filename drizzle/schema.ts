import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean, index, uniqueIndex, decimal, date } from "drizzle-orm/mysql-core";

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

/**
 * Time Entries - for time tracking on tasks
 */
export const timeEntries = mysqlTable("time_entries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  taskId: int("taskId").notNull(),
  projectId: int("projectId").notNull(),
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime"),
  duration: int("duration"), // seconds
  notes: text("notes"),
  isRunning: boolean("isRunning").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: index("te_user_idx").on(table.userId),
  taskIdx: index("te_task_idx").on(table.taskId),
  projectIdx: index("te_project_idx").on(table.projectId),
}));
export type TimeEntry = typeof timeEntries.$inferSelect;
export type InsertTimeEntry = typeof timeEntries.$inferInsert;

/**
 * Time Goals - daily/weekly time tracking goals
 */
export const timeGoals = mysqlTable("time_goals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId"),
  targetHours: int("targetHours").notNull(), // Target hours per period
  period: mysqlEnum("period", ["daily", "weekly", "monthly"]).default("daily"),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type TimeGoal = typeof timeGoals.$inferSelect;
export type InsertTimeGoal = typeof timeGoals.$inferInsert;

/**
 * Achievements - gamification achievement definitions
 */
export const achievementDefinitions = mysqlTable("achievement_definitions", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description").notNull(),
  icon: varchar("icon", { length: 64 }).notNull(),
  category: mysqlEnum("category", ["productivity", "collaboration", "milestone", "streak", "special"]).default("milestone"),
  rarity: mysqlEnum("rarity", ["common", "uncommon", "rare", "epic", "legendary"]).default("common"),
  points: int("points").default(10),
  criteria: json("criteria").$type<{
    type: string;
    target: number;
    timeframe?: string;
  }>().notNull(),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AchievementDefinition = typeof achievementDefinitions.$inferSelect;
export type InsertAchievementDefinition = typeof achievementDefinitions.$inferInsert;

/**
 * User Achievements - unlocked achievements per user
 */
export const userAchievements = mysqlTable("user_achievements", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  achievementId: int("achievementId").notNull(),
  progress: int("progress").default(0),
  unlockedAt: timestamp("unlockedAt"),
  notifiedAt: timestamp("notifiedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("ua_user_idx").on(table.userId),
  achievementIdx: index("ua_achievement_idx").on(table.achievementId),
}));
export type UserAchievement = typeof userAchievements.$inferSelect;
export type InsertUserAchievement = typeof userAchievements.$inferInsert;

/**
 * User Stats - aggregate statistics for gamification
 */
export const userStats = mysqlTable("user_stats", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  totalPoints: int("totalPoints").default(0),
  level: int("level").default(1),
  tasksCompleted: int("tasksCompleted").default(0),
  projectsCompleted: int("projectsCompleted").default(0),
  totalTimeTracked: int("totalTimeTracked").default(0), // seconds
  currentStreak: int("currentStreak").default(0), // days
  longestStreak: int("longestStreak").default(0), // days
  lastActivityDate: timestamp("lastActivityDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type UserStat = typeof userStats.$inferSelect;
export type InsertUserStat = typeof userStats.$inferInsert;


// ============ AI ROUTER SYSTEM TABLES ============

/**
 * AI Cache - Cache AI requests with MD5 keys for faster responses
 */
export const aiCache = mysqlTable('ai_cache', {
  id: int('id').primaryKey().autoincrement(),
  cacheKey: varchar('cache_key', { length: 32 }).notNull().unique(),
  prompt: text('prompt').notNull(),
  response: text('response').notNull(),
  model: varchar('model', { length: 50 }).notNull(),
  taskType: varchar('task_type', { length: 20 }),
  tokens: int('tokens'),
  cost: decimal('cost', { precision: 10, scale: 6 }),
  hitCount: int('hit_count').default(0),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  cacheKeyIdx: index('ai_cache_key_idx').on(table.cacheKey),
  expiresAtIdx: index('ai_expires_at_idx').on(table.expiresAt),
}));
export type AiCache = typeof aiCache.$inferSelect;
export type InsertAiCache = typeof aiCache.$inferInsert;

/**
 * AI Requests - History of all AI requests
 */
export const aiRequests = mysqlTable('ai_requests', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id').notNull(),
  sessionId: varchar('session_id', { length: 36 }),
  prompt: text('prompt').notNull(),
  response: text('response').notNull(),
  model: varchar('model', { length: 50 }).notNull(),
  taskType: varchar('task_type', { length: 20 }),
  tokens: int('tokens'),
  cost: decimal('cost', { precision: 10, scale: 6 }),
  fromCache: boolean('from_cache').default(false),
  executionTime: int('execution_time'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('ai_requests_user_id_idx').on(table.userId),
  sessionIdIdx: index('ai_requests_session_id_idx').on(table.sessionId),
}));
export type AiRequest = typeof aiRequests.$inferSelect;
export type InsertAiRequest = typeof aiRequests.$inferInsert;

/**
 * AI Sessions - Chat sessions for AI conversations
 */
export const aiSessions = mysqlTable('ai_sessions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: int('user_id').notNull(),
  title: varchar('title', { length: 255 }).default('New Chat'),
  projectId: int('project_id'),
  lastMessageAt: timestamp('last_message_at'),
  messageCount: int('message_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('ai_sessions_user_id_idx').on(table.userId),
}));
export type AiSession = typeof aiSessions.$inferSelect;
export type InsertAiSession = typeof aiSessions.$inferInsert;

/**
 * AI Usage Stats - Daily usage statistics per user
 */
export const aiUsageStats = mysqlTable('ai_usage_stats', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id').notNull(),
  date: date('date').notNull(),
  totalRequests: int('total_requests').default(0),
  cachedRequests: int('cached_requests').default(0),
  totalTokens: int('total_tokens').default(0),
  totalCost: decimal('total_cost', { precision: 10, scale: 4 }).default('0.0000'),
  modelUsage: json('model_usage').$type<Record<string, number>>(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  userIdDateIdx: index('ai_usage_user_date_idx').on(table.userId, table.date),
}));
export type AiUsageStat = typeof aiUsageStats.$inferSelect;
export type InsertAiUsageStat = typeof aiUsageStats.$inferInsert;


// ============================================================================
// RELATIONS SYSTEM TABLES
// ============================================================================

/**
 * Tag definitions - reusable labels for categorizing tasks
 * Supports project-scoped and global tags with various types
 */
export const tags = mysqlTable("tags", {
  id: int("id").autoincrement().primaryKey(),
  
  // Scope - null projectId means global tag available to all projects
  projectId: int("projectId"),
  userId: int("userId").notNull(),
  
  // Tag identity
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 32 }).notNull().default("#6366f1"),
  icon: varchar("icon", { length: 64 }),
  description: text("description"),
  
  // Tag type for different use cases
  tagType: mysqlEnum("tagType", [
    "label", "category", "status", "sprint", "epic", "component", "custom"
  ]).default("label"),
  
  // Usage tracking
  usageCount: int("usageCount").default(0),
  isArchived: boolean("isArchived").default(false),
  sortOrder: int("sortOrder").default(0),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  projectIdx: index("tags_project_idx").on(table.projectId),
  userIdx: index("tags_user_idx").on(table.userId),
  nameIdx: index("tags_name_idx").on(table.name),
  typeIdx: index("tags_type_idx").on(table.tagType),
}));

export type Tag = typeof tags.$inferSelect;
export type InsertTag = typeof tags.$inferInsert;

/**
 * Task-Tag junction table - many-to-many relationship
 */
export const taskTags = mysqlTable("task_tags", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  tagId: int("tagId").notNull(),
  addedBy: int("addedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  taskIdx: index("tt_task_idx").on(table.taskId),
  tagIdx: index("tt_tag_idx").on(table.tagId),
  uniqueTaskTag: uniqueIndex("tt_unique_idx").on(table.taskId, table.tagId),
}));

export type TaskTag = typeof taskTags.$inferSelect;
export type InsertTaskTag = typeof taskTags.$inferInsert;

/**
 * Entity Relations - bidirectional relationships between any entities
 */
export const entityRelations = mysqlTable("entity_relations", {
  id: int("id").autoincrement().primaryKey(),
  
  // Source entity
  sourceType: mysqlEnum("sourceType", [
    "project", "block", "section", "task", "subtask"
  ]).notNull(),
  sourceId: int("sourceId").notNull(),
  
  // Target entity
  targetType: mysqlEnum("targetType", [
    "project", "block", "section", "task", "subtask"
  ]).notNull(),
  targetId: int("targetId").notNull(),
  
  // Type of relationship
  relationType: mysqlEnum("relationType", [
    "parent_child", "blocks", "blocked_by", "related_to", "duplicate_of",
    "depends_on", "required_by", "subtask_of", "linked", "cloned_from", "moved_from"
  ]).notNull(),
  
  // Bidirectional support
  isBidirectional: boolean("isBidirectional").default(true),
  reverseRelationType: varchar("reverseRelationType", { length: 50 }),
  
  createdBy: int("createdBy").notNull(),
  
  metadata: json("metadata").$type<{
    label?: string;
    color?: string;
    notes?: string;
    strength?: number;
  }>(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  sourceIdx: index("er_source_idx").on(table.sourceType, table.sourceId),
  targetIdx: index("er_target_idx").on(table.targetType, table.targetId),
  relationTypeIdx: index("er_relation_type_idx").on(table.relationType),
  createdByIdx: index("er_created_by_idx").on(table.createdBy),
}));

export type EntityRelation = typeof entityRelations.$inferSelect;
export type InsertEntityRelation = typeof entityRelations.$inferInsert;

/**
 * View Configs - user-defined view configurations
 */
export const viewConfigs = mysqlTable("view_configs", {
  id: int("id").autoincrement().primaryKey(),
  
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  
  name: varchar("name", { length: 255 }).notNull(),
  icon: varchar("icon", { length: 64 }).default("table"),
  color: varchar("color", { length: 32 }),
  description: text("description"),
  
  viewType: mysqlEnum("viewType", [
    "table", "kanban", "calendar", "gallery", "timeline", "list", "board"
  ]).notNull(),
  
  scope: mysqlEnum("scope", ["project", "block", "section", "filtered"]).default("project"),
  scopeId: int("scopeId"),
  
  columns: json("columns").$type<{
    id: string;
    field: string;
    width?: number;
    isVisible: boolean;
    sortOrder: number;
  }[]>(),
  
  filters: json("filters").$type<{
    id: string;
    field: string;
    operator: string;
    value: unknown;
    conjunction: "and" | "or";
  }[]>(),
  
  sorts: json("sorts").$type<{ field: string; direction: "asc" | "desc" }[]>(),
  
  groupBy: varchar("groupBy", { length: 100 }),
  subGroupBy: varchar("subGroupBy", { length: 100 }),
  
  // Calendar options
  calendarDateField: varchar("calendarDateField", { length: 100 }),
  calendarShowWeekends: boolean("calendarShowWeekends").default(true),
  
  // Gallery options
  galleryCoverField: varchar("galleryCoverField", { length: 100 }),
  galleryCardSize: mysqlEnum("galleryCardSize", ["small", "medium", "large"]).default("medium"),
  
  // Timeline options
  timelineStartField: varchar("timelineStartField", { length: 100 }).default("startDate"),
  timelineEndField: varchar("timelineEndField", { length: 100 }).default("deadline"),
  timelineShowDependencies: boolean("timelineShowDependencies").default(true),
  
  // Layout options
  showCompletedTasks: boolean("showCompletedTasks").default(true),
  showSubtasks: boolean("showSubtasks").default(false),
  showEmptyGroups: boolean("showEmptyGroups").default(true),
  collapsedGroups: json("collapsedGroups").$type<string[]>(),
  rowHeight: mysqlEnum("rowHeight", ["compact", "normal", "comfortable"]).default("normal"),
  
  isShared: boolean("isShared").default(false),
  isDefault: boolean("isDefault").default(false),
  isLocked: boolean("isLocked").default(false),
  sortOrder: int("sortOrder").default(0),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  projectUserIdx: index("vc_project_user_idx").on(table.projectId, table.userId),
  viewTypeIdx: index("vc_view_type_idx").on(table.viewType),
  isDefaultIdx: index("vc_is_default_idx").on(table.isDefault),
}));

export type ViewConfig = typeof viewConfigs.$inferSelect;
export type InsertViewConfig = typeof viewConfigs.$inferInsert;

/**
 * Kanban Columns - custom column configurations for Kanban boards
 */
export const kanbanColumns = mysqlTable("kanban_columns", {
  id: int("id").autoincrement().primaryKey(),
  
  viewConfigId: int("viewConfigId").notNull(),
  
  name: varchar("name", { length: 255 }).notNull(),
  color: varchar("color", { length: 32 }),
  icon: varchar("icon", { length: 64 }),
  description: text("description"),
  
  columnType: mysqlEnum("columnType", [
    "status", "priority", "assignee", "tag", "custom"
  ]).notNull(),
  
  matchValue: varchar("matchValue", { length: 255 }),
  matchField: varchar("matchField", { length: 100 }),
  
  customFilter: json("customFilter").$type<{
    field: string;
    operator: string;
    value: unknown;
  }[]>(),
  
  taskLimit: int("taskLimit"),
  showLimitWarning: boolean("showLimitWarning").default(true),
  limitWarningThreshold: int("limitWarningThreshold").default(80),
  
  isCollapsed: boolean("isCollapsed").default(false),
  isHidden: boolean("isHidden").default(false),
  allowDrop: boolean("allowDrop").default(true),
  
  autoActions: json("autoActions").$type<{
    setStatus?: string;
    setPriority?: string;
    setAssignee?: number;
    addTag?: number;
    removeTag?: number;
  }>(),
  
  defaultValues: json("defaultValues").$type<{
    status?: string;
    priority?: string;
    assigneeId?: number;
    tags?: number[];
  }>(),
  
  sortOrder: int("sortOrder").default(0),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  viewConfigIdx: index("kc_view_config_idx").on(table.viewConfigId),
  columnTypeIdx: index("kc_column_type_idx").on(table.columnType),
}));

export type KanbanColumn = typeof kanbanColumns.$inferSelect;
export type InsertKanbanColumn = typeof kanbanColumns.$inferInsert;

/**
 * Lookup Fields - pull data from related entities
 */
export const lookupFields = mysqlTable("lookup_fields", {
  id: int("id").autoincrement().primaryKey(),
  
  entityType: mysqlEnum("entityType", ["project", "block", "section", "task"]).notNull(),
  entityId: int("entityId"),
  
  name: varchar("name", { length: 100 }).notNull(),
  displayName: varchar("displayName", { length: 255 }).notNull(),
  description: text("description"),
  
  relationId: int("relationId"),
  relationType: varchar("relationType", { length: 50 }),
  
  sourceProperty: varchar("sourceProperty", { length: 100 }).notNull(),
  
  displayFormat: mysqlEnum("displayFormat", [
    "text", "badge", "avatar", "date", "datetime", "progress_bar",
    "link", "list", "number", "currency", "percentage"
  ]).default("text"),
  
  aggregation: mysqlEnum("aggregation", [
    "first", "last", "all", "count", "comma_list", "unique"
  ]).default("first"),
  
  formatOptions: json("formatOptions").$type<{
    dateFormat?: string;
    numberFormat?: string;
    prefix?: string;
    suffix?: string;
    maxItems?: number;
    emptyText?: string;
  }>(),
  
  isVisible: boolean("isVisible").default(true),
  sortOrder: int("sortOrder").default(0),
  createdBy: int("createdBy").notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  entityIdx: index("lf_entity_idx").on(table.entityType, table.entityId),
  relationTypeIdx: index("lf_relation_type_idx").on(table.relationType),
}));

export type LookupField = typeof lookupFields.$inferSelect;
export type InsertLookupField = typeof lookupFields.$inferInsert;

/**
 * Rollup Fields - aggregate calculations from related entities
 */
export const rollupFields = mysqlTable("rollup_fields", {
  id: int("id").autoincrement().primaryKey(),
  
  entityType: mysqlEnum("entityType", ["project", "block", "section", "task"]).notNull(),
  entityId: int("entityId"),
  
  name: varchar("name", { length: 100 }).notNull(),
  displayName: varchar("displayName", { length: 255 }).notNull(),
  description: text("description"),
  
  sourceRelationType: varchar("sourceRelationType", { length: 50 }).notNull(),
  sourceProperty: varchar("sourceProperty", { length: 100 }).notNull(),
  
  aggregationFunction: mysqlEnum("aggregationFunction", [
    "count", "count_values", "count_unique", "count_checked", "count_unchecked",
    "sum", "average", "median", "min", "max", "range",
    "percent_empty", "percent_not_empty", "percent_checked", "percent_unchecked",
    "earliest_date", "latest_date", "date_range_days",
    "show_original", "concatenate"
  ]).notNull(),
  
  filterConditions: json("filterConditions").$type<{
    field: string;
    operator: string;
    value: string | number | boolean | null;
  }[]>(),
  
  displayFormat: mysqlEnum("displayFormat", [
    "number", "percentage", "currency", "duration", "date", "progress_bar", "text", "fraction"
  ]).default("number"),
  
  decimalPlaces: int("decimalPlaces").default(0),
  prefix: varchar("prefix", { length: 20 }),
  suffix: varchar("suffix", { length: 20 }),
  
  progressBarMax: int("progressBarMax"),
  progressBarColor: varchar("progressBarColor", { length: 32 }),
  
  cachedValue: text("cachedValue"),
  lastCalculatedAt: timestamp("lastCalculatedAt"),
  cacheExpiresAt: timestamp("cacheExpiresAt"),
  
  isVisible: boolean("isVisible").default(true),
  sortOrder: int("sortOrder").default(0),
  createdBy: int("createdBy").notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  entityIdx: index("rf_entity_idx").on(table.entityType, table.entityId),
  sourceRelationIdx: index("rf_source_relation_idx").on(table.sourceRelationType),
}));

export type RollupField = typeof rollupFields.$inferSelect;
export type InsertRollupField = typeof rollupFields.$inferInsert;


/**
 * User Project Preferences - per-user settings for each project
 */
export const userProjectPreferences = mysqlTable("user_project_preferences", {
  id: int("id").autoincrement().primaryKey(),
  
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  
  // Grouping preferences
  groupBy: mysqlEnum("groupBy", ["none", "tag", "status", "priority"]).default("none"),
  
  // Filter preferences
  activeFilter: mysqlEnum("activeFilter", ["all", "not_started", "in_progress", "completed", "overdue"]).default("all"),
  
  // View preferences
  collapsedGroups: json("collapsedGroups").$type<string[]>(),
  collapsedSections: json("collapsedSections").$type<string[]>(),
  
  // Sidebar preferences
  sidebarCollapsed: boolean("sidebarCollapsed").default(false),
  
  // Last viewed block/section
  lastViewedBlockId: varchar("lastViewedBlockId", { length: 100 }),
  lastViewedSectionId: varchar("lastViewedSectionId", { length: 100 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  projectUserIdx: uniqueIndex("upp_project_user_idx").on(table.projectId, table.userId),
}));

export type UserProjectPreference = typeof userProjectPreferences.$inferSelect;
export type InsertUserProjectPreference = typeof userProjectPreferences.$inferInsert;


/**
 * AI Decision Records - finalized outcomes from AI conversations
 * Stores decisions that can be referenced in future AI context
 */
export const aiDecisionRecords = mysqlTable("ai_decision_records", {
  id: int("id").autoincrement().primaryKey(),
  
  // Context references
  sessionId: int("sessionId"), // AI chat session
  projectId: int("projectId"),
  taskId: varchar("taskId", { length: 100 }), // Task ID if decision relates to specific task
  blockId: varchar("blockId", { length: 100 }),
  
  // User who finalized
  userId: int("userId").notNull(),
  
  // Original conversation
  question: text("question").notNull(), // Original user question
  aiResponse: text("aiResponse").notNull(), // Full AI response
  
  // Finalized decision (THE KEY FIELD!)
  finalDecision: text("finalDecision").notNull(), // What was decided - summary
  
  // Structured data
  keyPoints: json("keyPoints").$type<{
    id: string;
    text: string;
    priority?: "high" | "medium" | "low";
  }[]>(),
  
  actionItems: json("actionItems").$type<{
    id: string;
    title: string;
    assignee?: string;
    deadline?: string;
    status: "pending" | "done" | "cancelled";
    subtaskId?: string; // If converted to subtask
  }[]>(),
  
  // Classification
  decisionType: mysqlEnum("decisionType", [
    "technical", "business", "design", "process", "architecture", "other"
  ]).default("other"),
  
  // Tags for filtering
  tags: json("tags").$type<string[]>(),
  
  // Status tracking
  status: mysqlEnum("status", [
    "active", "implemented", "obsolete", "superseded"
  ]).default("active"),
  
  supersededBy: int("supersededBy"), // Reference to newer decision
  
  // Metadata
  importance: mysqlEnum("importance", ["critical", "high", "medium", "low"]).default("medium"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  projectIdx: index("adr_project_idx").on(table.projectId),
  taskIdx: index("adr_task_idx").on(table.taskId),
  userIdx: index("adr_user_idx").on(table.userId),
  statusIdx: index("adr_status_idx").on(table.status),
  typeIdx: index("adr_type_idx").on(table.decisionType),
}));

export type AIDecisionRecord = typeof aiDecisionRecords.$inferSelect;
export type InsertAIDecisionRecord = typeof aiDecisionRecords.$inferInsert;


// ============================================================================
// AI CHAT PERSISTENCE TABLES
// ============================================================================

/**
 * AI Chat Sessions - persistent chat conversations
 * Stores chat sessions that persist across browser sessions
 */
export const aiChatSessions = mysqlTable("ai_chat_sessions", {
  id: int("id").autoincrement().primaryKey(),
  
  // Session identity
  sessionUuid: varchar("sessionUuid", { length: 36 }).notNull().unique(),
  
  // Owner
  userId: int("userId").notNull(),
  
  // Context references (optional)
  projectId: int("projectId"),
  taskId: varchar("taskId", { length: 100 }),
  
  // Session metadata
  title: varchar("title", { length: 255 }).default("Новый чат"),
  
  // Stats
  messageCount: int("messageCount").default(0),
  lastMessageAt: timestamp("lastMessageAt"),
  
  // Status
  isArchived: boolean("isArchived").default(false),
  isPinned: boolean("isPinned").default(false),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: index("acs_user_idx").on(table.userId),
  projectIdx: index("acs_project_idx").on(table.projectId),
  sessionUuidIdx: uniqueIndex("acs_uuid_idx").on(table.sessionUuid),
}));

export type AIChatSession = typeof aiChatSessions.$inferSelect;
export type InsertAIChatSession = typeof aiChatSessions.$inferInsert;

/**
 * AI Chat Messages - individual messages in chat sessions
 */
export const aiChatMessages = mysqlTable("ai_chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  
  // Parent session
  sessionId: int("sessionId").notNull(),
  
  // Message content
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: text("content").notNull(),
  
  // Metadata
  metadata: json("metadata").$type<{
    model?: string;
    tokens?: number;
    creditsUsed?: number;
    fromCache?: boolean;
    executionTime?: number;
    suggestedActions?: Array<{
      id: string;
      type: string;
      title: string;
      description?: string;
      data?: Record<string, unknown>;
      confidence: "high" | "medium" | "low";
    }>;
  }>(),
  
  // For tracking which messages have been finalized
  isFinalized: boolean("isFinalized").default(false),
  decisionRecordId: int("decisionRecordId"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  sessionIdx: index("acm_session_idx").on(table.sessionId),
  roleIdx: index("acm_role_idx").on(table.role),
}));

export type AIChatMessage = typeof aiChatMessages.$inferSelect;
export type InsertAIChatMessage = typeof aiChatMessages.$inferInsert;


// ============ ADMIN PANEL STAGE 2: USERS & CREDITS ============

/**
 * User Roles - Custom roles with permissions
 */
export const userRoles = mysqlTable("user_roles", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(),
  nameRu: varchar("nameRu", { length: 64 }),
  description: text("description"),
  color: varchar("color", { length: 32 }).default("#6366f1"),
  
  // Permission flags
  permissions: json("permissions").$type<{
    // Projects
    projectsCreate: boolean;
    projectsEdit: boolean;
    projectsDelete: boolean;
    projectsViewOnly: boolean;
    // AI
    aiUseChat: boolean;
    aiCreateAgents: boolean;
    aiConfigureSkills: boolean;
    // Admin
    adminAccess: boolean;
    adminFullAccess: boolean;
    // Credits
    creditsUnlimited: boolean;
    creditsLimited: boolean;
  }>().notNull(),
  
  isSystem: boolean("isSystem").default(false), // System roles can't be deleted
  isDefault: boolean("isDefault").default(false), // Default role for new users
  priority: int("priority").default(0), // Higher = more important
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserRole = typeof userRoles.$inferSelect;
export type InsertUserRole = typeof userRoles.$inferInsert;

/**
 * User Role Assignments - Link users to custom roles
 */
export const userRoleAssignments = mysqlTable("user_role_assignments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  roleId: int("roleId").notNull(),
  assignedBy: int("assignedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("ura_user_idx").on(table.userId),
  roleIdx: index("ura_role_idx").on(table.roleId),
}));

export type UserRoleAssignment = typeof userRoleAssignments.$inferSelect;
export type InsertUserRoleAssignment = typeof userRoleAssignments.$inferInsert;

/**
 * User Invitations - Platform-wide user invitations
 */
export const userInvitations = mysqlTable("user_invitations", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  roleId: int("roleId"),
  creditLimit: int("creditLimit").default(1000),
  
  status: mysqlEnum("status", ["pending", "accepted", "expired", "cancelled"]).default("pending").notNull(),
  invitedBy: int("invitedBy").notNull(),
  acceptedBy: int("acceptedBy"),
  acceptedAt: timestamp("acceptedAt"),
  
  message: text("message"), // Custom invitation message
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  emailIdx: index("ui_email_idx").on(table.email),
  tokenIdx: index("ui_token_idx").on(table.token),
  statusIdx: index("ui_status_idx").on(table.status),
}));

export type UserInvitation = typeof userInvitations.$inferSelect;
export type InsertUserInvitation = typeof userInvitations.$inferInsert;

/**
 * Credit Limits - Per-role and per-user limits
 */
export const creditLimits = mysqlTable("credit_limits", {
  id: int("id").autoincrement().primaryKey(),
  
  // Can be role-based or user-specific
  roleId: int("roleId"),
  userId: int("userId"),
  
  // Limits
  dailyLimit: int("dailyLimit").default(100), // Credits per day
  perRequestLimit: int("perRequestLimit").default(50), // Max credits per single request
  monthlyLimit: int("monthlyLimit").default(3000), // Credits per month
  projectLimit: int("projectLimit"), // Max credits per project (null = unlimited)
  
  // Notifications
  notifyAtPercent: int("notifyAtPercent").default(80), // Notify at this % of limit
  blockAtPercent: int("blockAtPercent").default(100), // Block at this % of limit
  allowOverride: boolean("allowOverride").default(false), // Allow exceeding limit with warning
  
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  roleIdx: index("cl_role_idx").on(table.roleId),
  userIdx: index("cl_user_idx").on(table.userId),
}));

export type CreditLimit = typeof creditLimits.$inferSelect;
export type InsertCreditLimit = typeof creditLimits.$inferInsert;

/**
 * Pricing Plans - Subscription tiers
 */
export const pricingPlans = mysqlTable("pricing_plans", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull(),
  nameRu: varchar("nameRu", { length: 64 }),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  description: text("description"),
  descriptionRu: text("descriptionRu"),
  
  // Pricing
  priceMonthly: int("priceMonthly").default(0), // In cents
  priceYearly: int("priceYearly").default(0), // In cents (discounted)
  currency: varchar("currency", { length: 3 }).default("USD"),
  
  // Limits
  creditsPerMonth: int("creditsPerMonth").default(1000),
  maxProjects: int("maxProjects").default(5),
  maxUsers: int("maxUsers").default(1), // Team members
  maxStorage: int("maxStorage").default(100), // MB
  
  // Features
  features: json("features").$type<{
    aiModels: string[]; // Available AI models
    prioritySupport: boolean;
    customBranding: boolean;
    apiAccess: boolean;
    advancedAnalytics: boolean;
    exportFormats: string[];
  }>(),
  
  // Display
  color: varchar("color", { length: 32 }).default("#6366f1"),
  icon: varchar("icon", { length: 64 }).default("star"),
  isPopular: boolean("isPopular").default(false),
  displayOrder: int("displayOrder").default(0),
  
  isActive: boolean("isActive").default(true),
  isSystem: boolean("isSystem").default(false), // System plans can't be deleted
  
  // Stripe integration
  stripeProductId: varchar("stripeProductId", { length: 255 }),
  stripePriceIdMonthly: varchar("stripePriceIdMonthly", { length: 255 }),
  stripePriceIdYearly: varchar("stripePriceIdYearly", { length: 255 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PricingPlan = typeof pricingPlans.$inferSelect;
export type InsertPricingPlan = typeof pricingPlans.$inferInsert;

/**
 * Model Pricing - AI model costs configuration
 */
export const modelPricing = mysqlTable("model_pricing", {
  id: int("id").autoincrement().primaryKey(),
  modelName: varchar("modelName", { length: 128 }).notNull().unique(),
  modelDisplayName: varchar("modelDisplayName", { length: 128 }),
  provider: varchar("provider", { length: 64 }).notNull(),
  
  // Cost per 1K tokens (in credits)
  inputCostPer1K: decimal("inputCostPer1K", { precision: 10, scale: 4 }).default("1.0000").notNull(),
  outputCostPer1K: decimal("outputCostPer1K", { precision: 10, scale: 4 }).default("2.0000").notNull(),
  
  // Plan restrictions (null = available to all)
  planRestrictions: json("planRestrictions").$type<{
    allowedPlanIds: number[];
    minPlanLevel: string; // "free", "pro", "enterprise"
  }>(),
  
  // Model capabilities
  capabilities: json("capabilities").$type<{
    maxTokens: number;
    supportsVision: boolean;
    supportsStreaming: boolean;
    supportsFunctionCalling: boolean;
  }>(),
  
  isEnabled: boolean("isEnabled").default(true),
  displayOrder: int("displayOrder").default(0),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ModelPricing = typeof modelPricing.$inferSelect;
export type InsertModelPricing = typeof modelPricing.$inferInsert;

/**
 * User Activity Log - Track user actions for admin panel
 */
export const userActivityLog = mysqlTable("user_activity_log", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  
  action: mysqlEnum("action", [
    "login", "logout",
    "project_created", "project_deleted",
    "ai_request", "ai_generate",
    "settings_changed", "password_reset",
    "role_changed", "blocked", "unblocked",
    "credits_added", "credits_spent",
    "invitation_sent", "invitation_accepted"
  ]).notNull(),
  
  metadata: json("metadata").$type<Record<string, unknown>>(),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("ual_user_idx").on(table.userId),
  actionIdx: index("ual_action_idx").on(table.action),
  createdIdx: index("ual_created_idx").on(table.createdAt),
}));

export type UserActivityLog = typeof userActivityLog.$inferSelect;
export type InsertUserActivityLog = typeof userActivityLog.$inferInsert;

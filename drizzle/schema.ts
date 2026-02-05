import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
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
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

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
  notes: text("notes"),
  summary: text("summary"), // AI-generated or user summary
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

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

// Type for template structure JSON
export type TemplateStructure = {
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
      }[];
    }[];
  }[];
};

export type ProjectTemplate = typeof projectTemplates.$inferSelect;
export type InsertProjectTemplate = typeof projectTemplates.$inferInsert;

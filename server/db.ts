import { eq, and, desc, asc, inArray, lt, not, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users,
  projects, InsertProject, Project,
  blocks, InsertBlock, Block,
  sections, InsertSection, Section,
  tasks, InsertTask, Task,
  subtasks, InsertSubtask, Subtask,
  subtaskTemplates, InsertSubtaskTemplate, SubtaskTemplate,
  subtaskTemplateItems, InsertSubtaskTemplateItem, SubtaskTemplateItem,
  aiSettings, InsertAiSetting, AiSetting,
  aiPreferences, InsertAiPreference, AiPreference,
  userCredits, InsertUserCredits, UserCredits,
  creditTransactions, InsertCreditTransaction, CreditTransaction,
  chatMessages, InsertChatMessage, ChatMessage,
  projectTemplates, InsertProjectTemplate, ProjectTemplate, TemplateStructure,
  templateCategories, InsertTemplateCategory, TemplateCategory,
  pitchDecks, InsertPitchDeck, PitchDeck, PitchDeckSlide,
  projectMembers, InsertProjectMember, ProjectMember,
  projectInvitations, InsertProjectInvitation, ProjectInvitation,
  activityLog, InsertActivityLog, ActivityLog,
  taskDependencies, InsertTaskDependency, TaskDependency,
  customFields, InsertCustomField, CustomField,
  customFieldValues, InsertCustomFieldValue, CustomFieldValue,
  savedViews, InsertSavedView, SavedView, SavedViewConfig
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ USER QUERIES ============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ PROJECT QUERIES ============

export async function createProject(data: InsertProject): Promise<Project> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(projects).values(data);
  const insertId = result[0].insertId;
  
  const [project] = await db.select().from(projects).where(eq(projects.id, insertId));
  return project;
}

export async function getProjectsByUser(userId: number): Promise<Project[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.updatedAt));
}

export async function getProjectById(id: number, userId: number): Promise<Project | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const [project] = await db.select().from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)));
  return project;
}

export async function updateProject(id: number, userId: number, data: Partial<InsertProject>): Promise<Project | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  await db.update(projects)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(projects.id, id), eq(projects.userId, userId)));

  return getProjectById(id, userId);
}

export async function deleteProject(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.delete(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)));
  return result[0].affectedRows > 0;
}

// ============ BLOCK QUERIES ============

export async function createBlock(data: InsertBlock): Promise<Block> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(blocks).values(data);
  const [block] = await db.select().from(blocks).where(eq(blocks.id, result[0].insertId));
  return block;
}

export async function getBlocksByProject(projectId: number): Promise<Block[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(blocks)
    .where(eq(blocks.projectId, projectId))
    .orderBy(asc(blocks.sortOrder), asc(blocks.number));
}

export async function updateBlock(id: number, data: Partial<InsertBlock>): Promise<Block | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  await db.update(blocks).set({ ...data, updatedAt: new Date() }).where(eq(blocks.id, id));
  const [block] = await db.select().from(blocks).where(eq(blocks.id, id));
  return block;
}

export async function deleteBlock(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.delete(blocks).where(eq(blocks.id, id));
  return result[0].affectedRows > 0;
}

// ============ SECTION QUERIES ============

export async function createSection(data: InsertSection): Promise<Section> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(sections).values(data);
  const [section] = await db.select().from(sections).where(eq(sections.id, result[0].insertId));
  return section;
}

export async function getSectionsByBlock(blockId: number): Promise<Section[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(sections)
    .where(eq(sections.blockId, blockId))
    .orderBy(asc(sections.sortOrder));
}

export async function updateSection(id: number, data: Partial<InsertSection>): Promise<Section | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  await db.update(sections).set({ ...data, updatedAt: new Date() }).where(eq(sections.id, id));
  const [section] = await db.select().from(sections).where(eq(sections.id, id));
  return section;
}

export async function deleteSection(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.delete(sections).where(eq(sections.id, id));
  return result[0].affectedRows > 0;
}

export async function moveSection(id: number, newBlockId: number, newSortOrder: number): Promise<Section | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  await db.update(sections)
    .set({ blockId: newBlockId, sortOrder: newSortOrder, updatedAt: new Date() })
    .where(eq(sections.id, id));
  const [section] = await db.select().from(sections).where(eq(sections.id, id));
  return section;
}

// ============ TASK QUERIES ============

export async function createTask(data: InsertTask): Promise<Task> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(tasks).values(data);
  const [task] = await db.select().from(tasks).where(eq(tasks.id, result[0].insertId));
  return task;
}

export async function getTasksBySection(sectionId: number): Promise<Task[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(tasks)
    .where(eq(tasks.sectionId, sectionId))
    .orderBy(asc(tasks.sortOrder));
}

export async function updateTask(id: number, data: Partial<InsertTask>): Promise<Task | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  await db.update(tasks).set({ ...data, updatedAt: new Date() }).where(eq(tasks.id, id));
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
  return task;
}

export async function deleteTask(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.delete(tasks).where(eq(tasks.id, id));
  return result[0].affectedRows > 0;
}

export async function moveTask(id: number, newSectionId: number, newSortOrder: number): Promise<Task | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  await db.update(tasks)
    .set({ sectionId: newSectionId, sortOrder: newSortOrder, updatedAt: new Date() })
    .where(eq(tasks.id, id));
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
  return task;
}

// ============ SUBTASK QUERIES ============

export async function createSubtask(data: InsertSubtask): Promise<Subtask> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(subtasks).values(data);
  const [subtask] = await db.select().from(subtasks).where(eq(subtasks.id, result[0].insertId));
  return subtask;
}

export async function getSubtasksByTask(taskId: number): Promise<Subtask[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(subtasks)
    .where(eq(subtasks.taskId, taskId))
    .orderBy(asc(subtasks.sortOrder));
}

export async function updateSubtask(id: number, data: Partial<InsertSubtask>): Promise<Subtask | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  await db.update(subtasks).set({ ...data, updatedAt: new Date() }).where(eq(subtasks.id, id));
  const [subtask] = await db.select().from(subtasks).where(eq(subtasks.id, id));
  return subtask;
}

export async function deleteSubtask(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.delete(subtasks).where(eq(subtasks.id, id));
  return result[0].affectedRows > 0;
}

export async function reorderSubtasks(taskId: number, subtaskIds: number[]): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  // Update sortOrder for each subtask based on position in array
  for (let i = 0; i < subtaskIds.length; i++) {
    await db.update(subtasks)
      .set({ sortOrder: i, updatedAt: new Date() })
      .where(eq(subtasks.id, subtaskIds[i]));
  }

  return true;
}

// ============ SUBTASK TEMPLATE QUERIES ============

export async function createSubtaskTemplate(
  userId: number,
  name: string,
  items: string[],
  description?: string,
  category?: string
): Promise<SubtaskTemplate | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(subtaskTemplates).values({
    userId,
    name,
    description,
    category,
  });

  const templateId = result[0].insertId;

  // Insert template items
  for (let i = 0; i < items.length; i++) {
    await db.insert(subtaskTemplateItems).values({
      templateId,
      title: items[i],
      sortOrder: i,
    });
  }

  const [template] = await db.select().from(subtaskTemplates).where(eq(subtaskTemplates.id, templateId));
  return template;
}

export async function getSubtaskTemplatesByUser(userId: number): Promise<(SubtaskTemplate & { items: SubtaskTemplateItem[] })[]> {
  const db = await getDb();
  if (!db) return [];

  const templates = await db.select().from(subtaskTemplates)
    .where(eq(subtaskTemplates.userId, userId))
    .orderBy(desc(subtaskTemplates.usageCount));

  const templatesWithItems = await Promise.all(
    templates.map(async (template) => {
      const items = await db.select().from(subtaskTemplateItems)
        .where(eq(subtaskTemplateItems.templateId, template.id))
        .orderBy(asc(subtaskTemplateItems.sortOrder));
      return { ...template, items };
    })
  );

  return templatesWithItems;
}

export async function getSubtaskTemplateById(
  templateId: number,
  userId: number
): Promise<(SubtaskTemplate & { items: SubtaskTemplateItem[] }) | null> {
  const db = await getDb();
  if (!db) return null;

  const [template] = await db.select().from(subtaskTemplates)
    .where(and(eq(subtaskTemplates.id, templateId), eq(subtaskTemplates.userId, userId)));

  if (!template) return null;

  const items = await db.select().from(subtaskTemplateItems)
    .where(eq(subtaskTemplateItems.templateId, templateId))
    .orderBy(asc(subtaskTemplateItems.sortOrder));

  return { ...template, items };
}

export async function deleteSubtaskTemplate(templateId: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  // Delete items first
  await db.delete(subtaskTemplateItems).where(eq(subtaskTemplateItems.templateId, templateId));

  // Delete template
  const result = await db.delete(subtaskTemplates)
    .where(and(eq(subtaskTemplates.id, templateId), eq(subtaskTemplates.userId, userId)));

  return result[0].affectedRows > 0;
}

export async function applySubtaskTemplate(templateId: number, taskId: number, userId: number): Promise<Subtask[]> {
  const db = await getDb();
  if (!db) return [];

  // Get template with items
  const template = await getSubtaskTemplateById(templateId, userId);
  if (!template) return [];

  // Get current max sortOrder for existing subtasks
  const existingSubtasks = await getSubtasksByTask(taskId);
  const maxSortOrder = existingSubtasks.length > 0 
    ? Math.max(...existingSubtasks.map(s => s.sortOrder || 0)) + 1 
    : 0;

  // Create subtasks from template items
  const createdSubtasks: Subtask[] = [];
  for (let i = 0; i < template.items.length; i++) {
    const result = await db.insert(subtasks).values({
      taskId,
      title: template.items[i].title,
      sortOrder: maxSortOrder + i,
      status: 'not_started',
    });
    const [subtask] = await db.select().from(subtasks).where(eq(subtasks.id, result[0].insertId));
    createdSubtasks.push(subtask);
  }

  // Increment usage count
  await db.update(subtaskTemplates)
    .set({ usageCount: (template.usageCount || 0) + 1 })
    .where(eq(subtaskTemplates.id, templateId));

  return createdSubtasks;
}

export async function saveSubtasksAsTemplate(
  taskId: number,
  userId: number,
  name: string,
  description?: string,
  category?: string
): Promise<SubtaskTemplate | null> {
  const db = await getDb();
  if (!db) return null;

  // Get existing subtasks from task
  const taskSubtasks = await getSubtasksByTask(taskId);
  if (taskSubtasks.length === 0) return null;

  // Create template with items
  return createSubtaskTemplate(
    userId,
    name,
    taskSubtasks.map(s => s.title),
    description,
    category
  );
}

// ============ AI SETTINGS QUERIES ============

export async function getAiSettingsByUser(userId: number): Promise<AiSetting[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(aiSettings)
    .where(eq(aiSettings.userId, userId))
    .orderBy(desc(aiSettings.isDefault));
}

export async function upsertAiSetting(data: InsertAiSetting): Promise<AiSetting> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if setting exists for this user + provider
  const [existing] = await db.select().from(aiSettings)
    .where(and(eq(aiSettings.userId, data.userId), eq(aiSettings.provider, data.provider)));

  if (existing) {
    await db.update(aiSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(aiSettings.id, existing.id));
    const [updated] = await db.select().from(aiSettings).where(eq(aiSettings.id, existing.id));
    return updated;
  } else {
    const result = await db.insert(aiSettings).values(data);
    const [setting] = await db.select().from(aiSettings).where(eq(aiSettings.id, result[0].insertId));
    return setting;
  }
}

export async function setDefaultAiProvider(userId: number, provider: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Reset all defaults for user
  await db.update(aiSettings)
    .set({ isDefault: false })
    .where(eq(aiSettings.userId, userId));

  // Set new default
  await db.update(aiSettings)
    .set({ isDefault: true })
    .where(and(eq(aiSettings.userId, userId), eq(aiSettings.provider, provider as any)));
}

export async function deleteAiSetting(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.delete(aiSettings)
    .where(and(eq(aiSettings.id, id), eq(aiSettings.userId, userId)));
  return result[0].affectedRows > 0;
}

// ============ AI PREFERENCES QUERIES ============

export async function getAiPreferences(userId: number): Promise<AiPreference | null> {
  const db = await getDb();
  if (!db) return null;

  const [prefs] = await db.select().from(aiPreferences)
    .where(eq(aiPreferences.userId, userId));
  return prefs || null;
}

export async function upsertAiPreferences(
  userId: number,
  data: Partial<Omit<InsertAiPreference, 'userId'>>
): Promise<AiPreference> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [existing] = await db.select().from(aiPreferences)
    .where(eq(aiPreferences.userId, userId));

  if (existing) {
    await db.update(aiPreferences)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(aiPreferences.id, existing.id));
    const [updated] = await db.select().from(aiPreferences).where(eq(aiPreferences.id, existing.id));
    return updated;
  } else {
    const result = await db.insert(aiPreferences).values({ userId, ...data });
    const [prefs] = await db.select().from(aiPreferences).where(eq(aiPreferences.id, result[0].insertId));
    return prefs;
  }
}

// ============ CHAT MESSAGE QUERIES ============

export async function createChatMessage(data: InsertChatMessage): Promise<ChatMessage> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(chatMessages).values(data);
  const [message] = await db.select().from(chatMessages).where(eq(chatMessages.id, result[0].insertId));
  return message;
}

export async function getChatHistory(
  contextType: 'project' | 'block' | 'section' | 'task',
  contextId: number,
  userId: number,
  limit: number = 50
): Promise<ChatMessage[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(chatMessages)
    .where(and(
      eq(chatMessages.contextType, contextType),
      eq(chatMessages.contextId, contextId),
      eq(chatMessages.userId, userId)
    ))
    .orderBy(asc(chatMessages.createdAt))
    .limit(limit);
}

export async function clearChatHistory(
  contextType: 'project' | 'block' | 'section' | 'task',
  contextId: number,
  userId: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.delete(chatMessages)
    .where(and(
      eq(chatMessages.contextType, contextType),
      eq(chatMessages.contextId, contextId),
      eq(chatMessages.userId, userId)
    ));
  return result[0].affectedRows > 0;
}

// ============ FULL PROJECT WITH HIERARCHY ============

export async function getFullProject(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;

  const project = await getProjectById(projectId, userId);
  if (!project) return null;

  const projectBlocks = await getBlocksByProject(projectId);
  
  const blocksWithSections = await Promise.all(
    projectBlocks.map(async (block) => {
      const blockSections = await getSectionsByBlock(block.id);
      
      const sectionsWithTasks = await Promise.all(
        blockSections.map(async (section) => {
          const sectionTasks = await getTasksBySection(section.id);
          
          const tasksWithSubtasks = await Promise.all(
            sectionTasks.map(async (task) => {
              const taskSubtasks = await getSubtasksByTask(task.id);
              return { ...task, subtasks: taskSubtasks };
            })
          );
          
          return { ...section, tasks: tasksWithSubtasks };
        })
      );
      
      return { ...block, sections: sectionsWithTasks };
    })
  );

  return { ...project, blocks: blocksWithSections };
}


// ============ USER CREDITS ============

const INITIAL_CREDITS = 1000;

export async function getUserCredits(userId: number): Promise<UserCredits | null> {
  const db = await getDb();
  if (!db) return null;

  const [credits] = await db.select().from(userCredits)
    .where(eq(userCredits.userId, userId));
  return credits || null;
}

export async function initializeUserCredits(userId: number): Promise<UserCredits> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if already exists
  const existing = await getUserCredits(userId);
  if (existing) return existing;

  // Create new credits record
  const result = await db.insert(userCredits).values({
    userId,
    credits: INITIAL_CREDITS,
    totalEarned: INITIAL_CREDITS,
    totalSpent: 0,
    useBYOK: false,
  });

  // Record initial credit transaction
  await db.insert(creditTransactions).values({
    userId,
    amount: INITIAL_CREDITS,
    balance: INITIAL_CREDITS,
    type: 'initial',
    description: 'Начальные кредиты при регистрации',
  });

  const [credits] = await db.select().from(userCredits).where(eq(userCredits.id, result[0].insertId));
  return credits;
}

export async function deductCredits(
  userId: number,
  amount: number,
  description: string,
  model?: string,
  tokensUsed?: number
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, newBalance: 0, error: "Database not available" };

  // Get current credits
  const credits = await getUserCredits(userId);
  if (!credits) {
    return { success: false, newBalance: 0, error: "Кредиты не найдены" };
  }

  if (credits.credits < amount) {
    return { success: false, newBalance: credits.credits, error: "Недостаточно кредитов" };
  }

  const newBalance = credits.credits - amount;

  // Update credits
  await db.update(userCredits)
    .set({
      credits: newBalance,
      totalSpent: credits.totalSpent + amount,
      updatedAt: new Date(),
    })
    .where(eq(userCredits.userId, userId));

  // Record transaction
  await db.insert(creditTransactions).values({
    userId,
    amount: -amount,
    balance: newBalance,
    type: 'ai_request',
    description,
    model,
    tokensUsed,
  });

  return { success: true, newBalance };
}

export async function addCredits(
  userId: number,
  amount: number,
  type: 'bonus' | 'purchase' | 'refund',
  description: string
): Promise<{ success: boolean; newBalance: number }> {
  const db = await getDb();
  if (!db) return { success: false, newBalance: 0 };

  // Get or create credits
  let credits = await getUserCredits(userId);
  if (!credits) {
    credits = await initializeUserCredits(userId);
  }

  const newBalance = credits.credits + amount;

  // Update credits
  await db.update(userCredits)
    .set({
      credits: newBalance,
      totalEarned: credits.totalEarned + amount,
      updatedAt: new Date(),
    })
    .where(eq(userCredits.userId, userId));

  // Record transaction
  await db.insert(creditTransactions).values({
    userId,
    amount,
    balance: newBalance,
    type,
    description,
  });

  return { success: true, newBalance };
}

export async function getCreditHistory(
  userId: number,
  limit: number = 50
): Promise<CreditTransaction[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(creditTransactions)
    .where(eq(creditTransactions.userId, userId))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(limit);
}

export async function toggleBYOKMode(userId: number, useBYOK: boolean): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  await db.update(userCredits)
    .set({ useBYOK, updatedAt: new Date() })
    .where(eq(userCredits.userId, userId));

  return true;
}


// ============ PROJECT TEMPLATES ============

export async function getTemplates(userId: number): Promise<ProjectTemplate[]> {
  const db = await getDb();
  if (!db) return [];

  // Get public templates and user's own templates
  const results = await db.select().from(projectTemplates)
    .orderBy(desc(projectTemplates.usageCount), desc(projectTemplates.createdAt));
  
  // Filter: public templates OR user's own templates
  return results.filter(t => t.isPublic || t.authorId === userId);
}

export async function getPublicTemplates(): Promise<ProjectTemplate[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(projectTemplates)
    .where(eq(projectTemplates.isPublic, true))
    .orderBy(desc(projectTemplates.usageCount), desc(projectTemplates.createdAt));
}

export async function getTemplateById(id: number): Promise<ProjectTemplate | null> {
  const db = await getDb();
  if (!db) return null;

  const [template] = await db.select().from(projectTemplates)
    .where(eq(projectTemplates.id, id));
  return template || null;
}

export async function createTemplate(data: {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  categoryId?: number;
  structure: TemplateStructure;
  isPublic: boolean;
  authorId: number;
  authorName?: string;
  estimatedDuration?: string;
}): Promise<ProjectTemplate> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Calculate counts from structure
  const blocksCount = data.structure.blocks.length;
  const sectionsCount = data.structure.blocks.reduce((acc, b) => acc + b.sections.length, 0);
  const tasksCount = data.structure.blocks.reduce((acc, b) => 
    acc + b.sections.reduce((sAcc, s) => sAcc + s.tasks.length, 0), 0);

  const result = await db.insert(projectTemplates).values({
    name: data.name,
    description: data.description,
    icon: data.icon || 'layout-template',
    color: data.color || '#8b5cf6',
    categoryId: data.categoryId,
    structure: data.structure,
    isPublic: data.isPublic,
    authorId: data.authorId,
    authorName: data.authorName,
    blocksCount,
    sectionsCount,
    tasksCount,
    estimatedDuration: data.estimatedDuration,
    usageCount: 0,
    rating: 0,
  });

  const [template] = await db.select().from(projectTemplates)
    .where(eq(projectTemplates.id, result[0].insertId));
  return template;
}

export async function deleteTemplate(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  // Only allow deletion by author
  const template = await getTemplateById(id);
  if (!template || template.authorId !== userId) {
    return false;
  }

  await db.delete(projectTemplates).where(eq(projectTemplates.id, id));
  return true;
}

export async function incrementTemplateUsage(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const template = await getTemplateById(id);
  if (!template) return;

  await db.update(projectTemplates)
    .set({ usageCount: (template.usageCount || 0) + 1 })
    .where(eq(projectTemplates.id, id));
}

export async function saveProjectAsTemplate(
  projectId: number,
  userId: number,
  userName: string,
  templateName: string,
  templateDescription: string,
  isPublic: boolean
): Promise<ProjectTemplate | null> {
  const db = await getDb();
  if (!db) return null;

  // Get full project data
  const project = await getFullProject(projectId, userId);
  if (!project) return null;

  // Convert project to template structure
  const structure: TemplateStructure = {
    blocks: project.blocks.map(block => ({
      title: block.title,
      description: block.description || undefined,
      duration: block.duration || undefined,
      sections: block.sections.map(section => ({
        title: section.title,
        description: section.description || undefined,
        tasks: section.tasks.map(task => ({
          title: task.title,
          description: task.description || undefined,
        })),
      })),
    })),
  };

  // Calculate estimated duration from blocks
  const durations = project.blocks.map(b => b.duration).filter(Boolean);
  const estimatedDuration = durations.length > 0 ? durations.join(' + ') : undefined;

  return createTemplate({
    name: templateName,
    description: templateDescription,
    icon: project.icon || 'layout-template',
    color: project.color || '#8b5cf6',
    structure,
    isPublic,
    authorId: userId,
    authorName: userName,
    estimatedDuration,
  });
}

// ============ TEMPLATE CATEGORIES ============

export async function getTemplateCategories(): Promise<TemplateCategory[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(templateCategories)
    .orderBy(asc(templateCategories.sortOrder));
}

export async function createTemplateCategory(data: InsertTemplateCategory): Promise<TemplateCategory> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(templateCategories).values(data);
  const [category] = await db.select().from(templateCategories)
    .where(eq(templateCategories.id, result[0].insertId));
  return category;
}


// ============ DAILY BRIEFING ============

export interface DailyBriefingData {
  greeting: string;
  date: string;
  todaysTasks: {
    projectId: number;
    projectName: string;
    taskId: number;
    taskTitle: string;
    sectionTitle: string;
    blockTitle: string;
    isCompleted: boolean;
  }[];
  overdueTasks: {
    projectId: number;
    projectName: string;
    taskId: number;
    taskTitle: string;
    dueDate: Date;
    daysOverdue: number;
  }[];
  projectProgress: {
    projectId: number;
    projectName: string;
    totalTasks: number;
    completedTasks: number;
    progressPercent: number;
    estimatedCompletion: string | null;
    pace: 'ahead' | 'on-track' | 'behind' | 'unknown';
  }[];
  stats: {
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    totalTasksToday: number;
    completedToday: number;
    overdueCount: number;
  };
}

export async function getDailyBriefing(userId: number): Promise<DailyBriefingData> {
  const db = await getDb();
  
  // Get greeting based on time of day
  const hour = new Date().getHours();
  let greeting = 'Доброе утро';
  if (hour >= 12 && hour < 17) greeting = 'Добрый день';
  else if (hour >= 17 && hour < 22) greeting = 'Добрый вечер';
  else if (hour >= 22 || hour < 5) greeting = 'Доброй ночи';
  
  const today = new Date();
  const dateStr = today.toLocaleDateString('ru-RU', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  if (!db) {
    return {
      greeting,
      date: dateStr,
      todaysTasks: [],
      overdueTasks: [],
      projectProgress: [],
      stats: {
        totalProjects: 0,
        activeProjects: 0,
        completedProjects: 0,
        totalTasksToday: 0,
        completedToday: 0,
        overdueCount: 0,
      },
    };
  }
  
  // Get all user's projects with their tasks
  const userProjects = await db.select().from(projects)
    .where(eq(projects.userId, userId));
  
  const todaysTasks: DailyBriefingData['todaysTasks'] = [];
  const overdueTasks: DailyBriefingData['overdueTasks'] = [];
  const projectProgress: DailyBriefingData['projectProgress'] = [];
  
  let totalTasksToday = 0;
  let completedToday = 0;
  let activeProjects = 0;
  let completedProjects = 0;
  
  for (const project of userProjects) {
    // Get all blocks for this project
    const projectBlocks = await db.select().from(blocks)
      .where(eq(blocks.projectId, project.id));
    
    let projectTotalTasks = 0;
    let projectCompletedTasks = 0;
    
    for (const block of projectBlocks) {
      // Get sections for this block
      const blockSections = await db.select().from(sections)
        .where(eq(sections.blockId, block.id));
      
      for (const section of blockSections) {
        // Get tasks for this section
        const sectionTasks = await db.select().from(tasks)
          .where(eq(tasks.sectionId, section.id));
        
        for (const task of sectionTasks) {
          projectTotalTasks++;
          const isTaskCompleted = task.status === 'completed';
          if (isTaskCompleted) {
            projectCompletedTasks++;
          }
          
          // For daily briefing, we'll include tasks from the first incomplete section
          // Since tasks don't have deadlines in schema, we'll show all incomplete tasks
          if (!isTaskCompleted) {
            todaysTasks.push({
              projectId: project.id,
              projectName: project.name,
              taskId: task.id,
              taskTitle: task.title,
              sectionTitle: section.title,
              blockTitle: block.title,
              isCompleted: isTaskCompleted,
            });
          }
        }
      }
    }
    
    // Calculate project progress
    const progressPercent = projectTotalTasks > 0 
      ? Math.round((projectCompletedTasks / projectTotalTasks) * 100) 
      : 0;
    
    // Determine pace based on deadline and progress
    let pace: 'ahead' | 'on-track' | 'behind' | 'unknown' = 'unknown';
    let estimatedCompletion: string | null = null;
    
    if (project.targetDate && projectTotalTasks > 0) {
      const deadline = new Date(project.targetDate);
      const totalDays = Math.ceil((deadline.getTime() - new Date(project.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      const daysElapsed = Math.ceil((today.getTime() - new Date(project.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      const expectedProgress = Math.round((daysElapsed / totalDays) * 100);
      
      if (progressPercent >= expectedProgress + 10) {
        pace = 'ahead';
      } else if (progressPercent >= expectedProgress - 10) {
        pace = 'on-track';
      } else {
        pace = 'behind';
      }
      
      // Estimate completion date based on current pace
      if (projectCompletedTasks > 0 && daysElapsed > 0) {
        const tasksPerDay = projectCompletedTasks / daysElapsed;
        const remainingTasks = projectTotalTasks - projectCompletedTasks;
        const daysToComplete = Math.ceil(remainingTasks / tasksPerDay);
        const estimatedDate = new Date(today.getTime() + daysToComplete * 24 * 60 * 60 * 1000);
        estimatedCompletion = estimatedDate.toLocaleDateString('ru-RU', { 
          day: 'numeric', 
          month: 'short', 
          year: 'numeric' 
        });
      }
    }
    
    // Track project status
    if (progressPercent === 100) {
      completedProjects++;
    } else {
      activeProjects++;
    }
    
    projectProgress.push({
      projectId: project.id,
      projectName: project.name,
      totalTasks: projectTotalTasks,
      completedTasks: projectCompletedTasks,
      progressPercent,
      estimatedCompletion,
      pace,
    });
  }
  
  // Sort overdue tasks by days overdue (most overdue first)
  overdueTasks.sort((a, b) => b.daysOverdue - a.daysOverdue);
  
  // Sort today's tasks: incomplete first, then by project
  todaysTasks.sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) {
      return a.isCompleted ? 1 : -1;
    }
    return a.projectName.localeCompare(b.projectName);
  });
  
  return {
    greeting,
    date: dateStr,
    todaysTasks,
    overdueTasks,
    projectProgress,
    stats: {
      totalProjects: userProjects.length,
      activeProjects,
      completedProjects,
      totalTasksToday,
      completedToday,
      overdueCount: overdueTasks.length,
    },
  };
}


// ============ PITCH DECK QUERIES ============

export async function createPitchDeck(data: {
  userId: number;
  projectId: number;
  title: string;
  subtitle?: string;
  slides: PitchDeckSlide[];
}): Promise<PitchDeck> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(pitchDecks).values({
    userId: data.userId,
    projectId: data.projectId,
    title: data.title,
    subtitle: data.subtitle,
    slides: data.slides,
  });

  const [created] = await db.select().from(pitchDecks)
    .where(eq(pitchDecks.id, result.insertId));
  
  return created;
}

export async function getPitchDecksByUser(userId: number): Promise<PitchDeck[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(pitchDecks)
    .where(eq(pitchDecks.userId, userId))
    .orderBy(desc(pitchDecks.createdAt));
}

export async function getPitchDeckById(id: number, userId: number): Promise<PitchDeck | null> {
  const db = await getDb();
  if (!db) return null;

  const [deck] = await db.select().from(pitchDecks)
    .where(and(eq(pitchDecks.id, id), eq(pitchDecks.userId, userId)));
  
  return deck || null;
}

export async function updatePitchDeck(
  id: number, 
  userId: number, 
  data: Partial<{ title: string; subtitle: string; slides: PitchDeckSlide[]; exportedUrl: string; exportFormat: string }>
): Promise<PitchDeck | null> {
  const db = await getDb();
  if (!db) return null;

  await db.update(pitchDecks)
    .set(data)
    .where(and(eq(pitchDecks.id, id), eq(pitchDecks.userId, userId)));

  return getPitchDeckById(id, userId);
}

export async function deletePitchDeck(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const [result] = await db.delete(pitchDecks)
    .where(and(eq(pitchDecks.id, id), eq(pitchDecks.userId, userId)));

  return result.affectedRows > 0;
}

export async function getPitchDecksByProject(projectId: number, userId: number): Promise<PitchDeck[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(pitchDecks)
    .where(and(eq(pitchDecks.projectId, projectId), eq(pitchDecks.userId, userId)))
    .orderBy(desc(pitchDecks.createdAt));
}


// ============ ADVANCED TASK MANAGEMENT ============

export async function getTaskById(id: number): Promise<Task | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
  return task || null;
}

export async function getSectionById(id: number): Promise<Section | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [section] = await db.select().from(sections).where(eq(sections.id, id));
  return section || null;
}

export async function getBlockById(id: number): Promise<Block | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [block] = await db.select().from(blocks).where(eq(blocks.id, id));
  return block || null;
}

// Split a task into multiple subtasks
export async function splitTaskIntoSubtasks(
  taskId: number, 
  subtaskTitles: string[]
): Promise<{ task: Task; subtasks: Subtask[] }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) throw new Error("Task not found");
  
  // Create subtasks
  const createdSubtasks: Subtask[] = [];
  for (let i = 0; i < subtaskTitles.length; i++) {
    const result = await db.insert(subtasks).values({
      taskId,
      title: subtaskTitles[i],
      status: "not_started",
      sortOrder: i,
    });
    const [subtask] = await db.select().from(subtasks).where(eq(subtasks.id, result[0].insertId));
    createdSubtasks.push(subtask);
  }
  
  // Update task status to in_progress if it was not_started
  if (task.status === "not_started") {
    await db.update(tasks)
      .set({ status: "in_progress", updatedAt: new Date() })
      .where(eq(tasks.id, taskId));
  }
  
  const [updatedTask] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  return { task: updatedTask, subtasks: createdSubtasks };
}

// Merge multiple tasks into one
export async function mergeTasks(
  taskIds: number[], 
  newTitle: string,
  sectionId: number
): Promise<Task> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  if (taskIds.length < 2) throw new Error("Need at least 2 tasks to merge");
  
  // Get all tasks to merge
  const tasksToMerge = await db.select().from(tasks).where(inArray(tasks.id, taskIds));
  if (tasksToMerge.length !== taskIds.length) throw new Error("Some tasks not found");
  
  // Combine descriptions
  const combinedDescription = tasksToMerge
    .map(t => `**${t.title}**\n${t.description || ''}`)
    .join('\n\n---\n\n');
  
  // Get max sort order in section
  const existingTasks = await db.select().from(tasks).where(eq(tasks.sectionId, sectionId));
  const maxSortOrder = Math.max(...existingTasks.map(t => t.sortOrder || 0), 0);
  
  // Create new merged task
  const result = await db.insert(tasks).values({
    sectionId,
    title: newTitle,
    description: combinedDescription,
    status: "not_started",
    sortOrder: maxSortOrder + 1,
  });
  
  const [newTask] = await db.select().from(tasks).where(eq(tasks.id, result[0].insertId));
  
  // Move all subtasks from merged tasks to new task
  for (const oldTask of tasksToMerge) {
    await db.update(subtasks)
      .set({ taskId: newTask.id, updatedAt: new Date() })
      .where(eq(subtasks.taskId, oldTask.id));
  }
  
  // Delete old tasks
  await db.delete(tasks).where(inArray(tasks.id, taskIds));
  
  return newTask;
}

// Convert a task to a section (promote)
export async function convertTaskToSection(
  taskId: number
): Promise<Section> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) throw new Error("Task not found");
  
  // Get the section to find the block
  const [oldSection] = await db.select().from(sections).where(eq(sections.id, task.sectionId));
  if (!oldSection) throw new Error("Section not found");
  
  // Get max sort order for sections in this block
  const existingSections = await db.select().from(sections).where(eq(sections.blockId, oldSection.blockId));
  const maxSortOrder = Math.max(...existingSections.map(s => s.sortOrder || 0), 0);
  
  // Create new section from task
  const result = await db.insert(sections).values({
    blockId: oldSection.blockId,
    title: task.title,
    description: task.description,
    sortOrder: maxSortOrder + 1,
  });
  
  const [newSection] = await db.select().from(sections).where(eq(sections.id, result[0].insertId));
  
  // Convert subtasks to tasks in the new section
  const taskSubtasks = await db.select().from(subtasks).where(eq(subtasks.taskId, taskId));
  for (let i = 0; i < taskSubtasks.length; i++) {
    await db.insert(tasks).values({
      sectionId: newSection.id,
      title: taskSubtasks[i].title,
      status: taskSubtasks[i].status,
      sortOrder: i,
    });
  }
  
  // Delete old subtasks and task
  await db.delete(subtasks).where(eq(subtasks.taskId, taskId));
  await db.delete(tasks).where(eq(tasks.id, taskId));
  
  return newSection;
}

// Convert a section to a task (demote)
export async function convertSectionToTask(
  sectionId: number,
  targetSectionId: number
): Promise<Task> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [section] = await db.select().from(sections).where(eq(sections.id, sectionId));
  if (!section) throw new Error("Section not found");
  
  // Get all tasks in the section
  const sectionTasks = await db.select().from(tasks).where(eq(tasks.sectionId, sectionId));
  
  // Get max sort order in target section
  const existingTasks = await db.select().from(tasks).where(eq(tasks.sectionId, targetSectionId));
  const maxSortOrder = Math.max(...existingTasks.map(t => t.sortOrder || 0), 0);
  
  // Create new task from section
  const result = await db.insert(tasks).values({
    sectionId: targetSectionId,
    title: section.title,
    description: section.description,
    status: "not_started",
    sortOrder: maxSortOrder + 1,
  });
  
  const [newTask] = await db.select().from(tasks).where(eq(tasks.id, result[0].insertId));
  
  // Convert tasks to subtasks
  for (let i = 0; i < sectionTasks.length; i++) {
    await db.insert(subtasks).values({
      taskId: newTask.id,
      title: sectionTasks[i].title,
      status: sectionTasks[i].status,
      sortOrder: i,
    });
    
    // Delete subtasks of old task first
    await db.delete(subtasks).where(eq(subtasks.taskId, sectionTasks[i].id));
  }
  
  // Delete old tasks and section
  await db.delete(tasks).where(eq(tasks.sectionId, sectionId));
  await db.delete(sections).where(eq(sections.id, sectionId));
  
  return newTask;
}

// Bulk update task status
export async function bulkUpdateTaskStatus(
  taskIds: number[], 
  status: "not_started" | "in_progress" | "completed"
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db.update(tasks)
    .set({ status, updatedAt: new Date() })
    .where(inArray(tasks.id, taskIds));
  
  return result[0].affectedRows;
}

// Bulk update task priority
export async function bulkUpdateTaskPriority(
  taskIds: number[], 
  priority: "low" | "medium" | "high" | "critical"
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db.update(tasks)
    .set({ priority, updatedAt: new Date() })
    .where(inArray(tasks.id, taskIds));
  
  return result[0].affectedRows;
}

// Bulk update task assignee
export async function bulkUpdateTaskAssignee(
  taskIds: number[], 
  assignedTo: number | null
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db.update(tasks)
    .set({ assignedTo, updatedAt: new Date() })
    .where(inArray(tasks.id, taskIds));
  
  return result[0].affectedRows;
}

// Bulk delete tasks
export async function bulkDeleteTasks(taskIds: number[]): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  // First delete all subtasks
  for (const taskId of taskIds) {
    await db.delete(subtasks).where(eq(subtasks.taskId, taskId));
  }
  
  // Then delete tasks
  const result = await db.delete(tasks).where(inArray(tasks.id, taskIds));
  return result[0].affectedRows;
}

// Duplicate a task
export async function duplicateTask(taskId: number): Promise<Task> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) throw new Error("Task not found");
  
  // Get max sort order
  const existingTasks = await db.select().from(tasks).where(eq(tasks.sectionId, task.sectionId));
  const maxSortOrder = Math.max(...existingTasks.map(t => t.sortOrder || 0), 0);
  
  // Create duplicate
  const result = await db.insert(tasks).values({
    sectionId: task.sectionId,
    title: `${task.title} (копия)`,
    description: task.description,
    status: "not_started",
    notes: task.notes,
    sortOrder: maxSortOrder + 1,
  });
  
  const [newTask] = await db.select().from(tasks).where(eq(tasks.id, result[0].insertId));
  
  // Duplicate subtasks
  const taskSubtasks = await db.select().from(subtasks).where(eq(subtasks.taskId, taskId));
  for (const subtask of taskSubtasks) {
    await db.insert(subtasks).values({
      taskId: newTask.id,
      title: subtask.title,
      status: "not_started",
      sortOrder: subtask.sortOrder,
    });
  }
  
  return newTask;
}


// ============ OVERDUE TASKS ============

export async function getOverdueTasks(userId: number): Promise<Array<{
  id: number;
  title: string;
  projectId: number;
  projectName: string;
  deadline: Date;
  daysOverdue: number;
  priority: string | null;
}>> {
  const db = await getDb();
  if (!db) return [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get all projects for user with their tasks
  const userProjects = await db.select()
    .from(projects)
    .where(eq(projects.userId, userId));

  const overdueTasks: Array<{
    id: number;
    title: string;
    projectId: number;
    projectName: string;
    deadline: Date;
    daysOverdue: number;
    priority: string | null;
  }> = [];

  for (const project of userProjects) {
    // Get all tasks for this project that are overdue
    const projectBlocks = await db.select()
      .from(blocks)
      .where(eq(blocks.projectId, project.id));

    for (const block of projectBlocks) {
      const blockSections = await db.select()
        .from(sections)
        .where(eq(sections.blockId, block.id));

      for (const section of blockSections) {
        const sectionTasks = await db.select()
          .from(tasks)
          .where(and(
            eq(tasks.sectionId, section.id),
            lt(tasks.deadline, today),
            not(eq(tasks.status, 'completed'))
          ));

        for (const task of sectionTasks) {
          if (task.deadline) {
            const deadlineDate = new Date(task.deadline);
            deadlineDate.setHours(0, 0, 0, 0);
            const daysOverdue = Math.ceil((today.getTime() - deadlineDate.getTime()) / (1000 * 60 * 60 * 24));
            
            overdueTasks.push({
              id: task.id,
              title: task.title,
              projectId: project.id,
              projectName: project.name,
              deadline: task.deadline,
              daysOverdue,
              priority: task.priority,
            });
          }
        }
      }
    }
  }

  // Sort by days overdue (most overdue first)
  return overdueTasks.sort((a, b) => b.daysOverdue - a.daysOverdue);
}

// ============ DRAG & DROP REORDER FUNCTIONS ============

export async function reorderTasks(sectionId: number, taskIds: number[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Update sortOrder for each task based on position in array
  for (let i = 0; i < taskIds.length; i++) {
    await db
      .update(tasks)
      .set({ sortOrder: i, updatedAt: new Date() })
      .where(and(eq(tasks.id, taskIds[i]), eq(tasks.sectionId, sectionId)));
  }
}

export async function reorderSections(blockId: number, sectionIds: number[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Update sortOrder for each section based on position in array
  for (let i = 0; i < sectionIds.length; i++) {
    await db
      .update(sections)
      .set({ sortOrder: i, updatedAt: new Date() })
      .where(and(eq(sections.id, sectionIds[i]), eq(sections.blockId, blockId)));
  }
}


// ============ PROJECT MEMBERS QUERIES ============

export async function getProjectMembers(projectId: number): Promise<(ProjectMember & { user: { id: number; name: string | null; email: string | null; avatar: string | null } | null })[]> {
  const db = await getDb();
  if (!db) return [];
  
  const members = await db.select().from(projectMembers)
    .where(and(
      eq(projectMembers.projectId, projectId),
      eq(projectMembers.status, 'active')
    ))
    .orderBy(asc(projectMembers.createdAt));
  
  // Join with users table to get user info
  const membersWithUsers = await Promise.all(members.map(async (member) => {
    const [user] = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatar: users.avatar
    }).from(users).where(eq(users.id, member.userId));
    return { ...member, user: user || null };
  }));
  
  return membersWithUsers;
}

export async function addProjectMember(data: InsertProjectMember): Promise<ProjectMember | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Check if member already exists
  const [existing] = await db.select().from(projectMembers)
    .where(and(
      eq(projectMembers.projectId, data.projectId),
      eq(projectMembers.userId, data.userId)
    ));
  
  if (existing) {
    // Reactivate if removed
    if (existing.status === 'removed') {
      await db.update(projectMembers)
        .set({ status: 'active', role: data.role, updatedAt: new Date() })
        .where(eq(projectMembers.id, existing.id));
      return { ...existing, status: 'active', role: data.role || 'viewer' };
    }
    return existing;
  }
  
  const [result] = await db.insert(projectMembers).values(data);
  return { ...data, id: result.insertId } as ProjectMember;
}

export async function updateProjectMemberRole(id: number, role: 'owner' | 'admin' | 'editor' | 'viewer'): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const [result] = await db.update(projectMembers)
    .set({ role, updatedAt: new Date() })
    .where(eq(projectMembers.id, id));
  
  return result.affectedRows > 0;
}

export async function removeProjectMember(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const [result] = await db.update(projectMembers)
    .set({ status: 'removed', updatedAt: new Date() })
    .where(eq(projectMembers.id, id));
  
  return result.affectedRows > 0;
}

export async function getProjectMemberByUserId(projectId: number, userId: number): Promise<ProjectMember | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [member] = await db.select().from(projectMembers)
    .where(and(
      eq(projectMembers.projectId, projectId),
      eq(projectMembers.userId, userId),
      eq(projectMembers.status, 'active')
    ));
  
  return member || null;
}

export async function isProjectMember(projectId: number, userId: number): Promise<boolean> {
  const member = await getProjectMemberByUserId(projectId, userId);
  return member !== null;
}

export async function hasProjectPermission(projectId: number, userId: number, requiredRoles: ('owner' | 'admin' | 'editor' | 'viewer')[]): Promise<boolean> {
  const member = await getProjectMemberByUserId(projectId, userId);
  if (!member) return false;
  return requiredRoles.includes(member.role);
}

// ============ PROJECT INVITATIONS QUERIES ============

export async function createProjectInvitation(data: InsertProjectInvitation): Promise<ProjectInvitation | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [result] = await db.insert(projectInvitations).values(data);
  return { ...data, id: result.insertId } as ProjectInvitation;
}

export async function getProjectInvitationByCode(inviteCode: string): Promise<ProjectInvitation | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [invitation] = await db.select().from(projectInvitations)
    .where(eq(projectInvitations.inviteCode, inviteCode));
  
  return invitation || null;
}

export async function getPendingInvitations(projectId: number): Promise<ProjectInvitation[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(projectInvitations)
    .where(and(
      eq(projectInvitations.projectId, projectId),
      not(isNotNull(projectInvitations.usedAt))
    ))
    .orderBy(desc(projectInvitations.createdAt));
}

export async function useInvitation(inviteCode: string, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const [result] = await db.update(projectInvitations)
    .set({ usedAt: new Date(), usedBy: userId })
    .where(and(
      eq(projectInvitations.inviteCode, inviteCode),
      not(isNotNull(projectInvitations.usedAt))
    ));
  
  return result.affectedRows > 0;
}

export async function deleteInvitation(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const [result] = await db.delete(projectInvitations)
    .where(eq(projectInvitations.id, id));
  
  return result.affectedRows > 0;
}

// ============ ACTIVITY LOG QUERIES ============

export async function logActivity(data: InsertActivityLog): Promise<ActivityLog | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [result] = await db.insert(activityLog).values(data);
  return { ...data, id: result.insertId } as ActivityLog;
}

export async function getProjectActivity(
  projectId: number, 
  options?: { 
    limit?: number; 
    offset?: number; 
    actions?: string[];
    entityTypes?: string[];
  }
): Promise<(ActivityLog & { user: { id: number; name: string | null; avatar: string | null } | null })[]> {
  const db = await getDb();
  if (!db) return [];
  
  const { limit = 50, offset = 0 } = options || {};
  
  let query = db.select().from(activityLog)
    .where(eq(activityLog.projectId, projectId))
    .orderBy(desc(activityLog.createdAt))
    .limit(limit)
    .offset(offset);
  
  const activities = await query;
  
  // Join with users table to get user info
  const activitiesWithUsers = await Promise.all(activities.map(async (activity) => {
    const [user] = await db.select({
      id: users.id,
      name: users.name,
      avatar: users.avatar
    }).from(users).where(eq(users.id, activity.userId));
    return { ...activity, user: user || null };
  }));
  
  return activitiesWithUsers;
}

export async function getUserActivity(
  userId: number, 
  options?: { limit?: number; offset?: number }
): Promise<ActivityLog[]> {
  const db = await getDb();
  if (!db) return [];
  
  const { limit = 50, offset = 0 } = options || {};
  
  return db.select().from(activityLog)
    .where(eq(activityLog.userId, userId))
    .orderBy(desc(activityLog.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getDashboardActivity(
  userId: number,
  options?: { limit?: number }
): Promise<(ActivityLog & { user: { id: number; name: string | null; avatar: string | null } | null; project: { id: number; name: string } | null })[]> {
  const db = await getDb();
  if (!db) return [];
  
  const { limit = 20 } = options || {};
  
  // Get all projects user is member of
  const memberProjects = await db.select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(and(
      eq(projectMembers.userId, userId),
      eq(projectMembers.status, 'active')
    ));
  
  // Also include projects user owns
  const ownedProjects = await db.select({ id: projects.id })
    .from(projects)
    .where(eq(projects.userId, userId));
  
  const projectIds = Array.from(new Set([
    ...memberProjects.map(p => p.projectId),
    ...ownedProjects.map(p => p.id)
  ]));
  
  if (projectIds.length === 0) return [];
  
  const activities = await db.select().from(activityLog)
    .where(inArray(activityLog.projectId, projectIds))
    .orderBy(desc(activityLog.createdAt))
    .limit(limit);
  
  // Join with users and projects
  const activitiesWithDetails = await Promise.all(activities.map(async (activity) => {
    const [user] = await db.select({
      id: users.id,
      name: users.name,
      avatar: users.avatar
    }).from(users).where(eq(users.id, activity.userId));
    
    const [project] = activity.projectId 
      ? await db.select({
          id: projects.id,
          name: projects.name
        }).from(projects).where(eq(projects.id, activity.projectId))
      : [null];
    
    return { ...activity, user: user || null, project: project || null };
  }));
  
  return activitiesWithDetails;
}

// ============ TASK ASSIGNMENT QUERIES ============

export async function assignTask(taskId: number, userId: number | null): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const [result] = await db.update(tasks)
    .set({ assignedTo: userId, updatedAt: new Date() })
    .where(eq(tasks.id, taskId));
  
  return result.affectedRows > 0;
}

export async function getTasksAssignedToUser(userId: number, projectId?: number): Promise<Task[]> {
  const db = await getDb();
  if (!db) return [];
  
  if (projectId) {
    // Get all sections in project
    const projectBlocks = await db.select({ id: blocks.id }).from(blocks)
      .where(eq(blocks.projectId, projectId));
    
    if (projectBlocks.length === 0) return [];
    
    const blockIds = projectBlocks.map(b => b.id);
    const projectSections = await db.select({ id: sections.id }).from(sections)
      .where(inArray(sections.blockId, blockIds));
    
    if (projectSections.length === 0) return [];
    
    const sectionIds = projectSections.map(s => s.id);
    
    return db.select().from(tasks)
      .where(and(
        eq(tasks.assignedTo, userId),
        inArray(tasks.sectionId, sectionIds)
      ))
      .orderBy(desc(tasks.createdAt));
  }
  
  return db.select().from(tasks)
    .where(eq(tasks.assignedTo, userId))
    .orderBy(desc(tasks.createdAt));
}

export async function getAssignedUserForTask(taskId: number): Promise<{ id: number; name: string | null; avatar: string | null } | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [task] = await db.select({ assignedTo: tasks.assignedTo }).from(tasks)
    .where(eq(tasks.id, taskId));
  
  if (!task?.assignedTo) return null;
  
  const [user] = await db.select({
    id: users.id,
    name: users.name,
    avatar: users.avatar
  }).from(users).where(eq(users.id, task.assignedTo));
  
  return user || null;
}

// ============ USER SEARCH FOR ASSIGNMENT ============

export async function searchProjectMembers(projectId: number, query: string): Promise<{ id: number; name: string | null; email: string | null; avatar: string | null }[]> {
  const db = await getDb();
  if (!db) return [];
  
  const members = await getProjectMembers(projectId);
  
  const searchLower = query.toLowerCase();
  return members
    .filter(m => m.user && (
      m.user.name?.toLowerCase().includes(searchLower) ||
      m.user.email?.toLowerCase().includes(searchLower)
    ))
    .map(m => m.user!)
    .filter(Boolean);
}


// ============ TASK DEPENDENCIES (for Gantt Chart) ============

export async function createTaskDependency(data: InsertTaskDependency): Promise<TaskDependency> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [result] = await db.insert(taskDependencies).values(data).$returningId();
  const [dependency] = await db.select().from(taskDependencies).where(eq(taskDependencies.id, result.id));
  return dependency;
}

export async function getTaskDependencies(taskId: number): Promise<TaskDependency[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(taskDependencies).where(eq(taskDependencies.taskId, taskId));
}

export async function getDependentTasks(taskId: number): Promise<TaskDependency[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(taskDependencies).where(eq(taskDependencies.dependsOnTaskId, taskId));
}

export async function deleteTaskDependency(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  await db.delete(taskDependencies).where(eq(taskDependencies.id, id));
  return true;
}

export async function deleteTaskDependenciesByTask(taskId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  await db.delete(taskDependencies).where(eq(taskDependencies.taskId, taskId));
  return true;
}

export async function getProjectDependencies(projectId: number): Promise<TaskDependency[]> {
  const db = await getDb();
  if (!db) return [];
  
  // Get all task IDs for the project
  const projectBlocks = await db.select().from(blocks).where(eq(blocks.projectId, projectId));
  const blockIds = projectBlocks.map(b => b.id);
  
  if (blockIds.length === 0) return [];
  
  const projectSections = await db.select().from(sections).where(inArray(sections.blockId, blockIds));
  const sectionIds = projectSections.map(s => s.id);
  
  if (sectionIds.length === 0) return [];
  
  const projectTasks = await db.select().from(tasks).where(inArray(tasks.sectionId, sectionIds));
  const taskIds = projectTasks.map(t => t.id);
  
  if (taskIds.length === 0) return [];
  
  // Get all dependencies for these tasks
  return db.select().from(taskDependencies).where(inArray(taskDependencies.taskId, taskIds));
}

export async function getGanttChartData(projectId: number): Promise<{
  tasks: Array<Task & { blockTitle: string; sectionTitle: string }>;
  dependencies: TaskDependency[];
}> {
  const db = await getDb();
  if (!db) return { tasks: [], dependencies: [] };
  
  // Get all blocks for the project
  const projectBlocks = await db.select().from(blocks).where(eq(blocks.projectId, projectId)).orderBy(asc(blocks.sortOrder));
  
  const allTasks: Array<Task & { blockTitle: string; sectionTitle: string }> = [];
  const taskIds: number[] = [];
  
  for (const block of projectBlocks) {
    const blockSections = await db.select().from(sections).where(eq(sections.blockId, block.id)).orderBy(asc(sections.sortOrder));
    
    for (const section of blockSections) {
      const sectionTasks = await db.select().from(tasks).where(eq(tasks.sectionId, section.id)).orderBy(asc(tasks.sortOrder));
      
      for (const task of sectionTasks) {
        allTasks.push({
          ...task,
          blockTitle: block.titleRu || block.title,
          sectionTitle: section.title
        });
        taskIds.push(task.id);
      }
    }
  }
  
  // Get dependencies
  const dependencies = taskIds.length > 0 
    ? await db.select().from(taskDependencies).where(inArray(taskDependencies.taskId, taskIds))
    : [];
  
  return { tasks: allTasks, dependencies };
}


// ============ CUSTOM FIELDS QUERIES ============

export async function getCustomFieldsByProject(projectId: number): Promise<CustomField[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(customFields)
    .where(eq(customFields.projectId, projectId))
    .orderBy(asc(customFields.sortOrder));
}

export async function getCustomFieldById(id: number): Promise<CustomField | null> {
  const db = await getDb();
  if (!db) return null;
  
  const results = await db.select()
    .from(customFields)
    .where(eq(customFields.id, id))
    .limit(1);
  
  return results[0] || null;
}

export async function createCustomField(field: InsertCustomField): Promise<CustomField> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(customFields).values(field);
  const insertId = result[0].insertId;
  
  const created = await getCustomFieldById(insertId);
  if (!created) throw new Error("Failed to create custom field");
  
  return created;
}

export async function updateCustomField(id: number, updates: Partial<InsertCustomField>): Promise<CustomField | null> {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(customFields)
    .set(updates)
    .where(eq(customFields.id, id));
  
  return await getCustomFieldById(id);
}

export async function deleteCustomField(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  // Delete all values for this field first
  await db.delete(customFieldValues).where(eq(customFieldValues.customFieldId, id));
  
  // Delete the field
  await db.delete(customFields).where(eq(customFields.id, id));
  
  return true;
}

export async function reorderCustomFields(projectId: number, fieldIds: number[]): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  for (let i = 0; i < fieldIds.length; i++) {
    await db.update(customFields)
      .set({ sortOrder: i })
      .where(and(eq(customFields.id, fieldIds[i]), eq(customFields.projectId, projectId)));
  }
}

// ============ CUSTOM FIELD VALUES QUERIES ============

export async function getCustomFieldValuesByTask(taskId: number): Promise<CustomFieldValue[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(customFieldValues)
    .where(eq(customFieldValues.taskId, taskId));
}

export async function getCustomFieldValuesByTasks(taskIds: number[]): Promise<CustomFieldValue[]> {
  const db = await getDb();
  if (!db || taskIds.length === 0) return [];
  
  return await db.select()
    .from(customFieldValues)
    .where(inArray(customFieldValues.taskId, taskIds));
}

export async function getCustomFieldValuesByField(customFieldId: number): Promise<CustomFieldValue[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(customFieldValues)
    .where(eq(customFieldValues.customFieldId, customFieldId));
}

export async function getCustomFieldValue(customFieldId: number, taskId: number): Promise<CustomFieldValue | null> {
  const db = await getDb();
  if (!db) return null;
  
  const results = await db.select()
    .from(customFieldValues)
    .where(and(
      eq(customFieldValues.customFieldId, customFieldId),
      eq(customFieldValues.taskId, taskId)
    ))
    .limit(1);
  
  return results[0] || null;
}

export async function setCustomFieldValue(
  customFieldId: number, 
  taskId: number, 
  value: Partial<InsertCustomFieldValue>
): Promise<CustomFieldValue> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getCustomFieldValue(customFieldId, taskId);
  
  if (existing) {
    await db.update(customFieldValues)
      .set(value)
      .where(eq(customFieldValues.id, existing.id));
    
    const updated = await getCustomFieldValue(customFieldId, taskId);
    return updated!;
  } else {
    const result = await db.insert(customFieldValues).values({
      customFieldId,
      taskId,
      ...value
    });
    
    const insertId = result[0].insertId;
    const results = await db.select()
      .from(customFieldValues)
      .where(eq(customFieldValues.id, insertId))
      .limit(1);
    
    return results[0];
  }
}

export async function deleteCustomFieldValue(customFieldId: number, taskId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  await db.delete(customFieldValues)
    .where(and(
      eq(customFieldValues.customFieldId, customFieldId),
      eq(customFieldValues.taskId, taskId)
    ));
  
  return true;
}

export async function getCustomFieldValuesForProject(projectId: number): Promise<{
  fields: CustomField[];
  values: Record<number, CustomFieldValue[]>;
}> {
  const db = await getDb();
  if (!db) return { fields: [], values: {} };
  
  const fields = await getCustomFieldsByProject(projectId);
  const fieldIds = fields.map(f => f.id);
  
  if (fieldIds.length === 0) {
    return { fields, values: {} };
  }
  
  const allValues = await db.select()
    .from(customFieldValues)
    .where(inArray(customFieldValues.customFieldId, fieldIds));
  
  // Group values by task
  const values: Record<number, CustomFieldValue[]> = {};
  for (const v of allValues) {
    if (!values[v.taskId]) values[v.taskId] = [];
    values[v.taskId].push(v);
  }
  
  return { fields, values };
}


// ============ SAVED VIEWS ============

export async function getSavedViewsByProject(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select()
    .from(savedViews)
    .where(and(eq(savedViews.projectId, projectId), eq(savedViews.userId, userId)))
    .orderBy(asc(savedViews.sortOrder));
}

export async function getSavedViewById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select()
    .from(savedViews)
    .where(eq(savedViews.id, id));
  return results[0] || null;
}

export async function createSavedView(view: InsertSavedView) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db.insert(savedViews).values(view);
  return { id: result[0].insertId, ...view };
}

export async function updateSavedView(id: number, updates: Partial<InsertSavedView>) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(savedViews)
    .set(updates)
    .where(eq(savedViews.id, id));
  return getSavedViewById(id);
}

export async function deleteSavedView(id: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.delete(savedViews).where(eq(savedViews.id, id));
  return { deleted: true };
}

export async function setDefaultSavedView(id: number, projectId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  // Clear existing defaults for this project/user
  await db.update(savedViews)
    .set({ isDefault: false })
    .where(and(eq(savedViews.projectId, projectId), eq(savedViews.userId, userId)));
  // Set the new default
  if (id > 0) {
    await db.update(savedViews)
      .set({ isDefault: true })
      .where(eq(savedViews.id, id));
  }
  return { success: true };
}

import { eq, and, desc, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users,
  projects, InsertProject, Project,
  blocks, InsertBlock, Block,
  sections, InsertSection, Section,
  tasks, InsertTask, Task,
  subtasks, InsertSubtask, Subtask,
  aiSettings, InsertAiSetting, AiSetting,
  chatMessages, InsertChatMessage, ChatMessage,
  projectTemplates, InsertProjectTemplate, ProjectTemplate
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

// ============ PROJECT TEMPLATES ============

export async function getPublicTemplates(): Promise<ProjectTemplate[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(projectTemplates)
    .where(eq(projectTemplates.isPublic, true))
    .orderBy(desc(projectTemplates.createdAt));
}

export async function createProjectTemplate(data: InsertProjectTemplate): Promise<ProjectTemplate> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(projectTemplates).values(data);
  const [template] = await db.select().from(projectTemplates).where(eq(projectTemplates.id, result[0].insertId));
  return template;
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

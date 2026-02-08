/**
 * Import Parser for Roadmap Files
 * Supports Markdown and JSON formats
 */

// Import limits to prevent DoS attacks
export const IMPORT_LIMITS = {
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024, // 5MB
  MAX_BLOCKS: 50,
  MAX_SECTIONS_PER_BLOCK: 30,
  MAX_TASKS_PER_SECTION: 100,
  MAX_SUBTASKS_PER_TASK: 50,
  MAX_TOTAL_SECTIONS: 500,
  MAX_TOTAL_TASKS: 2000,
  MAX_TOTAL_SUBTASKS: 5000,
  MAX_TITLE_LENGTH: 500,
  MAX_DESCRIPTION_LENGTH: 10000,
};

export class ImportLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportLimitError';
  }
}

/**
 * Validate imported project against limits
 */
export function validateImportLimits(project: ImportedProject): void {
  // Check blocks count
  if (project.blocks.length > IMPORT_LIMITS.MAX_BLOCKS) {
    throw new ImportLimitError(
      `Слишком много блоков: ${project.blocks.length}. Максимум: ${IMPORT_LIMITS.MAX_BLOCKS}`
    );
  }

  let totalSections = 0;
  let totalTasks = 0;
  let totalSubtasks = 0;

  for (const block of project.blocks) {
    // Validate block title length
    if (block.title.length > IMPORT_LIMITS.MAX_TITLE_LENGTH) {
      throw new ImportLimitError(
        `Название блока слишком длинное: "${block.title.substring(0, 50)}...". Максимум: ${IMPORT_LIMITS.MAX_TITLE_LENGTH} символов`
      );
    }

    const sections = block.sections || [];
    if (sections.length > IMPORT_LIMITS.MAX_SECTIONS_PER_BLOCK) {
      throw new ImportLimitError(
        `Блок "${block.title}" содержит слишком много разделов: ${sections.length}. Максимум: ${IMPORT_LIMITS.MAX_SECTIONS_PER_BLOCK}`
      );
    }

    totalSections += sections.length;

    for (const section of sections) {
      // Validate section title length
      if (section.title.length > IMPORT_LIMITS.MAX_TITLE_LENGTH) {
        throw new ImportLimitError(
          `Название раздела слишком длинное: "${section.title.substring(0, 50)}...". Максимум: ${IMPORT_LIMITS.MAX_TITLE_LENGTH} символов`
        );
      }

      const tasks = section.tasks || [];
      if (tasks.length > IMPORT_LIMITS.MAX_TASKS_PER_SECTION) {
        throw new ImportLimitError(
          `Раздел "${section.title}" содержит слишком много задач: ${tasks.length}. Максимум: ${IMPORT_LIMITS.MAX_TASKS_PER_SECTION}`
        );
      }

      totalTasks += tasks.length;

      for (const task of tasks) {
        // Validate task title and description length
        if (task.title.length > IMPORT_LIMITS.MAX_TITLE_LENGTH) {
          throw new ImportLimitError(
            `Название задачи слишком длинное: "${task.title.substring(0, 50)}...". Максимум: ${IMPORT_LIMITS.MAX_TITLE_LENGTH} символов`
          );
        }
        if (task.description && task.description.length > IMPORT_LIMITS.MAX_DESCRIPTION_LENGTH) {
          throw new ImportLimitError(
            `Описание задачи "${task.title}" слишком длинное. Максимум: ${IMPORT_LIMITS.MAX_DESCRIPTION_LENGTH} символов`
          );
        }

        const subtasks = task.subtasks || [];
        if (subtasks.length > IMPORT_LIMITS.MAX_SUBTASKS_PER_TASK) {
          throw new ImportLimitError(
            `Задача "${task.title}" содержит слишком много подзадач: ${subtasks.length}. Максимум: ${IMPORT_LIMITS.MAX_SUBTASKS_PER_TASK}`
          );
        }

        totalSubtasks += subtasks.length;

        for (const subtask of subtasks) {
          if (subtask.title.length > IMPORT_LIMITS.MAX_TITLE_LENGTH) {
            throw new ImportLimitError(
              `Название подзадачи слишком длинное: "${subtask.title.substring(0, 50)}...". Максимум: ${IMPORT_LIMITS.MAX_TITLE_LENGTH} символов`
            );
          }
        }
      }
    }
  }

  // Check total counts
  if (totalSections > IMPORT_LIMITS.MAX_TOTAL_SECTIONS) {
    throw new ImportLimitError(
      `Слишком много разделов в проекте: ${totalSections}. Максимум: ${IMPORT_LIMITS.MAX_TOTAL_SECTIONS}`
    );
  }

  if (totalTasks > IMPORT_LIMITS.MAX_TOTAL_TASKS) {
    throw new ImportLimitError(
      `Слишком много задач в проекте: ${totalTasks}. Максимум: ${IMPORT_LIMITS.MAX_TOTAL_TASKS}`
    );
  }

  if (totalSubtasks > IMPORT_LIMITS.MAX_TOTAL_SUBTASKS) {
    throw new ImportLimitError(
      `Слишком много подзадач в проекте: ${totalSubtasks}. Максимум: ${IMPORT_LIMITS.MAX_TOTAL_SUBTASKS}`
    );
  }
}

/**
 * Validate file size before parsing
 */
export function validateFileSize(content: string): void {
  const sizeInBytes = new TextEncoder().encode(content).length;
  if (sizeInBytes > IMPORT_LIMITS.MAX_FILE_SIZE_BYTES) {
    const sizeMB = (sizeInBytes / (1024 * 1024)).toFixed(2);
    const maxMB = (IMPORT_LIMITS.MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0);
    throw new ImportLimitError(
      `Файл слишком большой: ${sizeMB}MB. Максимум: ${maxMB}MB`
    );
  }
}

export interface ImportedSubtask {
  title: string;
  completed?: boolean;
}

export interface ImportedTask {
  title: string;
  description?: string;
  status?: 'not_started' | 'in_progress' | 'completed';
  notes?: string;
  finalDocument?: string;
  subtasks?: ImportedSubtask[];
}

export interface ImportedSection {
  title: string;
  tasks?: ImportedTask[];
}

export interface ImportedBlock {
  number: string;
  title: string;
  titleRu?: string;
  icon?: string;
  sections?: ImportedSection[];
}

export interface ImportedProject {
  name: string;
  description?: string;
  blocks: ImportedBlock[];
}

/**
 * Parse Markdown roadmap file
 * Expected format:
 * # Project Name
 * Description text
 * 
 * ## 01. Block Title / Название блока
 * 
 * ### Section Title
 * - [ ] Task 1
 * - [x] Task 2 (completed)
 *   - [ ] Subtask 1
 *   - [x] Subtask 2
 */
export function parseMarkdownRoadmap(content: string): ImportedProject {
  const lines = content.split('\n');
  const project: ImportedProject = {
    name: '',
    description: '',
    blocks: []
  };

  let currentBlock: ImportedBlock | null = null;
  let currentSection: ImportedSection | null = null;
  let currentTask: ImportedTask | null = null;
  let descriptionLines: string[] = [];
  let inDescription = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Project title (# Title)
    if (trimmedLine.startsWith('# ') && !project.name) {
      project.name = trimmedLine.slice(2).trim();
      inDescription = true;
      continue;
    }

    // Block (## 01. Title / TitleRu)
    const blockMatch = trimmedLine.match(/^##\s+(\d+)[\.\)]\s*(.+?)(?:\s*[\/|]\s*(.+))?$/);
    if (blockMatch) {
      // Save previous block
      if (currentTask && currentSection) {
        currentSection.tasks = currentSection.tasks || [];
        currentSection.tasks.push(currentTask);
        currentTask = null;
      }
      if (currentSection && currentBlock) {
        currentBlock.sections = currentBlock.sections || [];
        currentBlock.sections.push(currentSection);
        currentSection = null;
      }
      if (currentBlock) {
        project.blocks.push(currentBlock);
      }

      // Set description from collected lines
      if (inDescription && descriptionLines.length > 0) {
        project.description = descriptionLines.join('\n').trim();
        inDescription = false;
      }

      currentBlock = {
        number: blockMatch[1].padStart(2, '0'),
        title: blockMatch[2].trim(),
        titleRu: blockMatch[3]?.trim(),
        sections: []
      };
      continue;
    }

    // Section (### Title)
    if (trimmedLine.startsWith('### ')) {
      // Save previous task and section
      if (currentTask && currentSection) {
        currentSection.tasks = currentSection.tasks || [];
        currentSection.tasks.push(currentTask);
        currentTask = null;
      }
      if (currentSection && currentBlock) {
        currentBlock.sections = currentBlock.sections || [];
        currentBlock.sections.push(currentSection);
      }

      currentSection = {
        title: trimmedLine.slice(4).trim(),
        tasks: []
      };
      continue;
    }

    // Task (- [ ] or - [x] or just - )
    const taskMatch = trimmedLine.match(/^[-*]\s*(?:\[([ xX])\])?\s*(.+)$/);
    if (taskMatch && !line.startsWith('    ') && !line.startsWith('\t\t')) {
      // Check if this is a subtask (indented with 2+ spaces or tab)
      const isSubtask = line.match(/^(\s{2,}|\t)[-*]/);
      
      if (isSubtask && currentTask) {
        // This is a subtask
        currentTask.subtasks = currentTask.subtasks || [];
        currentTask.subtasks.push({
          title: taskMatch[2].trim(),
          completed: taskMatch[1]?.toLowerCase() === 'x'
        });
      } else {
        // Save previous task
        if (currentTask && currentSection) {
          currentSection.tasks = currentSection.tasks || [];
          currentSection.tasks.push(currentTask);
        }

        // Create new task
        const isCompleted = taskMatch[1]?.toLowerCase() === 'x';
        currentTask = {
          title: taskMatch[2].trim(),
          status: isCompleted ? 'completed' : 'not_started',
          subtasks: []
        };

        // If no section exists, create a default one
        if (!currentSection && currentBlock) {
          currentSection = {
            title: 'Задачи',
            tasks: []
          };
        }
      }
      continue;
    }

    // Subtask (indented - [ ] or - [x])
    const subtaskMatch = line.match(/^(\s{2,}|\t)[-*]\s*(?:\[([ xX])\])?\s*(.+)$/);
    if (subtaskMatch && currentTask) {
      currentTask.subtasks = currentTask.subtasks || [];
      currentTask.subtasks.push({
        title: subtaskMatch[3].trim(),
        completed: subtaskMatch[2]?.toLowerCase() === 'x'
      });
      continue;
    }

    // Description lines (between title and first block)
    if (inDescription && trimmedLine && !trimmedLine.startsWith('#')) {
      descriptionLines.push(trimmedLine);
    }
  }

  // Save remaining items
  if (currentTask && currentSection) {
    currentSection.tasks = currentSection.tasks || [];
    currentSection.tasks.push(currentTask);
  }
  if (currentSection && currentBlock) {
    currentBlock.sections = currentBlock.sections || [];
    currentBlock.sections.push(currentSection);
  }
  if (currentBlock) {
    project.blocks.push(currentBlock);
  }

  // Set description if still collecting
  if (inDescription && descriptionLines.length > 0) {
    project.description = descriptionLines.join('\n').trim();
  }

  return project;
}

/**
 * Parse JSON roadmap file
 * Expected format:
 * {
 *   "name": "Project Name",
 *   "description": "Description",
 *   "blocks": [
 *     {
 *       "number": "01",
 *       "title": "Block Title",
 *       "titleRu": "Название блока",
 *       "sections": [
 *         {
 *           "title": "Section",
 *           "tasks": [
 *             {
 *               "title": "Task",
 *               "description": "Description",
 *               "status": "not_started",
 *               "subtasks": [
 *                 { "title": "Subtask", "completed": false }
 *               ]
 *             }
 *           ]
 *         }
 *       ]
 *     }
 *   ]
 * }
 */
export function parseJsonRoadmap(content: string): ImportedProject {
  const data = JSON.parse(content);
  
  // Validate required fields
  if (!data.name || typeof data.name !== 'string') {
    throw new Error('Invalid JSON: missing or invalid "name" field');
  }
  
  if (!Array.isArray(data.blocks)) {
    throw new Error('Invalid JSON: missing or invalid "blocks" array');
  }

  const project: ImportedProject = {
    name: data.name,
    description: data.description || '',
    blocks: []
  };

  for (let i = 0; i < data.blocks.length; i++) {
    const blockData = data.blocks[i];
    
    if (!blockData.title) {
      throw new Error(`Invalid JSON: block at index ${i} missing "title"`);
    }

    const block: ImportedBlock = {
      number: blockData.number || String(i + 1).padStart(2, '0'),
      title: blockData.title,
      titleRu: blockData.titleRu,
      icon: blockData.icon,
      sections: []
    };

    if (Array.isArray(blockData.sections)) {
      for (const sectionData of blockData.sections) {
        const section: ImportedSection = {
          title: sectionData.title || 'Раздел',
          tasks: []
        };

        if (Array.isArray(sectionData.tasks)) {
          for (const taskData of sectionData.tasks) {
            const task: ImportedTask = {
              title: taskData.title || 'Задача',
              description: taskData.description,
              status: taskData.status || 'not_started',
              notes: taskData.notes,
              finalDocument: taskData.finalDocument,
              subtasks: []
            };

            if (Array.isArray(taskData.subtasks)) {
              for (const subtaskData of taskData.subtasks) {
                task.subtasks!.push({
                  title: subtaskData.title || 'Подзадача',
                  completed: subtaskData.completed || false
                });
              }
            }

            section.tasks!.push(task);
          }
        }

        block.sections!.push(section);
      }
    }

    project.blocks.push(block);
  }

  return project;
}

/**
 * Auto-detect format and parse roadmap
 * Validates file size and import limits
 */
export function parseRoadmap(content: string, filename?: string): ImportedProject {
  // Validate file size first
  validateFileSize(content);

  let project: ImportedProject;

  // Try to detect format from filename
  if (filename) {
    if (filename.endsWith('.json')) {
      project = parseJsonRoadmap(content);
    } else if (filename.endsWith('.md') || filename.endsWith('.markdown')) {
      project = parseMarkdownRoadmap(content);
    } else {
      // Try content-based detection
      project = parseByContent(content);
    }
  } else {
    // Try content-based detection
    project = parseByContent(content);
  }

  // Validate import limits
  validateImportLimits(project);

  return project;
}

/**
 * Parse content by detecting format from content
 */
function parseByContent(content: string): ImportedProject {
  const trimmedContent = content.trim();
  if (trimmedContent.startsWith('{')) {
    try {
      return parseJsonRoadmap(content);
    } catch {
      // Fall through to Markdown
    }
  }
  return parseMarkdownRoadmap(content);
}

/**
 * Generate sample Markdown template
 */
export function generateMarkdownTemplate(): string {
  return `# Название проекта

Описание проекта - краткое описание целей и задач.

## 01. Исследование / Research

### Анализ рынка
- [ ] Изучить конкурентов
- [ ] Определить целевую аудиторию
  - [ ] Провести опросы
  - [ ] Анализ демографии

### Техническое исследование
- [ ] Выбор технологий
- [ ] Архитектура системы

## 02. Разработка / Development

### MVP
- [ ] Базовый функционал
- [ ] Тестирование
  - [ ] Unit тесты
  - [ ] Интеграционные тесты

### Запуск
- [ ] Деплой
- [ ] Мониторинг
`;
}

/**
 * Generate sample JSON template
 */
export function generateJsonTemplate(): string {
  return JSON.stringify({
    name: "Название проекта",
    description: "Описание проекта",
    blocks: [
      {
        number: "01",
        title: "Research",
        titleRu: "Исследование",
        sections: [
          {
            title: "Анализ рынка",
            tasks: [
              {
                title: "Изучить конкурентов",
                description: "Детальный анализ конкурентов",
                status: "not_started",
                subtasks: [
                  { title: "Составить список", completed: false },
                  { title: "SWOT анализ", completed: false }
                ]
              }
            ]
          }
        ]
      }
    ]
  }, null, 2);
}

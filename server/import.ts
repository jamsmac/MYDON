/**
 * Import Parser for Roadmap Files
 * Supports Markdown and JSON formats
 */

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
 */
export function parseRoadmap(content: string, filename?: string): ImportedProject {
  // Try to detect format from filename
  if (filename) {
    if (filename.endsWith('.json')) {
      return parseJsonRoadmap(content);
    }
    if (filename.endsWith('.md') || filename.endsWith('.markdown')) {
      return parseMarkdownRoadmap(content);
    }
  }

  // Try to detect format from content
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

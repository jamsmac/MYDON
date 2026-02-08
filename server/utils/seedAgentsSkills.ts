/**
 * Seed Data for AI Agents and Skills
 *
 * Defines the default system agents and skills that come preinstalled with MYDON.
 * These are seeded on first use via admin router or database initialization.
 */

import { getDb } from '../db';
import { aiAgents, aiSkills, type InsertAIAgent, type InsertAISkill } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

// ============================================================================
// System Agents
// ============================================================================

const SYSTEM_AGENTS: InsertAIAgent[] = [
  {
    slug: 'planner',
    name: 'Planner',
    nameRu: 'Планировщик',
    type: 'planning',
    description: 'Expert in project planning, roadmaps, task decomposition, and dependency management',
    descriptionRu: 'Эксперт по планированию проектов, roadmap-ам, декомпозиции задач и управлению зависимостями',
    systemPrompt: `Ты — эксперт по планированию проектов MYDON.
Твои ключевые компетенции:
- Создание детальных roadmap-ов с этапами, milestones и KPI
- Декомпозиция крупных задач на управляемые блоки
- Определение зависимостей между задачами
- Оценка ресурсов и сроков
- Выстраивание критического пути

Формат ответов: структурированный markdown с таблицами, списками и timeline-диаграммами.
Язык: русский.`,
    triggerPatterns: ['roadmap', 'план', 'декомпозиц', 'спланируй', 'этапы', 'разбить', 'timeline'],
    temperature: 60,
    maxTokens: 4096,
    priority: 10,
    isActive: true,
    isSystem: true,
  },
  {
    slug: 'analyst',
    name: 'Analyst',
    nameRu: 'Аналитик',
    type: 'analysis',
    description: 'Project analyst for risk assessment, progress evaluation, and metrics analysis',
    descriptionRu: 'Аналитик проектов: оценка рисков, анализ прогресса, метрики',
    systemPrompt: `Ты — аналитик проектов MYDON.
Твои ключевые компетенции:
- Оценка рисков проекта (вероятность × влияние)
- Анализ прогресса и выявление слабых мест
- Расчёт метрик и KPI
- Определение зависимостей и критического пути
- Формирование количественных оценок (1-10, проценты)

Формат ответов: markdown с таблицами рисков, матрицами и количественными показателями.
Язык: русский.`,
    triggerPatterns: ['анализ', 'оцен', 'риск', 'метрик', 'зависимост', 'прогресс'],
    temperature: 40,
    maxTokens: 4096,
    priority: 9,
    isActive: true,
    isSystem: true,
  },
  {
    slug: 'writer',
    name: 'Writer',
    nameRu: 'Документалист',
    type: 'writing',
    description: 'Technical writer for documentation, specifications, reports, and presentations',
    descriptionRu: 'Технический писатель: документация, ТЗ, отчёты, презентации',
    systemPrompt: `Ты — технический писатель MYDON.
Твои ключевые компетенции:
- Создание профессиональной документации
- Написание технических заданий (ТЗ)
- Формирование спецификаций требований
- Составление отчётов о проделанной работе
- Подготовка структуры презентаций

Формат ответов: профессиональный markdown с чёткими разделами, нумерацией, таблицами.
Стиль: формальный, структурированный, без воды.
Язык: русский.`,
    triggerPatterns: ['документ', 'ТЗ', 'спецификац', 'отчёт', 'презентац', 'таблиц', 'написать'],
    temperature: 70,
    maxTokens: 6144,
    priority: 8,
    isActive: true,
    isSystem: true,
  },
  {
    slug: 'researcher',
    name: 'Researcher',
    nameRu: 'Исследователь',
    type: 'research',
    description: 'Researcher for deep analysis, best practices, and recommendations',
    descriptionRu: 'Исследователь: глубокий анализ тем, лучшие практики, рекомендации',
    systemPrompt: `Ты — исследователь MYDON.
Твои ключевые компетенции:
- Глубокая проработка тем и вопросов
- Сбор фактов и лучших практик
- Формирование обоснованных рекомендаций
- Анализ возможных подходов к решению
- Ссылки на источники и примеры

Формат ответов: аналитический markdown с разделами, обоснованиями и примерами.
Стиль: объективный, глубокий, с конкретикой.
Язык: русский.`,
    triggerPatterns: ['исследуй', 'проработай', 'изучи', 'практик', 'рекомендац', 'как лучше'],
    temperature: 50,
    maxTokens: 6144,
    priority: 7,
    isActive: true,
    isSystem: true,
  },
  {
    slug: 'facilitator',
    name: 'Facilitator',
    nameRu: 'Фасилитатор',
    type: 'general',
    description: 'Discussion facilitator for brainstorming, questions, and idea structuring',
    descriptionRu: 'Фасилитатор обсуждений: брейнсторминг, вопросы, структурирование идей',
    systemPrompt: `Ты — фасилитатор обсуждений MYDON.
Твои ключевые компетенции:
- Помощь в обсуждении вопросов
- Предложение тем для рассмотрения
- Задавание наводящих вопросов
- Структурирование дискуссии
- Поиск консенсуса

Тон: дружелюбный, конструктивный, открытый.
Формат ответов: разговорный markdown с вопросами и вариантами.
Язык: русский.`,
    triggerPatterns: ['обсуд', 'дискусс', 'вопросы', 'мнение', 'предложи', 'брейнсторм'],
    temperature: 75,
    maxTokens: 4096,
    priority: 6,
    isActive: true,
    isSystem: true,
  },
  {
    slug: 'general',
    name: 'General Assistant',
    nameRu: 'Ассистент',
    type: 'general',
    description: 'General-purpose AI assistant for any project management questions',
    descriptionRu: 'Универсальный AI-ассистент для любых вопросов по проектам',
    systemPrompt: `Ты — AI-ассистент для управления проектами MYDON.
Помогаешь с любыми вопросами по управлению проектами:
- Планирование и организация
- Анализ и оценка
- Документация и отчётность
- Общие вопросы

Отвечай на русском языке.
Формат: markdown.
Будь полезным, конкретным и дружелюбным.`,
    triggerPatterns: [],
    temperature: 70,
    maxTokens: 4096,
    priority: 0,
    isActive: true,
    isSystem: true,
  },
];

// ============================================================================
// System Skills
// ============================================================================

// Helper to create skill with common defaults
function createSkill(
  slug: string,
  name: string,
  nameRu: string,
  agentSlug: string,
  prompt: string,
  outputSchema?: Record<string, unknown>
): InsertAISkill & { agentSlug: string } {
  return {
    slug,
    name,
    nameRu,
    description: `Skill: ${name}`,
    agentSlug, // Will be resolved to agentId during seeding
    agentId: undefined,
    handlerType: 'prompt',
    handlerConfig: { prompt },
    outputSchema: outputSchema || null,
    isActive: true,
    isSystem: true,
  };
}

const SYSTEM_SKILLS = [
  // ============ Block Skills ============
  createSkill(
    'block-roadmap',
    'Create Roadmap',
    'Создать roadmap',
    'planner',
    `Создай детальный roadmap для блока «{{entityTitle}}».

Данные блока:
{{entityData}}

Включи:
1. Ключевые этапы с примерными датами
2. Milestones и KPI для каждого этапа
3. Зависимости между разделами
4. Ресурсные потребности

Формат: markdown с таблицей этапов и timeline-диаграммой.`
  ),

  createSkill(
    'block-decompose',
    'Decompose Block',
    'Декомпозировать',
    'planner',
    `Декомпозируй блок «{{entityTitle}}» на разделы и задачи.

Данные блока:
{{entityData}}

Для каждого раздела:
- Название и описание (2-3 предложения)
- 3-5 конкретных задач
- Оценка трудозатрат (в часах)
- Приоритет (critical/high/medium/low)

Формат: markdown с вложенными списками.`
  ),

  createSkill(
    'block-risks',
    'Assess Block Risks',
    'Оценить риски',
    'analyst',
    `Проведи анализ рисков блока «{{entityTitle}}».

Данные блока:
{{entityData}}

Определи 5-7 ключевых рисков. Для каждого:
- Описание риска
- Вероятность (высокая/средняя/низкая)
- Влияние (критическое/значительное/умеренное)
- Стратегия митигации
- Ответственный (роль)

Формат: markdown-таблица рисков + матрица вероятность×влияние.`
  ),

  createSkill(
    'block-report',
    'Block Report',
    'Отчёт по блоку',
    'writer',
    `Сформируй отчёт по блоку «{{entityTitle}}».

Данные блока:
{{entityData}}

Структура отчёта:
1. Резюме (2-3 предложения)
2. Текущий прогресс (%, ключевые показатели)
3. Достижения за период
4. Проблемы и блокеры
5. Следующие шаги
6. Рекомендации

Формат: профессиональный markdown-отчёт.`
  ),

  // ============ Section Skills ============
  createSkill(
    'section-tasks',
    'Generate Tasks',
    'Создать задачи',
    'planner',
    `Предложи задачи для раздела «{{entityTitle}}».

Данные раздела:
{{entityData}}

Для каждой задачи (5-8 штук):
- Название (краткое, конкретное)
- Описание (2-3 предложения)
- Приоритет (critical/high/medium/low)
- Оценка времени (часы)
- Подзадачи (если нужны)

Формат: JSON-массив для автоматического создания задач.`,
    {
      type: 'object',
      properties: {
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
              estimatedHours: { type: 'number' },
            },
            required: ['title'],
          },
        },
      },
      required: ['tasks'],
    }
  ),

  createSkill(
    'section-plan',
    'Section Work Plan',
    'План работ',
    'planner',
    `Создай план работ для раздела «{{entityTitle}}».

Данные раздела:
{{entityData}}

План должен включать:
1. Последовательность выполнения задач
2. Зависимости между задачами (что за чем)
3. Критический путь
4. Оценку сроков для каждого этапа
5. Промежуточные контрольные точки

Формат: markdown с диаграммой последовательности.`
  ),

  createSkill(
    'section-evaluate',
    'Evaluate Tasks',
    'Оценить задачи',
    'analyst',
    `Оцени все задачи раздела «{{entityTitle}}».

Данные раздела:
{{entityData}}

Для каждой задачи оцени:
- Сложность (1-10)
- Примерные сроки (часы/дни)
- Необходимые навыки/ресурсы
- Текущий статус и прогресс
- Рекомендации по оптимизации

Формат: markdown-таблица.`
  ),

  createSkill(
    'section-deps',
    'Find Dependencies',
    'Найти зависимости',
    'analyst',
    `Определи зависимости в разделе «{{entityTitle}}».

Данные раздела:
{{entityData}}

Для каждой зависимости:
- Задача A → Задача B (A блокирует B)
- Тип зависимости (техническая/данные/процесс)
- Критичность (высокая/средняя/низкая)
- Рекомендации по устранению блокеров

Формат: список связей + граф зависимостей в текстовом формате.`
  ),

  // ============ Task Skills ============
  createSkill(
    'task-discuss',
    'Discuss Task',
    'Обсудить',
    'facilitator',
    `Давай обсудим задачу «{{entityTitle}}».

Данные задачи:
{{entityData}}

Предложи:
1. 3-5 ключевых вопросов для обсуждения
2. Возможные подходы к решению
3. Потенциальные проблемы и как их избежать
4. Критерии успешного завершения

Тон: конструктивный, задавай наводящие вопросы.`
  ),

  createSkill(
    'task-research',
    'Research Task',
    'Проработать',
    'researcher',
    `Проведи глубокий анализ задачи «{{entityTitle}}».

Данные задачи:
{{entityData}}

Исследуй:
1. Ключевые аспекты и требования
2. Лучшие практики и рекомендации
3. Возможные технические подходы
4. Примеры аналогичных решений
5. Необходимые ресурсы и инструменты

Формат: аналитический markdown с разделами.`
  ),

  createSkill(
    'task-document',
    'Create Document',
    'Создать документ',
    'writer',
    `Создай структурированный документ по задаче «{{entityTitle}}».

Данные задачи:
{{entityData}}

Структура документа:
1. Цель и описание
2. Требования (функциональные и нефункциональные)
3. Критерии приёмки
4. Сроки и этапы
5. Ответственные и заинтересованные стороны
6. Риски и зависимости

Формат: профессиональный markdown-документ.`
  ),

  createSkill(
    'task-table',
    'Create Table',
    'Составить таблицу',
    'writer',
    `Составь таблицу для задачи «{{entityTitle}}».

Данные задачи:
{{entityData}}

Таблица должна включать:
- Ключевые параметры и метрики
- Ответственные за каждый пункт
- Сроки выполнения
- Статусы и индикаторы
- KPI/показатели успеха

Формат: markdown-таблица с колонками.`
  ),

  createSkill(
    'task-actionplan',
    'Action Plan',
    'План действий',
    'planner',
    `Напиши пошаговый план действий для задачи «{{entityTitle}}».

Данные задачи:
{{entityData}}

Для каждого шага:
1. Конкретное действие
2. Ответственный (роль)
3. Срок выполнения
4. Ожидаемый результат
5. Зависимости от других шагов

Формат: нумерованный список с подпунктами.`
  ),

  createSkill(
    'task-presentation',
    'Prepare Presentation',
    'Подготовить презентацию',
    'writer',
    `Подготовь структуру презентации по задаче «{{entityTitle}}».

Данные задачи:
{{entityData}}

Для каждого слайда (8-12 штук):
- Заголовок слайда
- 3-4 ключевых тезиса
- Рекомендуемый визуальный элемент (график, диаграмма, таблица)
- Заметки для выступающего

Формат: markdown с разделами по слайдам.`
  ),

  createSkill(
    'task-subtasks',
    'Generate Subtasks',
    'Подзадачи',
    'planner',
    `Разбей задачу «{{entityTitle}}» на подзадачи.

Данные задачи:
{{entityData}}

Для каждой подзадачи (3-7 штук):
- Название (краткое, конкретное)
- Описание (1-2 предложения)
- Оценка времени (часы)
- Приоритет (high/medium/low)

Формат: JSON-массив для автоматического создания.`,
    {
      type: 'object',
      properties: {
        subtasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              estimatedHours: { type: 'number' },
              priority: { type: 'string', enum: ['high', 'medium', 'low'] },
            },
            required: ['title'],
          },
        },
      },
      required: ['subtasks'],
    }
  ),

  createSkill(
    'task-risks',
    'Task Risks',
    'Риски задачи',
    'analyst',
    `Определи риски задачи «{{entityTitle}}».

Данные задачи:
{{entityData}}

Категории рисков:
1. Технические (сложность, неизвестность)
2. Организационные (ресурсы, зависимости)
3. Внешние (изменение требований, сторонние сервисы)

Для каждого: описание, вероятность, влияние, стратегия митигации.

Формат: markdown-таблица рисков.`
  ),

  createSkill(
    'task-estimate',
    'Estimate Task',
    'Оценить задачу',
    'analyst',
    `Оцени задачу «{{entityTitle}}».

Данные задачи:
{{entityData}}

Оцени:
- Сложность (1-10) с обоснованием
- Примерное время выполнения (оптимистичное / реалистичное / пессимистичное)
- Необходимые навыки и компетенции
- Возможные блокеры
- Story points (по Fibonacci: 1,2,3,5,8,13,21)

Формат: структурированный markdown.`
  ),

  createSkill(
    'task-spec',
    'Write Specification',
    'Техническое задание',
    'writer',
    `Напиши техническое задание для задачи «{{entityTitle}}».

Данные задачи:
{{entityData}}

Структура ТЗ:
1. Общие сведения (цель, заказчик)
2. Описание задачи
3. Функциональные требования
4. Нефункциональные требования
5. Ограничения и допущения
6. Критерии приёмки
7. Сроки и этапы

Формат: формальный markdown-документ.`
  ),

  createSkill(
    'task-howto',
    'How To Execute',
    'Как выполнить',
    'researcher',
    `Объясни, как лучше выполнить задачу «{{entityTitle}}».

Данные задачи:
{{entityData}}

Включи:
1. Подготовительные шаги
2. Пошаговую инструкцию
3. Лучшие практики
4. Частые ошибки и как их избежать
5. Полезные инструменты/ресурсы
6. Чек-лист завершения

Формат: markdown с нумерованными шагами.`
  ),
];

// ============================================================================
// Seed Function
// ============================================================================

interface SeedResult {
  agentsCreated: number;
  skillsCreated: number;
  agentsSkipped: number;
  skillsSkipped: number;
}

/**
 * Seed system agents and skills into the database
 * Only creates entries that don't already exist (by slug)
 */
export async function seedAgentsAndSkills(): Promise<SeedResult> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }

  const result: SeedResult = {
    agentsCreated: 0,
    skillsCreated: 0,
    agentsSkipped: 0,
    skillsSkipped: 0,
  };

  // Build agent slug to ID map
  const agentIdMap = new Map<string, number>();

  // 1. Seed Agents
  for (const agentData of SYSTEM_AGENTS) {
    const [existing] = await db.select({ id: aiAgents.id })
      .from(aiAgents)
      .where(eq(aiAgents.slug, agentData.slug));

    if (existing) {
      agentIdMap.set(agentData.slug, existing.id);
      result.agentsSkipped++;
    } else {
      const [insertResult] = await db.insert(aiAgents).values(agentData);
      agentIdMap.set(agentData.slug, insertResult.insertId);
      result.agentsCreated++;
    }
  }

  // 2. Seed Skills
  for (const skillWithAgent of SYSTEM_SKILLS) {
    const { agentSlug, ...skillData } = skillWithAgent;

    const [existing] = await db.select({ id: aiSkills.id })
      .from(aiSkills)
      .where(eq(aiSkills.slug, skillData.slug));

    if (existing) {
      result.skillsSkipped++;
    } else {
      // Resolve agentId from slug
      const agentId = agentIdMap.get(agentSlug);

      await db.insert(aiSkills).values({
        ...skillData,
        agentId: agentId || null,
      });
      result.skillsCreated++;
    }
  }

  return result;
}

/**
 * Check if system agents/skills are seeded
 */
export async function isSeeded(): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const [agent] = await db.select({ id: aiAgents.id })
    .from(aiAgents)
    .where(eq(aiAgents.slug, 'general'));

  return !!agent;
}

// Export data for tests or other uses
export { SYSTEM_AGENTS, SYSTEM_SKILLS };

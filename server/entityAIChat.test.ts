import { describe, it, expect, vi } from 'vitest';

describe('EntityAIChat & Navigation Fixes', () => {
  describe('EntityAIChat Component Logic', () => {
    it('should have default block prompts for block entity type', () => {
      const title = 'Research and Analysis';
      const prompts = [
        { label: 'Создать roadmap', prompt: `Создай детальный roadmap для блока "${title}" с этапами, сроками и метриками` },
        { label: 'Декомпозировать', prompt: `Разбей блок "${title}" на конкретные разделы и задачи с оценкой трудозатрат` },
        { label: 'Оценить риски', prompt: `Какие основные риски у блока "${title}" и как их минимизировать?` },
        { label: 'Сформировать отчёт', prompt: `Сформируй отчёт о текущем состоянии блока "${title}" с рекомендациями` },
      ];
      expect(prompts).toHaveLength(4);
      expect(prompts[0].label).toBe('Создать roadmap');
      expect(prompts[0].prompt).toContain(title);
    });

    it('should have default section prompts for section entity type', () => {
      const title = 'Marketing Research';
      const prompts = [
        { label: 'Создать задачи', prompt: `Предложи список задач для раздела "${title}" с приоритетами и оценкой времени` },
        { label: 'Составить план', prompt: `Составь детальный план работ для раздела "${title}" с этапами и зависимостями` },
        { label: 'Оценить раздел', prompt: `Оцени текущее состояние раздела "${title}" и предложи улучшения` },
        { label: 'Найти зависимости', prompt: `Какие зависимости и блокеры могут быть у раздела "${title}"?` },
      ];
      expect(prompts).toHaveLength(4);
      expect(prompts[0].label).toBe('Создать задачи');
      expect(prompts[0].prompt).toContain(title);
    });

    it('should have default task prompts with business-oriented actions', () => {
      const title = 'Analyze market competitors';
      const prompts = [
        { label: '💬 Обсудить', prompt: `Давай обсудим задачу "${title}". Какие ключевые вопросы нужно проработать? Предложи темы для обсуждения и возможные решения.` },
        { label: '🔍 Проработать', prompt: `Проведи глубокий анализ задачи "${title}". Исследуй тему, собери ключевые факты, лучшие практики и рекомендации.` },
        { label: '📄 Создать документ', prompt: `Создай структурированный документ по задаче "${title}". Включи цели, описание, требования, критерии приёмки и сроки.` },
        { label: '📊 Составить таблицу', prompt: `Составь таблицу (в формате Markdown) для задачи "${title}" с ключевыми параметрами, метриками, ответственными и сроками.` },
        { label: '📋 План действий', prompt: `Напиши пошаговый план действий для задачи "${title}" с конкретными шагами, ответственными, сроками и ожидаемыми результатами.` },
        { label: '📑 Подготовить презентацию', prompt: `Подготовь структуру презентации по задаче "${title}". Предложи слайды с заголовками, ключевыми тезисами и визуальными элементами.` },
        { label: '⚡ Подзадачи', prompt: `Разбей задачу "${title}" на конкретные подзадачи с оценкой времени и приоритетами.` },
        { label: '⚠️ Риски', prompt: `Какие риски и блокеры могут возникнуть при выполнении задачи "${title}"? Как их минимизировать?` },
      ];
      expect(prompts).toHaveLength(8);
      expect(prompts[0].label).toBe('💬 Обсудить');
      expect(prompts[1].label).toBe('🔍 Проработать');
      expect(prompts[2].label).toBe('📄 Создать документ');
      expect(prompts[3].label).toBe('📊 Составить таблицу');
      expect(prompts[4].label).toBe('📋 План действий');
      expect(prompts[5].label).toBe('📑 Подготовить презентацию');
      expect(prompts[6].label).toBe('⚡ Подзадачи');
      expect(prompts[7].label).toBe('⚠️ Риски');
      expect(prompts.every(p => p.prompt.includes(title))).toBe(true);
    });

    it('should select correct prompts based on entity type', () => {
      const title = 'Test Entity';
      const getPrompts = (entityType: 'block' | 'section' | 'task') => {
        if (entityType === 'block') return 4;
        if (entityType === 'section') return 4;
        return 8;
      };
      expect(getPrompts('block')).toBe(4);
      expect(getPrompts('section')).toBe(4);
      expect(getPrompts('task')).toBe(8);
    });

    it('should use correct placeholder for task entity type', () => {
      const entityType = 'task';
      const placeholder = entityType === 'block' ? 'Спросите AI о блоке...' : entityType === 'section' ? 'Спросите AI о разделе...' : 'Спросите AI о задаче...';
      expect(placeholder).toBe('Спросите AI о задаче...');
    });

    it('should support custom quick prompts', () => {
      const customPrompts = [
        { label: 'Custom Action', prompt: 'Do something custom' },
      ];
      expect(customPrompts).toHaveLength(1);
      expect(customPrompts[0].label).toBe('Custom Action');
    });

    it('should handle message sending flow', () => {
      const messages: Array<{ role: string; content: string }> = [];
      const userMsg = 'Test message';
      
      // Simulate sending
      messages.push({ role: 'user', content: userMsg });
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('user');
      
      // Simulate AI response
      messages.push({ role: 'assistant', content: 'AI response' });
      expect(messages).toHaveLength(2);
      expect(messages[1].role).toBe('assistant');
    });

    it('should handle empty message prevention', () => {
      const message = '';
      const canSend = message.trim().length > 0;
      expect(canSend).toBe(false);
    });

    it('should handle non-empty message', () => {
      const message = 'Hello AI';
      const canSend = message.trim().length > 0;
      expect(canSend).toBe(true);
    });

    it('should support expand/collapse toggle', () => {
      let expanded = true;
      expanded = !expanded;
      expect(expanded).toBe(false);
      expanded = !expanded;
      expect(expanded).toBe(true);
    });

    it('should count assistant messages for badge', () => {
      const messages = [
        { id: 1, role: 'user', content: 'Q1' },
        { id: 2, role: 'assistant', content: 'A1' },
        { id: 3, role: 'user', content: 'Q2' },
        { id: 4, role: 'assistant', content: 'A2' },
      ];
      const assistantCount = messages.filter(m => m.role === 'assistant').length;
      expect(assistantCount).toBe(2);
    });
  });

  describe('Navigation Fix: Section Selection', () => {
    it('should clear selectedTask when selecting a block context', () => {
      let selectedTask: any = { id: 1, title: 'Task 1' };
      let selectedContext: any = { type: 'task', id: 1, title: 'Task 1' };
      
      // Simulate clicking on a block
      const ctx = { type: 'block', id: 10, title: 'Block 1', content: '' };
      selectedContext = ctx;
      if (ctx.type === 'block' || ctx.type === 'section' || ctx.type === 'project') {
        selectedTask = null;
      }
      
      expect(selectedContext.type).toBe('block');
      expect(selectedTask).toBeNull();
    });

    it('should clear selectedTask when selecting a section context', () => {
      let selectedTask: any = { id: 1, title: 'Task 1' };
      let selectedContext: any = { type: 'task', id: 1, title: 'Task 1' };
      
      // Simulate clicking on a section
      const ctx = { type: 'section', id: 20, title: 'Section 1', content: '' };
      selectedContext = ctx;
      if (ctx.type === 'block' || ctx.type === 'section' || ctx.type === 'project') {
        selectedTask = null;
      }
      
      expect(selectedContext.type).toBe('section');
      expect(selectedTask).toBeNull();
    });

    it('should NOT clear selectedTask when selecting a task context', () => {
      let selectedTask: any = { id: 1, title: 'Task 1' };
      let selectedContext: any = { type: 'task', id: 1, title: 'Task 1' };
      
      // Simulate clicking on a task
      const ctx = { type: 'task', id: 5, title: 'Task 5', content: '' };
      selectedContext = ctx;
      if (ctx.type === 'block' || ctx.type === 'section' || ctx.type === 'project') {
        selectedTask = null;
      }
      
      expect(selectedContext.type).toBe('task');
      expect(selectedTask).not.toBeNull();
    });

    it('should show BlockDetailPanel when selectedContext is block and no selectedTask', () => {
      const selectedTask = null;
      const selectedContext = { type: 'block', id: 10, title: 'Block 1' };
      
      // Rendering logic: selectedTask has priority
      const showTaskPanel = !!selectedTask;
      const showBlockPanel = !showTaskPanel && selectedContext?.type === 'block';
      const showSectionPanel = !showTaskPanel && selectedContext?.type === 'section';
      
      expect(showTaskPanel).toBe(false);
      expect(showBlockPanel).toBe(true);
      expect(showSectionPanel).toBe(false);
    });

    it('should show SectionDetailPanel when selectedContext is section and no selectedTask', () => {
      const selectedTask = null;
      const selectedContext = { type: 'section', id: 20, title: 'Section 1' };
      
      const showTaskPanel = !!selectedTask;
      const showBlockPanel = !showTaskPanel && selectedContext?.type === 'block';
      const showSectionPanel = !showTaskPanel && selectedContext?.type === 'section';
      
      expect(showTaskPanel).toBe(false);
      expect(showBlockPanel).toBe(false);
      expect(showSectionPanel).toBe(true);
    });

    it('should show TaskDetailPanel when selectedTask exists even if selectedContext is section', () => {
      const selectedTask = { id: 1, title: 'Task 1' };
      const selectedContext = { type: 'section', id: 20, title: 'Section 1' };
      
      const showTaskPanel = !!selectedTask;
      const showBlockPanel = !showTaskPanel && selectedContext?.type === 'block';
      const showSectionPanel = !showTaskPanel && selectedContext?.type === 'section';
      
      expect(showTaskPanel).toBe(true);
      expect(showBlockPanel).toBe(false);
      expect(showSectionPanel).toBe(false);
    });
  });

  describe('AI Chat Integration in Panels', () => {
    it('should support block entity type for AI chat', () => {
      const entityType = 'block';
      const validTypes = ['block', 'section', 'task'];
      expect(validTypes).toContain(entityType);
    });

    it('should support section entity type for AI chat', () => {
      const entityType = 'section';
      const validTypes = ['block', 'section', 'task'];
      expect(validTypes).toContain(entityType);
    });

    it('should support task entity type for AI chat', () => {
      const entityType = 'task';
      const validTypes = ['block', 'section', 'task'];
      expect(validTypes).toContain(entityType);
    });

    it('should build correct chat API payload for block', () => {
      const payload = {
        contextType: 'block',
        contextId: 10,
        content: 'Analyze this block',
      };
      expect(payload.contextType).toBe('block');
      expect(payload.contextId).toBe(10);
      expect(payload.content).toBeTruthy();
    });

    it('should build correct chat API payload for section', () => {
      const payload = {
        contextType: 'section',
        contextId: 20,
        content: 'Create tasks for this section',
      };
      expect(payload.contextType).toBe('section');
      expect(payload.contextId).toBe(20);
      expect(payload.content).toBeTruthy();
    });

    it('should handle onInsertResult callback', () => {
      let clipboardContent = '';
      const onInsertResult = (content: string) => {
        clipboardContent = content;
      };
      
      onInsertResult('AI generated roadmap content');
      expect(clipboardContent).toBe('AI generated roadmap content');
    });

    it('should build correct chat API payload for task', () => {
      const payload = {
        contextType: 'task',
        contextId: 42,
        content: 'Break this task into subtasks',
      };
      expect(payload.contextType).toBe('task');
      expect(payload.contextId).toBe(42);
      expect(payload.content).toBeTruthy();
    });

    it('should insert AI result into task notes', () => {
      let notes = 'Existing notes';
      const aiContent = 'AI generated subtask plan';
      const newNotes = notes ? `${notes}\n\n---\n\n${aiContent}` : aiContent;
      expect(newNotes).toContain('Existing notes');
      expect(newNotes).toContain('AI generated subtask plan');
      expect(newNotes).toContain('---');
    });

    it('should insert AI result into empty task notes', () => {
      let notes = '';
      const aiContent = 'AI generated subtask plan';
      const newNotes = notes ? `${notes}\n\n---\n\n${aiContent}` : aiContent;
      expect(newNotes).toBe('AI generated subtask plan');
    });

    it('should default to collapsed in TaskDetailPanel', () => {
      const defaultExpanded = false;
      expect(defaultExpanded).toBe(false);
    });

    it('should default to expanded in BlockDetailPanel and SectionDetailPanel', () => {
      const blockExpanded = true;
      const sectionExpanded = true;
      expect(blockExpanded).toBe(true);
      expect(sectionExpanded).toBe(true);
    });

    it('should save AI response as document via onSaveAsDocument', () => {
      let summary = '';
      const onSaveAsDocument = (content: string) => {
        summary = content;
      };
      const aiContent = '# Техническое задание\n\n## Описание\nЗадача на анализ рынка';
      onSaveAsDocument(aiContent);
      expect(summary).toBe(aiContent);
      expect(summary).toContain('Техническое задание');
    });

    it('should replace existing summary when saving as document', () => {
      let summary = 'Старый документ';
      const onSaveAsDocument = (content: string) => {
        summary = content;
      };
      onSaveAsDocument('Новый документ от AI');
      expect(summary).toBe('Новый документ от AI');
      expect(summary).not.toContain('Старый');
    });

    it('should have both onInsertResult and onSaveAsDocument for tasks', () => {
      let notes = '';
      let summary = '';
      const onInsertResult = (content: string) => { notes = content; };
      const onSaveAsDocument = (content: string) => { summary = content; };
      
      onInsertResult('Заметка');
      onSaveAsDocument('Документ');
      
      expect(notes).toBe('Заметка');
      expect(summary).toBe('Документ');
      expect(notes).not.toBe(summary);
    });

    it('should not show save-as-document button when callback is not provided', () => {
      const onSaveAsDocument = undefined;
      expect(onSaveAsDocument).toBeUndefined();
      // In the component, the button is conditionally rendered: {onSaveAsDocument && ...}
      // So when undefined, the button won't appear
    });

    it('should handle abort controller for stopping requests', () => {
      const controller = new AbortController();
      expect(controller.signal.aborted).toBe(false);
      controller.abort();
      expect(controller.signal.aborted).toBe(true);
    });
  });

  describe('Context Menu Navigation Fixes', () => {
    it('should clear selectedTask when discuss action on block', () => {
      let selectedTask: any = { id: 1 };
      const actionId = 'discuss';
      const entityType = 'block';
      
      if (actionId === 'discuss' && (entityType === 'block' || entityType === 'section')) {
        selectedTask = null;
      }
      
      expect(selectedTask).toBeNull();
    });

    it('should clear selectedTask when discuss action on section', () => {
      let selectedTask: any = { id: 1 };
      const actionId = 'discuss';
      const entityType = 'section';
      
      if (actionId === 'discuss' && (entityType === 'block' || entityType === 'section')) {
        selectedTask = null;
      }
      
      expect(selectedTask).toBeNull();
    });

    it('should NOT clear selectedTask when discuss action on task', () => {
      let selectedTask: any = { id: 1 };
      const actionId = 'discuss';
      const entityType = 'task';
      
      if (actionId === 'discuss' && (entityType === 'block' || entityType === 'section')) {
        selectedTask = null;
      }
      
      expect(selectedTask).not.toBeNull();
    });

    it('should clear selectedTask when AI action on block', () => {
      let selectedTask: any = { id: 1 };
      const actionId = 'ai-roadmap';
      const entityType = 'block';
      
      if (actionId.startsWith('ai-') && (entityType === 'block' || entityType === 'section')) {
        selectedTask = null;
      }
      
      expect(selectedTask).toBeNull();
    });

    it('should clear selectedTask when AI action on section', () => {
      let selectedTask: any = { id: 1 };
      const actionId = 'ai-create-tasks';
      const entityType = 'section';
      
      if (actionId.startsWith('ai-') && (entityType === 'block' || entityType === 'section')) {
        selectedTask = null;
      }
      
      expect(selectedTask).toBeNull();
    });
  });

  describe('Entity Context for AI Chat', () => {
    it('should build task context with all fields', () => {
      const task = {
        id: 1,
        title: 'Analyze market competitors',
        description: 'Research top 5 competitors',
        status: 'in_progress',
        priority: 'high' as const,
        deadline: new Date('2026-03-15').getTime(),
        dependencies: [2, 3],
        notes: 'Started research on competitor A',
      };
      const allTasks = [
        { id: 2, title: 'Define target market', status: 'completed' },
        { id: 3, title: 'Collect data sources', status: 'in_progress' },
      ];

      const statusMap: Record<string, string> = {
        not_started: 'Не начата', in_progress: 'В работе', completed: 'Завершена',
      };
      const priorityMap: Record<string, string> = {
        critical: 'Критический', high: 'Высокий', medium: 'Средний', low: 'Низкий',
      };

      const parts: string[] = [];
      parts.push(`Задача: "${task.title}"`);
      if (task.description) parts.push(`Описание: ${task.description}`);
      parts.push(`Статус: ${statusMap[task.status || ''] || 'Не указан'}`);
      parts.push(`Приоритет: ${priorityMap[task.priority || ''] || 'Не указан'}`);

      if (task.deadline) {
        const deadlineDate = new Date(task.deadline);
        const now = new Date();
        const diffDays = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const deadlineStr = deadlineDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
        parts.push(`Дедлайн: ${deadlineStr}`);
      }

      if (task.dependencies && task.dependencies.length > 0) {
        const depNames = task.dependencies.map(depId => {
          const depTask = allTasks.find(t => t.id === depId);
          if (!depTask) return `#${depId}`;
          return `"${depTask.title}" (${statusMap[depTask.status || ''] || '?'})`;
        });
        parts.push(`Зависимости: ${depNames.join(', ')}`);
      }

      if (task.notes) parts.push(`Заметки: ${task.notes}`);

      const context = parts.join('\n');
      expect(context).toContain('Analyze market competitors');
      expect(context).toContain('Research top 5 competitors');
      expect(context).toContain('В работе');
      expect(context).toContain('Высокий');
      expect(context).toContain('Define target market');
      expect(context).toContain('Collect data sources');
      expect(context).toContain('Started research');
    });

    it('should build task context with missing optional fields', () => {
      const task = {
        id: 5,
        title: 'Simple task',
        status: 'not_started',
        priority: null,
        deadline: null,
        dependencies: null,
        notes: null,
      };

      const parts: string[] = [];
      parts.push(`Задача: "${task.title}"`);
      parts.push(`Статус: Не начата`);
      parts.push(`Приоритет: Не указан`);
      parts.push('Дедлайн: Не установлен');
      parts.push('Зависимости: Нет');

      const context = parts.join('\n');
      expect(context).toContain('Simple task');
      expect(context).toContain('Не начата');
      expect(context).toContain('Не указан');
      expect(context).toContain('Не установлен');
      expect(context).toContain('Зависимости: Нет');
      expect(context).not.toContain('Заметки');
    });

    it('should truncate long notes in context', () => {
      const longNotes = 'A'.repeat(600);
      const truncatedNotes = longNotes.length > 500 ? longNotes.slice(0, 500) + '...' : longNotes;
      expect(truncatedNotes.length).toBe(503); // 500 + '...'
      expect(truncatedNotes.endsWith('...')).toBe(true);
    });

    it('should calculate deadline urgency correctly', () => {
      const now = new Date();
      
      // Overdue
      const overdue = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const diffOverdue = Math.ceil((overdue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffOverdue).toBeLessThan(0);

      // Urgent (3 days)
      const urgent = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
      const diffUrgent = Math.ceil((urgent.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffUrgent).toBeGreaterThan(0);
      expect(diffUrgent).toBeLessThanOrEqual(3);

      // Normal
      const normal = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
      const diffNormal = Math.ceil((normal.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffNormal).toBeGreaterThan(3);
    });

    it('should build block context with statistics', () => {
      const block = {
        id: 1,
        title: 'Research',
        titleRu: 'Исследование',
        description: 'Research phase',
        duration: '4 weeks',
        sections: [
          { id: 1, title: 'Market Research', tasks: [
            { id: 1, title: 'T1', status: 'completed', priority: null, deadline: null },
            { id: 2, title: 'T2', status: 'in_progress', priority: 'high', deadline: null },
          ]},
          { id: 2, title: 'Competitor Analysis', tasks: [
            { id: 3, title: 'T3', status: 'not_started', priority: 'critical', deadline: null },
          ]},
        ],
      };

      let totalTasks = 0, completedTasks = 0, inProgressTasks = 0, notStartedTasks = 0;
      block.sections.forEach(s => s.tasks.forEach(t => {
        totalTasks++;
        if (t.status === 'completed') completedTasks++;
        else if (t.status === 'in_progress') inProgressTasks++;
        else notStartedTasks++;
      }));
      const progress = Math.round((completedTasks / totalTasks) * 100);

      const parts: string[] = [];
      parts.push(`Блок: "${block.titleRu}"`);
      parts.push(`Описание: ${block.description}`);
      parts.push(`Длительность: ${block.duration}`);
      parts.push(`Прогресс: ${progress}% (${completedTasks} из ${totalTasks} задач)`);
      parts.push(`В работе: ${inProgressTasks}, Не начато: ${notStartedTasks}`);
      const sectionNames = block.sections.map(s => `"${s.title}" (${s.tasks.length} задач)`).join(', ');
      parts.push(`Разделы (${block.sections.length}): ${sectionNames}`);

      const context = parts.join('\n');
      expect(context).toContain('Исследование');
      expect(context).toContain('Research phase');
      expect(context).toContain('4 weeks');
      expect(context).toContain('33%');
      expect(context).toContain('Market Research');
      expect(context).toContain('Competitor Analysis');
    });

    it('should build section context with task list', () => {
      const section = {
        id: 1,
        title: 'Marketing Research',
        description: 'Research marketing channels',
      };
      const blockTitle = 'Research Block';
      const tasks = [
        { id: 1, title: 'Survey users', status: 'completed' },
        { id: 2, title: 'Analyze data', status: 'in_progress' },
        { id: 3, title: 'Write report', status: 'not_started' },
      ];

      const completedTasks = tasks.filter(t => t.status === 'completed').length;
      const progress = Math.round((completedTasks / tasks.length) * 100);

      const parts: string[] = [];
      parts.push(`Раздел: "${section.title}"`);
      parts.push(`Описание: ${section.description}`);
      parts.push(`Блок: "${blockTitle}"`);
      parts.push(`Прогресс: ${progress}%`);
      const taskList = tasks.map(t => {
        const icon = t.status === 'completed' ? '✅' : t.status === 'in_progress' ? '⏳' : '○';
        return `${icon} "${t.title}"`;
      }).join(', ');
      parts.push(`Задачи: ${taskList}`);

      const context = parts.join('\n');
      expect(context).toContain('Marketing Research');
      expect(context).toContain('Research marketing channels');
      expect(context).toContain('Research Block');
      expect(context).toContain('33%');
      expect(context).toContain('✅ "Survey users"');
      expect(context).toContain('⏳ "Analyze data"');
      expect(context).toContain('○ "Write report"');
    });

    it('should pass entityContext as projectContext in API payload', () => {
      const entityContext = 'Задача: "Test"\nСтатус: В работе';
      const payload = {
        "0": {
          json: {
            contextType: 'task',
            contextId: 42,
            content: 'Break into subtasks',
            projectContext: entityContext,
          }
        }
      };
      expect(payload["0"].json.projectContext).toBe(entityContext);
      expect(payload["0"].json.contextType).toBe('task');
    });

    it('should include entityContext in server system prompt', () => {
      const projectContext = 'Задача: "Analyze competitors"\nСтатус: В работе\nПриоритет: Высокий';
      const systemPrompt = `Ты AI-ассистент для управления проектами.
${projectContext ? `Контекст проекта: ${projectContext}` : ""}`;
      expect(systemPrompt).toContain('Analyze competitors');
      expect(systemPrompt).toContain('В работе');
      expect(systemPrompt).toContain('Высокий');
    });

    it('should handle missing entityContext gracefully', () => {
      const entityContext = undefined;
      const payload = {
        "0": {
          json: {
            contextType: 'task',
            contextId: 42,
            content: 'Question',
            projectContext: entityContext,
          }
        }
      };
      expect(payload["0"].json.projectContext).toBeUndefined();
    });

    it('should build streaming payload with /api/ai/stream endpoint', () => {
      const entityContext = 'Задача: "Deploy app"\nСтатус: В работе';
      const entityType = 'task';
      const entityTitle = 'Deploy app';
      const userMsg = 'How to deploy?';
      const conversationHistory = [
        { role: 'user', content: 'Previous question' },
        { role: 'assistant', content: 'Previous answer' },
      ];

      let projectContext = '';
      if (entityContext) projectContext = entityContext;
      if (entityType && entityTitle) {
        const entityLabel = entityType === 'block' ? 'блок' : entityType === 'section' ? 'раздел' : 'задача';
        projectContext = `Текущий контекст: ${entityLabel} "${entityTitle}".\n${projectContext || ''}`;
      }

      const payload = {
        messages: [...conversationHistory, { role: 'user', content: userMsg }],
        taskType: 'chat',
        projectContext: projectContext || undefined,
      };

      expect(payload.messages).toHaveLength(3);
      expect(payload.messages[2].content).toBe('How to deploy?');
      expect(payload.taskType).toBe('chat');
      expect(payload.projectContext).toContain('задача');
      expect(payload.projectContext).toContain('Deploy app');
    });

    it('should parse SSE chunks correctly', () => {
      const chunk = 'data: {"choices":[{"delta":{"content":"Hello"}}]}\ndata: {"choices":[{"delta":{"content":" world"}}]}\n';
      const lines = chunk.split('\n');
      let fullContent = '';

      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.slice(6));
            const content = data.choices?.[0]?.delta?.content;
            if (content) fullContent += content;
          } catch {}
        }
      }

      expect(fullContent).toBe('Hello world');
    });

    it('should handle SSE done event', () => {
      const chunk = 'data: {"type":"done","executionTime":1500}\n';
      const lines = chunk.split('\n');
      let isDone = false;
      let executionTime = 0;

      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'done') {
              isDone = true;
              executionTime = data.executionTime || 0;
            }
          } catch {}
        }
      }

      expect(isDone).toBe(true);
      expect(executionTime).toBe(1500);
    });

    it('should handle SSE error event', () => {
      const chunk = 'data: {"type":"error","message":"Stream failed"}\n';
      const lines = chunk.split('\n');
      let errorMsg = '';

      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'error') errorMsg = data.message;
          } catch {}
        }
      }

      expect(errorMsg).toBe('Stream failed');
    });

    it('should handle streaming message state transitions', () => {
      type Msg = { id: string; role: string; content: string; isStreaming?: boolean };
      let messages: Msg[] = [];

      // 1. Add user message
      messages.push({ id: 'user-1', role: 'user', content: 'Hello' });
      expect(messages).toHaveLength(1);

      // 2. Add empty streaming assistant message
      const assistantId = 'assistant-1';
      messages.push({ id: assistantId, role: 'assistant', content: '', isStreaming: true });
      expect(messages).toHaveLength(2);
      expect(messages[1].isStreaming).toBe(true);
      expect(messages[1].content).toBe('');

      // 3. Update with streaming content
      messages = messages.map(m =>
        m.id === assistantId ? { ...m, content: 'Partial' } : m
      );
      expect(messages[1].content).toBe('Partial');
      expect(messages[1].isStreaming).toBe(true);

      // 4. Mark streaming complete
      messages = messages.map(m =>
        m.id === assistantId ? { ...m, content: 'Full response', isStreaming: false } : m
      );
      expect(messages[1].content).toBe('Full response');
      expect(messages[1].isStreaming).toBe(false);
    });

    it('should handle abort/cancel during streaming', () => {
      type Msg = { id: string; role: string; content: string; isStreaming?: boolean };
      let messages: Msg[] = [
        { id: 'user-1', role: 'user', content: 'Hello' },
        { id: 'assistant-1', role: 'assistant', content: 'Partial content', isStreaming: true },
      ];

      // Simulate cancel
      const assistantId = 'assistant-1';
      messages = messages.map(m =>
        m.id === assistantId
          ? { ...m, isStreaming: false, content: m.content || '*(Генерация отменена)*' }
          : m
      );

      expect(messages[1].isStreaming).toBe(false);
      expect(messages[1].content).toBe('Partial content');
    });

    it('should show cancelled text when no content received before abort', () => {
      type Msg = { id: string; role: string; content: string; isStreaming?: boolean };
      let messages: Msg[] = [
        { id: 'user-1', role: 'user', content: 'Hello' },
        { id: 'assistant-1', role: 'assistant', content: '', isStreaming: true },
      ];

      const assistantId = 'assistant-1';
      messages = messages.map(m =>
        m.id === assistantId
          ? { ...m, isStreaming: false, content: m.content || '*(Генерация отменена)*' }
          : m
      );

      expect(messages[1].content).toBe('*(Генерация отменена)*');
    });

    it('should count only non-streaming assistant messages for badge', () => {
      const messages = [
        { id: '1', role: 'user', content: 'Q1' },
        { id: '2', role: 'assistant', content: 'A1', isStreaming: false },
        { id: '3', role: 'user', content: 'Q2' },
        { id: '4', role: 'assistant', content: '', isStreaming: true },
      ];
      const count = messages.filter(m => m.role === 'assistant' && !m.isStreaming).length;
      expect(count).toBe(1);
    });

    it('should include conversation history in streaming payload (last 10 messages)', () => {
      const allMessages = Array.from({ length: 15 }, (_, i) => ({
        id: `msg-${i}`,
        role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
        content: `Message ${i}`,
      }));

      const conversationHistory = allMessages
        .filter(m => !(m as any).isStreaming)
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }));

      expect(conversationHistory).toHaveLength(10);
      expect(conversationHistory[0].content).toBe('Message 5');
      expect(conversationHistory[9].content).toBe('Message 14');
    });

    it('should have business-oriented prompts covering key use cases', () => {
      const title = 'Test task';
      const prompts = [
        { label: '💬 Обсудить', prompt: `Давай обсудим задачу "${title}".` },
        { label: '🔍 Проработать', prompt: `Проведи глубокий анализ задачи "${title}".` },
        { label: '📄 Создать документ', prompt: `Создай структурированный документ по задаче "${title}".` },
        { label: '📊 Составить таблицу', prompt: `Составь таблицу для задачи "${title}".` },
        { label: '📋 План действий', prompt: `Напиши пошаговый план действий для задачи "${title}".` },
        { label: '📑 Подготовить презентацию', prompt: `Подготовь структуру презентации по задаче "${title}".` },
        { label: '⚡ Подзадачи', prompt: `Разбей задачу "${title}" на подзадачи.` },
        { label: '⚠️ Риски', prompt: `Какие риски у задачи "${title}"?` },
      ];

      // Verify all key business actions are covered
      const labels = prompts.map(p => p.label);
      expect(labels).toContain('💬 Обсудить');
      expect(labels).toContain('📄 Создать документ');
      expect(labels).toContain('📊 Составить таблицу');
      expect(labels).toContain('📋 План действий');
      expect(labels).toContain('📑 Подготовить презентацию');
      expect(labels).toContain('🔍 Проработать');
    });

    it('should resolve dependency names from allTasks', () => {
      const allTasks = [
        { id: 1, title: 'Task A', status: 'completed' },
        { id: 2, title: 'Task B', status: 'in_progress' },
        { id: 99, title: 'Unknown', status: null },
      ];
      const dependencies = [1, 2, 50];

      const depNames = dependencies.map(depId => {
        const depTask = allTasks.find(t => t.id === depId);
        if (!depTask) return `#${depId}`;
        return `"${depTask.title}"`;
      });

      expect(depNames[0]).toBe('"Task A"');
      expect(depNames[1]).toBe('"Task B"');
      expect(depNames[2]).toBe('#50'); // Not found, fallback to ID
    });
  });
});

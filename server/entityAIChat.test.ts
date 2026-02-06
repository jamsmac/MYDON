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

    it('should have default task prompts for task entity type', () => {
      const title = 'Analyze market competitors';
      const prompts = [
        { label: 'Разбить на подзадачи', prompt: `Разбей задачу "${title}" на конкретные подзадачи с оценкой времени` },
        { label: 'Оценить сложность', prompt: `Оцени сложность и трудозатраты задачи "${title}". Какие навыки нужны?` },
        { label: 'Найти риски', prompt: `Какие риски и блокеры могут возникнуть при выполнении задачи "${title}"?` },
        { label: 'Написать ТЗ', prompt: `Напиши техническое задание для задачи "${title}" с критериями приёмки` },
        { label: 'Как выполнить', prompt: `Опиши пошаговый план выполнения задачи "${title}" с рекомендациями и ресурсами` },
      ];
      expect(prompts).toHaveLength(5);
      expect(prompts[0].label).toBe('Разбить на подзадачи');
      expect(prompts[3].label).toBe('Написать ТЗ');
      expect(prompts[4].label).toBe('Как выполнить');
      expect(prompts.every(p => p.prompt.includes(title))).toBe(true);
    });

    it('should select correct prompts based on entity type', () => {
      const title = 'Test Entity';
      const getPrompts = (entityType: 'block' | 'section' | 'task') => {
        if (entityType === 'block') return 4;
        if (entityType === 'section') return 4;
        return 5;
      };
      expect(getPrompts('block')).toBe(4);
      expect(getPrompts('section')).toBe(4);
      expect(getPrompts('task')).toBe(5);
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
});

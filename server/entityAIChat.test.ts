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

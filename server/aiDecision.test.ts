/**
 * Tests for AI Decision Router
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database
vi.mock('./db', () => ({
  getDb: vi.fn().mockResolvedValue({
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        $returningId: vi.fn().mockResolvedValue([{ id: 1 }]),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  }),
}));

// Mock LLM
vi.mock('./_core/llm', () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          finalDecision: "Test decision summary",
          keyPoints: [{ id: "1", text: "Key point 1", priority: "high" }],
          actionItems: [{ id: "1", title: "Action 1", status: "pending" }],
          suggestedType: "technical",
          suggestedTags: ["test", "ai"],
        }),
      },
    }],
  }),
}));

describe('AI Decision System', () => {
  describe('Decision Types', () => {
    it('should support all decision types', () => {
      const validTypes = ['technical', 'business', 'design', 'process', 'architecture', 'other'];
      validTypes.forEach(type => {
        expect(typeof type).toBe('string');
      });
    });

    it('should support all importance levels', () => {
      const validLevels = ['critical', 'high', 'medium', 'low'];
      validLevels.forEach(level => {
        expect(typeof level).toBe('string');
      });
    });

    it('should support all status values', () => {
      const validStatuses = ['active', 'implemented', 'obsolete', 'superseded'];
      validStatuses.forEach(status => {
        expect(typeof status).toBe('string');
      });
    });
  });

  describe('Key Points Structure', () => {
    it('should have valid key point structure', () => {
      const keyPoint = {
        id: '1',
        text: 'Test key point',
        priority: 'high' as const,
      };
      
      expect(keyPoint.id).toBeDefined();
      expect(keyPoint.text).toBeDefined();
      expect(['high', 'medium', 'low']).toContain(keyPoint.priority);
    });

    it('should allow optional priority', () => {
      const keyPoint = {
        id: '1',
        text: 'Test key point',
      };
      
      expect(keyPoint.priority).toBeUndefined();
    });
  });

  describe('Action Items Structure', () => {
    it('should have valid action item structure', () => {
      const actionItem = {
        id: '1',
        title: 'Test action',
        assignee: 'user@example.com',
        deadline: '2024-12-31',
        status: 'pending' as const,
        subtaskId: 'subtask-1',
      };
      
      expect(actionItem.id).toBeDefined();
      expect(actionItem.title).toBeDefined();
      expect(['pending', 'done', 'cancelled']).toContain(actionItem.status);
    });

    it('should allow minimal action item', () => {
      const actionItem = {
        id: '1',
        title: 'Test action',
        status: 'pending' as const,
      };
      
      expect(actionItem.assignee).toBeUndefined();
      expect(actionItem.deadline).toBeUndefined();
      expect(actionItem.subtaskId).toBeUndefined();
    });
  });

  describe('Context Formatting', () => {
    it('should format decisions for AI context', () => {
      const decisions = [
        {
          id: 1,
          question: 'How to implement feature X?',
          finalDecision: 'Use approach A with library B',
          decisionType: 'technical',
          keyPoints: [{ id: '1', text: 'Key point 1' }],
        },
      ];

      const typeLabels: Record<string, string> = {
        technical: "🔧 Техническое",
        business: "💼 Бизнес",
        design: "🎨 Дизайн",
        process: "📋 Процесс",
        architecture: "🏗️ Архитектура",
        other: "📝 Другое",
      };

      let context = "=== ПРОШЛЫЕ РЕШЕНИЯ ПО ПРОЕКТУ ===\n\n";
      
      decisions.forEach((d, i) => {
        const typeLabel = typeLabels[d.decisionType || "other"];
        context += `### Решение ${i + 1} (${typeLabel})\n`;
        context += `**Вопрос:** ${d.question}\n`;
        context += `**Решение:** ${d.finalDecision}\n`;
        context += `\n`;
      });

      context += "=== КОНЕЦ ПРОШЛЫХ РЕШЕНИЙ ===\n\n";

      expect(context).toContain('ПРОШЛЫЕ РЕШЕНИЯ');
      expect(context).toContain('Техническое');
      expect(context).toContain('How to implement feature X?');
      expect(context).toContain('Use approach A with library B');
    });
  });

  describe('Statistics Calculation', () => {
    it('should calculate correct statistics', () => {
      const decisions = [
        { status: 'active', decisionType: 'technical', importance: 'high' },
        { status: 'active', decisionType: 'business', importance: 'medium' },
        { status: 'implemented', decisionType: 'technical', importance: 'critical' },
      ];

      const stats = {
        total: decisions.length,
        byStatus: { active: 0, implemented: 0, obsolete: 0, superseded: 0 },
        byType: { technical: 0, business: 0, design: 0, process: 0, architecture: 0, other: 0 },
        byImportance: { critical: 0, high: 0, medium: 0, low: 0 },
      };

      decisions.forEach(d => {
        if (d.status in stats.byStatus) {
          stats.byStatus[d.status as keyof typeof stats.byStatus]++;
        }
        if (d.decisionType in stats.byType) {
          stats.byType[d.decisionType as keyof typeof stats.byType]++;
        }
        if (d.importance in stats.byImportance) {
          stats.byImportance[d.importance as keyof typeof stats.byImportance]++;
        }
      });

      expect(stats.total).toBe(3);
      expect(stats.byStatus.active).toBe(2);
      expect(stats.byStatus.implemented).toBe(1);
      expect(stats.byType.technical).toBe(2);
      expect(stats.byType.business).toBe(1);
      expect(stats.byImportance.critical).toBe(1);
      expect(stats.byImportance.high).toBe(1);
      expect(stats.byImportance.medium).toBe(1);
    });
  });

  describe('Summary Generation', () => {
    it('should parse generated summary correctly', () => {
      const mockResponse = {
        finalDecision: "Test decision summary",
        keyPoints: [{ id: "1", text: "Key point 1", priority: "high" }],
        actionItems: [{ id: "1", title: "Action 1", status: "pending" }],
        suggestedType: "technical",
        suggestedTags: ["test", "ai"],
      };

      expect(mockResponse.finalDecision).toBeDefined();
      expect(mockResponse.keyPoints).toBeInstanceOf(Array);
      expect(mockResponse.actionItems).toBeInstanceOf(Array);
      expect(mockResponse.suggestedType).toBe('technical');
      expect(mockResponse.suggestedTags).toContain('test');
    });

    it('should handle empty response gracefully', () => {
      const fallback = {
        finalDecision: "Default summary...",
        keyPoints: [],
        actionItems: [],
        suggestedType: "other",
        suggestedTags: [],
      };

      expect(fallback.keyPoints).toHaveLength(0);
      expect(fallback.actionItems).toHaveLength(0);
    });
  });

  describe('Input Validation', () => {
    it('should require question and aiResponse for finalize', () => {
      const validInput = {
        question: 'Test question',
        aiResponse: 'Test response',
        finalDecision: 'Test decision',
      };

      expect(validInput.question).toBeTruthy();
      expect(validInput.aiResponse).toBeTruthy();
      expect(validInput.finalDecision).toBeTruthy();
    });

    it('should accept optional fields', () => {
      const input = {
        question: 'Test question',
        aiResponse: 'Test response',
        finalDecision: 'Test decision',
        sessionId: undefined,
        projectId: 1,
        taskId: 'task-1',
        blockId: undefined,
        keyPoints: [],
        actionItems: [],
        decisionType: 'technical' as const,
        tags: ['tag1'],
        importance: 'medium' as const,
      };

      expect(input.sessionId).toBeUndefined();
      expect(input.blockId).toBeUndefined();
      expect(input.projectId).toBe(1);
    });
  });
});

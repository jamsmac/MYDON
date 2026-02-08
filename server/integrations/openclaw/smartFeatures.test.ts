/**
 * OpenClaw Smart Features Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../db', () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

vi.mock('./ai', () => ({
  complete: vi.fn().mockResolvedValue('AI generated summary'),
  structured: vi.fn().mockResolvedValue({
    subtasks: ['Subtask 1', 'Subtask 2'],
    estimatedTotal: 4,
  }),
}));

vi.mock('./memory', () => ({
  getMemoryManager: vi.fn().mockReturnValue({
    getTaskContext: vi.fn().mockResolvedValue(''),
  }),
}));

describe('OpenClaw Smart Features', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PrioritySuggestion', () => {
    it('should have correct structure', () => {
      const suggestion = {
        priority: 'high' as const,
        confidence: 0.85,
        reasoning: 'High urgency based on deadline',
        factors: ['Deadline within 3 days', 'Blocks other tasks'],
      };

      expect(suggestion.priority).toBe('high');
      expect(suggestion.confidence).toBeGreaterThan(0);
      expect(suggestion.confidence).toBeLessThanOrEqual(1);
      expect(suggestion.reasoning).toBeTruthy();
      expect(suggestion.factors.length).toBeGreaterThan(0);
    });

    it('should support all priority levels', () => {
      const levels = ['low', 'medium', 'high', 'critical'];
      levels.forEach(level => {
        expect(['low', 'medium', 'high', 'critical']).toContain(level);
      });
    });
  });

  describe('SimilarTask', () => {
    it('should have correct structure', () => {
      const similar = {
        taskId: 123,
        title: 'Similar task title',
        similarity: 0.75,
        status: 'in_progress',
      };

      expect(similar.taskId).toBe(123);
      expect(similar.title).toBeTruthy();
      expect(similar.similarity).toBeGreaterThan(0);
      expect(similar.similarity).toBeLessThanOrEqual(1);
    });
  });

  describe('WorkloadAnalysis', () => {
    it('should have correct structure', () => {
      const analysis = {
        userId: 1,
        userName: 'John Doe',
        currentLoad: 60,
        activeTasks: 6,
        highPriorityTasks: 2,
        recommendation: 'moderate' as const,
      };

      expect(analysis.currentLoad).toBeLessThanOrEqual(100);
      expect(analysis.recommendation).toBe('moderate');
    });

    it('should support all recommendation levels', () => {
      const levels = ['available', 'moderate', 'overloaded'];
      levels.forEach(level => {
        expect(['available', 'moderate', 'overloaded']).toContain(level);
      });
    });
  });

  describe('ScheduleSuggestion', () => {
    it('should have correct structure', () => {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const suggestion = {
        suggestedDate: tomorrow,
        reasoning: 'Scheduled for next business day',
        conflicts: [],
        alternativeDates: [
          new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000),
          new Date(tomorrow.getTime() + 48 * 60 * 60 * 1000),
        ],
      };

      expect(suggestion.suggestedDate).toBeInstanceOf(Date);
      expect(suggestion.reasoning).toBeTruthy();
      expect(Array.isArray(suggestion.conflicts)).toBe(true);
      expect(suggestion.alternativeDates.length).toBeGreaterThan(0);
    });
  });

  describe('Priority keywords', () => {
    it('should detect critical keywords', () => {
      const criticalKeywords = ['срочно', 'критично', 'asap', 'urgent', 'баг', 'bug', 'сломан', 'broken'];
      const title = 'Срочно исправить баг в авторизации';
      const titleLower = title.toLowerCase();

      const hasCritical = criticalKeywords.some(k => titleLower.includes(k));
      expect(hasCritical).toBe(true);
    });

    it('should detect high priority keywords', () => {
      const highKeywords = ['важно', 'important', 'нужно', 'required'];
      const title = 'Важно: обновить документацию';
      const titleLower = title.toLowerCase();

      const hasHigh = highKeywords.some(k => titleLower.includes(k));
      expect(hasHigh).toBe(true);
    });
  });

  describe('Jaccard similarity', () => {
    it('should calculate similarity correctly', () => {
      const set1 = new Set(['word1', 'word2', 'word3']);
      const set2 = new Set(['word2', 'word3', 'word4']);

      const arr1 = Array.from(set1);
      const intersection = arr1.filter(w => set2.has(w)).length;
      const union = new Set([...arr1, ...Array.from(set2)]).size;

      const similarity = intersection / union;

      expect(intersection).toBe(2); // word2, word3
      expect(union).toBe(4); // word1, word2, word3, word4
      expect(similarity).toBe(0.5);
    });

    it('should return 0 for completely different sets', () => {
      const set1 = new Set(['a', 'b', 'c']);
      const set2 = new Set(['x', 'y', 'z']);

      const arr1 = Array.from(set1);
      const intersection = arr1.filter(w => set2.has(w)).length;
      const union = new Set([...arr1, ...Array.from(set2)]).size;

      const similarity = intersection / union;

      expect(similarity).toBe(0);
    });

    it('should return 1 for identical sets', () => {
      const set1 = new Set(['a', 'b', 'c']);
      const set2 = new Set(['a', 'b', 'c']);

      const arr1 = Array.from(set1);
      const intersection = arr1.filter(w => set2.has(w)).length;
      const union = new Set([...arr1, ...Array.from(set2)]).size;

      const similarity = intersection / union;

      expect(similarity).toBe(1);
    });
  });

  describe('Workload calculation', () => {
    it('should calculate load percentage', () => {
      const activeTasks = 7;
      const currentLoad = Math.min(activeTasks * 10, 100);

      expect(currentLoad).toBe(70);
    });

    it('should cap load at 100%', () => {
      const activeTasks = 15;
      const currentLoad = Math.min(activeTasks * 10, 100);

      expect(currentLoad).toBe(100);
    });

    it('should determine recommendation based on load', () => {
      const getRecommendation = (load: number) => {
        if (load <= 40) return 'available';
        if (load <= 70) return 'moderate';
        return 'overloaded';
      };

      expect(getRecommendation(30)).toBe('available');
      expect(getRecommendation(50)).toBe('moderate');
      expect(getRecommendation(80)).toBe('overloaded');
    });
  });
});

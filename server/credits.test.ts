import { describe, it, expect, vi } from 'vitest';
import * as aiRouter from './aiRouter';

describe('AI Router', () => {
  describe('analyzeTaskType', () => {
    it('should detect simple questions', () => {
      expect(aiRouter.analyzeTaskType('Привет')).toBe('simple');
      expect(aiRouter.analyzeTaskType('Как дела?')).toBe('simple');
      expect(aiRouter.analyzeTaskType('Что такое проект?')).toBe('simple');
    });

    it('should detect code-related questions', () => {
      expect(aiRouter.analyzeTaskType('Напиши код на Python')).toBe('code');
      expect(aiRouter.analyzeTaskType('Как исправить ошибку в JavaScript?')).toBe('code');
      expect(aiRouter.analyzeTaskType('Создай функцию для сортировки')).toBe('code');
    });

    it('should detect analysis questions', () => {
      expect(aiRouter.analyzeTaskType('Проанализируй этот текст и дай детальный разбор')).toBe('analysis');
      expect(aiRouter.analyzeTaskType('Сравни два подхода к разработке и объясни преимущества')).toBe('analysis');
      expect(aiRouter.analyzeTaskType('Исследуй рынок мобильных приложений и оцени перспективы')).toBe('analysis');
    });

    it('should detect creative questions', () => {
      expect(aiRouter.analyzeTaskType('Придумай название для стартапа')).toBe('creative');
      expect(aiRouter.analyzeTaskType('Напиши историю о роботе')).toBe('creative');
      expect(aiRouter.analyzeTaskType('Создай слоган для компании')).toBe('creative');
    });
  });

  describe('selectModel', () => {
    it('should select free model for simple questions with low credits', () => {
      const model = aiRouter.selectModel('simple', 50, true);
      expect(model.tier).toBe('free');
    });

    it('should select premium model for analysis with high credits', () => {
      const model = aiRouter.selectModel('analysis', 1000, false);
      expect(model.tier).toBe('premium');
    });

    it('should prefer free models when preferFree is true', () => {
      const model = aiRouter.selectModel('general', 1000, true);
      expect(model.tier).toBe('free');
    });

    it('should fall back to cheaper models when credits are low', () => {
      const model = aiRouter.selectModel('analysis', 10, false);
      expect(model.creditsPerRequest).toBeLessThanOrEqual(10);
    });
  });

  describe('getCreditCosts', () => {
    it('should return all tiers', () => {
      const costs = aiRouter.getCreditCosts();
      expect(costs).toHaveLength(3);
      expect(costs.map(c => c.tier)).toContain('free');
      expect(costs.map(c => c.tier)).toContain('standard');
      expect(costs.map(c => c.tier)).toContain('premium');
    });

    it('should have models in each tier', () => {
      const costs = aiRouter.getCreditCosts();
      costs.forEach(tier => {
        expect(tier.models.length).toBeGreaterThan(0);
      });
    });
  });

  describe('PLATFORM_MODELS', () => {
    it('should have required properties for each model', () => {
      aiRouter.PLATFORM_MODELS.forEach(model => {
        expect(model).toHaveProperty('id');
        expect(model).toHaveProperty('name');
        expect(model).toHaveProperty('nameRu');
        expect(model).toHaveProperty('tier');
        expect(model).toHaveProperty('creditsPerRequest');
        expect(model).toHaveProperty('isFree');
      });
    });

    it('should have free models marked correctly', () => {
      const freeModels = aiRouter.PLATFORM_MODELS.filter(m => m.tier === 'free');
      freeModels.forEach(model => {
        expect(model.isFree).toBe(true);
      });
    });
  });
});

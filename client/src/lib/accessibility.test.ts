/**
 * Tests for accessibility utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getStatusAriaLabel,
  getPriorityAriaLabel,
  getProgressAriaLabel,
  getTaskAriaLabel,
  Keys,
  isActivationKey,
  isArrowKey,
  handleListKeyDown,
  announce,
  prefersReducedMotion,
  SkipLinkTargets,
  getSkipLinkProps,
  ARIA_LABELS,
  getAriaLabel,
  getDescribedBy,
  generateA11yId,
} from './accessibility';

describe('accessibility utilities', () => {
  describe('getStatusAriaLabel', () => {
    it('returns correct label for not_started', () => {
      expect(getStatusAriaLabel('not_started')).toBe('Статус: не начато');
    });

    it('returns correct label for in_progress', () => {
      expect(getStatusAriaLabel('in_progress')).toBe('Статус: в работе');
    });

    it('returns correct label for completed', () => {
      expect(getStatusAriaLabel('completed')).toBe('Статус: завершено');
    });

    it('returns fallback for unknown status', () => {
      expect(getStatusAriaLabel('custom_status')).toBe('Статус: custom_status');
    });
  });

  describe('getPriorityAriaLabel', () => {
    it('returns correct label for critical', () => {
      expect(getPriorityAriaLabel('critical')).toBe('Приоритет: критический');
    });

    it('returns correct label for high', () => {
      expect(getPriorityAriaLabel('high')).toBe('Приоритет: высокий');
    });

    it('returns correct label for medium', () => {
      expect(getPriorityAriaLabel('medium')).toBe('Приоритет: средний');
    });

    it('returns correct label for low', () => {
      expect(getPriorityAriaLabel('low')).toBe('Приоритет: низкий');
    });

    it('returns fallback for unknown priority', () => {
      expect(getPriorityAriaLabel('urgent')).toBe('Приоритет: urgent');
    });
  });

  describe('getProgressAriaLabel', () => {
    it('calculates correct percentage', () => {
      expect(getProgressAriaLabel(5, 10)).toBe('Прогресс: 5 из 10 выполнено (50%)');
    });

    it('handles zero total', () => {
      expect(getProgressAriaLabel(0, 0)).toBe('Прогресс: 0 из 0 выполнено (0%)');
    });

    it('rounds percentage', () => {
      expect(getProgressAriaLabel(1, 3)).toBe('Прогресс: 1 из 3 выполнено (33%)');
    });
  });

  describe('getTaskAriaLabel', () => {
    it('includes title and status', () => {
      const result = getTaskAriaLabel({ title: 'Test Task', status: 'in_progress' });
      expect(result).toContain('Test Task');
      expect(result).toContain('Статус: в работе');
    });

    it('includes priority when provided', () => {
      const result = getTaskAriaLabel({ title: 'Test', status: 'not_started', priority: 'high' });
      expect(result).toContain('Приоритет: высокий');
    });

    it('includes deadline when provided', () => {
      const deadline = new Date('2024-12-25');
      const result = getTaskAriaLabel({ title: 'Test', status: 'not_started', deadline });
      expect(result).toContain('Срок:');
    });
  });

  describe('Keys', () => {
    it('contains expected key constants', () => {
      expect(Keys.ENTER).toBe('Enter');
      expect(Keys.SPACE).toBe(' ');
      expect(Keys.ESCAPE).toBe('Escape');
      expect(Keys.ARROW_UP).toBe('ArrowUp');
      expect(Keys.ARROW_DOWN).toBe('ArrowDown');
    });
  });

  describe('isActivationKey', () => {
    it('returns true for Enter', () => {
      expect(isActivationKey({ key: 'Enter' } as KeyboardEvent)).toBe(true);
    });

    it('returns true for Space', () => {
      expect(isActivationKey({ key: ' ' } as KeyboardEvent)).toBe(true);
    });

    it('returns false for other keys', () => {
      expect(isActivationKey({ key: 'a' } as KeyboardEvent)).toBe(false);
    });
  });

  describe('isArrowKey', () => {
    it('returns true for arrow keys', () => {
      expect(isArrowKey({ key: 'ArrowUp' } as KeyboardEvent)).toBe(true);
      expect(isArrowKey({ key: 'ArrowDown' } as KeyboardEvent)).toBe(true);
      expect(isArrowKey({ key: 'ArrowLeft' } as KeyboardEvent)).toBe(true);
      expect(isArrowKey({ key: 'ArrowRight' } as KeyboardEvent)).toBe(true);
    });

    it('returns false for non-arrow keys', () => {
      expect(isArrowKey({ key: 'Enter' } as KeyboardEvent)).toBe(false);
    });
  });

  describe('handleListKeyDown', () => {
    it('moves down on ArrowDown', () => {
      const onSelect = vi.fn();
      const event = { key: 'ArrowDown', preventDefault: vi.fn() } as unknown as KeyboardEvent;
      handleListKeyDown(event, 0, 5, onSelect);
      expect(onSelect).toHaveBeenCalledWith(1);
    });

    it('moves up on ArrowUp', () => {
      const onSelect = vi.fn();
      const event = { key: 'ArrowUp', preventDefault: vi.fn() } as unknown as KeyboardEvent;
      handleListKeyDown(event, 2, 5, onSelect);
      expect(onSelect).toHaveBeenCalledWith(1);
    });

    it('wraps to end on ArrowUp from first item', () => {
      const onSelect = vi.fn();
      const event = { key: 'ArrowUp', preventDefault: vi.fn() } as unknown as KeyboardEvent;
      handleListKeyDown(event, 0, 5, onSelect);
      expect(onSelect).toHaveBeenCalledWith(4);
    });

    it('wraps to start on ArrowDown from last item', () => {
      const onSelect = vi.fn();
      const event = { key: 'ArrowDown', preventDefault: vi.fn() } as unknown as KeyboardEvent;
      handleListKeyDown(event, 4, 5, onSelect);
      expect(onSelect).toHaveBeenCalledWith(0);
    });

    it('jumps to first on Home', () => {
      const onSelect = vi.fn();
      const event = { key: 'Home', preventDefault: vi.fn() } as unknown as KeyboardEvent;
      handleListKeyDown(event, 3, 5, onSelect);
      expect(onSelect).toHaveBeenCalledWith(0);
    });

    it('jumps to last on End', () => {
      const onSelect = vi.fn();
      const event = { key: 'End', preventDefault: vi.fn() } as unknown as KeyboardEvent;
      handleListKeyDown(event, 1, 5, onSelect);
      expect(onSelect).toHaveBeenCalledWith(4);
    });
  });

  describe('announce', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });

    afterEach(() => {
      const announcer = document.getElementById('aria-live-announcer');
      announcer?.remove();
    });

    it('creates announcement element', () => {
      announce('Test message');
      // Check that an element with sr-only class was added
      const elements = document.querySelectorAll('[role="status"]');
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  describe('prefersReducedMotion', () => {
    it('returns false by default in test environment', () => {
      // In test environment, window.matchMedia returns false
      expect(prefersReducedMotion()).toBe(false);
    });
  });

  describe('SkipLinkTargets', () => {
    it('contains expected targets', () => {
      expect(SkipLinkTargets.MAIN_CONTENT).toBe('main-content');
      expect(SkipLinkTargets.NAVIGATION).toBe('main-navigation');
      expect(SkipLinkTargets.SIDEBAR).toBe('sidebar');
    });
  });

  describe('getSkipLinkProps', () => {
    it('returns href with target id', () => {
      const props = getSkipLinkProps('main-content');
      expect(props.href).toBe('#main-content');
    });

    it('includes sr-only class', () => {
      const props = getSkipLinkProps('main-content');
      expect(props.className).toContain('sr-only');
    });

    it('includes focus styles', () => {
      const props = getSkipLinkProps('main-content');
      expect(props.className).toContain('focus:not-sr-only');
    });
  });

  describe('ARIA_LABELS', () => {
    it('contains navigation labels', () => {
      expect(ARIA_LABELS.close).toBe('Закрыть');
      expect(ARIA_LABELS.back).toBe('Назад');
      expect(ARIA_LABELS.menu).toBe('Меню');
    });

    it('contains action labels', () => {
      expect(ARIA_LABELS.edit).toBe('Редактировать');
      expect(ARIA_LABELS.delete).toBe('Удалить');
      expect(ARIA_LABELS.save).toBe('Сохранить');
    });

    it('contains AI labels', () => {
      expect(ARIA_LABELS.aiChat).toBe('Открыть AI чат');
      expect(ARIA_LABELS.aiGenerate).toBe('Сгенерировать с AI');
    });

    it('contains view mode labels', () => {
      expect(ARIA_LABELS.listView).toBe('Вид списком');
      expect(ARIA_LABELS.kanbanView).toBe('Канбан доска');
    });
  });

  describe('getAriaLabel', () => {
    it('returns label for key', () => {
      expect(getAriaLabel('close')).toBe('Закрыть');
    });

    it('adds context when provided', () => {
      expect(getAriaLabel('delete', 'Task 1')).toBe('Удалить: Task 1');
    });
  });

  describe('getDescribedBy', () => {
    it('returns undefined when no options', () => {
      expect(getDescribedBy('field1', {})).toBeUndefined();
    });

    it('returns hint id when hasHint', () => {
      expect(getDescribedBy('field1', { hasHint: true })).toBe('field1-hint');
    });

    it('returns error id when hasError', () => {
      expect(getDescribedBy('field1', { hasError: true })).toBe('field1-error');
    });

    it('returns both ids when both present', () => {
      expect(getDescribedBy('field1', { hasHint: true, hasError: true })).toBe('field1-hint field1-error');
    });
  });

  describe('generateA11yId', () => {
    it('generates unique ids', () => {
      const id1 = generateA11yId();
      const id2 = generateA11yId();
      expect(id1).not.toBe(id2);
    });

    it('uses custom prefix', () => {
      const id = generateA11yId('custom');
      expect(id.startsWith('custom-')).toBe(true);
    });
  });
});

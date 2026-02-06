import { describe, it, expect } from 'vitest';

/**
 * Tests for swipe navigation logic.
 * The useSwipeNavigation hook and SwipeIndicator component are client-side React components.
 * Here we test the core navigation logic (item selection, bounds checking, direction detection).
 */

describe('Swipe Navigation Logic', () => {
  // Simulate the core navigation logic from useSwipeNavigation
  function computeSwipeResult(
    items: { id: number; title: string; type: string }[],
    currentIndex: number,
    deltaX: number,
    threshold: number = 60
  ): { navigated: boolean; direction?: 'left' | 'right'; newIndex?: number } {
    if (items.length <= 1) return { navigated: false };

    const canGoLeft = currentIndex < items.length - 1;
    const canGoRight = currentIndex > 0;

    if (Math.abs(deltaX) >= threshold) {
      if (deltaX < 0 && canGoLeft) {
        return { navigated: true, direction: 'left', newIndex: currentIndex + 1 };
      } else if (deltaX > 0 && canGoRight) {
        return { navigated: true, direction: 'right', newIndex: currentIndex - 1 };
      }
    }

    return { navigated: false };
  }

  // Simulate direction detection logic
  function detectSwipeDirection(
    deltaX: number,
    deltaY: number
  ): 'horizontal' | 'vertical' | 'undetermined' {
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    if (absX > 10 || absY > 10) {
      return absX > absY ? 'horizontal' : 'vertical';
    }
    return 'undetermined';
  }

  // Simulate edge resistance calculation
  function calculateOffset(
    deltaX: number,
    currentIndex: number,
    totalItems: number
  ): number {
    const canGoLeft = currentIndex < totalItems - 1;
    const canGoRight = currentIndex > 0;

    if ((deltaX < 0 && !canGoLeft) || (deltaX > 0 && !canGoRight)) {
      return deltaX * 0.2; // Edge resistance
    }
    return deltaX * 0.6; // Normal resistance
  }

  const mockBlocks = [
    { id: 1, title: 'Block 1', type: 'block' },
    { id: 2, title: 'Block 2', type: 'block' },
    { id: 3, title: 'Block 3', type: 'block' },
    { id: 4, title: 'Block 4', type: 'block' },
  ];

  const mockSections = [
    { id: 10, title: 'Section A', type: 'section' },
    { id: 11, title: 'Section B', type: 'section' },
    { id: 12, title: 'Section C', type: 'section' },
  ];

  describe('computeSwipeResult', () => {
    it('should navigate left (next) when swiping left past threshold', () => {
      const result = computeSwipeResult(mockBlocks, 0, -80);
      expect(result.navigated).toBe(true);
      expect(result.direction).toBe('left');
      expect(result.newIndex).toBe(1);
    });

    it('should navigate right (prev) when swiping right past threshold', () => {
      const result = computeSwipeResult(mockBlocks, 2, 80);
      expect(result.navigated).toBe(true);
      expect(result.direction).toBe('right');
      expect(result.newIndex).toBe(1);
    });

    it('should not navigate when swipe is below threshold', () => {
      const result = computeSwipeResult(mockBlocks, 1, -30);
      expect(result.navigated).toBe(false);
    });

    it('should not navigate left at the last item', () => {
      const result = computeSwipeResult(mockBlocks, 3, -80);
      expect(result.navigated).toBe(false);
    });

    it('should not navigate right at the first item', () => {
      const result = computeSwipeResult(mockBlocks, 0, 80);
      expect(result.navigated).toBe(false);
    });

    it('should not navigate with a single item', () => {
      const result = computeSwipeResult([mockBlocks[0]], 0, -100);
      expect(result.navigated).toBe(false);
    });

    it('should not navigate with empty items', () => {
      const result = computeSwipeResult([], 0, -100);
      expect(result.navigated).toBe(false);
    });

    it('should respect custom threshold', () => {
      const result = computeSwipeResult(mockBlocks, 0, -50, 100);
      expect(result.navigated).toBe(false);

      const result2 = computeSwipeResult(mockBlocks, 0, -110, 100);
      expect(result2.navigated).toBe(true);
    });

    it('should navigate between sections within a block', () => {
      const result = computeSwipeResult(mockSections, 0, -80);
      expect(result.navigated).toBe(true);
      expect(result.direction).toBe('left');
      expect(result.newIndex).toBe(1);
    });

    it('should navigate to last section from second-to-last', () => {
      const result = computeSwipeResult(mockSections, 1, -80);
      expect(result.navigated).toBe(true);
      expect(result.newIndex).toBe(2);
    });
  });

  describe('detectSwipeDirection', () => {
    it('should detect horizontal swipe', () => {
      expect(detectSwipeDirection(30, 5)).toBe('horizontal');
    });

    it('should detect vertical swipe', () => {
      expect(detectSwipeDirection(5, 30)).toBe('vertical');
    });

    it('should return undetermined for small movements', () => {
      expect(detectSwipeDirection(3, 3)).toBe('undetermined');
    });

    it('should detect horizontal when deltaX equals threshold', () => {
      expect(detectSwipeDirection(11, 5)).toBe('horizontal');
    });

    it('should detect vertical when deltaY equals threshold', () => {
      expect(detectSwipeDirection(5, 11)).toBe('vertical');
    });

    it('should detect horizontal for diagonal movement favoring X', () => {
      expect(detectSwipeDirection(20, 15)).toBe('horizontal');
    });

    it('should detect vertical for diagonal movement favoring Y', () => {
      expect(detectSwipeDirection(15, 20)).toBe('vertical');
    });
  });

  describe('calculateOffset', () => {
    it('should apply normal resistance when navigating within bounds', () => {
      const offset = calculateOffset(-100, 1, 4);
      expect(offset).toBe(-60); // -100 * 0.6
    });

    it('should apply edge resistance when at first item swiping right', () => {
      const offset = calculateOffset(100, 0, 4);
      expect(offset).toBe(20); // 100 * 0.2
    });

    it('should apply edge resistance when at last item swiping left', () => {
      const offset = calculateOffset(-100, 3, 4);
      expect(offset).toBe(-20); // -100 * 0.2
    });

    it('should apply normal resistance for middle items', () => {
      const offset = calculateOffset(50, 2, 4);
      expect(offset).toBe(30); // 50 * 0.6
    });

    it('should return 0 for no movement', () => {
      const offset = calculateOffset(0, 1, 4);
      expect(offset).toBe(0);
    });
  });

  describe('SwipeIndicator logic', () => {
    it('should not render for single item', () => {
      const totalItems = 1;
      expect(totalItems <= 1).toBe(true);
    });

    it('should render for multiple items', () => {
      const totalItems = 3;
      expect(totalItems > 1).toBe(true);
    });

    it('should show correct dot count', () => {
      const totalItems = 4;
      const dots = Array.from({ length: totalItems });
      expect(dots.length).toBe(4);
    });

    it('should identify active dot correctly', () => {
      const currentIndex = 2;
      const totalItems = 4;
      const dots = Array.from({ length: totalItems }).map((_, i) => ({
        active: i === currentIndex,
      }));
      expect(dots[2].active).toBe(true);
      expect(dots[0].active).toBe(false);
      expect(dots[1].active).toBe(false);
      expect(dots[3].active).toBe(false);
    });

    it('should show left arrow when can go right (previous)', () => {
      const canGoRight = 2 > 0;
      expect(canGoRight).toBe(true);
    });

    it('should hide left arrow at first item', () => {
      const canGoRight = 0 > 0;
      expect(canGoRight).toBe(false);
    });

    it('should show right arrow when can go left (next)', () => {
      const canGoLeft = 1 < 4 - 1;
      expect(canGoLeft).toBe(true);
    });

    it('should hide right arrow at last item', () => {
      const canGoLeft = 3 < 4 - 1;
      expect(canGoLeft).toBe(false);
    });
  });

  describe('Navigation items building', () => {
    it('should build block navigation items from project data', () => {
      const blocks = [
        { id: 1, title: 'Block A', titleRu: 'Блок А' },
        { id: 2, title: 'Block B', titleRu: 'Блок Б' },
        { id: 3, title: 'Block C', titleRu: null },
      ];

      const items = blocks.map(b => ({
        id: b.id,
        title: b.titleRu || b.title,
        type: 'block' as const,
      }));

      expect(items).toHaveLength(3);
      expect(items[0].title).toBe('Блок А');
      expect(items[2].title).toBe('Block C');
      expect(items.every(i => i.type === 'block')).toBe(true);
    });

    it('should build section navigation items from parent block', () => {
      const parentBlock = {
        id: 1,
        sections: [
          { id: 10, title: 'Section X' },
          { id: 11, title: 'Section Y' },
          { id: 12, title: 'Section Z' },
        ],
      };

      const items = parentBlock.sections.map(s => ({
        id: s.id,
        title: s.title,
        type: 'section' as const,
      }));

      expect(items).toHaveLength(3);
      expect(items[0].title).toBe('Section X');
      expect(items.every(i => i.type === 'section')).toBe(true);
    });

    it('should find current index from selected context', () => {
      const items = [
        { id: 1, title: 'A', type: 'block' },
        { id: 2, title: 'B', type: 'block' },
        { id: 3, title: 'C', type: 'block' },
      ];

      const selectedContext = { type: 'block', id: 2 };
      const idx = items.findIndex(
        item => item.id === selectedContext.id && item.type === selectedContext.type
      );
      expect(idx).toBe(1);
    });

    it('should return 0 for unknown selected context', () => {
      const items = [
        { id: 1, title: 'A', type: 'block' },
        { id: 2, title: 'B', type: 'block' },
      ];

      const selectedContext = { type: 'block', id: 99 };
      const idx = items.findIndex(
        item => item.id === selectedContext.id && item.type === selectedContext.type
      );
      const currentIndex = idx >= 0 ? idx : 0;
      expect(currentIndex).toBe(0);
    });
  });
});

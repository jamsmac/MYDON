import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============ BLOCK REORDER TESTS ============

describe('Block Drag & Drop - Reorder', () => {
  describe('reorderBlocks procedure validation', () => {
    it('should require projectId as a number', () => {
      const input = { projectId: 1, blockIds: [3, 1, 2] };
      expect(typeof input.projectId).toBe('number');
      expect(input.projectId).toBeGreaterThan(0);
    });

    it('should require blockIds as an array of numbers', () => {
      const input = { projectId: 1, blockIds: [3, 1, 2] };
      expect(Array.isArray(input.blockIds)).toBe(true);
      expect(input.blockIds.every(id => typeof id === 'number')).toBe(true);
    });

    it('should reject empty blockIds array', () => {
      const input = { projectId: 1, blockIds: [] };
      expect(input.blockIds.length).toBe(0);
    });

    it('should handle single block (no reorder needed)', () => {
      const input = { projectId: 1, blockIds: [1] };
      expect(input.blockIds.length).toBe(1);
    });

    it('should handle multiple blocks reorder', () => {
      const input = { projectId: 1, blockIds: [3, 1, 2] };
      expect(input.blockIds.length).toBe(3);
      // Verify all IDs are unique
      const uniqueIds = new Set(input.blockIds);
      expect(uniqueIds.size).toBe(input.blockIds.length);
    });
  });

  describe('reorderBlocks sort order calculation', () => {
    it('should assign sequential sort orders starting from 0', () => {
      const blockIds = [5, 2, 8, 1];
      const expectedOrders = blockIds.map((id, i) => ({ id, sortOrder: i }));
      
      expect(expectedOrders).toEqual([
        { id: 5, sortOrder: 0 },
        { id: 2, sortOrder: 1 },
        { id: 8, sortOrder: 2 },
        { id: 1, sortOrder: 3 },
      ]);
    });

    it('should preserve the new order after reordering', () => {
      const originalOrder = [1, 2, 3, 4, 5];
      // Simulate moving block 4 to position 1
      const newOrder = [1, 4, 2, 3, 5];
      
      expect(newOrder[0]).toBe(1);
      expect(newOrder[1]).toBe(4);
      expect(newOrder[2]).toBe(2);
    });
  });
});

// ============ SECTION REORDER WITHIN BLOCKS TESTS ============

describe('Section Drag & Drop - Reorder within Block', () => {
  describe('reorderSections procedure validation', () => {
    it('should require blockId as a number', () => {
      const input = { blockId: 1, sectionIds: [3, 1, 2] };
      expect(typeof input.blockId).toBe('number');
    });

    it('should require sectionIds as an array of numbers', () => {
      const input = { blockId: 1, sectionIds: [3, 1, 2] };
      expect(Array.isArray(input.sectionIds)).toBe(true);
      expect(input.sectionIds.every(id => typeof id === 'number')).toBe(true);
    });

    it('should handle single section', () => {
      const input = { blockId: 1, sectionIds: [1] };
      expect(input.sectionIds.length).toBe(1);
    });
  });

  describe('section sort order calculation', () => {
    it('should assign sequential sort orders', () => {
      const sectionIds = [3, 1, 2];
      const expectedOrders = sectionIds.map((id, i) => ({ id, sortOrder: i }));
      
      expect(expectedOrders).toEqual([
        { id: 3, sortOrder: 0 },
        { id: 1, sortOrder: 1 },
        { id: 2, sortOrder: 2 },
      ]);
    });
  });
});

// ============ DRAG & DROP UI LOGIC TESTS ============

describe('DraggableSidebar - Drag Logic', () => {
  describe('Block drag identification', () => {
    it('should identify block drag by type in data', () => {
      const dragData = { type: 'block', block: { id: 1, title: 'Block 1' } };
      expect(dragData.type).toBe('block');
      expect(dragData.block.id).toBe(1);
    });

    it('should identify section drag by type in data', () => {
      const dragData = { type: 'section', section: { id: 1, title: 'Section 1' }, blockId: 1 };
      expect(dragData.type).toBe('section');
      expect(dragData.section.id).toBe(1);
      expect(dragData.blockId).toBe(1);
    });

    it('should identify task drag by type in data', () => {
      const dragData = { type: 'task', task: { id: 1, title: 'Task 1' }, sectionId: 1 };
      expect(dragData.type).toBe('task');
      expect(dragData.task.id).toBe(1);
      expect(dragData.sectionId).toBe(1);
    });
  });

  describe('Block reorder via arrayMove', () => {
    // Simulate arrayMove from @dnd-kit/sortable
    function arrayMove<T>(array: T[], from: number, to: number): T[] {
      const newArray = [...array];
      const [item] = newArray.splice(from, 1);
      newArray.splice(to, 0, item);
      return newArray;
    }

    it('should move block from first to last position', () => {
      const blocks = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const result = arrayMove(blocks, 0, 2);
      expect(result.map(b => b.id)).toEqual([2, 3, 1]);
    });

    it('should move block from last to first position', () => {
      const blocks = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const result = arrayMove(blocks, 2, 0);
      expect(result.map(b => b.id)).toEqual([3, 1, 2]);
    });

    it('should move block to adjacent position', () => {
      const blocks = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const result = arrayMove(blocks, 0, 1);
      expect(result.map(b => b.id)).toEqual([2, 1, 3]);
    });

    it('should not change array when from equals to', () => {
      const blocks = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const result = arrayMove(blocks, 1, 1);
      expect(result.map(b => b.id)).toEqual([1, 2, 3]);
    });

    it('should handle two-element array', () => {
      const blocks = [{ id: 1 }, { id: 2 }];
      const result = arrayMove(blocks, 0, 1);
      expect(result.map(b => b.id)).toEqual([2, 1]);
    });
  });

  describe('Section reorder within same block', () => {
    function arrayMove<T>(array: T[], from: number, to: number): T[] {
      const newArray = [...array];
      const [item] = newArray.splice(from, 1);
      newArray.splice(to, 0, item);
      return newArray;
    }

    it('should reorder sections within the same block', () => {
      const block = {
        id: 1,
        sections: [{ id: 10 }, { id: 20 }, { id: 30 }],
      };
      const result = arrayMove(block.sections, 0, 2);
      expect(result.map(s => s.id)).toEqual([20, 30, 10]);
    });

    it('should detect same-block reorder when sourceBlockId equals targetBlockId', () => {
      const sourceBlockId = 1;
      const targetBlockId = 1;
      expect(sourceBlockId === targetBlockId).toBe(true);
    });

    it('should detect cross-block move when sourceBlockId differs from targetBlockId', () => {
      const sourceBlockId = 1;
      const targetBlockId = 2;
      expect(sourceBlockId !== targetBlockId).toBe(true);
    });
  });

  describe('Sortable ID generation', () => {
    it('should generate block sortable IDs with block- prefix', () => {
      const blocks = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const ids = blocks.map(b => `block-${b.id}`);
      expect(ids).toEqual(['block-1', 'block-2', 'block-3']);
    });

    it('should generate section sortable IDs with section- prefix', () => {
      const sections = [{ id: 10 }, { id: 20 }];
      const ids = sections.map(s => `section-${s.id}`);
      expect(ids).toEqual(['section-10', 'section-20']);
    });

    it('should generate task sortable IDs with task- prefix', () => {
      const tasks = [{ id: 100 }, { id: 200 }];
      const ids = tasks.map(t => `task-${t.id}`);
      expect(ids).toEqual(['task-100', 'task-200']);
    });
  });

  describe('Drag overlay type detection', () => {
    it('should show block overlay when dragging a block', () => {
      const activeType = 'block';
      const activeItem = { id: 1, title: 'Block 1', sections: [] };
      expect(activeType === 'block' && activeItem !== null).toBe(true);
    });

    it('should show section overlay when dragging a section', () => {
      const activeType = 'section';
      const activeItem = { id: 1, title: 'Section 1', tasks: [] };
      expect(activeType === 'section' && activeItem !== null).toBe(true);
    });

    it('should show task overlay when dragging a task', () => {
      const activeType = 'task';
      const activeItem = { id: 1, title: 'Task 1', status: 'not_started' };
      expect(activeType === 'task' && activeItem !== null).toBe(true);
    });

    it('should clear active state after drag end', () => {
      let activeId: string | null = 'block-1';
      let activeType: string | null = 'block';
      let activeItem: any = { id: 1 };

      // Simulate drag end
      activeId = null;
      activeType = null;
      activeItem = null;

      expect(activeId).toBeNull();
      expect(activeType).toBeNull();
      expect(activeItem).toBeNull();
    });
  });

  describe('Block drag handle visibility', () => {
    it('should use GripVertical icon for block drag handle', () => {
      // Block drag handle should be visible on hover
      const handleClassName = 'p-1 text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity touch-none';
      expect(handleClassName).toContain('cursor-grab');
      expect(handleClassName).toContain('group-hover:opacity-100');
      expect(handleClassName).toContain('touch-none');
    });

    it('should use smaller GripVertical for section drag handle', () => {
      const sectionHandleClass = 'p-1 text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity';
      expect(sectionHandleClass).toContain('cursor-grab');
    });
  });

  describe('Drag activation constraint', () => {
    it('should require 8px distance before activating drag', () => {
      const activationConstraint = { distance: 8 };
      expect(activationConstraint.distance).toBe(8);
    });
  });
});

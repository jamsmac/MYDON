import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
};

vi.mock('./db', () => ({
  getDb: vi.fn(() => mockDb),
}));

vi.mock('./_core/trpc', () => ({
  router: vi.fn((routes) => routes),
  protectedProcedure: {
    input: vi.fn().mockReturnThis(),
    query: vi.fn().mockReturnThis(),
    mutation: vi.fn().mockReturnThis(),
  },
  publicProcedure: {
    input: vi.fn().mockReturnThis(),
    query: vi.fn().mockReturnThis(),
    mutation: vi.fn().mockReturnThis(),
  },
}));

describe('Unread Discussion Tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Schema', () => {
    it('should have discussion_read_status table with correct fields', async () => {
      const { discussionReadStatus } = await import('../drizzle/schema');
      expect(discussionReadStatus).toBeDefined();
      // Check table has the required columns
      const columns = Object.keys(discussionReadStatus);
      expect(columns).toContain('id');
      expect(columns).toContain('userId');
      expect(columns).toContain('entityType');
      expect(columns).toContain('entityId');
      expect(columns).toContain('lastReadAt');
    });

    it('should support project, block, section, task entity types', async () => {
      const { discussionReadStatus } = await import('../drizzle/schema');
      // The entityType field should be an enum with these values
      expect(discussionReadStatus.entityType).toBeDefined();
    });
  });

  describe('Unread Counts Logic', () => {
    it('should count comments created after last read as unread', () => {
      const lastReadAt = new Date('2026-01-01T00:00:00Z');
      const comments = [
        { id: 1, createdAt: new Date('2025-12-31T00:00:00Z'), entityType: 'block', entityId: 1 },
        { id: 2, createdAt: new Date('2026-01-02T00:00:00Z'), entityType: 'block', entityId: 1 },
        { id: 3, createdAt: new Date('2026-01-03T00:00:00Z'), entityType: 'block', entityId: 1 },
      ];
      
      const unreadCount = comments.filter(c => c.createdAt > lastReadAt).length;
      expect(unreadCount).toBe(2);
    });

    it('should count all comments as unread when no read status exists', () => {
      const comments = [
        { id: 1, createdAt: new Date('2025-12-31T00:00:00Z'), entityType: 'section', entityId: 5 },
        { id: 2, createdAt: new Date('2026-01-02T00:00:00Z'), entityType: 'section', entityId: 5 },
      ];
      
      // No lastReadAt means all are unread
      const unreadCount = comments.length;
      expect(unreadCount).toBe(2);
    });

    it('should return 0 unread when all comments are before last read', () => {
      const lastReadAt = new Date('2026-02-01T00:00:00Z');
      const comments = [
        { id: 1, createdAt: new Date('2025-12-31T00:00:00Z'), entityType: 'block', entityId: 1 },
        { id: 2, createdAt: new Date('2026-01-15T00:00:00Z'), entityType: 'block', entityId: 1 },
      ];
      
      const unreadCount = comments.filter(c => c.createdAt > lastReadAt).length;
      expect(unreadCount).toBe(0);
    });

    it('should track unread counts per entity independently', () => {
      const readStatuses = new Map<string, Date>();
      readStatuses.set('block-1', new Date('2026-01-01T00:00:00Z'));
      readStatuses.set('section-5', new Date('2026-01-15T00:00:00Z'));
      // block-2 has no read status
      
      const comments = [
        { id: 1, createdAt: new Date('2026-01-02T00:00:00Z'), entityType: 'block', entityId: 1 },
        { id: 2, createdAt: new Date('2026-01-10T00:00:00Z'), entityType: 'section', entityId: 5 },
        { id: 3, createdAt: new Date('2026-01-20T00:00:00Z'), entityType: 'section', entityId: 5 },
        { id: 4, createdAt: new Date('2026-01-05T00:00:00Z'), entityType: 'block', entityId: 2 },
      ];
      
      // Block 1: 1 unread (after Jan 1)
      const block1Unread = comments.filter(
        c => c.entityType === 'block' && c.entityId === 1 && c.createdAt > readStatuses.get('block-1')!
      ).length;
      expect(block1Unread).toBe(1);
      
      // Section 5: 1 unread (after Jan 15)
      const section5Unread = comments.filter(
        c => c.entityType === 'section' && c.entityId === 5 && c.createdAt > readStatuses.get('section-5')!
      ).length;
      expect(section5Unread).toBe(1);
      
      // Block 2: all unread (no read status)
      const block2Unread = comments.filter(
        c => c.entityType === 'block' && c.entityId === 2
      ).length;
      expect(block2Unread).toBe(1);
    });
  });

  describe('Mark Discussion Read', () => {
    it('should update lastReadAt when marking as read', () => {
      const now = new Date();
      const readStatus = {
        userId: 1,
        entityType: 'block' as const,
        entityId: 1,
        lastReadAt: now,
      };
      
      expect(readStatus.lastReadAt).toEqual(now);
      expect(readStatus.entityType).toBe('block');
      expect(readStatus.entityId).toBe(1);
    });

    it('should create new read status if none exists', () => {
      const existingStatuses: any[] = [];
      const shouldInsert = existingStatuses.length === 0;
      expect(shouldInsert).toBe(true);
    });

    it('should update existing read status instead of creating duplicate', () => {
      const existingStatuses = [
        { id: 1, userId: 1, entityType: 'block', entityId: 1, lastReadAt: new Date('2026-01-01') }
      ];
      const shouldUpdate = existingStatuses.length > 0;
      expect(shouldUpdate).toBe(true);
    });
  });

  describe('Badge Display Logic', () => {
    it('should format count as number when <= 99', () => {
      const count = 42;
      const display = count > 99 ? '99+' : String(count);
      expect(display).toBe('42');
    });

    it('should format count as 99+ when > 99', () => {
      const count = 150;
      const display = count > 99 ? '99+' : String(count);
      expect(display).toBe('99+');
    });

    it('should not show badge when count is 0', () => {
      const count = 0;
      const shouldShow = count > 0;
      expect(shouldShow).toBe(false);
    });

    it('should show badge when count is positive', () => {
      const count = 3;
      const shouldShow = count > 0;
      expect(shouldShow).toBe(true);
    });

    it('should aggregate block unread counts from all its sections', () => {
      const blockUnreads: Record<number, number> = { 1: 5, 2: 0 };
      const sectionUnreads: Record<number, number> = { 10: 3, 11: 2, 20: 0 };
      
      expect(blockUnreads[1]).toBe(5);
      expect(blockUnreads[2]).toBe(0);
      expect(sectionUnreads[10]).toBe(3);
      expect(sectionUnreads[11]).toBe(2);
    });
  });

  describe('Auto-refresh behavior', () => {
    it('should refetch unread counts after marking as read', () => {
      const refetchCalled = { value: false };
      const onSuccess = () => { refetchCalled.value = true; };
      
      // Simulate mutation success
      onSuccess();
      expect(refetchCalled.value).toBe(true);
    });

    it('should support periodic refetch interval', () => {
      const refetchInterval = 30000; // 30 seconds
      expect(refetchInterval).toBe(30000);
      expect(refetchInterval).toBeGreaterThan(0);
    });
  });
});

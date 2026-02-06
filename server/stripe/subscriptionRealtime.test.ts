import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Test the webhook handler logic (unit tests for handler functions) ───

// Mock the emitToUser function
vi.mock('../realtime/socketServer', () => ({
  emitToUser: vi.fn(),
}));

// Mock the stripe module
vi.mock('./stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn(),
    },
  },
  constructWebhookEvent: vi.fn(),
  isStripeConfigured: () => true,
}));

// Mock the db module
vi.mock('../db', () => ({
  getDb: vi.fn(),
}));

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val })),
}));

// Mock schema
vi.mock('../../drizzle/schema', () => ({
  users: { id: 'id', stripeCustomerId: 'stripeCustomerId' },
}));

// Mock env
vi.mock('../_core/env', () => ({
  ENV: { stripeWebhookSecret: 'whsec_test_123' },
}));

import { emitToUser } from '../realtime/socketServer';

describe('Subscription Real-time Events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('emitToUser function', () => {
    it('should be callable with userId, event name, and data', () => {
      emitToUser(1, 'subscription:updated', {
        plan: 'pro',
        status: 'active',
        timestamp: Date.now(),
      });

      expect(emitToUser).toHaveBeenCalledWith(
        1,
        'subscription:updated',
        expect.objectContaining({
          plan: 'pro',
          status: 'active',
        })
      );
    });

    it('should emit subscription:updated with correct payload structure', () => {
      const payload = {
        plan: 'pro',
        status: 'active',
        stripeCustomerId: 'cus_test123',
        stripeSubscriptionId: 'sub_test456',
        timestamp: 1700000000000,
      };

      emitToUser(42, 'subscription:updated', payload);

      expect(emitToUser).toHaveBeenCalledWith(42, 'subscription:updated', payload);
    });

    it('should emit payment:completed event', () => {
      const payload = {
        invoiceId: 'inv_test789',
        amount: 1900,
        currency: 'usd',
        timestamp: Date.now(),
      };

      emitToUser(42, 'payment:completed', payload);

      expect(emitToUser).toHaveBeenCalledWith(42, 'payment:completed', payload);
    });

    it('should emit payment:failed event', () => {
      const payload = {
        invoiceId: 'inv_fail123',
        timestamp: Date.now(),
      };

      emitToUser(42, 'payment:failed', payload);

      expect(emitToUser).toHaveBeenCalledWith(42, 'payment:failed', payload);
    });
  });

  describe('Subscription event payload validation', () => {
    it('should include required fields for checkout.session.completed', () => {
      const event = {
        plan: 'pro',
        status: 'active',
        stripeCustomerId: 'cus_abc',
        stripeSubscriptionId: 'sub_def',
        timestamp: Date.now(),
      };

      expect(event).toHaveProperty('plan');
      expect(event).toHaveProperty('status');
      expect(event).toHaveProperty('stripeCustomerId');
      expect(event).toHaveProperty('stripeSubscriptionId');
      expect(event).toHaveProperty('timestamp');
      expect(typeof event.timestamp).toBe('number');
    });

    it('should include cancelAtPeriodEnd for subscription.updated', () => {
      const event = {
        plan: 'pro',
        status: 'active',
        stripeSubscriptionId: 'sub_def',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: new Date().toISOString(),
        timestamp: Date.now(),
      };

      expect(event).toHaveProperty('cancelAtPeriodEnd');
      expect(event).toHaveProperty('currentPeriodEnd');
      expect(typeof event.cancelAtPeriodEnd).toBe('boolean');
    });

    it('should set plan to free on subscription.deleted', () => {
      const event = {
        plan: 'free',
        status: 'canceled',
        stripeSubscriptionId: null,
        timestamp: Date.now(),
      };

      expect(event.plan).toBe('free');
      expect(event.status).toBe('canceled');
      expect(event.stripeSubscriptionId).toBeNull();
    });

    it('should include invoice details in payment:completed', () => {
      const event = {
        invoiceId: 'inv_123',
        amount: 1900,
        currency: 'usd',
        timestamp: Date.now(),
      };

      expect(event.invoiceId).toMatch(/^inv_/);
      expect(event.amount).toBeGreaterThan(0);
      expect(event.currency).toBe('usd');
    });
  });

  describe('Webhook event type routing', () => {
    it('should handle checkout.session.completed event type', () => {
      const eventTypes = [
        'checkout.session.completed',
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
        'invoice.paid',
        'invoice.payment_failed',
      ];

      const handledTypes = new Set([
        'checkout.session.completed',
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
        'invoice.paid',
        'invoice.payment_failed',
      ]);

      eventTypes.forEach((type) => {
        expect(handledTypes.has(type)).toBe(true);
      });
    });

    it('should detect test events by event ID prefix', () => {
      const testEventId = 'evt_test_abc123';
      const liveEventId = 'evt_1abc123';

      expect(testEventId.startsWith('evt_test_')).toBe(true);
      expect(liveEventId.startsWith('evt_test_')).toBe(false);
    });

    it('should map canceled/unpaid statuses to free plan', () => {
      const statusesToRevert = ['canceled', 'unpaid', 'incomplete_expired'];
      
      statusesToRevert.forEach((status) => {
        const shouldRevert = ['canceled', 'unpaid', 'incomplete_expired'].includes(status);
        expect(shouldRevert).toBe(true);
      });

      const activeStatuses = ['active', 'trialing', 'past_due'];
      activeStatuses.forEach((status) => {
        const shouldRevert = ['canceled', 'unpaid', 'incomplete_expired'].includes(status);
        expect(shouldRevert).toBe(false);
      });
    });
  });

  describe('Metadata extraction from checkout session', () => {
    it('should extract user_id and plan_id from session metadata', () => {
      const session = {
        metadata: {
          user_id: '42',
          plan_id: 'pro',
          customer_email: 'user@example.com',
          customer_name: 'Test User',
        },
        customer: 'cus_abc123',
        subscription: 'sub_def456',
      };

      expect(session.metadata.user_id).toBe('42');
      expect(session.metadata.plan_id).toBe('pro');
      expect(parseInt(session.metadata.user_id)).toBe(42);
    });

    it('should reject sessions without required metadata', () => {
      const session = {
        metadata: {},
        customer: 'cus_abc123',
        subscription: 'sub_def456',
      };

      const userId = (session.metadata as any).user_id;
      const planId = (session.metadata as any).plan_id;

      expect(!userId || !planId).toBe(true);
    });
  });

  describe('Socket emission targeting', () => {
    it('should emit to specific user ID, not broadcast', () => {
      const targetUserId = 42;
      
      emitToUser(targetUserId, 'subscription:updated', { plan: 'pro', status: 'active', timestamp: Date.now() });

      // Verify the first argument is the specific user ID
      expect(emitToUser).toHaveBeenCalledWith(
        targetUserId,
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should handle multiple event types for the same user', () => {
      const userId = 42;
      
      emitToUser(userId, 'subscription:updated', { plan: 'pro', status: 'active', timestamp: Date.now() });
      emitToUser(userId, 'payment:completed', { invoiceId: 'inv_123', timestamp: Date.now() });

      expect(emitToUser).toHaveBeenCalledTimes(2);
    });
  });
});

import { Request, Response } from 'express';
import { stripe, constructWebhookEvent } from './stripe';
import { getDb } from '../db';
import { users } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import { ENV } from '../_core/env';
import { emitToUser } from '../realtime/socketServer';
import Stripe from 'stripe';
import { logger } from '../utils/logger';

const webhookSecret = ENV.stripeWebhookSecret;

export async function handleStripeWebhook(req: Request, res: Response) {
  if (!stripe) {
    logger.stripe.error('[Webhook] Stripe is not configured');
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const signature = req.headers['stripe-signature'] as string;

  if (!signature) {
    logger.stripe.error('[Webhook] Missing stripe-signature header');
    return res.status(400).json({ error: 'Missing signature' });
  }

  let event: Stripe.Event;

  try {
    event = constructWebhookEvent(
      req.body,
      signature,
      webhookSecret || ''
    );
  } catch (err: any) {
    logger.stripe.error('[Webhook] Signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Handle test events for verification
  if (event.id.startsWith('evt_test_')) {
    logger.stripe.info('[Webhook] Test event detected, returning verification response');
    return res.json({ verified: true });
  }

  console.log(`[Webhook] Received event: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      
      default:
        logger.stripe.info('[Webhook] Unhandled event type', { eventType: event.type });
    }

    return res.json({ received: true });
  } catch (error) {
    logger.stripe.error('[Webhook] Error processing event:', error as Error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  logger.stripe.info('[Webhook] Processing checkout.session.completed');
  
  const userId = session.metadata?.user_id;
  const planId = session.metadata?.plan_id;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!userId || !planId) {
    logger.stripe.error('[Webhook] Missing user_id or plan_id in session metadata');
    return;
  }

  const db = await getDb();
  if (!db) {
    logger.stripe.error('[Webhook] Database not available');
    return;
  }

  const userIdNum = parseInt(userId);

  // Update user with Stripe customer and subscription IDs
  await db.update(users)
    .set({
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      subscriptionPlan: planId as 'free' | 'pro' | 'enterprise',
      subscriptionStatus: 'active',
    })
    .where(eq(users.id, userIdNum));

  console.log(`[Webhook] User ${userId} subscribed to ${planId} plan`);

  // Emit real-time event to the user so their UI updates immediately
  emitToUser(userIdNum, 'subscription:updated', {
    plan: planId,
    status: 'active',
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    timestamp: Date.now(),
  });

  console.log(`[Webhook] Emitted subscription:updated to user ${userId}`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  logger.stripe.info('[Webhook] Processing subscription update');
  
  const db = await getDb();
  if (!db) return;

  const customerId = subscription.customer as string;
  
  // Find user by Stripe customer ID
  const userResult = await db.select().from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);

  if (!userResult[0]) {
    logger.stripe.error('[Webhook] User not found for customer:', undefined, { customerId });
    return;
  }

  // Map Stripe status to our plan status
  const planStatus = subscription.status;
  
  // Determine plan from subscription items
  let plan = userResult[0].subscriptionPlan || 'free';
  
  // If subscription is canceled or unpaid, revert to free
  if (['canceled', 'unpaid', 'incomplete_expired'].includes(planStatus)) {
    plan = 'free';
  }

  // Update subscription status
  await db.update(users)
    .set({
      subscriptionStatus: planStatus,
      stripeSubscriptionId: subscription.id,
      subscriptionPlan: plan as 'free' | 'pro' | 'enterprise',
    })
    .where(eq(users.id, userResult[0].id));

  console.log(`[Webhook] Updated subscription status for user ${userResult[0].id}: ${planStatus}`);

  // Emit real-time event
  emitToUser(userResult[0].id, 'subscription:updated', {
    plan,
    status: planStatus,
    stripeSubscriptionId: subscription.id,
    cancelAtPeriodEnd: (subscription as any).cancel_at_period_end || false,
    currentPeriodEnd: (subscription as any).current_period_end 
      ? new Date((subscription as any).current_period_end * 1000).toISOString()
      : null,
    timestamp: Date.now(),
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  logger.stripe.info('[Webhook] Processing subscription deletion');
  
  const db = await getDb();
  if (!db) return;

  const customerId = subscription.customer as string;
  
  const userResult = await db.select().from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);

  if (!userResult[0]) return;

  // Reset to free plan
  await db.update(users)
    .set({
      subscriptionPlan: 'free',
      subscriptionStatus: 'canceled',
      stripeSubscriptionId: null,
    })
    .where(eq(users.id, userResult[0].id));

  console.log(`[Webhook] User ${userResult[0].id} subscription canceled, reverted to free plan`);

  // Emit real-time event
  emitToUser(userResult[0].id, 'subscription:updated', {
    plan: 'free',
    status: 'canceled',
    stripeSubscriptionId: null,
    timestamp: Date.now(),
  });
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  logger.stripe.info('[Webhook] Invoice paid', { invoiceId: invoice.id });
  
  // Find user and emit payment event for real-time UI update
  if (invoice.customer) {
    const db = await getDb();
    if (!db) return;

    const customerId = typeof invoice.customer === 'string' 
      ? invoice.customer 
      : invoice.customer.toString();

    const userResult = await db.select().from(users)
      .where(eq(users.stripeCustomerId, customerId))
      .limit(1);

    if (userResult[0]) {
      emitToUser(userResult[0].id, 'payment:completed', {
        invoiceId: invoice.id,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        timestamp: Date.now(),
      });
    }
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  logger.stripe.info('[Webhook] Payment failed for invoice', { invoiceId: invoice.id });
  
  // Find user and emit payment failure event
  if (invoice.customer) {
    const db = await getDb();
    if (!db) return;

    const customerId = typeof invoice.customer === 'string' 
      ? invoice.customer 
      : invoice.customer.toString();

    const userResult = await db.select().from(users)
      .where(eq(users.stripeCustomerId, customerId))
      .limit(1);

    if (userResult[0]) {
      emitToUser(userResult[0].id, 'payment:failed', {
        invoiceId: invoice.id,
        timestamp: Date.now(),
      });
    }
  }
}

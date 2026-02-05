import { Request, Response } from 'express';
import { stripe, constructWebhookEvent } from './stripe';
import { getDb } from '../db';
import { users } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function handleStripeWebhook(req: Request, res: Response) {
  if (!stripe) {
    console.error('[Webhook] Stripe is not configured');
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const signature = req.headers['stripe-signature'] as string;

  if (!signature) {
    console.error('[Webhook] Missing stripe-signature header');
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
    console.error('[Webhook] Signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Handle test events for verification
  if (event.id.startsWith('evt_test_')) {
    console.log('[Webhook] Test event detected, returning verification response');
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
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    return res.json({ received: true });
  } catch (error) {
    console.error('[Webhook] Error processing event:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log('[Webhook] Processing checkout.session.completed');
  
  const userId = session.metadata?.user_id;
  const planId = session.metadata?.plan_id;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!userId || !planId) {
    console.error('[Webhook] Missing user_id or plan_id in session metadata');
    return;
  }

  const db = await getDb();
  if (!db) {
    console.error('[Webhook] Database not available');
    return;
  }

  // Update user with Stripe customer and subscription IDs
  await db.update(users)
    .set({
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      subscriptionPlan: planId as 'free' | 'pro' | 'enterprise',
      subscriptionStatus: 'active',
    })
    .where(eq(users.id, parseInt(userId)));

  console.log(`[Webhook] User ${userId} subscribed to ${planId} plan`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('[Webhook] Processing subscription update');
  
  const db = await getDb();
  if (!db) return;

  const customerId = subscription.customer as string;
  
  // Find user by Stripe customer ID
  const userResult = await db.select().from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);

  if (!userResult[0]) {
    console.error('[Webhook] User not found for customer:', customerId);
    return;
  }

  // Update subscription status
  await db.update(users)
    .set({
      subscriptionStatus: subscription.status,
      stripeSubscriptionId: subscription.id,
    })
    .where(eq(users.id, userResult[0].id));

  console.log(`[Webhook] Updated subscription status for user ${userResult[0].id}: ${subscription.status}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('[Webhook] Processing subscription deletion');
  
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
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  console.log('[Webhook] Invoice paid:', invoice.id);
  // Additional logic for invoice tracking if needed
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log('[Webhook] Payment failed for invoice:', invoice.id);
  // Could send notification to user about failed payment
}

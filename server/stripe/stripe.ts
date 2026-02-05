import Stripe from 'stripe';

// Initialize Stripe with secret key
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.warn('[Stripe] STRIPE_SECRET_KEY not configured. Stripe features will be disabled.');
}

export const stripe = stripeSecretKey 
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2026-01-28.clover',
    })
  : null;

export function isStripeConfigured(): boolean {
  return !!stripe;
}

// Create a checkout session for subscription
export async function createCheckoutSession({
  userId,
  userEmail,
  userName,
  priceId,
  planId,
  origin,
}: {
  userId: number;
  userEmail: string;
  userName: string;
  priceId: string;
  planId: string;
  origin: string;
}): Promise<{ url: string; sessionId: string } | null> {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    customer_email: userEmail,
    client_reference_id: userId.toString(),
    metadata: {
      user_id: userId.toString(),
      customer_email: userEmail,
      customer_name: userName,
      plan_id: planId,
    },
    success_url: `${origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pricing?canceled=true`,
    allow_promotion_codes: true,
  });

  return {
    url: session.url!,
    sessionId: session.id,
  };
}

// Create a portal session for subscription management
export async function createPortalSession({
  customerId,
  origin,
}: {
  customerId: string;
  origin: string;
}): Promise<{ url: string } | null> {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/settings`,
  });

  return { url: session.url };
}

// Get subscription details
export async function getSubscription(subscriptionId: string): Promise<Stripe.Subscription | null> {
  if (!stripe) return null;
  
  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error) {
    console.error('[Stripe] Error retrieving subscription:', error);
    return null;
  }
}

// Cancel subscription
export async function cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription | null> {
  if (!stripe) return null;
  
  try {
    return await stripe.subscriptions.cancel(subscriptionId);
  } catch (error) {
    console.error('[Stripe] Error canceling subscription:', error);
    return null;
  }
}

// Verify webhook signature
export function constructWebhookEvent(
  payload: Buffer,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }
  
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

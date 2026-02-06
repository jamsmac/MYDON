import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../_core/trpc';
import { 
  stripe, 
  isStripeConfigured, 
  createCheckoutSession, 
  createPortalSession,
  getSubscription,
  cancelSubscription 
} from './stripe';
import { SUBSCRIPTION_PLANS } from './products';
import { getDb } from '../db';
import { users } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

export const stripeRouter = router({
  // Get available plans
  getPlans: publicProcedure.query(() => {
    return SUBSCRIPTION_PLANS;
  }),

  // Check if Stripe is configured
  isConfigured: publicProcedure.query(() => {
    return isStripeConfigured();
  }),

  // Create checkout session for subscription
  createCheckoutSession: protectedProcedure
    .input(z.object({
      planId: z.string(),
      billingPeriod: z.enum(['monthly', 'yearly']),
      origin: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!stripe) {
        throw new Error('Stripe is not configured. Please add your Stripe API keys in Settings → Payment.');
      }

      const plan = SUBSCRIPTION_PLANS.find(p => p.id === input.planId);
      if (!plan) {
        throw new Error('Invalid plan selected');
      }

      if (plan.id === 'free') {
        throw new Error('Cannot checkout for free plan');
      }

      // Get or create price ID
      const priceId = input.billingPeriod === 'yearly' 
        ? plan.stripePriceIdYearly 
        : plan.stripePriceIdMonthly;

      // If no price ID configured, create a dynamic price
      let finalPriceId = priceId;
      
      if (!finalPriceId) {
        // Create a product and price on the fly (for testing)
        const product = await stripe.products.create({
          name: `MYDON ${plan.name} Plan`,
          description: plan.description,
        });

        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: (input.billingPeriod === 'yearly' ? plan.priceYearly : plan.priceMonthly) * 100,
          currency: 'usd',
          recurring: {
            interval: input.billingPeriod === 'yearly' ? 'year' : 'month',
          },
        });

        finalPriceId = price.id;
      }

      const session = await createCheckoutSession({
        userId: ctx.user.id,
        userEmail: ctx.user.email || '',
        userName: ctx.user.name || '',
        priceId: finalPriceId,
        planId: input.planId,
        origin: input.origin,
      });

      return session;
    }),

  // Create portal session for managing subscription
  createPortalSession: protectedProcedure
    .input(z.object({
      origin: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!stripe) {
        throw new Error('Stripe is not configured');
      }

      const db = await getDb();
      if (!db) {
        throw new Error('Database not available');
      }
      
      const userResult = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);

      if (!userResult[0]?.stripeCustomerId) {
        throw new Error('No subscription found. Please subscribe first.');
      }

      const session = await createPortalSession({
        customerId: userResult[0].stripeCustomerId,
        origin: input.origin,
      });

      return session;
    }),

  // Get current subscription status
  getSubscriptionStatus: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      return {
        status: 'inactive',
        plan: 'free',
        currentPeriodEnd: null,
      };
    }
    
    const user = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);

    if (!user[0]?.stripeSubscriptionId) {
      return {
        status: 'inactive',
        plan: 'free',
        currentPeriodEnd: null,
      };
    }

    const subscription = await getSubscription(user[0].stripeSubscriptionId);
    
    if (!subscription) {
      return {
        status: 'inactive',
        plan: 'free',
        currentPeriodEnd: null,
      };
    }

    return {
      status: subscription.status,
      plan: user[0].subscriptionPlan || 'free',
      currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
      cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
    };
  }),

  // Cancel subscription
  cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }
    
    const user = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);

    if (!user[0]?.stripeSubscriptionId) {
      throw new Error('No active subscription found');
    }

    const subscription = await cancelSubscription(user[0].stripeSubscriptionId);
    
    if (!subscription) {
      throw new Error('Failed to cancel subscription');
    }

    // Update user's subscription status
    await db.update(users)
      .set({ 
        subscriptionPlan: 'free',
        stripeSubscriptionId: null,
      })
      .where(eq(users.id, ctx.user.id));

    return { success: true };
  }),

  // Get payment history (invoices from Stripe)
  getPaymentHistory: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      startingAfter: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      if (!stripe) {
        return { invoices: [], hasMore: false };
      }

      const db = await getDb();
      if (!db) {
        return { invoices: [], hasMore: false };
      }

      const user = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      
      if (!user[0]?.stripeCustomerId) {
        return { invoices: [], hasMore: false };
      }

      try {
        const params: any = {
          customer: user[0].stripeCustomerId,
          limit: input?.limit ?? 20,
        };

        if (input?.startingAfter) {
          params.starting_after = input.startingAfter;
        }

        const invoices = await stripe.invoices.list(params);

        return {
          invoices: invoices.data.map((inv) => ({
            id: inv.id,
            number: inv.number,
            status: inv.status,
            amount: inv.amount_paid,
            currency: inv.currency,
            description: inv.description || inv.lines?.data?.[0]?.description || 'Subscription payment',
            created: new Date(inv.created * 1000),
            periodStart: inv.period_start ? new Date(inv.period_start * 1000) : null,
            periodEnd: inv.period_end ? new Date(inv.period_end * 1000) : null,
            pdfUrl: inv.invoice_pdf,
            hostedUrl: inv.hosted_invoice_url,
          })),
          hasMore: invoices.has_more,
        };
      } catch (error) {
        console.error('[Stripe] Error fetching payment history:', error);
        return { invoices: [], hasMore: false };
      }
    }),

  // Get upcoming invoice (next payment)
  getUpcomingInvoice: protectedProcedure.query(async ({ ctx }) => {
    if (!stripe) {
      return null;
    }

    const db = await getDb();
    if (!db) return null;

    const user = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
    
    if (!user[0]?.stripeCustomerId || !user[0]?.stripeSubscriptionId) {
      return null;
    }

    try {
      const invoice = await stripe.invoices.createPreview({
        customer: user[0].stripeCustomerId,
        subscription: user[0].stripeSubscriptionId,
      });

      return {
        amount: invoice.amount_due,
        currency: invoice.currency,
        dueDate: invoice.next_payment_attempt 
          ? new Date(invoice.next_payment_attempt * 1000) 
          : null,
        description: invoice.lines?.data?.[0]?.description || 'Upcoming payment',
      };
    } catch (error) {
      console.error('[Stripe] Error fetching upcoming invoice:', error);
      return null;
    }
  }),
});

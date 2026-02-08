import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { checkRateLimit, type RateLimitCategory } from "../middleware/rateLimit";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

// Rate limiting middleware factory
const createRateLimitMiddleware = (category: RateLimitCategory = "default") =>
  t.middleware(async ({ ctx, next }) => {
    // Use user ID if authenticated, otherwise use a generic identifier
    const identifier = ctx.user?.id ? `user:${ctx.user.id}` : "anonymous";
    const result = checkRateLimit(identifier, category);

    if (!result.allowed) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Слишком много запросов. Пожалуйста, подождите.",
      });
    }

    return next();
  });

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

// Default rate limiting for public procedures
const defaultRateLimit = createRateLimitMiddleware("default");

// Apply rate limiting to all protected procedures
export const protectedProcedure = t.procedure
  .use(defaultRateLimit)
  .use(requireUser);

// AI-specific rate limiting (more restrictive)
export const aiProcedure = t.procedure
  .use(createRateLimitMiddleware("ai"))
  .use(requireUser);

// Mutation-specific rate limiting
export const mutationProcedure = t.procedure
  .use(createRateLimitMiddleware("mutation"))
  .use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

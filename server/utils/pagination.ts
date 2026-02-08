/**
 * Shared pagination utilities for tRPC endpoints
 *
 * Provides:
 * - Zod schemas for pagination input/output
 * - Helper functions for paginated queries
 * - Consistent pagination response format
 */

import { z } from "zod";

// Default pagination settings
export const PAGINATION_DEFAULTS = {
  page: 1,
  pageSize: 20,
  maxPageSize: 100,
};

/**
 * Zod schema for pagination input parameters
 */
export const paginationInputSchema = z.object({
  page: z.number().int().min(1).default(PAGINATION_DEFAULTS.page),
  pageSize: z.number().int().min(1).max(PAGINATION_DEFAULTS.maxPageSize).default(PAGINATION_DEFAULTS.pageSize),
});

export type PaginationInput = z.infer<typeof paginationInputSchema>;

/**
 * Pagination metadata in response
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
  hasPrevious: boolean;
}

/**
 * Generic paginated response type
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

/**
 * Calculate pagination metadata from query results
 */
export function createPaginationMeta(
  page: number,
  pageSize: number,
  total: number
): PaginationMeta {
  const totalPages = Math.ceil(total / pageSize);
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasMore: page < totalPages,
    hasPrevious: page > 1,
  };
}

/**
 * Calculate SQL offset from page and pageSize
 */
export function calculateOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

/**
 * Helper to create a paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  pageSize: number,
  total: number
): PaginatedResponse<T> {
  return {
    data,
    pagination: createPaginationMeta(page, pageSize, total),
  };
}

/**
 * Optional pagination input schema (allows endpoints to work without pagination)
 */
export const optionalPaginationInputSchema = paginationInputSchema.partial();

export type OptionalPaginationInput = z.infer<typeof optionalPaginationInputSchema>;

/**
 * Apply pagination defaults to optional input
 */
export function applyPaginationDefaults(input?: OptionalPaginationInput): PaginationInput {
  return {
    page: input?.page ?? PAGINATION_DEFAULTS.page,
    pageSize: input?.pageSize ?? PAGINATION_DEFAULTS.pageSize,
  };
}

/**
 * Create a Zod schema for paginated response output
 * Usage: createPaginatedOutputSchema(taskSchema)
 */
export function createPaginatedOutputSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    pagination: z.object({
      page: z.number(),
      pageSize: z.number(),
      total: z.number(),
      totalPages: z.number(),
      hasMore: z.boolean(),
      hasPrevious: z.boolean(),
    }),
  });
}

/**
 * Development-only route utilities
 *
 * Provides:
 * - Environment-based route inclusion
 * - Development-only component wrapper
 */

/**
 * Check if we're in development mode
 */
export const isDevelopment = import.meta.env.DEV;

/**
 * Check if we're in production mode
 */
export const isProduction = import.meta.env.PROD;

/**
 * Development-only routes that should not be accessible in production
 * Add route paths here to exclude them in production
 */
export const DEV_ONLY_ROUTES = [
  "/component-showcase",
  "/debug",
  "/test-page",
] as const;

/**
 * Check if a route should be accessible in current environment
 */
export function isRouteAccessible(path: string): boolean {
  if (isDevelopment) return true;
  return !DEV_ONLY_ROUTES.some((devRoute) => path.startsWith(devRoute));
}

/**
 * Higher-order component that only renders in development
 */
export function devOnly<T extends object>(
  Component: React.ComponentType<T>
): React.ComponentType<T> | (() => null) {
  if (isDevelopment) {
    return Component;
  }
  return () => null;
}

/**
 * Wrapper component that only renders children in development
 */
export function DevOnly({ children }: { children: React.ReactNode }): React.ReactNode {
  if (isDevelopment) {
    return children;
  }
  return null;
}

/**
 * Feature flags for development features
 */
export const DEV_FEATURES = {
  showDebugPanel: isDevelopment,
  showComponentShowcase: isDevelopment,
  showApiDocs: true, // API docs might be needed in production for developers
  enableMockData: isDevelopment && import.meta.env.VITE_USE_MOCK_DATA === "true",
  enableVerboseLogging: isDevelopment,
} as const;

/**
 * CSRF (Cross-Site Request Forgery) protection middleware
 *
 * Uses double-submit cookie pattern:
 * 1. Server generates a random token and sends it as a cookie
 * 2. Client must include the token in a header for state-changing requests
 * 3. Server verifies the header matches the cookie
 */

import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

const CSRF_COOKIE_NAME = "__csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";
const TOKEN_LENGTH = 32;

// Methods that require CSRF protection (state-changing operations)
const PROTECTED_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Paths that are exempt from CSRF protection (webhooks, public APIs)
const EXEMPT_PATHS = [
  "/api/stripe/webhook",
  "/api/oauth/callback",
  "/api/ical/",
  "/api/webhook/",
  "/api/restapi/",
];

/**
 * Generate a cryptographically secure random token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(TOKEN_LENGTH).toString("hex");
}

/**
 * Set CSRF cookie on response
 */
export function setCsrfCookie(res: Response, token: string, isSecure: boolean): void {
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Must be readable by JavaScript
    secure: isSecure,
    sameSite: "strict",
    path: "/",
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });
}

/**
 * Check if request path is exempt from CSRF protection
 */
function isExemptPath(path: string): boolean {
  return EXEMPT_PATHS.some(exempt => path.startsWith(exempt));
}

/**
 * Check if request is coming from same origin
 * This is an additional layer of protection
 */
function isSameOrigin(req: Request): boolean {
  const origin = req.get("origin");
  const referer = req.get("referer");

  // If no origin/referer, it's likely a same-origin request from a form or fetch
  if (!origin && !referer) {
    return true;
  }

  const host = req.get("host");
  if (!host) return false;

  // Check origin header
  if (origin) {
    try {
      const originUrl = new URL(origin);
      const hostParts = host.split(":");
      return originUrl.hostname === hostParts[0];
    } catch {
      return false;
    }
  }

  // Check referer header
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const hostParts = host.split(":");
      return refererUrl.hostname === hostParts[0];
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * CSRF protection middleware
 *
 * For GET requests: Sets CSRF cookie if not present
 * For protected methods: Validates CSRF token from header matches cookie
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  const isSecure = req.protocol === "https" || req.get("x-forwarded-proto") === "https";

  // Get or generate CSRF token
  let csrfToken = req.cookies?.[CSRF_COOKIE_NAME];

  if (!csrfToken) {
    csrfToken = generateCsrfToken();
    setCsrfCookie(res, csrfToken, isSecure);
  }

  // Attach token to request for use in responses
  (req as any).csrfToken = csrfToken;

  // Skip validation for safe methods
  if (!PROTECTED_METHODS.has(req.method)) {
    return next();
  }

  // Skip validation for exempt paths
  if (isExemptPath(req.path)) {
    return next();
  }

  // Validate CSRF token
  const headerToken = req.get(CSRF_HEADER_NAME);

  if (!headerToken || headerToken !== csrfToken) {
    // Additional same-origin check as fallback
    if (!isSameOrigin(req)) {
      res.status(403).json({
        error: "CSRF token mismatch",
        code: "CSRF_VALIDATION_FAILED",
        message: "Недействительный CSRF токен. Пожалуйста, обновите страницу.",
      });
      return;
    }
  }

  next();
}

/**
 * Endpoint to get CSRF token for client-side use
 * Client should call this on page load and include token in subsequent requests
 */
export function getCsrfTokenHandler(req: Request, res: Response): void {
  const isSecure = req.protocol === "https" || req.get("x-forwarded-proto") === "https";
  let csrfToken = req.cookies?.[CSRF_COOKIE_NAME];

  if (!csrfToken) {
    csrfToken = generateCsrfToken();
    setCsrfCookie(res, csrfToken, isSecure);
  }

  res.json({ csrfToken });
}

/**
 * Helper to create headers with CSRF token for fetch requests
 */
export function createCsrfHeaders(csrfToken: string): Record<string, string> {
  return {
    [CSRF_HEADER_NAME]: csrfToken,
  };
}

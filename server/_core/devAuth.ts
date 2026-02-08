/**
 * Development Authentication
 *
 * Provides local authentication for development without external OAuth.
 * ONLY enabled when NODE_ENV !== 'production'
 */

import { COOKIE_NAME, DEV_SESSION_TTL_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { ENV } from "./env";
import { logger } from "../utils/logger";
import { expressRateLimitMiddleware } from "../middleware/rateLimit";

// Demo users for development
const DEV_USERS = [
  { id: "dev-admin", name: "Admin User", email: "admin@localhost", role: "admin" as const },
  { id: "dev-user-1", name: "Test User", email: "user@localhost", role: "user" as const },
  { id: "dev-user-2", name: "Demo User", email: "demo@localhost", role: "user" as const },
];

/**
 * Register development authentication routes
 * Only active in non-production environments
 */
export function registerDevAuthRoutes(app: Express) {
  if (ENV.isProduction) {
    logger.auth.info("DevAuth disabled in production mode");
    return;
  }

  logger.auth.info("Development authentication enabled");

  // Dev login page
  app.get("/dev/login", (_req: Request, res: Response) => {
    const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MYDON - Dev Login</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: #1e293b;
      border-radius: 16px;
      padding: 40px;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      border: 1px solid #334155;
    }
    h1 {
      color: #f59e0b;
      font-size: 28px;
      margin-bottom: 8px;
      text-align: center;
    }
    .subtitle {
      color: #94a3b8;
      text-align: center;
      margin-bottom: 32px;
      font-size: 14px;
    }
    .dev-badge {
      background: #dc2626;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      margin-left: 8px;
    }
    .users-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .user-card {
      background: #334155;
      border: 1px solid #475569;
      border-radius: 12px;
      padding: 16px;
      cursor: pointer;
      transition: all 0.2s;
      text-decoration: none;
    }
    .user-card:hover {
      background: #3b5998;
      border-color: #f59e0b;
      transform: translateY(-2px);
    }
    .user-name {
      color: #f1f5f9;
      font-weight: 600;
      font-size: 16px;
      margin-bottom: 4px;
    }
    .user-email {
      color: #94a3b8;
      font-size: 13px;
    }
    .user-role {
      display: inline-block;
      background: #475569;
      color: #e2e8f0;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      margin-top: 8px;
    }
    .user-role.admin {
      background: #f59e0b;
      color: #1e293b;
    }
    .divider {
      border-top: 1px solid #334155;
      margin: 24px 0;
    }
    .custom-login h3 {
      color: #e2e8f0;
      font-size: 14px;
      margin-bottom: 12px;
    }
    input {
      width: 100%;
      padding: 12px;
      border: 1px solid #475569;
      border-radius: 8px;
      background: #0f172a;
      color: #f1f5f9;
      font-size: 14px;
      margin-bottom: 12px;
    }
    input:focus {
      outline: none;
      border-color: #f59e0b;
    }
    button {
      width: 100%;
      padding: 12px;
      background: #f59e0b;
      color: #1e293b;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover {
      background: #d97706;
    }
    .warning {
      background: #7c2d12;
      border: 1px solid #dc2626;
      color: #fecaca;
      padding: 12px;
      border-radius: 8px;
      font-size: 12px;
      margin-top: 24px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>MYDON <span class="dev-badge">DEV</span></h1>
    <p class="subtitle">Выберите пользователя для входа</p>

    <div class="users-list">
      ${DEV_USERS.map(user => `
        <a href="/dev/auth?userId=${user.id}" class="user-card">
          <div class="user-name">${user.name}</div>
          <div class="user-email">${user.email}</div>
          <span class="user-role ${user.role}">${user.role === 'admin' ? 'Администратор' : 'Пользователь'}</span>
        </a>
      `).join('')}
    </div>

    <div class="divider"></div>

    <div class="custom-login">
      <h3>Или создайте своего пользователя:</h3>
      <form action="/dev/auth" method="GET">
        <input type="text" name="name" placeholder="Имя" required />
        <input type="email" name="email" placeholder="Email" required />
        <button type="submit">Войти</button>
      </form>
    </div>

    <div class="warning">
      ⚠️ Режим разработки. Не использовать в production!
    </div>
  </div>
</body>
</html>
    `;
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  });

  // Dev authentication endpoint with rate limiting
  app.get("/dev/auth", expressRateLimitMiddleware("auth"), async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string | undefined;
      const name = req.query.name as string | undefined;
      const email = req.query.email as string | undefined;

      let user: { id: string; name: string; email: string; role: "admin" | "user" };

      if (userId) {
        // Use predefined dev user
        const devUser = DEV_USERS.find(u => u.id === userId);
        if (!devUser) {
          res.status(400).json({ error: "Invalid dev user ID" });
          return;
        }
        user = devUser;
      } else if (name && email) {
        // Create custom user
        const openId = `dev-custom-${Date.now()}`;
        user = { id: openId, name, email, role: "user" };
      } else {
        res.status(400).json({ error: "userId or (name + email) required" });
        return;
      }

      // Create/update user in database
      await db.upsertUser({
        openId: user.id,
        name: user.name,
        email: user.email,
        loginMethod: "dev",
        role: user.role,
        lastSignedIn: new Date(),
      });

      // Create session token
      const sessionToken = await sdk.createSessionToken(user.id, {
        name: user.name,
        expiresInMs: DEV_SESSION_TTL_MS,
      });

      // Set session cookie
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: DEV_SESSION_TTL_MS });

      logger.auth.info("User logged in", { userName: user.name, oderId: user.id });

      // Redirect to home
      res.redirect(302, "/");
    } catch (error) {
      logger.auth.error("Authentication failed", error as Error);
      res.status(500).json({ error: "Dev authentication failed" });
    }
  });

  // Dev logout endpoint
  app.get("/dev/logout", (_req: Request, res: Response) => {
    res.clearCookie(COOKIE_NAME);
    res.redirect(302, "/dev/login");
  });
}

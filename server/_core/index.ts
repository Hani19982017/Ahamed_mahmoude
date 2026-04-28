import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import fs from "node:fs";
import path from "node:path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { authenticateLocalCredentials, authenticateManagerCredentials } from "./localAuth";
import { MANAGER_LOGIN_EMAIL } from "./managerLogin";
import { sdk } from "./sdk";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./cookies";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function createAuthenticatedSession(res: express.Response, req: express.Request, user: { openId: string; id: number; name: string | null; username: string | null; role: string; branchId: number | null; }) {
  const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || user.username || '' });
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
  return res.json({ success: true, user: { id: user.id, name: user.name, role: user.role, branchId: user.branchId } });
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Serve uploaded files (used by the local storage fallback in storage.ts)
  // when running without Manus Forge credentials.
  const uploadsDir = path.resolve(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use("/uploads", express.static(uploadsDir));

  registerOAuthRoutes(app);

  app.get('/api/auth/admin-login', async (_req, res) => {
    return res.redirect('/login');
  });

  app.post('/api/auth/admin-login', async (req, res) => {
    try {
      // Rate limit: 10 attempts per 15 min per IP to slow down brute-force attempts.
      const { consumeRateLimit } = await import('./rateLimit');
      const ip = (req.ip || req.socket.remoteAddress || 'unknown').toString();
      const rate = consumeRateLimit(`admin-login:${ip}`, { max: 10, windowMs: 15 * 60 * 1000 });
      if (!rate.allowed) {
        const minutes = Math.ceil(rate.retryAfterMs / 60000);
        return res.status(429).json({ error: `Zu viele Anmeldeversuche. Bitte versuchen Sie es in ${minutes} Minute(n) erneut.` });
      }

      const result = await authenticateManagerCredentials(req.body ?? {});
      if (!result.success || !result.user) {
        return res.status(result.status).json({ error: result.error ?? 'Manager-Anmeldung fehlgeschlagen' });
      }

      return createAuthenticatedSession(res, req, {
        openId: result.user.openId,
        id: result.user.id,
        name: result.user.name,
        username: result.user.username,
        role: result.user.role,
        branchId: result.user.branchId,
      });
    } catch (e: any) {
      console.error('[AdminLocalLogin] Error:', e);
      return res.status(500).json({ error: `Interner Serverfehler für ${MANAGER_LOGIN_EMAIL}` });
    }
  });

  app.post('/api/auth/local-login', async (req, res) => {
    try {
      // Rate limit: 10 attempts per 15 min per IP.
      const { consumeRateLimit } = await import('./rateLimit');
      const ip = (req.ip || req.socket.remoteAddress || 'unknown').toString();
      const rate = consumeRateLimit(`staff-login:${ip}`, { max: 10, windowMs: 15 * 60 * 1000 });
      if (!rate.allowed) {
        const minutes = Math.ceil(rate.retryAfterMs / 60000);
        return res.status(429).json({ error: `Zu viele Anmeldeversuche. Bitte versuchen Sie es in ${minutes} Minute(n) erneut.` });
      }

      const result = await authenticateLocalCredentials(req.body ?? {});
      if (!result.success || !result.user) {
        return res.status(result.status).json({ error: result.error ?? 'Anmeldung fehlgeschlagen' });
      }

      return createAuthenticatedSession(res, req, {
        openId: result.user.openId,
        id: result.user.id,
        name: result.user.name,
        username: result.user.username,
        role: result.user.role,
        branchId: result.user.branchId,
      });
    } catch (e: any) {
      console.error('[LocalLogin] Error:', e);
      return res.status(500).json({ error: 'Interner Serverfehler' });
    }
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // In production (Render, Railway, etc.) the platform assigns $PORT and expects
  // the server to bind to that exact port on 0.0.0.0. In development we fall back
  // to port scanning so multiple dev servers can run in parallel.
  const preferredPort = parseInt(process.env.PORT || "3000");
  const isProduction = process.env.NODE_ENV === "production";
  const port = isProduction ? preferredPort : await findAvailablePort(preferredPort);

  if (!isProduction && port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Bind to 0.0.0.0 in production so the host platform can reach the server.
  const host = isProduction ? "0.0.0.0" : "localhost";
  server.listen(port, host, () => {
    console.log(`Server running on http://${host}:${port}/`);
    console.log(`[Boot] Auth endpoints registered:`);
    console.log(`  POST http://${host}:${port}/api/auth/admin-login`);
    console.log(`  POST http://${host}:${port}/api/auth/local-login`);
    console.log(`[Boot] Static uploads served from: ${uploadsDir}`);
  });
}

startServer().catch(console.error);

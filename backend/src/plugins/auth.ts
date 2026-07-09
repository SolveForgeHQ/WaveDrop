import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import fastifyOAuth2 from "@fastify/oauth2";
import fastifyCookie from "@fastify/cookie";
import fastifySession from "@fastify/session";

declare module "@fastify/session" {
  interface SessionData {
    contributorId?: string;
    githubLogin?:   string;
  }
}

async function authPlugin(app: FastifyInstance) {
  await app.register(fastifyCookie);

  await app.register(fastifySession, {
    secret:      process.env["SESSION_SECRET"] ?? "change-this-in-production-min-32-chars!!",
    cookieName:  "wavedrop_session",
    cookie: {
      secure:   process.env["NODE_ENV"] === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge:   7 * 24 * 60 * 60, // 7 days in seconds
    },
  });

  await app.register(fastifyOAuth2, {
    name:        "githubOAuth2",
    scope:       ["read:user", "user:email"],
    credentials: {
      client: {
        id:     process.env["GITHUB_CLIENT_ID"]     ?? "",
        secret: process.env["GITHUB_CLIENT_SECRET"] ?? "",
      },
      auth: fastifyOAuth2.GITHUB_CONFIGURATION,
    },
    startRedirectPath: "/auth/github",
    callbackUri:       process.env["GITHUB_CALLBACK_URL"] ?? "http://localhost:4000/auth/github/callback",
  });
}

export default fp(authPlugin, { name: "auth" });

// ---------------------------------------------------------------------------
// Route guard helpers
// ---------------------------------------------------------------------------

export async function requireAuth(
  req:   FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!req.session.contributorId) {
    reply.code(401).send({ error: "Unauthorized" });
  }
}

export async function requireAdmin(
  req:   FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const admins = (process.env["ADMIN_GITHUB_LOGINS"] ?? "").split(",").map((s) => s.trim());
  if (!req.session.contributorId || !req.session.githubLogin) {
    reply.code(401).send({ error: "Unauthorized" });
    return;
  }
  if (!admins.includes(req.session.githubLogin)) {
    reply.code(403).send({ error: "Forbidden: admin only" });
  }
}

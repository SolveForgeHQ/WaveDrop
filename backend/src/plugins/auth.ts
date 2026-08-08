import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import fastifyOAuth2 from "@fastify/oauth2";
import fastifyCookie from "@fastify/cookie";
import fastifySession from "@fastify/session";
import pg from "pg";

declare module "@fastify/session" {
  interface SessionData {
    contributorId?: string;
    githubLogin?:   string;
  }
}

// ---------------------------------------------------------------------------
// Minimal Postgres session store compatible with @fastify/session
// ---------------------------------------------------------------------------
class PgSessionStore {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString, max: 3 });
    // Ensure table exists on startup
    void this.pool.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        sid     TEXT        PRIMARY KEY,
        sess    JSONB       NOT NULL,
        expire  TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX IF NOT EXISTS session_expire_idx ON "session" (expire);
    `);
  }

  async get(sid: string, cb: (err: Error | null, session?: Record<string, unknown>) => void) {
    try {
      const { rows } = await this.pool.query<{ sess: Record<string, unknown> }>(
        `SELECT sess FROM "session" WHERE sid = $1 AND expire > NOW()`,
        [sid]
      );
      cb(null, rows[0]?.sess ?? undefined);
    } catch (err) { cb(err as Error); }
  }

  async set(sid: string, session: Record<string, unknown>, cb: (err?: Error) => void) {
    try {
      const expire = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await this.pool.query(
        `INSERT INTO "session" (sid, sess, expire)
         VALUES ($1, $2, $3)
         ON CONFLICT (sid) DO UPDATE SET sess = $2, expire = $3`,
        [sid, JSON.stringify(session), expire]
      );
      cb();
    } catch (err) { cb(err as Error); }
  }

  async destroy(sid: string, cb: (err?: Error) => void) {
    try {
      await this.pool.query(`DELETE FROM "session" WHERE sid = $1`, [sid]);
      cb();
    } catch (err) { cb(err as Error); }
  }
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

async function authPlugin(app: FastifyInstance) {
  await app.register(fastifyCookie);

  const dbUrl = process.env["DATABASE_URL"];
  const store = dbUrl ? new PgSessionStore(dbUrl) : undefined;

  await app.register(fastifySession, {
    secret:            process.env["SESSION_SECRET"] ?? "change-this-in-production-min-32-chars!!",
    cookieName:        "wavedrop_session",
    saveUninitialized: false,
    ...(store ? { store: store as unknown as Parameters<typeof fastifySession>[1]["store"] } : {}),
    cookie: {
      secure:   process.env["NODE_ENV"] === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge:   7 * 24 * 60 * 60,
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
    generateStateFunction: (req: FastifyRequest) => {
      const query    = req.query as Record<string, string>;
      const redirect = query["redirect"] ?? "/waves";
      return Buffer.from(JSON.stringify({ redirect })).toString("base64url");
    },
    checkStateFunction: (_req: FastifyRequest, state: string, callback: (err?: Error) => void) => {
      if (state) return callback();
      callback(new Error("Missing state"));
    },
  });
}

export default fp(authPlugin, { name: "auth" });

// ---------------------------------------------------------------------------
// Route guard helpers
// ---------------------------------------------------------------------------

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  if (!req.session.contributorId) {
    reply.code(401).send({ error: "Unauthorized" });
  }
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  const admins = (process.env["ADMIN_GITHUB_LOGINS"] ?? "").split(",").map((s) => s.trim());
  if (!req.session.contributorId || !req.session.githubLogin) {
    reply.code(401).send({ error: "Unauthorized" });
    return;
  }
  if (!admins.includes(req.session.githubLogin)) {
    reply.code(403).send({ error: "Forbidden: admin only" });
  }
}

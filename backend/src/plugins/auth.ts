import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import fastifyOAuth2 from "@fastify/oauth2";
import fastifyCookie from "@fastify/cookie";
import fastifySession from "@fastify/session";
import pg from "pg";

// ---------------------------------------------------------------------------
// Session type augmentation
// ---------------------------------------------------------------------------
declare module "@fastify/session" {
  interface SessionData {
    contributorId: string | undefined;
    githubLogin:   string | undefined;
  }
}

// ---------------------------------------------------------------------------
// Postgres session store
// ---------------------------------------------------------------------------
class PgSessionStore {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString, max: 3 });
    void this.pool.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        sid     TEXT        PRIMARY KEY,
        sess    JSONB       NOT NULL,
        expire  TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX IF NOT EXISTS session_expire_idx ON "session" (expire);
    `);
  }

  get(sid: string, cb: (err: Error | null, session?: Record<string, unknown>) => void) {
    this.pool.query<{ sess: Record<string, unknown> }>(
      `SELECT sess FROM "session" WHERE sid = $1 AND expire > NOW()`,
      [sid]
    )
    .then(({ rows }) => cb(null, rows[0]?.sess ?? undefined))
    .catch((err: Error) => cb(err));
  }

  set(sid: string, session: Record<string, unknown>, cb: (err?: Error) => void) {
    const expire = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    this.pool.query(
      `INSERT INTO "session" (sid, sess, expire)
       VALUES ($1, $2, $3)
       ON CONFLICT (sid) DO UPDATE SET sess = $2, expire = $3`,
      [sid, JSON.stringify(session), expire]
    )
    .then(() => cb())
    .catch((err: Error) => cb(err));
  }

  destroy(sid: string, cb: (err?: Error) => void) {
    this.pool.query(`DELETE FROM "session" WHERE sid = $1`, [sid])
    .then(() => cb())
    .catch((err: Error) => cb(err));
  }
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------
async function authPlugin(app: FastifyInstance) {
  await app.register(fastifyCookie);

  const dbUrl = process.env["DATABASE_URL"];
  const sessionOptions: Parameters<typeof fastifySession>[1] = {
    secret:            process.env["SESSION_SECRET"] ?? "change-this-in-production-min-32-chars!!",
    cookieName:        "wavedrop_session",
    saveUninitialized: false,
    cookie: {
      secure:   process.env["NODE_ENV"] === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge:   7 * 24 * 60 * 60,
    },
  };

  if (dbUrl) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sessionOptions as any).store = new PgSessionStore(dbUrl);
  }

  await app.register(fastifySession, sessionOptions);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await app.register(fastifyOAuth2 as any, {
    name:        "githubOAuth2",
    scope:       ["read:user", "user:email"],
    credentials: {
      client: {
        id:     process.env["GITHUB_CLIENT_ID"]     ?? "",
        secret: process.env["GITHUB_CLIENT_SECRET"] ?? "",
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      auth: (fastifyOAuth2 as any).GITHUB_CONFIGURATION,
    },
    startRedirectPath: "/auth/github",
    callbackUri:       process.env["GITHUB_CALLBACK_URL"] ?? "http://localhost:4000/auth/github/callback",
    generateStateFunction: (req: FastifyRequest) => {
      const query    = req.query as Record<string, string>;
      const redirect = query["redirect"] ?? "/waves";
      return Buffer.from(JSON.stringify({ redirect })).toString("base64url");
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    checkStateFunction: (_req: any, state: string, callback: (err?: Error) => void) => {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(req.session as any).contributorId) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  const admins = (process.env["ADMIN_GITHUB_LOGINS"] ?? "").split(",").map((s) => s.trim());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = req.session as any;
  if (!session.contributorId || !session.githubLogin) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  if (!admins.includes(session.githubLogin as string)) {
    return reply.code(403).send({ error: "Forbidden: admin only" });
  }
}

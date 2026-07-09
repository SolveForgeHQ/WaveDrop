import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";

import authPlugin from "./plugins/auth.js";
import { authRoutes }        from "./routes/auth.js";
import { waveRoutes }        from "./routes/waves.js";
import { issueRoutes }       from "./routes/issues.js";
import { leaderboardRoutes } from "./routes/leaderboard.js";
import { claimRoutes }       from "./routes/claims.js";
import { contributorRoutes } from "./routes/contributors.js";

const app = Fastify({
  logger: {
    level: process.env["LOG_LEVEL"] ?? "info",
    ...(process.env["NODE_ENV"] === "development" && {
      transport: { target: "pino-pretty", options: { colorize: true } },
    }),
  },
});

// ── Plugins ────────────────────────────────────────────────────────────────
await app.register(cors, {
  origin:      process.env["FRONTEND_URL"] ?? "http://localhost:3000",
  credentials: true,
});

await app.register(authPlugin);

// ── Routes ─────────────────────────────────────────────────────────────────
await app.register(authRoutes);
await app.register(waveRoutes);
await app.register(issueRoutes);
await app.register(leaderboardRoutes);
await app.register(claimRoutes);
await app.register(contributorRoutes);

// ── Health ─────────────────────────────────────────────────────────────────
app.get("/health", async () => ({ status: "ok", ts: new Date().toISOString() }));

// ── Start ──────────────────────────────────────────────────────────────────
const port = Number(process.env["PORT"] ?? 4000);

try {
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`WaveDrop backend listening on http://0.0.0.0:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

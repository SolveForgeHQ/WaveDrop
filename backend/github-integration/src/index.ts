import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// Try multiple locations in order: src/../../.env, cwd/../.env, cwd/.env
const candidates = [
  resolve(__dirname, "..", "..", ".env"),      // src/ → github-integration/ → backend/.env
  resolve(process.cwd(), "..", ".env"),         // cwd=github-integration/ → backend/.env
  resolve(process.cwd(), ".env"),               // cwd=backend/ → backend/.env
];
for (const p of candidates) {
  const result = config({ path: p });
  if (!result.error) break;
}
config({ path: envPath });

import Fastify from "fastify";
import { createHmac, timingSafeEqual } from "node:crypto";
import { githubApp } from "./octokit.js";
import { handleIssueLabeled }       from "./handlers/issues-labeled.js";
import { handleIssueComment }       from "./handlers/issue-comment.js";
import { handlePullRequestOpened }  from "./handlers/pull-request-opened.js";
import { handlePullRequestClosed }  from "./handlers/pull-request.js";

const server = Fastify({
  logger: { level: process.env["LOG_LEVEL"] ?? "info" },
});

const WEBHOOK_SECRET = process.env["GITHUB_WEBHOOK_SECRET"] ?? "";

// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------

function verifySignature(body: Buffer, signature: string | undefined): boolean {
  if (!signature) return false;
  const expected = "sha256=" + createHmac("sha256", WEBHOOK_SECRET)
    .update(body)
    .digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Webhook endpoint
// ---------------------------------------------------------------------------

server.addContentTypeParser(
  "application/json",
  { parseAs: "buffer" },
  (_req, body, done) => done(null, body)
);

server.post("/webhooks/github", async (req, reply) => {
  const signature  = req.headers["x-hub-signature-256"] as string | undefined;
  const eventType  = req.headers["x-github-event"]     as string | undefined;
  const deliveryId = req.headers["x-github-delivery"]  as string | undefined;
  const rawBody    = req.body as Buffer;

  // --- Signature verification ---
  if (!verifySignature(rawBody, signature)) {
    server.log.warn({ deliveryId }, "Webhook signature verification failed");
    return reply.code(401).send({ error: "Invalid signature" });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString("utf-8"));
  } catch {
    return reply.code(400).send({ error: "Invalid JSON" });
  }

  server.log.info({ eventType, deliveryId }, "Webhook received");

  // Respond immediately — GitHub expects a 200 within 10 seconds
  reply.code(200).send({ ok: true });

  // Process asynchronously
  setImmediate(async () => {
    try {
      await dispatchWebhook(eventType ?? "", payload);
    } catch (err) {
      server.log.error({ err, eventType, deliveryId }, "Webhook handler error");
    }
  });
});

// ---------------------------------------------------------------------------
// Event dispatcher
// ---------------------------------------------------------------------------

async function dispatchWebhook(eventType: string, payload: unknown) {
  if (!githubApp) {
    server.log.warn("GitHub App not configured — ignoring webhook");
    return;
  }
  await githubApp.webhooks.receive({
    id:      "dispatch",
    name:    eventType as Parameters<typeof githubApp.webhooks.receive>[0]["name"],
    payload: payload as Parameters<typeof githubApp.webhooks.receive>[0]["payload"],
  });
}

// Register typed handlers on the App's webhook emitter
if (githubApp) {
  githubApp.webhooks.on("issues.labeled",        handleIssueLabeled);
  githubApp.webhooks.on("issue_comment.created", handleIssueComment);
  githubApp.webhooks.on("pull_request.opened",   handlePullRequestOpened);
  githubApp.webhooks.on("pull_request.closed",   handlePullRequestClosed);
  githubApp.webhooks.onError((err) => {
    console.error("[webhooks] Handler error:", err.message);
  });
} else {
  console.warn("[webhooks] Handlers not registered — GitHub App not configured.");
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const port = Number(process.env["GITHUB_WEBHOOK_PORT"] ?? 4001);

try {
  await server.listen({ port, host: "0.0.0.0" });
  server.log.info(`WaveDrop GitHub webhook server on http://0.0.0.0:${port}`);
} catch (err) {
  server.log.error(err);
  process.exit(1);
}

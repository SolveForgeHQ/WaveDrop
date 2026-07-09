import { App } from "@octokit/app";

const appId         = process.env["GITHUB_APP_ID"] ?? "";
const privateKey    = (process.env["GITHUB_APP_PRIVATE_KEY"] ?? "").replace(/\\n/g, "\n");
const webhookSecret = process.env["GITHUB_WEBHOOK_SECRET"] ?? "";
const clientId      = process.env["GITHUB_CLIENT_ID"] ?? "";
const clientSecret  = process.env["GITHUB_CLIENT_SECRET"] ?? "";

const configured = Boolean(appId && privateKey && webhookSecret);

if (!configured) {
  if (process.env["NODE_ENV"] === "production") {
    throw new Error(
      "Missing required env vars: GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_WEBHOOK_SECRET"
    );
  }
  console.warn(
    "\n[WaveDrop] ⚠️  GitHub App env vars are not set.\n" +
    "  Webhook handlers will be disabled until you add these to .env:\n" +
    "    GITHUB_APP_ID=\n" +
    "    GITHUB_APP_PRIVATE_KEY=\n" +
    "    GITHUB_WEBHOOK_SECRET=\n"
  );
}

/**
 * GitHub App instance.
 * Will be null when env vars are missing (dev only).
 */
export const githubApp: App | null = configured
  ? new App({
      appId,
      privateKey,
      webhooks: { secret: webhookSecret },
      oauth:    { clientId, clientSecret },
    })
  : null;

/**
 * Get an Octokit client authenticated for a specific installation.
 */
export async function getInstallationOctokit(installationId: number) {
  if (!githubApp) throw new Error("GitHub App is not configured");
  return githubApp.getInstallationOctokit(installationId);
}

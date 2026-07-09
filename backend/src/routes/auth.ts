import type { FastifyInstance } from "fastify";
import { fetchGitHubUser, loginOrRegisterContributor, linkWalletAddress } from "../services/auth.service.js";
import { requireAuth } from "../plugins/auth.js";

export async function authRoutes(app: FastifyInstance) {
  /**
   * GET /auth/github
   * Redirected to by the OAuth2 plugin automatically — no handler needed.
   * The plugin registers the redirect at startRedirectPath.
   */

  /**
   * GET /auth/github/callback
   * GitHub redirects here after the user authorises the app.
   */
  app.get("/auth/github/callback", async (req, reply) => {
    const token = await app.githubOAuth2.getAccessTokenFromAuthorizationCodeFlow(req);
    const accessToken = token.token.access_token as string;

    const userInfo   = await fetchGitHubUser(accessToken);
    const contributor = await loginOrRegisterContributor(accessToken, userInfo);

    req.session.contributorId = contributor.id;
    req.session.githubLogin   = contributor.githubLogin;

    const redirectTo = process.env["FRONTEND_URL"] ?? "http://localhost:3000";
    reply.redirect(`${redirectTo}/dashboard`);
  });

  /**
   * GET /auth/me
   * Returns the currently authenticated contributor.
   */
  app.get("/auth/me", { preHandler: requireAuth }, async (req, reply) => {
    const { prisma } = await import("../db/prisma.js");
    const contributor = await prisma.contributor.findUnique({
      where:  { id: req.session.contributorId },
      select: {
        id:            true,
        githubLogin:   true,
        githubEmail:   true,
        avatarUrl:     true,
        walletAddress: true,
        createdAt:     true,
      },
    });
    if (!contributor) return reply.code(404).send({ error: "Contributor not found" });
    return contributor;
  });

  /**
   * POST /auth/wallet
   * Link or update the contributor's Avalanche wallet address.
   * Body: { walletAddress: string }
   */
  app.post<{ Body: { walletAddress: string } }>(
    "/auth/wallet",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { walletAddress } = req.body;
      if (!walletAddress) {
        return reply.code(400).send({ error: "walletAddress is required" });
      }
      try {
        const updated = await linkWalletAddress(
          req.session.contributorId!,
          walletAddress
        );
        return { walletAddress: updated.walletAddress };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Invalid address";
        return reply.code(400).send({ error: msg });
      }
    }
  );

  /**
   * POST /auth/logout
   */
  app.post("/auth/logout", async (req, reply) => {
    await req.session.destroy();
    reply.send({ ok: true });
  });
}

import type { FastifyInstance } from "fastify";
import { fetchGitHubUser, loginOrRegisterContributor, linkWalletAddress } from "../services/auth.service.js";
import { requireAuth } from "../plugins/auth.js";

export async function authRoutes(app: FastifyInstance) {
  app.get("/auth/github/callback", async (req, reply) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const token       = await (app as any).githubOAuth2.getAccessTokenFromAuthorizationCodeFlow(req);
    const accessToken = token.token.access_token as string;

    const userInfo    = await fetchGitHubUser(accessToken);
    const contributor = await loginOrRegisterContributor(accessToken, userInfo);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = req.session as any;
    session.contributorId = contributor.id;
    session.githubLogin   = contributor.githubLogin;

    const frontendUrl = process.env["FRONTEND_URL"] ?? "http://localhost:3000";

    let redirectPath = "/waves";
    try {
      const query = req.query as Record<string, string>;
      const state = query["state"] ?? (token.token.state as string) ?? "";
      if (state) {
        const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf-8")) as { redirect?: string };
        if (decoded.redirect?.startsWith("/")) redirectPath = decoded.redirect;
      }
    } catch {
      // malformed state — fall back to /waves
    }

    return reply.redirect(`${frontendUrl}${redirectPath}`);
  });

  app.get("/auth/me", { preHandler: requireAuth }, async (req, reply) => {
    const { prisma } = await import("../db/prisma.js");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = req.session as any;
    const contributor = await prisma.contributor.findUnique({
      where:  { id: session.contributorId as string },
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

  app.post<{ Body: { walletAddress: string } }>(
    "/auth/wallet",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { walletAddress } = req.body;
      if (!walletAddress) {
        return reply.code(400).send({ error: "walletAddress is required" });
      }
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const session   = req.session as any;
        const updated   = await linkWalletAddress(session.contributorId as string, walletAddress);
        return { walletAddress: updated.walletAddress };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Invalid address";
        return reply.code(400).send({ error: msg });
      }
    }
  );

  app.post("/auth/logout", async (req, reply) => {
    await req.session.destroy();
    return reply.send({ ok: true });
  });
}

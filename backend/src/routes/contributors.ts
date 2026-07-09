import type { FastifyInstance } from "fastify";
import { prisma } from "../db/prisma.js";

export async function contributorRoutes(app: FastifyInstance) {
  /**
   * GET /contributors/:login
   * Public contributor profile + recent ledger activity.
   */
  app.get<{ Params: { login: string } }>(
    "/contributors/:login",
    async (req, reply) => {
      const contributor = await prisma.contributor.findUnique({
        where:  { githubLogin: req.params.login },
        select: {
          id:            true,
          githubLogin:   true,
          avatarUrl:     true,
          walletAddress: true,
          createdAt:     true,
          ledger: {
            orderBy: { createdAt: "desc" },
            take:    10,
            select: {
              id:        true,
              points:    true,
              reason:    true,
              createdAt: true,
              wave: { select: { id: true, name: true } },
              pullRequest: {
                select: { githubNumber: true, title: true, url: true },
              },
            },
          },
        },
      });

      if (!contributor) {
        return reply.code(404).send({ error: "Contributor not found" });
      }
      return contributor;
    }
  );

  /**
   * GET /contributors/:login/waves/:waveId/points
   * Total points a contributor has earned in a specific wave.
   */
  app.get<{ Params: { login: string; waveId: string } }>(
    "/contributors/:login/waves/:waveId/points",
    async (req, reply) => {
      const contributor = await prisma.contributor.findUnique({
        where: { githubLogin: req.params.login },
      });
      if (!contributor) {
        return reply.code(404).send({ error: "Contributor not found" });
      }

      const result = await prisma.pointsLedger.aggregate({
        where:  { waveId: req.params.waveId, contributorId: contributor.id },
        _sum:   { points: true },
        _count: { id: true },
      });

      return {
        contributorId: contributor.id,
        waveId:        req.params.waveId,
        totalPoints:   result._sum.points  ?? 0,
        mergedPRs:     result._count.id    ?? 0,
      };
    }
  );
}

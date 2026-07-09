import type { FastifyInstance } from "fastify";
import { getLeaderboard } from "../services/points.service.js";

export async function leaderboardRoutes(app: FastifyInstance) {
  /**
   * GET /waves/:id/leaderboard
   * Ranked contributors by points for a wave. Paginated.
   *
   * Query params:
   *   page      number  (default: 1)
   *   pageSize  number  (default: 20, max: 100)
   */
  app.get<{
    Params:      { id: string };
    Querystring: { page?: string; pageSize?: string };
  }>("/waves/:id/leaderboard", async (req, reply) => {
    const page     = Math.max(1, parseInt(req.query.page     ?? "1",  10));
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize ?? "20", 10)));

    const result = await getLeaderboard(req.params.id, page, pageSize);
    return {
      data:     result.entries,
      total:    result.total,
      page:     result.page,
      pageSize: result.pageSize,
      pages:    Math.ceil(result.total / result.pageSize),
    };
  });
}

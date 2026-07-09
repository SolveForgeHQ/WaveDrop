import type { FastifyInstance } from "fastify";
import { issueRepo } from "../repositories/issue.repo.js";
import type { Complexity } from "../repositories/issue.repo.js";

export async function issueRoutes(app: FastifyInstance) {
  /**
   * GET /waves/:id/issues
   * Public endpoint — browse issues for a wave.
   *
   * Query params:
   *   complexity  EASY | MEDIUM | HARD
   *   isOpen      true | false  (default: true)
   *   page        number        (default: 1)
   *   pageSize    number        (default: 20, max: 100)
   */
  app.get<{
    Params:      { id: string };
    Querystring: {
      complexity?: string;
      isOpen?:     string;
      page?:       string;
      pageSize?:   string;
    };
  }>("/waves/:id/issues", async (req, reply) => {
    const { complexity, isOpen, page, pageSize } = req.query;

    const parsedPage     = Math.max(1, parseInt(page     ?? "1",  10));
    const parsedPageSize = Math.min(100, Math.max(1, parseInt(pageSize ?? "20", 10)));
    const parsedIsOpen   = isOpen === undefined ? true : isOpen === "true";

    const validComplexity: Complexity[] = ["EASY", "MEDIUM", "HARD"];
    const parsedComplexity = complexity?.toUpperCase() as Complexity | undefined;
    if (parsedComplexity && !validComplexity.includes(parsedComplexity)) {
      return reply.code(400).send({
        error: `complexity must be one of: ${validComplexity.join(", ")}`,
      });
    }

    const result = await issueRepo.findByWave({
      waveId:     req.params.id,
      complexity: parsedComplexity,
      isOpen:     parsedIsOpen,
      page:       parsedPage,
      pageSize:   parsedPageSize,
    });

    return {
      data:     result.items,
      total:    result.total,
      page:     result.page,
      pageSize: result.pageSize,
      pages:    Math.ceil(result.total / result.pageSize),
    };
  });
}

import type { FastifyInstance } from "fastify";
import { waveService } from "../services/wave.service.js";
import { generateMerkleTree, finaliseWaveOnChain } from "../services/merkle.service.js";
import { requireAdmin, requireAuth } from "../plugins/auth.js";
import type { Complexity } from "../repositories/issue.repo.js";

const VALID_COMPLEXITY: Complexity[] = ["EASY", "MEDIUM", "HARD"];

export async function waveRoutes(app: FastifyInstance) {
  /**
   * POST /waves
   * Create a new wave. Admin only.
   */
  app.post<{
    Body: {
      ecosystemId:    string;
      name:           string;
      description?:   string;
      poolAmountUsdc: string;
      startsAt:       string;
      endsAt:         string;
    };
  }>("/waves", { preHandler: requireAdmin }, async (req, reply) => {
    const { ecosystemId, name, description, poolAmountUsdc, startsAt, endsAt } = req.body;

    if (!ecosystemId || !name || !poolAmountUsdc || !startsAt || !endsAt) {
      return reply.code(400).send({ error: "Missing required fields" });
    }
    if (isNaN(parseFloat(poolAmountUsdc))) {
      return reply.code(400).send({ error: "poolAmountUsdc must be a number" });
    }

    try {
      const wave = await waveService.createWave({
        ecosystemId,
        name,
        description,
        poolAmountUsdc,
        startsAt: new Date(startsAt),
        endsAt:   new Date(endsAt),
      });
      return reply.code(201).send(wave);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create wave";
      return reply.code(400).send({ error: msg });
    }
  });

  /**
   * GET /waves
   * List all waves. Optional ?status= filter.
   */
  app.get<{ Querystring: { status?: string } }>("/waves", async (req, reply) => {
    const waves = await waveService.listWaves(req.query.status);
    return waves;
  });

  /**
   * GET /waves/:id
   */
  app.get<{ Params: { id: string } }>("/waves/:id", async (req, reply) => {
    try {
      return await waveService.getWave(req.params.id);
    } catch {
      return reply.code(404).send({ error: "Wave not found" });
    }
  });

  /**
   * POST /waves/:id/repos
   * Maintainers apply repos + tag issues with point values.
   * Body: { repoOwner, repoName, ecosystemId, issues: [{ githubNumber, title, url, complexity }] }
   */
  app.post<{
    Params: { id: string };
    Body: {
      repoOwner:   string;
      repoName:    string;
      ecosystemId: string;
      issues: Array<{
        githubNumber: number;
        title:        string;
        url:          string;
        complexity:   Complexity;
      }>;
    };
  }>("/waves/:id/repos", { preHandler: requireAuth }, async (req, reply) => {
    const { repoOwner, repoName, ecosystemId, issues } = req.body;

    if (!repoOwner || !repoName || !ecosystemId) {
      return reply.code(400).send({ error: "repoOwner, repoName and ecosystemId are required" });
    }
    if (!Array.isArray(issues) || issues.length === 0) {
      return reply.code(400).send({ error: "issues array is required and must not be empty" });
    }

    // Validate complexity values
    const invalid = issues.filter((i) => !VALID_COMPLEXITY.includes(i.complexity));
    if (invalid.length > 0) {
      return reply.code(400).send({
        error: `Invalid complexity values. Must be one of: ${VALID_COMPLEXITY.join(", ")}`,
      });
    }

    try {
      const result = await waveService.addRepoWithIssues({
        waveId:      req.params.id,
        repoOwner,
        repoName,
        ecosystemId,
        issues,
      });
      return reply.code(201).send(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add repository";
      return reply.code(400).send({ error: msg });
    }
  });

  /**
   * POST /waves/:id/close
   * Closes the wave, freezes the ledger, and triggers Merkle tree generation.
   * Admin only.
   */
  app.post<{ Params: { id: string } }>(
    "/waves/:id/close",
    { preHandler: requireAdmin },
    async (req, reply) => {
      try {
        // 1. Close the wave
        await waveService.closeWave(req.params.id);

        // 2. Generate Merkle tree + persist payouts
        const result = await generateMerkleTree(req.params.id);

        return {
          message:     "Wave closed and Merkle tree generated",
          merkleRoot:  result.merkleRoot,
          totalLeaves: result.totalLeaves,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to close wave";
        return reply.code(400).send({ error: msg });
      }
    }
  );

  /**
   * POST /waves/:id/settle
   * Called by the operator script after submitting the root on-chain.
   * Body: { merkleRoot, onChainWaveId? }
   * Admin only.
   */
  app.post<{
    Params: { id: string };
    Body:   { merkleRoot: string; onChainWaveId?: string };
  }>("/waves/:id/settle", { preHandler: requireAdmin }, async (req, reply) => {
    const { merkleRoot, onChainWaveId } = req.body;
    if (!merkleRoot) return reply.code(400).send({ error: "merkleRoot is required" });

    try {
      const wave = await finaliseWaveOnChain(req.params.id, merkleRoot, onChainWaveId);
      return wave;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to settle wave";
      return reply.code(400).send({ error: msg });
    }
  });
}

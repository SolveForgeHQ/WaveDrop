import type { FastifyInstance } from "fastify";
import { getClaimProof } from "../services/merkle.service.js";
import { payoutRepo } from "../repositories/payout.repo.js";
import { requireAdmin } from "../plugins/auth.js";

export async function claimRoutes(app: FastifyInstance) {
  /**
   * GET /waves/:id/claim/:address
   * Returns the Merkle proof + amount for a wallet address in a settled wave.
   * Used by the frontend to call MerkleClaim.claim() on-chain.
   */
  app.get<{ Params: { id: string; address: string } }>(
    "/waves/:id/claim/:address",
    async (req, reply) => {
      try {
        const proof = await getClaimProof(req.params.id, req.params.address);
        return proof;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Not found";
        return reply.code(404).send({ error: msg });
      }
    }
  );

  /**
   * GET /waves/:id/settlement
   * Returns the full payout list for the operator's on-chain submission script.
   * Admin only — contains all proofs for all contributors.
   */
  app.get<{ Params: { id: string } }>(
    "/waves/:id/settlement",
    { preHandler: requireAdmin },
    async (req, reply) => {
      const payouts = await payoutRepo.findByWave(req.params.id);
      if (!payouts.length) {
        return reply.code(404).send({ error: "No payouts found for this wave" });
      }
      return { waveId: req.params.id, payouts };
    }
  );

  /**
   * POST /waves/:id/claims
   * Record an on-chain claim event (called by the operator indexer or webhook).
   * Body: { walletAddress, amountUsdc, txHash }
   * Admin only.
   */
  app.post<{
    Params: { id: string };
    Body:   { walletAddress: string; amountUsdc: string; txHash: string };
  }>(
    "/waves/:id/claims",
    { preHandler: requireAdmin },
    async (req, reply) => {
      const { walletAddress, amountUsdc, txHash } = req.body;
      if (!walletAddress || !amountUsdc || !txHash) {
        return reply.code(400).send({ error: "walletAddress, amountUsdc and txHash are required" });
      }

      const payout = await payoutRepo.findByWaveAndWallet(req.params.id, walletAddress);
      if (!payout) {
        return reply.code(404).send({ error: "No payout found for this address in this wave" });
      }

      try {
        await payoutRepo.recordOnChainClaim({
          waveId:        req.params.id,
          payoutId:      payout.id,
          walletAddress: payout.walletAddress,
          amountUsdc,
          txHash,
        });
        return { ok: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to record claim";
        return reply.code(400).send({ error: msg });
      }
    }
  );
}

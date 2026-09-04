# Security Policy

## Supported Versions

We actively maintain and provide security updates for the following components:

| Component | Supported Versions |
|---|---|
| Smart Contracts (contracts/) | Latest deployed on Avalanche C-Chain / Fuji |
| Backend & Webhooks (ackend/) | main branch |
| Frontend (rontend/) | main branch |
| Shared library (shared/) | main branch |

---

## Reporting a Vulnerability

The WaveDrop team takes the security of our smart contracts, off-chain infrastructure, and contributor funds seriously.

If you discover a security vulnerability:

1. **Do NOT report security vulnerabilities via public GitHub issues, discussions, or pull requests.**
2. Report the vulnerability via email to **security@wavedrop.io** or through GitHub's [Private Vulnerability Reporting](https://github.com/SolveForgeHQ/WaveDrop/security/advisories/new).
3. Include detailed reproduction steps, proof of concept code/transactions (if applicable), and your assessment of the impact.

### What to Expect

- **Initial Response**: Within 48 hours acknowledging receipt of your report.
- **Assessment & Triage**: We will investigate and determine the severity and remediation path.
- **Resolution & Disclosure**: We will coordinate with you on fixing the issue and publishing an advisory after patches are deployed.

---

## Smart Contract Bug Bounty

Vulnerabilities in our on-chain settlement contracts (MerkleClaim.sol, WaveEscrow.sol, WaveRegistry.sol) impacting user funds or Merkle verification will be evaluated for bug bounty rewards based on impact and severity.

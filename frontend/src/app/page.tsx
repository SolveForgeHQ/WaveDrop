"use client";
import Link from "next/link";
import Image from "next/image";
import { Button } from "../components/ui/Button";

// Stellar logo from /public/stellar.svg
function StellarLogo() {
  return (
    <Image src="/stellar.svg" alt="Stellar" width={20} height={20} />
  );
}

export default function HomePage() {
  return (
    <div className="flex flex-col items-center text-center px-4 py-6 md:py-10">
      <div className="w-full max-w-2xl">

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl font-bold text-[#f0f0f4] mb-4 leading-tight">
          Contribute.<br />
          <span className="text-[#7c5cfc]">Earn USDC.</span>
        </h1>

        <p className="text-[#8888a0] text-base sm:text-lg mb-8 max-w-lg mx-auto">
          Ecosystem partners fund bounty pools each Wave. Contributors resolve
          tagged GitHub issues and earn proportional USDC payouts — verified
          on-chain via Merkle proofs.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
          <Link href="/waves">
            <Button variant="primary" size="lg">Browse Waves</Button>
          </Link>
        </div>

        {/* How it works */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-14 text-left">
          {[
            {
              step:  "01",
              title: "Browse Issues",
              body:  "Filter tagged GitHub issues by point value. Comment /apply to get assigned.",
            },
            {
              step:  "02",
              title: "Submit a PR",
              body:  "Open a PR that closes the issue. Our bot links and monitors it automatically.",
            },
            {
              step:  "03",
              title: "Claim USDC",
              body:  "When the Wave closes, claim your proportional USDC share with a Merkle proof.",
            },
          ].map(({ step, title, body }) => (
            <div key={step} className="bg-[#111118] border border-[#27272e] rounded-xl p-5">
              <p className="text-xs font-mono text-[#55556a] mb-2">{step}</p>
              <p className="text-sm font-semibold text-[#f0f0f4] mb-1">{title}</p>
              <p className="text-xs text-[#8888a0]">{body}</p>
            </div>
          ))}
        </div>

        {/* ── Wave Program section ── */}
        <div className="mt-16 text-left">
          <h2 className="text-lg font-bold text-[#f0f0f4] mb-4">Wave Program</h2>

          <div className="bg-[#111118] border border-[#27272e] rounded-xl p-6">
            {/* Stellar badge */}
            <div className="flex items-center gap-2 mb-4">
              <StellarLogo />
              <span className="text-sm font-semibold text-[#f0f0f4]">Stellar</span>
              <span className="text-xs text-[#55556a] ml-1">Mainnet + Testnet</span>
            </div>

            <p className="text-sm text-[#8888a0] leading-relaxed">
              WaveDrop settles contributor rewards entirely on Stellar (Soroban), distributing USDC via
              on-chain Merkle claims so every payout is cryptographically verifiable. By combining
              Stellar&apos;s low fee costs with sub-second finality, WaveDrop keeps settlement cheap
              and auditable — contributors claim directly from their wallet, no intermediary required.
            </p>

            <div className="grid grid-cols-3 gap-3 mt-5">
              {[
                { label: "Avg gas per claim", value: "< $0.01" },
                { label: "Finality",           value: "~1s"     },
                { label: "Payout token",        value: "USDC"   },
              ].map(({ label, value }) => (
                <div key={label} className="bg-[#0a0a0f] rounded-lg p-3 text-center">
                  <p className="text-base font-bold text-[#f0f0f4]">{value}</p>
                  <p className="text-xs text-[#55556a] mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

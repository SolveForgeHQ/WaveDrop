"use client";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { GitHubIcon } from "../../lib/icons";
import { Button } from "../../components/ui/Button";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function LoginForm() {
  const searchParams = useSearchParams();
  const redirect     = searchParams.get("redirect") ?? "/waves";
  const [checked, setChecked] = useState(false);

  // Pass redirect through to the backend OAuth flow via a state param
  const oauthUrl = `${API_BASE}/auth/github?redirect=${encodeURIComponent(redirect)}`;

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-56px)] px-4">
      <div className="w-full max-w-sm">

        <div className="bg-[#111118] border border-[#27272e] rounded-xl p-6">
          <h1 className="text-base font-semibold text-[#f0f0f4] mb-1 text-center">Sign in</h1>
          <p className="text-xs text-[#55556a] text-center mb-6">
            Connect your GitHub account to start contributing and earning USDC.
          </p>

          {/* Age gate */}
          <label className="flex items-start gap-3 mb-5 cursor-pointer group">
            <div className="relative mt-0.5 shrink-0">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="sr-only"
              />
              <div className={`
                w-4 h-4 rounded border-2 flex items-center justify-center transition-colors
                ${checked
                  ? "bg-[#7c5cfc] border-[#7c5cfc]"
                  : "bg-transparent border-[#3a3a48] group-hover:border-[#55556a]"}
              `}>
                {checked && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
            </div>
            <span className="text-xs text-[#8888a0] leading-relaxed select-none">
              I confirm I am <span className="text-[#f0f0f4] font-medium">18 years of age or older</span> and agree to the Terms of Service.
            </span>
          </label>

          {/* GitHub OAuth button */}
          <a
            href={checked ? oauthUrl : undefined}
            onClick={!checked ? (e) => e.preventDefault() : undefined}
            aria-disabled={!checked}
            tabIndex={checked ? 0 : -1}
            className="block"
          >
            <Button
              variant="primary"
              size="lg"
              disabled={!checked}
              className="w-full justify-center gap-2"
            >
              <GitHubIcon />
              Continue with GitHub
            </Button>
          </a>

          {!checked && (
            <p className="text-xs text-[#55556a] text-center mt-3">
              Please confirm your age above to continue.
            </p>
          )}
        </div>

        <p className="text-xs text-[#55556a] text-center mt-4">
          By signing in you agree to our{" "}
          <a href="/docs" className="text-[#7c5cfc] hover:underline">Terms</a>{" "}
          and{" "}
          <a href="/docs" className="text-[#7c5cfc] hover:underline">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

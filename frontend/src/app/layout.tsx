import type { Metadata } from "next";
import { Providers } from "../components/Providers";
import { Nav }       from "../components/Nav";
import { Sidebar }   from "../components/Sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title:       "WaveDrop — Contribution Bounties on Avalanche",
  description: "Earn USDC by contributing to open-source projects. Browse issues, submit PRs, claim rewards.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen">
        <Providers>
          {/* Mobile top nav (hidden on md+) + Desktop top bar */}
          <Nav />

          <div className="flex">
            {/* Desktop sidebar — hidden on mobile */}
            <Sidebar />

            {/* Page content */}
            <main className="flex-1 min-w-0 px-4 sm:px-6 md:px-8 py-6 md:py-8">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}

"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useDisconnect } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  GitHubIcon, MenuIcon, XIcon,
  WavesIcon, BuildingIcon, IssueIcon, RepoIcon,
  GiftIcon, StarIcon, ClockIcon, SettingsIcon, BookIcon,
} from "../lib/icons";
import { Button } from "./ui/Button";

const ADMIN_LOGINS = (process.env.NEXT_PUBLIC_ADMIN_LOGINS ?? "").split(",").map(s => s.trim());

// Full sidebar nav — same structure as Sidebar.tsx so mobile mirrors desktop
interface NavItem  { href: string; label: string; icon: React.ReactNode }
interface NavGroup { section?: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    section: "Explore",
    items: [
      { href: "/waves", label: "Waves", icon: <WavesIcon /> },
      { href: "/orgs",  label: "Orgs",  icon: <BuildingIcon /> },
    ],
  },
  {
    section: "Contributor",
    items: [
      { href: "/contributor/issues", label: "Issues", icon: <IssueIcon /> },
    ],
  },
  {
    section: "Maintainer",
    items: [
      { href: "/maintainer/issues", label: "Issues",       icon: <IssueIcon /> },
      { href: "/maintainer/repos",  label: "Orgs & Repos", icon: <RepoIcon /> },
    ],
  },
  {
    items: [
      { href: "/claim",   label: "Reward Grants", icon: <GiftIcon /> },
      { href: "/points",  label: "Points",        icon: <StarIcon /> },
      { href: "/history", label: "History",        icon: <ClockIcon /> },
      { href: "/settings",label: "Settings",       icon: <SettingsIcon /> },
      { href: "/docs",    label: "Docs",           icon: <BookIcon /> },
    ],
  },
];

export function Nav() {
  const path                     = usePathname();
  const { address, isConnected } = useAccount();
  const { disconnect }           = useDisconnect();
  const [open, setOpen]          = useState(false);

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn:  api.auth.me,
    retry:    false,
  });

  const isAdmin = me && ADMIN_LOGINS.includes(me.githubLogin);

  // Build groups — append admin if applicable
  const groups: NavGroup[] = [
    ...NAV_GROUPS,
    ...(isAdmin ? [{ items: [{ href: "/admin", label: "Admin", icon: <SettingsIcon /> }] }] : []),
  ];

  return (
    <>
      {/* ── Mobile top bar (hidden on md+) ── */}
      <header className="md:hidden sticky top-0 z-50 border-b border-[#27272e] bg-[#0a0a0f]/90 backdrop-blur-sm">
        <div className="h-14 px-4 flex items-center gap-3">

          {/* LEFT: hamburger */}
          <button
            onClick={() => setOpen(o => !o)}
            aria-label="Toggle menu"
            className="p-1.5 rounded-md text-[#8888a0] hover:text-[#f0f0f4] hover:bg-[#18181f] transition-colors shrink-0"
          >
            {open ? <XIcon /> : <MenuIcon />}
          </button>

          {/* Logo — centred */}
          <Link href="/" className="flex items-center gap-2 flex-1 justify-center">
            <span className="w-6 h-6 rounded-md bg-[#7c5cfc] flex items-center justify-center text-white text-xs font-black">W</span>
            <span className="text-sm font-bold text-[#f0f0f4]">WaveDrop</span>
          </Link>

          {/* RIGHT: wallet address, username, or login button */}
          {isConnected && address ? (
            <span className="text-xs font-mono text-[#55556a] shrink-0">
              {address.slice(0, 6)}…{address.slice(-4)}
            </span>
          ) : me ? (
            <span className="text-xs text-[#55556a] shrink-0">@{me.githubLogin}</span>
          ) : (
            <Link href="/login" className="shrink-0">
              <Button size="sm" variant="primary" className="gap-1.5 px-3">
                <GitHubIcon size={14} />
                <span>Login</span>
              </Button>
            </Link>
          )}
        </div>

        {/* ── Mobile drawer — full sidebar structure ── */}
        {open && (
          <div className="border-t border-[#27272e] bg-[#0a0a0f] px-4 py-3 overflow-y-auto max-h-[calc(100vh-56px)]">
            {groups.map((group, gi) => (
              <div key={gi} className={gi > 0 ? "mt-4" : ""}>
                {group.section && (
                  <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#3a3a4a]">
                    {group.section}
                  </p>
                )}
                {!group.section && gi > 0 && (
                  <div className="border-t border-[#1e1e27] mb-3" />
                )}
                <ul className="space-y-0.5">
                  {group.items.map(({ href, label, icon }) => {
                    const active = path === href || (href !== "/" && path.startsWith(href));
                    const dest   = me ? href : `/login?redirect=${encodeURIComponent(href)}`;
                    return (
                      <li key={href}>
                        <Link
                          href={dest}
                          onClick={() => setOpen(false)}
                          className={`
                            flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium transition-colors
                            ${active
                              ? "bg-[#18181f] text-[#f0f0f4]"
                              : "text-[#8888a0] hover:text-[#f0f0f4] hover:bg-[#18181f]"}
                          `}
                        >
                          <span className={`shrink-0 ${active ? "text-[#7c5cfc]" : "text-[#3a3a4a]"}`}>
                            {icon}
                          </span>
                          {label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

            {/* Bottom auth row — only shown when signed in */}
            {me && (
              <div className="mt-4 pt-3 border-t border-[#27272e]">
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {me.avatarUrl && <img src={me.avatarUrl} alt="" className="w-5 h-5 rounded-full" />}
                    <span className="text-xs text-[#8888a0]">@{me.githubLogin}</span>
                  </div>
                  {isConnected && address && (
                    <button
                      onClick={() => { disconnect(); setOpen(false); }}
                      className="text-xs text-[#55556a] hover:text-[#f0f0f4] transition-colors"
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </header>

      {/* ── Desktop top bar — logo + right-side auth only (nav is in Sidebar) ── */}
      <header className="hidden md:flex sticky top-0 z-50 border-b border-[#27272e] bg-[#0a0a0f]/90 backdrop-blur-sm h-14 items-center px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-[#7c5cfc] flex items-center justify-center text-white text-xs font-black">W</span>
          <span className="text-sm font-bold text-[#f0f0f4]">WaveDrop</span>
        </Link>

        <div className="ml-auto flex items-center gap-3">
          {isConnected && address ? (
            <>
              <span className="text-xs font-mono text-[#55556a]">{address.slice(0, 6)}…{address.slice(-4)}</span>
              <Button size="sm" variant="ghost" onClick={() => disconnect()}>Disconnect</Button>
            </>
          ) : me ? (
            <span className="text-xs text-[#55556a]">@{me.githubLogin}</span>
          ) : (
            <Link href="/login">
              <Button size="sm" variant="primary" className="gap-2">
                <GitHubIcon size={14} />
                Login
              </Button>
            </Link>
          )}
        </div>
      </header>
    </>
  );
}

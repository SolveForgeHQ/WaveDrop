"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useDisconnect } from "wagmi";
import { api } from "../lib/api";
import {
  WavesIcon, BuildingIcon, IssueIcon, RepoIcon,
  GiftIcon, StarIcon, ClockIcon, SettingsIcon, BookIcon,
} from "../lib/icons";

const ADMIN_LOGINS = (process.env.NEXT_PUBLIC_ADMIN_LOGINS ?? "").split(",").map(s => s.trim());

interface NavItem {
  href:  string;
  label: string;
  icon:  React.ReactNode;
}

interface NavSection {
  section?: string;  // undefined = no label
  items:    NavItem[];
}

const NAV_STRUCTURE: NavSection[] = [
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
      { href: "/maintainer/issues", label: "Issues",      icon: <IssueIcon /> },
      { href: "/maintainer/repos",  label: "Orgs & Repos", icon: <RepoIcon /> },
    ],
  },
  {
    items: [
      { href: "/claim",   label: "Reward Grants", icon: <GiftIcon /> },
      { href: "/points",  label: "Points",        icon: <StarIcon /> },
      { href: "/history", label: "History",       icon: <ClockIcon /> },
      { href: "/settings",label: "Settings",      icon: <SettingsIcon /> },
      { href: "/docs",    label: "Docs",          icon: <BookIcon /> },
    ],
  },
];

export function Sidebar() {
  const path      = usePathname();
  const router    = useRouter();
  const { disconnect } = useDisconnect();
  const { address, isConnected } = useAccount();

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn:  api.auth.me,
    retry:    false,
  });

  const isAdmin = me && ADMIN_LOGINS.includes(me.githubLogin);

  // Auth-aware navigation: redirect to login if not signed in
  function handleNav(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    if (!me) {
      e.preventDefault();
      router.push(`/login?redirect=${encodeURIComponent(href)}`);
    }
  }

  // Build final nav — add admin if applicable
  const sections: NavSection[] = [
    ...NAV_STRUCTURE,
    ...(isAdmin ? [{ items: [{ href: "/admin", label: "Admin", icon: <SettingsIcon /> }] }] : []),
  ];

  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-[#27272e] bg-[#0a0a0f] min-h-screen sticky top-0 pt-14 pb-4">
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {sections.map((section, si) => (
          <div key={si} className={si > 0 ? "mt-5" : ""}>
            {section.section && (
              <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#3a3a4a]">
                {section.section}
              </p>
            )}
            {!section.section && si > 0 && (
              <div className="border-t border-[#1e1e27] mb-3" />
            )}
            <ul className="space-y-0.5">
              {section.items.map(({ href, label, icon }) => {
                const active = path === href || (href !== "/" && path.startsWith(href));
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={(e) => handleNav(e, href)}
                      className={`
                        flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs font-medium
                        transition-colors group
                        ${active
                          ? "bg-[#18181f] text-[#f0f0f4]"
                          : "text-[#55556a] hover:text-[#c0c0d0] hover:bg-[#14141b]"
                        }
                      `}
                    >
                      <span className={`shrink-0 transition-colors ${active ? "text-[#7c5cfc]" : "text-[#3a3a4a] group-hover:text-[#55556a]"}`}>
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
      </nav>

      {/* Bottom user area */}
      <div className="px-3 pt-3 border-t border-[#1e1e27]">
        {me ? (
          <div className="flex items-center gap-2 px-2 py-1.5">
            {me.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={me.avatarUrl} alt={me.githubLogin} className="w-5 h-5 rounded-full" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-[#27272e]" />
            )}
            <span className="text-xs text-[#8888a0] truncate flex-1">@{me.githubLogin}</span>
            {isConnected && address && (
              <button
                onClick={() => disconnect()}
                className="text-[10px] text-[#3a3a4a] hover:text-[#55556a] transition-colors"
                title="Disconnect wallet"
              >
                ⏏
              </button>
            )}
          </div>
        ) : (
          <Link
            href="/login"
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-[#55556a] hover:text-[#c0c0d0] hover:bg-[#14141b] transition-colors"
          >
            Sign in
          </Link>
        )}
      </div>
    </aside>
  );
}

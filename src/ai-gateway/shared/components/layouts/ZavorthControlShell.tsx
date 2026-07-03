"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import NotificationToast from "../NotificationToast";
import ThemeToggle from "../ThemeToggle";
import TokenHealthBadge from "../TokenHealthBadge";
import ZavorthGatewayLogo from "../ZavorthGatewayLogo";
import { cn } from "@/shared/utils/cn";

const tabs = [
  { label: "Inbox", href: "/zavorthControl", exact: true },
  { label: "Tasks", href: "/zavorthControl/cli-tools" },
  { label: "Approvals", href: "/zavorthControl/logs" },
  { label: "Providers", href: "/zavorthControl/providers" },
  { label: "Mnemos", href: "/zavorthControl/memory" },
  { label: "Gateway", href: "/zavorthControl/routing" },
  { label: "Health", href: "/zavorthControl/health" },
];

function isActive(pathname: string | null, href: string, exact?: boolean) {
  if (!pathname) return false;
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export default function ZavorthControlShell({ children }) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-[#0c0c0d] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,111,24,0.16),transparent_34%),radial-gradient(circle_at_80%_10%,rgba(64,152,255,0.10),transparent_30%)]" />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-20 -mx-4 border-b border-white/10 bg-[#0c0c0d]/82 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <Link href="/zavorthControl" className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-400/30 bg-orange-500/12 text-orange-300 shadow-[0_0_32px_rgba(255,111,24,0.12)]">
                <ZavorthGatewayLogo size={22} />
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-300">
                  Zavorth
                </span>
                <span className="block truncate text-sm text-zinc-400">
                  Agent workspace, approvals and evidence.
                </span>
              </span>
            </Link>

            <nav
              aria-label="ZavorthControl sections"
              className="flex gap-1 overflow-x-auto rounded-full border border-white/10 bg-white/[0.04] p-1"
            >
              {tabs.map((tab) => {
                const active = isActive(pathname, tab.href, tab.exact);
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={cn(
                      "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition",
                      active
                        ? "bg-orange-500 text-black shadow-[0_0_28px_rgba(255,111,24,0.22)]"
                        : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100"
                    )}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-2">
              <TokenHealthBadge />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main id="main-content" className="flex-1 py-6">
          {children}
        </main>
      </div>
      <NotificationToast />
    </div>
  );
}

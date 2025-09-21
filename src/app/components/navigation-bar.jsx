"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/dashboard", label: "Home" },
  { href: "/focus", label: "Focus" },
  { href: "/strength", label: "Strength" },
  { href: "/reach-out", label: "Reach Out" },
];

export default function NavigationBar({ onLogout }) {
  const pathname = usePathname();

  const isActive = (href) => {
    if (href === "/dashboard") {
      return pathname === href;
    }
    return pathname?.startsWith(href);
  };

  const desktopLinkClass = (href) =>
    `text-sm font-medium transition-colors ${
      isActive(href)
        ? "text-[var(--text-primary)]"
        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
    }`;

  const mobileLinkClass = (href) =>
    `flex-1 rounded-lg border px-3 py-2 text-center text-sm transition-colors ${
      isActive(href)
        ? "border-[var(--accent)] text-[var(--accent)] font-semibold"
        : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
    }`;

  return (
    <header className="bg-[var(--surface)] border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-lg font-semibold text-[var(--text-primary)]">
              Top-G
            </span>
            <span className="hidden text-sm text-[var(--text-secondary)] sm:inline">
              Productivity Suite
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className={desktopLinkClass(link.href)}>
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {onLogout && (
              <button
                onClick={onLogout}
                className="btn-secondary hidden text-sm font-medium transition-colors md:inline-flex"
              >
                Logout
              </button>
            )}
          </div>
        </div>
        <div className="md:hidden">
          <div className="flex items-center justify-between py-3">
            <nav className="flex w-full items-center gap-3 text-sm">
              {NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className={mobileLinkClass(link.href)}>
                  {link.label}
                </Link>
              ))}
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="flex-1 rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-center text-[var(--danger)] hover:bg-[var(--danger-hover)]"
                >
                  Logout
                </button>
              )}
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}


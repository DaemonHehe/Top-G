"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/focus", label: "Focus" },
  { href: "/strength", label: "Strength" },
  { href: "/reach-out", label: "Reach Out" },
  { href: "/profile", label: "Profile" },
];

export default function NavigationBar({ onLogout }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href) => {
    if (href === "/") {
      return pathname === "/";
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
    <header className="sticky top-0 z-40 bg-[var(--surface)]/90 backdrop-blur border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 min-w-0">
            <span className="text-lg font-semibold text-[var(--text-primary)] truncate">Top-G</span>
            <span className="hidden text-sm text-[var(--text-secondary)] sm:inline">Productivity Suite</span>
          </Link>
          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className={desktopLinkClass(link.href)}>
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              type="button"
              className="md:hidden inline-flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-2 text-[var(--text-primary)] focus:outline-none"
              aria-label="Toggle navigation"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              <svg className={`h-5 w-5 transition-transform ${open ? "rotate-90" : ""}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M3 5h14a1 1 0 110 2H3a1 1 0 110-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 110 2H3a1 1 0 110-2z" clipRule="evenodd" />
              </svg>
            </button>
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
        {/* Mobile collapsible panel */}
        <div className={`md:hidden overflow-hidden transition-[max-height] duration-300 ${open ? "max-h-96" : "max-h-0"}`}>
          <nav className="flex flex-col gap-2 py-3">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-xl px-4 py-3 text-sm ${isActive(link.href) ? "bg-[var(--surface-muted)] text-[var(--text-primary)]" : "bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]"}`}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {onLogout && (
              <button
                onClick={() => {
                  setOpen(false);
                  onLogout();
                }}
                className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3 text-sm font-medium text-[var(--danger)] hover:bg-[var(--danger-hover)]"
              >
                Logout
              </button>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}



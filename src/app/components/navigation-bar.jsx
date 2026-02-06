"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "../lib/supabase-browser";

const NAV_LINKS = [
  { href: "/dashboard", label: "Home" },
  { href: "/focus", label: "Focus" },
  { href: "/strength", label: "Strength" },
  { href: "/protocols", label: "Protocols" },
  { href: "/reach-out", label: "Reach Out" },
  { href: "/profile", label: "Profile" },
];

export default function NavigationBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabaseBrowser.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        console.warn("Session check failed:", error);
      }
      setIsAuthed(Boolean(data?.session));
    });

    const { data: sub } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setIsAuthed(Boolean(session));
      }
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  const isActive = (href) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname?.startsWith(href);
  };

  const desktopLinkClass = (href) =>
    `text-sm font-medium transition-colors px-3 py-1.5 rounded-full ${
      isActive(href)
        ? "text-[var(--text-primary)] bg-[var(--surface-subtle)] border border-[var(--border)]"
        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
    }`;

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    setOpen(false);

    try {
      await supabaseBrowser.auth.signOut();
      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Navigation logout error:", error);
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[var(--surface)]/90 backdrop-blur border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href={isAuthed ? "/dashboard" : "/"} className="flex items-center gap-3 min-w-0">
            <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-2xl bg-[var(--surface-muted)]">
              <Image src="/Top-G-logo.png" alt="Top G" fill sizes="40px" priority className="object-contain" />
            </span>
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="text-base font-semibold text-[var(--text-primary)]">Top G</span>
              <span className="text-xs text-[var(--text-secondary)]">Productivity Suite</span>
            </div>
          </Link>
          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-3">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={desktopLinkClass(link.href)}
                aria-current={isActive(link.href) ? "page" : undefined}
              >
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
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="btn-secondary hidden text-sm font-medium transition-colors md:inline-flex disabled:cursor-wait disabled:opacity-70"
            >
              {loggingOut ? "Logging out..." : "Logout"}
            </button>
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
                aria-current={isActive(link.href) ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3 text-sm font-medium text-[var(--danger)] hover:bg-[var(--danger-hover)] disabled:cursor-wait disabled:opacity-70"
            >
              {loggingOut ? "Logging out..." : "Logout"}
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}

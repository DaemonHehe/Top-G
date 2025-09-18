"use client";

import type { SVGProps } from "react";
import { useTheme } from "./theme-provider";

function SunIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2" strokeLinecap="round" />
      <path d="M12 19v2" strokeLinecap="round" />
      <path d="M4.22 4.22l1.4 1.4" strokeLinecap="round" />
      <path d="M18.38 18.38l1.4 1.4" strokeLinecap="round" />
      <path d="M3 12h2" strokeLinecap="round" />
      <path d="M19 12h2" strokeLinecap="round" />
      <path d="M4.22 19.78l1.4-1.4" strokeLinecap="round" />
      <path d="M18.38 5.62l1.4-1.4" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path
        d="M21 12.79A9 9 0 0 1 11.21 3c0-.25 0-.51.02-.76A9 9 0 1 0 21 12.79Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={toggleTheme}
      className="group relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] shadow-lg transition duration-200 hover:border-[var(--accent)] hover:text-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      style={{ boxShadow: "0 15px 35px var(--muted)" }}
    >
      <span className="sr-only">Toggle theme</span>
      <span
        className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
          isDark ? "translate-y-full opacity-0" : "translate-y-0 opacity-100"
        }`}
        aria-hidden={isDark}
      >
        <SunIcon className="h-5 w-5" />
      </span>
      <span
        className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
          isDark ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
        }`}
        aria-hidden={!isDark}
      >
        <MoonIcon className="h-5 w-5" />
      </span>
    </button>
  );
}

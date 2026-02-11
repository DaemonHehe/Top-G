"use client";

import { useEffect, useMemo } from "react";

export default function AuthCallbackPage() {
  const appLink = useMemo(() => {
    if (typeof window === "undefined") return "topg://auth-callback";
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    const suffix = hash || search;
    return `topg://auth-callback${suffix}`;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const timer = setTimeout(() => {
      window.location.href = appLink;
    }, 300);
    return () => clearTimeout(timer);
  }, [appLink]);

  return (
    <div className="min-h-screen bg-[var(--background-muted)] flex items-center justify-center px-6">
      <div className="max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--text-muted)]">
          Top G Mobile
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">Confirming your account</h1>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          We&apos;re opening the Top G app to finish your sign-up.
        </p>
        <a
          href={appLink}
          className="mt-6 inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-5 py-2 text-sm font-semibold text-[var(--accent)]"
        >
          Open the app
        </a>
      </div>
    </div>
  );
}

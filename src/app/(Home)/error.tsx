"use client";

import Link from "next/link";

export default function HomeError({ error, reset }) {
  return (
    <div className="min-h-screen bg-[var(--background-muted)] text-[var(--text-primary)]">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center animate-fade-up">
        <p className="text-xs uppercase tracking-[0.5em] text-[var(--text-muted)]">Error</p>
        <h1 className="mt-4 text-3xl font-bold sm:text-4xl">Route failure</h1>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          {error?.message || "Something went wrong on this page."}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button className="btn-primary" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/dashboard" className="btn-secondary">
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

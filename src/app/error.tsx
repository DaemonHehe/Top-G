"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function RootError({ error, reset }) {
  useEffect(() => {
    console.error("App error boundary:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[var(--background-muted)] text-[var(--text-primary)]">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center animate-fade-up">
        <p className="text-xs uppercase tracking-[0.5em] text-[var(--text-muted)]">500</p>
        <h1 className="mt-4 text-3xl font-bold sm:text-4xl">System disruption</h1>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          Something broke on the route. Try again or head back to safety.
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

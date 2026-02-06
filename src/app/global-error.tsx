"use client";

import Link from "next/link";

export default function GlobalError() {
  return (
    <html>
      <body className="min-h-screen bg-[var(--background-muted)] text-[var(--text-primary)]">
        <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
          <p className="text-xs uppercase tracking-[0.5em] text-[var(--text-muted)]">Critical</p>
          <h1 className="mt-4 text-3xl font-bold sm:text-4xl">Global error</h1>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            The app hit a critical error. Reload the page or return to safety.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button className="btn-primary" onClick={() => location.reload()}>
              Reload
            </button>
            <Link href="/" className="btn-secondary">
              Back to landing
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}

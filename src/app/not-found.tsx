import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--background-muted)] text-[var(--text-primary)]">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center animate-fade-up">
        <p className="text-xs uppercase tracking-[0.5em] text-[var(--text-muted)]">404</p>
        <h1 className="mt-4 text-3xl font-bold sm:text-4xl">Lost the thread</h1>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          This route does not exist. Head back to the command center.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/dashboard" className="btn-primary">
            Go to dashboard
          </Link>
          <Link href="/" className="btn-secondary">
            Back to landing
          </Link>
        </div>
      </div>
    </div>
  );
}

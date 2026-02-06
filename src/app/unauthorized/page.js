import Link from "next/link";

export default function Unauthorized() {
  return (
    <div className="min-h-screen bg-[var(--background-muted)] text-[var(--text-primary)]">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center animate-fade-up">
        <p className="text-xs uppercase tracking-[0.5em] text-[var(--text-muted)]">401</p>
        <h1 className="mt-4 text-3xl font-bold sm:text-4xl">Authentication required</h1>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          You need to sign in before accessing this page.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/login" className="btn-primary">
            Sign in
          </Link>
          <Link href="/" className="btn-secondary">
            Back to landing
          </Link>
        </div>
      </div>
    </div>
  );
}

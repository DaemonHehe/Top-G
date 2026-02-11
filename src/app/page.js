import Link from "next/link";
import Image from "next/image";

const FEATURES = [
  {
    title: "Dialed-in routines",
    description: "Translate big ambitions into daily checklists your future self can actually execute.",
  },
  {
    title: "Coach on call",
    description: "Chat with the Top G assistant when you need a shot of accountability or a tactical nudge.",
  },
  {
    title: "Strength + focus",
    description: "Track workouts, wins, and outreach in one command center so nothing slips.",
  },
];

export const metadata = {
  title: "Top G | Elite execution starts here",
  description: "Stay lethal. The Top G productivity suite turns intent into momentum with coaching, structure, and style.",
};

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[var(--background)] via-[var(--background-muted)] to-[var(--surface-subtle)]">
      <div className="absolute inset-x-0 top-[-10rem] -z-10 mx-auto h-[32rem] w-[36rem] rounded-full bg-[var(--accent)]/10 blur-3xl" aria-hidden="true" />
      <div className="absolute inset-x-4 bottom-0 -z-10 mx-auto h-72 max-w-5xl rounded-3xl bg-[var(--surface)]/80 blur-3xl" aria-hidden="true" />

      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 pb-16 pt-12 sm:px-8 lg:px-10">
        <header className="flex flex-col items-center gap-6 text-center sm:gap-8 animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-[var(--text-secondary)]">
            Elite execution suite
          </span>
          <div className="flex flex-col items-center gap-4 sm:gap-5">
            <Image src="/topglogo.png" alt="Top G" width={68} height={68} className="h-16 w-16 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-sm" priority />
            <h1 className="text-balance text-4xl font-semibold leading-tight text-[var(--text-primary)] sm:text-5xl lg:text-6xl">
              Operate like the <span className="text-[var(--accent)]">Top G</span> you are
            </h1>
            <p className="max-w-2xl text-balance text-sm text-[var(--text-secondary)] sm:text-base">
              Top G is your all-in-one mission hub: sharpen focus, keep strength work organized, and stay connected to the right people. Less noise, more decisive action.
            </p>
          </div>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row">
            <Link href="/register" className="btn-primary w-full text-center sm:w-auto">
              Create your account
            </Link>
            <Link href="/login" className="btn-secondary w-full text-center sm:w-auto">
              Log in
            </Link>
          </div>
          <p className="text-xs uppercase tracking-[0.35em] text-[var(--text-extra-muted)]">
            Already inside? You will land in the command center.
          </p>
        </header>

        <main className="mt-16 grid gap-8 sm:mt-20 sm:grid-cols-2 lg:grid-cols-3 animate-fade-up">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="flex flex-col gap-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm transition hover:border-[var(--accent)]"
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                  <path
                    d="M5 12.5L9 16.5L19 6.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">{feature.title}</h2>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{feature.description}</p>
            </article>
          ))}
        </main>

        <section className="mt-20 flex flex-col items-center gap-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-6 py-10 text-center sm:px-10 sm:text-left animate-fade-up">
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] sm:text-3xl">
            Built for disciplined operators
          </h2>
          <p className="max-w-3xl text-sm leading-relaxed text-[var(--text-secondary)]">
            Whether you are stacking workouts, managing outreach, or leading a team, the Top G command center keeps everything aligned. It is designed for speed, clarity, and the pressure that comes with big stakes.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Link href="/register" className="btn-primary w-full text-center sm:w-auto">
              Start the mission
            </Link>
            <Link href="/login" className="btn-secondary w-full text-center sm:w-auto">
              I already have access
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}


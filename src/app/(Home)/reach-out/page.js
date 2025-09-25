"use client";

import NavigationBar from "../../components/navigation-bar";
import { useRouter } from "next/navigation";

const CONTACT_METHODS = [
  {
    label: "Email",
    value: "1991peacekeeper@gmail.com",
    href: "mailto:1991peacekeeper@gmail.com",
  },
  {
    label: "LinkedIn",
    value: "linkedin.com/in/topg-founder",
    href: "https://linkedin.com/in/topg-founder",
  },
  {
    label: "Twitter",
    value: "@topgproductivity",
    href: "https://twitter.com/topgproductivity",
  },
];

export default function ReachOut() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      router.push("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background-muted)]">
      <NavigationBar onLogout={handleLogout} />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        <header className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8" style={{ boxShadow: "var(--card-shadow)" }}>
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            Feedback & Questions
          </span>
          <h1 className="mt-4 text-3xl font-bold text-[var(--text-primary)]">
            We’d love to hear from you
          </h1>
          <p className="mt-3 text-[var(--text-secondary)]">
            Share your thoughts, report an issue, or tell us how we can improve. Your feedback helps us build a better experience.
          </p>
        </header>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6" style={{ boxShadow: "var(--card-shadow)" }}>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Ways to Reach Us</h2>
            <ul className="mt-4 space-y-4 text-sm text-[var(--text-secondary)]">
              {CONTACT_METHODS.map((method) => (
                <li key={method.label} className="flex flex-col">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    {method.label}
                  </span>
                  <a href={method.href} className="text-base font-medium text-[var(--text-primary)] hover:text-[var(--accent)]" target="_blank" rel="noreferrer">
                    {method.value}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6" style={{ boxShadow: "var(--card-shadow)" }}>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Common Topics</h2>
              <ul className="mt-4 list-disc space-y-3 pl-5 text-sm text-[var(--text-secondary)]">
                <li>Share your product experience or a testimonial.</li>
                <li>Report a bug or suggest a feature.</li>
                <li>Ask for guidance on using the platform.</li>
              </ul>
          </div>
        </section>

        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8" style={{ boxShadow: "var(--card-shadow)" }}>
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">Send Us Your Feedback</h2>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            Fill out the form and we’ll respond as soon as possible.
          </p>
          <form className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)]" htmlFor="contact-name">
                Name
              </label>
              <input id="contact-name" type="text" placeholder="Jane Doe" className="mt-1 w-full" />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)]" htmlFor="contact-email">
                Email
              </label>
              <input id="contact-email" type="email" placeholder="you@example.com" className="mt-1 w-full" />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)]" htmlFor="contact-message">
                Message
              </label>
              <textarea id="contact-message" className="mt-1 h-32 w-full resize-none" placeholder="Share what you are building and where you need support." />
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Form submissions are not wired yet. Email directly for immediate support.
            </p>
          </form>
        </section>
      </main>
    </div>
  );
}



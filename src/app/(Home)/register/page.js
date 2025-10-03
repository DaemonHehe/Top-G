"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

const HIGHLIGHTS = [
  {
    title: "Plan on purpose",
    description: "Translate the vision into sprints, rituals, and checkpoints you can execute daily.",
  },
  {
    title: "Coach in your corner",
    description: "Call in the assistant when you need momentum, accountability, or a tactical reset.",
  },
  {
    title: "Celebrate every rep",
    description: "Track workouts, outreach, and wins in one command center to keep the streak alive.",
  },
];

export default function Register() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        router.replace("/dashboard");
        router.refresh();
      } else {
        setError(data.message || "Registration failed");
      }
    } catch (registerError) {
      console.error("Registration request failed", registerError);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[var(--background)] via-[var(--background-muted)] to-[var(--surface-subtle)] px-4 py-12 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <Link href="/" className="inline-flex items-center gap-3 self-center text-sm font-semibold text-[var(--text-secondary)] transition hover:text-[var(--accent)]">
          <span className="relative h-10 w-10 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)]">
            <Image src="/Top-G-logo.png" alt="Top G" fill sizes="40px" className="object-contain" />
          </span>
          Back to landing
        </Link>

        <div className="w-full overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-xl">
          <div className="flex flex-col lg:flex-row">
            <div className="order-2 flex-1 p-6 sm:p-10 lg:order-1 lg:p-12">
              <div className="mb-8 space-y-3 text-center lg:text-left">
                <span className="theme-badge inline-block">Join the command center</span>
                <h1 className="text-balance text-3xl font-semibold text-[var(--text-primary)] sm:text-4xl">
                  Build rituals that keep you unstoppable
                </h1>
                <p className="text-sm text-[var(--text-secondary)] sm:text-base">
                  Create your Top G workspace in moments and start turning intent into decisive action.
                </p>
              </div>

              {error && <div className="theme-badge-danger mb-6 text-center lg:text-left">{error}</div>}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium text-[var(--text-secondary)]">
                    Full name
                  </label>
                  <input
                    className="w-full bg-[var(--surface-subtle)]"
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="Jordan Belfort"
                    autoComplete="name"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-[var(--text-secondary)]">
                    Email address
                  </label>
                  <input
                    className="w-full bg-[var(--surface-subtle)]"
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-[var(--text-secondary)]">
                    Password
                  </label>
                  <input
                    className="w-full bg-[var(--surface-subtle)]"
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    minLength={6}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                  />
                  <p className="text-xs text-[var(--text-muted)]">
                    Use a mix of letters, numbers, or symbols to strengthen your password.
                  </p>
                </div>

                <button type="submit" className="btn-primary w-full" disabled={loading}>
                  {loading ? "Creating your HQ..." : "Launch your workspace"}
                </button>
              </form>

              <p className="mt-8 text-center text-sm text-[var(--text-secondary)] lg:text-left">
                Already with us?{' '}
                <Link href="/login" className="font-semibold text-[var(--accent)]">
                  Sign in
                </Link>
              </p>
            </div>

            <aside className="order-1 flex flex-1 flex-col justify-between gap-8 bg-[var(--surface-subtle)] p-6 sm:p-10 lg:order-2 lg:max-w-md lg:p-12">
              <div className="space-y-5">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Why operators join Top G</h2>
                <ul className="grid gap-4">
                  {HIGHLIGHTS.map((highlight) => (
                    <li key={highlight.title} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{highlight.title}</p>
                      <p className="mt-2 text-sm text-[var(--text-secondary)]">{highlight.description}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text-secondary)]">
                <p className="font-semibold text-[var(--text-primary)]">Need a walkthrough?</p>
                <p className="mt-1">
                  Our onboarding takes less than five minutes. Create your command center, then hit the dashboard to plan the next move.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
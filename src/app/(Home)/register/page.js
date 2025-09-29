"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Register() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
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
    } catch (error) {
      console.error("Registration request failed", error);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background-muted)] px-4 py-16 transition-colors">
      <div
        className="theme-card w-full max-w-3xl overflow-hidden p-0 md:grid md:grid-cols-2"
        style={{ boxShadow: "var(--card-shadow)" }}
      >
        <div className="hidden h-full flex-col justify-between bg-[var(--surface-subtle)] p-12 text-[var(--text-secondary)] md:flex">
          <div>
            <span className="theme-badge inline-block">Plan smarter</span>
            <h2 className="mt-5 text-3xl font-semibold text-[var(--text-primary)]">
              Build rituals that keep you unstoppable
            </h2>
            <p className="mt-4 leading-relaxed">
              Craft tasks, review achievements, and make confident progress with a dashboard designed for clarity.
            </p>
          </div>
          <div className="mt-12 space-y-4 text-sm">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="font-semibold text-[var(--text-primary)]">Focus companion</p>
              <p className="mt-1 text-[var(--text-secondary)]">
                Segment tasks, visualise momentum, and secure every win in one place.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="font-semibold text-[var(--text-primary)]">Personal pacing</p>
              <p className="mt-1 text-[var(--text-secondary)]">
                Celebrate small victories with streaks and completion highlights.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center p-10">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold text-[var(--text-primary)]">
              Get started—your productivity HQ awaits
            </h1>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Sign up in seconds to plan smarter and track every win.
            </p>
          </div>

          {error && (
            <div className="theme-badge-danger mb-6 text-center">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label
                htmlFor="name"
                className="text-sm font-medium text-[var(--text-secondary)]"
              >
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
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-sm font-medium text-[var(--text-secondary)]"
              >
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
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-medium text-[var(--text-secondary)]"
              >
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
              />
              <p className="text-xs text-[var(--text-muted)]">Minimum 6 characters, mix letters & numbers for stronger security.</p>
            </div>

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "Creating account..." : "Launch your workspace"}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-[var(--text-secondary)]">
            Already with us?{' '}
            <Link href="/login" className="font-semibold text-[var(--accent)]">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

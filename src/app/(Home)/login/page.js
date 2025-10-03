"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";

export default function Login() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: formData.email.trim(),
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        router.replace("/dashboard");
        router.refresh();
      } else {
        setError(data.message || "Login failed");
      }
    } catch (loginError) {
      console.error("Login request failed", loginError);
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
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
        <Link href="/" className="inline-flex items-center gap-3 self-center text-sm font-semibold text-[var(--text-secondary)] transition hover:text-[var(--accent)]">
          <span className="relative h-10 w-10 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)]">
            <Image src="/Top-G-logo.png" alt="Top G" fill sizes="40px" className="object-contain" />
          </span>
          Back to landing
        </Link>

        <div className="w-full overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-xl">
          <div className="flex flex-col gap-8 p-6 sm:p-10 lg:flex-row lg:p-12">
            <div className="flex-1">
              <div className="mb-8 text-center lg:text-left">
                <span className="theme-badge inline-block">Welcome back</span>
                <h1 className="mt-4 text-balance text-3xl font-semibold text-[var(--text-primary)] sm:text-4xl">
                  Sign in to your Top G command center
                </h1>
                <p className="mt-3 text-sm text-[var(--text-secondary)] sm:text-base">
                  Organise the day, monitor progress, and celebrate wins from a single dashboard.
                </p>
              </div>

              {error && <div className="theme-badge-danger mb-6 text-center lg:text-left">{error}</div>}

              <form onSubmit={handleSubmit} className="space-y-5">
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
                  <div className="flex items-center justify-between text-sm">
                    <label htmlFor="password" className="font-medium text-[var(--text-secondary)]">
                      Password
                    </label>
                    <span className="text-xs uppercase tracking-[0.25em] text-[var(--text-muted)]">Keep it secret</span>
                  </div>
                  <div className="relative">
                    <input
                      className="w-full bg-[var(--surface-subtle)] pr-10"
                      type={showPassword ? "text" : "password"}
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      minLength={6}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-3 flex items-center text-[var(--text-secondary)] transition hover:text-[var(--accent)]"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button type="submit" className="btn-primary w-full" disabled={loading}>
                  {loading ? "Signing you in..." : "Enter profile"}
                </button>
              </form>
            </div>

            <aside className="lg:w-72">
              <div className="h-full rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-6 text-center lg:text-left">
                <p className="text-sm font-semibold text-[var(--text-primary)]">New operator?</p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  Create a Top G account to map your outreach, workouts, and focus drills in one place.
                </p>
                <Link href="/register" className="btn-secondary mt-6 inline-flex w-full justify-center">
                  Create an account
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

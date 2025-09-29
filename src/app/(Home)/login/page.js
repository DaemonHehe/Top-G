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

  const handleSubmit = async (e) => {
    e.preventDefault();
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
        router.replace("/profile");
        router.refresh();
      } else {
        setError(data.message || "Login failed");
      }
    } catch (error) {
      console.error("Login request failed", error);
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
        className="theme-card w-full max-w-lg p-10"
        style={{ boxShadow: "var(--card-shadow)" }}
      >
        <div className="mb-8 text-center">
          <span className="relative mx-auto mb-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)]">
            <Image src="/Top-G-logo.png" alt="Top G" fill sizes="56px" className="object-contain" />
          </span>
          <span className="theme-badge inline-block">Welcome back</span>
          <h1 className="mt-4 text-3xl font-semibold text-[var(--text-primary)]">
            Sign in to Top G
          </h1>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            Organise your day, monitor progress, and celebrate wins.
          </p>
        </div>

        {error && (
          <div className="theme-badge-danger mb-6 text-center">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
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

          <div className="flex items-center justify-between text-sm">
            <label
              htmlFor="password"
              className="font-medium text-[var(--text-secondary)]"
            >
              Password
            </label>
            <span className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">
              Keep it secret
            </span>
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
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-2 flex items-center text-[var(--text-secondary)] hover:text-[var(--accent)]"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Signing in..." : "Enter profile"}
          </button>
        </form>

        <div className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-5 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            New here?{" "}
            <Link href="/register" className="font-semibold text-[var(--accent)]">
              Create an account
            </Link>{" "}
            to start conquering your tasks.
          </p>
        </div>
      </div>
    </div>
  );
}





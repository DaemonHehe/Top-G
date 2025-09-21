"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/check", { credentials: "include" });
        if (response.ok) {
          router.replace("/dashboard");
        }
      } catch (error) {
        console.log("Not authenticated", error);
      }
    };

    checkAuth();
  }, [router]);

  return (
    <div className="min-h-screen bg-[var(--background)] transition-colors">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center gap-12 px-6 py-20 text-center md:px-12">
        <div className="space-y-6">
          <span className="theme-badge inline-block">Top-G Productivity Suite</span>
          <h1 className="text-4xl font-semibold text-[var(--text-primary)] md:text-6xl">
            Stay ruthless with your focus
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-[var(--text-secondary)]">
            Plan the day, track execution, and ship results.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <Link href="/register" className="btn-primary w-full sm:w-auto">
            Get started free
          </Link>
          <Link
            href="/login"
            className="btn-secondary w-full sm:w-auto"
          >
            I already have an account
          </Link>
        </div>

        <div className="grid w-full gap-6 md:grid-cols-3">
          <div className="theme-card p-6 text-left" style={{ boxShadow: "var(--card-shadow)" }}>
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
              Daily cadence
            </p>
            <h3 className="mt-3 text-xl font-semibold text-[var(--text-primary)]">
              Command central in one dashboard
            </h3>
            <p className="mt-2 text-[var(--text-secondary)]">
              Create, schedule, and complete without losing momentum. Your backlog, today’s focus, and wins stay synchronised.
            </p>
          </div>
          <div className="theme-card p-6 text-left" style={{ boxShadow: "var(--card-shadow)" }}>
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
              Strength Logging
            </p>
            <h3 className="mt-3 text-xl font-semibold text-[var(--text-primary)]">
              Track your lifts for hypertrophy
            </h3>
            <p className="mt-2 text-[var(--text-secondary)]">
              Log every bench press, squat, and deadlift. Monitor progressive overload, spot plateaus, and keep your gains on a steady climb.
            </p>
          </div>
          <div className="theme-card p-6 text-left" style={{ boxShadow: "var(--card-shadow)" }}>
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
              Streaks & velocity
            </p>
            <h3 className="mt-3 text-xl font-semibold text-[var(--text-primary)]">
              Track velocity, celebrate wins
            </h3>
            <p className="mt-2 text-[var(--text-secondary)]">
              Visualise streaks, surface blockers instantly, and track momentum with stats that reset at dawn.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

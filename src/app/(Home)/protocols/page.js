"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import NavigationBar from "../../components/navigation-bar";
import { fetchWithAuth } from "../../lib/supabase-browser";

function toISODate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function daysBetween(start, end) {
  if (!start || !end) return 0;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0;
  const diff = endDate.getTime() - startDate.getTime();
  return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)) + 1);
}

export default function ProtocolsPage() {
  const [loading, setLoading] = useState(true);
  const [blueprints, setBlueprints] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [badges, setBadges] = useState([]);
  const [notice, setNotice] = useState("");
  const [enrolling, setEnrolling] = useState("");
  const [cancelling, setCancelling] = useState("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const response = await fetchWithAuth("/api/protocols");
        if (!response.ok) {
          throw new Error("Failed to load protocols");
        }
        const payload = await response.json();
        if (!mounted) return;
        setBlueprints(Array.isArray(payload.blueprints) ? payload.blueprints : []);
        setTasks(Array.isArray(payload.tasks) ? payload.tasks : []);
        setEnrollments(Array.isArray(payload.enrollments) ? payload.enrollments : []);
        setBadges(Array.isArray(payload.badges) ? payload.badges : []);
        setNotice("");
      } catch (error) {
        console.error("Protocols load error:", error);
        if (mounted) setNotice("Unable to load protocols right now.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const tasksByBlueprint = useMemo(() => {
    const map = new Map();
    for (const task of tasks) {
      const list = map.get(task.blueprint_id) || [];
      list.push(task);
      map.set(task.blueprint_id, list);
    }
    return map;
  }, [tasks]);

  const enrollmentByBlueprint = useMemo(() => {
    const map = new Map();
    for (const enrollment of enrollments) {
      if (enrollment.blueprint_id) {
        map.set(enrollment.blueprint_id, enrollment);
      }
    }
    return map;
  }, [enrollments]);

  const handleEnroll = async (blueprintId) => {
    if (!blueprintId) return;
    setEnrolling(blueprintId);
    try {
      const response = await fetchWithAuth("/api/protocols", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blueprintId }),
      });
      if (!response.ok) {
        throw new Error("Enrollment failed");
      }
      const payload = await response.json();
      setEnrollments((prev) => [payload.enrollment, ...prev.filter((e) => e.id !== payload.enrollment?.id)]);
      setNotice("");
    } catch (error) {
      console.error("Protocol enroll error:", error);
      setNotice("Unable to enroll in that protocol.");
    } finally {
      setEnrolling("");
    }
  };

  const handleCancel = async (blueprintId, enrollmentId) => {
    if (!blueprintId && !enrollmentId) return;
    setCancelling(blueprintId || enrollmentId);
    try {
      const response = await fetchWithAuth("/api/protocols", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blueprintId: blueprintId || null,
          enrollmentId: enrollmentId || null,
        }),
      });
      if (!response.ok) {
        throw new Error("Cancel failed");
      }
      setEnrollments((prev) =>
        prev.map((enrollment) =>
          enrollment.id === enrollmentId ? { ...enrollment, status: "Cancelled" } : enrollment
        )
      );
      setNotice("");
    } catch (error) {
      console.error("Protocol cancel error:", error);
      setNotice("Unable to cancel this protocol.");
    } finally {
      setCancelling("");
    }
  };

  const today = toISODate(new Date());

  return (
    <div className="min-h-screen bg-[var(--background-muted)] text-[var(--text-primary)]">
      <NavigationBar />
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-16 pt-12 sm:px-6 lg:px-10 animate-fade-up">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.45em] text-[var(--text-muted)]">Protocols</p>
          <h1 className="text-3xl font-semibold sm:text-4xl">Active Protocols</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Enroll once. Wake up to a ready-made plan every morning.
          </p>
          {notice && <p className="text-xs text-[var(--danger)]">{notice}</p>}
        </header>

        <section className="mt-10 space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {loading && (
              <>
                <div className="h-64 rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] animate-pulse" />
                <div className="h-64 rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] animate-pulse" />
                <div className="h-64 rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] animate-pulse" />
              </>
            )}

            {!loading && blueprints.length === 0 && (
              <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--text-secondary)]">
                No protocols available yet. Add blueprints in the database to activate this system.
              </div>
            )}

            {!loading &&
              blueprints.map((blueprint) => {
                const enrollment = enrollmentByBlueprint.get(blueprint.id);
                const isActive = enrollment?.status === "Active";
                const isCompleted = enrollment?.status === "Completed";
                const isFailed = enrollment?.status === "Failed";
                const isCancelled = enrollment?.status === "Cancelled";
                const totalDays = Number(blueprint.duration_days ?? 0) || 0;
                const daysLeft = enrollment?.end_date ? daysBetween(today, enrollment.end_date) : totalDays;
                const taskList = tasksByBlueprint.get(blueprint.id) || [];

                return (
                  <div
                    key={blueprint.id}
                    className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-[0.35em] text-[var(--text-muted)]">
                        {blueprint.category || "Protocol"}
                      </p>
                      {isCompleted && <span className="text-xs text-amber-400">Completed</span>}
                      {isActive && <span className="text-xs text-[var(--accent)]">Active</span>}
                      {isFailed && <span className="text-xs text-[var(--danger)]">Failed</span>}
                      {isCancelled && <span className="text-xs text-[var(--text-muted)]">Cancelled</span>}
                    </div>
                    <h2 className="mt-3 text-xl font-semibold text-[var(--text-primary)]">{blueprint.title}</h2>
                    {blueprint.description && (
                      <p className="mt-2 text-sm text-[var(--text-secondary)]">{blueprint.description}</p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-3 text-xs text-[var(--text-muted)]">
                      <span>{totalDays} days</span>
                      <span className="text-[var(--accent)]">+{blueprint.reward_xp} XP</span>
                      {isActive && enrollment?.end_date && <span>{daysLeft} days left</span>}
                    </div>

                    {taskList.length > 0 && (
                      <ul className="mt-4 space-y-2 text-sm text-[var(--text-secondary)]">
                        {taskList.slice(0, 4).map((task) => (
                          <li key={task.id} className="flex items-center justify-between">
                            <span>{task.title}</span>
                            {task.is_smart && (
                              <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
                                Smart
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    {!isActive && !isCompleted && (
                      <button
                        type="button"
                        onClick={() => handleEnroll(blueprint.id)}
                        disabled={enrolling === blueprint.id}
                        className="btn-primary mt-5 w-full"
                      >
                        {enrolling === blueprint.id ? "Enrolling..." : "Enroll"}
                      </button>
                    )}

                    {isActive && (
                      <button
                        type="button"
                        onClick={() => handleCancel(blueprint.id, enrollment?.id)}
                        disabled={cancelling === blueprint.id}
                        className="btn-secondary mt-5 w-full"
                      >
                        {cancelling === blueprint.id ? "Cancelling..." : "Cancel protocol"}
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        </section>

        {badges.length > 0 && (
          <section className="mt-12">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Earned badges</h2>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {badges.map((badge) => (
                <div
                  key={badge.id}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center text-xs text-[var(--text-muted)]"
                >
                  {badge.badge_url ? (
                    <Image
                      src={badge.badge_url}
                      alt="Badge"
                      width={64}
                      height={64}
                      unoptimized
                      loader={({ src }) => src}
                      className="mx-auto h-16 w-16 object-contain"
                    />
                  ) : (
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-muted)]">
                      Badge
                    </div>
                  )}
                  <p className="mt-2">Awarded</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

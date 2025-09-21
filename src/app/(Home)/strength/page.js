"use client";

import { useEffect, useMemo, useState } from "react";
import NavigationBar from "../../components/navigation-bar";
import { useRouter } from "next/navigation";
import { EXERCISE_GROUPS, getExerciseById, findExerciseIdByLabel } from "../../lib/exercises";

const CUSTOM_EXERCISE_ID = "custom";

const initialForm = {
  exerciseId: "",
  customExercise: "",
  weight: "",
  reps: "",
  notes: "",
  date: "",
};

const toNumber = (value) => {
  const coerced = Number(value);
  return Number.isFinite(coerced) ? coerced : 0;
};

const normaliseEntry = (entry) => {
  if (!entry) return null;
  const exerciseId = entry.exerciseId || findExerciseIdByLabel(entry.exercise);
  const canonical = exerciseId ? getExerciseById(exerciseId) : null;
  const exerciseLabel = canonical?.label || entry.exerciseLabel || entry.exercise || "";
  const recordedAt = entry.recordedAt ? new Date(entry.recordedAt).getTime() : Date.now();

  return {
    ...entry,
    _id: entry._id || entry.id,
    exerciseId: exerciseId || null,
    exerciseLabel,
    weight: toNumber(entry.weight),
    reps: toNumber(entry.reps),
    recordedAt,
  };
};

export default function Strength() {
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncMessage, setSyncMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const fetchLifts = async () => {
      try {
        const response = await fetch("/api/lifts", { credentials: "include" });
        if (!response.ok) {
          throw new Error("Failed to fetch lifts");
        }
        const data = await response.json();
        if (isMounted) {
          setEntries(Array.isArray(data) ? data.map(normaliseEntry) : []);
          setSyncMessage("");
        }
      } catch (error) {
        console.error("Unable to load lifts:", error);
        if (isMounted) {
          setSyncMessage("Offline mode: new lifts stay local until sync succeeds.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchLifts();
    return () => {
      isMounted = false;
    };
  }, []);

  const metrics = useMemo(() => {
    if (entries.length === 0) {
      return { total: 0, unique: 0, heaviest: null, recent: [] };
    }

    const uniqueKeys = new Set();
    let heaviest = null;

    for (const entry of entries) {
      const uniqueKey = entry.exerciseId || entry.exerciseLabel?.toLowerCase() || "";
      if (uniqueKey) {
        uniqueKeys.add(uniqueKey);
      }
      if (
        !heaviest ||
        entry.weight > heaviest.weight ||
        (entry.weight === heaviest.weight && (entry.recordedAt || 0) > (heaviest.recordedAt || 0))
      ) {
        heaviest = entry;
      }
    }

    return {
      total: entries.length,
      unique: uniqueKeys.size,
      heaviest,
      recent: entries.slice(0, 5),
    };
  }, [entries]);

  const handleChange = (field) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleExerciseSelect = (event) => {
    const value = event.target.value;
    setForm((prev) => ({
      ...prev,
      exerciseId: value,
      customExercise: value === CUSTOM_EXERCISE_ID ? prev.customExercise : "",
    }));
  };

  const resetForm = () => {
    setForm(initialForm);
  };

  const handleAddEntry = async (event) => {
    event.preventDefault();
    const selectedExercise = form.exerciseId && form.exerciseId !== CUSTOM_EXERCISE_ID ? getExerciseById(form.exerciseId) : null;
    const customLabel = form.customExercise.trim();
    const exerciseLabel = selectedExercise?.label || customLabel;
    const weightInput = form.weight.trim();
    const repsInput = form.reps.trim();

    if (!exerciseLabel || !weightInput || !repsInput) {
      return;
    }

    const exerciseId = selectedExercise?.id || findExerciseIdByLabel(exerciseLabel) || null;
    const weight = toNumber(weightInput);
    const reps = toNumber(repsInput);

    if (weight <= 0 || reps <= 0) {
      return;
    }

    const optimisticId = `local-${Date.now()}`;
    const baseEntry = {
      _id: optimisticId,
      exerciseId,
      exercise: exerciseLabel,
      exerciseLabel,
      weight,
      reps,
      notes: form.notes.trim(),
      date: form.date || new Date().toISOString().slice(0, 10),
      recordedAt: Date.now(),
      isLocal: true,
    };

    const normalisedOptimistic = normaliseEntry(baseEntry);
    setIsSaving(true);
    setEntries((prev) => [normalisedOptimistic, ...prev]);
    resetForm();

    try {
      const response = await fetch("/api/lifts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseId,
          exercise: exerciseLabel,
          weight,
          reps,
          notes: normalisedOptimistic.notes,
          date: normalisedOptimistic.date,
          recordedAt: new Date(normalisedOptimistic.recordedAt).toISOString(),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.message || "Failed to save lift");
      }

      setEntries((prev) =>
        prev.map((item) => (item._id === optimisticId ? normaliseEntry(payload) : item))
      );
      setSyncMessage("");
    } catch (error) {
      console.error("Lift save error:", error);
      setSyncMessage("Lift saved locally. It will sync once the server is reachable.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEntry = async (id) => {
    const target = entries.find((entry) => entry._id === id);
    if (!target) return;

    setEntries((prev) => prev.filter((entry) => entry._id !== id));

    if (target.isLocal || !id || id.startsWith("local-")) {
      return;
    }

    try {
      const response = await fetch("/api/lifts", {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || "Failed to delete lift");
      }
    } catch (error) {
      console.error("Lift delete error:", error);
      setSyncMessage("Unable to delete lift on the server. It will reappear after refresh if it still exists.");
      try {
        const refresh = await fetch("/api/lifts", { credentials: "include" });
        if (refresh.ok) {
          const data = await refresh.json();
          setEntries(Array.isArray(data) ? data.map(normaliseEntry) : []);
        }
      } catch (refreshError) {
        console.error("Lift refresh error:", refreshError);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      router.push("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background-muted)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)] mx-auto"></div>
          <p className="mt-4 text-[var(--text-secondary)]">Loading your strength ledger...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background-muted)]">
      <NavigationBar onLogout={handleLogout} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        <header className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8" style={{ boxShadow: "var(--card-shadow)" }}>
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                Strength - Lift Journal
              </span>
              <h1 className="text-3xl font-bold text-[var(--text-primary)]">Strength Tracking Hub</h1>
              <p className="text-[var(--text-secondary)] max-w-xl">
                Log top sets, monitor progressive overload, and keep your lift history synced with the rest of your operation.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--text-secondary)]">
              <p className="text-lg font-semibold text-[var(--text-primary)]">{metrics.total}</p>
              <p>Total sets logged</p>
            </div>
          </div>
          {syncMessage && (
            <p className="mt-4 text-sm text-[var(--warning-text)]">{syncMessage}</p>
          )}
        </header>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6" style={{ boxShadow: "var(--card-shadow)" }}>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Log a new lift</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Capture your primary sets with weight, rep count, and optional notes.
            </p>
            <form onSubmit={handleAddEntry} className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-medium text-[var(--text-secondary)]" htmlFor="exercise-select">
                  Exercise
                </label>
                <select
                  id="exercise-select"
                  value={form.exerciseId}
                  onChange={handleExerciseSelect}
                  required={form.customExercise.trim() === ""}
                  className="w-full"
                >
                  <option value="">Select exercise</option>
                  {EXERCISE_GROUPS.map((group) => (
                    <optgroup key={group.id} label={group.label}>
                      {group.exercises.map((exercise) => (
                        <option key={exercise.id} value={exercise.id}>
                          {exercise.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                  <option value={CUSTOM_EXERCISE_ID}>Custom exercise</option>
                </select>
                {form.exerciseId === CUSTOM_EXERCISE_ID && (
                  <input
                    type="text"
                    value={form.customExercise}
                    onChange={handleChange("customExercise")}
                    placeholder="Enter exercise name"
                    className="w-full"
                    required
                  />
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--text-secondary)]">Weight (kg)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={form.weight}
                  onChange={handleChange("weight")}
                  className="mt-1 w-full"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--text-secondary)]">Reps</label>
                <input
                  type="number"
                  min="1"
                  value={form.reps}
                  onChange={handleChange("reps")}
                  className="mt-1 w-full"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--text-secondary)]">Date</label>
                <input type="date" value={form.date} onChange={handleChange("date")} className="mt-1 w-full" />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-[var(--text-secondary)]">Notes (optional)</label>
                <textarea
                  value={form.notes}
                  onChange={handleChange("notes")}
                  className="mt-1 h-24 w-full resize-none"
                  placeholder="Bar speed, rest time, or cues that helped."
                />
              </div>
              <div className="md:col-span-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <button type="submit" disabled={isSaving} className="btn-primary w-full sm:w-auto">
                  {isSaving ? "Saving..." : "Log set"}
                </button>
                <button type="button" onClick={resetForm} className="btn-secondary w-full sm:w-auto">
                  Reset form
                </button>
              </div>
            </form>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6" style={{ boxShadow: "var(--card-shadow)" }}>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Progress pulse</h2>
              <ul className="mt-4 space-y-3 text-sm text-[var(--text-secondary)]">
                <li>Unique lifts tracked: {metrics.unique}</li>
                <li>
                  Top lift:
                  {metrics.heaviest ? (
                    <span className="ml-2 text-[var(--text-primary)] font-semibold">
                      {metrics.heaviest.exerciseLabel} - {metrics.heaviest.weight} kg x {metrics.heaviest.reps}
                    </span>
                  ) : (
                    <span className="ml-2 text-[var(--text-muted)]">Log sets to reveal your top output.</span>
                  )}
                </li>
              </ul>
            </div>
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6" style={{ boxShadow: "var(--card-shadow)" }}>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Next actions</h2>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-[var(--text-secondary)]">
                <li>Tag notes with tempo or rest time to surface patterns.</li>
                <li>Review the dashboard Home tab for velocity comparisons.</li>
                <li>Sync failed lifts with task reviews to unblock progress.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8" style={{ boxShadow: "var(--card-shadow)" }}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">Lift history</h2>
              <p className="text-sm text-[var(--text-secondary)]">Your most recent entries appear first. Use them to plan your next progression jumps.</p>
            </div>
          </div>
          {entries.length === 0 ? (
            <p className="mt-6 text-sm text-[var(--text-secondary)]">No lifts logged yet. Start with the form above to capture your training data.</p>
          ) : (
            <ul className="mt-6 space-y-4">
              {entries.map((entry) => (
                <li key={entry._id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-[var(--text-primary)]">{entry.exerciseLabel}</h3>
                        {entry.isLocal && (
                          <span className="rounded-full border border-[var(--warning-border)] bg-[var(--warning-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--warning-text)]">
                            Unsynced
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-[var(--text-secondary)]">
                        {entry.weight} kg x {entry.reps} reps
                        <span className="ml-3 text-[var(--text-muted)]">{entry.date}</span>
                      </p>
                      {entry.notes && (
                        <p className="text-sm text-[var(--text-secondary)]">{entry.notes}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteEntry(entry._id)}
                      className="self-start text-sm text-[var(--danger)] hover:text-[var(--danger-hover)]"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}








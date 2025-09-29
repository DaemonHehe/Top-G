"use client";

import { useEffect, useMemo, useState } from "react";
import NavigationBar from "../../components/navigation-bar";
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


const formatWeekRange = (weekStartIso, weekEndIso) => {
  if (!weekStartIso) return "Week";
  try {
    const start = new Date(weekStartIso);
    const end = weekEndIso ? new Date(weekEndIso) : null;
    const startLabel = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const endLabel = end ? end.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
    return endLabel ? `${startLabel} - ${endLabel}` : startLabel;
  } catch (error) {
    console.warn('Week label format error:', error);
    return weekStartIso;
  }
};

const formatWeightDisplay = (weight) => {
  if (!Number.isFinite(weight) || weight <= 0) return "No top set";
  return `${weight} kg`;
};

const SPARKLINE_WIDTH = 160;
const SPARKLINE_HEIGHT = 60;

const buildSparklinePoints = (values, width = SPARKLINE_WIDTH, height = SPARKLINE_HEIGHT) => {
  if (!Array.isArray(values) || values.length === 0) {
    return { points: `0,${height}`, latest: { x: 0, y: height / 2 } };
  }

  const numericValues = values.map((value) => (Number.isFinite(Number(value)) ? Number(value) : 0));
  const max = Math.max(...numericValues);
  const min = Math.min(...numericValues);
  const range = max - min;
  const step = numericValues.length > 1 ? width / (numericValues.length - 1) : width;

  const coords = numericValues.map((value, index) => {
    const x = Number((index * step).toFixed(2));
    const ratio = range > 0 ? (value - min) / range : 0.5;
    const y = Number((height - ratio * height).toFixed(2));
    return { x, y };
  });

  const points = coords.map(({ x, y }) => `${x},${y}`).join(' ');
  const latest = coords[coords.length - 1] || { x: 0, y: height / 2 };

  return { points, latest };
};

const formatVolumeLabel = (value) => {
  if (!Number.isFinite(value)) return "0";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }
  if (abs >= 100) {
    return Number(value.toFixed(1)).toString();
  }
  return value.toFixed(2).replace(/\.00$/, "");
};

export default function Strength() {
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncMessage, setSyncMessage] = useState("");
  const [filterExercise, setFilterExercise] = useState("");
  const [collapsed, setCollapsed] = useState({}); // { [label]: boolean }

  const [weeklyLoading, setWeeklyLoading] = useState(true);
  const [weeklyError, setWeeklyError] = useState("");
  const [overallTrendWeeks, setOverallTrendWeeks] = useState([]);
  const [overallPlateau, setOverallPlateau] = useState(null);


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

    const fetchWeekly = async () => {
      try {
        const response = await fetch("/api/lifts/weekly", { credentials: "include" });
        if (!response.ok) {
          throw new Error("Failed to fetch weekly lifts");
        }
        const payload = await response.json();
        if (!isMounted) {
          return;
        }
        const overall = payload?.overall || null;
        const overallWeeks = Array.isArray(overall?.weeks) ? overall.weeks.filter(Boolean) : [];
        setOverallTrendWeeks(overallWeeks);
        setOverallPlateau(overall?.plateau ?? null);
        setWeeklyError("");
      } catch (error) {
        console.error("Unable to load weekly lifts:", error);
        if (isMounted) {
          setWeeklyError("Weekly trend unavailable. We'll try again soon.");
          setOverallTrendWeeks([]);
          setOverallPlateau(null);
        }
      } finally {
        if (isMounted) {
          setWeeklyLoading(false);
        }
      }
    };

    setLoading(true);
    setWeeklyLoading(true);
    setWeeklyError("");
    fetchLifts();
    fetchWeekly();

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

  const groupedByExercise = useMemo(() => {
    // Apply filter (by label) if set
    const source = filterExercise ? entries.filter((e) => (e.exerciseLabel || "Unknown") === filterExercise) : entries;

    const groups = {};
    for (const entry of source) {
      const label = entry.exerciseLabel || "Unknown";
      if (!groups[label]) groups[label] = [];
      groups[label].push(entry);
    }
    // Sort each group's entries by recordedAt desc (most recent first)
    for (const label of Object.keys(groups)) {
      groups[label].sort((a, b) => (b.recordedAt || 0) - (a.recordedAt || 0));
    }
    // Sort group labels by most recent activity desc
    const labels = Object.keys(groups).sort((a, b) => {
      const aRecent = groups[a][0]?.recordedAt || 0;
      const bRecent = groups[b][0]?.recordedAt || 0;
      return bRecent - aRecent;
    });
    return { labels, groups };
  }, [entries, filterExercise]);

  const overallTrend = useMemo(() => {
    const weeks = Array.isArray(overallTrendWeeks) ? overallTrendWeeks.filter(Boolean) : [];
    if (weeks.length === 0) {
      return null;
    }

    const sortedWeeks = weeks
      .map((week) => ({
        ...week,
        totalVolume: Number(week.totalVolume ?? 0),
        totalSets: Number(week.totalSets ?? 0),
        averageWeight: Number(week.averageWeight ?? 0),
        topWeight: Number(week.topWeight ?? 0),
        topReps: Number(week.topReps ?? 0),
      }))
      .sort((a, b) => {
        const aTime = a.weekStartIso ? new Date(a.weekStartIso).getTime() : 0;
        const bTime = b.weekStartIso ? new Date(b.weekStartIso).getTime() : 0;
        return aTime - bTime;
      });

    const recentWeeks = sortedWeeks.slice(-6);
    const volumes = recentWeeks.map((week) => (Number.isFinite(week.totalVolume) ? week.totalVolume : 0));
    const sparkline = buildSparklinePoints(volumes);
    const latest = recentWeeks[recentWeeks.length - 1] || null;
    const previous = recentWeeks[recentWeeks.length - 2] || null;

    const latestVolume = latest ? Number(latest.totalVolume ?? 0) : null;
    const previousVolume = previous ? Number(previous.totalVolume ?? 0) : null;
    const volumeDelta =
      latestVolume !== null && previousVolume !== null
        ? Number((latestVolume - previousVolume).toFixed(2))
        : null;

    return {
      weeks: recentWeeks,
      startLabel: recentWeeks[0] ? formatWeekRange(recentWeeks[0].weekStartIso, recentWeeks[0].weekEndIso) : "",
      endLabel: latest ? formatWeekRange(latest.weekStartIso, latest.weekEndIso) : "",
      sparkline,
      latest,
      latestVolume,
      previousVolume,
      volumeDelta,
      latestSets: latest ? Number(latest.totalSets ?? 0) : 0,
      averageWeight: latest ? Number(latest.averageWeight ?? 0) : 0,
      topWeight: latest ? Number(latest.topWeight ?? 0) : null,
      topReps: latest ? Number(latest.topReps ?? 0) : null,
      topExerciseLabel: latest?.topExerciseLabel || "",
      plateau: overallPlateau || null,
    };
  }, [overallTrendWeeks, overallPlateau]);

  const allExerciseLabels = useMemo(() => {
    const set = new Set(entries.map((e) => e.exerciseLabel || "Unknown"));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [entries]);

  // Default-collapse groups on small screens when labels list changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth >= 640) return; // sm breakpoint
    setCollapsed((prev) => {
      const next = { ...prev };
      for (const label of groupedByExercise.labels) {
        if (next[label] === undefined) next[label] = true;
      }
      return next;
    });
  }, [groupedByExercise.labels]);

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
      <NavigationBar />
      <main className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8 sm:space-y-10">
        <header className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8" style={{ boxShadow: "var(--card-shadow)" }}>
          <div className="flex flex-col gap-4 sm:gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                Strength - Lift Journal
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">Strength Tracking Hub</h1>
              <p className="text-sm sm:text-base text-[var(--text-secondary)] max-w-xl italic">
                “The pain you feel today will be the strength you feel tomorrow.”
                <br />
                <span className="text-[var(--text-muted)]">— Arnold Schwarzenegger</span>
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-3 sm:p-4 text-sm text-[var(--text-secondary)]">
              <p className="text-base sm:text-lg font-semibold text-[var(--text-primary)]">{metrics.total}</p>
              <p>Total sets logged</p>
            </div>
          </div>
          {syncMessage && (
            <p className="mt-3 sm:mt-4 text-sm text-[var(--warning-text)]">{syncMessage}</p>
          )}
        </header>

        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8" style={{ boxShadow: "var(--card-shadow)" }}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-[var(--text-primary)]">Overall strength trend</h2>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)]">Aggregated weekly volume across every logged lift.</p>
            </div>
            {overallTrend?.plateau?.isPlateau && (
              <span className="rounded-full border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-1 text-xs font-semibold text-[var(--warning-text)]">
                Volume plateau ({overallTrend.plateau?.stagnantWeeks ?? 0} weeks)
              </span>
            )}
          </div>
          {weeklyLoading ? (
            <div className="mt-6 flex h-20 items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--accent)]"></div>
            </div>
          ) : weeklyError ? (
            <p className="mt-4 text-sm text-[var(--text-secondary)]">{weeklyError}</p>
          ) : !overallTrend ? (
            <p className="mt-4 text-sm text-[var(--text-secondary)]">Log lifts across consecutive weeks to see your global strength trend.</p>
          ) : (
            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
              <div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                  <svg
                    className="h-24 w-full text-[var(--accent)]"
                    viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
                    preserveAspectRatio="none"
                  >
                    <polyline
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      points={overallTrend.sparkline.points}
                    />
                    <circle cx={overallTrend.sparkline.latest.x} cy={overallTrend.sparkline.latest.y} r="3" fill="currentColor" />
                  </svg>
                  <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                    <span>{overallTrend.startLabel || "Start"}</span>
                    <span>{overallTrend.endLabel || "Latest"}</span>
                  </div>
                </div>
                <p className="mt-4 text-xs sm:text-sm text-[var(--text-secondary)]">Weekly volume sums every logged set. Keep stacking consistent weeks to accelerate progress.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Volume</p>
                  <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
                    {formatVolumeLabel(overallTrend.latestVolume ?? 0)} kg
                  </p>
                  {overallTrend.volumeDelta !== null && (
                    <p className={`text-xs ${overallTrend.volumeDelta >= 0 ? "text-[var(--success-text)]" : "text-[var(--danger)]"}`}>
                      {overallTrend.volumeDelta >= 0 ? "+" : ""}
                      {formatVolumeLabel(overallTrend.volumeDelta)} kg vs prev.
                    </p>
                  )}
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Sets logged</p>
                  <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{overallTrend.latestSets}</p>
                  <p className="text-xs text-[var(--text-secondary)]">For week ending {overallTrend.endLabel || "latest"}</p>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Avg load</p>
                  <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
                    {overallTrend.averageWeight > 0 ? `${overallTrend.averageWeight.toFixed(1)} kg` : "No data"}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">Per logged set</p>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Top set</p>
                  <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{formatWeightDisplay(overallTrend.topWeight)}</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {overallTrend.topExerciseLabel
                      ? `${overallTrend.topExerciseLabel} - ${overallTrend.topReps || 0} reps`
                      : "Log lifts to see highlights"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6" style={{ boxShadow: "var(--card-shadow)" }}>
            <h2 className="text-base sm:text-lg font-semibold text-[var(--text-primary)]">Log a new lift</h2>
            <p className="mt-1 text-xs sm:text-sm text-[var(--text-secondary)]">
              Capture your primary sets with weight, rep count, and optional notes.
            </p>
            <form onSubmit={handleAddEntry} className="mt-4 sm:mt-6 grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
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
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Training Tips</h2>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-[var(--text-secondary)]">
                <li>Progressive overload works best with small weekly weight jumps.</li>
                <li>Prioritise compound lifts before isolation work for maximal strength gains.</li>
                <li>Sleep 7-9 hours to optimise recovery and muscle growth.</li>
              </ul>
            </div>
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6" style={{ boxShadow: "var(--card-shadow)" }}>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Recovery Checklist</h2>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-[var(--text-secondary)]">
                <li>Stretch major muscle groups for 10-15 minutes post-workout.</li>
                <li>Drink at least 2-3 L of water throughout the day.</li>
                <li>Plan at least one full rest day every 5-7 days.</li>
              </ul>
            </div>
          </div>
        </section>
        {/* Lift history - grouped and collapsible */}
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8" style={{ boxShadow: "var(--card-shadow)" }}>
          <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-[var(--text-primary)]">Lift history</h2>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)]">Use the filter to focus on one lift.</p>
            </div>
            <div className="sm:min-w-[220px]">
              <label className="text-sm font-medium text-[var(--text-secondary)]">Filter by exercise</label>
              <select
                className="mt-1 w-full"
                value={filterExercise}
                onChange={(e) => setFilterExercise(e.target.value)}
              >
                <option value="">All exercises</option>
                {allExerciseLabels.map((label) => (
                  <option key={label} value={label}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          {entries.length === 0 ? (
            <p className="mt-6 text-sm text-[var(--text-secondary)]">No lifts logged yet. Start with the form above to capture your training data.</p>
          ) : (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {groupedByExercise.labels.map((label) => (
                <div key={label} className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }))}
                    className="w-full flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 md:px-4 md:py-3 text-left"
                  >
                    <span className="text-base md:text-lg font-semibold text-[var(--text-primary)] truncate" title={label}>{label}</span>
                    <span className="flex items-center gap-2 md:gap-3 text-xs md:text-sm text-[var(--text-secondary)]">
                      <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-xs">{groupedByExercise.groups[label].length} sets</span>
                      <svg className={`h-4 w-4 transition-transform ${collapsed[label] ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.084l3.71-3.853a.75.75 0 111.08 1.04l-4.24 4.4a.75.75 0 01-1.08 0l-4.24-4.4a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                      </svg>
                    </span>
                  </button>
                  {!collapsed[label] && (
                    <ul className="space-y-3 md:space-y-4">
                      {groupedByExercise.groups[label].map((entry) => (
                        <li key={entry._id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 md:p-5">
                          <div className="flex flex-col gap-2 md:gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                {entry.isLocal && (
                                  <span className="rounded-full border border-[var(--warning-border)] bg-[var(--warning-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--warning-text)]">Unsynced</span>
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
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}











"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import NavigationBar from "../../components/navigation-bar";
import { BIG_FOUR_EXERCISES, getExerciseById, findExerciseIdByLabel } from "../../lib/exercises";
import { fetchWithAuth, supabaseBrowser } from "../../lib/supabase-browser";

const STATUS_LABELS = {
  pending: "Pending",
  completed: "Completed",
  failed: "Logged as failed",
};

const STATUS_BADGE_CLASSES = {
  pending: "bg-[var(--neutral-bg)] border border-[var(--neutral-border)] text-[var(--neutral-text)]",
  completed: "bg-[var(--success-bg)] border border-[var(--success-border)] text-[var(--success-text)]",
  failed: "bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger-text)]",
};

const COMPACT_WEEKDAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", "Sun"];

const CONTRIBUTION_LEVEL_STYLES = [
  { backgroundColor: "var(--surface-muted)", borderColor: "var(--border)", opacity: 1 },
  { backgroundColor: "var(--accent)", borderColor: "var(--accent)", opacity: 0.25 },
  { backgroundColor: "var(--accent)", borderColor: "var(--accent)", opacity: 0.45 },
  { backgroundColor: "var(--accent)", borderColor: "var(--accent)", opacity: 0.65 },
  { backgroundColor: "var(--accent)", borderColor: "var(--accent)", opacity: 0.85 },
];

const WEEKS_TO_SHOW = 53;

const DEFAULT_PROFILE = {
  name: "San Shein Phyo",
  email: "mgsan2163@gmail.com",
};

const RANKS = [
  { name: "Initiate", min: 0, max: 499 },
  { name: "Hustler", min: 500, max: 1499 },
  { name: "Operator", min: 1500, max: 3499 },
  { name: "Kingpin", min: 3500, max: 6999 },
  { name: "Top-G", min: 7000, max: Infinity },
];

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function toISODate(date) {
  return startOfDay(date).toISOString().slice(0, 10);
}

function shiftDate(date, amount) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function getIsoDay(date) {
  return (date.getDay() + 6) % 7;
}

function getRankProgress(totalXp = 0) {
  const xp = Math.max(0, Number(totalXp) || 0);
  const current = RANKS.find((rank) => xp >= rank.min && xp <= rank.max) ?? RANKS[0];
  const currentIndex = RANKS.findIndex((rank) => rank.name === current.name);
  const next = RANKS[currentIndex + 1] ?? null;
  if (!next) {
    return { current, next: null, progress: 100, remaining: 0, span: current.max - current.min };
  }
  const span = next.min - current.min;
  const progress = Math.min(100, Math.round(((xp - current.min) / span) * 100));
  const remaining = Math.max(0, next.min - xp);
  return { current, next, progress, remaining, span };
}

function isWeeklyBonusAvailable(user) {
  const streak = Number(user?.currentStreak ?? 0);
  if (streak < 7) return false;
  if (!user?.lastStreakBonusAt) return true;
  const last = new Date(user.lastStreakBonusAt);
  if (Number.isNaN(last.getTime())) return true;
  const diffMs = Date.now() - last.getTime();
  return diffMs >= 7 * 24 * 60 * 60 * 1000;
}

function formatNextBonusWindow(user) {
  if (!user?.lastStreakBonusAt) return "Ready when streak hits 7 days.";
  const last = new Date(user.lastStreakBonusAt);
  if (Number.isNaN(last.getTime())) return "Ready when streak hits 7 days.";
  const next = new Date(last.getTime() + 7 * 24 * 60 * 60 * 1000);
  return `Next claim ${next.toLocaleDateString(undefined, { month: "short", day: "numeric" })}.`;
}

const normaliseTask = (task) => {
  const status = task.status ?? (task.completed ? "completed" : "pending");
  return { ...task, status };
};

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

const getTaskTimestamp = (task) => {
  const source = task.updatedAt || task.createdAt;
  const when = source ? new Date(source) : null;
  return when && !Number.isNaN(when.getTime()) ? when : null;
};

const normaliseLift = (lift) => {
  if (!lift) return null;
  const weight = Number(lift.weight);
  const reps = Number(lift.reps);
  const recordedAt = lift.recordedAt ? new Date(lift.recordedAt).getTime() : 0;
  const exerciseId = lift.exerciseId || findExerciseIdByLabel(lift.exercise);
  const canonical = exerciseId ? getExerciseById(exerciseId) : null;
  const exerciseLabel = canonical?.label || lift.exerciseLabel || lift.exercise || "";

  return {
    ...lift,
    _id: lift._id || lift.id,
    exerciseId: exerciseId || null,
    exerciseLabel,
    exercise: exerciseLabel,
    weight: Number.isFinite(weight) ? weight : 0,
    reps: Number.isFinite(reps) ? reps : 0,
    recordedAt,
  };
};
function getTaskCompletionDate(task) {
  if (!task) return null;
  const status = task.status ?? (task.completed ? "completed" : undefined);
  if (status !== "completed") return null;
  const source = task.completedAt || task.updatedAt || task.createdAt;
  if (!source) return null;
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return null;
  return startOfDay(date);
}

function getPersonalRecordDates(lifts = []) {
  if (!Array.isArray(lifts) || lifts.length === 0) {
    return [];
  }

  const sorted = lifts
    .filter((lift) => Number.isFinite(lift?.recordedAt) && lift.recordedAt > 0)
    .sort((a, b) => a.recordedAt - b.recordedAt);

  const bestByExercise = new Map();
  const records = [];

  for (const lift of sorted) {
    const key = lift.exerciseId || lift.exerciseLabel?.toLowerCase() || lift.exercise?.toLowerCase();
    if (!key || !Number.isFinite(lift.weight)) {
      continue;
    }

    const best = bestByExercise.get(key);
    const isNewRecord =
      !best ||
      lift.weight > best.weight ||
      (lift.weight === best.weight && lift.recordedAt > best.recordedAt);

    if (isNewRecord) {
      bestByExercise.set(key, { weight: lift.weight, recordedAt: lift.recordedAt });
      records.push(startOfDay(new Date(lift.recordedAt)));
    }
  }

  return records;
}

export default function Profile() {
  const router = useRouter();
  const [tasks, setTasks] = useState([]);
  const [lifts, setLifts] = useState([]);
  const [liftsError, setLiftsError] = useState("");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profileForm, setProfileForm] = useState({ ...DEFAULT_PROFILE });
  const [identityNotice, setIdentityNotice] = useState({ type: "idle", text: "" });
  const [identityPassword, setIdentityPassword] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarNotice, setAvatarNotice] = useState({ type: "idle", text: "" });
  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
  const [passwordNotice, setPasswordNotice] = useState({ type: "idle", text: "" });
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [exportingData, setExportingData] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  const [bonusStatus, setBonusStatus] = useState({ type: "idle", text: "" });
  const [claimingBonus, setClaimingBonus] = useState(false);
  const getNoticeClass = (notice) => {
    if (!notice?.text) {
      return "text-[var(--text-muted)]";
    }
    if (notice.type === "error") {
      return "text-[var(--danger)]";
    }
    if (notice.type === "success") {
      return "text-[var(--success-text)]";
    }
    return "text-[var(--text-muted)]";
  };

  const getBrowserTimeZone = useCallback(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch {
      return "";
    }
  }, []);

  const syncTimezone = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/users");
      if (!res.ok) return;
      const payload = await res.json();
      const account = payload?.user;

      if (account) {
        setUser(account);
        setProfileForm({
          name: account.name || DEFAULT_PROFILE.name,
          email: account.email || DEFAULT_PROFILE.email,
        });
        setAvatarPreview((prev) => prev || account.avatarUrl || account.avatar || "");
      } else {
        setProfileForm({ ...DEFAULT_PROFILE });
      }

      const tz = getBrowserTimeZone();
      if (!tz || !account?.id || account.timezone === tz) {
        return;
      }

      await fetchWithAuth(`/api/users/${account.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: tz }),
      });
    } catch (e) {
      console.warn("Timezone sync skipped:", e);
    }
  }, [getBrowserTimeZone]);

  const fetchTasks = useCallback(async () => {
    try {
      const response = await fetchWithAuth("/api/tasks");
      if (response.ok) {
        const data = await response.json();
        setTasks(data.map(normaliseTask));
      } else {
        console.error("Failed to fetch tasks");
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  }, []);

  const fetchLifts = useCallback(async () => {
    try {
      const response = await fetchWithAuth("/api/lifts");
      if (!response.ok) {
        throw new Error("Failed to fetch lifts");
      }
      const data = await response.json();
      setLifts(Array.isArray(data) ? data.map(normaliseLift) : []);
      setLiftsError("");
    } catch (error) {
      console.error("Error fetching lifts:", error);
      setLiftsError("Unable to load lifts. Strength analytics may be stale.");
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.allSettled([syncTimezone(), fetchTasks(), fetchLifts()]);
      setLoading(false);
    };
    load();
  }, [syncTimezone, fetchTasks, fetchLifts]);

  const analytics = useMemo(() => {
    const counts = { total: 0, completed: 0, pending: 0, failed: 0 };
    const byStatus = {
      completed: [],
      pending: [],
      failed: [],
    };
    let latestActivity = null;

    for (const task of tasks) {
      const status = task.status ?? (task.completed ? "completed" : "pending");
      counts.total += 1;
      counts[status] = (counts[status] ?? 0) + 1;
      if (byStatus[status]) {
        byStatus[status].push(task);
      }
      const timestamp = getTaskTimestamp(task);
      if (timestamp && (!latestActivity || timestamp > latestActivity.when)) {
        latestActivity = { task, when: timestamp };
      }
    }

    const sortByRecent = (list) =>
      [...list].sort((a, b) => {
        const aDate = getTaskTimestamp(a)?.getTime() ?? 0;
        const bDate = getTaskTimestamp(b)?.getTime() ?? 0;
        return bDate - aDate;
      });

    const sortBySpecial = (list) =>
      [...list].sort((a, b) => {
        const aDue = typeof a?.dueDate === "string" && a.dueDate ? a.dueDate : null;
        const bDue = typeof b?.dueDate === "string" && b.dueDate ? b.dueDate : null;
        if (aDue && bDue) return aDue.localeCompare(bDue);
        if (aDue && !bDue) return -1;
        if (!aDue && bDue) return 1;
        // fallback to most recently updated
        const aDate = getTaskTimestamp(a)?.getTime() ?? 0;
        const bDate = getTaskTimestamp(b)?.getTime() ?? 0;
        return bDate - aDate;
      });

    const completedRecent = sortByRecent(byStatus.completed).slice(0, 3);
    const pendingTop = sortByRecent(byStatus.pending).slice(0, 5);
    const specialPending = sortBySpecial(
      tasks.filter(
        (t) => t.type === "special" && ((t.status ?? (t.completed ? "completed" : "pending")) === "pending")
      )
    ).slice(0, 5);
    const successRate = counts.total === 0 ? 0 : Math.round((counts.completed / counts.total) * 100);

    return { counts, byStatus, latestActivity, completedRecent, pendingTop, specialPending, successRate };
  }, [tasks]);

  const strengthInsights = useMemo(() => {
    const emptyBigFour = {
      squat_back: null,
      deadlift: null,
      bench_press_barbell: null,
      overhead_press: null,
    };

    if (!lifts || lifts.length === 0) {
      return {
        total: 0,
        recent: [],
        unique: 0,
        heaviest: null,
        bigFour: emptyBigFour,
      };
    }

    const uniqueSet = new Set();
    const bigFour = { ...emptyBigFour };
    let heaviest = null;

    for (const lift of lifts) {
      const uniqueKey = lift.exerciseId || lift.exerciseLabel?.toLowerCase() || lift.exercise?.toLowerCase() || "";
      if (uniqueKey) {
        uniqueSet.add(uniqueKey);
      }

      if (
        !heaviest ||
        lift.weight > heaviest.weight ||
        (lift.weight === heaviest.weight && lift.recordedAt > heaviest.recordedAt)
      ) {
        heaviest = lift;
      }

      if (lift.exerciseId && Object.prototype.hasOwnProperty.call(bigFour, lift.exerciseId)) {
        const current = bigFour[lift.exerciseId];
        if (
          !current ||
          lift.weight > current.weight ||
          (lift.weight === current.weight && lift.recordedAt > current.recordedAt)
        ) {
          bigFour[lift.exerciseId] = lift;
        }
      }
    }

    return {
      total: lifts.length,
      recent: lifts.slice(0, 3),
      unique: uniqueSet.size,
      heaviest,
      bigFour,
    };
  }, [lifts]);


  const contributionMetrics = useMemo(() => {
    const today = startOfDay(new Date());
    const isoDay = getIsoDay(today);
    const endDate = shiftDate(today, 6 - isoDay);
    const totalDays = WEEKS_TO_SHOW * 7;
    const startDate = shiftDate(endDate, -(totalDays - 1));

    const windowStartTs = startDate.getTime();
    const windowEndTs = endDate.getTime();

    const counts = new Map();
    let taskEvents = 0;
    let prEvents = 0;

    const bump = (iso, type) => {
      const existing = counts.get(iso) ?? { count: 0, tasks: 0, prs: 0 };
      const next = {
        count: existing.count + 1,
        tasks: existing.tasks + (type === "task" ? 1 : 0),
        prs: existing.prs + (type === "pr" ? 1 : 0),
      };
      counts.set(iso, next);
    };

    for (const date of tasks.map(getTaskCompletionDate).filter(Boolean)) {
      const ts = date.getTime();
      if (ts < windowStartTs || ts > windowEndTs) {
        continue;
      }
      bump(toISODate(date), "task");
      taskEvents += 1;
    }

    for (const date of getPersonalRecordDates(lifts)) {
      const ts = date.getTime();
      if (ts < windowStartTs || ts > windowEndTs) {
        continue;
      }
      bump(toISODate(date), "pr");
      prEvents += 1;
    }

    const days = [];
    for (let cursor = new Date(startDate); cursor.getTime() <= windowEndTs; cursor = shiftDate(cursor, 1)) {
      const iso = toISODate(cursor);
      const entry = counts.get(iso) ?? { count: 0, tasks: 0, prs: 0 };
      days.push({
        date: iso,
        count: entry.count,
        taskCount: entry.tasks,
        prCount: entry.prs,
        weekday: getIsoDay(cursor),
      });
    }

    return {
      days,
      totals: {
        total: taskEvents + prEvents,
        tasks: taskEvents,
        prs: prEvents,
      },
      range: {
        start: toISODate(startDate),
        end: toISODate(endDate),
      },
    };
  }, [tasks, lifts]);

  const contributionDays = contributionMetrics.days;
  const contributionTotals = contributionMetrics.totals;
  const contributionRange = contributionMetrics.range;

  const productivityHighlights = useMemo(() => {
    if (!contributionDays || contributionDays.length === 0) {
      return {
        longest: { length: 0, start: null, end: null },
        topDay: null,
      };
    }

    let currentLength = 0;
    let currentStart = null;
    let longest = { length: 0, start: null, end: null };
    let topDay = null;

    for (const day of contributionDays) {
      const taskTotal = Number(day?.taskCount ?? 0);
      const prTotal = Number(day?.prCount ?? 0);
      const combined = taskTotal + prTotal;

      if (!topDay || combined > topDay.total) {
        topDay = { ...day, total: combined };
      }

      if (taskTotal > 0) {
        currentLength += 1;
        if (!currentStart) {
          currentStart = day.date;
        }
        if (currentLength > longest.length) {
          longest = { length: currentLength, start: currentStart, end: day.date };
        }
      } else {
        currentLength = 0;
        currentStart = null;
      }
    }

    return { longest, topDay };
  }, [contributionDays]);

  const longest = productivityHighlights.longest;
  const topDay = productivityHighlights.topDay;

  const streakRangeLabel =
    longest?.start && longest?.end
      ? longest.start === longest.end
        ? formatDate(longest.start)
        : `${formatDate(longest.start)} - ${formatDate(longest.end)}`
      : "";

  const topDaySummary = topDay ? formatContributionSummary(topDay) : "Log completions to surface your most productive day.";

  const longestStreakDescription =
    longest?.length > 0
      ? `${longest.length} day${longest.length === 1 ? "" : "s"}${streakRangeLabel ? ` - ${streakRangeLabel}` : ""}`
      : "Log completions to build your first streak.";

  const profileInitials = useMemo(() => {
    const sourceName = profileForm.name || user?.name || DEFAULT_PROFILE.name;
    if (!sourceName) return "TG";
    const parts = sourceName.trim().split(/\s+/).slice(0, 2);
    const initials = parts.map((part) => part.charAt(0)?.toUpperCase()).join("");
    return initials || "TG";
  }, [profileForm.name, user?.name]);

  const displayName = profileForm.name || user?.name || DEFAULT_PROFILE.name;
  const displayEmail = profileForm.email || user?.email || DEFAULT_PROFILE.email;
  const heaviestLift = strengthInsights.heaviest;
  const rankProgress = useMemo(() => getRankProgress(user?.totalXp ?? 0), [user?.totalXp]);
  const bonusAvailable = useMemo(() => isWeeklyBonusAvailable(user), [user]);

  const handleIdentityChange = (field) => (event) => {
    setProfileForm((prev) => ({ ...prev, [field]: event.target.value }));
    if (identityNotice.text) {
      setIdentityNotice({ type: "idle", text: "" });
    }
  };
  const handleIdentityPasswordChange = (event) => {
    setIdentityPassword(event.target.value);
    if (identityNotice.text) {
      setIdentityNotice({ type: "idle", text: "" });
    }
  };

  const resetProfileForm = () => {
    const fallback = {
      name: user?.name || DEFAULT_PROFILE.name,
      email: user?.email || DEFAULT_PROFILE.email,
    };
    setProfileForm(fallback);
    setIdentityNotice({ type: "info", text: "Reverted to the last saved profile details." });
  };

  const handleIdentitySubmit = async (event) => {
    event.preventDefault();
    const name = profileForm.name.trim();
    const email = profileForm.email.trim();

    if (!name || !email) {
      setIdentityNotice({ type: "error", text: "Name and email are required to save profile changes." });
      return;
    }

    const nameChanged = name !== (user?.name || "");
    const emailChanged = email !== (user?.email || "");
    if ((nameChanged || emailChanged) && !identityPassword) {
      setIdentityNotice({ type: "error", text: "Current password is required to update your profile." });
      return;
    }

    if (!user?.id) {
      setIdentityNotice({ type: "error", text: "Sign in to update your account information." });
      return;
    }

    setSavingIdentity(true);
    setIdentityNotice({ type: "idle", text: "" });

    try {
      const response = await fetchWithAuth(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          currentPassword: identityPassword || undefined,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMessage =
          payload?.errors?.email ||
          payload?.errors?.name ||
          payload?.errors?.general ||
          payload?.message ||
          "We couldn't update your profile.";
        throw new Error(errorMessage);
      }

      if (payload?.user) {
        setUser(payload.user);
        setProfileForm({
          name: payload.user.name || name,
          email: payload.user.email || email,
        });
      }

      setIdentityPassword("");
      setIdentityNotice({ type: "success", text: "Profile details updated successfully." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "We couldn't update your profile.";
      setIdentityNotice({ type: "error", text: message });
    } finally {
      setSavingIdentity(false);
    }
  };

  const uploadAvatarFile = async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetchWithAuth("/api/avatars", {
      method: "POST",
      body: formData,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMessage =
        payload?.message ||
        payload?.error ||
        "We couldn't upload that image.";
      throw new Error(errorMessage);
    }

    if (!payload?.url) {
      throw new Error("We couldn't upload that image.");
    }

    return payload.url;
  };

  const handleAvatarChange = async (event) => {
    const input = event.target;
    const file = input?.files?.[0];
    if (!file) return;

    if (!user?.id) {
      setAvatarNotice({ type: "error", text: "Sign in to update your avatar." });
      if (input) {
        input.value = "";
      }
      return;
    }

    const maxSizeBytes = 1.5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setAvatarNotice({ type: "error", text: "Choose an image that is 1.5 MB or smaller." });
      if (input) {
        input.value = "";
      }
      return;
    }

    if (file.type && !file.type.startsWith("image/")) {
      setAvatarNotice({ type: "error", text: "Please choose an image file." });
      if (input) {
        input.value = "";
      }
      return;
    }

    setAvatarUploading(true);
    setAvatarNotice({ type: "idle", text: "" });

    let localPreview = "";
    try {
      localPreview = URL.createObjectURL(file);
      setAvatarPreview(localPreview);

      const uploadedUrl = await uploadAvatarFile(file);

      const response = await fetchWithAuth(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: uploadedUrl }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMessage =
          payload?.errors?.avatar ||
          payload?.errors?.general ||
          payload?.message ||
          "We couldn't update your avatar.";
        throw new Error(errorMessage);
      }

      if (payload?.user) {
        setUser(payload.user);
      }

      setAvatarPreview(uploadedUrl);
      setAvatarNotice({ type: "success", text: "Avatar updated successfully." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "We couldn't update your avatar.";
      setAvatarNotice({ type: "error", text: message });
      setAvatarPreview(user?.avatar || user?.avatarUrl || "");
    } finally {
      setAvatarUploading(false);
      if (input) {
        input.value = "";
      }
    }
  };

  const handlePasswordChange = (field) => (event) => {
    setPasswordForm((prev) => ({ ...prev, [field]: event.target.value }));
    if (passwordNotice.text) {
      setPasswordNotice({ type: "idle", text: "" });
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();

    if (!user?.id) {
      setPasswordNotice({ type: "error", text: "Sign in to update your password." });
      return;
    }

    if (!passwordForm.current || !passwordForm.next || !passwordForm.confirm) {
      setPasswordNotice({ type: "error", text: "Fill in all password fields before saving." });
      return;
    }

    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordNotice({ type: "error", text: "New password and confirmation must match." });
      return;
    }

    setUpdatingPassword(true);
    setPasswordNotice({ type: "idle", text: "" });

    try {
      const response = await fetchWithAuth(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: passwordForm.next,
          currentPassword: passwordForm.current,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMessage =
          payload?.errors?.password ||
          payload?.errors?.general ||
          payload?.message ||
          "We couldn't update your password.";
        throw new Error(errorMessage);
      }

      setPasswordNotice({ type: "success", text: "Password updated successfully." });
      setPasswordForm({ current: "", next: "", confirm: "" });
      await supabaseBrowser.auth.signOut();
      router.replace("/login");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "We couldn't update your password.";
      setPasswordNotice({ type: "error", text: message });
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleExportData = () => {
    try {
      setExportingData(true);
      setExportMessage("");
      const payload = {
        exportedAt: new Date().toISOString(),
        tasks,
        lifts,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "top-g-export.json";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      setExportMessage("Download generated. Review the JSON file to verify your export.");
    } catch (error) {
      console.error("Export error:", error);
      setExportMessage("Export failed. Check console logs for details.");
    } finally {
      setExportingData(false);
    }
  };

  const handleClaimWeeklyBonus = async () => {
    if (!bonusAvailable || !user?.id || claimingBonus) return;
    setClaimingBonus(true);
    setBonusStatus({ type: "idle", text: "" });

    try {
      const response = await fetchWithAuth("/api/gamification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionType: "streak_weekly_bonus" }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || "Unable to claim bonus.");
      }

      if (payload?.user) {
        setUser(payload.user);
      }

      if (payload?.applied) {
        setBonusStatus({ type: "success", text: "Weekly bonus claimed. Keep the streak alive." });
      } else {
        setBonusStatus({ type: "info", text: payload?.message || "Weekly bonus not available yet." });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to claim bonus.";
      setBonusStatus({ type: "error", text: message });
    } finally {
      setClaimingBonus(false);
    }
  };

  useEffect(() => {
    return () => {
      if (avatarPreview && avatarPreview.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background-muted)] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)] mx-auto"></div>
          <p className="text-[var(--text-secondary)]">Preparing your profile workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background-muted)]">
      <NavigationBar />
      <main className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8 sm:space-y-10 animate-fade-up">
        <header className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-6 sm:p-8" style={{ boxShadow: "var(--card-shadow)" }}>
          <div className="flex flex-col items-center gap-6 text-center md:flex-row md:items-center md:justify-between md:text-left">
            <div className="flex items-start gap-4 text-left">
              <div className="relative h-20 w-20 flex items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] text-2xl font-semibold text-[var(--text-primary)]">
                {avatarPreview ? (
                  <Image src={avatarPreview} alt="Profile avatar" fill sizes="80px" className="rounded-2xl object-cover" unoptimized />
                ) : (
                  <span>{profileInitials}</span>
                )}
              </div>
              <div className="space-y-2">
                <span className="theme-badge inline-flex items-center">Profile</span>
                <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">{displayName}</h1>
                <p className="text-sm text-[var(--text-secondary)]">
                  {displayEmail ? `Signed in as ${displayEmail}` : "Add an email so we can reach you with important updates."}
                </p>
                {analytics.latestActivity && (
                  <p className="text-xs text-[var(--text-muted)]">
                    Last activity {formatDate(analytics.latestActivity.when)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 text-sm text-[var(--text-secondary)] md:items-end md:text-left">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2 font-semibold text-[var(--text-primary)]">
                Completion rate
                <span className="text-lg text-[var(--accent)] font-bold">{analytics.successRate}%</span>
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2">
                Tasks tracked <span className="font-semibold text-[var(--text-primary)]">{analytics.counts.total}</span>
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2">
                Lifts logged <span className="font-semibold text-[var(--text-primary)]">{strengthInsights.total}</span>
              </span>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ProfileCard
              title="Account settings"
              description="Change your username, update your avatar, or reset your password."
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setActiveModal("identity")}
                  className="flex flex-col items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4 text-left transition hover:border-[var(--accent)]"
                >
                  <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Change username</span>
                  <span className="text-base font-semibold text-[var(--text-primary)]">{displayName}</span>
                  <span className="text-xs text-[var(--text-secondary)]">Edit name and email.</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal("avatar")}
                  className="flex flex-col items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4 text-left transition hover:border-[var(--accent)]"
                >
                  <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Upload avatar</span>
                  <span className="text-base font-semibold text-[var(--text-primary)]">Update photo</span>
                  <span className="text-xs text-[var(--text-secondary)]">Square image looks best.</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal("password")}
                  className="flex flex-col items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4 text-left transition hover:border-[var(--accent)]"
                >
                  <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Change password</span>
                  <span className="text-base font-semibold text-[var(--text-primary)]">Reset credentials</span>
                  <span className="text-xs text-[var(--text-secondary)]">You will re-login after update.</span>
                </button>
              </div>
            </ProfileCard>
          </div>
        </section>

        <section className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-semibold text-[var(--text-primary)]">Personal overview</h2>
            <p className="text-sm text-[var(--text-secondary)]">Quick stats to monitor your execution and training progress.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <SummaryCard title="Tasks completed" value={analytics.counts.completed} highlight="var(--accent)" />
            <SummaryCard title="Completion rate" value={`${analytics.successRate}%`} highlight="var(--success-text)" />
            <SummaryCard title="Total XP" value={(user?.totalXp ?? 0).toLocaleString()} highlight="var(--accent)" />
            <SummaryCard title="Current rank" value={user?.currentRank || "Initiate"} highlight="var(--text-primary)" />
            <SummaryCard
              title="Current streak"
              value={`${Number(user?.currentStreak ?? 0)} day${Number(user?.currentStreak ?? 0) === 1 ? "" : "s"}`}
              highlight="var(--warning-text)"
            />
            <SummaryCard title="Lifts logged" value={strengthInsights.total} highlight="var(--text-primary)" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <AnalyticsCard title="Rank progress">
              <div className="space-y-4 text-sm text-[var(--text-secondary)]">
                <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Current rank</p>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{rankProgress.current.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Total XP</p>
                    <p className="text-sm font-semibold text-[var(--accent)]">{Number(user?.totalXp ?? 0).toLocaleString()}</p>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span>{Number(user?.totalXp ?? 0).toLocaleString()} XP</span>
                    <span>{rankProgress.next ? `${rankProgress.next.min.toLocaleString()} XP` : "Max rank"}</span>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-[var(--surface-muted)]">
                    <div
                      className="h-2 rounded-full bg-[var(--accent)]"
                      style={{ width: `${rankProgress.progress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-[var(--text-secondary)]">
                    {rankProgress.next
                      ? `${rankProgress.remaining.toLocaleString()} XP to reach ${rankProgress.next.name}`
                      : "Top rank secured. Hold the line."}
                  </p>
                </div>
              </div>
            </AnalyticsCard>
            <AnalyticsCard title="Streaks & momentum">
              <div className="space-y-4 text-sm text-[var(--text-secondary)]">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Longest streak</p>
                  <p className="text-sm text-[var(--text-secondary)]">{longestStreakDescription}</p>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Most productive day</p>
                  <p className="text-sm text-[var(--text-secondary)]">{topDay ? topDaySummary : "Log completions to surface your top day."}</p>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Weekly bonus</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {bonusAvailable
                      ? "Claim +100 XP for maintaining a 7-day streak."
                      : `Progress: ${Math.min(Number(user?.currentStreak ?? 0), 7)}/7 days.`}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {bonusAvailable ? "Bonus ready now." : formatNextBonusWindow(user)}
                  </p>
                  <button
                    type="button"
                    onClick={handleClaimWeeklyBonus}
                    disabled={!bonusAvailable || claimingBonus}
                    className="btn-primary mt-3 w-full sm:w-auto"
                  >
                    {claimingBonus ? "Claiming..." : "Claim weekly bonus"}
                  </button>
                  {bonusStatus.text && (
                    <p className={`mt-2 text-xs ${getNoticeClass(bonusStatus)}`}>{bonusStatus.text}</p>
                  )}
                </div>
              </div>
            </AnalyticsCard>
            <AnalyticsCard title="Special tasks">
              <TaskList tasks={analytics.specialPending} emptyLabel="No special tasks scheduled." />
            </AnalyticsCard>
            <AnalyticsCard title="Active queue">
              <TaskList
                tasks={analytics.pendingTop}
                emptyLabel="No items on deck. Queue work inside Focus to plan the next strike."
                compact
              />
            </AnalyticsCard>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <AnalyticsCard title="Recent wins">
              <TaskList
                tasks={analytics.completedRecent}
                emptyLabel="Complete a task to log your latest wins."
                compact
              />
            </AnalyticsCard>
            <AnalyticsCard title="Big Four PRs">
              {liftsError ? (
                <p className="text-sm text-[var(--warning-text)]">{liftsError}</p>
              ) : (
                <ul className="space-y-3 text-sm text-[var(--text-secondary)]">
                  {BIG_FOUR_EXERCISES.map((exercise) => {
                    const best = strengthInsights.bigFour?.[exercise.id];
                    return (
                      <li
                        key={exercise.id}
                        className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2"
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-[var(--text-primary)]">
                            {exercise.shortLabel || exercise.label}
                          </span>
                          <span className="text-xs text-[var(--text-muted)]">
                            {best
                              ? `${best.weight} kg x ${best.reps} - ${formatDate(best.date || best.recordedAt)}`
                              : "No record logged yet."}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </AnalyticsCard>
            <AnalyticsCard title="Strength highlight">
              {heaviestLift ? (
                <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{heaviestLift.exerciseLabel}</p>
                  <p>{heaviestLift.weight} kg x {heaviestLift.reps}</p>
                  <p className="text-xs text-[var(--text-muted)]">Logged {formatDate(heaviestLift.recordedAt)}</p>
                </div>
              ) : (
                <p className="text-sm text-[var(--text-secondary)]">Log a lift to highlight your heaviest set.</p>
              )}
            </AnalyticsCard>
          </div>

          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-6 sm:p-8" style={{ boxShadow: "var(--card-shadow)" }}>
            <h2 className="text-lg sm:text-xl font-semibold text-[var(--text-primary)]">Momentum heatmap</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Track daily task completions and personal record breakthroughs to keep the momentum visible.
            </p>
            <div className="mt-6 space-y-4">
              <ContributionHeatmap data={contributionDays} loading={loading} />
              <div className="text-xs text-[var(--text-muted)] flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span>Completions: {contributionTotals.tasks} | New PRs: {contributionTotals.prs}</span>
                <span>Window: {formatContributionRange(contributionRange)}</span>
              </div>
              {!loading && contributionTotals.total === 0 && (
                <p className="text-xs text-[var(--text-secondary)]">
                  Close tasks or hit a personal record to light up this grid.
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ProfileCard title="Data & export" description="Generate a backup of your tasks and lifts.">
            <div className="space-y-3 text-sm text-[var(--text-secondary)]">
              <p>Exports include your tasks and logged lifts in JSON format.</p>
              {exportMessage && <p className="text-xs text-[var(--text-muted)]">{exportMessage}</p>}
              <button type="button" className="btn-primary" onClick={handleExportData} disabled={exportingData}>
                {exportingData ? "Preparing export..." : "Download my data"}
              </button>
            </div>
          </ProfileCard>
          <ProfileCard title="Support & policies" description="Need help or prefer to review the fine print?">
            <ul className="space-y-3 text-sm text-[var(--text-secondary)]">
              <li className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
                <span>Privacy Policy</span>
                <span className="text-xs text-[var(--text-muted)]">Coming soon</span>
              </li>
              <li className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
                <span>Terms of Service</span>
                <span className="text-xs text-[var(--text-muted)]">Coming soon</span>
              </li>
              <li className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
                <span>Need a hand?</span>
                <Link href="/reach-out" className="text-[var(--accent)] hover:text-[var(--accent-hover)] font-semibold">Reach out</Link>
              </li>
            </ul>
          </ProfileCard>
        </section>
      </main>
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8">
          <div className="w-full max-w-2xl translate-y-2 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl sm:translate-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Account settings</p>
                <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                  {activeModal === "identity" && "Change username"}
                  {activeModal === "avatar" && "Upload avatar"}
                  {activeModal === "password" && "Change password"}
                </h2>
              </div>
              <button
                type="button"
                className="btn-secondary px-3 py-1.5"
                onClick={() => setActiveModal(null)}
              >
                Close
              </button>
            </div>

            {activeModal === "identity" && (
              <form className="mt-6 space-y-4" onSubmit={handleIdentitySubmit}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-[var(--text-secondary)]">Name</span>
                    <input
                      type="text"
                      value={profileForm.name}
                      onChange={handleIdentityChange("name")}
                      placeholder="Enter your name"
                      className="w-full"
                      disabled={savingIdentity}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-[var(--text-secondary)]">Email</span>
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={handleIdentityChange("email")}
                      placeholder="you@example.com"
                      className="w-full"
                      disabled={savingIdentity}
                    />
                  </label>
                </div>
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-[var(--text-secondary)]">Current password</span>
                  <input
                    type="password"
                    value={identityPassword}
                    onChange={handleIdentityPasswordChange}
                    placeholder="********"
                    className="w-full"
                    disabled={savingIdentity}
                  />
                </label>
                {identityNotice.text && (
                  <p className={`text-xs ${getNoticeClass(identityNotice)}`}>{identityNotice.text}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button type="submit" className="btn-primary" disabled={savingIdentity}>
                    {savingIdentity ? "Saving..." : "Save changes"}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={resetProfileForm}
                    disabled={savingIdentity || !user}
                  >
                    Revert
                  </button>
                </div>
              </form>
            )}

            {activeModal === "avatar" && (
              <div className="mt-6 space-y-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                  <div className="relative h-20 w-20 flex items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] text-lg font-semibold text-[var(--text-primary)]">
                    {avatarPreview ? (
                      <Image src={avatarPreview} alt="Avatar preview" fill sizes="80px" className="rounded-2xl object-cover" unoptimized />
                    ) : (
                      <span>{profileInitials}</span>
                    )}
                  </div>
                  <div className="space-y-3 text-sm text-[var(--text-secondary)]">
                    <label
                      htmlFor="profile-avatar-upload"
                      className={`btn-secondary inline-flex items-center justify-center px-4 py-2 ${avatarUploading ? "cursor-not-allowed opacity-75" : "cursor-pointer"}`}
                      aria-disabled={avatarUploading}
                    >
                      {avatarUploading ? "Uploading..." : "Upload image"}
                    </label>
                    <input
                      id="profile-avatar-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarChange}
                      disabled={avatarUploading}
                    />
                    {avatarNotice.text ? (
                      <p className={`text-xs ${getNoticeClass(avatarNotice)}`}>{avatarNotice.text}</p>
                    ) : (
                      <p className="text-xs text-[var(--text-muted)]">
                        Upload a square image around 512px for the sharpest avatar.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeModal === "password" && (
              <form className="mt-6 space-y-4" onSubmit={handlePasswordSubmit}>
                <div className="grid gap-4 md:grid-cols-3">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-[var(--text-secondary)]">Current password</span>
                    <input
                      type="password"
                      value={passwordForm.current}
                      onChange={handlePasswordChange("current")}
                      placeholder="********"
                      disabled={updatingPassword}
                      className="w-full"
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-[var(--text-secondary)]">New password</span>
                    <input
                      type="password"
                      value={passwordForm.next}
                      onChange={handlePasswordChange("next")}
                      placeholder="********"
                      disabled={updatingPassword}
                      className="w-full"
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-[var(--text-secondary)]">Confirm password</span>
                    <input
                      type="password"
                      value={passwordForm.confirm}
                      onChange={handlePasswordChange("confirm")}
                      placeholder="********"
                      disabled={updatingPassword}
                      className="w-full"
                    />
                  </label>
                </div>
                {passwordNotice.text && (
                  <p className={`text-xs ${getNoticeClass(passwordNotice)}`}>{passwordNotice.text}</p>
                )}
                <button type="submit" className="btn-primary" disabled={updatingPassword}>
                  {updatingPassword ? "Updating..." : "Update password"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );

}

function SummaryCard({ title, value, highlight }) {
  return (
    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6" style={{ boxShadow: "var(--card-shadow)" }}>
      <p className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">{title}</p>
      <p className="mt-2 text-4xl font-bold" style={{ color: highlight }}>
        {value}
      </p>
    </div>
  );
}
function ProfileCard({ title, description, children }) {
  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6" style={{ boxShadow: "var(--card-shadow)" }}>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
        {description && <p className="text-sm text-[var(--text-secondary)]">{description}</p>}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function AnalyticsCard({ title, children }) {
  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6" style={{ boxShadow: "var(--card-shadow)" }}>
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function TaskList({ tasks = [], emptyLabel, compact }) {
  if (!tasks || tasks.length === 0) {
    return <p className="text-sm text-[var(--text-secondary)]">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => {
        const status = task.status ?? (task.completed ? "completed" : "pending");
        return (
          <div key={task._id} className={`rounded-2xl border p-4 ${compact ? "bg-[var(--surface)]" : "bg-[var(--surface-muted)]"}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{task.title}</p>
                {(task.description || task.type === "special") && !compact && (
                  <p className="text-sm text-[var(--text-secondary)]">
                    {task.description}
                    {task.type === "special" && task.dueDate && (
                      <span className="ml-2 text-[var(--text-muted)]">Due: {task.dueDate}</span>
                    )}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${STATUS_BADGE_CLASSES[status]}`}>
                  {STATUS_LABELS[status]}
                </span>
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">
                  {task.type === "daily" ? "Daily" : "Special"}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ContributionHeatmap({ data = [], loading }) {
  const [hoveredDay, setHoveredDay] = useState(null);

  if (loading) {
    return (
      <div className="flex h-28 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
      </div>
    );
  }

  const days = Array.isArray(data) ? data : [];
  const windowSize = WEEKS_TO_SHOW * 7;

  if (!days || days.length === 0) {
    return <p className="text-sm text-[var(--text-secondary)]">No milestones recorded in this window yet.</p>;
  }

  const byDate = new Map();
  for (const entry of days) {
    if (!entry || !entry.date) continue;
    const count = Number(entry.count ?? 0);
    const taskCount = Number(entry.taskCount ?? 0);
    const prCount = Number(entry.prCount ?? 0);
    byDate.set(entry.date, {
      date: entry.date,
      count: Number.isFinite(count) ? count : 0,
      taskCount: Number.isFinite(taskCount) ? taskCount : 0,
      prCount: Number.isFinite(prCount) ? prCount : 0,
    });
  }

  const lastEntryIso = days[days.length - 1]?.date;
  let endDate = lastEntryIso ? new Date(lastEntryIso) : new Date();
  if (Number.isNaN(endDate.getTime())) {
    endDate = new Date();
  }
  endDate = startOfDay(endDate);

  const orderedDays = [];
  for (let offset = windowSize - 1; offset >= 0; offset -= 1) {
    const currentDate = shiftDate(endDate, -offset);
    const iso = toISODate(currentDate);
    const entry = byDate.get(iso);
    orderedDays.push({
      date: iso,
      count: entry?.count ?? 0,
      taskCount: entry?.taskCount ?? 0,
      prCount: entry?.prCount ?? 0,
    });
  }

  const weeks = [];
  for (let index = 0; index < orderedDays.length; index += 7) {
    weeks.push(orderedDays.slice(index, index + 7));
  }

  const monthLabels = [];
  let lastMonthKey = "";
  weeks.forEach((week) => {
    const firstEntry = week.find((item) => item?.date);
    if (!firstEntry?.date) {
      monthLabels.push("");
      return;
    }
    const firstDate = new Date(firstEntry.date);
    if (Number.isNaN(firstDate.getTime())) {
      monthLabels.push("");
      return;
    }
    const monthKey = `${firstDate.getFullYear()}-${firstDate.getMonth()}`;
    const withinFirstWeek = firstDate.getDate() <= 7;
    if (monthKey !== lastMonthKey && withinFirstWeek) {
      monthLabels.push(firstDate.toLocaleDateString(undefined, { month: "short" }));
      lastMonthKey = monthKey;
    } else {
      monthLabels.push("");
    }
  });

  const tileSize = 11;
  const gap = 3;
  const columnWidth = `${tileSize}px`;
  const labelWidth = "28px";
  const gapValue = `${gap}px`;

  const headerGridStyle = {
    gridTemplateColumns: `${labelWidth} repeat(${weeks.length}, ${columnWidth})`,
    columnGap: gapValue,
    justifyContent: "start",
  };

  const bodyGridStyle = {
    gridTemplateColumns: `${labelWidth} repeat(${weeks.length}, ${columnWidth})`,
    columnGap: gapValue,
    rowGap: gapValue,
    justifyContent: "start",
    justifyItems: "start",
  };

  const weekColumnStyle = {
    gridTemplateRows: `repeat(7, ${columnWidth})`,
    rowGap: gapValue,
  };

  const tileBaseStyle = {
    width: columnWidth,
    height: columnWidth,
  };

  const todayIso = toISODate(new Date());
  const hoverSummary = hoveredDay ? formatContributionSummary(hoveredDay) : "Hover a square to inspect the day.";

  return (
    <div className="space-y-3">
      <div className="w-full overflow-x-auto">
        <div className="space-y-3 min-w-max">
          <div
            className="grid items-center text-[10px] uppercase tracking-wide text-[var(--text-muted)]"
            style={headerGridStyle}
          >
            <span style={{ width: labelWidth }} />
            {weeks.map((_, index) => (
              <span key={`month-${index}`} className="text-center">
                {monthLabels[index]}
              </span>
            ))}
          </div>
          <div className="grid" style={bodyGridStyle}>
            <div
              className="grid text-[10px] uppercase tracking-wide text-[var(--text-muted)]"
              style={{ ...weekColumnStyle, width: labelWidth }}
            >
              {COMPACT_WEEKDAY_LABELS.map((label, index) => (
                <span key={`weekday-${index}`} className={label ? "" : "invisible"}>
                  {label || "-"}
                </span>
              ))}
            </div>
            {weeks.map((week, weekIndex) => (
              <div key={`week-${weekIndex}`} className="grid" style={weekColumnStyle}>
                {week.map((day, dayIndex) => {
                  const count = Number(day?.count ?? 0);
                  const level = getContributionLevel(count);
                  const style = getContributionStyle(level);
                  const hasActivity = count > 0;
                  const backgroundColor = hasActivity ? style.backgroundColor : "var(--surface)";
                  const borderColor = hasActivity ? style.borderColor : "var(--border)";
                  const opacity = hasActivity ? style.opacity ?? 1 : 1;
                  const tooltip = formatContributionLabel(day);
                  const isToday = day?.date === todayIso;

                  return (
                    <div
                      key={day?.date ?? `cell-${weekIndex}-${dayIndex}`}
                      className="relative focus:outline-none"
                      style={tileBaseStyle}
                      onMouseEnter={() => setHoveredDay({ ...day })}
                      onFocus={() => setHoveredDay({ ...day })}
                      onMouseLeave={() => setHoveredDay(null)}
                      onBlur={() => setHoveredDay(null)}
                      tabIndex={0}
                    >
                      <div
                        className="absolute inset-0 rounded-[3px] border transition-colors duration-200"
                        style={{ backgroundColor, borderColor, opacity }}
                        title={tooltip}
                        aria-label={tooltip}
                      />
                      {isToday && (
                        <span className="pointer-events-none absolute inset-[-2px] rounded-[5px] ring-1 ring-[var(--accent)]" />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2 text-xs text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
        <span className="text-[var(--text-secondary)]">{hoverSummary}</span>
        <ContributionLegend />
      </div>
    </div>
  );
}

function formatContributionLabel(day) {
  if (!day?.date) {
    return "No milestones recorded.";
  }

  const date = new Date(day.date);
  const formattedDate = Number.isNaN(date.getTime())
    ? day.date
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  const taskCount = Number(day?.taskCount ?? 0);
  const prCount = Number(day?.prCount ?? 0);
  const segments = [];

  if (taskCount > 0) {
    segments.push(`${taskCount} ${taskCount === 1 ? "task completion" : "task completions"}`);
  }

  if (prCount > 0) {
    segments.push(`${prCount} ${prCount === 1 ? "new PR" : "new PRs"}`);
  }

  if (segments.length === 0) {
    segments.push("No milestones recorded");
  }

  return `${segments.join(" | ")} on ${formattedDate}`;
}

function formatContributionSummary(day) {
  if (!day?.date) {
    return "No milestones recorded.";
  }

  const date = new Date(day.date);
  const formattedDate = Number.isNaN(date.getTime())
    ? day.date
    : date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  const taskCount = Number(day?.taskCount ?? 0);
  const prCount = Number(day?.prCount ?? 0);
  const parts = [];

  if (taskCount > 0) {
    parts.push(`${taskCount} ${taskCount === 1 ? "task completion" : "task completions"}`);
  }

  if (prCount > 0) {
    parts.push(`${prCount} ${prCount === 1 ? "PR" : "PRs"}`);
  }

  if (parts.length === 0) {
    parts.push("No milestones recorded");
  }

  return `${formattedDate} - ${parts.join(" / ")}`;
}

function formatContributionRange(range) {
  if (!range?.start || !range?.end) {
    return "";
  }

  const start = new Date(range.start);
  const end = new Date(range.end);
  const options = { month: "short", day: "numeric" };
  const startLabel = Number.isNaN(start.getTime()) ? range.start : start.toLocaleDateString(undefined, options);
  const endLabel = Number.isNaN(end.getTime()) ? range.end : end.toLocaleDateString(undefined, options);

  return `${startLabel} - ${endLabel}`;
}

function getContributionLevel(count) {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

function getContributionStyle(level) {
  const safeLevel = Number.isFinite(level) ? Math.trunc(level) : 0;
  const index = Math.min(
    CONTRIBUTION_LEVEL_STYLES.length - 1,
    Math.max(0, safeLevel)
  );
  return CONTRIBUTION_LEVEL_STYLES[index];
}

function ContributionLegend() {
  const levels = [0, 1, 2, 3, 4];

  return (
    <div className="flex items-center justify-end gap-2 text-xs text-[var(--text-muted)]">
      <span>Less</span>
      {levels.map((level) => (
        <span
          key={level}
          className="h-3 w-3 rounded-[3px] border"
          style={getContributionStyle(level)}
        />
      ))}
      <span>More</span>
    </div>
  );
}



import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAuth } from "../../../lib/api-utils";
import { getExerciseById, findExerciseIdByLabel } from "../../../lib/exercises";

const WEEK_PLATEAU_WINDOW = 3;
const WEIGHT_STALL_THRESHOLD = 2.5; // kg difference considered insignificant

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfISOWeek(date) {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7; // 1 (Mon) .. 7 (Sun)
  if (day !== 1) {
    utc.setUTCDate(utc.getUTCDate() + (1 - day));
  }
  return utc;
}

function endOfISOWeek(date) {
  const start = startOfISOWeek(date);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return end;
}

function getISOWeekParts(date) {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const diffDays = Math.floor((utc - yearStart) / 86400000) + 1;
  const week = Math.ceil(diffDays / 7);
  const year = utc.getUTCFullYear();
  const weekKey = `${year}-W${String(week).padStart(2, "0")}`;
  return {
    year,
    week,
    weekKey,
    weekStart: startOfISOWeek(date),
    weekEnd: endOfISOWeek(date),
  };
}

function normaliseExerciseMeta(lift) {
  let { exerciseId = null, exercise: label = "" } = lift;
  if (exerciseId) {
    const canonical = getExerciseById(exerciseId);
    if (canonical) {
      return { exerciseId: canonical.id, exerciseLabel: canonical.label };
    }
  }
  if (!label) {
    return { exerciseId: null, exerciseLabel: "Unknown" };
  }
  const inferred = findExerciseIdByLabel(label);
  if (inferred) {
    const canonical = getExerciseById(inferred);
    return { exerciseId: canonical?.id ?? inferred, exerciseLabel: canonical?.label ?? label };
  }
  return { exerciseId: null, exerciseLabel: label };
}

function computePlateau(weeks) {
  if (!Array.isArray(weeks) || weeks.length === 0) {
    return {
      isPlateau: false,
      stagnantWeeks: 0,
      window: WEEK_PLATEAU_WINDOW,
      threshold: WEIGHT_STALL_THRESHOLD,
    };
  }

  const trailing = weeks.slice(-WEEK_PLATEAU_WINDOW);
  if (trailing.length < WEEK_PLATEAU_WINDOW) {
    return {
      isPlateau: false,
      stagnantWeeks: trailing.length,
      window: WEEK_PLATEAU_WINDOW,
      threshold: WEIGHT_STALL_THRESHOLD,
    };
  }

  const weights = trailing.map((week) => Number(week.topWeight || 0));
  const max = Math.max(...weights);
  const min = Math.min(...weights);
  const diff = max - min;
  const isPlateau = max > 0 && diff <= WEIGHT_STALL_THRESHOLD;

  return {
    isPlateau,
    stagnantWeeks: isPlateau ? trailing.length : 0,
    window: WEEK_PLATEAU_WINDOW,
    threshold: WEIGHT_STALL_THRESHOLD,
  };
}

function computeWeeklySummary(lifts) {
  const byExercise = new Map();
  const overallByWeek = new Map();

  for (const raw of lifts) {
    const recordedAt = toDate(raw.recordedAt || raw.date || raw.createdAt);
    if (!recordedAt) continue;
    const weight = Number(raw.weight);
    const reps = Number(raw.reps);
    if (!Number.isFinite(weight) || weight <= 0) continue;
    if (!Number.isFinite(reps) || reps <= 0) continue;

    const { exerciseId, exerciseLabel } = normaliseExerciseMeta(raw);
    const key = exerciseId || exerciseLabel.toLowerCase();
    if (!byExercise.has(key)) {
      byExercise.set(key, {
        exerciseId,
        exerciseLabel,
        weeks: new Map(),
      });
    }

    const exerciseGroup = byExercise.get(key);
    const parts = getISOWeekParts(recordedAt);
    const weekKey = parts.weekKey;
    if (!exerciseGroup.weeks.has(weekKey)) {
      exerciseGroup.weeks.set(weekKey, {
        weekKey,
        year: parts.year,
        week: parts.week,
        weekStart: parts.weekStart,
        weekEnd: parts.weekEnd,
        totalSets: 0,
        totalWeight: 0,
        totalReps: 0,
        totalVolume: 0,
        topWeight: 0,
        topReps: 0,
        topSetRecordedAt: null,
      });
    }

    const bucket = exerciseGroup.weeks.get(weekKey);
    bucket.totalSets += 1;
    bucket.totalWeight += weight;
    bucket.totalReps += reps;
    bucket.totalVolume += weight * reps;

    if (
      weight > bucket.topWeight ||
      (weight === bucket.topWeight && (!bucket.topSetRecordedAt || recordedAt > bucket.topSetRecordedAt))
    ) {
      bucket.topWeight = weight;
      bucket.topReps = reps;
      bucket.topSetRecordedAt = recordedAt;
    }

    if (!overallByWeek.has(weekKey)) {
      overallByWeek.set(weekKey, {
        weekKey,
        year: parts.year,
        week: parts.week,
        weekStart: parts.weekStart,
        weekEnd: parts.weekEnd,
        totalSets: 0,
        totalWeight: 0,
        totalReps: 0,
        totalVolume: 0,
        topWeight: 0,
        topReps: 0,
        topExerciseLabel: '',
        topSetRecordedAt: null,
      });
    }

    const overall = overallByWeek.get(weekKey);
    overall.totalSets += 1;
    overall.totalWeight += weight;
    overall.totalReps += reps;
    overall.totalVolume += weight * reps;

    if (
      weight > overall.topWeight ||
      (weight === overall.topWeight && (!overall.topSetRecordedAt || recordedAt > overall.topSetRecordedAt))
    ) {
      overall.topWeight = weight;
      overall.topReps = reps;
      overall.topExerciseLabel = exerciseLabel;
      overall.topSetRecordedAt = recordedAt;
    }
  }

  const exerciseSummaries = [];

  for (const group of byExercise.values()) {
    const weeks = Array.from(group.weeks.values())
      .map((bucket) => ({
        ...bucket,
        averageWeight: bucket.totalSets > 0 ? Number((bucket.totalWeight / bucket.totalSets).toFixed(2)) : 0,
        averageReps: bucket.totalSets > 0 ? Number((bucket.totalReps / bucket.totalSets).toFixed(2)) : 0,
        weekStartIso: bucket.weekStart?.toISOString(),
        weekEndIso: bucket.weekEnd?.toISOString(),
        topSetRecordedAt: bucket.topSetRecordedAt?.toISOString() ?? null,
      }))
      .sort((a, b) => {
        const aTime = a.weekStart ? a.weekStart.getTime() : 0;
        const bTime = b.weekStart ? b.weekStart.getTime() : 0;
        return aTime - bTime;
      });

    const plateau = computePlateau(weeks);

    exerciseSummaries.push({
      exerciseId: group.exerciseId,
      exerciseLabel: group.exerciseLabel,
      weeks: weeks.map(({ weekStart, weekEnd, ...rest }) => { void weekStart; void weekEnd; return rest; }),
      plateau,
    });
  }

  exerciseSummaries.sort((a, b) => {
    const aLatest = a.weeks[a.weeks.length - 1]?.weekStartIso || '';
    const bLatest = b.weeks[b.weeks.length - 1]?.weekStartIso || '';
    return bLatest.localeCompare(aLatest);
  });

  const overallWeeks = Array.from(overallByWeek.values())
    .map((bucket) => ({
      weekKey: bucket.weekKey,
      year: bucket.year,
      week: bucket.week,
      weekStartIso: bucket.weekStart?.toISOString(),
      weekEndIso: bucket.weekEnd?.toISOString(),
      totalSets: bucket.totalSets,
      totalVolume: Number(bucket.totalVolume.toFixed(2)),
      averageWeight: bucket.totalSets > 0 ? Number((bucket.totalWeight / bucket.totalSets).toFixed(2)) : 0,
      averageReps: bucket.totalSets > 0 ? Number((bucket.totalReps / bucket.totalSets).toFixed(2)) : 0,
      topWeight: bucket.topWeight,
      topReps: bucket.topReps,
      topExerciseLabel: bucket.topExerciseLabel,
      topSetRecordedAt: bucket.topSetRecordedAt?.toISOString() ?? null,
    }))
    .sort((a, b) => {
      const aTime = a.weekStartIso ? new Date(a.weekStartIso).getTime() : 0;
      const bTime = b.weekStartIso ? new Date(b.weekStartIso).getTime() : 0;
      return aTime - bTime;
    });

  const overallPlateau = computePlateau(overallWeeks);

  return {
    exercises: exerciseSummaries,
    overall: {
      weeks: overallWeeks,
      plateau: overallPlateau,
    },
  };
}

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  try {
    const lifts = await auth.db
      .collection("lifts")
      .find({ userId: new ObjectId(auth.userId) })
      .project({
        exerciseId: 1,
        exercise: 1,
        weight: 1,
        reps: 1,
        recordedAt: 1,
        date: 1,
        createdAt: 1,
      })
      .toArray();

    const { exercises, overall } = computeWeeklySummary(lifts);

    return NextResponse.json({

      window: WEEK_PLATEAU_WINDOW,

      threshold: WEIGHT_STALL_THRESHOLD,

      overall,

      exercises,

    });
  } catch (error) {
    console.error("Weekly lift summary error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}




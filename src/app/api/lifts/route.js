import { NextResponse } from "next/server";
import { applyUserXpUpdate, requireAuth } from "../../lib/api-utils";
import { supabaseAdmin } from "../../lib/supabase";
import { getExerciseById, findExerciseIdByLabel } from "../../lib/exercises";
import { sanitizeLift } from "./utils";

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  try {
    const { data: lifts, error } = await auth.supabase
      .from("lifts")
      .select("*")
      .eq("user_id", auth.userId)
      .order("recorded_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json((lifts ?? []).map(sanitizeLift), { status: 200 });
  } catch (error) {
    console.error("Lifts fetch error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const exerciseIdRaw = typeof body.exerciseId === "string" ? body.exerciseId.trim() : "";
  const weight = Number(body.weight);
  const reps = Number(body.reps);
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const date = typeof body.date === "string" ? body.date.trim() : "";

  let exerciseId = exerciseIdRaw || null;
  let exerciseLabel = typeof body.exercise === "string" ? body.exercise.trim() : "";

  if (exerciseId) {
    const canonical = getExerciseById(exerciseId);
    if (!canonical) {
      return NextResponse.json({ message: "Unknown exercise selection" }, { status: 400 });
    }
    exerciseId = canonical.id;
    exerciseLabel = canonical.label;
  }

  if (!exerciseLabel) {
    return NextResponse.json({ message: "Exercise is required" }, { status: 400 });
  }

  if (!exerciseId) {
    const inferredId = findExerciseIdByLabel(exerciseLabel);
    if (inferredId) {
      const canonical = getExerciseById(inferredId);
      exerciseId = inferredId;
      exerciseLabel = canonical?.label ?? exerciseLabel;
    }
  }

  if (!Number.isFinite(weight) || weight <= 0) {
    return NextResponse.json({ message: "Weight must be a positive number" }, { status: 400 });
  }

  if (!Number.isFinite(reps) || reps <= 0) {
    return NextResponse.json({ message: "Reps must be a positive number" }, { status: 400 });
  }

  const now = new Date();
  const recordedAtRaw = typeof body.recordedAt === "string" ? new Date(body.recordedAt) : now;
  const recordedAt = Number.isNaN(recordedAtRaw.getTime()) ? now : recordedAtRaw;

  const toISODateInTZ = (date = new Date(), timeZone = "UTC") => {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return fmt.format(date);
  };

  try {
    const createdAt = now.toISOString();
    const newLift = {
      exercise: exerciseLabel,
      exercise_id: exerciseId,
      weight,
      reps,
      notes,
      date: date || now.toISOString().slice(0, 10),
      recorded_at: recordedAt.toISOString(),
      user_id: auth.userId,
      created_at: createdAt,
      updated_at: createdAt,
    };

    const { data: inserted, error } = await auth.supabase
      .from("lifts")
      .insert(newLift)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    try {
      await applyUserXpUpdate(auth.supabase, auth.user, "workout_session");
    } catch (xpError) {
      console.error("Workout XP update error:", xpError);
    }

    try {
      const todayISO = toISODateInTZ(new Date(), auth.user?.timezone || "UTC");
      const nowIso = new Date().toISOString();
      const { error: smartError } = await supabaseAdmin
        .from("tasks")
        .update({
          status: "completed",
          completed: true,
          completed_at: nowIso,
          updated_at: nowIso,
        })
        .eq("user_id", auth.userId)
        .eq("type", "protocol")
        .eq("status", "pending")
        .eq("smart_action", "workout")
        .eq("due_date", todayISO);

      if (smartError) {
        throw smartError;
      }
    } catch (smartError) {
      console.error("Smart protocol task update error:", smartError);
    }

    return NextResponse.json(sanitizeLift(inserted), { status: 201 });
  } catch (error) {
    console.error("Lift creation error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { requireAuth } from "../../../lib/api-utils";
import { sanitizeLift } from "../utils";
import { getExerciseById, findExerciseIdByLabel } from "../../../lib/exercises";

const parseLiftId = (value) => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export async function GET(request, context) {
  const params = (await context.params) ?? {};

  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const liftId = parseLiftId(params.id);
  if (!liftId) {
    return NextResponse.json({ message: "Invalid lift id" }, { status: 400 });
  }

  try {
    const { data: lift, error } = await auth.supabase
      .from("lifts")
      .select("*")
      .eq("id", liftId)
      .eq("user_id", auth.userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!lift) {
      return NextResponse.json({ message: "Lift not found" }, { status: 404 });
    }

    return NextResponse.json({ lift: sanitizeLift(lift) }, { status: 200 });
  } catch (error) {
    console.error("Lift fetch error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request, context) {
  const params = (await context.params) ?? {};

  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const liftId = parseLiftId(params.id);
  if (!liftId) {
    return NextResponse.json({ message: "Invalid lift id" }, { status: 400 });
  }

  try {
    const { data, error } = await auth.supabase
      .from("lifts")
      .delete()
      .eq("id", liftId)
      .eq("user_id", auth.userId)
      .select("id");

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ message: "Lift not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Lift deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Lift delete error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request, context) {
  const params = (await context.params) ?? {};

  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const liftId = parseLiftId(params.id);
  if (!liftId) {
    return NextResponse.json({ message: "Invalid lift id" }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const update = { updated_at: new Date().toISOString() };
  let hasUpdates = false;

  if (body.exerciseId !== undefined) {
    const exerciseIdRaw = typeof body.exerciseId === "string" ? body.exerciseId.trim() : "";
    if (exerciseIdRaw) {
      const canonical = getExerciseById(exerciseIdRaw);
      if (!canonical) {
        return NextResponse.json({ message: "Unknown exercise selection" }, { status: 400 });
      }
      update.exercise_id = canonical.id;
      update.exercise = canonical.label;
    } else {
      update.exercise_id = null;
    }
    hasUpdates = true;
  }

  if (body.exercise !== undefined) {
    const exercise = typeof body.exercise === "string" ? body.exercise.trim() : "";
    if (!exercise) {
      return NextResponse.json({ message: "Exercise cannot be empty" }, { status: 400 });
    }
    const inferredId = findExerciseIdByLabel(exercise);
    if (inferredId) {
      const canonical = getExerciseById(inferredId);
      update.exercise_id = inferredId;
      update.exercise = canonical?.label ?? exercise;
    } else {
      update.exercise = exercise;
    }
    hasUpdates = true;
  }

  if (body.weight !== undefined) {
    const weight = Number(body.weight);
    if (!Number.isFinite(weight) || weight <= 0) {
      return NextResponse.json({ message: "Weight must be a positive number" }, { status: 400 });
    }
    update.weight = weight;
    hasUpdates = true;
  }

  if (body.reps !== undefined) {
    const reps = Number(body.reps);
    if (!Number.isFinite(reps) || reps <= 0) {
      return NextResponse.json({ message: "Reps must be a positive number" }, { status: 400 });
    }
    update.reps = reps;
    hasUpdates = true;
  }

  if (body.notes !== undefined) {
    update.notes = typeof body.notes === "string" ? body.notes.trim() : "";
    hasUpdates = true;
  }

  if (body.date !== undefined) {
    update.date = typeof body.date === "string" ? body.date.trim() : "";
    hasUpdates = true;
  }

  if (body.recordedAt !== undefined) {
    const recordedAt = new Date(body.recordedAt);
    if (Number.isNaN(recordedAt.getTime())) {
      return NextResponse.json({ message: "Invalid recordedAt value" }, { status: 400 });
    }
    update.recorded_at = recordedAt.toISOString();
    hasUpdates = true;
  }

  if (!hasUpdates) {
    return NextResponse.json({ message: "No updates supplied" }, { status: 400 });
  }

  try {
    const { data: updated, error } = await auth.supabase
      .from("lifts")
      .update(update)
      .eq("id", liftId)
      .eq("user_id", auth.userId)
      .select("*")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!updated) {
      return NextResponse.json({ message: "Lift not found" }, { status: 404 });
    }

    return NextResponse.json(sanitizeLift(updated), { status: 200 });
  } catch (error) {
    console.error("Lift update error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

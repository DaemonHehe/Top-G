import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAuth } from "../../lib/api-utils";
import { getExerciseById, findExerciseIdByLabel } from "../../lib/exercises";

export const sanitizeLift = (lift) => {
  if (!lift) return null;
  return {
    id: lift._id?.toString(),
    _id: lift._id?.toString(),
    exerciseId: lift.exerciseId ?? null,
    exercise: lift.exercise,
    weight: lift.weight,
    reps: lift.reps,
    notes: lift.notes,
    date: lift.date,
    recordedAt: lift.recordedAt instanceof Date ? lift.recordedAt.toISOString() : lift.recordedAt,
    createdAt: lift.createdAt instanceof Date ? lift.createdAt.toISOString() : lift.createdAt,
    updatedAt: lift.updatedAt instanceof Date ? lift.updatedAt.toISOString() : lift.updatedAt,
  };
};

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  try {
    const lifts = await auth.db
      .collection("lifts")
      .find({ userId: new ObjectId(auth.userId) })
      .sort({ recordedAt: -1, createdAt: -1 })
      .toArray();

    return NextResponse.json(lifts.map(sanitizeLift), { status: 200 });
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
  const recordedAt = typeof body.recordedAt === "string" ? new Date(body.recordedAt) : now;
  const recordedDate = Number.isNaN(recordedAt.getTime()) ? now : recordedAt;

  try {
    const newLift = {
      exercise: exerciseLabel,
      exerciseId,
      weight,
      reps,
      notes,
      date: date || now.toISOString().slice(0, 10),
      recordedAt: recordedDate,
      userId: new ObjectId(auth.userId),
      createdAt: now,
      updatedAt: now,
    };

    const result = await auth.db.collection("lifts").insertOne(newLift);
    const inserted = await auth.db.collection("lifts").findOne({ _id: result.insertedId });

    return NextResponse.json(sanitizeLift(inserted), { status: 201 });
  } catch (error) {
    console.error("Lift creation error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}






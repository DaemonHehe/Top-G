import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAuth } from "../../../lib/api-utils";
import { sanitizeLift } from "../route";
import { getExerciseById, findExerciseIdByLabel } from "../../../lib/exercises";

const parseObjectId = (value) => {
  if (!ObjectId.isValid(value)) {
    return null;
  }
  return new ObjectId(value);
};

function unwrapResult(document) {
  if (!document) return null;
  if (typeof document === "object" && "value" in document) {
    return document.value;
  }
  return document;
}

export async function GET(request, context) {
  const params = (await context.params) ?? {};

  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const liftId = parseObjectId(params.id);
  if (!liftId) {
    return NextResponse.json({ message: "Invalid lift id" }, { status: 400 });
  }

  try {
    const lift = await auth.db.collection("lifts").findOne({
      _id: liftId,
      userId: new ObjectId(auth.userId),
    });

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

  const liftId = parseObjectId(params.id);
  if (!liftId) {
    return NextResponse.json({ message: "Invalid lift id" }, { status: 400 });
  }

  try {
    const userObjectId = new ObjectId(auth.userId);
    const result = await auth.db.collection("lifts").deleteOne({
      _id: liftId,
      userId: userObjectId,
    });

    if (result.deletedCount === 0) {
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

  const liftId = parseObjectId(params.id);
  if (!liftId) {
    return NextResponse.json({ message: "Invalid lift id" }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const update = { updatedAt: new Date() };
  let hasUpdates = false;

  if (body.exerciseId !== undefined) {
    const exerciseIdRaw = typeof body.exerciseId === "string" ? body.exerciseId.trim() : "";
    if (exerciseIdRaw) {
      const canonical = getExerciseById(exerciseIdRaw);
      if (!canonical) {
        return NextResponse.json({ message: "Unknown exercise selection" }, { status: 400 });
      }
      update.exerciseId = canonical.id;
      update.exercise = canonical.label;
    } else {
      update.exerciseId = null;
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
      update.exerciseId = inferredId;
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
    update.recordedAt = recordedAt;
    hasUpdates = true;
  }

  if (!hasUpdates) {
    return NextResponse.json({ message: "No updates supplied" }, { status: 400 });
  }

  try {
    const userObjectId = new ObjectId(auth.userId);
    const result = await auth.db.collection("lifts").findOneAndUpdate(
      { _id: liftId, userId: userObjectId },
      { $set: update },
      { returnDocument: "after" }
    );

    const updated = unwrapResult(result);

    if (!updated) {
      return NextResponse.json({ message: "Lift not found" }, { status: 404 });
    }

    return NextResponse.json(sanitizeLift(updated), { status: 200 });
  } catch (error) {
    console.error("Lift update error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}



import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAuth } from "../../../lib/api-utils";
import { serializeTask } from "../route";

function parseObjectId(id) {
  if (!ObjectId.isValid(id)) {
    return null;
  }
  return new ObjectId(id);
}

export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const taskId = parseObjectId(params.id);
  if (!taskId) {
    return NextResponse.json({ message: "Invalid task id" }, { status: 400 });
  }

  try {
    const task = await auth.db.collection("tasks").findOne({
      _id: taskId,
      userId: new ObjectId(auth.userId),
    });

    if (!task) {
      return NextResponse.json({ message: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(serializeTask(task), { status: 200 });
  } catch (error) {
    console.error("Task fetch error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const taskId = parseObjectId(params.id);
  if (!taskId) {
    return NextResponse.json({ message: "Invalid task id" }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const update = { updatedAt: new Date() };

  if (body.title !== undefined) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json({ message: "Title cannot be empty" }, { status: 400 });
    }
    update.title = title;
  }

  if (body.description !== undefined) {
    update.description =
      typeof body.description === "string" ? body.description.trim() : "";
  }

  if (body.completed !== undefined) {
    update.completed = Boolean(body.completed);
  }

  try {
    const result = await auth.db.collection("tasks").findOneAndUpdate(
      { _id: taskId, userId: new ObjectId(auth.userId) },
      { $set: update },
      { returnDocument: "after" }
    );

    if (!result.value) {
      return NextResponse.json({ message: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(serializeTask(result.value), { status: 200 });
  } catch (error) {
    console.error("Task update error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const taskId = parseObjectId(params.id);
  if (!taskId) {
    return NextResponse.json({ message: "Invalid task id" }, { status: 400 });
  }

  try {
    const result = await auth.db.collection("tasks").deleteOne({
      _id: taskId,
      userId: new ObjectId(auth.userId),
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ message: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Task deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Task delete error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

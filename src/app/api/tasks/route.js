import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAuth } from "../../lib/api-utils";

export function serializeTask(task) {
  if (!task) return null;
  return {
    id: task._id?.toString(),
    _id: task._id?.toString(),
    title: task.title,
    description: task.description,
    completed: Boolean(task.completed),
    userId: task.userId instanceof ObjectId ? task.userId.toString() : task.userId,
    createdAt: task.createdAt instanceof Date ? task.createdAt.toISOString() : task.createdAt,
    updatedAt: task.updatedAt instanceof Date ? task.updatedAt.toISOString() : task.updatedAt,
  };
}

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  try {
    const tasks = await auth.db
      .collection("tasks")
      .find({ userId: new ObjectId(auth.userId) })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json(tasks.map(serializeTask), { status: 200 });
  } catch (error) {
    console.error("Tasks fetch error:", error);
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

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";

  if (!title) {
    return NextResponse.json({ message: "Title is required" }, { status: 400 });
  }

  try {
    const now = new Date();
    const newTask = {
      title,
      description,
      completed: false,
      userId: new ObjectId(auth.userId),
      createdAt: now,
      updatedAt: now,
    };

    const result = await auth.db.collection("tasks").insertOne(newTask);
    const insertedTask = await auth.db
      .collection("tasks")
      .findOne({ _id: result.insertedId });

    return NextResponse.json(serializeTask(insertedTask), { status: 201 });
  } catch (error) {
    console.error("Task creation error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}





import { NextResponse } from "next/server";
import { requireAuth } from "../../lib/api-utils";
import { serializeTask } from "./utils";

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  try {
    const { data: tasks, error } = await auth.supabase
      .from("tasks")
      .select("*")
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json((tasks ?? []).map(serializeTask), { status: 200 });
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
  const rawType = typeof body.type === "string" ? body.type.trim().toLowerCase() : "";
  const type = rawType === "daily" ? "daily" : "special";
  const dueDate = type === "special" && typeof body.dueDate === "string" ? body.dueDate.trim() : null;

  if (!title) {
    return NextResponse.json({ message: "Title is required" }, { status: 400 });
  }

  try {
    const now = new Date().toISOString();
    const newTask = {
      title,
      description,
      completed: false,
      status: "pending",
      type,
      due_date: dueDate || null,
      user_id: auth.userId,
      created_at: now,
      updated_at: now,
    };

    const { data: insertedTask, error } = await auth.supabase
      .from("tasks")
      .insert(newTask)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(serializeTask(insertedTask), { status: 201 });
  } catch (error) {
    console.error("Task creation error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

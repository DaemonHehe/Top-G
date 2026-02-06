import { NextResponse } from "next/server";
import { applyUserXpUpdate, getCurrentStreak, requireAuth } from "../../../lib/api-utils";
import { serializeTask } from "../utils";

function parseTaskId(id) {
  if (typeof id !== "string") {
    return null;
  }
  const trimmed = id.trim();
  return trimmed ? trimmed : null;
}

export async function GET(request, context) {
  const params = (await context.params) ?? {};

  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const taskId = parseTaskId(params.id);
  if (!taskId) {
    return NextResponse.json({ message: "Invalid task id" }, { status: 400 });
  }

  try {
    const { data: task, error } = await auth.supabase
      .from("tasks")
      .select("*")
      .eq("id", taskId)
      .eq("user_id", auth.userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!task) {
      return NextResponse.json({ message: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(serializeTask(task), { status: 200 });
  } catch (error) {
    console.error("Task fetch error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request, context) {
  const params = (await context.params) ?? {};

  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const taskId = parseTaskId(params.id);
  if (!taskId) {
    return NextResponse.json({ message: "Invalid task id" }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const update = { updated_at: new Date().toISOString() };
  const allowedStatuses = new Set(["pending", "completed", "failed"]);
  const allowedTypes = new Set(["daily", "special", "protocol"]);

  if (body.title !== undefined) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json({ message: "Title cannot be empty" }, { status: 400 });
    }
    update.title = title;
  }

  if (body.description !== undefined) {
    update.description = typeof body.description === "string" ? body.description.trim() : "";
  }

  if (body.status !== undefined) {
    const status = typeof body.status === "string" ? body.status.trim().toLowerCase() : "";
    if (!allowedStatuses.has(status)) {
      return NextResponse.json({ message: "Invalid status" }, { status: 400 });
    }
    update.status = status;
    update.completed = status === "completed";
    update.completed_at = status === "completed" ? new Date().toISOString() : null;
  }

  if (body.completed !== undefined) {
    const completed = Boolean(body.completed);
    update.completed = completed;
    if (update.status === undefined) {
      update.status = completed ? "completed" : "pending";
    }
    update.completed_at = completed ? new Date().toISOString() : null;
  }

  if (body.type !== undefined) {
    const type = typeof body.type === "string" ? body.type.trim().toLowerCase() : "";
    if (!allowedTypes.has(type)) {
      return NextResponse.json({ message: "Invalid type" }, { status: 400 });
    }
    update.type = type;
  }

  if (body.dueDate !== undefined) {
    if (body.dueDate === null || body.dueDate === "") {
      update.due_date = null;
    } else if (typeof body.dueDate === "string") {
      const due = body.dueDate.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) {
        return NextResponse.json(
          { message: "Invalid dueDate format (expected YYYY-MM-DD)" },
          { status: 400 }
        );
      }
      update.due_date = due;
    }
  }

  try {
    const { data: existingTask, error: existingError } = await auth.supabase
      .from("tasks")
      .select("status,completed,type,is_smart,protocol_task_id")
      .eq("id", taskId)
      .eq("user_id", auth.userId)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (!existingTask) {
      return NextResponse.json({ message: "Task not found" }, { status: 404 });
    }

    const isProtocol = existingTask.type === "protocol" || Boolean(existingTask.protocol_task_id);
    if (isProtocol) {
      if (body.title !== undefined || body.description !== undefined || body.type !== undefined || body.dueDate !== undefined) {
        return NextResponse.json({ message: "Protocol tasks cannot be edited." }, { status: 403 });
      }
      if (existingTask.is_smart && (body.status !== undefined || body.completed !== undefined)) {
        return NextResponse.json({ message: "Smart protocol tasks auto-complete." }, { status: 403 });
      }
    }

    const { data: updatedTask, error } = await auth.supabase
      .from("tasks")
      .update(update)
      .eq("id", taskId)
      .eq("user_id", auth.userId)
      .select("*")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!updatedTask) {
      return NextResponse.json({ message: "Task not found" }, { status: 404 });
    }

    const previousCompleted =
      existingTask.status === "completed" || existingTask.completed === true;
    const nextCompleted =
      updatedTask.status === "completed" || updatedTask.completed === true;

    if (!previousCompleted && nextCompleted) {
      try {
        const timeZone = auth.user?.timezone || "UTC";
        const currentStreak = await getCurrentStreak(auth.supabase, auth.userId, timeZone);
        await applyUserXpUpdate(auth.supabase, auth.user, "task_complete", { currentStreak });
      } catch (xpError) {
        console.error("Task XP update error:", xpError);
      }
    }

    return NextResponse.json(serializeTask(updatedTask), { status: 200 });
  } catch (error) {
    console.error("Task update error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request, context) {
  const params = (await context.params) ?? {};

  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const taskId = parseTaskId(params.id);
  if (!taskId) {
    return NextResponse.json({ message: "Invalid task id" }, { status: 400 });
  }

  try {
    const { data: existingTask, error: existingError } = await auth.supabase
      .from("tasks")
      .select("type,protocol_task_id")
      .eq("id", taskId)
      .eq("user_id", auth.userId)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (!existingTask) {
      return NextResponse.json({ message: "Task not found" }, { status: 404 });
    }

    const isProtocol = existingTask.type === "protocol" || Boolean(existingTask.protocol_task_id);
    if (isProtocol) {
      return NextResponse.json({ message: "Protocol tasks cannot be deleted." }, { status: 403 });
    }

    const { data, error } = await auth.supabase
      .from("tasks")
      .delete()
      .eq("id", taskId)
      .eq("user_id", auth.userId)
      .select("id");

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ message: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Task deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Task delete error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

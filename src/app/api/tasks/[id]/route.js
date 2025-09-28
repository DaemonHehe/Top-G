import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAuth } from "../../../lib/api-utils";
import { serializeTask } from "../utils";

function parseObjectId(id) {
  if (!ObjectId.isValid(id)) {
    return null;
  }
  return new ObjectId(id);
}

function unwrapFindOneAndModifyResult(result) {
  if (!result) {
    return null;
  }

  if (typeof result === "object" && "value" in result) {
    return result.value;
  }

  return result;
}

export async function GET(request, context) {
  const params = (await context.params) ?? {};

  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const taskId = parseObjectId(params.id);
  if (!taskId) {
    return NextResponse.json({ message: "Invalid task id" }, { status: 400 });
  }

  try {
    const userObjectId = new ObjectId(auth.userId);
    const task = await auth.db.collection("tasks").findOne({
      _id: taskId,
      userId: userObjectId,
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

export async function PUT(request, context) {
  const params = (await context.params) ?? {};

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
  const allowedStatuses = new Set(["pending", "completed", "failed"]);
  const allowedTypes = new Set(["daily", "special"]);

  if (body.title !== undefined) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json({ message: "Title cannot be empty" }, { status: 400 });
    }
    update.title = title;
  }

  if (body.description !== undefined) {
    update.description = (
      typeof body.description === "string" ? body.description.trim() : ""
    );
  }

  if (body.status !== undefined) {
    const status =
      typeof body.status === "string" ? body.status.trim().toLowerCase() : "";
    if (!allowedStatuses.has(status)) {
      return NextResponse.json({ message: "Invalid status" }, { status: 400 });
    }
    update.status = status;
    update.completed = status === "completed";
  }

  if (body.completed !== undefined) {
    const completed = Boolean(body.completed);
    update.completed = completed;
    if (update.status === undefined) {
      update.status = completed ? "completed" : "pending";
    }
  }

  if (body.type !== undefined) {
    const type = typeof body.type === "string" ? body.type.trim().toLowerCase() : "";
    if (!allowedTypes.has(type)) {
      return NextResponse.json({ message: "Invalid type" }, { status: 400 });
    }
    update.type = type;
  }

  if (body.dueDate !== undefined) {
    // Accept empty string/null to clear for non-special tasks
    if (body.dueDate === null || body.dueDate === "") {
      update.dueDate = null;
    } else if (typeof body.dueDate === "string") {
      const due = body.dueDate.trim();
      // Basic YYYY-MM-DD check
      if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) {
        return NextResponse.json({ message: "Invalid dueDate format (expected YYYY-MM-DD)" }, { status: 400 });
      }
      update.dueDate = due;
    }
  }

  try {
    const userObjectId = new ObjectId(auth.userId);
    const rawResult = await auth.db.collection("tasks").findOneAndUpdate(
      { _id: taskId, userId: userObjectId },
      { $set: update },
      { returnDocument: "after" }
    );

    const updatedTask = unwrapFindOneAndModifyResult(rawResult);

    if (!updatedTask) {
      return NextResponse.json({ message: "Task not found" }, { status: 404 });
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

  const taskId = parseObjectId(params.id);
  if (!taskId) {
    return NextResponse.json({ message: "Invalid task id" }, { status: 400 });
  }

  try {
    const userObjectId = new ObjectId(auth.userId);
    const result = await auth.db.collection("tasks").deleteOne({
      _id: taskId,
      userId: userObjectId,
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


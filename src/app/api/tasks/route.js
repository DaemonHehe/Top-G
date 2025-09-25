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
    // explicit status field with fallback for older docs
    status: typeof task.status === "string" ? task.status : (task.completed ? "completed" : "pending"),
    completed: Boolean(task.completed),
    type: task.type || "special",
    dueDate: task.dueDate || null,
    lastFailedDate: task.lastFailedDate || null,
    userId: task.userId instanceof ObjectId ? task.userId.toString() : task.userId,
    createdAt: task.createdAt instanceof Date ? task.createdAt.toISOString() : task.createdAt,
    updatedAt: task.updatedAt instanceof Date ? task.updatedAt.toISOString() : task.updatedAt,
  };
}

// Timezone helpers using IANA tz with Intl API
function toISODateInTZ(date = new Date(), timeZone = 'UTC') {
  // en-CA yields YYYY-MM-DD reliably
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(date); // e.g., 2025-09-23
}

function getTodayAndYesterdayISO(timeZone = 'UTC') {
  const now = new Date();
  const todayISO = toISODateInTZ(now, timeZone);
  // DST-safe-ish: format(now - 24h) in same tz
  const yesterdayISO = toISODateInTZ(new Date(now.getTime() - 24 * 60 * 60 * 1000), timeZone);
  return { todayISO, yesterdayISO };
}

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  try {
    // Perform daily rollover once per day per user (per-user timezone)
    const userTimeZone = auth.user?.timezone || 'UTC';
    const { todayISO, yesterdayISO } = getTodayAndYesterdayISO(userTimeZone);
    const userObjectId = new ObjectId(auth.userId);

    const userDoc = await auth.db.collection("users").findOne({ _id: userObjectId });
    const lastRollover = userDoc?.lastTasksRolloverDate || null;

    if (lastRollover !== todayISO) {

      // 1) Auto-fail overdue special tasks (dueDate < today) that are not completed
      await auth.db.collection("tasks").updateMany(
        {
          userId: userObjectId,
          type: "special",
          $or: [{ status: { $exists: false } }, { status: { $in: ["pending", "failed"] } }],
          dueDate: { $lt: todayISO },
        },
        {
          $set: { status: "failed", completed: false, updatedAt: new Date() },
        }
      );

      // 2) For daily tasks: mark prior day's incomplete as failed, then reset to pending for the new day
      // Mark as failed if not completed
      await auth.db.collection("tasks").updateMany(
        {
          userId: userObjectId,
          type: "daily",
          $or: [{ status: { $exists: false } }, { status: { $ne: "completed" } }],
        },
        {
          $set: { status: "failed", completed: false, lastFailedDate: yesterdayISO, updatedAt: new Date() },
        }
      );

      // Reset all daily tasks to pending for the new day
      await auth.db.collection("tasks").updateMany(
        { userId: userObjectId, type: "daily" },
        { $set: { status: "pending", completed: false, updatedAt: new Date() } }
      );

      // Update user's last rollover date
      await auth.db.collection("users").updateOne(
        { _id: userObjectId },
        { $set: { lastTasksRolloverDate: todayISO, updatedAt: new Date() } }
      );
    }

    const tasks = await auth.db
      .collection("tasks")
      .find({ userId: userObjectId })
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
  const rawType = typeof body.type === "string" ? body.type.trim().toLowerCase() : "";
  const type = rawType === "daily" ? "daily" : "special";
  const dueDate = type === "special" && typeof body.dueDate === "string" ? body.dueDate.trim() : null;

  if (!title) {
    return NextResponse.json({ message: "Title is required" }, { status: 400 });
  }

  try {
    const now = new Date();
    const newTask = {
      title,
      description,
      completed: false,
      status: "pending",
      type,
      dueDate: dueDate || null,
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

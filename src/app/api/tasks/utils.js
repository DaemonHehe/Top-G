import { ObjectId } from "mongodb";

export function serializeTask(task) {
  if (!task) return null;

  return {
    id: task._id?.toString(),
    _id: task._id?.toString(),
    title: task.title,
    description: task.description,
    status: typeof task.status === "string" ? task.status : task.completed ? "completed" : "pending",
    completed: Boolean(task.completed),
    type: task.type || "special",
    dueDate: task.dueDate || null,
    lastFailedDate: task.lastFailedDate || null,
    userId: task.userId instanceof ObjectId ? task.userId.toString() : task.userId,
    createdAt: task.createdAt instanceof Date ? task.createdAt.toISOString() : task.createdAt,
    updatedAt: task.updatedAt instanceof Date ? task.updatedAt.toISOString() : task.updatedAt,
  };
}

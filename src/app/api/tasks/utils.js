export function serializeTask(task) {
  if (!task) return null;

  const id = task.id ?? task._id?.toString();
  const userId = task.user_id ?? task.userId;
  const createdAt = task.created_at ?? task.createdAt;
  const updatedAt = task.updated_at ?? task.updatedAt;
  const dueDate = task.due_date ?? task.dueDate ?? null;
  const injectedDate = task.injected_date ?? task.injectedDate ?? null;
  const dueTime = task.due_time ?? task.dueTime ?? null;
  const lastFailedDate = task.last_failed_date ?? task.lastFailedDate ?? null;

  return {
    id,
    _id: id,
    title: task.title,
    description: task.description,
    status: typeof task.status === "string" ? task.status : task.completed ? "completed" : "pending",
    completed: Boolean(task.completed),
    type: task.type || "special",
    dueDate,
    injectedDate,
    dueTime,
    protocolEnrollmentId: task.protocol_enrollment_id ?? task.protocolEnrollmentId ?? null,
    protocolBlueprintId: task.protocol_blueprint_id ?? task.protocolBlueprintId ?? null,
    protocolTaskId: task.protocol_task_id ?? task.protocolTaskId ?? null,
    isSmart: Boolean(task.is_smart ?? task.isSmart),
    smartAction: task.smart_action ?? task.smartAction ?? null,
    lastFailedDate,
    userId,
    createdAt: createdAt instanceof Date ? createdAt.toISOString() : createdAt,
    updatedAt: updatedAt instanceof Date ? updatedAt.toISOString() : updatedAt,
  };
}

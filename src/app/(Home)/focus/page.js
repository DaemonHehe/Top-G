'use client';

import { useEffect, useMemo, useState } from "react";
import NavigationBar from "../../components/navigation-bar";
import { useRouter } from "next/navigation";

const STATUS_LABELS = {
  pending: "Pending",
  completed: "Completed",
  failed: "Logged as failed",
};

const STATUS_BADGE_CLASSES = {
  pending: "bg-[var(--neutral-bg)] border border-[var(--neutral-border)] text-[var(--neutral-text)]",
  completed: "bg-[var(--success-bg)] border border-[var(--success-border)] text-[var(--success-text)]",
  failed: "bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger-text)]",
};

const STATUS_ORDER = ["pending", "completed", "failed"];

const normaliseTask = (task) => {
  const status = task.status ?? (task.completed ? "completed" : "pending");
  return { ...task, status };
};

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

export default function Focus() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState({ title: "", description: "", type: "daily", dueDate: "" });
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const router = useRouter();
  const todayLabel = useMemo(() => formatDate(new Date()), []);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await fetch("/api/tasks", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setTasks(data.map(normaliseTask));
      } else {
        console.error("Failed to fetch tasks");
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;

    setIsAddingTask(true);

    try {
      const payload = {
        title: newTask.title,
        description: newTask.description,
        type: newTask.type === "daily" ? "daily" : "special",
      };
      if (payload.type === "special" && newTask.dueDate) {
        payload.dueDate = newTask.dueDate;
      }

      const response = await fetch("/api/tasks", {
        credentials: "include",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const task = await response.json();
        setTasks((prev) => [normaliseTask(task), ...prev]);
        setNewTask({ title: "", description: "", type: "daily", dueDate: "" });
      }
    } catch (error) {
      console.error("Error adding task:", error);
    } finally {
      setIsAddingTask(false);
    }
  };

  const handleUpdateTask = async (taskId, updates) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        credentials: "include",
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      const updatedTask = await response.json();

      if (!response.ok) {
        throw new Error(updatedTask?.message || "Failed to update task");
      }

      setTasks((prev) =>
        prev.map((task) => (task._id === taskId ? normaliseTask(updatedTask) : task))
      );
      setEditingTask(null);
      return updatedTask;
    } catch (error) {
      console.error("Error updating task:", error);
      throw error;
    }
  };

  const handleUpdateStatus = async (taskId, status) => {
    const snapshot = tasks.map((task) => ({ ...task }));
    setTasks((current) =>
      current.map((task) =>
        task._id === taskId
          ? normaliseTask({ ...task, status, completed: status === "completed" })
          : task
      )
    );

    try {
      await handleUpdateTask(taskId, { status });
    } catch (error) {
      console.error("Error updating status:", error);
      setTasks(snapshot);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm("Are you sure you want to delete this task?")) return;

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        credentials: "include",
        method: "DELETE",
      });

      if (response.ok) {
        setTasks((prev) => prev.filter((task) => task._id !== taskId));
      }
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const grouped = useMemo(() => {
    return tasks.reduce(
      (acc, rawTask) => {
        const task = normaliseTask(rawTask);
        const status = task.status ?? "pending";
        acc.counts.total += 1;
        acc.counts[status] = (acc.counts[status] ?? 0) + 1;
        acc.byStatus[status] = [...(acc.byStatus[status] ?? []), task];
        return acc;
      },
      {
        counts: { total: 0, pending: 0, completed: 0, failed: 0 },
        byStatus: {
          pending: [],
          completed: [],
          failed: [],
        },
      }
    );
  }, [tasks]);

  const successRate = useMemo(() => {
    if (grouped.counts.total === 0) return 0;
    return Math.round((grouped.counts.completed / grouped.counts.total) * 100);
  }, [grouped.counts.completed, grouped.counts.total]);

  const sections = STATUS_ORDER.filter((status) => grouped.byStatus[status].length > 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background-muted)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)] mx-auto"></div>
          <p className="mt-4 text-[var(--text-secondary)]">Loading your daily plan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background-muted)]">
      <NavigationBar onLogout={handleLogout} />
      <div className="bg-[var(--surface)] shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:gap-5 py-5 sm:py-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">
                Focus Command Center
              </h1>
              <p className="text-sm sm:text-base text-[var(--text-secondary)]">
                Assign, track, and close the missions on your plate.
              </p>
            </div>
            <div className="flex flex-col items-start gap-2 text-sm text-[var(--text-secondary)] sm:items-end">
        {todayLabel && (
          <span className="text-base sm:text-lg font-medium text-[var(--text-primary)]">
            Today â€“ {todayLabel}
          </span>
        )}
        <div className="mt-2 max-w-xs text-left sm:text-right italic text-[var(--text-primary)]">
          â€œDiscipline is the bridge between goals and accomplishment.â€
          <br />
          <span className="text-[var(--text-muted)]">â€” Jim Rohn</span>
        </div>
      </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-8">
        <section className="mb-10">
          <div
            className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 sm:p-8"
            style={{ boxShadow: "var(--card-shadow)" }}
          >
            <h2 className="text-base sm:text-lg font-semibold text-[var(--text-primary)] mb-3 sm:mb-4">
              Add to today&apos;s to-do list
            </h2>
            <form onSubmit={handleAddTask} className="space-y-3 sm:space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Task title - keep it action-oriented"
                  value={newTask.title}
                  onChange={(e) =>
                    setNewTask((prev) => ({ ...prev, title: e.target.value }))
                  }
                  className="w-full"
                  required
                />
              </div>
              <div>
                <textarea
                  placeholder="Extra notes, target outcome, or metrics (optional)"
                  value={newTask.description}
                  onChange={(e) =>
                    setNewTask((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="w-full h-24 resize-none"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-[var(--text-secondary)]">Task type</label>
                  <select
                    value={newTask.type}
                    onChange={(e) => setNewTask((prev) => ({ ...prev, type: e.target.value }))}
                    className="mt-1 w-full"
                  >
                    <option value="daily">Daily</option>
                    <option value="special">Special (single day)</option>
                  </select>
                </div>
                {newTask.type === "special" && (
                  <div>
                    <label className="text-sm font-medium text-[var(--text-secondary)]">Due date</label>
                    <input
                      type="date"
                      value={newTask.dueDate}
                      onChange={(e) => setNewTask((prev) => ({ ...prev, dueDate: e.target.value }))}
                      className="mt-1 w-full"
                    />
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={isAddingTask}
                className="btn-primary w-full sm:w-auto"
              >
                {isAddingTask ? "Logging..." : "Add task to the battle plan"}
              </button>
            </form>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-4 mb-10">
          <SummaryCard
            title="Total tasks"
            value={grouped.counts.total}
            highlight="var(--accent)"
          />
          <SummaryCard
            title="Completed"
            value={grouped.counts.completed}
            highlight="var(--success-accent)"
          />
          <SummaryCard
            title="Pending"
            value={grouped.counts.pending}
            highlight="var(--warning-text)"
          />
          <SummaryCard
            title="Failed"
            value={grouped.counts.failed}
            highlight="var(--danger)"
          />
        </section>

        <section
          className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 sm:p-8 mb-10"
          style={{ boxShadow: "var(--card-shadow)" }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-[var(--text-primary)]">
                Daily reflection log
              </h3>
              <p className="text-sm text-[var(--text-secondary)]">
                {grouped.counts.total === 0
                  ? "Log tasks above to start tracking the day."
                  : grouped.counts.completed === grouped.counts.total
                  ? "Full sweep. Every task cleared. Keep the streak alive."
                  : grouped.counts.failed > 0
                  ? "Review failed items, capture lessons, and convert them into tomorrow's momentum."
                  : "Solid progress. Finish the pending items or log them before sign-off."}
              </p>
            </div>
            <div className="rounded-full bg-[var(--surface-subtle)] px-5 py-2 text-center text-sm font-semibold text-[var(--accent)]">
              {successRate}% completion rate today
            </div>
          </div>
        </section>

        <section className="space-y-6">
          {sections.length === 0 && (
            <div
              className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-12 text-center"
              style={{ boxShadow: "var(--card-shadow)" }}
            >
              <p className="text-[var(--text-muted)] text-lg">
                No tasks logged yet. Add items to your daily list above.
              </p>
            </div>
          )}

          {sections.map((status) => (
            <div
              key={status}
              className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 sm:p-6"
              style={{ boxShadow: "var(--card-shadow)" }}
            >
              <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4">
                <h2 className="text-lg sm:text-xl font-semibold text-[var(--text-primary)]">
                  {status === "pending" && "Still on deck"}
                  {status === "completed" && "Completed today"}
                  {status === "failed" && "Logged as failed"}
                </h2>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${STATUS_BADGE_CLASSES[status]}`}
                >
                  {STATUS_LABELS[status]}
                </span>
              </div>
              <div className="space-y-4">
                {grouped.byStatus[status].map((task) => (
                  <TaskItem
                    key={task._id}
                    task={task}
                    editingTask={editingTask}
                    setEditingTask={setEditingTask}
                    onUpdateStatus={handleUpdateStatus}
                    onUpdate={handleUpdateTask}
                    onDelete={handleDeleteTask}
                  />
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

function TaskItem({
  task,
  editingTask,
  setEditingTask,
  onUpdateStatus,
  onUpdate,
  onDelete,
}) {
  const status = task.status ?? (task.completed ? "completed" : "pending");
  const [editForm, setEditForm] = useState({
    title: task.title,
    description: task.description || "",
    type: task.type || "special",
    dueDate: task.dueDate || "",
  });

  useEffect(() => {
    setEditForm({
      title: task.title,
      description: task.description || "",
      type: task.type || "special",
      dueDate: task.dueDate || "",
    });
  }, [task._id, task.title, task.description, task.type, task.dueDate]);

  const handleEdit = () => {
    setEditingTask(task._id);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editForm.title.trim()) return;

    const payload = {
      title: editForm.title.trim(),
      description: editForm.description.trim(),
      type: editForm.type === "daily" ? "daily" : "special",
    };
    if (payload.type === "special") {
      payload.dueDate = editForm.dueDate || null;
    } else {
      payload.dueDate = null;
    }

    await onUpdate(task._id, payload);
  };

  const handleCancelEdit = () => {
    setEditingTask(null);
    setEditForm({
      title: task.title,
      description: task.description || "",
      type: task.type || "special",
      dueDate: task.dueDate || "",
    });
  };

  const isEditing = editingTask === task._id;
  const isCompleted = status === "completed";
  const isFailed = status === "failed";

  return (
    <div
      className={`border rounded-2xl p-5 ${
        isCompleted
          ? "bg-[var(--success-bg)] border-[var(--success-border)]"
          : isFailed
          ? "bg-[var(--danger-bg)] border-[var(--danger-border)]"
          : "bg-[var(--surface)] border-[var(--border)]"
      }`}
      style={{ boxShadow: "var(--card-shadow)" }}
    >
      {isEditing ? (
        <form onSubmit={handleSaveEdit} className="space-y-3">
          <input
            type="text"
            value={editForm.title}
            onChange={(e) =>
              setEditForm((prev) => ({ ...prev, title: e.target.value }))
            }
            className="w-full"
            required
          />
          <textarea
            value={editForm.description}
            onChange={(e) =>
              setEditForm((prev) => ({ ...prev, description: e.target.value }))
            }
            className="w-full h-20 resize-none"
            placeholder="Task description..."
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)]">Task type</label>
              <select
                value={editForm.type}
                onChange={(e) => setEditForm((prev) => ({ ...prev, type: e.target.value }))}
                className="mt-1 w-full"
              >
                <option value="daily">Daily</option>
                <option value="special">Special (single day)</option>
              </select>
            </div>
            {editForm.type === "special" && (
              <div>
                <label className="text-sm font-medium text-[var(--text-secondary)]">Due date</label>
                <input
                  type="date"
                  value={editForm.dueDate}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                  className="mt-1 w-full"
                />
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-primary sm:px-5">
              Save
            </button>
            <button type="button" onClick={handleCancelEdit} className="btn-secondary sm:px-5">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={isCompleted}
                onChange={(e) =>
                  onUpdateStatus(task._id, e.target.checked ? "completed" : "pending")
                }
                className="mt-1 h-5 w-5 text-[var(--accent)] rounded border-[var(--border)] focus:ring-[var(--accent)]"
              />
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h3
                    className={`font-medium text-[var(--text-primary)] ${
                      isCompleted ? "line-through" : ""
                    }`}
                  >
                    {task.title}
                  </h3>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${STATUS_BADGE_CLASSES[status]}`}
                  >
                    {STATUS_LABELS[status]}
                  </span>
                  <span className="rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">
                    {task.type === "daily" ? "Daily" : "Special"}
                  </span>
                </div>
                {(task.description || (task.type === "special" && task.dueDate)) && (
                  <p
                    className={`text-sm ${
                      isCompleted
                        ? "text-[var(--text-muted)] line-through"
                        : "text-[var(--text-secondary)]"
                    }`}
                  >
                    {task.description}
                    {task.type === "special" && task.dueDate && (
                      <span className="ml-3 text-[var(--text-muted)]">Due: {task.dueDate}</span>
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex flex-wrap gap-2">
              {status !== "completed" && (
                <button onClick={() => onUpdateStatus(task._id, "completed")} className="btn-primary px-4 py-2">
                  Mark complete
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <button
                onClick={handleEdit}
                className="text-[var(--accent)] hover:text-[var(--accent-hover)]"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(task._id)}
                className="text-[var(--danger)] hover:text-[var(--danger-hover)]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ title, value, highlight }) {
  return (
    <div
      className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6"
      style={{ boxShadow: "var(--card-shadow)" }}
    >
      <p className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
        {title}
      </p>
      <p className="mt-2 text-4xl font-bold" style={{ color: highlight }}>
        {value}
      </p>
    </div>
  );
}






import { NextResponse } from "next/server";
import { isCronAuthorized } from "../../../lib/cron";
import { supabaseAdmin } from "../../../lib/supabase";

function toISODate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export async function POST(request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const todayISO = toISODate(new Date());

  try {
    const { data: enrollments, error } = await supabaseAdmin
      .from("user_protocols")
      .select("id,user_id,blueprint_id,end_date,last_injected_date")
      .eq("status", "Active");

    if (error) throw error;

    const active = (enrollments ?? []).filter((enrollment) => {
      if (enrollment.end_date && enrollment.end_date < todayISO) return false;
      return enrollment.last_injected_date !== todayISO;
    });

    if (active.length === 0) {
      return NextResponse.json({ injected: 0 }, { status: 200 });
    }

    const { data: allTasks, error: taskError } = await supabaseAdmin
      .from("protocol_tasks")
      .select("*")
      .order("sort_order", { ascending: true });

    if (taskError) throw taskError;

    const tasksByBlueprint = new Map();
    for (const task of allTasks ?? []) {
      const list = tasksByBlueprint.get(task.blueprint_id) || [];
      list.push(task);
      tasksByBlueprint.set(task.blueprint_id, list);
    }

    const nowIso = new Date().toISOString();
    const payload = [];
    const enrollmentIds = [];

    for (const enrollment of active) {
      const tasks = tasksByBlueprint.get(enrollment.blueprint_id) || [];
      if (tasks.length === 0) continue;
      enrollmentIds.push(enrollment.id);

      for (const task of tasks) {
        payload.push({
          title: task.title,
          description: task.description || null,
          completed: false,
          status: "pending",
          type: "protocol",
          due_date: todayISO,
          injected_date: todayISO,
          due_time: task.due_time ?? null,
          is_smart: Boolean(task.is_smart),
          smart_action: task.smart_action || null,
          protocol_enrollment_id: enrollment.id,
          protocol_blueprint_id: enrollment.blueprint_id,
          protocol_task_id: task.id,
          user_id: enrollment.user_id,
          created_at: nowIso,
          updated_at: nowIso,
        });
      }
    }

    if (payload.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from("tasks")
        .upsert(payload, { onConflict: "user_id,protocol_task_id,injected_date" });
      if (insertError) throw insertError;
    }

    if (enrollmentIds.length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from("user_protocols")
        .update({ last_injected_date: todayISO, updated_at: nowIso })
        .in("id", enrollmentIds);
      if (updateError) throw updateError;
    }

    return NextResponse.json({ injected: payload.length }, { status: 200 });
  } catch (error) {
    console.error("Protocol injection error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

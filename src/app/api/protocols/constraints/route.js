import { NextResponse } from "next/server";
import { isCronAuthorized } from "../../../lib/cron";
import { supabaseAdmin } from "../../../lib/supabase";
import { applyUserXpUpdate } from "../../../lib/api-utils";

function toISODate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function getTimeString(date = new Date()) {
  return date.toISOString().slice(11, 19);
}

export async function POST(request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const todayISO = toISODate(now);
  const nowTime = getTimeString(now);

  try {
    const { data: lateTasks, error: lateError } = await supabaseAdmin
      .from("tasks")
      .select("id")
      .eq("type", "protocol")
      .eq("status", "pending")
      .eq("due_date", todayISO)
      .not("due_time", "is", null)
      .lt("due_time", nowTime);

    if (lateError) throw lateError;

    if (lateTasks && lateTasks.length > 0) {
      const ids = lateTasks.map((task) => task.id);
      const { error: failError } = await supabaseAdmin
        .from("tasks")
        .update({
          status: "failed",
          completed: false,
          last_failed_date: todayISO,
          updated_at: now.toISOString(),
        })
        .in("id", ids);

      if (failError) throw failError;
    }

    const { data: missedTasks, error: missedError } = await supabaseAdmin
      .from("tasks")
      .select("id")
      .eq("type", "protocol")
      .eq("status", "pending")
      .lt("due_date", todayISO);

    if (missedError) throw missedError;

    if (missedTasks && missedTasks.length > 0) {
      const ids = missedTasks.map((task) => task.id);
      const { error: failMissedError } = await supabaseAdmin
        .from("tasks")
        .update({
          status: "failed",
          completed: false,
          last_failed_date: todayISO,
          updated_at: now.toISOString(),
        })
        .in("id", ids);

      if (failMissedError) throw failMissedError;
    }

    const { data: enrollments, error: enrollError } = await supabaseAdmin
      .from("user_protocols")
      .select("*, blueprint:blueprint_id(*)")
      .eq("status", "Active");

    if (enrollError) throw enrollError;

    const activeEnrollments = enrollments ?? [];
    const enrollmentIds = activeEnrollments.map((enrollment) => enrollment.id);

    const failedEnrollmentIds = new Set();
    if (enrollmentIds.length > 0) {
      const { data: failedRows, error: failedError } = await supabaseAdmin
        .from("tasks")
        .select("protocol_enrollment_id")
        .in("protocol_enrollment_id", enrollmentIds)
        .eq("status", "failed");

      if (failedError) throw failedError;

      for (const row of failedRows ?? []) {
        if (row?.protocol_enrollment_id) {
          failedEnrollmentIds.add(row.protocol_enrollment_id);
        }
      }
    }

    for (const enrollment of activeEnrollments) {
      if (enrollment.end_date && enrollment.end_date >= todayISO) {
        continue;
      }

      const nowIso = now.toISOString();
      const isFailed = failedEnrollmentIds.has(enrollment.id);

      if (isFailed) {
        const { error: updateError } = await supabaseAdmin
          .from("user_protocols")
          .update({ status: "Failed", updated_at: nowIso })
          .eq("id", enrollment.id);

        if (updateError) throw updateError;
        continue;
      }

      const { data: userRow, error: userError } = await supabaseAdmin
        .from("users")
        .select("*")
        .eq("id", enrollment.user_id)
        .maybeSingle();

      if (userError) throw userError;

      if (userRow) {
        await applyUserXpUpdate(supabaseAdmin, userRow, "protocol_reward", {
          rewardXp: Number(enrollment.blueprint?.reward_xp ?? 0),
        });
      }

      if (enrollment.blueprint?.badge_url) {
        await supabaseAdmin.from("user_badges").insert({
          user_id: enrollment.user_id,
          blueprint_id: enrollment.blueprint_id,
          badge_url: enrollment.blueprint.badge_url,
          awarded_at: nowIso,
        });
      }

      const { error: completeError } = await supabaseAdmin
        .from("user_protocols")
        .update({ status: "Completed", completed_at: nowIso, updated_at: nowIso })
        .eq("id", enrollment.id);

      if (completeError) throw completeError;
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("Protocol constraint error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

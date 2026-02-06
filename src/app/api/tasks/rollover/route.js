import { NextResponse } from "next/server";
import { isCronAuthorized } from "../../../lib/cron";
import { supabaseAdmin } from "../../../lib/supabase";

function toISODateInTZ(date = new Date(), timeZone = "UTC") {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(date);
}

function getTodayAndYesterdayISO(timeZone = "UTC") {
  const now = new Date();
  const todayISO = toISODateInTZ(now, timeZone);
  const yesterdayISO = toISODateInTZ(new Date(now.getTime() - 24 * 60 * 60 * 1000), timeZone);
  return { todayISO, yesterdayISO };
}

export async function POST(request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: users, error } = await supabaseAdmin
      .from("users")
      .select("id,timezone,last_tasks_rollover_date");

    if (error) {
      throw error;
    }

    const results = [];
    for (const user of users ?? []) {
      const userTimeZone = user.timezone || "UTC";
      const { todayISO, yesterdayISO } = getTodayAndYesterdayISO(userTimeZone);
      const lastRollover = user.last_tasks_rollover_date || null;

      if (lastRollover === todayISO) {
        continue;
      }

      const rolloverTimestamp = new Date().toISOString();

      const { error: failSpecialError } = await supabaseAdmin
        .from("tasks")
        .update({ status: "failed", completed: false, updated_at: rolloverTimestamp })
        .eq("user_id", user.id)
        .eq("type", "special")
        .or("status.is.null,status.in.(pending,failed)")
        .lt("due_date", todayISO);

      if (failSpecialError) {
        results.push({ userId: user.id, error: "fail-special" });
        continue;
      }

      const { error: failDailyError } = await supabaseAdmin
        .from("tasks")
        .update({
          status: "failed",
          completed: false,
          last_failed_date: yesterdayISO,
          updated_at: rolloverTimestamp,
        })
        .eq("user_id", user.id)
        .eq("type", "daily")
        .or("status.is.null,status.neq.completed");

      if (failDailyError) {
        results.push({ userId: user.id, error: "fail-daily" });
        continue;
      }

      const { error: resetDailyError } = await supabaseAdmin
        .from("tasks")
        .update({ status: "pending", completed: false, updated_at: rolloverTimestamp })
        .eq("user_id", user.id)
        .eq("type", "daily")
        .eq("status", "completed");

      if (resetDailyError) {
        results.push({ userId: user.id, error: "reset-daily" });
        continue;
      }

      const { error: updateUserError } = await supabaseAdmin
        .from("users")
        .update({ last_tasks_rollover_date: todayISO, updated_at: rolloverTimestamp })
        .eq("id", user.id);

      if (updateUserError) {
        results.push({ userId: user.id, error: "update-user" });
        continue;
      }

      results.push({ userId: user.id, rollover: true });
    }

    return NextResponse.json({ ok: true, results }, { status: 200 });
  } catch (error) {
    console.error("Task rollover error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

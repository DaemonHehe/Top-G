import { NextResponse } from "next/server";
import { requireAuth } from "../../lib/api-utils";
import { getRequestIp, rateLimit } from "../../lib/rate-limit";

const RATE_LIMIT = { limit: 30, windowMs: 60_000 };

function addDaysISO(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy.toISOString().slice(0, 10);
}

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const ip = getRequestIp(request);
  const rate = rateLimit(`protocols:get:${auth.userId}:${ip}`, RATE_LIMIT);
  if (!rate.ok) {
    const retryAfter = Math.max(Math.ceil((rate.reset - Date.now()) / 1000), 1);
    return NextResponse.json(
      { message: "Too many requests. Slow down." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  try {
    const [blueprintsRes, tasksRes, enrollmentsRes, badgesRes] = await Promise.all([
      auth.supabase.from("protocol_blueprints").select("*").order("category", { ascending: true }),
      auth.supabase.from("protocol_tasks").select("*").order("sort_order", { ascending: true }),
      auth.supabase
        .from("user_protocols")
        .select("*, blueprint:blueprint_id(*)")
        .eq("user_id", auth.userId)
        .order("created_at", { ascending: false }),
      auth.supabase
        .from("user_badges")
        .select("*")
        .eq("user_id", auth.userId)
        .order("awarded_at", { ascending: false }),
    ]);

    if (blueprintsRes.error) throw blueprintsRes.error;
    if (tasksRes.error) throw tasksRes.error;
    if (enrollmentsRes.error) throw enrollmentsRes.error;
    if (badgesRes.error) throw badgesRes.error;

    return NextResponse.json(
      {
        blueprints: blueprintsRes.data ?? [],
        tasks: tasksRes.data ?? [],
        enrollments: enrollmentsRes.data ?? [],
        badges: badgesRes.data ?? [],
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Protocols fetch error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const ip = getRequestIp(request);
  const rate = rateLimit(`protocols:post:${auth.userId}:${ip}`, RATE_LIMIT);
  if (!rate.ok) {
    const retryAfter = Math.max(Math.ceil((rate.reset - Date.now()) / 1000), 1);
    return NextResponse.json(
      { message: "Too many requests. Slow down." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const injectToday = async (blueprintId, enrollmentId) => {
    const todayISO = new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();

    const { data: tasks, error: taskError } = await auth.supabase
      .from("protocol_tasks")
      .select("*")
      .eq("blueprint_id", blueprintId)
      .order("sort_order", { ascending: true });

    if (taskError) throw taskError;

    const payload = (tasks ?? []).map((task) => ({
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
      protocol_enrollment_id: enrollmentId,
      protocol_blueprint_id: blueprintId,
      protocol_task_id: task.id,
      user_id: auth.userId,
      created_at: nowIso,
      updated_at: nowIso,
    }));

    if (payload.length === 0) return;

    const { error: insertError } = await auth.supabase
      .from("tasks")
      .upsert(payload, { onConflict: "user_id,protocol_task_id,injected_date" });

    if (insertError) throw insertError;
  };

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const blueprintId = typeof body.blueprintId === "string" ? body.blueprintId.trim() : "";
  if (!blueprintId) {
    return NextResponse.json({ message: "Blueprint ID is required." }, { status: 400 });
  }

  try {
    const { data: blueprint, error: blueprintError } = await auth.supabase
      .from("protocol_blueprints")
      .select("*")
      .eq("id", blueprintId)
      .maybeSingle();

    if (blueprintError) throw blueprintError;
    if (!blueprint) return NextResponse.json({ message: "Protocol not found." }, { status: 404 });

    const { data: existingRows, error: existingError } = await auth.supabase
      .from("user_protocols")
      .select("*")
      .eq("user_id", auth.userId)
      .eq("blueprint_id", blueprintId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (existingError) throw existingError;
    const existing = Array.isArray(existingRows) ? existingRows[0] : null;

    if (existing) {
      if (existing.status === "Active") {
        await injectToday(existing.blueprint_id, existing.id);
        return NextResponse.json({ enrollment: existing, injected: true }, { status: 200 });
      }

      const now = new Date();
      const startDate = now.toISOString().slice(0, 10);
      const duration = Math.max(1, Number(blueprint.duration_days || 1));
      const endDate = addDaysISO(now, duration - 1);

      const { data: restarted, error: restartError } = await auth.supabase
        .from("user_protocols")
        .update({
          status: "Active",
          start_date: startDate,
          end_date: endDate,
          days_completed: 0,
          last_injected_date: null,
          completed_at: null,
          updated_at: now.toISOString(),
        })
        .eq("id", existing.id)
        .select("*")
        .single();

      if (restartError) throw restartError;

      await injectToday(blueprintId, restarted.id);
      return NextResponse.json({ enrollment: restarted, injected: true }, { status: 200 });
    }

    const now = new Date();
    const startDate = now.toISOString().slice(0, 10);
    const duration = Math.max(1, Number(blueprint.duration_days || 1));
    const endDate = addDaysISO(now, duration - 1);

    const { data: enrollment, error: insertError } = await auth.supabase
      .from("user_protocols")
      .insert({
        user_id: auth.userId,
        blueprint_id: blueprintId,
        status: "Active",
        start_date: startDate,
        end_date: endDate,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select("*")
      .single();

    if (insertError) throw insertError;

    await injectToday(blueprintId, enrollment.id);

    return NextResponse.json({ enrollment, injected: true }, { status: 201 });
  } catch (error) {
    console.error("Protocol enroll error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const ip = getRequestIp(request);
  const rate = rateLimit(`protocols:delete:${auth.userId}:${ip}`, RATE_LIMIT);
  if (!rate.ok) {
    const retryAfter = Math.max(Math.ceil((rate.reset - Date.now()) / 1000), 1);
    return NextResponse.json(
      { message: "Too many requests. Slow down." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const enrollmentId = typeof body.enrollmentId === "string" ? body.enrollmentId.trim() : "";
  const blueprintId = typeof body.blueprintId === "string" ? body.blueprintId.trim() : "";

  if (!enrollmentId && !blueprintId) {
    return NextResponse.json({ message: "Enrollment ID or Blueprint ID is required." }, { status: 400 });
  }

  try {
    const query = auth.supabase
      .from("user_protocols")
      .select("*")
      .eq("user_id", auth.userId)
      .eq("status", "Active");

    if (enrollmentId) {
      query.eq("id", enrollmentId);
    } else {
      query.eq("blueprint_id", blueprintId);
    }

    const { data: enrollments, error: findError } = await query;
    if (findError) throw findError;

    if (!enrollments || enrollments.length === 0) {
      return NextResponse.json({ message: "Active protocol not found." }, { status: 404 });
    }

    const nowIso = new Date().toISOString();
    const ids = enrollments.map((enrollment) => enrollment.id);
    const { error: updateError } = await auth.supabase
      .from("user_protocols")
      .update({ status: "Cancelled", updated_at: nowIso })
      .in("id", ids)
      .eq("user_id", auth.userId);

    if (updateError) throw updateError;

    const { error: taskError } = await auth.supabase
      .from("tasks")
      .delete()
      .in("protocol_enrollment_id", ids)
      .eq("status", "pending");

    if (taskError) throw taskError;

    return NextResponse.json({ cancelled: true }, { status: 200 });
  } catch (error) {
    console.error("Protocol cancel error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

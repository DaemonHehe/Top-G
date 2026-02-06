import { NextResponse } from "next/server";
import { applyUserXpUpdate, getCurrentStreak, requireAuth, sanitizeUser } from "../../lib/api-utils";
import { shouldApplyWeeklyBonus } from "../../lib/gamification";

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

  const actionType = typeof body.actionType === "string" ? body.actionType.trim() : "";

  if (actionType === "focus_session") {
    const minutes = Number(body.minutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return NextResponse.json({ message: "Minutes must be a positive number." }, { status: 400 });
    }

    try {
      const updated = await applyUserXpUpdate(auth.supabase, auth.user, "focus_session", { minutes });
      return NextResponse.json(
        {
          user: sanitizeUser(updated.user ?? auth.user),
          gamification: updated.gamification,
        },
        { status: 200 }
      );
    } catch (error) {
      console.error("Focus XP update error:", error);
      return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
  }

  if (actionType === "streak_weekly_bonus") {
    let currentStreak = 0;
    try {
      currentStreak = await getCurrentStreak(auth.supabase, auth.userId, auth.user?.timezone || "UTC");
    } catch (error) {
      console.error("Streak calculation error:", error);
      currentStreak = Number(auth.user?.current_streak ?? 0);
    }

    if (currentStreak < 7) {
      return NextResponse.json(
        { applied: false, message: "Weekly bonus requires a 7-day streak." },
        { status: 200 }
      );
    }

    if (!shouldApplyWeeklyBonus(auth.user, currentStreak)) {
      return NextResponse.json({ applied: false, message: "Weekly bonus already claimed." }, { status: 200 });
    }

    try {
      const updated = await applyUserXpUpdate(auth.supabase, auth.user, "streak_weekly_bonus", { currentStreak });
      return NextResponse.json(
        {
          applied: true,
          user: sanitizeUser(updated.user ?? auth.user),
          gamification: updated.gamification,
        },
        { status: 200 }
      );
    } catch (error) {
      console.error("Weekly bonus update error:", error);
      return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
  }

  return NextResponse.json({ message: "Unsupported gamification action." }, { status: 400 });
}

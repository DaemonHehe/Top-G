const RANKS = [
  { name: "Initiate", min: 0, max: 499 },
  { name: "Hustler", min: 500, max: 1499 },
  { name: "Operator", min: 1500, max: 3499 },
  { name: "Kingpin", min: 3500, max: 6999 },
  { name: "Top-G", min: 7000, max: Infinity },
];

const ACTION_XP = {
  login: 0,
  task_complete: 15,
  workout_session: 50,
  protocol_reward: 0,
  streak_weekly_bonus: 100,
};

function toDate(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toISODateInTimeZone(date = new Date(), timeZone = "UTC") {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(date);
}

export function getRankForXp(xp) {
  const total = Math.max(0, Number(xp) || 0);
  const rank = RANKS.find((item) => total >= item.min && total <= item.max);
  return rank?.name || "Initiate";
}

export function getRankIndex(rankName) {
  const index = RANKS.findIndex((rank) => rank.name === rankName);
  return index === -1 ? 0 : index;
}

export function calculateDecay(user, now = new Date()) {
  const lastLogin = toDate(user?.last_login);
  if (!lastLogin) {
    return {
      daysMissed: 0,
      penalty: 0,
      nextXp: Math.max(0, Number(user?.total_xp) || 0),
      lastLogin,
    };
  }

  const diffMs = now.getTime() - lastLogin.getTime();
  if (diffMs <= 24 * 60 * 60 * 1000) {
    return {
      daysMissed: 0,
      penalty: 0,
      nextXp: Math.max(0, Number(user?.total_xp) || 0),
      lastLogin,
    };
  }

  const daysMissed = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const penalty = daysMissed * 50;
  const nextXp = Math.max(0, (Number(user?.total_xp) || 0) - penalty);

  return { daysMissed, penalty, nextXp, lastLogin };
}

export function getActionXp(actionType, payload = {}) {
  if (actionType === "focus_session") {
    const minutes = Number(payload.minutes) || 0;
    return Math.min(Math.max(minutes, 0), 120);
  }

  if (actionType === "protocol_reward") {
    const reward = Number(payload.rewardXp);
    return Number.isFinite(reward) ? Math.max(0, reward) : 0;
  }

  return ACTION_XP[actionType] ?? 0;
}

export function update_user_xp(user, actionType, payload = {}, now = new Date()) {
  const currentXp = Math.max(0, Number(user?.total_xp) || 0);
  const currentRank = user?.current_rank || getRankForXp(currentXp);

  const { daysMissed, penalty, nextXp: decayedXp } = calculateDecay(user, now);
  const xpGain = getActionXp(actionType, payload);
  const nextXp = Math.max(0, decayedXp + xpGain);
  const nextRank = getRankForXp(nextXp);
  const leveled_up = getRankIndex(nextRank) > getRankIndex(currentRank);

  const currentStreak =
    payload.currentStreak !== undefined
      ? Number(payload.currentStreak) || 0
      : Number(user?.current_streak) || 0;

  const lastBonus =
    actionType === "streak_weekly_bonus"
      ? now.toISOString()
      : user?.last_streak_bonus_at ?? null;

  return {
    total_xp: nextXp,
    current_rank: nextRank,
    current_streak: Math.max(0, currentStreak),
    last_login: now.toISOString(),
    last_streak_bonus_at: lastBonus,
    leveled_up,
    xp_delta: xpGain - penalty,
    decay_penalty: penalty,
    days_missed: daysMissed,
  };
}

export function shouldApplyWeeklyBonus(user, currentStreak, now = new Date()) {
  if (Number(currentStreak) < 7) return false;
  const lastBonus = toDate(user?.last_streak_bonus_at);
  if (!lastBonus) return true;
  const diffMs = now.getTime() - lastBonus.getTime();
  return diffMs >= 7 * 24 * 60 * 60 * 1000;
}

export function computeCurrentStreakFromTasks(tasks = [], now = new Date(), timeZone = "UTC") {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return 0;
  }

  const completedDates = new Set();

  for (const task of tasks) {
    const status = task?.status ?? (task?.completed ? "completed" : "");
    if (status !== "completed") continue;

    const source = task.completed_at || task.updated_at || task.created_at;
    if (!source) continue;

    const parsed = toDate(source);
    if (!parsed) continue;

    completedDates.add(toISODateInTimeZone(parsed, timeZone));
  }

  if (completedDates.size === 0) {
    return 0;
  }

  let streak = 0;
  for (let offset = 0; offset < 365; offset += 1) {
    const cursor = new Date(now);
    cursor.setDate(cursor.getDate() - offset);
    const iso = toISODateInTimeZone(cursor, timeZone);
    if (completedDates.has(iso)) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
}

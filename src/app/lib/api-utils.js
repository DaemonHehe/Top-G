import { NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { createSupabaseUserClient, supabaseAdmin } from "./supabase";
import { calculateDecay, computeCurrentStreakFromTasks, update_user_xp } from "./gamification";

function normalizeSupabaseUrl(rawUrl) {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/auth\/v1\/?$/, "");
}

const SUPABASE_URL = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL);
const SUPABASE_ISSUER = process.env.SUPABASE_ISSUER || (SUPABASE_URL ? `${SUPABASE_URL}/auth/v1` : null);
const SUPABASE_JWKS_URL =
  process.env.SUPABASE_JWKS_URL || (SUPABASE_URL ? `${SUPABASE_URL}/auth/v1/.well-known/jwks.json` : null);
let SUPABASE_JWKS = null;
try {
  if (SUPABASE_JWKS_URL) {
    SUPABASE_JWKS = createRemoteJWKSet(new URL(SUPABASE_JWKS_URL));
  }
} catch (error) {
  console.warn("Invalid SUPABASE_JWKS_URL; JWKS verification disabled.", error);
  SUPABASE_JWKS = null;
}
let jwksDisabledUntil = 0;
let lastJwksWarningAt = 0;
const JWKS_LOG_COOLDOWN_MS = 5 * 60 * 1000;

function logJwksWarning(message, error) {
  const now = Date.now();
  if (now - lastJwksWarningAt < JWKS_LOG_COOLDOWN_MS) return;
  lastJwksWarningAt = now;
  console.warn(message, error);
}

function getAccessToken(request) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  if (token === "null" || token === "undefined") {
    return null;
  }
  return token;
}

export async function applyUserXpUpdate(supabase, user, actionType, payload = {}) {
  if (!supabase || !user?.id) {
    return { user, gamification: null };
  }

  const now = new Date();
  const nextState = update_user_xp(user, actionType, payload, now);
  const updatePayload = {
    total_xp: nextState.total_xp,
    current_rank: nextState.current_rank,
    current_streak: nextState.current_streak,
    last_login: nextState.last_login,
    last_streak_bonus_at: nextState.last_streak_bonus_at,
    updated_at: now.toISOString(),
  };

  const { data: updatedUser, error } = await supabase
    .from("users")
    .update(updatePayload)
    .eq("id", user.id)
    .select("*")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    user: updatedUser ?? { ...user, ...updatePayload },
    gamification: nextState,
  };
}

export async function getCurrentStreak(supabase, userId, timeZone = "UTC", now = new Date()) {
  if (!supabase || !userId) return 0;

  const since = new Date(now);
  since.setDate(since.getDate() - 60);

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("status,completed,updated_at,created_at,completed_at")
    .eq("user_id", userId)
    .or("status.eq.completed,completed.eq.true")
    .gte("updated_at", since.toISOString());

  if (error) {
    throw error;
  }

  return computeCurrentStreakFromTasks(tasks ?? [], now, timeZone || "UTC");
}

export async function requireAuth(request) {
  const token = getAccessToken(request);

  if (!token) {
    return {
      error: NextResponse.json({ message: "Authentication required" }, { status: 401 }),
    };
  }

  try {
    let authUser;
    let jwksFailed = false;

    if (SUPABASE_JWKS && SUPABASE_ISSUER && Date.now() > jwksDisabledUntil) {
      try {
        const { payload } = await jwtVerify(token, SUPABASE_JWKS, {
          issuer: SUPABASE_ISSUER,
        });

        const aud = payload.aud;
        const audOk = Array.isArray(aud) ? aud.includes("authenticated") : aud === "authenticated";
        if (!payload.sub || !audOk) {
          return {
            error: NextResponse.json({ message: "Invalid token" }, { status: 401 }),
          };
        }

        authUser = {
          id: payload.sub,
          email: payload.email ?? null,
          user_metadata: payload.user_metadata ?? {},
          app_metadata: payload.app_metadata ?? {},
        };
      } catch (error) {
        jwksFailed = true;
        jwksDisabledUntil = Date.now() + 10 * 60 * 1000;
        logJwksWarning("JWKS verify failed; falling back to auth.getUser for 10 minutes.", error);
      }
    }

    if (!authUser) {
      const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

      if (authError || !authData?.user) {
        if (
          authError &&
          authError.name !== "AuthSessionMissingError" &&
          authError.name !== "AuthRetryableFetchError"
        ) {
          console.error("Authentication error:", authError);
        }
        if (authError?.name === "AuthRetryableFetchError" || jwksFailed) {
          return {
            error: NextResponse.json(
              { message: "Authentication service unavailable. Please retry." },
              { status: 503 }
            ),
          };
        }
        return {
          error: NextResponse.json({ message: "Invalid token" }, { status: 401 }),
        };
      }

      authUser = authData.user;
    }

    const supabase = createSupabaseUserClient(token);
    const { data: user, error } = await supabase.from("users").select("*").eq("id", authUser.id).maybeSingle();

    if (error) {
      console.error("Authentication error:", error);
      return {
        error: NextResponse.json({ message: "Authentication failed" }, { status: 500 }),
      };
    }

    if (!user) {
      const now = new Date().toISOString();
      const name =
        authUser.user_metadata?.name ||
        authUser.user_metadata?.full_name ||
        authUser.email?.split("@")[0] ||
        "User";

      const { data: created, error: createError } = await supabaseAdmin
        .from("users")
        .insert({
          id: authUser.id,
          name,
          email: authUser.email,
          created_at: now,
          updated_at: now,
        })
        .select("*")
        .single();

      if (createError) {
        console.error("User bootstrap error:", createError);
        return {
          error: NextResponse.json({ message: "Authentication failed" }, { status: 500 }),
        };
      }

      return { supabase, user: created, userId: authUser.id, authUser };
    }

    let resolvedUser = user;
    try {
      const now = new Date();
      const lastLogin = user.last_login ? new Date(user.last_login) : null;
      const diffMs = lastLogin ? now.getTime() - lastLogin.getTime() : Number.POSITIVE_INFINITY;
      const needsRefresh = !lastLogin || Number.isNaN(diffMs) || diffMs >= 60 * 60 * 1000;
      const decay = calculateDecay(user, now);

      if (needsRefresh || decay.daysMissed > 0) {
        const updated = await applyUserXpUpdate(supabase, user, "login");
        if (updated?.user) {
          resolvedUser = updated.user;
        }
      }
    } catch (error) {
      console.error("Gamification login update error:", error);
    }

    return { supabase, user: resolvedUser, userId: authUser.id, authUser };
  } catch (error) {
    const isJwksError =
      error?.name?.includes("JWKS") ||
      error?.code === "ERR_JWKS_TIMEOUT" ||
      error?.code === "ENOTFOUND" ||
      error?.cause?.code === "UND_ERR_CONNECT_TIMEOUT";
    if (isJwksError) {
      console.error("Authentication error: JWKS fetch failed.");
      return {
        error: NextResponse.json(
          { message: "Authentication service unavailable. Please retry." },
          { status: 503 }
        ),
      };
    }
    const isTimeout =
      error?.name === "AuthRetryableFetchError" ||
      error?.cause?.code === "UND_ERR_CONNECT_TIMEOUT";
    if (isTimeout) {
      console.error("Authentication error: Supabase auth timeout.");
      return {
        error: NextResponse.json(
          { message: "Authentication service unavailable. Please retry." },
          { status: 503 }
        ),
      };
    }
    console.error("Authentication error:", error);
    return {
      error: NextResponse.json({ message: "Authentication failed" }, { status: 500 }),
    };
  }
}

function toIso(value) {
  if (!value) return value ?? null;
  return value instanceof Date ? value.toISOString() : value;
}

export function sanitizeUser(user) {
  if (!user) return null;
  const id = user.id ?? user._id?.toString();
  const avatar = user.avatar || user.avatarUrl || null;
  return {
    id,
    _id: id,
    name: user.name,
    email: user.email,
    avatar,
    avatarUrl: avatar,
    timezone: user.timezone || null,
    totalXp: Number(user.total_xp ?? 0),
    currentRank: user.current_rank || "Initiate",
    currentStreak: Number(user.current_streak ?? 0),
    lastLogin: toIso(user.last_login ?? user.lastLogin),
    lastStreakBonusAt: toIso(user.last_streak_bonus_at ?? user.lastStreakBonusAt),
    createdAt: toIso(user.created_at ?? user.createdAt),
    updatedAt: toIso(user.updated_at ?? user.updatedAt),
  };
}





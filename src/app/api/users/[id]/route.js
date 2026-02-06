import { NextResponse } from "next/server";
import { requireAuth, sanitizeUser } from "../../../lib/api-utils";
import { validateUserUpdate, hasValidationErrors } from "../../../lib/validators";
import { createSupabaseAnonClient, supabaseAdmin } from "../../../lib/supabase";

function parseUserId(id) {
  if (typeof id !== "string") {
    return null;
  }
  const trimmed = id.trim();
  return trimmed ? trimmed : null;
}

function forbidWhenNotSelf(requestedId, authenticatedId) {
  if (requestedId !== authenticatedId) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET(request, context) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const { id } = await context.params;
  const userId = parseUserId(id);
  if (!userId) {
    return NextResponse.json({ message: "Invalid user id" }, { status: 400 });
  }

  const forbidden = forbidWhenNotSelf(id, auth.userId);
  if (forbidden) {
    return forbidden;
  }

  const { data: user, error } = await auth.supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("User fetch error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user: sanitizeUser(user) }, { status: 200 });
}

export async function PUT(request, context) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const { id } = await context.params;
  const requestedUserId = parseUserId(id);
  if (!requestedUserId) {
    return NextResponse.json({ message: "Invalid user id" }, { status: 400 });
  }

  const forbidden = forbidWhenNotSelf(id, auth.userId);
  if (forbidden) {
    return forbidden;
  }

  const authenticatedUserId = parseUserId(auth.userId || auth.user?.id);
  if (!authenticatedUserId) {
    return NextResponse.json({ message: "Invalid authenticated user id" }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const { data, errors } = validateUserUpdate(body);

  if (Object.keys(data).length === 0) {
    errors.general = "No valid fields provided";
  }

  if (hasValidationErrors(errors)) {
    return NextResponse.json({ message: "Validation failed", errors }, { status: 400 });
  }

  if (data.email) {
    const { data: duplicate, error: duplicateError } = await auth.supabase
      .from("users")
      .select("id")
      .eq("email", data.email)
      .neq("id", authenticatedUserId)
      .maybeSingle();

    if (duplicateError) {
      console.error("User email check error:", duplicateError);
      return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }

    if (duplicate) {
      return NextResponse.json({ message: "Email already in use" }, { status: 400 });
    }
  }

  const authUpdates = {};
  if (data.email) authUpdates.email = data.email;
  if (data.password) authUpdates.password = data.password;

  if (Object.keys(authUpdates).length > 0) {
    if (data.password || data.email) {
      const currentPasswordRaw = typeof body.currentPassword === "string" ? body.currentPassword : "";
      if (!currentPasswordRaw) {
        return NextResponse.json({ message: "Current password is required" }, { status: 400 });
      }

      const emailForCheck = auth.authUser?.email || auth.user?.email;
      if (!emailForCheck) {
        return NextResponse.json({ message: "Unable to verify current password" }, { status: 400 });
      }

      const anon = createSupabaseAnonClient();
      const { error: signInError } = await anon.auth.signInWithPassword({
        email: emailForCheck,
        password: currentPasswordRaw,
      });

      if (signInError) {
        return NextResponse.json({ message: "Current password is incorrect" }, { status: 400 });
      }
    }

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(auth.authUser.id, authUpdates);
    if (authError) {
      console.error("Auth update error:", authError);
      return NextResponse.json({ message: authError.message || "Unable to update account credentials" }, { status: 400 });
    }
  }

  const update = { updated_at: new Date().toISOString() };

  if (data.name) {
    update.name = data.name;
  }

  if (data.email) {
    update.email = data.email;
  }

  if (data.timezone) {
    update.timezone = data.timezone;
  }

  if ("avatar" in data) {
    update.avatar = data.avatar;
  }

  try {
    if (Object.keys(update).length <= 1) {
      return NextResponse.json({ user: sanitizeUser(auth.user) }, { status: 200 });
    }

    const { data: updatedUser, error } = await auth.supabase
      .from("users")
      .update(update)
      .eq("id", authenticatedUserId)
      .select("*")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!updatedUser) {
      const { data: fallback, error: fallbackError } = await auth.supabase
        .from("users")
        .select("*")
        .eq("id", authenticatedUserId)
        .maybeSingle();

      if (fallbackError) {
        console.error("User fallback fetch error:", fallbackError);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
      }

      if (!fallback) {
        return NextResponse.json({ message: "We couldn't find your account. Please sign in again." }, { status: 404 });
      }

      return NextResponse.json({ user: sanitizeUser(fallback) }, { status: 200 });
    }

    return NextResponse.json({ user: sanitizeUser(updatedUser) }, { status: 200 });
  } catch (error) {
    console.error("User update error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request, context) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const { id } = await context.params;
  const userId = parseUserId(id);
  if (!userId) {
    return NextResponse.json({ message: "Invalid user id" }, { status: 400 });
  }

  const forbidden = forbidWhenNotSelf(id, auth.userId);
  if (forbidden) {
    return forbidden;
  }

  try {
    const { data: deletion, error } = await supabaseAdmin
      .from("users")
      .delete()
      .eq("id", userId)
      .select("id");

    if (error) {
      throw error;
    }

    if (!deletion || deletion.length === 0) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    if (auth.authUser?.id) {
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(auth.authUser.id);
      if (authDeleteError) {
        console.error("Auth user delete error:", authDeleteError);
      }
    }

    return NextResponse.json({ message: "User deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("User delete error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

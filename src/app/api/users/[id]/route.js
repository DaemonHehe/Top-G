import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { hashPassword, verifyPassword } from "../../../lib/auth";
import { requireAuth, sanitizeUser } from "../../../lib/api-utils";
import { validateUserUpdate, hasValidationErrors } from "../../../lib/validators";

const COOKIE_NAME = "token";

function parseObjectId(id) {
  if (!ObjectId.isValid(id)) {
    return null;
  }
  return new ObjectId(id);
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
  const userId = parseObjectId(id);
  if (!userId) {
    return NextResponse.json({ message: "Invalid user id" }, { status: 400 });
  }

  const forbidden = forbidWhenNotSelf(id, auth.userId);
  if (forbidden) {
    return forbidden;
  }

  const user = await auth.db.collection("users").findOne({ _id: userId });

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
  const requestedUserId = parseObjectId(id);
  if (!requestedUserId) {
    return NextResponse.json({ message: "Invalid user id" }, { status: 400 });
  }

  const forbidden = forbidWhenNotSelf(id, auth.userId);
  if (forbidden) {
    return forbidden;
  }

  const authenticatedUserId = parseObjectId(auth.userId || auth.user?._id?.toString());
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

  const currentPasswordRaw = typeof body.currentPassword === "string" ? body.currentPassword : "";

  if (Object.keys(data).length === 0) {
    errors.general = "No valid fields provided";
  }

  if (data.password) {
    if (!currentPasswordRaw) {
      return NextResponse.json({ message: "Current password is required" }, { status: 400 });
    }

    if (!auth.user?.password) {
      return NextResponse.json({ message: "Password updates are not available for this account" }, { status: 400 });
    }

    const passwordMatches = await verifyPassword(currentPasswordRaw, auth.user.password);
    if (!passwordMatches) {
      return NextResponse.json({ message: "Current password is incorrect" }, { status: 400 });
    }
  }

  if (hasValidationErrors(errors)) {
    return NextResponse.json(
      { message: "Validation failed", errors },
      { status: 400 }
    );
  }

  if (data.email) {
    const duplicate = await auth.db.collection("users").findOne({
      email: data.email,
      _id: { $ne: authenticatedUserId },
    });

    if (duplicate) {
      return NextResponse.json({ message: "Email already in use" }, { status: 400 });
    }
  }

  const update = { updatedAt: new Date() };

  if (data.name) {
    update.name = data.name;
  }

  if (data.email) {
    update.email = data.email;
  }

  if (data.password) {
    update.password = await hashPassword(data.password);
  }

  if (data.timezone) {
    update.timezone = data.timezone;
  }

  if (data.avatar) {
    update.avatar = data.avatar;
  }

  try {
    const result = await auth.db.collection("users").findOneAndUpdate(
      { _id: authenticatedUserId },
      { $set: update },
      { returnDocument: "after" }
    );

    if (!result.value) {
      const fallback = await auth.db.collection("users").findOne({ _id: authenticatedUserId });
      if (!fallback) {
        return NextResponse.json({ message: "We couldn't find your account. Please sign in again." }, { status: 404 });
      }
      return NextResponse.json({ user: sanitizeUser(fallback) }, { status: 200 });
    }

    return NextResponse.json({ user: sanitizeUser(result.value) }, { status: 200 });
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
  const userId = parseObjectId(id);
  if (!userId) {
    return NextResponse.json({ message: "Invalid user id" }, { status: 400 });
  }

  const forbidden = forbidWhenNotSelf(id, auth.userId);
  if (forbidden) {
    return forbidden;
  }

  try {
    const deletion = await auth.db.collection("users").deleteOne({ _id: userId });

    if (deletion.deletedCount === 0) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    await auth.db.collection("tasks").deleteMany({ userId });

    const response = NextResponse.json(
      { message: "User deleted successfully" },
      { status: 200 }
    );

    response.cookies.set({
      name: COOKIE_NAME,
      value: "",
      path: "/",
      httpOnly: true,
      expires: new Date(0),
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error) {
    console.error("User delete error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

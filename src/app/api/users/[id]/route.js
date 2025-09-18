import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { hashPassword } from "../../../lib/auth";
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

export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const userId = parseObjectId(params.id);
  if (!userId) {
    return NextResponse.json({ message: "Invalid user id" }, { status: 400 });
  }

  const forbidden = forbidWhenNotSelf(params.id, auth.userId);
  if (forbidden) {
    return forbidden;
  }

  const user = await auth.db.collection("users").findOne({ _id: userId });

  if (!user) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user: sanitizeUser(user) }, { status: 200 });
}

export async function PUT(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const userId = parseObjectId(params.id);
  if (!userId) {
    return NextResponse.json({ message: "Invalid user id" }, { status: 400 });
  }

  const forbidden = forbidWhenNotSelf(params.id, auth.userId);
  if (forbidden) {
    return forbidden;
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
    return NextResponse.json(
      { message: "Validation failed", errors },
      { status: 400 }
    );
  }

  if (data.email) {
    const duplicate = await auth.db.collection("users").findOne({
      email: data.email,
      _id: { $ne: userId },
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

  try {
    const result = await auth.db.collection("users").findOneAndUpdate(
      { _id: userId },
      { $set: update },
      { returnDocument: "after" }
    );

    if (!result.value) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user: sanitizeUser(result.value) }, { status: 200 });
  } catch (error) {
    console.error("User update error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const userId = parseObjectId(params.id);
  if (!userId) {
    return NextResponse.json({ message: "Invalid user id" }, { status: 400 });
  }

  const forbidden = forbidWhenNotSelf(params.id, auth.userId);
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

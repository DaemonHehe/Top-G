import { NextResponse } from "next/server";
import { hashPassword } from "../../lib/auth";
import { requireAuth, sanitizeUser } from "../../lib/api-utils";
import { validateUserCreate, hasValidationErrors } from "../../lib/validators";

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  return NextResponse.json({ user: sanitizeUser(auth.user) }, { status: 200 });
}

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

  const { data, errors } = validateUserCreate(body);

  if (hasValidationErrors(errors)) {
    return NextResponse.json({ message: "Validation failed", errors }, { status: 400 });
  }

  try {
    const existingUser = await auth.db.collection("users").findOne({ email: data.email });
    if (existingUser) {
      return NextResponse.json({ message: "User already exists" }, { status: 400 });
    }

    const now = new Date();
    const hashedPassword = await hashPassword(data.password);

    const result = await auth.db.collection("users").insertOne({
      name: data.name,
      email: data.email,
      password: hashedPassword,
      createdAt: now,
      updatedAt: now,
    });

    const user = await auth.db
      .collection("users")
      .findOne({ _id: result.insertedId });

    return NextResponse.json({ user: sanitizeUser(user) }, { status: 201 });
  } catch (error) {
    console.error("User create error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

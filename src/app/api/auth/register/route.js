import { NextResponse } from "next/server";
import clientPromise from "../../../lib/mongodb";
import { hashPassword, generateToken } from "../../../lib/auth";
import { sanitizeUser } from "../../../lib/api-utils";
import { validateUserCreate, hasValidationErrors } from "../../../lib/validators";

const COOKIE_NAME = "token";
const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7;

export async function POST(request) {
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
    const client = await clientPromise;
    const db = client.db();

    const existingUser = await db.collection("users").findOne({ email: data.email });
    if (existingUser) {
      return NextResponse.json({ message: "User already exists" }, { status: 400 });
    }

    const hashedPassword = await hashPassword(data.password);
    const now = new Date();

    const result = await db.collection("users").insertOne({
      name: data.name,
      email: data.email,
      password: hashedPassword,
      createdAt: now,
      updatedAt: now,
    });

    const insertedUser = await db.collection("users").findOne({ _id: result.insertedId });
    const token = generateToken(result.insertedId.toString());

    const response = NextResponse.json(
      {
        message: "User created successfully",
        user: sanitizeUser(insertedUser),
      },
      { status: 201 }
    );

    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      path: "/",
      maxAge: ONE_WEEK_SECONDS,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

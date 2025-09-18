import { NextResponse } from "next/server";
import clientPromise from "../../../lib/mongodb";
import { verifyPassword, generateToken } from "../../../lib/auth";
import { sanitizeUser } from "../../../lib/api-utils";

const COOKIE_NAME = "token";
const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7;

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password.trim() : "";

  if (!email || !password) {
    return NextResponse.json({ message: "Email and password are required" }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const user = await db.collection("users").findOne({ email });

    if (!user) {
      console.warn(`Login attempt for missing user: ${email}`);
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    const isValid = await verifyPassword(password, user.password);

    if (!isValid) {
      console.warn(`Login attempt with invalid password: ${email}`);
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    const token = generateToken(user._id.toString());
    const response = NextResponse.json(
      {
        message: "Login successful",
        user: sanitizeUser(user),
      },
      { status: 200 }
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
    console.error("Login error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

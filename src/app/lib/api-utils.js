import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "./mongodb";
import { verifyToken } from "./auth";

export async function requireAuth(request) {
  const token = request.cookies.get("token")?.value;

  if (!token) {
    return {
      error: NextResponse.json({ message: "Authentication required" }, { status: 401 }),
    };
  }

  const payload = verifyToken(token);
  if (!payload?.userId) {
    return {
      error: NextResponse.json({ message: "Invalid token" }, { status: 401 }),
    };
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const user = await db.collection("users").findOne({ _id: new ObjectId(payload.userId) });

    if (!user) {
      return {
        error: NextResponse.json({ message: "User not found" }, { status: 404 }),
      };
    }

    return { db, user, userId: payload.userId };
  } catch (error) {
    console.error("Authentication error:", error);
    return {
      error: NextResponse.json({ message: "Authentication failed" }, { status: 500 }),
    };
  }
}

export function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user._id?.toString(),
    _id: user._id?.toString(),
    name: user.name,
    email: user.email,
    createdAt:
      user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
    updatedAt:
      user.updatedAt instanceof Date ? user.updatedAt.toISOString() : user.updatedAt,
  };
}





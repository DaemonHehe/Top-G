import { NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import clientPromise from "../../../lib/mongodb";
import { generateToken } from "../../../lib/auth";
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

  const idToken = typeof body.idToken === "string" ? body.idToken.trim() : "";

  console.log("Google login request received");
  console.log("ID Token present:", !!idToken);
  console.log("GOOGLE_CLIENT_ID present:", !!process.env.GOOGLE_CLIENT_ID);

  if (!idToken) {
    return NextResponse.json(
      { message: "ID token is required" },
      { status: 400 }
    );
  }

  if (!process.env.GOOGLE_CLIENT_ID) {
    console.error("GOOGLE_CLIENT_ID not configured");
    return NextResponse.json(
      { message: "Server configuration error" },
      { status: 500 }
    );
  }

  try {
    console.log("Verifying Google ID token...");
    // Verify Google ID token using google-auth-library
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    console.log("Token verified, payload:", { sub: payload.sub, email: payload.email });
    
    const googleId = payload.sub; // Google user ID
    const email = payload.email?.toLowerCase();
    const name = payload.name || "Google User";
    const avatar = payload.picture || null;

    if (!email) {
      return NextResponse.json(
        { message: "Email not provided by Google" },
        { status: 400 }
      );
    }

    console.log("Connecting to MongoDB...");
    const mongoClient = await clientPromise;
    const db = mongoClient.db();
    const usersCollection = db.collection("users");

    console.log("Checking for existing user with email:", email);
    // Check if user exists by email
    const existingUser = await usersCollection.findOne({ email });

    let user;
    if (existingUser) {
      console.log("User exists, linking Google ID...");
      // User exists - link Google account if not already linked
      if (existingUser.googleId && existingUser.googleId !== googleId) {
        // Account already linked to different Google ID
        return NextResponse.json(
          {
            message:
              "This email is already linked to a different Google account",
          },
          { status: 400 }
        );
      }

      // Update user with googleId and avatar (if not already set)
      const updateData = {};
      if (!existingUser.googleId) {
        updateData.googleId = googleId;
      }
      if (!existingUser.avatar && avatar) {
        updateData.avatar = avatar;
      }
      if (Object.keys(updateData).length > 0) {
        updateData.updatedAt = new Date();
        await usersCollection.updateOne(
          { _id: existingUser._id },
          { $set: updateData }
        );
      }

      user = await usersCollection.findOne({ _id: existingUser._id });
    } else {
      console.log("Creating new user...");
      // Create new user with Google info
      const now = new Date();
      const result = await usersCollection.insertOne({
        name,
        email,
        googleId,
        avatar,
        createdAt: now,
        updatedAt: now,
      });

      user = await usersCollection.findOne({ _id: result.insertedId });
    }

    console.log("Generating JWT token...");
    // Generate JWT token
    const token = generateToken(user._id.toString());

    console.log("Login successful");
    const response = NextResponse.json(
      {
        message: "Google login successful",
        user: sanitizeUser(user),
      },
      { status: 200 }
    );

    // Set secure HTTP-only cookie
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
    console.error("Google login error:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);

    // Handle specific Google verification errors
    if (error.message?.includes("Token used too late")) {
      return NextResponse.json(
        { message: "Token has expired" },
        { status: 401 }
      );
    }

    if (error.message?.includes("Failed to verify id_token")) {
      return NextResponse.json(
        { message: "Invalid Google ID token" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { message: "Google login failed" },
      { status: 500 }
    );
  }
}

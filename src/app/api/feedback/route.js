import { NextResponse } from "next/server";
import clientPromise from "../../lib/mongodb";

const MAX_MESSAGE_LENGTH = 2000;

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof payload?.name === "string" ? payload.name.trim() : "";
  const email = typeof payload?.email === "string" ? payload.email.trim() : "";
  const message = typeof payload?.message === "string" ? payload.message.trim() : "";

  if (!name || !email || !message) {
    return NextResponse.json({ message: "Name, email, and message are required." }, { status: 400 });
  }

  const emailPattern = /[^@\s]+@[^@\s]+\.[^@\s]+/;
  if (!emailPattern.test(email)) {
    return NextResponse.json({ message: "Enter a valid email address." }, { status: 400 });
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ message: "Message is too long." }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const feedbackCollection = db.collection("feedback");

    const document = {
      name,
      email: email.toLowerCase(),
      message,
      createdAt: new Date(),
      metadata: {
        userAgent: request.headers.get("user-agent") || null,
        origin: request.headers.get("origin") || null,
      },
    };

    await feedbackCollection.insertOne(document);

    return NextResponse.json({ message: "Thanks for sharing! We'll follow up soon." }, { status: 201 });
  } catch (error) {
    console.error("Feedback submission error:", error);
    return NextResponse.json({ message: "We couldn't record your feedback. Try again later." }, { status: 500 });
  }
}

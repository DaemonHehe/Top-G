import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { supabaseAdmin } from "../../lib/supabase";
import { getRequestIp, rateLimit } from "../../lib/rate-limit";

const MAX_MESSAGE_LENGTH = 2000;
const RATE_LIMIT = { limit: 5, windowMs: 60_000 };

let cachedTransporter = null;

function getMailTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const host = process.env.SMTP_HOST;
  const portRaw = process.env.SMTP_PORT ?? "587";
  const port = Number(portRaw);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secureFlag = process.env.SMTP_SECURE;

  if (!host || !user || !pass || Number.isNaN(port)) {
    throw new Error("SMTP configuration is incomplete.");
  }

  const secure = secureFlag ? secureFlag === "true" : port === 465;

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  return cachedTransporter;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"]/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "\"":
        return "&quot;";
      default:
        return char;
    }
  });
}

function buildFeedbackEmail({ name, email, message, createdAt }) {
  const timestamp =
    createdAt instanceof Date
      ? createdAt.toISOString()
      : new Date(createdAt || Date.now()).toISOString();

  const text = [
    `New feedback received at ${timestamp}`,
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    "",
    message,
  ].join("\n");

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeMessage = escapeHtml(message).replace(/\r?\n/g, "<br />");

  const html = `<p>New feedback received at ${timestamp}</p><p><strong>Name:</strong> ${safeName}<br /><strong>Email:</strong> ${safeEmail}</p><hr /><p>${safeMessage}</p>`;

  return { text, html };
}

async function sendFeedbackEmail({ name, email, message, createdAt }) {
  const transporter = getMailTransporter();
  const toAddress = process.env.FEEDBACK_TO || process.env.SMTP_USER;
  const fromAddress = process.env.FEEDBACK_FROM || process.env.SMTP_USER;

  if (!toAddress || !fromAddress) {
    throw new Error("Feedback email routing configuration is missing.");
  }

  const { text, html } = buildFeedbackEmail({ name, email, message, createdAt });

  await transporter.sendMail({
    from: fromAddress,
    to: toAddress,
    replyTo: email,
    subject: `Top-G Feedback from ${name}`,
    text,
    html,
  });
}

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
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

  const ip = getRequestIp(request);
  const rate = rateLimit(`feedback:${ip}`, RATE_LIMIT);
  if (!rate.ok) {
    const retryAfter = Math.max(Math.ceil((rate.reset - Date.now()) / 1000), 1);
    return NextResponse.json(
      { message: "Too many requests. Slow down and try again soon." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  try {
    const createdAt = new Date().toISOString();
    const record = {
      name,
      email: email.toLowerCase(),
      message,
      created_at: createdAt,
      metadata: {
        userAgent: request.headers.get("user-agent") || null,
        origin: request.headers.get("origin") || null,
      },
    };

    const { error: insertError } = await supabaseAdmin
      .from("feedback")
      .insert(record);

    if (insertError) {
      console.error("Feedback submission error:", insertError);
      return NextResponse.json({ message: "We couldn't record your feedback. Try again later." }, { status: 500 });
    }

    let emailWarning = null;
    try {
      await sendFeedbackEmail({
        name,
        email,
        message,
        createdAt,
      });
    } catch (emailError) {
      emailWarning = "We saved your feedback but couldn't notify the team via email right now.";
      console.error("Feedback email send error:", emailError);
    }

    return NextResponse.json(
      { message: "Thanks for sharing! We'll follow up soon.", warning: emailWarning },
      { status: 201 },
    );
  } catch (error) {
    console.error("Feedback submission error:", error);
    return NextResponse.json({ message: "We couldn't record your feedback. Try again later." }, { status: 500 });
  }
}


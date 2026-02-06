import { NextResponse } from "next/server";
import { requireAuth } from "../../lib/api-utils";
import { getRequestIp, rateLimit } from "../../lib/rate-limit";

const MODEL = "minimax/minimax-m2-her";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MAX_BODY_BYTES = 12_000;
const MAX_PROMPT_CHARS = 800;
const RATE_LIMIT = { limit: 10, windowMs: 60_000 };

const SYSTEM_PROMPT = `You are an elite execution coach with the swagger and directness of Andrew Tate.
Speak in sharp, high-energy sentences that mix business pressure with physical dominance.
Never use hate speech, slurs, or illegal advice. Avoid emojis.`;

function normaliseHistory(history = []) {
  return history
    .filter(
      (item) => typeof item?.text === "string" && item.text.trim().length > 0,
    )
    .map((item) => ({
      role: item.role === "coach" ? "assistant" : "user",
      content: item.text.trim(),
    }));
}

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { message: "Payload too large." },
      { status: 413 },
    );
  }

  const ip = getRequestIp(request);
  const rate = rateLimit(`coach:${auth.userId}:${ip}`, RATE_LIMIT);
  if (!rate.ok) {
    const retryAfter = Math.max(Math.ceil((rate.reset - Date.now()) / 1000), 1);
    return NextResponse.json(
      { message: "Too many requests. Slow down." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { message: "OpenRouter API key is not configured." },
      { status: 503 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json(
      { message: "Prompt is required." },
      { status: 400 },
    );
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return NextResponse.json(
      { message: "Prompt is too long." },
      { status: 400 },
    );
  }

  const history = normaliseHistory(body?.history);

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: prompt },
  ];

  const payload = {
    model: MODEL,
    messages,
    max_tokens: 300,
    temperature: 0.85,
  };

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  if (process.env.OPENROUTER_SITE_URL) {
    headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL;
  }

  if (process.env.OPENROUTER_APP_TITLE) {
    headers["X-Title"] = process.env.OPENROUTER_APP_TITLE;
  }

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter coach error:", response.status, errorText);
      return NextResponse.json(
        { message: "Coach generation failed." },
        { status: 502 },
      );
    }

    const data = await response.json();
    const message = data?.choices?.[0]?.message?.content?.trim();

    if (!message) {
      return NextResponse.json(
        { message: "No coach response returned." },
        { status: 502 },
      );
    }

    return NextResponse.json({ message });
  } catch (error) {
    console.error("OpenRouter coach request error:", error);
    return NextResponse.json(
      { message: "Unable to reach the coach service." },
      { status: 502 },
    );
  }
}

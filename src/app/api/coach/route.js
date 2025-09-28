
import { NextResponse } from "next/server";

const MODEL = "x-ai/grok-4-fast:free";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const SYSTEM_PROMPT = `You are an elite execution coach with the swagger and directness of Andrew Tate.
Speak in sharp, high-energy sentences that mix business pressure with physical dominance.
Never use hate speech, slurs, or illegal advice. Avoid emojis.`;

function normaliseHistory(history = []) {
  return history
    .filter((item) => typeof item?.text === "string" && item.text.trim().length > 0)
    .map((item) => ({
      role: item.role === "coach" ? "assistant" : "user",
      content: item.text.trim(),
    }));
}

export async function POST(request) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ message: "OpenRouter API key is not configured." }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 });
  }

  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json({ message: "Prompt is required." }, { status: 400 });
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
      return NextResponse.json({ message: "Coach generation failed." }, { status: 502 });
    }

    const data = await response.json();
    const message = data?.choices?.[0]?.message?.content?.trim();

    if (!message) {
      return NextResponse.json({ message: "No coach response returned." }, { status: 502 });
    }

    return NextResponse.json({ message });
  } catch (error) {
    console.error("OpenRouter coach request error:", error);
    return NextResponse.json({ message: "Unable to reach the coach service." }, { status: 502 });
  }
}

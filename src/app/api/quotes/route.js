import { NextResponse } from "next/server";

const MODEL = "deepseek/deepseek-chat-v3.1:free";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const FALLBACK_QUOTES = [
  "Discipline isn't painful; regret is, so pick the sting that makes you sharper.",
  "You won't conquer the world by waiting your turn; step forward and take it.",
  "Energy wasted on excuses could be burning your next victory.",
  "Pressure is the tax you pay on ambition; if you can't afford it, stay average.",
  "Momentum belongs to the man who starts now, not the one who plans forever.",
];

function buildPrompt(tone, summary) {
  const base = tone === "top-g"
    ? "Channel a confident, swagger-filled Top G vibe inspired by Andrew Tate. Deliver ruthless, masculine drive that combines personal dominance with business urgency, but keep it respectful and legal."
    : "You are an encouraging personal performance coach who delivers concise motivation.";
  return `${base} Craft one short quote (max 240 characters) tailored to this user context: ${summary}`;
}

function pickFallbackQuote() {
  const index = Math.floor(Math.random() * FALLBACK_QUOTES.length);
  return FALLBACK_QUOTES[index];
}

function fallbackResponse(tone, reason) {
  const quote = pickFallbackQuote();
  return NextResponse.json(
    { quote, tone, source: "fallback", reason },
    { status: 200 },
  );
}

export async function POST(request) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.warn("Quotes API fallback: missing OPENROUTER_API_KEY");
    return fallbackResponse("top-g", "missing-api-key");
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 });
  }

  const tone = "top-g";
  const contextSummary = typeof body?.context?.summary === "string" && body.context.summary.trim()
    ? body.context.summary.trim()
    : JSON.stringify(body?.context ?? {}, null, 2);

  const payload = {
    model: MODEL,
    messages: [
      {
        role: "system",
        content: "Respond with a single quote only. No prefacing, no emojis, no additional commentary. The quote must be pure Top G masculinity that pushes people to work harder. Avoid hate speech, slurs, or illegal advice.",
      },
      {
        role: "user",
        content: buildPrompt(tone, contextSummary),
      },
    ],
    max_tokens: 120,
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
      console.error("OpenRouter error:", response.status, errorText);
      return fallbackResponse(tone, `upstream-${response.status}`);
    }

    const data = await response.json();
    const quote = data?.choices?.[0]?.message?.content?.trim();

    if (!quote) {
      return fallbackResponse(tone, "empty-upstream");
    }

    return NextResponse.json({ quote, tone, source: "openrouter" });
  } catch (error) {
    console.error("OpenRouter request error:", error);
    return fallbackResponse(tone, "fetch-error");
  }
}




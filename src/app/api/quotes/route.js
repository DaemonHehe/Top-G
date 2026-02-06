import { NextResponse } from "next/server";
import { requireAuth } from "../../lib/api-utils";
import { getRequestIp, rateLimit } from "../../lib/rate-limit";

const MODEL = "minimax/minimax-m2-her";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MAX_BODY_BYTES = 10_000;
const MAX_CONTEXT_CHARS = 2000;
const MAX_QUOTE_CHARS = 200;
const RATE_LIMIT = { limit: 12, windowMs: 60_000 };
const FALLBACK_QUOTES = [
  "Discipline isn't painful; regret is, so pick the sting that makes you sharper.",
  "You won't conquer the world by waiting your turn; step forward and take it.",
  "Energy wasted on excuses could be burning your next victory.",
  "Pressure is the tax you pay on ambition; if you can't afford it, stay average.",
  "Momentum belongs to the man who starts now, not the one who plans forever.",
  "Comfort is a cage you build yourself; break the bars with sweat and silence.",
  "A man without a vision is a servant to a man with one. Decide which side of the table you sit on.",
  "Success doesn't care about your feelings. It only respects the work you do when you don't want to.",
  "Your bank account is a reflection of your discipline. If it's empty, your willpower is bankrupt.",
  "Average is a failing grade. If you fit in, you have already lost the game.",
  "Talk is cheap because supply is high. Be the rare commodity that actually delivers.",
  "The crown is heavy, but it is lighter than the chains of poverty. Choose your burden.",
  "Every second you spend scrolling is a second a rival spends sharpening his blade. Wake up.",
  "Luck is the word losers use to describe the result of relentless preparation.",
  "The world is designed to keep you weak. Your rebellion is your success.",
  "Do not announce your moves. Checkmate them in silence.",
  "Tired is a state of mind. Broke is a state of action. Fix the second and the first won't matter.",
  "You are exactly where you deserve to be. If you hate it, change your inputs.",
  "A wolf does not lose sleep over the opinion of sheep. Focus on the hunt.",
  "While they party, you build. The gap between you and them isn't luck; it's the hours you refuse to waste.",
];

function buildPrompt(tone, summary) {
  const base =
    tone === "top-g"
      ? "Channel a confident, swagger-filled Top G vibe inspired by Andrew Tate. Deliver ruthless, masculine drive that combines personal dominance with business urgency, but keep it respectful and legal."
      : "You are an encouraging personal performance coach who delivers concise motivation.";
  return `${base} Craft one short quote (max ${MAX_QUOTE_CHARS} characters) tailored to this user context: ${summary}. Do not use emojis or emoticons.`;
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
  const rate = rateLimit(`quotes:${auth.userId}:${ip}`, RATE_LIMIT);
  if (!rate.ok) {
    const retryAfter = Math.max(Math.ceil((rate.reset - Date.now()) / 1000), 1);
    return NextResponse.json(
      { message: "Too many requests. Slow down." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.warn("Quotes API fallback: missing OPENROUTER_API_KEY");
    return fallbackResponse("top-g", "missing-api-key");
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

  const tone = "top-g";
  const contextSummary =
    typeof body?.context?.summary === "string" && body.context.summary.trim()
      ? body.context.summary.trim()
      : JSON.stringify(body?.context ?? {}, null, 2);

  if (contextSummary.length > MAX_CONTEXT_CHARS) {
    return NextResponse.json(
      { message: "Context is too long." },
      { status: 400 },
    );
  }

  const payload = {
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "Respond with a single quote only. No prefacing, no emojis or emoticons, no additional commentary. The quote must be pure Top G masculinity that pushes people to work harder. Avoid hate speech, slurs, or illegal advice.",
      },
      {
        role: "user",
        content: buildPrompt(tone, contextSummary),
      },
    ],
    max_tokens: 110,
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
    let quote = data?.choices?.[0]?.message?.content?.trim();

    if (!quote) {
      return fallbackResponse(tone, "empty-upstream");
    }

    quote = quote.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, "").trim();

    if (quote.length > MAX_QUOTE_CHARS) {
      const hardSlice = quote.slice(0, MAX_QUOTE_CHARS + 1);
      const lastSpace = hardSlice.lastIndexOf(" ");
      let safeSlice =
        lastSpace > 60 ? hardSlice.slice(0, lastSpace) : hardSlice.slice(0, MAX_QUOTE_CHARS);
      safeSlice = safeSlice.replace(/[\p{L}\p{N}]+$/u, "");
      quote = safeSlice.replace(/[.!?,;:\s]+$/g, "");
    }

    return NextResponse.json({ quote, tone, source: "openrouter" });
  } catch (error) {
    console.error("OpenRouter request error:", error);
    return fallbackResponse(tone, "fetch-error");
  }
}

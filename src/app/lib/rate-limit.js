const store = globalThis.__rateLimitStore ?? new Map();
globalThis.__rateLimitStore = store;

export function getRequestIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

export function rateLimit(key, { limit = 20, windowMs = 60_000 } = {}) {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.reset) {
    const reset = now + windowMs;
    store.set(key, { count: 1, reset });
    return { ok: true, remaining: limit - 1, reset };
  }

  if (entry.count >= limit) {
    return { ok: false, remaining: 0, reset: entry.reset };
  }

  entry.count += 1;
  store.set(key, entry);
  return { ok: true, remaining: Math.max(limit - entry.count, 0), reset: entry.reset };
}

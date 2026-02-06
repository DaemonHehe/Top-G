export function isCronAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authHeader = request.headers.get("authorization") || "";
  if (authHeader === `Bearer ${secret}`) {
    return true;
  }
  const header = request.headers.get("x-cron-secret");
  if (header === secret) {
    return true;
  }
  return false;
}

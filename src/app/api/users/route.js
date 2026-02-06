import { NextResponse } from "next/server";
import { requireAuth, sanitizeUser } from "../../lib/api-utils";

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  return NextResponse.json({ user: sanitizeUser(auth.user) }, { status: 200 });
}

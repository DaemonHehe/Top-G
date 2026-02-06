import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { message: "Login is handled by Supabase Auth on the client." },
    { status: 410 }
  );
}

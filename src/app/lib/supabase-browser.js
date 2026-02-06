import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in environment.");
}

export const supabaseBrowser = createClient(supabaseUrl, supabaseAnonKey);

export async function getAccessToken() {
  try {
    const { data, error } = await supabaseBrowser.auth.getSession();
    if (error) {
      console.error("Supabase session error:", error);
      return null;
    }
    return data?.session?.access_token ?? null;
  } catch (error) {
    console.error("Supabase session error:", error);
    return null;
  }
}

export async function fetchWithAuth(input, init = {}) {
  const token = await getAccessToken();
  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}

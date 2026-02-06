import { NextResponse } from "next/server";
import { requireAuth } from "../../lib/api-utils";
import { supabaseAdmin } from "../../lib/supabase";

const MAX_FILE_SIZE = 1.5 * 1024 * 1024;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "avatars";

const MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

function getExtension(file) {
  if (file?.type && MIME_EXTENSIONS[file.type]) {
    return MIME_EXTENSIONS[file.type];
  }
  const name = typeof file?.name === "string" ? file.name : "";
  const parts = name.split(".");
  const ext = parts.length > 1 ? parts.pop().toLowerCase() : "";
  return /^[a-z0-9]+$/.test(ext) ? ext : "bin";
}

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ message: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || typeof file !== "object") {
    return NextResponse.json({ message: "File is required." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ message: "Avatar must be 1.5 MB or smaller." }, { status: 400 });
  }

  if (file.type && !file.type.startsWith("image/")) {
    return NextResponse.json({ message: "File must be an image." }, { status: 400 });
  }

  const ext = getExtension(file);
  const path = `${auth.userId}/avatar-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });

  if (uploadError) {
    console.error("Avatar upload error:", uploadError);
    return NextResponse.json({ message: "Unable to upload avatar." }, { status: 500 });
  }

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);

  return NextResponse.json({ url: data?.publicUrl });
}

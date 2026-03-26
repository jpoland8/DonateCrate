import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const BUCKET = "partner-branding";

function getFileExtension(mimeType: string) {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    default:
      return null;
  }
}

async function ensureBucket() {
  const supabase = createSupabaseAdminClient();
  const { data: existing } = await supabase.storage.getBucket(BUCKET);
  if (!existing) {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 2 * 1024 * 1024,
      allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
    });
    if (error && !error.message.toLowerCase().includes("already exists")) {
      throw error;
    }
  }
  return supabase;
}

export async function resolvePartnerLogoUrl(partnerId: string, rawValue: string | undefined) {
  if (typeof rawValue !== "string") return rawValue;
  const trimmed = rawValue.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith("data:image/")) return trimmed;

  const match = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Logo upload payload is invalid");
  }

  const mimeType = match[1];
  const base64 = match[2];
  const extension = getFileExtension(mimeType);
  if (!extension) {
    throw new Error("Logo file type is not supported. Please upload a PNG, JPG, or WebP image.");
  }

  const fileBuffer = Buffer.from(base64, "base64");
  const hash = createHash("sha256").update(fileBuffer).digest("hex").slice(0, 12);
  const objectPath = `${partnerId}/${hash}.${extension}`;
  const supabase = await ensureBucket();

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, fileBuffer, {
      contentType: mimeType,
      cacheControl: "3600",
      upsert: true,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

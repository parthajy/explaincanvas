import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { handle, requireUser, HttpError, enforceRateLimit } from "@/lib/chat/api";
import { storage } from "@/lib/storage";

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

/** POST /api/uploads (multipart, field "file") — stores a student photo privately in Spaces. */
export const POST = handle(async (req) => {
  const user = await requireUser();
  enforceRateLimit("uploads", user.id, 30, 60_000);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "file_required");
  if (!TYPES.has(file.type)) throw new HttpError(415, "unsupported_type");
  if (file.size > MAX_BYTES) throw new HttpError(413, "file_too_large");

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${user.id}/${new Date().toISOString().slice(0, 10)}/${nanoid(12)}.${ext}`;
  await storage().put(path, Buffer.from(await file.arrayBuffer()), file.type);
  return NextResponse.json({ path, mediaType: file.type });
});

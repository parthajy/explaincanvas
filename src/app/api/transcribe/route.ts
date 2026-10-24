import { NextResponse } from "next/server";
import { handle, requireUser, HttpError, enforceRateLimit } from "@/lib/chat/api";
import { sttConfigured, transcribe } from "@/lib/providers/stt";

const MAX_BYTES = 10 * 1024 * 1024;

/** POST /api/transcribe (multipart, field "audio") — dictation to text. */
export const POST = handle(async (req) => {
  const user = await requireUser();
  enforceRateLimit("transcribe", user.id, 30, 60_000);
  if (!sttConfigured()) throw new HttpError(503, "dictation_unavailable", "Dictation is not switched on yet.");
  const form = await req.formData().catch(() => null);
  const file = form?.get("audio");
  if (!(file instanceof File)) throw new HttpError(400, "audio_required");
  if (file.size > MAX_BYTES) throw new HttpError(413, "audio_too_large");
  if (file.size < 1000) return NextResponse.json({ text: "" });
  const text = await transcribe(Buffer.from(await file.arrayBuffer()), file.type || "audio/webm");
  return NextResponse.json({ text: text ?? "" });
});

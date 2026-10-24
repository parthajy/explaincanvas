import { getSessionUser } from "@/lib/auth/session";
import { storage } from "@/lib/storage";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", mp3: "audio/mpeg", mp4: "video/mp4", svg: "image/svg+xml" };

/**
 * GET /api/files/<key> — serves stored objects to signed-in users.
 *  - assets/<explanationId>/...  generated narration, illustrations, clips: any signed-in user (library lessons are shared)
 *  - <accountId>/...             a student's uploaded photo: the owner only
 */
export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return new Response("unauthenticated", { status: 401 });
  const { key: parts } = await ctx.params;
  const key = parts.map(decodeURIComponent).join("/");
  if (key.includes("..") || key.startsWith("/")) return new Response("bad key", { status: 400 });
  const isShared = key.startsWith("assets/");
  if (!isShared && !key.startsWith(`${user.id}/`)) return new Response("forbidden", { status: 403 });

  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  const type = TYPES[ext];
  if (!type) return new Response("unsupported", { status: 415 });
  try {
    const body = await storage().get(key);
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": type,
        "Cache-Control": isShared ? "private, max-age=31536000, immutable" : "private, max-age=3600",
        "Content-Length": String(body.length),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}

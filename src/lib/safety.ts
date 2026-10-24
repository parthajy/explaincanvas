import { q } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Keeping a children's product clean, in layers:
 *   1. a fast local screen for profanity and slurs (English and common Hinglish spellings) before any model call,
 *   2. the router's "unsafe" intent for anything the word list cannot catch (sexual content, self-harm, harassment),
 *   3. the page reader's unsafe flag for photos,
 *   4. teaching prompts that stay age-appropriate and textbook-toned on sensitive syllabus topics,
 *   5. a log of every event, visible in /admin, and a 24-hour pause after repeated abuse.
 * Student names and chat titles pass through the same screen so nothing ugly is ever shown to a parent.
 */

// Word stems only; matched on word boundaries so "class", "assess" or "Scunthorpe" never trip it.
const BLOCKLIST = [
  // English
  "fuck", "fucking", "fucker", "motherfucker", "shit", "bullshit", "bitch", "bastard", "asshole", "dick", "dickhead", "pussy", "cunt", "whore", "slut", "faggot", "nigger", "nigga", "retard", "wanker", "blowjob", "handjob", "porn", "porno", "xxx", "nude", "nudes", "boobs", "tits", "penis", "vagina", "cum", "jerk off", "sex video", "sexy video",
  // Hinglish spellings
  "chutiya", "chutiye", "chutia", "bhenchod", "behenchod", "bhen chod", "madarchod", "maderchod", "madar chod", "bsdk", "bhosdike", "bhosdi", "lund", "lauda", "lawda", "gaand", "gand", "gandu", "randi", "harami", "haramzada", "haramkhor", "kutte", "kutta", "kamina", "kamine", "saala", "saali", "chodu", "jhant", "jhaatu", "tatti", "suar", "chinal", "hijra",
];

const escapeRe = (w: string) => w.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&").replace(/ /g, "\\s+");
const RE = new RegExp("(?:^|[^a-z0-9])(" + BLOCKLIST.map(escapeRe).join("|") + ")(?=$|[^a-z0-9])", "i");

// Leetspeak and spacing tricks: "f u c k", "sh1t", "b!tch".
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[@]/g, "a")
    .replace(/[1!|]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[0]/g, "o")
    .replace(/[$5]/g, "s")
    .replace(/[7]/g, "t")
    .replace(/(\b[a-z])(?:[\s._*-]+(?=[a-z]\b))+/g, (m) => m.replace(/[\s._*-]+/g, ""));
}

export function screenText(text: string): { ok: true } | { ok: false; match: string } {
  if (!text) return { ok: true };
  const m = RE.exec(normalise(text)) ?? RE.exec(text);
  return m ? { ok: false, match: m[1] } : { ok: true };
}

export type SafetyKind = "profanity" | "unsafe_intent" | "unsafe_image" | "blocked";
export type SafetySource = "chat" | "student_name" | "chat_title" | "image";

export async function recordSafetyEvent(input: { accountId: string | null; kind: SafetyKind; source: SafetySource; sample?: string | null }): Promise<void> {
  try {
    await q(`insert into safety_events(account_id, kind, source, sample) values ($1,$2,$3,$4)`, [input.accountId, input.kind, input.source, input.sample?.slice(0, 200) ?? null]);
  } catch (err) {
    logger.warn({ err }, "safety event insert failed");
  }
}

/** Five events in 24 hours pauses fresh questions for that account for the rest of the day. */
export async function isPaused(accountId: string, limit = 5): Promise<boolean> {
  const rows = await q<{ n: string }>(`select count(*)::text n from safety_events where account_id = $1 and kind <> 'blocked' and created_at > now() - interval '24 hours'`, [accountId]);
  return Number(rows[0]?.n ?? 0) >= limit;
}

export const SAFE_REPLY = "Let's keep this about school. Ask me anything from your subjects and I'll draw it out for you.";

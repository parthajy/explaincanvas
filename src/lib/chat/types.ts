import type { SceneDoc } from "@/lib/scene/schema";

/** Row shapes the client works with. Kept small and explicit. */

export interface ChatSummary {
  id: string;
  title: string;
  starred: boolean;
  last_message_at: string;
  created_at: string;
}

export interface MessageRow {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachments: ({ type: "image"; path: string; mediaType: string } | { type: "options"; items: string[] })[];
  explanation_id: string | null;
  seq?: string;
  created_at: string;
  updated_at?: string;
}

export type ExplanationStatus = "queued" | "routing" | "teaching" | "verifying" | "rendering" | "ready" | "failed" | "cancelled";

export interface ExplanationRow {
  id: string;
  status: ExplanationStatus;
  source: "generated" | "library" | "followup" | null;
  format: string | null;
  concept_title: string | null;
  scene: SceneDoc | null;
  credits_quoted: number;
  credits_charged: number | null;
  error: { code: string; message: string } | null;
  created_at: string;
  updated_at?: string;
}

export const STATUS_LABEL: Record<ExplanationStatus, string> = {
  queued: "Getting ready",
  routing: "Reading your question",
  teaching: "Writing the explanation",
  verifying: "Checking it for accuracy",
  rendering: "Drawing it",
  ready: "",
  failed: "Could not finish",
  cancelled: "Cancelled",
};

export interface Me {
  id: string;
  email: string | null;
  plan: { code: string; name: string };
  balance: number;
  isAdmin?: boolean;
  students: { id: string; name: string; class_level: number }[];
}

import { z } from "zod";

/**
 * The scene document is the single structured representation of every explanation.
 * Renderers consume it; the library stores it; the player plays it.
 * Bump SCENE_VERSION on any breaking change and add a migration in ./migrate.ts.
 */
export const SCENE_VERSION = 1 as const;

export const Subject = z.enum(["maths", "science", "physics", "chemistry", "biology", "other"]);
export type Subject = z.infer<typeof Subject>;

export const Format = z.enum([
  "diagram",
  "annotation",
  "steps",
  "slides",
  "animation",
  "three_d",
  "video",
]);
export type Format = z.infer<typeof Format>;

export const Concept = z.object({
  key: z
    .string()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "concept key must be a kebab-case slug"),
  title: z.string().min(2).max(160),
  subject: Subject,
  classLevel: z.number().int().min(1).max(12),
  board: z.string().default("CBSE"),
  chapter: z.string().max(160).optional(),
  /** NCERT mapping: "Class 9, Ch 4, Ex 4.2 Q3" is how students and parents think. */
  ncert: z
    .object({ chapter: z.number().int().min(1).max(20).nullable(), chapterName: z.string().max(160).nullable(), ref: z.string().max(40).nullable() })
    .optional(),
});
export type Concept = z.infer<typeof Concept>;

const Narration = z.string().min(1).max(1500);
/** Set by the rendering stage when narration audio exists. */
const AudioUrl = z.string().optional();

export const DiagramScene = z.object({
  audioUrl: AudioUrl,
  kind: z.literal("diagram"),
  title: z.string().max(120),
  svg: z.string().min(20).max(60_000),
  caption: z.string().max(400),
  narration: Narration,
});

export const AnnotationScene = z.object({
  audioUrl: AudioUrl,
  kind: z.literal("annotation"),
  title: z.string().max(120),
  imageRef: z.string().min(1),
  annotations: z
    .array(
      z.object({
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        w: z.number().min(0).max(1),
        h: z.number().min(0).max(1),
        label: z.string().max(60),
        note: z.string().max(300),
      }),
    )
    .min(1)
    .max(12),
  narration: Narration,
});

export const StepsScene = z.object({
  audioUrl: AudioUrl,
  kind: z.literal("steps"),
  title: z.string().max(120),
  steps: z
    .array(
      z.object({
        text: z.string().min(1).max(400),
        imagePrompt: z.string().max(400).optional(),
        imageUrl: z.string().optional(),
      }),
    )
    .min(2)
    .max(10),
  narration: Narration,
});

export const SlidesScene = z.object({
  kind: z.literal("slides"),
  title: z.string().max(120),
  slides: z
    .array(
      z.object({
        title: z.string().max(100),
        bullets: z.array(z.string().max(160)).max(5),
        imagePrompt: z.string().max(400).optional(),
        imageUrl: z.string().optional(),
        narration: Narration,
      }),
    )
    .min(2)
    .max(8),
  audioUrl: AudioUrl,
});

export const AnimationScene = z.object({
  audioUrl: AudioUrl,
  kind: z.literal("animation"),
  title: z.string().max(120),
  engine: z.enum(["web", "manim", "remotion"]),
  code: z.string().min(20).max(40_000),
  narration: Narration,
  videoUrl: z.string().optional(),
});

export const ThreeDScene = z.object({
  audioUrl: AudioUrl,
  kind: z.literal("three_d"),
  title: z.string().max(120),
  code: z.string().min(20).max(40_000),
  interactions: z.array(z.string().max(120)).max(6),
  narration: Narration,
});

export const VideoScene = z.object({
  audioUrl: AudioUrl,
  kind: z.literal("video"),
  title: z.string().max(120),
  shots: z
    .array(
      z.object({
        prompt: z.string().min(10).max(600),
        durationSeconds: z.number().int().min(4).max(8),
        clipUrl: z.string().optional(),
      }),
    )
    .min(1)
    .max(3),
  narration: Narration,
});

export const Scene = z.discriminatedUnion("kind", [
  DiagramScene,
  AnnotationScene,
  StepsScene,
  SlidesScene,
  AnimationScene,
  ThreeDScene,
  VideoScene,
]);
export type Scene = z.infer<typeof Scene>;

export const CheckQuestion = z.object({
  question: z.string().min(5).max(400),
  options: z.array(z.string().min(1).max(160)).length(4),
  answerIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(5).max(600),
});
export type CheckQuestion = z.infer<typeof CheckQuestion>;

export const SceneDoc = z.object({
  version: z.literal(SCENE_VERSION),
  title: z.string().min(2).max(160),
  concept: Concept,
  /** english by default; hinglish on request (technical terms stay English). */
  language: z.enum(["english", "hinglish"]).optional(),
  format: Format,
  audienceLevel: z.enum(["beginner", "intermediate", "advanced"]),
  /** One or two sentences the chat shows as the text answer above the player. */
  summary: z.string().min(10).max(600),
  scenes: z.array(Scene).min(1).max(8),
  check: CheckQuestion,
  /** Two or three natural next questions a curious student would ask. */
  followUps: z.array(z.string().min(5).max(140)).max(3).optional(),
  sources: z
    .array(
      z.object({
        kind: z.enum(["ncert", "user_upload", "general"]),
        note: z.string().max(300),
      }),
    )
    .max(5),
});
export type SceneDoc = z.infer<typeof SceneDoc>;

/** Parse an unknown value into a SceneDoc or throw a readable error. */
export function parseSceneDoc(value: unknown): SceneDoc {
  return SceneDoc.parse(value);
}

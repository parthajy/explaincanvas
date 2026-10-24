import { describe, it, expect } from "vitest";
import { SceneDoc, SCENE_VERSION } from "@/lib/scene/schema";

const base = {
  version: SCENE_VERSION,
  title: "Newton's third law",
  concept: { key: "newtons-third-law", title: "Newton's third law", subject: "physics", classLevel: 9, board: "CBSE" },
  format: "diagram",
  audienceLevel: "intermediate",
  summary: "Every action has an equal and opposite reaction, acting on two different bodies.",
  scenes: [
    {
      kind: "diagram",
      title: "Two forces, two bodies",
      svg: '<svg viewBox="0 0 800 500"><rect x="10" y="10" width="100" height="50"/><text x="20" y="40">Block</text></svg>',
      caption: "The arrows are equal and opposite.",
      narration: "When the block pushes the wall, the wall pushes back with the same force.",
    },
  ],
  check: {
    question: "A book rests on a table. The reaction to the book's weight acts on which body?",
    options: ["The table", "The book", "The Earth", "The air"],
    answerIndex: 2,
    explanation: "Weight is the Earth pulling the book, so the reaction is the book pulling the Earth.",
  },
  sources: [{ kind: "ncert", note: "Class 9 Science, Chapter 9" }],
};

describe("SceneDoc schema", () => {
  it("accepts a valid diagram document", () => {
    expect(SceneDoc.parse(base).scenes[0].kind).toBe("diagram");
  });

  it("rejects a concept key that is not a slug", () => {
    const bad = { ...base, concept: { ...base.concept, key: "Newton's Law" } };
    expect(SceneDoc.safeParse(bad).success).toBe(false);
  });

  it("requires exactly four options and a valid answer index", () => {
    expect(SceneDoc.safeParse({ ...base, check: { ...base.check, options: ["a", "b"] } }).success).toBe(false);
    expect(SceneDoc.safeParse({ ...base, check: { ...base.check, answerIndex: 4 } }).success).toBe(false);
  });

  it("rejects unknown scene kinds", () => {
    const bad = { ...base, scenes: [{ kind: "hologram", title: "x", narration: "y" }] };
    expect(SceneDoc.safeParse(bad).success).toBe(false);
  });

  it("rejects an empty scene list", () => {
    expect(SceneDoc.safeParse({ ...base, scenes: [] }).success).toBe(false);
  });
});

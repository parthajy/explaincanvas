import { describe, it, expect } from "vitest";
import { buildSceneDoc, SceneBuildError, type TeachOutput } from "@/lib/ai/teach";

const loose: TeachOutput = {
  title: "Photosynthesis",
  summary: "Plants make glucose from carbon dioxide and water using light energy, releasing oxygen.",
  audienceLevel: "beginner",
  concept: { key: "Photosynthesis Overview", title: "Photosynthesis", subject: "science", classLevel: 7, chapter: "Nutrition in Plants" },
  scenes: [
    {
      kind: "diagram",
      title: "Inputs and outputs",
      narration: "Light enters the leaf. Carbon dioxide comes in through the stomata. Water comes up from the roots.",
      svg: '<svg viewBox="0 0 800 500"><text x="10" y="30">Leaf</text><path d="M0 0L10 10"/></svg>',
      caption: "Follow the arrows into and out of the leaf.",
      steps: null,
      slides: null,
      engine: null,
      code: null,
      interactions: null,
      shots: null,
      imageRef: null,
      annotations: null,
    },
  ],
  check: {
    question: "Which gas does a plant release during photosynthesis?",
    options: ["Carbon dioxide", "Oxygen", "Nitrogen", "Hydrogen"],
    answerIndex: 1,
    explanation: "Oxygen is released as a by-product when water is split.",
  },
  sources: [{ kind: "ncert", note: "Class 7 Science, Chapter 1" }],
};

describe("buildSceneDoc", () => {
  it("normalises the concept key and sanitises SVG", () => {
    const doc = buildSceneDoc(loose, "diagram");
    expect(doc.concept.key).toBe("photosynthesis-overview");
    expect(doc.scenes[0].kind).toBe("diagram");
    expect(doc.version).toBe(1);
  });

  it("collects problems instead of throwing on the first", () => {
    const bad: TeachOutput = {
      ...loose,
      scenes: [{ ...loose.scenes[0], svg: "<svg><script>x</script></svg>" }],
      check: { ...loose.check, options: ["only one"] },
    };
    try {
      buildSceneDoc(bad, "diagram");
      throw new Error("expected failure");
    } catch (err) {
      expect(err).toBeInstanceOf(SceneBuildError);
      const issues = (err as SceneBuildError).issues;
      expect(issues.some((i) => i.includes("svg rejected"))).toBe(true);
      expect(issues.some((i) => i.includes("check.options") || i.includes("scenes"))).toBe(true);
    }
  });
});

import { describe, it, expect } from "vitest";
import { screenText } from "@/lib/safety";
import { parseNcertRef, chapterFromSlug, chapterSlug, findChapter, ncertLabel } from "@/lib/ncert";
import { textIsThin } from "@/lib/ai/pagereader";

describe("safety screen", () => {
  it("lets ordinary school questions through, including tricky substrings", () => {
    for (const t of ["Why is the sky blue?", "Explain class 9 assessment of cumulative frequency", "What is the Scunthorpe problem?", "Gandhi's role in 1942", "Find the HCF of 36 and 60", "Define rand() in Python", "chhod do, explain photosynthesis instead"]) {
      expect(screenText(t).ok, t).toBe(true);
    }
  });
  it("catches profanity in English and Hinglish, with spacing and leetspeak tricks", () => {
    for (const t of ["what the fuck is osmosis", "ye chutiya sawal hai", "b!tch please", "f u c k this", "bhen chod", "sh1t", "send nudes"]) {
      expect(screenText(t).ok, t).toBe(false);
    }
  });
});

describe("NCERT helpers", () => {
  it("parses exercise references", () => {
    expect(parseNcertRef("Class 9 Ch 4 Ex 4.2 Q3")).toEqual({ chapter: 4, ref: "Ex 4.2 Q3" });
    expect(parseNcertRef("exercise 7.1 question 5")).toEqual({ chapter: 7, ref: "Ex 7.1 Q5" });
    expect(parseNcertRef("why do we see a rainbow")).toEqual({ chapter: null, ref: null });
  });
  it("round-trips chapter slugs and labels", () => {
    const c = findChapter(9, "physics", 8)!;
    expect(c.name).toBe("Force and Laws of Motion");
    const slug = chapterSlug(c);
    expect(slug).toBe("chapter-8-force-and-laws-of-motion");
    expect(chapterFromSlug(9, "science", slug)?.n).toBe(8);
    expect(chapterFromSlug(9, "science", "chapter-8-something-else")).toBeNull();
    expect(ncertLabel(10, "biology", 5, "Ex 5.1 Q2")).toBe("Class 10 · Ch 5 Life Processes · Ex 5.1 Q2");
    expect(ncertLabel(10, "other", 5)).toBeNull();
  });
});

describe("page reader gating", () => {
  it("treats thin text as 'the photo is the question'", () => {
    expect(textIsThin("")).toBe(true);
    expect(textIsThin("solve this")).toBe(true);
    expect(textIsThin("Q3 please")).toBe(true);
    expect(textIsThin("Why don't action and reaction forces cancel each other out?")).toBe(false);
  });
});

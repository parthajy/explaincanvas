/**
 * NCERT chapter index. "Class 9, Chapter 4" is how students and parents refer to work, so every
 * explanation is mapped to a chapter and every chapter gets a page.
 * Classes 6 to 8 follow the new "Curiosity" textbooks (2024 onwards); 9 and 10 the rationalised editions.
 */

export type NcertSubject = "science" | "maths";

export interface NcertChapter {
  n: number;
  name: string;
}

const C: Record<string, NcertChapter[]> = {
  "6-science": [
    { n: 1, name: "The Wonderful World of Science" },
    { n: 2, name: "Diversity in the Living World" },
    { n: 3, name: "Mindful Eating: A Path to a Healthy Body" },
    { n: 4, name: "Exploring Magnets" },
    { n: 5, name: "Measurement of Length and Motion" },
    { n: 6, name: "Materials Around Us" },
    { n: 7, name: "Temperature and its Measurement" },
    { n: 8, name: "A Journey through States of Water" },
    { n: 9, name: "Methods of Separation in Everyday Life" },
    { n: 10, name: "Living Creatures: Exploring their Characteristics" },
    { n: 11, name: "Nature's Treasures" },
    { n: 12, name: "Beyond Earth" },
  ],
  "7-science": [
    { n: 1, name: "The Ever-Evolving World of Science" },
    { n: 2, name: "Exploring Substances: Acidic, Basic, and Neutral" },
    { n: 3, name: "Electricity: Circuits and their Components" },
    { n: 4, name: "The World of Metals and Non-metals" },
    { n: 5, name: "Changes Around Us: Physical and Chemical" },
    { n: 6, name: "Adolescence: A Stage of Growth and Change" },
    { n: 7, name: "Heat Transfer in Nature" },
    { n: 8, name: "Measurement of Time and Motion" },
    { n: 9, name: "Life Processes in Animals" },
    { n: 10, name: "Life Processes in Plants" },
    { n: 11, name: "Light: Shadows and Reflections" },
    { n: 12, name: "Earth, Moon, and the Sun" },
  ],
  "8-science": [
    { n: 1, name: "Exploring the Investigative World of Science" },
    { n: 2, name: "The Invisible Living World: Beyond Our Naked Eye" },
    { n: 3, name: "Health: The Ultimate Treasure" },
    { n: 4, name: "Electricity: Magnetic and Heating Effects" },
    { n: 5, name: "Exploring Forces" },
    { n: 6, name: "Pressure, Winds, Storms, and Cyclones" },
    { n: 7, name: "Particulate Nature of Matter" },
    { n: 8, name: "Nature of Matter: Elements, Compounds, and Mixtures" },
    { n: 9, name: "The Amazing World of Solutes, Solvents, and Solutions" },
    { n: 10, name: "Light: Mirrors and Lenses" },
    { n: 11, name: "Keeping Time with the Skies" },
    { n: 12, name: "How Nature Works in Harmony" },
    { n: 13, name: "Our Home: Earth, a Unique Life Sustaining Planet" },
  ],
  "9-science": [
    { n: 1, name: "Matter in Our Surroundings" },
    { n: 2, name: "Is Matter Around Us Pure" },
    { n: 3, name: "Atoms and Molecules" },
    { n: 4, name: "Structure of the Atom" },
    { n: 5, name: "The Fundamental Unit of Life" },
    { n: 6, name: "Tissues" },
    { n: 7, name: "Motion" },
    { n: 8, name: "Force and Laws of Motion" },
    { n: 9, name: "Gravitation" },
    { n: 10, name: "Work and Energy" },
    { n: 11, name: "Sound" },
    { n: 12, name: "Improvement in Food Resources" },
  ],
  "10-science": [
    { n: 1, name: "Chemical Reactions and Equations" },
    { n: 2, name: "Acids, Bases and Salts" },
    { n: 3, name: "Metals and Non-metals" },
    { n: 4, name: "Carbon and its Compounds" },
    { n: 5, name: "Life Processes" },
    { n: 6, name: "Control and Coordination" },
    { n: 7, name: "How do Organisms Reproduce?" },
    { n: 8, name: "Heredity" },
    { n: 9, name: "Light: Reflection and Refraction" },
    { n: 10, name: "The Human Eye and the Colourful World" },
    { n: 11, name: "Electricity" },
    { n: 12, name: "Magnetic Effects of Electric Current" },
    { n: 13, name: "Our Environment" },
  ],
  "9-maths": [
    { n: 1, name: "Number Systems" },
    { n: 2, name: "Polynomials" },
    { n: 3, name: "Coordinate Geometry" },
    { n: 4, name: "Linear Equations in Two Variables" },
    { n: 5, name: "Introduction to Euclid's Geometry" },
    { n: 6, name: "Lines and Angles" },
    { n: 7, name: "Triangles" },
    { n: 8, name: "Quadrilaterals" },
    { n: 9, name: "Circles" },
    { n: 10, name: "Heron's Formula" },
    { n: 11, name: "Surface Areas and Volumes" },
    { n: 12, name: "Statistics" },
  ],
  "10-maths": [
    { n: 1, name: "Real Numbers" },
    { n: 2, name: "Polynomials" },
    { n: 3, name: "Pair of Linear Equations in Two Variables" },
    { n: 4, name: "Quadratic Equations" },
    { n: 5, name: "Arithmetic Progressions" },
    { n: 6, name: "Triangles" },
    { n: 7, name: "Coordinate Geometry" },
    { n: 8, name: "Introduction to Trigonometry" },
    { n: 9, name: "Some Applications of Trigonometry" },
    { n: 10, name: "Circles" },
    { n: 11, name: "Areas Related to Circles" },
    { n: 12, name: "Surface Areas and Volumes" },
    { n: 13, name: "Statistics" },
    { n: 14, name: "Probability" },
  ],
};

/** physics, chemistry and biology all live in the one NCERT Science book for Classes 6 to 10. */
export function ncertSubject(subject: string): NcertSubject | null {
  if (subject === "maths") return "maths";
  if (["science", "physics", "chemistry", "biology"].includes(subject)) return "science";
  return null;
}

export function chaptersFor(classLevel: number, subject: string): NcertChapter[] {
  const s = ncertSubject(subject);
  return s ? (C[`${classLevel}-${s}`] ?? []) : [];
}

export function findChapter(classLevel: number, subject: string, n: number | null | undefined): NcertChapter | null {
  if (!n) return null;
  return chaptersFor(classLevel, subject).find((c) => c.n === n) ?? null;
}

export function chapterSlug(c: NcertChapter): string {
  return `chapter-${c.n}-${c.name
    .toLowerCase()
    .replace(/['’:?,.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;
}

export function chapterFromSlug(classLevel: number, subject: string, slug: string): NcertChapter | null {
  const m = /^chapter-(\d{1,2})-/.exec(slug);
  if (!m) return null;
  const c = findChapter(classLevel, subject, Number(m[1]));
  return c && chapterSlug(c) === slug ? c : null;
}

/** Compact text for prompts: "1 Matter in Our Surroundings; 2 Is Matter Around Us Pure; ..." */
export function chapterIndexText(classLevel: number, subject: string): string {
  const list = chaptersFor(classLevel, subject);
  return list.length ? list.map((c) => `${c.n} ${c.name}`).join("; ") : "";
}

/** "Class 9 · Ch 4 Structure of the Atom · Ex 4.2 Q3" */
export function ncertLabel(classLevel: number, subject: string, chapter: number | null | undefined, ref?: string | null): string | null {
  const c = findChapter(classLevel, subject, chapter);
  if (!c) return null;
  return `Class ${classLevel} · Ch ${c.n} ${c.name}${ref ? ` · ${ref}` : ""}`;
}

/** Pulls "Ex 4.2 Q3" style references out of what the student typed. */
export function parseNcertRef(text: string): { chapter: number | null; ref: string | null } {
  const t = text.toLowerCase();
  const ch = /\b(?:ch(?:apter)?\.?\s*)(\d{1,2})\b/.exec(t);
  const ex = /\b(?:ex(?:ercise)?\.?\s*)(\d{1,2}(?:\.\d{1,2})?)\b/.exec(t);
  const qn = /\b(?:q(?:uestion)?\.?\s*(?:no\.?\s*)?)(\d{1,2})\b/.exec(t);
  let chapter = ch ? Number(ch[1]) : null;
  if (!chapter && ex && ex[1].includes(".")) chapter = Number(ex[1].split(".")[0]);
  const parts = [ex ? `Ex ${ex[1]}` : null, qn ? `Q${qn[1]}` : null].filter(Boolean);
  return { chapter: chapter && chapter >= 1 && chapter <= 20 ? chapter : null, ref: parts.length ? parts.join(" ") : null };
}

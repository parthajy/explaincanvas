/**
 * One integer scale for "where is this learner", from school to research. Stored in students.class_level
 * and carried through routing and teaching. School classes keep their familiar numbers so the NCERT
 * chapter mapping and the class landers still apply; everything above 12 is higher education.
 */
export const LEVELS: { value: number; label: string }[] = [
  { value: 6, label: "Class 6" },
  { value: 7, label: "Class 7" },
  { value: 8, label: "Class 8" },
  { value: 9, label: "Class 9" },
  { value: 10, label: "Class 10" },
  { value: 11, label: "Class 11" },
  { value: 12, label: "Class 12" },
  { value: 13, label: "Undergraduate, year 1" },
  { value: 14, label: "Undergraduate, year 2" },
  { value: 15, label: "Undergraduate, year 3" },
  { value: 16, label: "Undergraduate, year 4" },
  { value: 17, label: "Postgraduate" },
  { value: 19, label: "Research / PhD" },
  { value: 20, label: "Self-learner / professional" },
];

export const MAX_LEVEL = 20;

export function levelLabel(n: number | null | undefined): string {
  if (!n) return "Any level";
  if (n <= 12) return `Class ${n}`;
  if (n <= 16) return `Undergraduate, year ${n - 12}`;
  if (n <= 18) return "Postgraduate";
  if (n === 19) return "Research / PhD";
  return "Self-learner";
}

/** Short form for compact labels: "Class 9", "UG year 2", "PG", "PhD". */
export function levelShort(n: number | null | undefined): string {
  if (!n) return "";
  if (n <= 12) return `Class ${n}`;
  if (n <= 16) return `UG year ${n - 12}`;
  if (n <= 18) return "PG";
  if (n === 19) return "PhD";
  return "Learner";
}

/** Shared wording for the model prompts. */
export const LEVEL_SCALE_PROMPT =
  "Level scale: 1 to 12 are school classes (Indian numbering, Class 1 to Class 12); 13 to 16 are undergraduate years 1 to 4; 17 to 18 postgraduate; 19 research or PhD; 20 an adult self-learner or professional. Pitch depth, vocabulary and rigour to the level.";

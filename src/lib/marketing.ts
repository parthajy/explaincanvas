import { chaptersFor, type NcertChapter } from "@/lib/ncert";

/**
 * Content for the school chapter guides. Chapters come from the textbook index so every guide and chapter page
 * uses the real chapter names; the questions here are the ones students actually type. The product itself answers
 * any academic question at any level; these pages exist because school chapters are how search traffic arrives.
 */

export interface Lander {
  slug: string;
  classLevel: number;
  subject: "Science" | "Maths";
  title: string;
  metaTitle: string;
  description: string;
  intro: string;
  /** Example questions keyed by textbook chapter number. Chapters without entries get generic prompts. */
  questions: Record<number, string[]>;
  faq: { q: string; a: string }[];
}

const COMMON_FAQ = (cls: number, subject: string): { q: string; a: string }[] => [
  {
    q: `Does ExplainCanvas follow the Class ${cls} ${subject} textbook?`,
    a: `Yes. Every explanation is pitched at Class ${cls}, mapped to the chapter it belongs to, and follows the standard textbook treatment of the topic. The learner's level is set once on the account, so depth and vocabulary match what they see in school. The same product also answers questions well beyond school, up to research level.`,
  },
  {
    q: "Is it free?",
    a: "The library of validated explanations is free to read, and every account gets about five fresh explanations a week free. After that, plans start at ₹599 a month for about 250 credits. A diagram costs 8 credits, an animation 32, a library lesson 1.",
  },
  {
    q: "Can my child photograph the homework page?",
    a: "Yes. Photograph the whole page. ExplainCanvas reads every question on it, lets the student tap the one they want, and keeps the photo for context so diagrams and figures are understood too.",
  },
  {
    q: "How is this different from watching a video?",
    a: "The student asks their own question, in their own words, and gets a picture built for that question. One check question at the end confirms it landed, and parents get an email of what was understood.",
  },
  {
    q: "What if the explanation is wrong?",
    a: "Every explanation passes a separate verification pass before it is shown, and students can report a mistake with one tap. Reported lessons are pulled from the library until a person has reviewed them.",
  },
];

export const LANDERS: Lander[] = [
  {
    slug: "cbse-class-6-science",
    classLevel: 6,
    subject: "Science",
    title: "Class 6 Science, explained visually",
    metaTitle: "Class 6 Science explained with diagrams and animations, chapter by chapter",
    description: "Ask any Class 6 Science doubt and see the answer drawn: food, magnets, measurement, materials, water, separation, living things, space. Free library, one check question, parent report.",
    intro: "Class 6 is where Science stops being a story and starts asking why. A good picture at the right moment makes the difference between memorising and understanding.",
    questions: {
      3: ["Why do we need different kinds of food?", "Show me how to test for starch in a chapati"],
      4: ["Why does a magnet attract iron but not wood?", "Show me the magnetic field around a bar magnet"],
      5: ["What is the difference between rectilinear and circular motion?", "Why do we need standard units?"],
      6: ["Why does salt disappear in water but sand does not?", "How do we group materials?"],
      7: ["How does a thermometer work?", "Why can't we trust touch to measure temperature?"],
      8: ["Show me how water changes between ice, water and steam", "Where does the water in clouds come from?"],
      9: ["How does sieving separate things?", "Show me evaporation separating salt from water"],
      10: ["What makes something living?", "Why do seeds need water to grow?"],
      12: ["Why do we see different phases of the Moon?", "Show me why the Sun seems to move across the sky"],
    },
    faq: COMMON_FAQ(6, "Science"),
  },
  {
    slug: "cbse-class-7-science",
    classLevel: 7,
    subject: "Science",
    title: "Class 7 Science, explained visually",
    metaTitle: "Class 7 Science explained with diagrams and animations, chapter by chapter",
    description: "Acids and bases, circuits, metals, physical and chemical changes, heat, time and motion, life processes, light, the Earth and Moon. Ask it, see it, answer one check question.",
    intro: "Class 7 brings the first real mechanisms: how a leaf makes food, how heat travels, why an acid and a base cancel. Mechanisms are easiest to understand as moving pictures.",
    questions: {
      2: ["Why do acids and bases neutralise each other?", "What happens to litmus in lemon juice?"],
      3: ["Show me how a simple electric circuit works", "Why does a bulb glow only in a closed circuit?"],
      4: ["Why are metals shiny and non-metals not?", "Why does iron rust?"],
      5: ["What is the difference between a physical and a chemical change?", "Is burning paper a chemical change?"],
      7: ["How does heat travel through a metal spoon?", "Why do sea breezes blow in the day and land breezes at night?"],
      8: ["How do I read a distance-time graph?", "What does a steeper line mean?"],
      9: ["Why do we breathe faster after running?", "Show me how the diaphragm moves when we breathe"],
      10: ["How does a plant make its food?", "Show photosynthesis step by step"],
      11: ["How does a shadow form?", "Show me how a pinhole camera makes an upside-down image"],
      12: ["Why do we have seasons?", "Show me why the Moon has phases"],
    },
    faq: COMMON_FAQ(7, "Science"),
  },
  {
    slug: "cbse-class-8-science",
    classLevel: 8,
    subject: "Science",
    title: "Class 8 Science, explained visually",
    metaTitle: "Class 8 Science explained with diagrams and animations, chapter by chapter",
    description: "Microbes and cells, health, electricity, forces, pressure and cyclones, particles, elements and mixtures, solutions, mirrors and lenses, the sky. Every doubt answered as a picture built for that question.",
    intro: "Class 8 is heavy on forces and on things too small to see. Both are better drawn than described.",
    questions: {
      2: ["Show me the parts of a cell in 3D", "What is the difference between bacteria and viruses?"],
      3: ["How do vaccines work?", "Why is a balanced diet important?"],
      4: ["Why does a wire heat up when current flows?", "Show me how an electromagnet works"],
      5: ["Why does a ball keep rolling after I stop pushing it?", "Show me where friction acts on a cycle"],
      6: ["Why does a sharp knife cut better than a blunt one?", "How does a cyclone form?"],
      7: ["Why does a balloon expand when heated?", "Show me how particles move in a solid, liquid and gas"],
      8: ["What is the difference between a compound and a mixture?", "Is air an element, compound or mixture?"],
      9: ["Why does sugar dissolve faster in hot water?", "What is a saturated solution?"],
      10: ["Why do we see a rainbow?", "Show me how a convex lens forms an image"],
      11: ["Why does the Moon look different each night?", "How did people tell time before clocks?"],
      12: ["Show me a food web", "Why do forests matter for rain?"],
    },
    faq: COMMON_FAQ(8, "Science"),
  },
  {
    slug: "cbse-class-9-science",
    classLevel: 9,
    subject: "Science",
    title: "Class 9 Science, explained visually",
    metaTitle: "Class 9 Science explained chapter by chapter with diagrams, 3D and animation",
    description: "Matter, atoms, structure of the atom, cells, tissues, motion, force and laws of motion, gravitation, work and energy, sound. Ask any Class 9 Science doubt and see the answer drawn.",
    intro: "Class 9 is the jump. Newton's laws, atoms, tissues, gravitation. Students who can picture these ideas carry them into Class 10 and the boards. Students who memorise them start again every year.",
    questions: {
      1: ["Why does ice float on water?", "Show me how particles move when water boils"],
      2: ["What is the difference between a mixture and a compound?", "Show me how to separate a mixture of sand, salt and water"],
      3: ["Show me how to balance a chemical equation", "Why is the law of conservation of mass true?"],
      4: ["Show me Rutherford's gold foil experiment", "Why do electrons not fall into the nucleus?"],
      5: ["Show me the parts of a plant cell in 3D", "What does the cell membrane actually do?"],
      6: ["Show me the types of plant tissue", "What makes muscle tissue different from nerve tissue?"],
      7: ["How do I read a velocity-time graph?", "What is the difference between speed and velocity?"],
      8: ["Why don't action and reaction forces cancel out?", "Show me what inertia looks like in a moving bus"],
      9: ["Why do a feather and a coin fall together in a vacuum?", "What is the difference between mass and weight?"],
      10: ["Why is holding a heavy bag not work in physics?", "Show how potential energy becomes kinetic energy on a slide"],
      11: ["Show me how a sound wave travels through air", "Why does an echo need a minimum distance?"],
    },
    faq: COMMON_FAQ(9, "Science"),
  },
  {
    slug: "cbse-class-10-science",
    classLevel: 10,
    subject: "Science",
    title: "Class 10 Science, explained visually",
    metaTitle: "Class 10 Science explained chapter by chapter with diagrams, 3D and animation",
    description: "Chemical reactions, acids and bases, metals, carbon, life processes, control and coordination, reproduction, heredity, light, the eye, electricity, magnetism. Board-year doubts answered as a picture, with a check question.",
    intro: "Board year. Every chapter has one or two ideas that come up again and again: refraction in lenses, the heart's double circulation, Ohm's law, Mendel's ratios. Seeing them once properly is worth hours of rereading.",
    questions: {
      1: ["Show me a displacement reaction happening", "Why does a cut apple turn brown?"],
      2: ["Why does the pH scale run from 0 to 14?", "Show me what happens when an acid meets a metal"],
      3: ["Show me the reactivity series with examples", "Why does aluminium not corrode like iron?"],
      4: ["Why does carbon form so many compounds?", "Show me the structure of methane in 3D"],
      5: ["Show me how blood flows through the heart", "Why is double circulation needed in humans?"],
      6: ["Show me how a reflex arc works", "Why does a plant bend towards light?"],
      7: ["How does binary fission work in amoeba?", "Show me the parts of a flower involved in reproduction"],
      8: ["Show me Mendel's monohybrid cross", "Why is the ratio 3:1?"],
      9: ["How does light bend when it enters water?", "Show me image formation by a convex lens step by step"],
      10: ["Why is the sky blue?", "Show me how the eye focuses on near and far objects"],
      11: ["Why does a lemon battery work?", "Show me the difference between series and parallel circuits"],
      12: ["Show me the right-hand thumb rule in 3D", "How does an electric motor keep turning?"],
      13: ["Show me a food chain and where energy is lost", "Why is the ozone layer important?"],
    },
    faq: COMMON_FAQ(10, "Science"),
  },
  {
    slug: "cbse-class-9-maths",
    classLevel: 9,
    subject: "Maths",
    title: "Class 9 Maths, explained step by step",
    metaTitle: "Class 9 Maths explained chapter by chapter, step by step with diagrams",
    description: "Number systems, polynomials, coordinate geometry, linear equations, Euclid, lines and angles, triangles, quadrilaterals, circles, Heron's formula, surface areas, statistics. Every method shown one step at a time.",
    intro: "Maths doubts are usually one missing step. ExplainCanvas shows the whole working, one line at a time, and draws the figure next to it.",
    questions: {
      1: ["Why is √2 irrational?", "Show me how to represent √3 on the number line"],
      2: ["Why does the factor theorem work?", "Show me how to factorise x² + 5x + 6 step by step"],
      3: ["Show me how to plot (-3, 2) and explain the signs", "What does the origin mean?"],
      4: ["Why does a linear equation in two variables make a straight line?", "Show me how to draw the graph of 2x + y = 6"],
      6: ["Why are vertically opposite angles equal?", "Show me the angle sum property of a triangle with parallel lines"],
      7: ["What is the difference between SAS and ASA?", "Show me why the angles opposite equal sides are equal"],
      8: ["Why do the diagonals of a parallelogram bisect each other?", "Show me the mid-point theorem"],
      9: ["Why is the angle in a semicircle a right angle?", "Show me the chord and perpendicular theorem"],
      10: ["Where does Heron's formula come from?", "Show me how to find the area of a triangle with sides 7, 8 and 9"],
      11: ["Show me where the formula for the volume of a cone comes from", "Why is a sphere's surface area 4πr²?"],
      12: ["How do I draw a histogram from a frequency table?", "What is the difference between mean, median and mode?"],
    },
    faq: COMMON_FAQ(9, "Maths"),
  },
  {
    slug: "cbse-class-10-maths",
    classLevel: 10,
    subject: "Maths",
    title: "Class 10 Maths, explained step by step",
    metaTitle: "Class 10 Maths explained chapter by chapter, step by step with diagrams",
    description: "Real numbers, polynomials, linear equations, quadratic equations, arithmetic progressions, triangles, coordinate geometry, trigonometry, circles, areas, surface areas, statistics, probability. Board-year methods shown one step at a time.",
    intro: "Board-year Maths rewards method. Every solution here is shown as steps with the reason for each, and the figure is drawn alongside so the student sees what the algebra is doing.",
    questions: {
      1: ["Show me Euclid's division algorithm for 135 and 225", "Why is the HCF × LCM equal to the product of two numbers?"],
      2: ["Show me the relationship between zeros and coefficients", "Why does a quadratic have at most two zeros?"],
      3: ["Show me how to solve by elimination step by step", "When does a pair of linear equations have no solution?"],
      4: ["Show me how to complete the square step by step", "What does the discriminant tell me?"],
      5: ["Why is the sum of an AP n/2 (a + l)?", "Show me how to find the 20th term"],
      6: ["Show me why the basic proportionality theorem works", "What is the difference between congruent and similar triangles?"],
      7: ["Show me where the distance formula comes from", "How do I find the midpoint of two points?"],
      8: ["Show me why sin² θ + cos² θ = 1", "Where do the values of sin 30° and cos 60° come from?"],
      9: ["Show me how to find the height of a tower from its angle of elevation", "What is an angle of depression?"],
      10: ["Why is a tangent perpendicular to the radius?", "Show me why two tangents from a point are equal"],
      11: ["Show me how to find the area of a sector", "What is the area of a segment of a circle?"],
      12: ["Show me the surface area of a cylinder with a hemisphere on top", "How do I find the volume of a frustum?"],
      13: ["Show me how to find the mean by the step-deviation method", "How do I read a cumulative frequency curve?"],
      14: ["What is the probability of getting two heads in two tosses?", "Show me the sample space for two dice"],
    },
    faq: COMMON_FAQ(10, "Maths"),
  },
];

export const landerBySlug = (slug: string) => LANDERS.find((l) => l.slug === slug) ?? null;

export function landerFor(classLevel: number, subject: "Science" | "Maths"): Lander | null {
  return LANDERS.find((l) => l.classLevel === classLevel && l.subject === subject) ?? null;
}

/** Example questions for a chapter: the hand-written ones, padded with generic prompts so every chapter page has something to tap. */
export function chapterQuestions(l: Lander, c: NcertChapter): string[] {
  const own = l.questions[c.n] ?? [];
  const generic = [`Explain ${c.name} in simple words`, `What are the most important ideas in ${c.name}?`, `Show me a diagram for ${c.name}`];
  return [...own, ...generic.filter((g) => !own.includes(g))].slice(0, 4);
}

export function landerChapters(l: Lander): NcertChapter[] {
  return chaptersFor(l.classLevel, l.subject.toLowerCase());
}

/** Site-wide questions, written so an answer engine can lift them whole. */
export const GENERAL_FAQ: { q: string; a: string }[] = [
  {
    q: "What is ExplainCanvas?",
    a: "ExplainCanvas is an AI learning tool for any academic subject at any level. You type or photograph the thing you are stuck on, and the explanation arrives as a diagram, a set of steps, slides, an animation or a 3D model, whichever fits the idea. Each explanation is checked before you see it and ends with one check question. School learners get chapter mapping, and parents can receive an email of what was understood.",
  },
  {
    q: "Which subjects and levels does ExplainCanvas cover?",
    a: "Any academic subject, from school Science and Maths to undergraduate engineering, economics, medicine or humanities, and on to postgraduate and research topics. You set your level once and every explanation is pitched there. For school classes, explanations also name the textbook chapter they come from.",
  },
  {
    q: "How much does ExplainCanvas cost?",
    a: "The library is free and every account gets about five fresh explanations a week free. Paid plans are Student at ₹599 a month (250 credits), Pro at ₹1,999 a month (900 credits), Max at ₹4,999 a month (2,500 credits) and Max Annual at ₹50,000 a year. Prices exclude 18% GST, which is added at checkout. Credit packs are available to subscribers.",
  },
  {
    q: "What is a credit?",
    a: "A credit is roughly one rupee of generation work. A diagram costs 8 credits, an annotated photo 10, a 3D model 20, slides 24, a step-by-step solution 26, an animation 32, and a library lesson 1. Unused plan credits roll over one month.",
  },
  {
    q: "Can a student photograph a whole homework page?",
    a: "Yes. Photograph the page and ExplainCanvas lists every question it finds. The student taps the one they want and the explanation is built for that question, with the photo kept for context.",
  },
  {
    q: "How does ExplainCanvas check that an explanation is correct?",
    a: "Every fresh explanation is generated and then independently verified by a second model pass before it is shown. If verification finds a problem, the explanation is revised once. Students can also report a mistake with one tap, which removes the lesson from the public library until a person has reviewed it.",
  },
  {
    q: "What does the parent get?",
    a: "An email at a fixed time each evening the child studies, listing the concepts answered correctly and the ones still being worked on, with chapter names. If the child has not studied for two days, a short nudge with one suggested question. On Sundays, a recap of the week: what was understood, what they struggled with, and the weak chapters to revisit.",
  },
  {
    q: "Can explanations be in Hinglish?",
    a: "Yes. Every explanation has an \"Explain in Hinglish\" button, and the chat has a language switch. Technical terms stay in English so they match the textbook and the exam.",
  },
  {
    q: "Is ExplainCanvas safe for children?",
    a: "There is no chat with strangers and no feed. Questions are screened for inappropriate language before anything runs, photos are checked, and the AI only answers school questions in an age-appropriate, textbook tone. Repeated misuse pauses the account and is visible to us.",
  },
  {
    q: "Does ExplainCanvas work on a phone?",
    a: "Yes. It runs in any modern browser and can be added to the home screen as an app. Narration plays on every explanation, questions can be dictated, and any explanation can be shared to WhatsApp.",
  },
  {
    q: "How do I cancel?",
    a: "From the Account page, Manage billing opens the payment portal where a subscription can be cancelled in two taps. Access continues until the end of the paid period. Refunds follow the policy on the Refunds page.",
  },
];

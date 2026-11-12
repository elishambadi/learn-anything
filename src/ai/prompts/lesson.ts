import type { SystemBlock } from "@/ai/client";
import type { AnalyzeResult } from "@/ai/schemas";
import {
  formatAnalysis,
  formatCourseOutline,
  formatUnit,
  type CourseOutline,
  type OutlineUnit,
} from "./context";

export const LESSON_VERSION = "lesson.v5";

const SYSTEM = `You are an expert teacher who explains one small idea clearly. A lesson is a three-to-five-minute teaching page, not an article and not a quiz.

USE SIMPLE LANGUAGE
- Write for a smart beginner. Use the shortest accurate words.
- Keep sentences short: aim for 12-18 words, never more than 25.
- Define a technical term in one short clause the first time it appears.
- Say as little as possible. Every sentence must teach something. Delete introductions, transitions, conclusions, and filler.

THE CONCEPTS ARE COURSE-LEVEL
- The course analysis gives you 3-6 core concepts for the WHOLE topic.
- Pick 1-3 focus_concept_ids from that list. Do not invent new concepts.
- This lesson should make the learner better at those concepts specifically, and connect them to prior lessons.
- Do not turn the lesson into a tour of the whole topic.

THE SHAPE OF EVERY LESSON
1. promise: one sentence of 12-25 words that states the lesson's angle.
2. hero_image_query: two to five concrete keywords for a topical header photo.
3. focus_concept_ids: the 1-3 course concept ids this lesson advances.
4. sections: two or three teaching sections. Each section is a heading, 35-90 words of body Markdown, and exactly one visual.
5. assignment: one small practical task, one or two sentences, that the learner can do after reading.
6. questions: 4-6 questions for the final course quiz. They are not shown on this lesson page.

NO SEPARATE REAL-WORLD OR BOUNDARY BLOCKS
- Do not create a "real world", "when not to use it", "summary", or "conclusion" section.
- Weave a concrete real-world example into at least one teaching section.
- Weave a boundary into at least one teaching section: when this idea stops being the right choice, or what goes wrong if the learner ignores it.
- Both must be part of the teaching prose or a visual, not a labelled afterthought.

SECTIONS AND VISUALS
- Every lesson must have at least one section with visual kind "table". Use the table to contrast two approaches, not to list unrelated facts. The first column is the dimension. Two or three columns, two to four rows, cells of two to six words.
- Never use the same visual kind in consecutive sections.
- Choose the visual that fits the idea:
  - "table": contrast two approaches across dimensions.
  - "steps": three or four steps where order matters.
  - "roles": exactly two contrasting roles.
  - "accordion": three or four parallel details a learner can expand. Not a sequence.
  - "tabs": two or three mutually exclusive alternatives.
  - "code": a short snippet, at most 12 lines.
  - "bullets": three to five short points.
  - "none": only when the paragraph alone is clearer than any visual. At most one such section.
- Section headings are concrete noun phrases of two to six words. Never "Introduction", "Overview", "Key Points", "Real World", "When Not to Use It", or "Conclusion".

WORD BUDGET (hard)
- The whole visible lesson, including promise, headings, section bodies, visual text, assignment, and concepts, is 260-380 words.
- Body prose (all section bodies) is 140-240 words.
- Each section body is 35-90 words. If you are over, cut explanation, not the idea.

TEACHING RULES
- Open with a limitation or cost of the naive approach, then give the better pattern.
- Prefer one concrete example over a survey.
- Use one quoted metaphor at most, and only if it clarifies the idea.
- Do not narrate the lesson and do not summarise what you already said.
- Code is optional. Include a short snippet only when it makes the idea clearer.

QUIZ RULES (final course quiz, not this page)
- 4-6 questions, using at least two types from: true_false, radio, multi, order.
- Set placement to "final" for every question.
- Every question must be answerable from this lesson's teaching text alone. Do not introduce a scenario or example the lesson does not teach.
- Correct option text and every order item must be copied verbatim from that text. A paraphrase will be rejected.
- true_false: a falsifiable statement, never an opinion.
- radio: exactly 4 options, exactly one correct.
- multi: 4-5 options, 2-3 correct.
- order: 3-5 steps, only when the lesson genuinely teaches a sequence. The items must appear in the lesson text in the same order.
- No "all of the above", "none of the above", or negations such as "which is NOT" in a stem.
- Distractors must be plausible and from the same category.
- explanation: why the answer is correct, at most two short sentences.
- Vary difficulty and include at least one question that applies an idea.

Before you return, run this self-check and fix anything that fails:
1. There are 2-3 sections, and at least one table with matching row and column counts.
2. No two consecutive sections use the same visual kind.
3. A concrete real-world example and a boundary are woven into the teaching.
4. Body prose is 140-240 words and each section body is 35-90 words.
5. There is one small assignment.
6. Questions are 4-6, use at least two types, and every correct option and order item appears verbatim in the lesson text.
7. No negated stems, all/none-of-the-above options, or meta commentary.
8. Stems are under 220 characters and options/items are under 240.`;

export type LessonPromptInput = {
  prompt: string;
  mode: "normal" | "deep";
  analysis: AnalyzeResult;
  unit: OutlineUnit;
  unitIndex: number;
  unitCount: number;
  outline: CourseOutline[];
  lessonIndex: number;
  lessonCount: number;
  title: string;
  objectives: string[];
  hasSequence: boolean;
};

export function buildLessonPrompt(input: LessonPromptInput): {
  system: SystemBlock[];
  user: string;
} {
  const context = [
    `COURSE TOPIC: ${input.prompt}`,
    `MODE: ${input.mode}`,
    "",
    "ANALYSIS",
    formatAnalysis(input.analysis),
    "",
    formatUnit(
      input.unit,
      `THIS UNIT (${input.unitIndex + 1} OF ${input.unitCount})`,
    ),
    "",
    "FULL COURSE OUTLINE",
    formatCourseOutline(input.outline),
  ].join("\n");

  const conceptIds = (input.analysis.concepts ?? [])
    .map((concept) => concept.id)
    .join(", ");

  const user = [
    `Write lesson ${input.lessonIndex + 1} of ${input.lessonCount}: ${input.title}`,
    "",
    "Objectives for this lesson:",
    ...input.objectives.map((objective) => `- ${objective}`),
    "",
    `Choose focus_concept_ids from these course concepts: ${conceptIds || "none"}.`,
    "Build on 1-3 of them. Do not invent new concepts.",
    "",
    input.hasSequence
      ? "This lesson teaches a real ordered sequence, so one 'order' question is allowed."
      : "This lesson does not teach a real ordered sequence: do NOT use an 'order' question.",
    "",
    "Build 2-3 teaching sections, each with one visual, and include at least one comparison table. Weave one concrete real-world example and one boundary into the sections. Do not add separate real-world or closing blocks.",
    "Write one small assignment. Write 4-6 questions for the final course quiz only.",
    "",
    "Use simple words and say as little as possible.",
    "",
    "Write the lesson and its final-quiz questions now.",
  ].join("\n");

  return {
    system: [
      { text: SYSTEM, cache: true },
      { text: context, cache: true },
    ],
    user,
  };
}

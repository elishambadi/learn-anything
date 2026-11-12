import { z } from "zod";

export const questionTypeSchema = z.enum([
  "true_false",
  "radio",
  "multi",
  "order",
]);
export type QuestionType = z.infer<typeof questionTypeSchema>;

export const difficultySchema = z.enum(["easy", "medium", "hard"]);
export type Difficulty = z.infer<typeof difficultySchema>;

export const questionPlacementSchema = z.enum(["inline", "final"]);
export type QuestionPlacement = z.infer<typeof questionPlacementSchema>;

export const conceptIconSchema = z.enum([
  "lightbulb",
  "layers",
  "workflow",
  "shield",
  "zap",
  "target",
  "book",
  "database",
  "clock",
  "chart",
  "box",
  "git-branch",
  "globe",
  "cpu",
  "check",
]);
export type ConceptIcon = z.infer<typeof conceptIconSchema>;

const objectiveSchema = z
  .string()
  .min(8, "An objective should be a complete, specific sentence.")
  .max(220);

const explanationSchema = z
  .string()
  .min(10)
  .max(400)
  .describe(
    "Why the answer is correct, grounded in the lesson. At most two sentences.",
  );

const promptSchema = z
  .string()
  .min(10)
  .max(220)
  .describe("A single clear question or falsifiable statement. No negations.");

const placementSchema = questionPlacementSchema.describe(
  "Use 'inline' for 1-2 questions shown during the lesson, 'final' for the rest shown at the end.",
);

export const trueFalseQuestionSchema = z.object({
  type: z.literal("true_false"),
  prompt: promptSchema.describe(
    "A falsifiable statement (not an opinion) the learner marks true or false.",
  ),
  answer: z.boolean(),
  explanation: explanationSchema,
  difficulty: difficultySchema,
  placement: placementSchema,
});

export const radioQuestionSchema = z.object({
  type: z.literal("radio"),
  prompt: promptSchema,
  options: z
    .array(z.string().min(1).max(240))
    .length(4)
    .describe("Exactly four plausible options from the same category."),
  correct_index: z
    .number()
    .int()
    .min(0)
    .max(3)
    .describe("Zero-based index of the single correct option."),
  explanation: explanationSchema,
  difficulty: difficultySchema,
  placement: placementSchema,
});

export const multiQuestionSchema = z.object({
  type: z.literal("multi"),
  prompt: promptSchema,
  options: z
    .array(z.string().min(1).max(240))
    .min(4)
    .max(5)
    .describe("Four or five plausible options from the same category."),
  correct_indices: z
    .array(z.number().int().min(0).max(4))
    .min(2)
    .max(3)
    .describe("Two or three unique zero-based indices of correct options."),
  explanation: explanationSchema,
  difficulty: difficultySchema,
  placement: placementSchema,
});

export const orderQuestionSchema = z.object({
  type: z.literal("order"),
  prompt: promptSchema,
  items: z
    .array(z.string().min(1).max(240))
    .min(3)
    .max(5)
    .describe(
      "Three to five steps listed in the correct order. Each item must appear verbatim in the lesson body, in this same order.",
    ),
  explanation: explanationSchema,
  difficulty: difficultySchema,
  placement: placementSchema,
});

export const questionDraftSchema = z.union([
  trueFalseQuestionSchema,
  radioQuestionSchema,
  multiQuestionSchema,
  orderQuestionSchema,
]);
export type QuestionDraft = z.infer<typeof questionDraftSchema>;

export const coreConceptSchema = z.object({
  id: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/)
    .describe(
      "A stable slug other prompts can reference, e.g. 'decoupling' or 'carbon-fixation'.",
    ),
  title: z.string().min(3).max(60),
  description: z
    .string()
    .min(20)
    .max(160)
    .describe("One plain-language sentence a beginner can repeat."),
  icon: conceptIconSchema.describe(
    "The icon that best represents this idea. Prefer lightbulb, layers, workflow, target, clock, or git-branch.",
  ),
});
export type CoreConcept = z.infer<typeof coreConceptSchema>;

export const analyzeSchema = z.object({
  summary: z
    .string()
    .min(40)
    .max(700)
    .describe("A short, plain-language description of what the topic covers."),
  audience: z
    .string()
    .min(10)
    .max(260)
    .describe("Who this course is for and what they already know."),
  objectives: z
    .array(objectiveSchema)
    .min(3)
    .max(6)
    .describe("Concrete things a learner can do after the course."),
  concepts: z
    .array(coreConceptSchema)
    .max(6)
    .default([])
    .describe(
      "3-6 core concepts for the WHOLE course. These are the spine every lesson builds on, not per-lesson ideas.",
    ),
  suggested_lesson_count: z
    .number()
    .int()
    .min(4)
    .max(6)
    .describe("How many lessons a normal-mode course should contain."),
});
export type AnalyzeResult = z.infer<typeof analyzeSchema>;

export const subtopicDraftSchema = z.object({
  title: z.string().min(4).max(160),
  summary: z.string().min(20).max(600),
  objectives: z.array(objectiveSchema).min(2).max(4),
});
export type SubtopicDraft = z.infer<typeof subtopicDraftSchema>;

export const decomposeSchema = z.object({
  subtopics: z
    .array(subtopicDraftSchema)
    .min(3)
    .max(4)
    .describe(
      "Three or four ordered subtopics that partition the topic: no overlap and nothing important missing.",
    ),
});
export type DecomposeResult = z.infer<typeof decomposeSchema>;

export const outlineLessonSchema = z.object({
  title: z.string().min(4).max(160),
  objectives: z.array(objectiveSchema).min(2).max(3),
  has_sequence: z
    .boolean()
    .describe(
      "True only when this lesson teaches a real ordered process or sequence.",
    ),
});
export type OutlineLesson = z.infer<typeof outlineLessonSchema>;

export const outlineSchema = z.object({
  lessons: z
    .array(outlineLessonSchema)
    .min(4)
    .max(6)
    .describe("Four to six ordered lessons for this unit."),
});
export type OutlineResult = z.infer<typeof outlineSchema>;

export const comparisonSchema = z.object({
  title: z
    .string()
    .min(5)
    .max(90)
    .describe("What this table compares, e.g. 'Synchronous vs event-driven'."),
  columns: z
    .array(z.string().min(2).max(40))
    .min(2)
    .max(3)
    .describe(
      "Two or three columns. The first column is the dimension being compared.",
    ),
  rows: z
    .array(z.array(z.string().min(1).max(100)).min(2).max(3))
    .min(2)
    .max(6)
    .describe(
      "Two to four rows; each row must have exactly as many cells as columns.",
    ),
});
export type Comparison = z.infer<typeof comparisonSchema>;

/**
 * The visual vocabulary the lesson page can render. The kind is part of the
 * contract so the model chooses a structure instead of always writing prose.
 */
export const visualKindSchema = z.enum([
  "table",
  "steps",
  "roles",
  "accordion",
  "tabs",
  "code",
  "bullets",
  "none",
]);
export type VisualKind = z.infer<typeof visualKindSchema>;

const visualItemSchema = z.object({
  title: z
    .string()
    .min(2)
    .max(60)
    .describe("A short card title, two to six words."),
  text: z
    .string()
    .min(10)
    .max(200)
    .describe("One or two plain sentences, under 45 words."),
});

const tableVisualSchema = z.object({
  kind: z.literal("table"),
  columns: z
    .array(z.string().min(2).max(40))
    .min(2)
    .max(3)
    .describe(
      "Two or three columns. The first column is the dimension being compared.",
    ),
  rows: z
    .array(z.array(z.string().min(1).max(100)).min(2).max(3))
    .min(2)
    .max(6)
    .describe(
      "Two to four rows; each row must have exactly as many cells as columns.",
    ),
});

const stepsVisualSchema = z.object({
  kind: z.literal("steps"),
  items: z
    .array(visualItemSchema)
    .min(3)
    .max(5)
    .describe("Three or four ordered steps. Order matters."),
});

const rolesVisualSchema = z.object({
  kind: z.literal("roles"),
  items: z
    .array(visualItemSchema)
    .length(2)
    .describe("Exactly two contrasting roles or options."),
});

const accordionVisualSchema = z.object({
  kind: z.literal("accordion"),
  items: z
    .array(visualItemSchema)
    .min(3)
    .max(5)
    .describe(
      "Three or four parallel details a learner can expand. Not sequential.",
    ),
});

const tabsVisualSchema = z.object({
  kind: z.literal("tabs"),
  items: z
    .array(visualItemSchema)
    .min(2)
    .max(4)
    .describe(
      "Two or three mutually exclusive alternatives, such as message types.",
    ),
});

const codeVisualSchema = z.object({
  kind: z.literal("code"),
  language: z.string().min(1).max(24),
  code: z
    .string()
    .min(10)
    .max(1200)
    .describe("A short illustrative snippet, at most 12 lines."),
});

const bulletsVisualSchema = z.object({
  kind: z.literal("bullets"),
  items: z
    .array(z.string().min(3).max(120))
    .min(3)
    .max(6)
    .describe("Three to five short points."),
});

const noneVisualSchema = z.object({
  kind: z.literal("none"),
});

export const sectionVisualSchema = z.discriminatedUnion("kind", [
  tableVisualSchema,
  stepsVisualSchema,
  rolesVisualSchema,
  accordionVisualSchema,
  tabsVisualSchema,
  codeVisualSchema,
  bulletsVisualSchema,
  noneVisualSchema,
]);
export type SectionVisual = z.infer<typeof sectionVisualSchema>;

const sectionHeadingSchema = z
  .string()
  .min(3)
  .max(60)
  .describe(
    "A concrete two-to-six-word heading such as 'How PubSub Works'. Never 'Introduction', 'Overview', or 'Conclusion'.",
  );

export const lessonSectionSchema = z.object({
  heading: sectionHeadingSchema,
  body_markdown: z
    .string()
    .min(60)
    .max(900)
    .describe(
      "35-90 words of Markdown for this section: one short paragraph, two or three sentences.",
    ),
  visual: sectionVisualSchema,
});
export type LessonSection = z.infer<typeof lessonSectionSchema>;

export const lessonClosingSchema = z.object({
  kind: z
    .enum(["summary", "boundary"])
    .describe(
      "Use 'boundary' for most lessons ('when not to use this'). Use 'summary' only for the final lesson of a unit or course.",
    ),
  heading: sectionHeadingSchema,
  body_markdown: z
    .string()
    .min(40)
    .max(600)
    .describe("25-70 words that either summarise the unit or draw a boundary."),
});
export type LessonClosing = z.infer<typeof lessonClosingSchema>;

export const realWorldSchema = z.object({
  title: z.string().min(5).max(90),
  description: z
    .string()
    .min(40)
    .max(400)
    .describe("How this idea appears in real systems or work. Keep it under 220 characters when possible."),
  link: z
    .object({
      label: z.string().min(2).max(70),
      url: z
        .string()
        .max(500)
        .describe("A real, stable URL such as official docs or Wikipedia."),
    })
    .nullable()
    .describe("Omit or set null when you are not confident the URL exists."),
  code: z
    .object({
      language: z.string().min(1).max(24),
      code: z.string().min(10).max(1200),
    })
    .nullable()
    .describe("A short illustrative snippet, only when it clarifies the idea."),
  try_this: z
    .string()
    .min(20)
    .max(300)
    .describe("One small practical action the learner can do right now. Keep it under 180 characters when possible."),
});
export type RealWorld = z.infer<typeof realWorldSchema>;

export const lessonSchema = z.object({
  promise: z
    .string()
    .min(30)
    .max(180)
    .describe(
      "The lesson's angle in one sentence of 12-25 words. Promise an outcome, do not describe the lesson.",
    ),
  hero_image_query: z
    .string()
    .min(2)
    .max(60)
    .describe("Two to five concrete keywords for a topical header photo."),
  focus_concept_ids: z
    .array(z.string().min(1).max(40))
    .min(1)
    .max(3)
    .describe(
      "One to three ids from the course's core concepts. Do not invent new concepts.",
    ),
  sections: z
    .array(lessonSectionSchema)
    .min(2)
    .max(3)
    .describe(
      "Two or three teaching sections. At least one must use the 'table' visual. Never repeat the same visual kind in consecutive sections. Weave real-world usage and 'when not to use it' boundaries into these sections.",
    ),
  assignment: z
    .string()
    .min(20)
    .max(240)
    .describe(
      "One small practical task the learner can do after the lesson. One or two sentences.",
    ),
  questions: z
    .array(questionDraftSchema)
    .min(4)
    .max(6)
    .describe(
      "Four to six questions using at least two types. Put 1-2 inline and at least 2 in the final quiz.",
    ),
});
export type LessonResult = z.infer<typeof lessonSchema>;

export type AnalyzeInput = {
  prompt: string;
  mode: "normal" | "deep";
};

export type StoredQuestionOption = { id: string; text: string };

import { describe, expect, it } from "vitest";
import fixture from "./fixtures/lesson-valid.json";
import courseConcepts from "./fixtures/course-concepts.json";
import { lessonSchema, type CoreConcept, type LessonResult } from "@/ai/schemas";
import {
  answerMentionedInContent,
  bodyWordCount,
  countSentences,
  isGroundingLintError,
  isSoftLintError,
  lintLesson,
} from "@/quiz/lint";

const valid = lessonSchema.parse(fixture) as LessonResult;

const context = {
  hasSequence: true,
  objectives: [
    "Explain what photosynthesis produces",
    "Describe the light reactions",
    "Describe the Calvin cycle",
  ],
  concepts: courseConcepts as CoreConcept[],
};

describe("lintLesson", () => {
  it("accepts the recorded fixture", () => {
    expect(bodyWordCount(valid)).toBeGreaterThanOrEqual(140);
    expect(lintLesson(valid, context)).toEqual([]);
  });

  it("requires at least one comparison table", () => {
    const broken = structuredClone(valid);
    broken.sections = broken.sections.map((section) =>
      section.visual.kind === "table"
        ? {
            ...section,
            visual: { kind: "bullets" as const, items: ["one", "two", "three"] },
          }
        : section,
    );
    const errors = lintLesson(broken, context);
    expect(errors.some((error) => error.includes("comparison table"))).toBe(
      true,
    );
  });

  it("rejects consecutive sections with the same visual kind", () => {
    const broken = structuredClone(valid);
    broken.sections[1].visual = {
      kind: "table",
      columns: ["Aspect", "Left"],
      rows: [["One", "Two"]],
    };
    const errors = lintLesson(broken, context);
    expect(errors.some((error) => error.includes("consecutive"))).toBe(true);
  });

  it("rejects generic section headings", () => {
    const broken = structuredClone(valid);
    broken.sections[0].heading = "Introduction";
    const errors = lintLesson(broken, context);
    expect(errors.some((error) => error.includes("too generic"))).toBe(true);
  });

  it("rejects order questions when has_sequence is false", () => {
    const errors = lintLesson(valid, { ...context, hasSequence: false });
    expect(errors.some((error) => error.includes("has_sequence"))).toBe(true);
  });

  it("rejects duplicate option text", () => {
    const broken = structuredClone(valid);
    const question = broken.questions.find(
      (item) => item.type === "radio",
    );
    if (!question || question.type !== "radio") throw new Error("fixture");
    question.options[1] = question.options[0];
    const errors = lintLesson(broken, context);
    expect(errors.some((error) => error.includes("duplicate option"))).toBe(
      true,
    );
  });

  it("rejects correct answers that are absent from the body", () => {
    const broken = structuredClone(valid);
    const question = broken.questions.find(
      (item) => item.type === "radio",
    );
    if (!question || question.type !== "radio") throw new Error("fixture");
    question.options[0] = "A phrase that never appears in the lesson";
    const errors = lintLesson(broken, context);
    expect(
      errors.some((error) => error.includes("not stated in the lesson text")),
    ).toBe(true);
  });

  it("rejects order items that appear out of sequence", () => {
    const broken = structuredClone(valid);
    const question = broken.questions.find(
      (item) => item.type === "order",
    );
    if (!question || question.type !== "order") throw new Error("fixture");
    question.items.reverse();
    const errors = lintLesson(broken, context);
    expect(
      errors.some((error) => error.includes("correct sequence")),
    ).toBe(true);
  });

  it("rejects negation stems and all-of-the-above options", () => {
    const broken = structuredClone(valid);
    const radio = broken.questions.find((item) => item.type === "radio");
    if (!radio || radio.type !== "radio") throw new Error("fixture");
    radio.prompt = "Which of these is NOT a product of photosynthesis?";
    radio.options[1] = "All of the above";
    const errors = lintLesson(broken, context);
    expect(errors.some((error) => error.includes("negations"))).toBe(true);
    expect(
      errors.some((error) => error.includes("all/none of the above")),
    ).toBe(true);
  });

  it("rejects quizzes with fewer than two question types", () => {
    const broken = structuredClone(valid);
    broken.questions = broken.questions
      .filter((item) => item.type === "radio")
      .concat(
        broken.questions
          .filter((item) => item.type === "radio")
          .map((item) => ({ ...item, prompt: `${item.prompt} (again)` })),
      )
      .slice(0, 4);
    const errors = lintLesson(broken, context);
    expect(
      errors.some((error) => error.includes("two different question types")),
    ).toBe(true);
  });

  it("counts sentences without tripping on quotes, decimals, or abbreviations", () => {
    expect(
      countSentences(
        "The lesson says 'coverage is useful.' However, it is not a guarantee.",
      ),
    ).toBe(2);
    expect(countSentences("Coverage reached 80.5 percent. That is enough.")).toBe(
      2,
    );
    expect(countSentences("Use a runner, e.g. pytest. Then inspect failures.")).toBe(
      2,
    );
    expect(countSentences("One. Two. Three.")).toBe(3);
  });

  it("matches paraphrased answers but not untaught scenarios", () => {
    const paraphrase =
      "A test failure shows the expected value and the actual value received. " +
      "This comparison between expected and actual results is your primary " +
      "diagnostic tool; the function returns both.";
    expect(
      answerMentionedInContent(
        "The expected value compared to the actual value returned",
        paraphrase,
      ),
    ).toBe(true);

    const edgeCases =
      "Edge cases include empty lists and very large values. Passing a string " +
      "when an integer is expected is a type mismatch.";
    expect(
      answerMentionedInContent("Passing a list with one element", edgeCases),
    ).toBe(false);
  });

  it("allows paraphrase grounding warnings but not missing order items", () => {
    expect(
      isGroundingLintError(
        "Q1 (radio): the correct answer is not stated in the lesson text.",
      ),
    ).toBe(true);
    expect(
      isGroundingLintError(
        'Q4 (order): item "First step" is not stated in the lesson text.',
      ),
    ).toBe(false);
  });

  it("treats prose-length issues as soft and grounding issues as hard", () => {
    expect(
      isSoftLintError(
        "Style: body prose is 300 words; it must be 160-240 words.",
      ),
    ).toBe(true);
    expect(
      isSoftLintError("Q1 (radio): explanation is longer than two sentences."),
    ).toBe(true);
    expect(
      isSoftLintError(
        "Q1 (radio): the correct answer is not stated in the lesson text.",
      ),
    ).toBe(false);
  });
});

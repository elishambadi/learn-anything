import { describe, expect, it } from "vitest";
import fixture from "./fixtures/lesson-valid.json";
import {
  analyzeSchema,
  decomposeSchema,
  lessonSchema,
  outlineSchema,
  questionDraftSchema,
} from "@/ai/schemas";

describe("schemas", () => {
  it("accepts the recorded lesson fixture", () => {
    const parsed = lessonSchema.parse(fixture);
    expect(parsed.questions).toHaveLength(4);
    expect(parsed.sections).toHaveLength(3);
    expect(parsed.sections.map((section) => section.body_markdown).join(" ")).toContain(
      "registration",
    );
    expect(parsed.focus_concept_ids).toHaveLength(2);
    expect(
      parsed.sections.some((section) => section.visual.kind === "table"),
    ).toBe(true);
    expect(parsed.assignment).toContain("Map one");
    expect(parsed.questions.filter((question) => question.placement === "inline")).toHaveLength(1);
  });

  it("rejects a quiz with too few questions", () => {
    const broken = { ...fixture, questions: fixture.questions.slice(0, 2) };
    expect(lessonSchema.safeParse(broken).success).toBe(false);
  });

  it("rejects a radio question with the wrong number of options", () => {
    expect(
      questionDraftSchema.safeParse({
        type: "radio",
        prompt: "Pick one of these.",
        options: ["Only one"],
        correct_index: 0,
        explanation: "Because of the lesson.",
        difficulty: "easy",
        placement: "final",
      }).success,
    ).toBe(false);
  });

  it("parses the analyze, decompose, and outline contracts", () => {
    expect(
      analyzeSchema.parse({
        summary: "A topic summary long enough to pass the minimum length.",
        audience: "Curious adults with no prior background.",
        objectives: ["Explain one", "Explain two", "Explain three"],
        suggested_lesson_count: 5,
      }).suggested_lesson_count,
    ).toBe(5);

    expect(
      decomposeSchema.parse({
        subtopics: [
          {
            title: "First",
            summary: "A summary that is long enough to pass.",
            objectives: ["Explain the first idea", "Apply the first idea"],
          },
          {
            title: "Second",
            summary: "Another summary that is long enough.",
            objectives: ["Explain the second idea", "Apply the second idea"],
          },
          {
            title: "Third",
            summary: "A third summary that is long enough.",
            objectives: ["Explain the third idea", "Apply the third idea"],
          },
        ],
      }).subtopics,
    ).toHaveLength(3);

    expect(
      outlineSchema.parse({
        lessons: Array.from({ length: 4 }, (_, index) => ({
          title: `Lesson ${index + 1}`,
          objectives: ["Objective one here", "Objective two here"],
          has_sequence: index === 0,
        })),
      }).lessons,
    ).toHaveLength(4);
  });
});

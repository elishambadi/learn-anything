import { describe, expect, it } from "vitest";
import type { LessonRow, QuestionRow } from "@/db/schema";
import { toPublicLesson, toPublicQuestion } from "@/quiz/serialize";

const lesson: LessonRow = {
  id: "lesson-1",
  topicId: "topic-1",
  subtopicId: null,
  position: 0,
  title: "Photosynthesis",
  objectivesJson: JSON.stringify(["Explain the inputs and outputs"]),
  hasSequence: true,
  summary: "A short summary.",
  heroQuery: "plants light",
  coreConceptsJson: JSON.stringify([{ title: "Light", description: "Plants capture light energy.", icon: "lightbulb" }]),
  sectionsJson: JSON.stringify([
    {
      heading: "How light works",
      body_markdown: "Plants capture light.",
      visual: {
        kind: "table",
        columns: ["In", "Out"],
        rows: [["Light", "Glucose"]],
      },
    },
  ]),
  closingJson: JSON.stringify({
    kind: "summary",
    heading: "Course Summary",
    body_markdown: "Light becomes sugar.",
  }),
  comparisonJson: JSON.stringify({ title: "Inputs and outputs", columns: ["In", "Out"], rows: [["Light", "Glucose"]] }),
  realWorldJson: JSON.stringify({ title: "A greenhouse", description: "Growers use light and carbon dioxide to increase yield.", link: null, code: null, try_this: "Look at a leaf in sunlight." }),
  contentMd: "# Photosynthesis\n\nPlants use light.",
  assignment: "Look at a leaf in sunlight.",
  completedAt: null,
  status: "ready",
  error: null,
  model: "claude-haiku-4-5",
  inputTokens: 100,
  outputTokens: 200,
};

const question: QuestionRow = {
  id: "question-1",
  lessonId: "lesson-1",
  position: 0,
  type: "radio",
  prompt: "What powers photosynthesis?",
  optionsJson: JSON.stringify([
    { id: "a", text: "Light" },
    { id: "b", text: "Gravity" },
  ]),
  answerJson: JSON.stringify({ optionId: "a" }),
  explanation: "Light is captured by chlorophyll.",
  difficulty: "easy",
  placement: "final",
};

describe("read serializers", () => {
  it("strips answers and explanations from public questions", () => {
    const publicQuestion = toPublicQuestion(question);
    expect(publicQuestion).not.toHaveProperty("answerJson");
    expect(publicQuestion).not.toHaveProperty("answer_json");
    expect(publicQuestion).not.toHaveProperty("explanation");
    expect(publicQuestion.options).toHaveLength(2);
  });

  it("never leaks answer_json or explanations in a lesson payload", () => {
    const payload = toPublicLesson(lesson, [question]);
    const json = JSON.stringify(payload);
    expect(json).not.toContain("answer_json");
    expect(json).not.toContain("answerJson");
    expect(json).not.toContain("explanation");
    expect(json).not.toContain("Light is captured by chlorophyll");
    expect(payload.contentMarkdown).toContain("Plants use light.");
    expect(payload.promise).toBe("A short summary.");
    expect(payload.sections).toHaveLength(1);
    expect(payload.sections[0].visual.kind).toBe("table");
    expect(payload.closing?.heading).toBe("Course Summary");
    expect(payload.coreConcepts).toHaveLength(1);
    expect(payload.realWorld?.title).toBe("A greenhouse");
    expect(payload.questions).toHaveLength(1);
  });

  it("does not expose the correct option through a stray field", () => {
    const payload = toPublicLesson(lesson, [question]);
    const keys = Object.keys(payload.questions[0]).sort();
    expect(keys).toEqual([
      "difficulty",
      "id",
      "options",
      "placement",
      "position",
      "prompt",
      "type",
    ]);
  });
});

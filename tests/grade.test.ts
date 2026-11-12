import { describe, expect, it } from "vitest";
import { grade, normalizeResponse } from "@/quiz/grade";

describe("grade", () => {
  it("grades true/false", () => {
    const question = {
      type: "true_false" as const,
      optionsJson: JSON.stringify([
        { id: "true", text: "True" },
        { id: "false", text: "False" },
      ]),
      answerJson: JSON.stringify({ value: true }),
    };
    expect(grade(question, true)).toEqual({
      isCorrect: true,
      correctAnswer: { value: true },
    });
    expect(grade(question, { value: false }).isCorrect).toBe(false);
    expect(grade(question, null).isCorrect).toBe(false);
    expect(normalizeResponse(question, "true")).toEqual({ value: true });
  });

  it("grades radio by option id", () => {
    const question = {
      type: "radio" as const,
      optionsJson: JSON.stringify([
        { id: "a", text: "Wrong" },
        { id: "b", text: "Right" },
      ]),
      answerJson: JSON.stringify({ optionId: "b" }),
    };
    expect(grade(question, "b").isCorrect).toBe(true);
    expect(grade(question, { optionId: "b" }).isCorrect).toBe(true);
    expect(grade(question, "a").isCorrect).toBe(false);
    expect(grade(question, undefined).isCorrect).toBe(false);
  });

  it("grades multi all-or-nothing, ignoring order", () => {
    const question = {
      type: "multi" as const,
      optionsJson: JSON.stringify([
        { id: "a", text: "One" },
        { id: "b", text: "Two" },
        { id: "c", text: "Three" },
        { id: "d", text: "Four" },
      ]),
      answerJson: JSON.stringify({ optionIds: ["a", "c"] }),
    };
    expect(grade(question, ["c", "a"]).isCorrect).toBe(true);
    expect(grade(question, ["a"]).isCorrect).toBe(false);
    expect(grade(question, ["a", "b", "c"]).isCorrect).toBe(false);
    expect(grade(question, ["a", "b"]).isCorrect).toBe(false);
  });

  it("grades order by exact sequence", () => {
    const question = {
      type: "order" as const,
      optionsJson: JSON.stringify([
        { id: "a", text: "One" },
        { id: "b", text: "Two" },
        { id: "c", text: "Three" },
      ]),
      answerJson: JSON.stringify({ itemIds: ["c", "a", "b"] }),
    };
    expect(grade(question, ["c", "a", "b"]).isCorrect).toBe(true);
    expect(grade(question, { itemIds: ["c", "a", "b"] }).isCorrect).toBe(true);
    expect(grade(question, ["a", "c", "b"]).isCorrect).toBe(false);
    expect(grade(question, ["c", "a"]).isCorrect).toBe(false);
  });

  it("does not trust client-provided correctness", () => {
    const question = {
      type: "radio" as const,
      optionsJson: JSON.stringify([{ id: "a", text: "Wrong" }]),
      answerJson: JSON.stringify({ optionId: "a" }),
    };
    expect(
      grade(question, { optionId: "b", isCorrect: true }).isCorrect,
    ).toBe(false);
  });
});

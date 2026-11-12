import { describe, expect, it } from "vitest";
import { storeQuestion } from "@/quiz/shuffle";
import type { StoredQuestionOption } from "@/ai/schemas";

function read(stored: { optionsJson: string; answerJson: string }) {
  return {
    options: JSON.parse(stored.optionsJson) as StoredQuestionOption[],
    answer: JSON.parse(stored.answerJson) as Record<string, unknown>,
  };
}

describe("storeQuestion", () => {
  it("shuffles radio options but keeps the answer pointing at the right text", () => {
    const draft = {
      type: "radio" as const,
      prompt: "Which one is correct?",
      options: ["Alpha", "Beta", "Gamma", "Delta"],
      correct_index: 2,
      explanation: "Gamma is the correct choice.",
      difficulty: "easy" as const,
      placement: "final" as const,
    };
    for (let round = 0; round < 20; round += 1) {
      const { options, answer } = read(storeQuestion(draft, 0));
      expect(options).toHaveLength(4);
      expect(options.map((option) => option.text).sort()).toEqual(
        [...draft.options].sort(),
      );
      const correctId = answer.optionId as string;
      expect(options.find((option) => option.id === correctId)?.text).toBe(
        "Gamma",
      );
    }
  });

  it("shuffles multi options and remaps every correct id", () => {
    const draft = {
      type: "multi" as const,
      prompt: "Select the true statements.",
      options: ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"],
      correct_indices: [0, 2, 4],
      explanation: "Alpha, Gamma, and Epsilon are true.",
      difficulty: "medium" as const,
      placement: "final" as const,
    };
    for (let round = 0; round < 20; round += 1) {
      const { options, answer } = read(storeQuestion(draft, 0));
      const ids = answer.optionIds as string[];
      const texts = ids.map(
        (id) => options.find((option) => option.id === id)?.text,
      );
      expect(texts.sort()).toEqual(["Alpha", "Epsilon", "Gamma"]);
    }
  });

  it("scrambles order options while keeping answer ids in the correct sequence", () => {
    const items = ["First", "Second", "Third", "Fourth"];
    const draft = {
      type: "order" as const,
      prompt: "Put these in order.",
      items,
      explanation: "They happen in this order.",
      difficulty: "hard" as const,
      placement: "final" as const,
    };
    for (let round = 0; round < 30; round += 1) {
      const { options, answer } = read(storeQuestion(draft, 0));
      const ids = answer.itemIds as string[];
      const sequence = ids.map(
        (id) => options.find((option) => option.id === id)?.text,
      );
      expect(sequence).toEqual(items);
      expect(options.map((option) => option.text)).not.toEqual(items);
    }
  });

  it("stores true/false with stable ids and a boolean answer", () => {
    const draft = {
      type: "true_false" as const,
      prompt: "This is a falsifiable statement.",
      answer: false,
      explanation: "It is false because of the evidence.",
      difficulty: "easy" as const,
      placement: "final" as const,
    };
    const { options, answer } = read(storeQuestion(draft, 3));
    expect(options).toEqual([
      { id: "true", text: "True" },
      { id: "false", text: "False" },
    ]);
    expect(answer).toEqual({ value: false });
  });
});

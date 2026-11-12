import { randomUUID } from "node:crypto";
import type {
  Difficulty,
  QuestionDraft,
  QuestionPlacement,
  QuestionType,
  StoredQuestionOption,
} from "@/ai/schemas";

export const OPTION_IDS = ["a", "b", "c", "d", "e"] as const;

export type StoredQuestionDraft = {
  id: string;
  position: number;
  type: QuestionType;
  prompt: string;
  optionsJson: string;
  answerJson: string;
  explanation: string;
  difficulty: Difficulty;
  placement: QuestionPlacement;
};

function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function withIds(options: string[]): StoredQuestionOption[] {
  return options.map((text, index) => ({ id: OPTION_IDS[index], text }));
}

/**
 * Turn a model-authored question into the stored form. Options are shuffled
 * here, at write time, so the browser can render them verbatim without needing
 * a seed or leaking which one is correct.
 */
export function storeQuestion(
  draft: QuestionDraft,
  position: number,
): StoredQuestionDraft {
  const base = {
    id: randomUUID(),
    position,
    type: draft.type,
    prompt: draft.prompt,
    explanation: draft.explanation,
    difficulty: draft.difficulty,
    placement: draft.placement,
  };

  if (draft.type === "true_false") {
    return {
      ...base,
      optionsJson: JSON.stringify([
        { id: "true", text: "True" },
        { id: "false", text: "False" },
      ] satisfies StoredQuestionOption[]),
      answerJson: JSON.stringify({ value: draft.answer }),
    };
  }

  if (draft.type === "radio") {
    const tagged = draft.options.map((text, index) => ({
      text,
      correct: index === draft.correct_index,
    }));
    const mixed = shuffled(tagged);
    const options = withIds(mixed.map((option) => option.text));
    const correct = options[mixed.findIndex((option) => option.correct)];
    return {
      ...base,
      optionsJson: JSON.stringify(options),
      answerJson: JSON.stringify({ optionId: correct.id }),
    };
  }

  if (draft.type === "multi") {
    const correctSet = new Set(draft.correct_indices);
    const tagged = draft.options.map((text, index) => ({
      text,
      correct: correctSet.has(index),
    }));
    const mixed = shuffled(tagged);
    const options = withIds(mixed.map((option) => option.text));
    const optionIds = options
      .filter((_, index) => mixed[index].correct)
      .map((option) => option.id);
    return {
      ...base,
      optionsJson: JSON.stringify(options),
      answerJson: JSON.stringify({ optionIds }),
    };
  }

  // order: items arrive in the correct order. Scramble them for storage and
  // keep the answer as the id sequence.
  const tagged = draft.items.map((text, correctIndex) => ({
    text,
    correctIndex,
  }));
  let mixed = shuffled(tagged);
  if (mixed.every((item, index) => item.correctIndex === index)) {
    mixed = [...mixed.slice(1), mixed[0]];
  }
  const options = withIds(mixed.map((item) => item.text));
  const idForCorrectIndex = new Map<number, string>();
  mixed.forEach((item, index) => {
    idForCorrectIndex.set(item.correctIndex, options[index].id);
  });
  const itemIds = draft.items.map((_, index) => idForCorrectIndex.get(index)!);

  return {
    ...base,
    optionsJson: JSON.stringify(options),
    answerJson: JSON.stringify({ itemIds }),
  };
}

export function storeQuestions(
  drafts: QuestionDraft[],
): StoredQuestionDraft[] {
  return drafts.map((draft, index) => storeQuestion(draft, index));
}

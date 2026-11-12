import type { StoredQuestionOption } from "@/ai/schemas";

export type GradableQuestion = {
  type: "true_false" | "radio" | "multi" | "order";
  optionsJson: string;
  answerJson: string;
};

export type GradeResult = {
  isCorrect: boolean;
  correctAnswer: unknown;
};

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

/**
 * Normalise the response shapes a browser may send into the canonical shape
 * used for grading. Never trust an `is_correct` sent by the client.
 */
export function normalizeResponse(
  question: GradableQuestion,
  response: unknown,
): unknown {
  if (question.type === "true_false") {
    if (typeof response === "boolean") return { value: response };
    if (
      response &&
      typeof response === "object" &&
      "value" in response &&
      typeof (response as { value: unknown }).value === "boolean"
    ) {
      return { value: (response as { value: boolean }).value };
    }
    if (response === "true") return { value: true };
    if (response === "false") return { value: false };
    return { value: null };
  }

  if (question.type === "radio") {
    if (typeof response === "string") return { optionId: response };
    if (
      response &&
      typeof response === "object" &&
      "optionId" in response &&
      typeof (response as { optionId: unknown }).optionId === "string"
    ) {
      return { optionId: (response as { optionId: string }).optionId };
    }
    return { optionId: null };
  }

  if (question.type === "multi") {
    const ids = Array.isArray(response)
      ? asStringArray(response)
      : response && typeof response === "object" && "optionIds" in response
        ? asStringArray((response as { optionIds: unknown }).optionIds)
        : [];
    return { optionIds: ids };
  }

  const ids = Array.isArray(response)
    ? asStringArray(response)
    : response && typeof response === "object" && "itemIds" in response
      ? asStringArray((response as { itemIds: unknown }).itemIds)
      : [];
  return { itemIds: ids };
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((item) => set.has(item));
}

export function grade(
  question: GradableQuestion,
  response: unknown,
): GradeResult {
  const correct = parseJson<Record<string, unknown>>(question.answerJson, {});
  const normalised = normalizeResponse(question, response);

  if (question.type === "true_false") {
    const value = (normalised as { value: boolean | null }).value;
    return {
      isCorrect: value !== null && value === correct.value,
      correctAnswer: correct,
    };
  }

  if (question.type === "radio") {
    const optionId = (normalised as { optionId: string | null }).optionId;
    return {
      isCorrect:
        typeof optionId === "string" &&
        typeof correct.optionId === "string" &&
        optionId === correct.optionId,
      correctAnswer: correct,
    };
  }

  if (question.type === "multi") {
    const optionIds = (normalised as { optionIds: string[] }).optionIds;
    const expected = asStringArray(correct.optionIds);
    return {
      isCorrect: sameSet(optionIds, expected),
      correctAnswer: correct,
    };
  }

  const itemIds = (normalised as { itemIds: string[] }).itemIds;
  const expected = asStringArray(correct.itemIds);
  const exact =
    itemIds.length === expected.length &&
    itemIds.every((id, index) => id === expected[index]);
  return { isCorrect: exact, correctAnswer: correct };
}

export function optionsOf(question: {
  optionsJson: string;
}): StoredQuestionOption[] {
  return parseJson<StoredQuestionOption[]>(question.optionsJson, []);
}

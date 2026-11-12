import type { LessonRow, QuestionRow } from "@/db/schema";
import type {
  Comparison,
  CoreConcept,
  LessonClosing,
  LessonSection,
  QuestionPlacement,
  RealWorld,
  StoredQuestionOption,
} from "@/ai/schemas";
import { optionsOf } from "./grade";

export type PublicQuestion = {
  id: string;
  position: number;
  type: QuestionRow["type"];
  prompt: string;
  options: StoredQuestionOption[];
  difficulty: QuestionRow["difficulty"];
  placement: QuestionPlacement;
};

export type PublicLesson = {
  id: string;
  topicId: string;
  subtopicId: string | null;
  position: number;
  title: string;
  objectives: string[];
  hasSequence: boolean;
  promise: string;
  heroQuery: string | null;
  coreConcepts: CoreConcept[];
  courseConcepts: CoreConcept[];
  sections: LessonSection[];
  closing: LessonClosing | null;
  /** Legacy rows rendered as one Markdown body. New lessons use `sections`. */
  comparison: Comparison | null;
  realWorld: RealWorld | null;
  contentMarkdown: string;
  assignment: string | null;
  completedAt: Date | null;
  status: LessonRow["status"];
  questions: PublicQuestion[];
};

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function parseObjectives(raw: string): string[] {
  return parseJson<string[]>(raw, []).filter(
    (item): item is string => typeof item === "string",
  );
}

/**
 * The security boundary. `answer_json` and `explanation` are stripped here and
 * must never be added back in a component.
 */
export function toPublicQuestion(question: QuestionRow): PublicQuestion {
  return {
    id: question.id,
    position: question.position,
    type: question.type,
    prompt: question.prompt,
    options: optionsOf(question),
    difficulty: question.difficulty,
    placement: question.placement,
  };
}

export function toPublicLesson(
  lesson: LessonRow,
  questionRows: QuestionRow[],
  courseConcepts: CoreConcept[] = [],
): PublicLesson {
  const realWorld = parseJson<RealWorld | null>(lesson.realWorldJson, null);
  return {
    id: lesson.id,
    topicId: lesson.topicId,
    subtopicId: lesson.subtopicId,
    position: lesson.position,
    title: lesson.title,
    objectives: parseObjectives(lesson.objectivesJson),
    hasSequence: lesson.hasSequence,
    promise: lesson.summary ?? "",
    heroQuery: lesson.heroQuery,
    coreConcepts: parseJson<CoreConcept[]>(lesson.coreConceptsJson, []),
    courseConcepts,
    sections: parseJson<LessonSection[]>(lesson.sectionsJson, []),
    closing: parseJson<LessonClosing | null>(lesson.closingJson, null),
    comparison: parseJson<Comparison | null>(lesson.comparisonJson, null),
    realWorld,
    contentMarkdown: lesson.contentMd ?? "",
    assignment: lesson.assignment ?? realWorld?.try_this ?? null,
    completedAt: lesson.completedAt,
    status: lesson.status,
    questions: questionRows.map(toPublicQuestion),
  };
}

import type {
  CoreConcept,
  LessonResult,
  QuestionDraft,
  SectionVisual,
} from "@/ai/schemas";

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "is",
  "are",
  "was",
  "were",
  "be",
  "by",
  "as",
  "at",
  "that",
  "this",
  "it",
  "its",
  "from",
  "into",
  "than",
  "then",
  "when",
  "which",
  "you",
  "your",
  "can",
  "will",
  "does",
  "did",
  "has",
  "have",
  "who",
  "what",
  "why",
  "how",
]);

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_>#]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function words(text: string): string[] {
  return normalise(text).split(" ").filter(Boolean);
}

/** Rough word count that ignores fenced code blocks and markdown furniture. */
export function contentWordCount(markdown: string): number {
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, " ");
  return words(withoutCode).length;
}

/** Every string the learner reads inside a section visual. */
export function visualTexts(visual: SectionVisual): string[] {
  switch (visual.kind) {
    case "table":
      return [...visual.columns, ...visual.rows.flat()];
    case "steps":
    case "roles":
    case "accordion":
    case "tabs":
      return visual.items.flatMap((item) => [item.title, item.text]);
    case "code":
      return [visual.language, visual.code];
    case "bullets":
      return visual.items;
    case "none":
      return [];
  }
}

/** All prose the learner reads, used for grounding checks and the total budget. */
export function lessonText(
  lesson: LessonResult,
  concepts: CoreConcept[],
): string {
  return [
    lesson.promise,
    ...lesson.sections.flatMap((section) => [
      section.heading,
      section.body_markdown,
      ...visualTexts(section.visual),
    ]),
    lesson.assignment,
    ...concepts.flatMap((concept) => [concept.title, concept.description]),
  ].join("\n\n");
}

/** Body prose: every section body. */
export function bodyWordCount(lesson: LessonResult): number {
  return lesson.sections.reduce(
    (total, section) => total + contentWordCount(section.body_markdown),
    0,
  );
}

export function lessonWordCount(
  lesson: LessonResult,
  concepts: CoreConcept[],
): number {
  return (
    words(lesson.promise).length +
    lesson.sections.reduce(
      (total, section) =>
        total +
        words(section.heading).length +
        contentWordCount(section.body_markdown) +
        visualTexts(section.visual).reduce(
          (sum, text) => sum + words(text).length,
          0,
        ),
      0,
    ) +
    words(lesson.assignment).length +
    concepts.reduce(
      (total, concept) =>
        total + words(concept.title).length + words(concept.description).length,
      0,
    )
  );
}

function optionTexts(question: QuestionDraft): string[] {
  if (question.type === "radio" || question.type === "multi") {
    return question.options;
  }
  if (question.type === "order") return question.items;
  return [];
}

function mentionedInContent(
  text: string,
  normalisedContent: string,
): boolean {
  const normalisedText = normalise(text);
  if (!normalisedText) return true;
  if (normalisedContent.includes(normalisedText)) return true;

  const contentWords = new Set(words(normalisedContent).map(stem));
  const meaningful = words(normalisedText).filter(
    (word) => word.length > 3 && !STOP_WORDS.has(word),
  );
  if (meaningful.length < 3) return false;
  const hits = meaningful.filter((word) => contentWords.has(stem(word))).length;
  return hits / meaningful.length >= 0.7;
}

/** Small suffix stripper so "compared"/"comparison" and "returned"/"returns" match. */
function stem(word: string): string {
  if (word.length > 5 && word.endsWith("ing")) return word.slice(0, -3);
  if (word.length > 5 && word.endsWith("ion")) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith("ed")) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith("es")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s")) return word.slice(0, -1);
  return word;
}

/**
 * Count sentences without treating decimals, abbreviations, or a closing quote
 * as an extra sentence.
 */
export function countSentences(text: string): number {
  const cleaned = text
    .replace(/\b(e\.g|i\.e|etc|vs|approx|Mr|Mrs|Ms|Dr|Prof|Fig|No)\./gi, "$1")
    .replace(/(\d)\.(\d)/g, "$1$2")
    .replace(/["'”’)\]]+(?=\s|$)/g, "");
  const endings = cleaned.match(/[.!?](?=\s+[A-Z]|\s*$)/g);
  return Math.max(1, endings?.length ?? 0);
}

export function answerMentionedInContent(
  answer: string,
  content: string,
): boolean {
  return mentionedInContent(answer, normalise(content));
}

/** Style warnings are logged but never trigger a paid repair. */
export function isSoftLintError(error: string): boolean {
  return (
    error.startsWith("Style:") ||
    error.includes("explanation is longer than two sentences")
  );
}

export function isGroundingLintError(error: string): boolean {
  return (
    error.includes("the correct answer is not stated in the lesson text") ||
    (error.includes("correct option") &&
      error.includes("is not stated in the lesson text"))
  );
}

const BANNED_SECTION_HEADINGS =
  /^(introduction|overview|key points|summary|conclusion|wrap[- ]?up|final thoughts|real world|when not to use it)$/i;
const META_OPENER =
  /^(in this lesson|this lesson|now that we|as we(?:'ve| have)? seen|let'?s (?:dive|look|explore)|in conclusion|to sum up)/i;
const CONSEQUENCE =
  /\b(?:if|when|without|otherwise)\b[^.!?]{0,160}\b(?:fail|fails|crash|crashes|hang|hangs|wait|waits|duplicate|duplicates|overflow|block|blocks|stale|drop|drops|lost|error|errors|slow|stuck)\b/i;

function sentencesOf(text: string): string[] {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .match(/[^.!?]+[.!?]*/g)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) ?? [];
}

function paragraphsOf(markdown: string): string[] {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/^[#>\-*\d.\s]+/, "").trim())
    .filter(Boolean);
}

function styleWarnings(text: string, label: string): string[] {
  const warnings: string[] = [];
  for (const sentence of sentencesOf(text)) {
    if (words(sentence).length > 25) {
      warnings.push(
        `Style: ${label} has a sentence longer than 25 words: "${sentence.slice(0, 70)}…"`,
      );
      break;
    }
  }
  for (const paragraph of paragraphsOf(text)) {
    if (words(paragraph).length > 60) {
      warnings.push(
        `Style: ${label} has a paragraph longer than 60 words; split or cut it.`,
      );
      break;
    }
  }
  return warnings;
}

function checkQuestion(
  question: QuestionDraft,
  index: number,
  content: string,
  hasSequence: boolean,
): string[] {
  const errors: string[] = [];
  const label = `Q${index + 1} (${question.type})`;
  if (question.prompt.length > 220) {
    errors.push(`${label}: stem is longer than 220 characters.`);
  }
  if (/\b(all|none)\s+of\s+the\s+above\b/i.test(question.prompt)) {
    errors.push(`${label}: stem uses an "all/none of the above" construction.`);
  }
  if (
    question.type !== "true_false" &&
    /\b(not|except|never)\b/i.test(question.prompt)
  ) {
    errors.push(`${label}: stems must not use negations.`);
  }
  if (countSentences(question.explanation) > 2) {
    errors.push(`${label}: explanation is longer than two sentences.`);
  }

  const texts = optionTexts(question);
  if (texts.some((text) => /\b(all|none)\s+of\s+the\s+above\b/i.test(text))) {
    errors.push(`${label}: options must not include "all/none of the above".`);
  }
  const seen = new Set<string>();
  for (const text of texts) {
    const key = normalise(text);
    if (seen.has(key)) {
      errors.push(`${label}: duplicate option text "${text}".`);
    }
    seen.add(key);
  }

  if (question.type === "radio") {
    if (question.options.length !== 4) {
      errors.push(`${label}: radio questions need exactly 4 options.`);
    }
    if (
      question.correct_index < 0 ||
      question.correct_index >= question.options.length
    ) {
      errors.push(`${label}: correct_index is out of range.`);
    } else if (
      !mentionedInContent(question.options[question.correct_index], content)
    ) {
      errors.push(
        `${label}: the correct answer is not stated in the lesson text.`,
      );
    }
  }

  if (question.type === "multi") {
    if (question.options.length < 4 || question.options.length > 5) {
      errors.push(`${label}: multi questions need 4-5 options.`);
    }
    const unique = new Set(question.correct_indices);
    if (unique.size !== question.correct_indices.length) {
      errors.push(`${label}: correct_indices contains duplicates.`);
    }
    if (unique.size < 2 || unique.size > 3) {
      errors.push(`${label}: multi questions need 2-3 correct options.`);
    }
    for (const correctIndex of question.correct_indices) {
      if (correctIndex < 0 || correctIndex >= question.options.length) {
        errors.push(`${label}: correct_indices is out of range.`);
        continue;
      }
      if (!mentionedInContent(question.options[correctIndex], content)) {
        errors.push(
          `${label}: correct option "${question.options[correctIndex]}" is not stated in the lesson text.`,
        );
      }
    }
  }

  if (question.type === "order") {
    if (!hasSequence) {
      errors.push(
        `${label}: order questions are only allowed when has_sequence is true.`,
      );
    }
    if (question.items.length < 3 || question.items.length > 5) {
      errors.push(`${label}: order questions need 3-5 items.`);
    }
    let lastPosition = -1;
    for (const item of question.items) {
      const position = content.indexOf(normalise(item));
      if (position === -1) {
        errors.push(`${label}: item "${item}" is not stated in the lesson text.`);
        continue;
      }
      if (position <= lastPosition) {
        errors.push(
          `${label}: order items do not appear in the lesson text in the correct sequence.`,
        );
      }
      lastPosition = position;
    }
  }

  return errors;
}

export type LintContext = {
  hasSequence: boolean;
  objectives: string[];
  concepts: CoreConcept[];
};

export function resolveFocusConcepts(
  focusConceptIds: string[],
  concepts: CoreConcept[],
): CoreConcept[] {
  const byId = new Map(concepts.map((concept) => [concept.id, concept]));
  return focusConceptIds
    .map((id) => byId.get(id))
    .filter((concept): concept is CoreConcept => Boolean(concept));
}

/**
 * Cheap quality gate over a generated lesson. No model call: hard failures
 * feed the repair path; style and prose-length issues are logged only.
 */
export function lintLesson(
  lesson: LessonResult,
  context: LintContext,
): string[] {
  const errors: string[] = [];

  const byId = new Map(
    context.concepts.map((concept) => [concept.id, concept]),
  );
  const missing = lesson.focus_concept_ids.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    errors.push(
      `focus_concept_ids references unknown course concepts: ${missing.join(", ")}.`,
    );
  }
  if (new Set(lesson.focus_concept_ids).size !== lesson.focus_concept_ids.length) {
    errors.push("focus_concept_ids contains duplicates.");
  }
  if (lesson.focus_concept_ids.length < 1 || lesson.focus_concept_ids.length > 3) {
    errors.push("The lesson must focus on 1-3 course concepts.");
  }

  // Shape: 2-3 sections, at least one comparison table, varied visuals.
  if (lesson.sections.length < 2 || lesson.sections.length > 3) {
    errors.push("The lesson must have 2-3 sections.");
  }
  const kinds = lesson.sections.map((section) => section.visual.kind);
  if (!kinds.includes("table")) {
    errors.push(
      'At least one section must use a comparison table (visual kind "table").',
    );
  }
  for (let index = 1; index < kinds.length; index += 1) {
    if (kinds[index] === kinds[index - 1] && kinds[index] !== "none") {
      errors.push(
        `Sections ${index} and ${index + 1} use the same visual kind "${kinds[index]}"; consecutive sections need different visuals.`,
      );
    }
  }
  if (kinds.filter((kind) => kind === "none").length > 1) {
    errors.push(
      'Only one section may use the "none" visual; give the others a structure.',
    );
  }

  lesson.sections.forEach((section, index) => {
    const label = `Section ${index + 1} ("${section.heading}")`;
    const headingWords = words(section.heading).length;
    if (headingWords < 2 || headingWords > 6) {
      errors.push(
        `${label}: heading is ${headingWords} words; headings must be 2-6 words.`,
      );
    }
    if (BANNED_SECTION_HEADINGS.test(section.heading.trim())) {
      errors.push(
        `${label}: heading is too generic; name the idea instead of using "${section.heading}".`,
      );
    }

    const sectionWords = contentWordCount(section.body_markdown);
    if (sectionWords < 30 || sectionWords > 100) {
      errors.push(
        `Style: ${label} body is ${sectionWords} words; it must be 35-90 words.`,
      );
    }

    if (section.visual.kind === "table") {
      const columnCount = section.visual.columns.length;
      section.visual.rows.forEach((row, rowIndex) => {
        if (row.length !== columnCount) {
          errors.push(
            `${label}: comparison row ${rowIndex + 1} has ${row.length} cells but there are ${columnCount} columns.`,
          );
        }
        row.forEach((cell) => {
          if (words(cell).length > 8) {
            errors.push(
              `${label}: table cell "${cell.slice(0, 40)}…" is longer than 8 words; keep cells to short phrases.`,
            );
          }
        });
      });
    }

    if (
      (section.visual.kind === "steps" ||
        section.visual.kind === "roles" ||
        section.visual.kind === "accordion" ||
        section.visual.kind === "tabs") &&
      section.visual.items.some((item) => words(item.text).length > 45)
    ) {
      errors.push(
        `${label}: a visual card is longer than 45 words; keep each card to one or two sentences.`,
      );
    }

    errors.push(...styleWarnings(section.body_markdown, label));
    if (
      index === 0 &&
      META_OPENER.test(section.body_markdown.trim())
    ) {
      errors.push(
        `Style: ${label} opens with meta commentary; start with the idea itself.`,
      );
    }
  });

  if (META_OPENER.test(lesson.promise.trim())) {
    errors.push(
      "Style: promise opens with meta commentary; state the outcome instead.",
    );
  }
  const promiseWords = words(lesson.promise).length;
  if (promiseWords < 10 || promiseWords > 30) {
    errors.push(
      `Style: promise is ${promiseWords} words; it must be 12-25 words.`,
    );
  }
  errors.push(...styleWarnings(lesson.promise, "promise"));

  const assignmentWords = words(lesson.assignment).length;
  if (assignmentWords < 8 || assignmentWords > 50) {
    errors.push(
      `Style: assignment is ${assignmentWords} words; it must be one small task.`,
    );
  }
  errors.push(...styleWarnings(lesson.assignment, "assignment"));

  const bodyWords = bodyWordCount(lesson);
  if (bodyWords < 120 || bodyWords > 280) {
    errors.push(
      `Style: body prose is ${bodyWords} words; it must be 140-240 words.`,
    );
  }

  const totalWords = lessonWordCount(
    lesson,
    resolveFocusConcepts(lesson.focus_concept_ids, context.concepts),
  );
  if (totalWords < 230 || totalWords > 420) {
    errors.push(
      `Style: lesson text is ${totalWords} words; the whole lesson should be 260-380 words.`,
    );
  }

  const fullText = lessonText(
    lesson,
    resolveFocusConcepts(lesson.focus_concept_ids, context.concepts),
  );
  if (!CONSEQUENCE.test(fullText)) {
    errors.push(
      "Style: add one sentence that says what goes wrong if the learner ignores this idea.",
    );
  }

  if (lesson.questions.length < 4 || lesson.questions.length > 6) {
    errors.push("The quiz must contain 4-6 questions.");
  }

  const types = new Set(lesson.questions.map((question) => question.type));
  if (types.size < 2) {
    errors.push("The quiz must use at least two different question types.");
  }

  const content = normalise(fullText);
  lesson.questions.forEach((question, index) => {
    errors.push(...checkQuestion(question, index, content, context.hasSequence));
  });

  return errors;
}

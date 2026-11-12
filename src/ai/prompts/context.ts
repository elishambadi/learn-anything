import type { AnalyzeResult } from "@/ai/schemas";

export function formatAnalysis(analysis: AnalyzeResult): string {
  return [
    `Summary: ${analysis.summary}`,
    `Audience: ${analysis.audience}`,
    "Course objectives:",
    ...analysis.objectives.map((objective) => `- ${objective}`),
    "Course core concepts (the spine every lesson builds on):",
    ...(analysis.concepts ?? []).map(
      (concept) => `- ${concept.id} — ${concept.title}: ${concept.description}`,
    ),
    `Suggested normal-mode lesson count: ${analysis.suggested_lesson_count}`,
  ].join("\n");
}

export type OutlineUnit = {
  title: string;
  summary: string;
  objectives: string[];
};

export function formatUnit(unit: OutlineUnit, label: string): string {
  return [
    `${label}: ${unit.title}`,
    `Unit summary: ${unit.summary}`,
    "Unit objectives:",
    ...unit.objectives.map((objective) => `- ${objective}`),
  ].join("\n");
}

export type LessonOutlineEntry = {
  title: string;
  objectives: string[];
  hasSequence: boolean;
};

export type CourseOutline = {
  title: string;
  lessons: LessonOutlineEntry[];
};

export function formatCourseOutline(units: CourseOutline[]): string {
  if (units.length === 0) return "No outline yet.";
  const lines: string[] = [];
  units.forEach((unit, unitIndex) => {
    lines.push(`Unit ${unitIndex + 1}: ${unit.title}`);
    unit.lessons.forEach((lesson, lessonIndex) => {
      lines.push(
        `  ${unitIndex + 1}.${lessonIndex + 1} ${lesson.title}${
          lesson.hasSequence ? " [has a real sequence]" : ""
        }`,
      );
      lesson.objectives.forEach((objective) => {
        lines.push(`      - ${objective}`);
      });
    });
  });
  return lines.join("\n");
}

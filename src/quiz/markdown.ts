import type {
  LessonClosing,
  LessonSection,
  SectionVisual,
} from "@/ai/schemas";

/** Flatten one visual block into GitHub-flavoured Markdown. */
export function visualToMarkdown(visual: SectionVisual): string {
  switch (visual.kind) {
    case "table":
      return [
        `| ${visual.columns.join(" | ")} |`,
        `| ${visual.columns.map(() => "---").join(" | ")} |`,
        ...visual.rows.map((row) => `| ${row.join(" | ")} |`),
      ].join("\n");
    case "steps":
      return visual.items
        .map((item, index) => `${index + 1}. **${item.title}** — ${item.text}`)
        .join("\n");
    case "roles":
    case "accordion":
    case "tabs":
      return visual.items.map((item) => `- **${item.title}** — ${item.text}`).join("\n");
    case "code":
      return ["```" + visual.language, visual.code, "```"].join("\n");
    case "bullets":
      return visual.items.map((item) => `- ${item}`).join("\n");
    case "none":
      return "";
  }
}

/**
 * The durable Markdown form of a lesson. `contentMd` keeps old readers, the
 * course export, and readiness checks working while the structured sections
 * stay the source the page renders from.
 */
export function sectionsToMarkdown(
  sections: LessonSection[],
  closing?: LessonClosing | null,
): string {
  const blocks = sections.map((section) => {
    const visual = visualToMarkdown(section.visual);
    return [
      `## ${section.heading}`,
      "",
      section.body_markdown.trim(),
      ...(visual ? ["", visual] : []),
    ].join("\n");
  });

  if (closing) {
    blocks.push(
      [`## ${closing.heading}`, "", closing.body_markdown.trim()].join("\n"),
    );
  }

  return blocks.join("\n\n");
}

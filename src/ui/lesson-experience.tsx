"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BookOpen,
  Check,
  ChevronDown,
  Clock,
  Loader2,
  Target,
} from "lucide-react";
import type { PublicLesson } from "@/quiz/serialize";
import type { LessonSection, SectionVisual } from "@/ai/schemas";
import { Badge } from "@/ui/components/badge";
import { Button } from "@/ui/components/button";
import { Card } from "@/ui/components/card";
import { ConceptGrid } from "@/ui/concept-grid";
import { cn } from "@/ui/utils";

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function hash(value: string): number {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) % 997;
  }
  return result;
}

function LessonHero({ lesson }: { lesson: PublicLesson }) {
  const [failed, setFailed] = useState(false);
  const query = lesson.heroQuery?.trim();
  const imageUrl = query
    ? `https://loremflickr.com/1200/480/${encodeURIComponent(query.trim().split(/\s+/).join(","))}?lock=${hash(lesson.id)}`
    : null;
  const bodyWords =
    lesson.sections.length > 0
      ? lesson.sections.reduce(
          (total, section) => total + wordCount(section.body_markdown),
          0,
        )
      : wordCount(lesson.contentMarkdown);
  const minutes = Math.max(2, Math.round(bodyWords / 220));

  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
      {imageUrl && !failed && (
        <img
          src={imageUrl}
          alt=""
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover opacity-55"
        />
      )}
      <div className="absolute inset-0 lesson-hero-overlay" />
      <BookOpen className="absolute right-6 top-6 h-24 w-24 text-zinc-100/[0.04]" />
      <div className="relative flex min-h-[250px] flex-col justify-end p-6 sm:min-h-[300px] sm:p-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant="violet">Lesson</Badge>
          <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
            <Clock className="h-3 w-3" />
            {minutes} min read
          </span>
        </div>
        <h1 className="max-w-2xl text-2xl font-semibold tracking-tight text-zinc-100 sm:text-4xl">
          {lesson.title}
        </h1>
      </div>
      {imageUrl && !failed && (
        <a
          href="https://loremflickr.com/"
          target="_blank"
          rel="noreferrer"
          className="absolute right-3 top-3 rounded-full bg-black/40 px-2 py-1 text-[9px] text-white/50 backdrop-blur hover:text-white/80"
        >
          Photo: LoremFlickr
        </a>
      )}
    </div>
  );
}

function VisualTable({
  title,
  columns,
  rows,
}: {
  title?: string;
  columns: string[];
  rows: string[][];
}) {
  return (
    <div>
      {title && (
        <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-zinc-500">
          {title}
        </h2>
      )}
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full min-w-[560px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/70">
              {columns.map((column) => (
                <th
                  key={column}
                  className="px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-zinc-400"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={`${rowIndex}-${row.join("-")}`}
                className="border-b border-zinc-900 last:border-0"
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={`${cellIndex}-${cell}`}
                    className={cn(
                      "px-4 py-3 align-top text-xs leading-relaxed",
                      cellIndex === 0
                        ? "font-medium text-zinc-200"
                        : "text-zinc-400",
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-[var(--code-bg)]">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
          {language}
        </span>
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed text-zinc-300">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function VisualCards({
  items,
  numbered,
  columns,
}: {
  items: Array<{ title: string; text: string }>;
  numbered?: boolean;
  columns?: boolean;
}) {
  return (
    <div className={cn("grid gap-3", columns && "sm:grid-cols-2")}>
      {items.map((item, index) => (
        <div
          key={`${item.title}-${index}`}
          className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4"
        >
          <div className="mb-2 flex items-baseline gap-2">
            {numbered && (
              <span className="font-mono text-[11px] text-violet-400">
                {String(index + 1).padStart(2, "0")}
              </span>
            )}
            <h3 className="text-sm font-semibold text-zinc-100">
              {item.title}
            </h3>
          </div>
          <p className="text-xs leading-relaxed text-zinc-400">{item.text}</p>
        </div>
      ))}
    </div>
  );
}

function TabsVisual({
  items,
}: {
  items: Array<{ title: string; text: string }>;
}) {
  const [active, setActive] = useState(0);
  const current = items[active] ?? items[0];
  if (!current) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800">
      <div className="flex flex-wrap gap-1 border-b border-zinc-800 bg-zinc-900/40 p-1.5">
        {items.map((item, index) => (
          <button
            key={item.title}
            type="button"
            onClick={() => setActive(index)}
            className={cn(
              "rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors",
              index === active
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200",
            )}
            aria-pressed={index === active}
          >
            {item.title}
          </button>
        ))}
      </div>
      <p className="p-4 text-xs leading-relaxed text-zinc-400">
        {current.text}
      </p>
    </div>
  );
}

function AccordionVisual({
  items,
}: {
  items: Array<{ title: string; text: string }>;
}) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <details
          key={item.title}
          className="group rounded-lg border border-zinc-800 bg-zinc-950/40"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-zinc-200">
            {item.title}
            <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500 transition-transform group-open:rotate-180" />
          </summary>
          <p className="border-t border-zinc-900 px-4 py-3 text-xs leading-relaxed text-zinc-400">
            {item.text}
          </p>
        </details>
      ))}
    </div>
  );
}

function BulletsVisual({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2 text-sm text-zinc-300">
          <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-violet-400" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SectionVisualBlock({ visual }: { visual: SectionVisual }) {
  switch (visual.kind) {
    case "table":
      return <VisualTable columns={visual.columns} rows={visual.rows} />;
    case "steps":
      return <VisualCards items={visual.items} numbered columns />;
    case "roles":
      return <VisualCards items={visual.items} columns />;
    case "accordion":
      return <AccordionVisual items={visual.items} />;
    case "tabs":
      return <TabsVisual items={visual.items} />;
    case "code":
      return <CodeBlock language={visual.language} code={visual.code} />;
    case "bullets":
      return <BulletsVisual items={visual.items} />;
    case "none":
      return null;
  }
}

function SectionBlock({ section }: { section: LessonSection }) {
  return (
    <section className="mt-9">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-zinc-500">
        {section.heading}
      </h2>
      <div className="lesson-prose !text-[15px] [&_p]:my-2">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {section.body_markdown}
        </ReactMarkdown>
      </div>
      <div className="mt-4">
        <SectionVisualBlock visual={section.visual} />
      </div>
    </section>
  );
}

export function LessonExperience({
  lesson,
  completed,
}: {
  lesson: PublicLesson;
  completed: boolean;
}) {
  const router = useRouter();
  const [done, setDone] = useState(completed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markComplete() {
    if (done || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/lessons/${lesson.id}/complete`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Could not mark the lesson complete.");
      setDone(true);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not mark the lesson complete.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <LessonHero lesson={lesson} />

      {lesson.objectives.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {lesson.objectives.map((objective) => (
            <div
              key={objective}
              className="flex gap-2 rounded-lg border border-zinc-900 bg-zinc-950/30 px-3 py-2 text-xs leading-relaxed text-zinc-400"
            >
              <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
              {objective}
            </div>
          ))}
        </div>
      )}

      <ConceptGrid
        concepts={lesson.coreConcepts}
        courseConcepts={lesson.courseConcepts}
        title="Core concepts"
      />

      {lesson.sections.length > 0 ? (
        lesson.sections.map((section, index) => (
          <SectionBlock
            key={`${section.heading}-${index}`}
            section={section}
          />
        ))
      ) : (
        <>
          {lesson.comparison && (
            <section className="mt-9">
              <VisualTable
                title={lesson.comparison.title}
                columns={lesson.comparison.columns}
                rows={lesson.comparison.rows}
              />
            </section>
          )}

          {lesson.contentMarkdown && (
            <article className="lesson-prose mt-9">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {lesson.contentMarkdown}
              </ReactMarkdown>
            </article>
          )}
        </>
      )}

      {lesson.assignment && (
        <Card className="mt-9 p-5">
          <Badge variant="amber">Assignment</Badge>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            {lesson.assignment}
          </p>
        </Card>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={markComplete}
          disabled={done || busy}
        >
          {busy ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving…
            </>
          ) : done ? (
            "Completed"
          ) : (
            "Mark complete"
          )}
        </Button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </div>
  );
}

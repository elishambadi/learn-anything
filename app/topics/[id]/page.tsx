import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Circle,
  MousePointerClick,
  Target,
} from "lucide-react";
import {
  getAttemptSummaryByLesson,
  getFinalQuizQuestions,
  getFinalQuizSummary,
  getOrderedLessons,
  getSubtopics,
  getTopic,
} from "@/db/queries";
import { getTopicCost } from "@/db/cost";
import { estimateCostUsd } from "@/ai/client";
import { parseAnalysis, topicProgress } from "@/api/topic-view";
import type { LessonRow } from "@/db/schema";
import { Badge } from "@/ui/components/badge";
import { Card } from "@/ui/components/card";
import { StatusBadge } from "@/ui/components/status-badge";
import { ProgressPanel } from "@/ui/progress-panel";
import { DeleteButton, RetryButton } from "@/ui/topic-actions";
import { ConceptGrid } from "@/ui/concept-grid";
import { ThemeToggle } from "@/ui/theme-toggle";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function LessonCheck({
  lesson,
  summary,
}: {
  lesson: LessonRow;
  summary: { attempts: number; bestScore: number; total: number } | undefined;
}) {
  if (lesson.status === "failed") {
    return <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />;
  }
  if (lesson.status !== "ready") {
    return <Circle className="h-4 w-4 shrink-0 text-zinc-700" />;
  }
  if (lesson.completedAt || (summary && summary.attempts > 0)) {
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />;
  }
  return <Circle className="h-4 w-4 shrink-0 text-zinc-600" />;
}

function LessonRow({
  lesson,
  label,
  summary,
}: {
  lesson: LessonRow;
  label: string;
  summary: { attempts: number; bestScore: number; total: number } | undefined;
}) {
  const ready = lesson.status === "ready";
  const completed =
    Boolean(lesson.completedAt) || (summary?.attempts ?? 0) > 0;
  const body = (
    <div className="flex items-center gap-3 px-1 py-2.5">
      <LessonCheck lesson={lesson} summary={summary} />
      <span className="w-8 shrink-0 text-xs tabular-nums text-zinc-600">
        {label}
      </span>
      <span
        className={
          ready
            ? "min-w-0 flex-1 truncate text-sm text-zinc-200"
            : "min-w-0 flex-1 truncate text-sm text-zinc-500"
        }
      >
        {lesson.title}
      </span>
      {summary && summary.attempts > 0 && (
        <span className="shrink-0 text-xs tabular-nums text-zinc-500">
          {summary.bestScore}/{summary.total}
        </span>
      )}
      {lesson.status === "failed" && (
        <span className="shrink-0 text-[10px] uppercase tracking-wider text-red-400/80">
          failed
        </span>
      )}
      {lesson.status === "generating" && (
        <span className="shrink-0 text-[10px] uppercase tracking-wider text-violet-400/80">
          writing
        </span>
      )}
      {ready && (
        <span className="shrink-0 text-[10px] uppercase tracking-wider text-zinc-600">
          {completed ? "review" : "open"}
        </span>
      )}
    </div>
  );

  if (!ready) return <div className="rounded-lg">{body}</div>;
  return (
    <Link
      href={`/topics/${lesson.topicId}/lessons/${lesson.id}`}
      className="block rounded-lg transition-colors hover:bg-zinc-900/60"
    >
      {body}
    </Link>
  );
}

export default async function TopicPage({ params }: Params) {
  const { id } = await params;
  const topic = getTopic(id);
  if (!topic) notFound();

  const subtopics = getSubtopics(id);
  const lessons = getOrderedLessons(id);
  const attemptSummary = getAttemptSummaryByLesson(id);
  const progress = topicProgress(topic);
  const analysis = parseAnalysis(topic);
  const quizQuestions = getFinalQuizQuestions(id);
  const quizSummary = getFinalQuizSummary(id);
  const cost = await getTopicCost(id);
  const active = topic.status === "queued" || topic.status === "generating";
  const needsRetry = topic.status === "partial" || topic.status === "failed";

  const groups =
    subtopics.length > 0
      ? subtopics.map((subtopic, index) => ({
          id: subtopic.id,
          title: subtopic.title,
          summary: subtopic.summary,
          index,
          lessons: lessons.filter((lesson) => lesson.subtopicId === subtopic.id),
        }))
      : [
          {
            id: null,
            title: null,
            summary: null,
            index: 0,
            lessons,
          },
        ];

  const estimatedCost = cost
    ? estimateCostUsd({
        inputTokens: cost.inputTokens,
        cacheReadTokens: cost.cacheReadTokens,
        outputTokens: cost.outputTokens,
      })
    : 0;

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All courses
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <DeleteButton topicId={topic.id} />
        </div>
      </div>

      <header className="mb-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant={topic.mode === "deep" ? "violet" : "default"}>
            {topic.mode} mode
          </Badge>
          <StatusBadge status={topic.status} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
          {topic.prompt}
        </h1>
        <p className="mt-2 text-xs text-zinc-600">
          Created{" "}
          {new Intl.DateTimeFormat("en", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(topic.createdAt)}
          {cost && cost.calls > 0
            ? ` · ${cost.calls} model calls · ~$${estimatedCost.toFixed(3)} estimated`
            : ""}
        </p>
      </header>

      {active && (
        <div className="mb-6">
          <ProgressPanel topicId={topic.id} initial={progress} />
        </div>
      )}

      {needsRetry && (
        <Card className="mb-6 border-amber-900/50 bg-amber-950/10 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div>
                <p className="text-sm font-medium text-amber-200">
                  {topic.status === "partial" ? "Partial course" : "Generation failed"}
                </p>
                {topic.error && (
                  <p className="mt-1 max-w-2xl text-xs leading-relaxed text-amber-200/60">
                    {topic.error}
                  </p>
                )}
              </div>
            </div>
            <RetryButton topicId={topic.id} />
          </div>
        </Card>
      )}

      {topic.analysisJson && (
        <Card className="mb-8 overflow-hidden">
          <div className="grid md:grid-cols-2">
            <div className="min-w-0 p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <BookOpen className="h-3.5 w-3.5 text-violet-400" />
                <h2 className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                  Summary
                </h2>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                {parseSafeSummary(topic.analysisJson)}
              </p>
              <div className="mt-4 rounded-lg border border-zinc-900 bg-zinc-950/40 px-3 py-2">
                <p className="text-[10px] uppercase tracking-widest text-zinc-600">
                  For
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
                  {parseSafeAudience(topic.analysisJson)}
                </p>
              </div>
            </div>

            <div className="min-w-0 border-t border-zinc-900 p-5 sm:p-6 md:border-l md:border-t-0">
              <div className="flex items-center gap-2">
                <Target className="h-3.5 w-3.5 text-violet-400" />
                <h2 className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                  Objectives
                </h2>
              </div>
              <ul className="mt-3 space-y-2.5">
                {parseSafeObjectives(topic.analysisJson).map((objective) => (
                  <li
                    key={objective}
                    className="flex gap-2.5 text-xs leading-relaxed text-zinc-400"
                  >
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-violet-800/60 bg-violet-950/40">
                      <Check className="h-2.5 w-2.5 text-violet-300" />
                    </span>
                    <span className="min-w-0">{objective}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {analysis && analysis.concepts.length > 0 && (
        <div className="mb-8 rounded-xl border border-zinc-800/90 bg-zinc-950/40 p-5">
          <ConceptGrid
            concepts={analysis.concepts}
            title="Core concepts"
          />
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-widest text-zinc-500">
            {subtopics.length > 0 ? "Curriculum" : "Lessons"}
          </h2>
          <span className="text-xs text-zinc-600">
            {progress.lessons.done}/{progress.lessons.total} ready
          </span>
        </div>

        {lessons.length === 0 && !active ? (
          <Card className="p-8 text-center">
            <MousePointerClick className="mx-auto h-5 w-5 text-zinc-600" />
            <p className="mt-3 text-sm text-zinc-400">
              No lessons.
            </p>
          </Card>
        ) : (
          <div className="space-y-8">
            {groups.map((group) => (
              <div key={group.id ?? "course"}>
                {group.title && (
                  <div className="mb-2 border-b border-zinc-900 pb-2">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 font-mono text-xs text-violet-500">
                        {String(group.index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <h3 className="text-sm font-medium text-zinc-200">
                          {group.title}
                        </h3>
                        {group.summary && (
                          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                            {group.summary}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <div className="-mx-1 divide-y divide-zinc-900/60">
                  {group.lessons.map((lesson) => (
                    <LessonRow
                      key={lesson.id}
                      lesson={lesson}
                      label={
                        subtopics.length > 0
                          ? `${group.index + 1}.${lesson.position + 1}`
                          : `${lesson.position + 1}`
                      }
                      summary={attemptSummary.get(lesson.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {topic.status === "ready" && quizQuestions.length > 0 && (
        <Card className="mt-8 flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <h2 className="text-sm font-medium text-zinc-200">Final quiz</h2>
            <p className="mt-1 text-xs text-zinc-500">
              {quizQuestions.length} questions
              {quizSummary &&
              quizSummary.attempts > 0 &&
              quizSummary.bestScore !== null &&
              quizSummary.bestTotal !== null
                ? ` · best ${quizSummary.bestScore}/${quizSummary.bestTotal}`
                : ""}
            </p>
          </div>
          <Link
            href={`/topics/${id}/quiz`}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500"
          >
            Start quiz
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>
      )}
    </main>
  );
}

function parseAnalysisObject(raw: string): {
  summary?: string;
  audience?: string;
  objectives?: string[];
} {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : undefined,
      audience: typeof parsed.audience === "string" ? parsed.audience : undefined,
      objectives: Array.isArray(parsed.objectives)
        ? parsed.objectives.filter(
            (item): item is string => typeof item === "string",
          )
        : undefined,
    };
  } catch {
    return {};
  }
}

function parseSafeSummary(raw: string): string {
  return parseAnalysisObject(raw).summary ?? "";
}

function parseSafeAudience(raw: string): string {
  return parseAnalysisObject(raw).audience ?? "Not specified";
}

function parseSafeObjectives(raw: string): string[] {
  return parseAnalysisObject(raw).objectives ?? [];
}

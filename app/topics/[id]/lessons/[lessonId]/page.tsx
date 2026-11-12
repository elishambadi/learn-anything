import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import {
  getAttemptSummaryByLesson,
  getFinalQuizQuestions,
  getLesson,
  getNextLesson,
  getOrderedLessons,
  getQuestions,
  getSubtopics,
  getTopic,
} from "@/db/queries";
import { toPublicLesson } from "@/quiz/serialize";
import { parseAnalysis } from "@/api/topic-view";
import { Badge } from "@/ui/components/badge";
import { Card } from "@/ui/components/card";
import { LessonExperience } from "@/ui/lesson-experience";
import { ThemeToggle } from "@/ui/theme-toggle";
import {
  LessonNav,
  type NavLesson,
  type NavUnit,
} from "@/ui/lesson-nav";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; lessonId: string }> };

function CourseHeader({
  topicId,
  topicPrompt,
  mode,
  position,
  total,
}: {
  topicId: string;
  topicPrompt: string;
  mode: "normal" | "deep";
  position: number | null;
  total: number | null;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-900 app-header backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-5">
        <Link
          href={`/topics/${topicId}`}
          className="group flex min-w-0 items-center gap-2.5"
        >
          <ArrowLeft className="h-4 w-4 shrink-0 text-zinc-500 transition-colors group-hover:text-zinc-200" />
          <div className="min-w-0">
            <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-zinc-600">
              Course
            </p>
            <p className="truncate text-sm font-medium text-zinc-300 transition-colors group-hover:text-zinc-100">
              {topicPrompt}
            </p>
          </div>
        </Link>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Badge variant={mode === "deep" ? "violet" : "default"}>
            {mode}
          </Badge>
          {position !== null && total !== null && (
            <span className="hidden text-[11px] tabular-nums text-zinc-500 sm:inline">
              Lesson {position} of {total}
            </span>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

export default async function LessonPage({ params }: Params) {
  const { id, lessonId } = await params;
  const topic = getTopic(id);
  if (!topic) notFound();
  const lesson = getLesson(lessonId);
  if (!lesson || lesson.topicId !== topic.id) notFound();

  const ordered = getOrderedLessons(topic.id);
  const index = ordered.findIndex((candidate) => candidate.id === lesson.id);

  if (!lesson.contentMd) {
    return (
      <>
        <CourseHeader
          topicId={topic.id}
          topicPrompt={topic.prompt}
          mode={topic.mode}
          position={index + 1}
          total={ordered.length}
        />
        <main className="mx-auto w-full max-w-3xl px-5 py-16">
          <Card className="p-8 text-center">
            <BookOpen className="mx-auto h-5 w-5 text-zinc-600" />
            <h1 className="mt-3 text-lg font-semibold text-zinc-100">
              Lesson not ready
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Status: {lesson.status}.
            </p>
            <Link
              href={`/topics/${topic.id}`}
              className="mt-5 inline-flex items-center gap-1.5 text-sm text-violet-300 hover:text-violet-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Course overview
            </Link>
          </Card>
        </main>
      </>
    );
  }

  const questionRows = getQuestions(lesson.id);
  const payload = toPublicLesson(
    lesson,
    questionRows,
    parseAnalysis(topic)?.concepts ?? [],
  );
  const subtopics = getSubtopics(topic.id);
  const attemptSummary = getAttemptSummaryByLesson(topic.id);
  const next = getNextLesson(topic.id, lesson.id);

  const navLesson = (candidate: (typeof ordered)[number], label: string): NavLesson => {
    const attempt = attemptSummary.get(candidate.id);
    return {
      id: candidate.id,
      title: candidate.title,
      label,
      status: candidate.status,
      completed: Boolean(candidate.completedAt) || (attempt?.attempts ?? 0) > 0,
      attempts: attempt?.attempts ?? 0,
      bestScore: attempt?.bestScore ?? null,
      total: attempt?.total ?? null,
    };
  };

  const quizQuestions = getFinalQuizQuestions(topic.id);
  const completed = (candidate: (typeof ordered)[number]) => {
    const attempt = attemptSummary.get(candidate.id);
    return Boolean(candidate.completedAt) || (attempt?.attempts ?? 0) > 0;
  };

  const units: NavUnit[] =
    subtopics.length > 0
      ? subtopics.map((subtopic, unitIndex) => ({
          id: subtopic.id,
          title: subtopic.title,
          lessons: ordered
            .filter((candidate) => candidate.subtopicId === subtopic.id)
            .map((candidate) =>
              navLesson(
                candidate,
                `${unitIndex + 1}.${candidate.position + 1}`,
              ),
            ),
        }))
      : [
          {
            id: null,
            title: null,
            lessons: ordered.map((candidate) =>
              navLesson(candidate, `${candidate.position + 1}`),
            ),
          },
        ];

  const done = ordered.filter(completed).length;

  const nextReady = next && (next.status === "ready" || next.contentMd);
  const currentCompleted = completed(lesson);

  return (
    <>
      <CourseHeader
        topicId={topic.id}
        topicPrompt={topic.prompt}
        mode={topic.mode}
        position={index + 1}
        total={ordered.length}
      />

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-5">
        <div className="grid gap-8 lg:grid-cols-[230px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-20">
              <LessonNav
                topicId={topic.id}
                units={units}
                currentLessonId={lesson.id}
                done={done}
                total={ordered.length}
              />
            </div>
          </aside>

          <div className="min-w-0">
            <details className="mb-5 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 lg:hidden">
              <summary className="cursor-pointer text-xs font-medium text-zinc-400">
                Lessons ({done}/{ordered.length} done)
              </summary>
              <div className="mt-3 border-t border-zinc-900 pt-3">
                <LessonNav
                  topicId={topic.id}
                  units={units}
                  currentLessonId={lesson.id}
                  done={done}
                  total={ordered.length}
                />
              </div>
            </details>

            <LessonExperience
              lesson={payload}
              completed={currentCompleted}
            />

            <nav className="mt-12 flex items-center justify-between border-t border-zinc-900 pt-6">
              <Link
                href={`/topics/${topic.id}`}
                className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-100"
              >
                <ArrowLeft className="h-4 w-4" />
                Course overview
              </Link>
              {nextReady ? (
                <Link
                  href={`/topics/${topic.id}/lessons/${next.id}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500"
                >
                  Next lesson
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : next ? (
                <span className="text-xs text-zinc-600">
                  Next lesson not ready.
                </span>
              ) : quizQuestions.length > 0 ? (
                <Link
                  href={`/topics/${topic.id}/quiz`}
                  className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500"
                >
                  Final quiz
                </Link>
              ) : (
                <span className="text-xs text-zinc-600">End of course</span>
              )}
            </nav>
          </div>
        </div>
      </main>
    </>
  );
}

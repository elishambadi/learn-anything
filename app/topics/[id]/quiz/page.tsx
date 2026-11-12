import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import { getFinalQuizQuestions, getFinalQuizSummary, getTopic } from "@/db/queries";
import { toPublicQuestion } from "@/quiz/serialize";
import { Badge } from "@/ui/components/badge";
import { Card } from "@/ui/components/card";
import { FinalQuiz } from "@/ui/final-quiz";
import { ThemeToggle } from "@/ui/theme-toggle";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function QuizPage({ params }: Params) {
  const { id } = await params;
  const topic = getTopic(id);
  if (!topic) notFound();

  const items = getFinalQuizQuestions(id);
  const questions = items.map((item) => toPublicQuestion(item.question));
  const summary = getFinalQuizSummary(id);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link
          href={`/topics/${topic.id}`}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {topic.prompt}
        </Link>
        <div className="flex items-center gap-2">
          <Badge variant={topic.mode === "deep" ? "violet" : "default"}>
            {topic.mode}
          </Badge>
          <ThemeToggle />
        </div>
      </div>

      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
          Final quiz
        </h1>
        <p className="mt-2 text-xs text-zinc-600">
          {questions.length} question{questions.length === 1 ? "" : "s"}
          {summary &&
          summary.attempts > 0 &&
          summary.bestScore !== null &&
          summary.bestTotal !== null
            ? ` · best ${summary.bestScore}/${summary.bestTotal}`
            : ""}
        </p>
      </header>

      {questions.length === 0 ? (
        <Card className="p-8 text-center">
          <BookOpen className="mx-auto h-5 w-5 text-zinc-600" />
          <p className="mt-3 text-sm text-zinc-400">No quiz.</p>
        </Card>
      ) : (
        <FinalQuiz topicId={topic.id} questions={questions} />
      )}
    </main>
  );
}

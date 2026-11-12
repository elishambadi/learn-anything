"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import type { PublicQuestion } from "@/quiz/serialize";
import { Button } from "@/ui/components/button";
import { QuestionCard, isAnswered, type QuestionResult } from "@/ui/question-card";

type SubmitResult = {
  score: number;
  total: number;
  results: QuestionResult[];
};

export function FinalQuiz({
  topicId,
  questions,
}: {
  topicId: string;
  questions: PublicQuestion[];
}) {
  const router = useRouter();
  const [responses, setResponses] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    for (const question of questions) {
      if (question.type === "order") {
        initial[question.id] = question.options.map((option) => option.id);
      }
    }
    return initial;
  });
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answeredCount = useMemo(
    () =>
      questions.filter((question) => isAnswered(question, responses[question.id]))
        .length,
    [questions, responses],
  );
  const allAnswered = answeredCount === questions.length;
  const resultById = useMemo(
    () =>
      new Map(
        (result?.results ?? []).map((item) => [item.questionId, item]),
      ),
    [result],
  );

  function setResponse(questionId: string, value: unknown) {
    setResponses((current) => ({ ...current, [questionId]: value }));
  }

  async function submit() {
    if (!allAnswered || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/topics/${topicId}/quiz/attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses }),
      });
      const data = (await response.json().catch(() => ({}))) as
        | SubmitResult
        | { error?: string };
      if (!response.ok || !("score" in data)) {
        throw new Error(
          ("error" in data && data.error) || "Could not submit the quiz.",
        );
      }
      setResult(data);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not submit the quiz.",
      );
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    const initial: Record<string, unknown> = {};
    for (const question of questions) {
      if (question.type === "order") {
        initial[question.id] = question.options.map((option) => option.id);
      }
    }
    setResponses(initial);
    setResult(null);
    setError(null);
  }

  return (
    <div>
      {result && (
        <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-950/50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-zinc-500">
                Score
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-100">
                {result.score}
                <span className="text-base font-normal text-zinc-500">
                  {" "}
                  / {result.total}
                </span>
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={reset}>
              <RotateCcw className="h-3.5 w-3.5" />
              Try again
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {questions.map((question, index) => (
          <QuestionCard
            key={question.id}
            question={question}
            index={index}
            response={responses[question.id]}
            onResponse={(value) => setResponse(question.id, value)}
            result={resultById.get(question.id)}
            disabled={!!result}
          />
        ))}
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {!result && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button onClick={submit} disabled={!allAnswered || busy} size="lg">
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Grading…
              </>
            ) : (
              "Submit answers"
            )}
          </Button>
          {!allAnswered && (
            <span className="text-xs text-zinc-500">
              {questions.length - answeredCount} left
            </span>
          )}
        </div>
      )}
    </div>
  );
}

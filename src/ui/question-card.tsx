"use client";

import {
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type { PublicQuestion } from "@/quiz/serialize";
import { Badge } from "@/ui/components/badge";
import { cn } from "@/ui/utils";

export type QuestionResult = {
  questionId: string;
  isCorrect: boolean;
  correctAnswer: unknown;
  explanation: string;
};

const TYPE_LABEL: Record<PublicQuestion["type"], string> = {
  true_false: "True / false",
  radio: "Single choice",
  multi: "Select all that apply",
  order: "Put in order",
};

const DIFFICULTY_VARIANT: Record<
  PublicQuestion["difficulty"],
  "green" | "amber" | "red"
> = {
  easy: "green",
  medium: "amber",
  hard: "red",
};

export function isAnswered(
  question: PublicQuestion,
  response: unknown,
): boolean {
  if (question.type === "true_false") return typeof response === "boolean";
  if (question.type === "radio") return typeof response === "string";
  if (question.type === "multi")
    return Array.isArray(response) && response.length > 0;
  return (
    Array.isArray(response) && response.length === question.options.length
  );
}

function correctAnswerText(
  question: PublicQuestion,
  correctAnswer: unknown,
): string {
  const text = (id: string) =>
    question.options.find((option) => option.id === id)?.text ?? id;

  if (question.type === "true_false") {
    const value = (correctAnswer as { value?: boolean })?.value;
    return value ? "True" : "False";
  }
  if (question.type === "radio") {
    const id = (correctAnswer as { optionId?: string })?.optionId;
    return id ? text(id) : "—";
  }
  if (question.type === "multi") {
    const ids = (correctAnswer as { optionIds?: string[] })?.optionIds ?? [];
    return ids.map(text).join(" · ");
  }
  const ids = (correctAnswer as { itemIds?: string[] })?.itemIds ?? [];
  return ids.map(text).join(" → ");
}

export function QuestionCard({
  question,
  index,
  response,
  onResponse,
  result,
  disabled,
}: {
  question: PublicQuestion;
  index: number;
  response: unknown;
  onResponse: (value: unknown) => void;
  result: QuestionResult | undefined;
  disabled: boolean;
}) {
  function toggleMulti(optionId: string) {
    const current = Array.isArray(response) ? (response as string[]) : [];
    onResponse(
      current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId],
    );
  }

  function moveOrder(optionId: string, delta: number) {
    const current = Array.isArray(response)
      ? [...(response as string[])]
      : question.options.map((option) => option.id);
    const position = current.indexOf(optionId);
    const next = position + delta;
    if (position === -1 || next < 0 || next >= current.length) return;
    [current[position], current[next]] = [current[next], current[position]];
    onResponse(current);
  }

  return (
    <article
      className={cn(
        "rounded-xl border bg-zinc-950/40 p-5",
        result
          ? result.isCorrect
            ? "border-emerald-900/50"
            : "border-red-900/50"
          : "border-zinc-800/90",
      )}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-zinc-600">Q{index + 1}</span>
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">
          {TYPE_LABEL[question.type]}
        </span>
        <Badge variant={DIFFICULTY_VARIANT[question.difficulty]}>
          {question.difficulty}
        </Badge>
        {result &&
          (result.isCorrect ? (
            <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Correct
            </span>
          ) : (
            <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-red-400">
              <XCircle className="h-3.5 w-3.5" />
              Incorrect
            </span>
          ))}
      </div>

      <p className="text-[15px] font-medium leading-relaxed text-zinc-100">
        {question.prompt}
      </p>

      <div className="mt-4">
        {question.type === "true_false" && (
          <div className="grid grid-cols-2 gap-2">
            {[true, false].map((value) => {
              const selected = response === value;
              return (
                <button
                  key={String(value)}
                  type="button"
                  disabled={disabled}
                  onClick={() => onResponse(value)}
                  className={cn(
                    "rounded-lg border px-4 py-3 text-sm transition-colors",
                    selected
                      ? "border-violet-600 bg-violet-950/40 text-violet-200"
                      : "border-zinc-800 text-zinc-300 hover:border-zinc-700",
                    disabled && !selected && "opacity-60",
                  )}
                  aria-pressed={selected}
                >
                  {value ? "True" : "False"}
                </button>
              );
            })}
          </div>
        )}

        {(question.type === "radio" || question.type === "multi") && (
          <div className="space-y-2">
            {question.options.map((option) => {
              const selected =
                question.type === "radio"
                  ? response === option.id
                  : Array.isArray(response) &&
                    (response as string[]).includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    question.type === "radio"
                      ? onResponse(option.id)
                      : toggleMulti(option.id)
                  }
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg border px-3.5 py-3 text-left text-sm transition-colors",
                    selected
                      ? "border-violet-600/80 bg-violet-950/30 text-zinc-100"
                      : "border-zinc-800 text-zinc-300 hover:border-zinc-700",
                    disabled && !selected && "opacity-60",
                  )}
                  aria-pressed={selected}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border",
                      question.type === "radio" ? "rounded-full" : "rounded",
                      selected
                        ? "border-violet-500 bg-violet-600 text-white"
                        : "border-zinc-600",
                    )}
                  >
                    {selected && <Check className="h-3 w-3" />}
                  </span>
                  <span>{option.text}</span>
                </button>
              );
            })}
          </div>
        )}

        {question.type === "order" && (
          <div className="space-y-2">
            <p className="mb-1 text-xs text-zinc-500">
              Use the arrows to arrange these in the correct order.
            </p>
            {(Array.isArray(response)
              ? (response as string[])
              : question.options.map((option) => option.id)
            ).map((id, position, list) => {
              const option = question.options.find(
                (candidate) => candidate.id === id,
              );
              return (
                <div
                  key={id}
                  className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5"
                >
                  <span className="w-5 text-xs tabular-nums text-zinc-500">
                    {position + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-zinc-200">
                    {option?.text ?? id}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={disabled || position === 0}
                      onClick={() => moveOrder(id, -1)}
                      className="rounded border border-zinc-700 p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      disabled={disabled || position === list.length - 1}
                      onClick={() => moveOrder(id, 1)}
                      className="rounded border border-zinc-700 p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-30"
                      aria-label="Move down"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {result && (
        <div
          className={cn(
            "mt-4 rounded-lg border px-3.5 py-3 text-xs leading-relaxed",
            result.isCorrect
              ? "border-emerald-900/40 bg-emerald-950/10 text-emerald-100/80"
              : "border-red-900/40 bg-red-950/10 text-red-100/80",
          )}
        >
          <p className="font-medium text-zinc-200">
            {result.isCorrect ? "Explanation" : "Correct answer"}
          </p>
          {!result.isCorrect && (
            <p className="mt-1 text-zinc-300">
              {correctAnswerText(question, result.correctAnswer)}
            </p>
          )}
          <p className="mt-1 text-zinc-400">{result.explanation}</p>
        </div>
      )}
    </article>
  );
}

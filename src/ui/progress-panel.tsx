"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Circle, Loader2, X } from "lucide-react";
import { Progress } from "@/ui/components/progress";
import { cn } from "@/ui/utils";

type ProgressPayload = {
  id: string;
  status: "queued" | "generating" | "ready" | "partial" | "failed";
  stage: "queued" | "analyze" | "decompose" | "outline" | "lessons" | "done";
  error: string | null;
  lessons: { done: number; failed: number; total: number };
  units: Array<{
    id: string | null;
    title: string;
    status: string;
    done: number;
    total: number;
  }>;
  lessonStates: Array<{
    id: string;
    title: string;
    status: "pending" | "generating" | "ready" | "failed";
    subtopicId: string | null;
  }>;
};

const STAGE_LABEL: Record<ProgressPayload["stage"], string> = {
  queued: "Queued",
  analyze: "Analyzing",
  decompose: "Decomposing",
  outline: "Outlining",
  lessons: "Writing lessons",
  done: "Done",
};

function LessonTick({
  status,
}: {
  status: ProgressPayload["lessonStates"][number]["status"];
}) {
  if (status === "ready") {
    return <Check className="h-3.5 w-3.5 text-emerald-400" />;
  }
  if (status === "failed") {
    return <X className="h-3.5 w-3.5 text-red-400" />;
  }
  if (status === "generating") {
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />;
  }
  return <Circle className="h-3.5 w-3.5 text-zinc-600" />;
}

export function ProgressPanel({
  topicId,
  initial,
}: {
  topicId: string;
  initial: ProgressPayload;
}) {
  const [progress, setProgress] = useState(initial);
  const router = useRouter();
  const terminal =
    progress.status === "ready" ||
    progress.status === "partial" ||
    progress.status === "failed";

  useEffect(() => {
    if (terminal) return;
    let stopped = false;

    async function poll() {
      try {
        const response = await fetch(`/api/topics/${topicId}/progress`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json()) as ProgressPayload;
        if (stopped) return;
        setProgress(data);
        if (
          data.status === "ready" ||
          data.status === "partial" ||
          data.status === "failed"
        ) {
          router.refresh();
        }
      } catch {
        // Transient polling failure; the next tick retries.
      }
    }

    const timer = setInterval(poll, 2000);
    void poll();
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [topicId, terminal, router]);

  const percent =
    progress.lessons.total > 0
      ? (progress.lessons.done / progress.lessons.total) * 100
      : 0;

  return (
    <div className="rounded-xl border border-violet-900/40 bg-violet-950/10 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-violet-200">
          <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
          {STAGE_LABEL[progress.stage]}
        </div>
        <span className="text-xs text-zinc-500">
          {progress.lessons.total > 0
            ? `${progress.lessons.done}/${progress.lessons.total} lessons`
            : "preparing"}
        </span>
      </div>

      <Progress
        value={percent}
        indeterminate={progress.lessons.total === 0}
        className="mt-3"
      />

      {progress.lessonStates.length > 0 && (
        <div className="mt-4 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {progress.lessonStates.map((lesson) => (
            <div
              key={lesson.id}
              className={cn(
                "flex items-center gap-2 text-xs",
                lesson.status === "ready"
                  ? "text-zinc-300"
                  : lesson.status === "failed"
                    ? "text-red-300/80"
                    : "text-zinc-500",
              )}
            >
              <LessonTick status={lesson.status} />
              <span className="truncate">{lesson.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/ui/utils";

export type NavLesson = {
  id: string;
  title: string;
  label: string;
  status: string;
  completed: boolean;
  attempts: number;
  bestScore: number | null;
  total: number | null;
};

export type NavUnit = {
  id: string | null;
  title: string | null;
  lessons: NavLesson[];
};

export function LessonNav({
  topicId,
  units,
  currentLessonId,
  done,
  total,
}: {
  topicId: string;
  units: NavUnit[];
  currentLessonId: string;
  done: number;
  total: number;
}) {
  return (
    <nav aria-label="Course lessons">
      <div className="mb-3 flex items-end justify-between gap-2">
        <h2 className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">
          Lessons
        </h2>
        <span className="text-[10px] tabular-nums text-zinc-600">
          {done}/{total} done
        </span>
      </div>

      <div className="space-y-5">
        {units.map((unit) => (
          <div key={unit.id ?? "course"}>
            {unit.title && (
              <p className="mb-1.5 px-2 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                {unit.title}
              </p>
            )}
            <div className="space-y-0.5">
              {unit.lessons.map((lesson) => {
                const current = lesson.id === currentLessonId;
                return (
                  <Link
                    key={lesson.id}
                    href={`/topics/${topicId}/lessons/${lesson.id}`}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "flex items-start gap-2 rounded-lg px-2 py-2 text-xs leading-snug transition-colors",
                      current
                        ? "bg-violet-950/35 text-violet-100 ring-1 ring-violet-800/50"
                        : "text-zinc-400 hover:bg-zinc-900/70 hover:text-zinc-200",
                    )}
                  >
                    {lesson.completed ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    ) : (
                      <Circle
                        className={cn(
                          "mt-0.5 h-3.5 w-3.5 shrink-0",
                          current ? "text-violet-400" : "text-zinc-700",
                        )}
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="mr-1 font-mono text-[10px] text-zinc-600">
                        {lesson.label}
                      </span>
                      {lesson.title}
                    </span>
                    {lesson.attempts > 0 &&
                      lesson.bestScore !== null &&
                      lesson.total !== null && (
                        <span className="shrink-0 text-[10px] tabular-nums text-zinc-600">
                          {lesson.bestScore}/{lesson.total}
                        </span>
                      )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}

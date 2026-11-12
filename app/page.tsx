import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { listTopics } from "@/db/queries";
import { CreateTopicForm } from "@/ui/create-topic-form";
import { ThemeToggle } from "@/ui/theme-toggle";
import { Badge } from "@/ui/components/badge";
import { Card } from "@/ui/components/card";
import { Progress } from "@/ui/components/progress";
import { StatusBadge } from "@/ui/components/status-badge";

export const dynamic = "force-dynamic";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default function HomePage() {
  const topics = listTopics();

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 sm:py-20">
      <header className="mb-10 flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight text-zinc-100 sm:text-4xl">
          <BookOpen className="h-5 w-5 text-violet-400" />
          Learn Anything
        </h1>
        <ThemeToggle />
      </header>

      <CreateTopicForm />

      <section className="mt-14">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-sm font-medium uppercase tracking-widest text-zinc-500">
            Recent courses
          </h2>
          <span className="text-xs text-zinc-600">
            {topics.length} courses
          </span>
        </div>

        {topics.length === 0 ? (
          <Card className="border-dashed p-8 text-center">
            <p className="text-sm text-zinc-400">No courses.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {topics.map((topic) => {
              const percent =
                topic.lessonCount > 0
                  ? (topic.readyCount / topic.lessonCount) * 100
                  : 0;
              return (
                <Link
                  key={topic.id}
                  href={`/topics/${topic.id}`}
                  className="group block"
                >
                  <Card className="p-4 transition-colors group-hover:border-zinc-700 group-hover:bg-zinc-900/40">
                    <div className="flex items-start gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-[15px] font-medium text-zinc-100">
                            {topic.prompt}
                          </h3>
                          <Badge variant={topic.mode === "deep" ? "violet" : "default"}>
                            {topic.mode}
                          </Badge>
                          <StatusBadge status={topic.status} />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                          <span>
                            {topic.lessonCount} lesson
                            {topic.lessonCount === 1 ? "" : "s"}
                          </span>
                          {topic.attemptCount > 0 && (
                            <span>
                              {topic.attemptCount} attempt
                              {topic.attemptCount === 1 ? "" : "s"}
                              {topic.bestScore !== null && topic.scoreTotal !== null
                                ? ` · best ${topic.bestScore}/${topic.scoreTotal}`
                                : ""}
                            </span>
                          )}
                          <span>{formatDate(topic.createdAt)}</span>
                        </div>
                        {(topic.status === "generating" ||
                          topic.status === "queued") && (
                          <div className="mt-3 max-w-sm">
                            <Progress
                              value={percent}
                              indeterminate={topic.lessonCount === 0}
                            />
                          </div>
                        )}
                        {topic.error && topic.status !== "ready" && (
                          <p className="mt-2 line-clamp-1 text-xs text-red-400/80">
                            {topic.error}
                          </p>
                        )}
                      </div>
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-400" />
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

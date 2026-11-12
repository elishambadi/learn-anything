"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, Layers, Loader2 } from "lucide-react";
import { Button } from "@/ui/components/button";
import { cn } from "@/ui/utils";

type Mode = "normal" | "deep";

const MODES: Array<{
  id: Mode;
  title: string;
  blurb: string;
  icon: typeof BookOpen;
}> = [
  {
    id: "normal",
    title: "Normal",
    blurb: "One pass, about 6 lessons.",
    icon: BookOpen,
  },
  {
    id: "deep",
    title: "Deep",
    blurb: "Subtopics first, then 12–20 lessons.",
    icon: Layers,
  },
];

export function CreateTopicForm() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<Mode>("normal");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (trimmed.length < 3 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed, mode }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
      };
      if (!response.ok || !data.id) {
        throw new Error(data.error ?? "Could not start the course.");
      }
      router.push(`/topics/${data.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-1.5 shadow-lg shadow-black/20 focus-within:border-violet-700/70">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Topic"
          rows={3}
          maxLength={500}
          disabled={busy}
          className="w-full resize-none bg-transparent px-3 py-2 text-[15px] text-zinc-100 outline-none placeholder:text-zinc-600 disabled:opacity-60"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {MODES.map((option) => {
          const Icon = option.icon;
          const selected = mode === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setMode(option.id)}
              disabled={busy}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors",
                selected
                  ? "border-violet-600/80 bg-violet-950/30 ring-1 ring-violet-600/40"
                  : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700",
              )}
              aria-pressed={selected}
            >
              <div className="flex items-center gap-2">
                <Icon
                  className={cn(
                    "h-4 w-4",
                    selected ? "text-violet-400" : "text-zinc-500",
                  )}
                />
                <span className="font-medium text-zinc-100">{option.title}</span>
                {selected && (
                  <span className="ml-auto text-[10px] uppercase tracking-widest text-violet-400">
                    selected
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-sm text-zinc-300">{option.blurb}</p>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={busy || prompt.trim().length < 3}
        className="w-full sm:w-auto"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Starting…
          </>
        ) : (
          <>
            Create course
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}

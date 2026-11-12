"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/ui/components/button";

export function RetryButton({ topicId }: { topicId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/topics/${topicId}/retry`, {
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Retry failed.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Retry failed.");
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button onClick={retry} disabled={busy} size="sm" variant="secondary">
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RotateCcw className="h-3.5 w-3.5" />
        )}
        {busy ? "Resuming…" : "Resume generation"}
      </Button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}

export function DeleteButton({ topicId }: { topicId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!window.confirm("Delete this course and its attempts?")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/topics/${topicId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Delete failed.");
      router.push("/");
      router.refresh();
    } catch {
      setBusy(false);
    }
  }

  return (
    <Button
      onClick={remove}
      disabled={busy}
      size="sm"
      variant="ghost"
      className="text-zinc-500 hover:text-red-300"
      aria-label="Delete course"
    >
      <Trash2 className="h-3.5 w-3.5" />
      Delete
    </Button>
  );
}

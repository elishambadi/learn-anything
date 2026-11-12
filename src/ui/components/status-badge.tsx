import { Badge } from "@/ui/components/badge";
import type { TopicRow } from "@/db/schema";

const LABELS: Record<TopicRow["status"], string> = {
  queued: "Queued",
  generating: "Generating",
  ready: "Ready",
  partial: "Partial",
  failed: "Failed",
};

const VARIANTS: Record<
  TopicRow["status"],
  "default" | "violet" | "green" | "amber" | "red"
> = {
  queued: "default",
  generating: "violet",
  ready: "green",
  partial: "amber",
  failed: "red",
};

export function StatusBadge({ status }: { status: TopicRow["status"] }) {
  return (
    <Badge variant={VARIANTS[status]}>
      {status === "generating" && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
      )}
      {LABELS[status]}
    </Badge>
  );
}

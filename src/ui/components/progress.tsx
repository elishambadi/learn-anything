import { cn } from "@/ui/utils";

export function Progress({
  value,
  className,
  indeterminate = false,
}: {
  value: number;
  className?: string;
  indeterminate?: boolean;
}) {
  return (
    <div
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-zinc-800",
        className,
      )}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : Math.round(value)}
    >
      <div
        className={cn(
          "h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 transition-all duration-500",
          indeterminate && "w-1/3 animate-pulse",
        )}
        style={indeterminate ? undefined : { width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

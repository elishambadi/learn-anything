import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/ui/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide",
  {
    variants: {
      variant: {
        default: "border-zinc-700 bg-zinc-800/60 text-zinc-300",
        violet: "border-violet-800/60 bg-violet-950/50 text-violet-300",
        sky: "border-sky-800/60 bg-sky-950/40 text-sky-300",
        green: "border-emerald-800/60 bg-emerald-950/40 text-emerald-300",
        amber: "border-amber-800/60 bg-amber-950/40 text-amber-300",
        red: "border-red-800/60 bg-red-950/40 text-red-300",
        outline: "border-zinc-700 text-zinc-400",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

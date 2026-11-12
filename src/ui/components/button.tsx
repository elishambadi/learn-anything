import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/ui/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        default:
          "bg-violet-600 text-white shadow-sm hover:bg-violet-500 active:bg-violet-700",
        secondary:
          "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700",
        outline:
          "border border-zinc-700 bg-transparent text-zinc-200 hover:bg-zinc-900 hover:text-zinc-100",
        ghost: "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100",
        destructive:
          "bg-red-600/90 text-white hover:bg-red-500 focus-visible:ring-red-500/60",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-6 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };

import type { HTMLAttributes } from "react";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "accent" | "muted";

const styles: Record<BadgeVariant, string> = {
  default: "bg-[#27272e] text-[#8888a0]",
  success: "bg-[#22c55e20] text-[#22c55e]",
  warning: "bg-[#f59e0b20] text-[#f59e0b]",
  danger:  "bg-[#ef444420] text-[#ef4444]",
  accent:  "bg-[#7c5cfc20] text-[#7c5cfc]",
  muted:   "bg-[#18181f] text-[#55556a]",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> { variant?: BadgeVariant }

export function Badge({ variant = "default", className = "", children, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

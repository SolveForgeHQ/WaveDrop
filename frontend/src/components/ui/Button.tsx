"use client";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size    = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?:    Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary:   "bg-[#7c5cfc] hover:bg-[#6b4ef0] text-white border border-[#7c5cfc]",
  secondary: "bg-[#18181f] hover:bg-[#1e1e27] text-[#f0f0f4] border border-[#27272e]",
  ghost:     "bg-transparent hover:bg-[#18181f] text-[#8888a0] hover:text-[#f0f0f4] border border-transparent",
  danger:    "bg-transparent hover:bg-[#ef444420] text-[#ef4444] border border-[#ef444440]",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs rounded-md",
  md: "px-4 py-2   text-sm rounded-lg",
  lg: "px-5 py-2.5 text-sm rounded-lg",
};

export function Button({
  variant = "secondary", size = "md", loading, disabled, children, className = "", ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`
        inline-flex items-center gap-2 font-medium transition-colors
        disabled:opacity-40 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      {...props}
    >
      {loading && (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}

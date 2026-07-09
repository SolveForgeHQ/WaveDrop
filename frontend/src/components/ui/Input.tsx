import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

const base = `
  w-full bg-[#0a0a0f] border border-[#27272e] rounded-lg px-3 py-2
  text-sm text-[#f0f0f4] placeholder:text-[#55556a]
  focus:outline-none focus:border-[#7c5cfc] transition-colors
  disabled:opacity-40
`;

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${base} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${base} resize-none ${className}`} {...props} />;
}

export function Label({ className = "", ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={`block text-xs font-medium text-[#8888a0] mb-1.5 ${className}`} {...props} />;
}

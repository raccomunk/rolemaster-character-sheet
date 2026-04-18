import React from "react";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className = "", ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={`min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-slate-500 ${className}`.trim()}
      {...props}
    />
  );
});

Textarea.displayName = "Textarea";

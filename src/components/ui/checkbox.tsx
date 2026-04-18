import React from "react";

export type CheckboxProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(({ className = "", ...props }, ref) => {
  return <input ref={ref} type="checkbox" className={`h-4 w-4 rounded border-slate-300 ${className}`.trim()} {...props} />;
});

Checkbox.displayName = "Checkbox";

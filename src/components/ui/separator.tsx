import React from "react";

type SeparatorProps = React.HTMLAttributes<HTMLDivElement> & {
  orientation?: "horizontal" | "vertical";
};

export function Separator({ className = "", orientation = "horizontal", ...props }: SeparatorProps) {
  const classes =
    orientation === "horizontal"
      ? "h-px w-full bg-slate-200"
      : "h-full w-px bg-slate-200";

  return <div className={`${classes} ${className}`.trim()} role="separator" {...props} />;
}

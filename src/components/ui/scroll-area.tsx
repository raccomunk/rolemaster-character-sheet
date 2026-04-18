import React from "react";

export function ScrollArea({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`overflow-auto ${className}`.trim()} {...props} />;
}

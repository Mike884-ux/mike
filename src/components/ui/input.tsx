import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-sm bg-surface-2 px-3 text-sm text-fg outline-none",
        "placeholder:text-faint shadow-[var(--shadow-border)]",
        "transition-[box-shadow,background-color] duration-[var(--motion-quick)] ease-[var(--ease-out)]",
        "focus-visible:ring-2 focus-visible:ring-primary/30",
        "disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}

export { Input };

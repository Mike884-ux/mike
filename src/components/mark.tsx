import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("text-fg", className)}
    >
      <rect x="6" y="4" width="3" height="24" rx="1" fill="currentColor" />
      <rect x="14" y="10" width="12" height="2.4" rx="1" fill="currentColor" />
      <rect x="14" y="19.6" width="8" height="2.4" rx="1" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

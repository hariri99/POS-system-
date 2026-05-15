import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-[110px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3.5 py-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] transition-colors focus:border-[var(--brand)]/50 focus:ring-2 focus:ring-[var(--brand)]/20",
        className,
      )}
      {...props}
    />
  );
}

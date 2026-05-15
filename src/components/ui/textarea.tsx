import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-[110px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3.5 py-3 text-sm text-[var(--heading)] outline-none placeholder:text-[var(--muted-foreground)] transition-colors focus:border-[var(--brand)]/45 focus:ring-2 focus:ring-[var(--brand)]/16",
        className,
      )}
      {...props}
    />
  );
}

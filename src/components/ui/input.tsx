import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3.5 text-sm text-[var(--heading)] outline-none placeholder:text-[var(--muted-foreground)] transition-colors focus:border-[var(--brand)]/45 focus:ring-2 focus:ring-[var(--brand)]/16",
        className,
      )}
      {...props}
    />
  );
}

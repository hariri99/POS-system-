import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3.5 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] transition-colors focus:border-[var(--brand)]/50 focus:ring-2 focus:ring-[var(--brand)]/20",
        className,
      )}
      {...props}
    />
  );
}

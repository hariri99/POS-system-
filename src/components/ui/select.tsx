import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3.5 text-sm text-[var(--heading)] outline-none transition-colors focus:border-[var(--brand)]/45 focus:ring-2 focus:ring-[var(--brand)]/16",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

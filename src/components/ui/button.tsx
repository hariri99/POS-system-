import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--brand)] text-[var(--brand-ink)] shadow-[0_12px_24px_rgba(180,83,9,0.18)] hover:bg-[var(--brand-strong)]",
  secondary: "bg-[var(--surface-strong)] text-[var(--foreground)] ring-1 ring-[var(--border)] hover:bg-white/[0.08]",
  ghost: "bg-transparent text-[var(--muted-foreground)] hover:bg-white/[0.05] hover:text-white",
  danger: "bg-[var(--danger)] text-white hover:opacity-90",
};

export function Button({
  className,
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/30 disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

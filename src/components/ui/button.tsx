import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--brand)] text-white shadow-[var(--shadow-brand)] hover:bg-[var(--brand-strong)]",
  secondary:
    "bg-[var(--surface-strong)] text-[var(--heading)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-soft)]",
  ghost:
    "bg-transparent text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)] hover:text-[var(--heading)]",
  danger: "bg-[var(--danger)] text-white shadow-none hover:opacity-92",
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
        "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/18 disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

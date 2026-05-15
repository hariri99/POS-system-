"use client";

import { MoonStar, SunMedium } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTheme } from "./theme-provider";

export function ThemeToggle({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <Button
      type="button"
      variant="secondary"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      className={cn(
        "theme-toggle border border-[var(--border)] bg-[var(--surface-strong)] px-3.5 shadow-none",
        compact ? "size-10 px-0" : "",
        className,
      )}
    >
      <span className="inline-flex size-6 items-center justify-center rounded-full bg-[var(--brand-surface)] text-[var(--brand)]">
        {isDark ? <SunMedium className="size-3.5" /> : <MoonStar className="size-3.5" />}
      </span>
      {compact ? null : (
        <span className="hidden sm:inline">{isDark ? "Light mode" : "Dark mode"}</span>
      )}
    </Button>
  );
}

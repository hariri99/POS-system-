"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { type SaleRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SaleProductsPreview({
  items,
  maxVisible = 4,
  showSummary = true,
  compact = false,
  displayMode = "chips",
  summaryLabel,
  className,
}: {
  items: SaleRecord["items"];
  maxVisible?: number;
  showSummary?: boolean;
  compact?: boolean;
  displayMode?: "chips" | "summary";
  summaryLabel?: string;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hiddenCount = Math.max(0, items.length - maxVisible);
  const displayedItems =
    displayMode === "summary" ? items : expanded ? items : items.slice(0, maxVisible);
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
  const itemTitle = items.map((item) => `${item.productName} x${item.quantity}`).join(" | ");
  const resolvedSummaryLabel =
    summaryLabel ??
    `${totalUnits} item${totalUnits === 1 ? "" : "s"} purchased`;

  const chips = (
    <div className="flex flex-wrap gap-2">
      {displayedItems.map((item) => (
        <div
          key={item.id}
          className={cn(
            "inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--heading)]",
            compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
          )}
        >
          <span
            className={cn(
              "font-medium",
              expanded
                ? "max-w-full whitespace-normal break-words"
                : compact
                  ? "max-w-[10rem] truncate"
                  : "max-w-[15rem] truncate",
            )}
          >
            {item.productName}
          </span>
          <span
            className={cn(
              "rounded-full bg-[var(--surface-soft)] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]",
              compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
            )}
          >
            x{item.quantity}
          </span>
        </div>
      ))}
      {displayMode === "chips" && hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className={cn(
            "inline-flex items-center rounded-full border border-[var(--border-accent)] bg-[var(--brand-surface)] font-medium text-[var(--brand)] transition-colors hover:bg-[var(--brand-surface-strong)]",
            compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
          )}
        >
          {expanded ? "Show less" : `+${hiddenCount} more`}
        </button>
      ) : null}
    </div>
  );

  return (
    <div className={cn("space-y-3", className)} title={itemTitle}>
      {displayMode === "summary" ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] font-medium text-[var(--heading)] transition-colors hover:bg-[var(--surface-hover)]",
              compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm",
            )}
          >
            <span>{resolvedSummaryLabel}</span>
            <ChevronDown
              className={cn("size-3.5 transition-transform", expanded ? "rotate-180" : "")}
            />
          </button>
          {expanded ? chips : null}
        </div>
      ) : (
        chips
      )}

      {showSummary ? (
        <p className={cn("text-[var(--muted-foreground)]", compact ? "text-[11px]" : "text-xs")}>
          {items.length} line{items.length === 1 ? "" : "s"} in this order, {totalUnits} unit
          {totalUnits === 1 ? "" : "s"} sold.
        </p>
      ) : null}
    </div>
  );
}

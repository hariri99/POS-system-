import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ScrollableWidgetProps {
  title: string;
  description: string;
  badge?: string;
  actionHref?: string;
  actionLabel?: string;
  controls?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

export function ScrollableWidget({
  title,
  description,
  badge,
  actionHref,
  actionLabel = "Open full page",
  controls,
  footer,
  className,
  bodyClassName,
  children,
}: ScrollableWidgetProps) {
  return (
    <Card className={cn("flex h-[42rem] flex-col overflow-hidden p-0", className)}>
      <div className="border-b border-[var(--border)] bg-[linear-gradient(180deg,var(--surface)_0%,var(--surface-soft)_100%)] px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            {badge ? (
              <Badge className="border-[var(--border-accent)] bg-[var(--brand-surface)] text-[var(--brand)]">
                {badge}
              </Badge>
            ) : null}
            <div>
              <h2 className="text-xl font-semibold text-[var(--heading)]">{title}</h2>
              <p className="mt-1.5 text-sm leading-6 text-[var(--muted-foreground)]">
                {description}
              </p>
            </div>
          </div>

          {actionHref ? (
            <Link
              href={actionHref}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 text-sm font-semibold text-[var(--heading)] transition-colors hover:bg-[var(--surface-hover)]"
            >
              {actionLabel}
            </Link>
          ) : null}
        </div>

        {controls ? <div className="mt-4">{controls}</div> : null}
      </div>

      <div className={cn("subtle-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4", bodyClassName)}>
        {children}
      </div>

      {footer ? (
        <div className="border-t border-[var(--border)] bg-[var(--surface)] px-5 py-4">{footer}</div>
      ) : null}
    </Card>
  );
}

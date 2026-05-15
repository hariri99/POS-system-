import { Badge } from "@/components/ui/badge";

export function PageHeader({
  eyebrow,
  title,
  description,
  badge,
}: {
  eyebrow: string;
  title: string;
  description: string;
  badge?: string;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-3">
        <span className="section-kicker">{eyebrow}</span>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white lg:text-[2.1rem]">
            {title}
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-[var(--muted-foreground)] lg:text-[0.95rem]">
            {description}
          </p>
        </div>
      </div>
      {badge ? (
        <Badge className="self-start border-[var(--border-strong)] bg-[var(--surface-strong)] text-white lg:self-auto">
          {badge}
        </Badge>
      ) : null}
    </div>
  );
}

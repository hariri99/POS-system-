import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  helper,
  trend = "up",
}: {
  label: string;
  value: string;
  helper: string;
  trend?: "up" | "down";
}) {
  const TrendIcon = trend === "up" ? ArrowUpRight : ArrowDownRight;

  return (
    <Card className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--muted-foreground)]">{label}</p>
        <div
          className={`rounded-xl border p-2 ${
            trend === "up"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
              : "border-amber-500/20 bg-amber-500/10 text-amber-200"
          }`}
        >
          <TrendIcon className="size-4" />
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-3xl font-semibold tracking-[-0.03em] text-[var(--heading)]">{value}</p>
        <p className="text-sm leading-6 text-[var(--muted-foreground)]">{helper}</p>
      </div>
    </Card>
  );
}

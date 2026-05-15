"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export function SalesOverviewChart({
  data,
}: {
  data: Array<{ label: string; revenue: number; transactions: number; netProfit?: number }>;
}) {
  return (
    <Card className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--heading)]">Sales velocity</p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Seven-day revenue and transaction trend for rapid store health checks.
          </p>
        </div>
      </div>
      <div className="h-[280px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <defs>
              <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.26} />
                <stop offset="95%" stopColor="var(--brand)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="label"
              stroke="var(--muted-foreground)"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="var(--muted-foreground)"
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip
              contentStyle={{
                background: "var(--surface-strong)",
                borderRadius: "16px",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
              formatter={(value, name) => {
                const numericValue = typeof value === "number" ? value : Number(value ?? 0);
                if (name === "revenue") {
                  return formatCurrency(numericValue);
                }

                if (name === "netProfit") {
                  return formatCurrency(numericValue);
                }

                return `${numericValue} tx`;
              }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="var(--brand)"
              fillOpacity={1}
              fill="url(#revenue)"
              strokeWidth={2.5}
            />
            {data.some((point) => typeof point.netProfit === "number") ? (
              <Line
                type="monotone"
                dataKey="netProfit"
                stroke="var(--brand-strong)"
                strokeWidth={2.25}
                dot={false}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export function SalesOverviewChart({
  data,
}: {
  data: Array<{ label: string; revenue: number; transactions: number }>;
}) {
  return (
    <Card className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Sales velocity</p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Seven-day revenue and transaction trend for rapid store health checks.
          </p>
        </div>
      </div>
      <div className="h-[280px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#d97706" stopOpacity={0.38} />
                <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="label" stroke="#8d96a6" tickLine={false} axisLine={false} />
            <YAxis
              stroke="#8d96a6"
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip
              contentStyle={{
                background: "#171a20",
                borderRadius: "16px",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
              formatter={(value, name) => {
                const numericValue = typeof value === "number" ? value : Number(value ?? 0);
                return name === "revenue" ? formatCurrency(numericValue) : `${numericValue} tx`;
              }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#f59e0b"
              fillOpacity={1}
              fill="url(#revenue)"
              strokeWidth={2.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

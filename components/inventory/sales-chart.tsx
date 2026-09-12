"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatDate, formatNumber } from "@/lib/format";
import type { SalesPoint } from "@/lib/types";

/**
 * Rendered only when the backend supplies sales history. Loaded lazily by the
 * detail view so Recharts stays out of the initial bundle.
 */
export default function SalesChart({ data }: { data: SalesPoint[] }) {
  const points = data.map((point) => ({
    ...point,
    label: formatDate(point.date),
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="var(--color-line)" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            minTickGap={32}
            tick={{ fill: "var(--color-ink-subtle)", fontSize: 11 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={44}
            tick={{ fill: "var(--color-ink-subtle)", fontSize: 11 }}
          />
          <Tooltip
            cursor={{ stroke: "var(--color-line-strong)" }}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid var(--color-line)",
              fontSize: 12,
              boxShadow: "0 4px 16px rgb(0 0 0 / 0.06)",
            }}
            formatter={(value) => [formatNumber(Number(value)), "Units sold"]}
          />
          <Area
            type="monotone"
            dataKey="units"
            stroke="var(--color-accent)"
            strokeWidth={2}
            fill="url(#salesFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

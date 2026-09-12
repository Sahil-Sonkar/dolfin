import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/ui/badge";
import { Maybe } from "@/components/ui/states";
import { formatDays, formatNumber, formatPerDay } from "@/lib/format";
import type { InventoryResult } from "@/lib/types";

/** Structured inventory result rendered inside a chat turn. */
export function ChatInventoryCard({ item }: { item: InventoryResult }) {
  const rows: Array<{ label: string; value?: string }> = [
    { label: "Stock", value: formatNumber(item.stockLevel) },
    {
      label: "Daily demand",
      value:
        item.averageDailyDemand !== undefined
          ? formatPerDay(item.averageDailyDemand)
          : undefined,
    },
    {
      label: "Stockout",
      value:
        item.daysUntilStockout !== undefined
          ? `~${formatDays(item.daysUntilStockout)}`
          : undefined,
    },
  ];

  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-3">
        <Link
          href={`/inventory/${encodeURIComponent(item.productId)}`}
          className="text-[14px] font-semibold tracking-[-0.01em] hover:text-accent"
        >
          {item.productName}
        </Link>
        <StatusBadge status={item.inventoryStatus} />
      </div>

      <dl className="divide-y divide-line border-t border-line">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-4 px-4 py-2">
            <dt className="text-[12.5px] text-ink-muted">{row.label}</dt>
            <dd className="numeric text-[13px] font-medium">
              <Maybe>{row.value}</Maybe>
            </dd>
          </div>
        ))}

        {item.recommendedQuantity !== undefined ? (
          <div className="flex justify-between gap-4 bg-accent-soft px-4 py-2.5">
            <dt className="text-[12.5px] font-medium text-accent">Recommended</dt>
            <dd className="numeric text-[13.5px] font-semibold text-accent">
              {formatNumber(item.recommendedQuantity)} units
            </dd>
          </div>
        ) : null}
      </dl>

      <Link
        href={`/inventory/${encodeURIComponent(item.productId)}`}
        className="flex items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-[12.5px] font-medium text-ink-muted transition-colors hover:text-ink"
      >
        View product
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}

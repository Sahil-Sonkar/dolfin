import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { formatDays, formatNumber } from "@/lib/format";
import type { PriorityItem } from "@/lib/types";

export function PriorityItems({
  items,
  loading,
}: {
  items?: PriorityItem[];
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Needs attention</CardTitle>
        </div>
        <Link
          href="/inventory"
          className="text-[13px] font-medium text-accent hover:underline"
        >
          All inventory
        </Link>
      </CardHeader>

      {loading ? (
        <div className="divide-y divide-line border-t border-line">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      ) : !items || items.length === 0 ? (
        <div className="border-t border-line">
          <EmptyState
            title="Nothing needs restocking"
            description="The Store Manager hasn't flagged any products as low or at risk."
          />
        </div>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {items.map((item) => (
            <li key={item.productId}>
              <Link
                href={`/inventory/${encodeURIComponent(item.productId)}`}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-muted"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">{item.productName}</p>
                  <p className="numeric mt-1 text-[12.5px] text-ink-muted">
                    {formatNumber(item.stockLevel)} in stock
                    {item.daysUntilStockout !== undefined ? (
                      <> · runs out in {formatDays(item.daysUntilStockout)}</>
                    ) : null}
                  </p>
                </div>

                {item.recommendedQuantity !== undefined ? (
                  <div className="hidden text-right sm:block">
                    <p className="text-[11px] font-medium tracking-[0.04em] text-ink-subtle uppercase">
                      Recommended
                    </p>
                    <p className="numeric text-[14px] font-semibold">
                      {formatNumber(item.recommendedQuantity)} units
                    </p>
                  </div>
                ) : null}

                <StatusBadge status={item.inventoryStatus} />
                <ChevronRight className="size-4 shrink-0 text-ink-subtle" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

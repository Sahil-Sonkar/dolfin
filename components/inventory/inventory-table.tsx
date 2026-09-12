"use client";

import { ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, Maybe, Skeleton } from "@/components/ui/states";
import { fetchInventory } from "@/lib/api";
import { formatDays, formatNumber, formatPerDay } from "@/lib/format";
import type { InventoryStatus } from "@/lib/types";
import { useResource } from "@/lib/use-resource";
import { cn } from "@/lib/utils";

const FILTERS: Array<{ value: "ALL" | InventoryStatus; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "CRITICAL", label: "Critical" },
  { value: "LOW", label: "Low" },
  { value: "OUT_OF_STOCK", label: "Out of stock" },
  { value: "HEALTHY", label: "Healthy" },
];

export function InventoryTable() {
  const { status, data, error, reload } = useResource(fetchInventory);

  const [query, setQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [filter, setFilter] = React.useState<"ALL" | InventoryStatus>("ALL");

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  const rows = React.useMemo(() => {
    if (!data) return [];
    const needle = debouncedQuery.trim().toLowerCase();

    return data.filter((item) => {
      if (filter !== "ALL" && item.inventoryStatus !== filter) return false;
      if (!needle) return true;
      return (
        item.productName.toLowerCase().includes(needle) ||
        item.productId.toLowerCase().includes(needle)
      );
    });
  }, [data, debouncedQuery, filter]);

  if (status === "error") {
    return (
      <Card>
        <ErrorState message={error.message} onRetry={reload} />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products"
            aria-label="Search products"
            className="h-9.5 w-full rounded-lg border border-line bg-surface pr-3 pl-9 text-[13.5px] placeholder:text-ink-subtle"
          />
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              aria-pressed={filter === option.value}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                filter === option.value
                  ? "border-accent-line bg-accent-soft text-accent"
                  : "border-line bg-surface text-ink-muted hover:bg-surface-muted",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        {status === "loading" ? (
          <LoadingRows />
        ) : rows.length === 0 ? (
          <EmptyState
            title={data && data.length > 0 ? "No matching products" : "No inventory yet"}
            description={
              data && data.length > 0
                ? "Try a different search or filter."
                : "The Store Manager didn't return any products for this store."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-[13.5px]">
              <thead>
                <tr className="border-b border-line text-left">
                  <Th className="pl-5">Product</Th>
                  <Th align="right">Stock</Th>
                  <Th>Status</Th>
                  <Th align="right">Demand</Th>
                  <Th align="right">Stockout</Th>
                  <Th align="right">Recommendation</Th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((item) => (
                  <tr key={item.productId} className="group transition-colors hover:bg-surface-muted">
                    <td className="py-3 pl-5">
                      <Link
                        href={`/inventory/${encodeURIComponent(item.productId)}`}
                        className="font-medium hover:text-accent"
                      >
                        {item.productName}
                      </Link>
                      <p className="numeric mt-0.5 text-[12px] text-ink-subtle">
                        {item.productId}
                      </p>
                    </td>
                    <td className="numeric py-3 text-right font-medium">
                      {formatNumber(item.stockLevel)}
                    </td>
                    <td className="py-3 pr-3 pl-4">
                      <StatusBadge status={item.inventoryStatus} />
                    </td>
                    <td className="numeric py-3 text-right text-ink-muted">
                      <Maybe>
                        {item.averageDailyDemand !== undefined
                          ? formatPerDay(item.averageDailyDemand)
                          : undefined}
                      </Maybe>
                    </td>
                    <td className="numeric py-3 text-right text-ink-muted">
                      <Maybe>
                        {item.daysUntilStockout !== undefined
                          ? formatDays(item.daysUntilStockout)
                          : undefined}
                      </Maybe>
                    </td>
                    <td className="numeric py-3 text-right font-medium">
                      <Maybe>
                        {item.recommendedQuantity !== undefined
                          ? `${formatNumber(item.recommendedQuantity)} units`
                          : undefined}
                      </Maybe>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <ChevronRight className="ml-auto size-4 text-ink-subtle" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {status === "ready" && rows.length > 0 ? (
        <p className="numeric text-[12.5px] text-ink-subtle">
          {formatNumber(rows.length)} of {formatNumber(data.length)} products
        </p>
      ) : null}
    </div>
  );
}

function Th({
  children,
  align = "left",
  className,
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "py-2.5 text-[11px] font-semibold tracking-[0.06em] text-ink-subtle uppercase",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

function LoadingRows() {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="flex items-center gap-6 px-5 py-4">
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

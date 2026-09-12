"use client";

import { ArrowLeft, Sparkles } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import * as React from "react";

import { chatHref } from "@/components/chat/prompts";
import { StatusBadge, UrgencyBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, Eyebrow } from "@/components/ui/card";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { fetchProduct } from "@/lib/api";
import { formatDays, formatNumber, formatPerDay } from "@/lib/format";
import type { InventoryResult } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

const SalesChart = dynamic(() => import("@/components/inventory/sales-chart"), {
  ssr: false,
  loading: () => <Skeleton className="h-56 w-full" />,
});

export function ProductDetail({ productId }: { productId: string }) {
  const load = React.useCallback(() => fetchProduct(productId), [productId]);
  const { status, data, error, reload } = useResource(load);

  return (
    <>
      <Link
        href="/inventory"
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        Inventory
      </Link>

      {status === "loading" ? (
        <div className="space-y-6">
          <Skeleton className="h-9 w-72" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-24 rounded-[--radius-card]" />
            ))}
          </div>
        </div>
      ) : status === "error" ? (
        <Card>
          <ErrorState message={error.message} onRetry={reload} />
        </Card>
      ) : (
        <ProductDetailBody product={data} />
      )}
    </>
  );
}

function ProductDetailBody({ product }: { product: InventoryResult }) {
  const metrics: Array<{ label: string; value: string }> = [
    { label: "Current stock", value: formatNumber(product.stockLevel) },
    {
      label: "Reorder point",
      value: product.reorderPoint !== undefined ? formatNumber(product.reorderPoint) : "—",
    },
    {
      label: "Average daily demand",
      value:
        product.averageDailyDemand !== undefined
          ? formatPerDay(product.averageDailyDemand)
          : "—",
    },
    {
      label: "Estimated stockout",
      value:
        product.daysUntilStockout !== undefined
          ? formatDays(product.daysUntilStockout)
          : "—",
    },
    {
      label: "Recommended order",
      value:
        product.recommendedQuantity !== undefined
          ? `${formatNumber(product.recommendedQuantity)} units`
          : "—",
    },
    {
      label: "30-day forecast",
      value:
        product.demandForecast30d !== undefined
          ? `${formatNumber(product.demandForecast30d)} units`
          : "—",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.025em]">
            {product.productName}
          </h1>
          <p className="numeric mt-1.5 text-[13px] text-ink-subtle">{product.productId}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={product.inventoryStatus} />
          {product.urgency ? <UrgencyBadge urgency={product.urgency} /> : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {metrics.map((metric) => (
          <Card key={metric.label} className="px-4 py-4">
            <Eyebrow>{metric.label}</Eyebrow>
            <p className="numeric mt-2 text-[24px] leading-none font-semibold tracking-[-0.025em]">
              {metric.value === "—" ? (
                <span className="text-[18px] text-ink-subtle">—</span>
              ) : (
                metric.value
              )}
            </p>
          </Card>
        ))}
      </div>

      {product.reasoning ? (
        <Card className="border-accent-line bg-accent-soft">
          <CardContent className="pt-5">
            <Eyebrow className="text-accent/70">Why Dolfin says this</Eyebrow>
            <p className="mt-2 text-[14px] leading-relaxed text-ink">{product.reasoning}</p>
          </CardContent>
        </Card>
      ) : null}

      {product.salesHistory && product.salesHistory.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Sales trend</CardTitle>
          </CardHeader>
          <CardContent>
            <SalesChart data={product.salesHistory} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-5">
          <div>
            <p className="text-[14px] font-medium">Need a supplier for this?</p>
            <p className="mt-0.5 text-[13px] text-ink-muted">
              Ask Dolfin to compare vendors and prepare a purchase order.
            </p>
          </div>
          <Button variant="secondary" asChild>
            <Link href={chatHref(`Who should I buy ${product.productName} from?`)}>
              <Sparkles />
              Ask Dolfin
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, Maybe, Skeleton } from "@/components/ui/states";
import { fetchVendors } from "@/lib/api";
import { formatDays, formatNumber, formatPercent } from "@/lib/format";
import { useResource } from "@/lib/use-resource";
import { cn } from "@/lib/utils";

export function VendorTable() {
  const { status, data, error, reload } = useResource(fetchVendors);

  if (status === "error") {
    return (
      <Card>
        <ErrorState message={error.message} onRetry={reload} />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      {status === "loading" ? (
        <div className="divide-y divide-line">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="flex items-center gap-6 px-5 py-4">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      ) : data.length === 0 ? (
        <EmptyState
          title="No suppliers yet"
          description="The Store Manager didn't return any vendors for this store."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[13.5px]">
            <thead>
              <tr className="border-b border-line">
                <Th className="pl-5">Vendor</Th>
                <Th align="right">Reliability</Th>
                <Th align="right">Avg. lead time</Th>
                <Th align="right">Products</Th>
                <Th className="pr-5">Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.map((vendor) => (
                <tr key={vendor.vendorId} className="transition-colors hover:bg-surface-muted">
                  <td className="py-3 pl-5">
                    <p className="font-medium">{vendor.name}</p>
                    <p className="mt-0.5 text-[12px] text-ink-subtle">
                      {[vendor.category, vendor.city].filter(Boolean).join(" · ") ||
                        vendor.vendorId}
                    </p>
                  </td>
                  <td className="numeric py-3 text-right font-medium">
                    <Maybe>
                      {vendor.reliabilityScore !== undefined
                        ? formatPercent(vendor.reliabilityScore)
                        : undefined}
                    </Maybe>
                  </td>
                  <td className="numeric py-3 text-right text-ink-muted">
                    <Maybe>
                      {vendor.averageLeadTimeDays !== undefined
                        ? formatDays(vendor.averageLeadTimeDays)
                        : undefined}
                    </Maybe>
                  </td>
                  <td className="numeric py-3 text-right text-ink-muted">
                    <Maybe>
                      {vendor.productCount !== undefined
                        ? formatNumber(vendor.productCount)
                        : undefined}
                    </Maybe>
                  </td>
                  <td className="py-3 pr-5 pl-4">
                    <Badge tone={vendor.active ? "positive" : "neutral"}>
                      {vendor.active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
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

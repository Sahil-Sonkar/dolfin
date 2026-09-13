"use client";

import { RecommendationCard } from "@/components/procurement/recommendation-card";
import { ProcurementStatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { fetchProcurement } from "@/lib/api";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { useResource } from "@/lib/use-resource";

export function ProcurementView() {
  const { status, data, error, reload } = useResource(fetchProcurement);

  if (status === "error") {
    return (
      <Card>
        <ErrorState message={error.message} onRetry={reload} />
      </Card>
    );
  }

  const pending =
    data?.recommendations.filter(
      (recommendation) =>
        recommendation.status === "PENDING_APPROVAL" ||
        recommendation.status === "RECOMMENDED",
    ) ?? [];

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-4 text-[15px] font-semibold tracking-[-0.01em]">
          Pending approval
        </h2>

        {status === "loading" ? (
          <div className="space-y-3">
            <p className="text-[13px] text-ink-muted">
              Asking the Store Manager for purchase recommendations. First load can take up to a
              minute.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {[0, 1].map((index) => (
                <Skeleton key={index} className="h-56 rounded-[--radius-card]" />
              ))}
            </div>
          </div>
        ) : pending.length === 0 ? (
          <Card>
            <EmptyState
              title="Nothing waiting on you"
              description="The Store Manager has no procurement recommendations pending approval."
            />
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {pending.map((recommendation) => (
              <RecommendationCard
                key={recommendation.recommendationId}
                recommendation={recommendation}
                onResolved={reload}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-[15px] font-semibold tracking-[-0.01em]">
          Purchase history
        </h2>

        <Card className="overflow-hidden">
          {status === "loading" ? (
            <div className="divide-y divide-line">
              {[0, 1, 2].map((index) => (
                <div key={index} className="flex items-center gap-6 px-5 py-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : data.purchaseOrders.length === 0 ? (
            <EmptyState
              title="No purchase orders yet"
              description="Orders you approve will be recorded here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-[13.5px]">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th
                      scope="col"
                      className="py-2.5 pl-5 text-[11px] font-semibold tracking-[0.06em] text-ink-subtle uppercase"
                    >
                      Order
                    </th>
                    <th
                      scope="col"
                      className="py-2.5 text-[11px] font-semibold tracking-[0.06em] text-ink-subtle uppercase"
                    >
                      Vendor
                    </th>
                    <th
                      scope="col"
                      className="py-2.5 text-[11px] font-semibold tracking-[0.06em] text-ink-subtle uppercase"
                    >
                      Product
                    </th>
                    <th
                      scope="col"
                      className="py-2.5 text-right text-[11px] font-semibold tracking-[0.06em] text-ink-subtle uppercase"
                    >
                      Total
                    </th>
                    <th
                      scope="col"
                      className="py-2.5 pr-5 pl-4 text-[11px] font-semibold tracking-[0.06em] text-ink-subtle uppercase"
                    >
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.purchaseOrders.map((order) => (
                    <tr key={order.poId}>
                      <td className="numeric py-3 pl-5 font-medium">{order.poId}</td>
                      <td className="py-3">{order.vendorName}</td>
                      <td className="py-3">
                        {order.productName}
                        <span className="numeric text-ink-subtle">
                          {" "}
                          · {formatNumber(order.quantity)} units
                        </span>
                      </td>
                      <td className="numeric py-3 text-right font-medium">
                        {formatCurrency(order.totalCost)}
                      </td>
                      <td className="py-3 pr-5 pl-4">
                        <div className="flex flex-col items-start gap-1">
                          <ProcurementStatusBadge status={order.status} />
                          <span className="text-[11.5px] text-ink-subtle">
                            {formatDate(order.createdAt)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

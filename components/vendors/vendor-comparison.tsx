import { Star } from "lucide-react";

import { Eyebrow } from "@/components/ui/card";
import { Maybe } from "@/components/ui/states";
import { formatCurrency, formatDays, formatPercent } from "@/lib/format";
import type { VendorRecommendation } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Side-by-side supplier comparison.
 *
 * The recommended vendor is whichever one the Store Manager returned. Dolfin
 * never re-ranks the options or computes its own winner — it only emphasises
 * the decision that came back.
 */
export function VendorComparison({
  recommendation,
}: {
  recommendation: VendorRecommendation;
}) {
  const columns = [
    {
      vendorId: recommendation.vendorId,
      vendorName: recommendation.vendorName,
      unitCost: recommendation.unitCost,
      leadTimeDays: recommendation.leadTimeDays,
      reliabilityScore: recommendation.reliabilityScore,
      recommended: true,
    },
    ...(recommendation.alternatives ?? []).map((alternative) => ({
      vendorId: alternative.vendorId,
      vendorName: alternative.vendorName,
      unitCost: alternative.unitCost,
      leadTimeDays: alternative.leadTimeDays,
      reliabilityScore: alternative.reliabilityScore,
      recommended: false,
    })),
  ];

  const rows = [
    { label: "Price", render: (column: (typeof columns)[number]) => formatCurrency(column.unitCost) },
    {
      label: "Lead time",
      render: (column: (typeof columns)[number]) => formatDays(column.leadTimeDays),
    },
    {
      label: "Reliability",
      render: (column: (typeof columns)[number]) => formatPercent(column.reliabilityScore),
    },
  ];

  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="px-4 pt-4">
        <Eyebrow>Compare suppliers</Eyebrow>
      </div>

      <div className="overflow-x-auto p-4">
        <table className="w-full min-w-[420px] border-collapse text-[13px]">
          <caption className="sr-only">
            Supplier comparison. {recommendation.vendorName} is recommended by the Store
            Manager.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="w-24" />
              {columns.map((column) => (
                <th
                  key={column.vendorId}
                  scope="col"
                  className={cn(
                    "rounded-t-lg px-3 pt-2.5 pb-2 text-left align-bottom text-[13px] font-semibold",
                    column.recommended && "bg-accent-soft text-accent",
                  )}
                >
                  {column.vendorName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-line">
                <th
                  scope="row"
                  className="py-2.5 pr-3 text-left text-[12.5px] font-normal text-ink-muted"
                >
                  {row.label}
                </th>
                {columns.map((column) => (
                  <td
                    key={column.vendorId}
                    className={cn(
                      "numeric px-3 py-2.5 font-medium",
                      column.recommended && "bg-accent-soft",
                    )}
                  >
                    <Maybe>{row.render(column)}</Maybe>
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t border-line">
              <td />
              {columns.map((column) => (
                <td
                  key={column.vendorId}
                  className={cn(
                    "rounded-b-lg px-3 py-2.5",
                    column.recommended && "bg-accent-soft",
                  )}
                >
                  {column.recommended ? (
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent">
                      <Star className="size-3.5 fill-current" />
                      Recommended
                    </span>
                  ) : null}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {recommendation.reason ? (
        <p className="border-t border-line px-4 py-3 text-[13px] leading-relaxed text-ink-muted">
          {recommendation.reason}
        </p>
      ) : null}
    </div>
  );
}

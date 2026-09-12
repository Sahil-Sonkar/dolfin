import { ApprovalDialog } from "@/components/procurement/approval-dialog";
import { ProcurementStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Eyebrow } from "@/components/ui/card";
import { Maybe } from "@/components/ui/states";
import { formatCurrency, formatDays, formatNumber, formatPercent } from "@/lib/format";
import type { ProcurementRecommendation } from "@/lib/types";

export function RecommendationCard({
  recommendation,
  onResolved,
}: {
  recommendation: ProcurementRecommendation;
  onResolved?: () => void;
}) {
  const decided =
    recommendation.status === "CREATED" ||
    recommendation.status === "REJECTED" ||
    recommendation.status === "APPROVED";

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold tracking-[-0.01em]">
              {recommendation.productName}
            </h3>
            <p className="numeric mt-1 text-[13px] text-ink-muted">
              {formatNumber(recommendation.quantity)} units · {recommendation.vendorName}
            </p>
          </div>
          <ProcurementStatusBadge status={recommendation.status} />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 border-y border-line py-3.5">
          <Figure label="Total" value={formatCurrency(recommendation.totalCost)} />
          <Figure label="Delivery" value={formatDays(recommendation.leadTimeDays)} />
          <Figure
            label="Reliability"
            value={formatPercent(recommendation.reliabilityScore)}
          />
        </div>

        {recommendation.reason ? (
          <p className="mt-3.5 line-clamp-2 text-[13px] leading-relaxed text-ink-muted">
            {recommendation.reason}
          </p>
        ) : null}

        <div className="mt-4">
          {decided ? (
            <p className="text-[13px] text-ink-subtle">
              {recommendation.status === "REJECTED"
                ? "You rejected this recommendation."
                : "A purchase order has been created."}
            </p>
          ) : (
            <ApprovalDialog
              recommendation={recommendation}
              onResolved={onResolved}
              trigger={<Button size="sm">Review</Button>}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <p className="numeric mt-1 text-[15px] font-semibold tracking-[-0.01em]">
        <Maybe>{value}</Maybe>
      </p>
    </div>
  );
}

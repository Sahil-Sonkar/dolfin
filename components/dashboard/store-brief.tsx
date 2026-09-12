import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/states";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { StoreBrief } from "@/lib/types";

/**
 * The dominant element on the dashboard: what the Store Manager concluded about
 * today, in sentences rather than figures on tiles.
 */
export function StoreBriefCard({
  brief,
  loading,
  hasRecommendations,
}: {
  brief?: StoreBrief;
  loading?: boolean;
  hasRecommendations?: boolean;
}) {
  const lines = brief
    ? [
        brief.productsNeedingAttention !== undefined
          ? `${formatNumber(brief.productsNeedingAttention)} ${brief.productsNeedingAttention === 1 ? "product needs" : "products need"} your attention.`
          : null,
        brief.stockoutsWithinThreeDays !== undefined && brief.stockoutsWithinThreeDays > 0
          ? `${formatNumber(brief.stockoutsWithinThreeDays)} could stock out within 3 days.`
          : null,
        brief.readyRecommendations !== undefined
          ? `${formatNumber(brief.readyRecommendations)} procurement ${brief.readyRecommendations === 1 ? "recommendation is" : "recommendations are"} ready.`
          : null,
      ].filter((line): line is string => line !== null)
    : [];

  return (
    <section className="card-shadow relative overflow-hidden rounded-[--radius-card] border border-accent-line bg-accent-soft p-6 sm:p-8">
      <Eyebrow className="text-accent/70">Today&rsquo;s store brief</Eyebrow>

      {loading ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-7 w-4/5 bg-white/45" />
          <Skeleton className="h-7 w-3/5 bg-white/45" />
          <Skeleton className="h-7 w-2/5 bg-white/45" />
        </div>
      ) : (
        <>
          {brief?.headline ? (
            <p className="mt-4 max-w-2xl text-[19px] leading-[1.5] font-medium tracking-[-0.015em] text-ink sm:text-[21px]">
              {brief.headline}
            </p>
          ) : lines.length > 0 ? (
            <div className="mt-4 max-w-2xl space-y-1.5">
              {lines.map((line) => (
                <p
                  key={line}
                  className="text-[19px] leading-[1.45] font-medium tracking-[-0.015em] text-ink sm:text-[21px]"
                >
                  {line}
                </p>
              ))}
            </div>
          ) : (
            <p className="mt-4 max-w-2xl text-[17px] leading-[1.5] text-ink-muted">
              The Store Manager hasn&rsquo;t flagged anything for today.
            </p>
          )}

          {brief?.recommendedPurchaseValue !== undefined ? (
            <p className="numeric mt-5 text-[15px] text-accent">
              <span className="text-[22px] font-semibold tracking-[-0.02em]">
                {formatCurrency(brief.recommendedPurchaseValue)}
              </span>{" "}
              <span className="text-ink-muted">recommended purchase value</span>
            </p>
          ) : null}
        </>
      )}

      {hasRecommendations ? (
        <Button className="mt-6" asChild>
          <Link href="/procurement">
            Review recommendations
            <ArrowRight />
          </Link>
        </Button>
      ) : null}
    </section>
  );
}

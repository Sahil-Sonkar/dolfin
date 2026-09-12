import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/states";
import { formatNumber } from "@/lib/format";
import type { DashboardKpis } from "@/lib/types";

const CARDS: Array<{ key: keyof DashboardKpis; label: string; suffix?: string }> = [
  { key: "inventoryHealthPercent", label: "Inventory health", suffix: "%" },
  { key: "itemsToRestock", label: "Items to restock" },
  { key: "stockoutRisks", label: "Stockout risks" },
  { key: "pendingPurchases", label: "Pending purchases" },
];

export function KpiCards({ kpis }: { kpis?: DashboardKpis }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {CARDS.map((card) => {
        const value = kpis?.[card.key];

        return (
          <Card key={card.key} className="px-4 py-4">
            <p className="text-[12.5px] font-medium text-ink-muted">{card.label}</p>
            {kpis === undefined ? (
              <Skeleton className="mt-2.5 h-8 w-16" />
            ) : (
              <p className="numeric mt-1.5 text-[28px] leading-none font-semibold tracking-[-0.03em]">
                {value === undefined ? (
                  <span className="text-[20px] text-ink-subtle">—</span>
                ) : (
                  <>
                    {formatNumber(value)}
                    {card.suffix ? (
                      <span className="text-[18px] text-ink-subtle">{card.suffix}</span>
                    ) : null}
                  </>
                )}
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}

"use client";

import { Check, CircleCheck, Loader2 } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Eyebrow } from "@/components/ui/card";
import { Maybe } from "@/components/ui/states";
import { createPurchaseOrder, DolfinApiError } from "@/lib/api";
import { formatCurrency, formatDate, formatDays, formatNumber, formatPercent } from "@/lib/format";
import type { ProcurementRecommendation, PurchaseOrder } from "@/lib/types";

type Phase =
  | { name: "review" }
  | { name: "submitting"; approved: boolean }
  | { name: "approved"; purchaseOrder: PurchaseOrder }
  | { name: "rejected" }
  | { name: "error"; message: string };

/**
 * Review and approval for a single recommendation.
 *
 * Nothing is approved implicitly: the merchant opens the recommendation, reads
 * the Store Manager's reasoning, and presses a button. The dialog owns the whole
 * lifecycle so the same flow works from procurement and from chat.
 */
export function ApprovalDialog({
  recommendation,
  trigger,
  onResolved,
}: {
  recommendation: ProcurementRecommendation;
  trigger: React.ReactNode;
  onResolved?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>({ name: "review" });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // A completed decision refreshes the caller's data on close.
      if (phase.name === "approved" || phase.name === "rejected") onResolved?.();
      setPhase({ name: "review" });
    }
  }

  async function decide(approved: boolean) {
    setPhase({ name: "submitting", approved });

    try {
      const result = await createPurchaseOrder(recommendation.recommendationId, approved);

      if (approved && result.purchaseOrder) {
        setPhase({ name: "approved", purchaseOrder: result.purchaseOrder });
      } else if (approved) {
        setPhase({
          name: "error",
          message: "The purchase order could not be created. Your recommendation is still available.",
        });
      } else {
        setPhase({ name: "rejected" });
      }
    } catch (error) {
      setPhase({
        name: "error",
        message:
          error instanceof DolfinApiError
            ? error.message
            : "The purchase order could not be created. Your recommendation is still available.",
      });
    }
  }

  const submitting = phase.name === "submitting";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent>
        {phase.name === "approved" ? (
          <PurchaseOrderCreated
            purchaseOrder={phase.purchaseOrder}
            onClose={() => handleOpenChange(false)}
          />
        ) : (
          <>
            <DialogHeader>
              <Eyebrow className="mb-1.5">AI procurement recommendation</Eyebrow>
              <DialogTitle>{recommendation.productName}</DialogTitle>
              <DialogDescription>
                Review the details before this becomes a purchase order.
              </DialogDescription>
            </DialogHeader>

            <DialogBody>
              <dl className="divide-y divide-line border-y border-line">
                <Row
                  label="Current stock"
                  value={
                    recommendation.currentStock !== undefined
                      ? formatNumber(recommendation.currentStock)
                      : undefined
                  }
                />
                <Row
                  label="Recommended order"
                  value={`${formatNumber(recommendation.quantity)} units`}
                  emphasis
                />
                <Row label="Vendor" value={recommendation.vendorName} />
                <Row label="Unit price" value={formatCurrency(recommendation.unitCost)} />
                <Row
                  label="Total"
                  value={formatCurrency(recommendation.totalCost)}
                  emphasis
                />
                <Row label="Delivery" value={formatDays(recommendation.leadTimeDays)} />
                <Row
                  label="Reliability"
                  value={formatPercent(recommendation.reliabilityScore)}
                />
              </dl>

              {recommendation.reason ? (
                <div className="mt-5 rounded-xl border border-accent-line bg-accent-soft p-4">
                  <Eyebrow className="text-accent/70">Why Dolfin recommends this</Eyebrow>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-ink">
                    {recommendation.reason}
                  </p>
                </div>
              ) : null}

              {phase.name === "rejected" ? (
                <p className="mt-5 rounded-lg border border-line bg-surface-muted px-4 py-3 text-[13px] text-ink-muted">
                  Recommendation rejected. No purchase order was created.
                </p>
              ) : null}

              {phase.name === "error" ? (
                <p
                  role="alert"
                  className="mt-5 rounded-lg border border-critical-line bg-critical-soft px-4 py-3 text-[13px] text-critical"
                >
                  {phase.message}
                </p>
              ) : null}
            </DialogBody>

            <DialogFooter>
              {phase.name === "rejected" ? (
                <Button variant="secondary" onClick={() => handleOpenChange(false)}>
                  Close
                </Button>
              ) : (
                <>
                  <Button
                    variant="danger"
                    onClick={() => decide(false)}
                    disabled={submitting}
                  >
                    {phase.name === "submitting" && !phase.approved ? (
                      <Loader2 className="animate-spin" />
                    ) : null}
                    Reject
                  </Button>
                  <Button onClick={() => decide(true)} disabled={submitting}>
                    {phase.name === "submitting" && phase.approved ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Check />
                    )}
                    Approve purchase
                  </Button>
                </>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  value,
  emphasis,
}: {
  label: string;
  value?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-2.5">
      <dt className="text-[13px] text-ink-muted">{label}</dt>
      <dd
        className={
          emphasis
            ? "numeric text-[15px] font-semibold tracking-[-0.01em]"
            : "numeric text-[13.5px] font-medium"
        }
      >
        <Maybe>{value}</Maybe>
      </dd>
    </div>
  );
}

function PurchaseOrderCreated({
  purchaseOrder,
  onClose,
}: {
  purchaseOrder: PurchaseOrder;
  onClose: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <div className="flex size-11 items-center justify-center rounded-xl border border-positive-line bg-positive-soft text-positive">
          <CircleCheck className="size-5" />
        </div>
        <DialogTitle className="sr-only">Purchase order created</DialogTitle>
      </DialogHeader>

      <DialogBody>
        <p className="text-lg font-semibold tracking-[-0.015em]">Purchase order created</p>
        <p className="numeric mt-1 text-[14px] text-ink-muted">{purchaseOrder.poId}</p>

        <dl className="mt-5 divide-y divide-line border-y border-line">
          <Row label="Vendor" value={purchaseOrder.vendorName} />
          <Row label="Product" value={purchaseOrder.productName} />
          <Row
            label="Quantity"
            value={`${formatNumber(purchaseOrder.quantity)} units`}
          />
          <Row label="Total" value={formatCurrency(purchaseOrder.totalCost)} emphasis />
          <Row
            label="Expected delivery"
            value={formatDate(purchaseOrder.expectedDeliveryDate)}
          />
        </dl>
      </DialogBody>

      <DialogFooter>
        <Button onClick={onClose}>View purchase orders</Button>
      </DialogFooter>
    </>
  );
}

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import type { InventoryStatus, ProcurementStatus, Urgency } from "@/lib/types";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-line bg-surface-muted text-ink-muted",
        accent: "border-accent-line bg-accent-soft text-accent",
        positive: "border-positive-line bg-positive-soft text-positive",
        warning: "border-warning-line bg-warning-soft text-warning",
        critical: "border-critical-line bg-critical-soft text-critical",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

const INVENTORY_STATUS_LABEL: Record<InventoryStatus, string> = {
  HEALTHY: "Healthy",
  LOW: "Low",
  CRITICAL: "Critical",
  OUT_OF_STOCK: "Out of stock",
};

const INVENTORY_STATUS_TONE: Record<InventoryStatus, VariantProps<typeof badgeVariants>["tone"]> = {
  HEALTHY: "positive",
  LOW: "warning",
  CRITICAL: "critical",
  OUT_OF_STOCK: "critical",
};

/**
 * The dot carries no information on its own — the text label is always present,
 * so the badge is readable without colour vision.
 */
export function StatusBadge({ status }: { status: InventoryStatus }) {
  return (
    <Badge tone={INVENTORY_STATUS_TONE[status]}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {INVENTORY_STATUS_LABEL[status]}
    </Badge>
  );
}

const URGENCY_TONE: Record<Urgency, VariantProps<typeof badgeVariants>["tone"]> = {
  LOW: "neutral",
  MEDIUM: "warning",
  HIGH: "critical",
  CRITICAL: "critical",
};

const URGENCY_LABEL: Record<Urgency, string> = {
  LOW: "Low priority",
  MEDIUM: "Medium priority",
  HIGH: "High priority",
  CRITICAL: "Urgent",
};

export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  return <Badge tone={URGENCY_TONE[urgency]}>{URGENCY_LABEL[urgency]}</Badge>;
}

const PROCUREMENT_LABEL: Record<ProcurementStatus, string> = {
  RECOMMENDED: "Recommended",
  PENDING_APPROVAL: "Awaiting approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CREATED: "Ordered",
};

const PROCUREMENT_TONE: Record<ProcurementStatus, VariantProps<typeof badgeVariants>["tone"]> = {
  RECOMMENDED: "accent",
  PENDING_APPROVAL: "warning",
  APPROVED: "positive",
  REJECTED: "neutral",
  CREATED: "positive",
};

export function ProcurementStatusBadge({ status }: { status: ProcurementStatus }) {
  return <Badge tone={PROCUREMENT_TONE[status]}>{PROCUREMENT_LABEL[status]}</Badge>;
}

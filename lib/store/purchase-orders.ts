import "server-only";

/**
 * Purchase-order records.
 *
 * These are not business *data* in the sense of inventory or pricing — they are
 * the record of decisions the merchant made in this application. Nothing is
 * seeded: the store starts empty and only ever contains orders created by a
 * real approval.
 *
 * The MVP keeps them in memory, which means they do not survive a redeploy and
 * are not shared between serverless instances. Swapping in a database means
 * replacing this one module; no caller needs to change.
 */

import type { ProcurementRecommendation, PurchaseOrder } from "@/lib/types";

type Decision = "APPROVED" | "REJECTED";

interface Store {
  purchaseOrders: Map<string, PurchaseOrder>;
  decisions: Map<string, Decision>;
  sequence: number;
}

/**
 * Held on `globalThis` so the dev server's hot reload does not discard records
 * between requests.
 */
const globalForStore = globalThis as unknown as { __dolfinStore?: Store };

const store: Store =
  globalForStore.__dolfinStore ??
  (globalForStore.__dolfinStore = {
    purchaseOrders: new Map(),
    decisions: new Map(),
    sequence: 10_023,
  });

export function getDecision(recommendationId: string): Decision | undefined {
  return store.decisions.get(recommendationId);
}

export function recordRejection(recommendationId: string): void {
  store.decisions.set(recommendationId, "REJECTED");
}

export function createPurchaseOrder(
  recommendation: ProcurementRecommendation,
): PurchaseOrder {
  store.sequence += 1;

  const createdAt = new Date();
  const expectedDelivery = new Date(createdAt);
  expectedDelivery.setDate(expectedDelivery.getDate() + Math.max(0, Math.round(recommendation.leadTimeDays)));

  const purchaseOrder: PurchaseOrder = {
    poId: `PO-${store.sequence}`,
    recommendationId: recommendation.recommendationId,
    productId: recommendation.productId,
    productName: recommendation.productName,
    quantity: recommendation.quantity,
    vendorId: recommendation.vendorId,
    vendorName: recommendation.vendorName,
    unitCost: recommendation.unitCost,
    totalCost: recommendation.totalCost,
    leadTimeDays: recommendation.leadTimeDays,
    expectedDeliveryDate: expectedDelivery.toISOString(),
    status: "CREATED",
    createdAt: createdAt.toISOString(),
  };

  store.purchaseOrders.set(purchaseOrder.poId, purchaseOrder);
  store.decisions.set(recommendation.recommendationId, "APPROVED");

  return purchaseOrder;
}

export function listPurchaseOrders(): PurchaseOrder[] {
  return Array.from(store.purchaseOrders.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function getPurchaseOrder(poId: string): PurchaseOrder | undefined {
  return store.purchaseOrders.get(poId);
}

export function findPurchaseOrderByRecommendation(
  recommendationId: string,
): PurchaseOrder | undefined {
  return Array.from(store.purchaseOrders.values()).find(
    (order) => order.recommendationId === recommendationId,
  );
}

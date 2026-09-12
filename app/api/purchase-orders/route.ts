import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse, handleRouteError, readJson } from "@/lib/api-response";
import { getMerchantId } from "@/lib/config";
import { fetchRecommendation, submitProcurementDecision } from "@/lib/phinite/client";
import {
  createPurchaseOrder,
  findPurchaseOrderByRecommendation,
  getDecision,
  listPurchaseOrders,
  recordRejection,
} from "@/lib/store/purchase-orders";

/**
 * Approval endpoint.
 *
 * A purchase order is only ever created from an explicit merchant approval, and
 * only after the recommendation has been re-read from the backend — the browser
 * does not get to describe what it is approving.
 */

export const maxDuration = 120;

const DecisionSchema = z.object({
  recommendationId: z.string().min(1),
  approved: z.boolean(),
  merchantId: z.string().min(1).optional(),
});

export async function GET() {
  return NextResponse.json({ purchaseOrders: listPurchaseOrders() });
}

export async function POST(request: Request) {
  const body = await readJson(request);
  const parsed = DecisionSchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse(
      "INVALID_REQUEST",
      "That request didn't look right. Please try again.",
      400,
    );
  }

  const { recommendationId, approved } = parsed.data;
  const merchantId = parsed.data.merchantId ?? getMerchantId();

  const existingDecision = getDecision(recommendationId);
  if (existingDecision) {
    const existingOrder = findPurchaseOrderByRecommendation(recommendationId);
    return NextResponse.json(
      {
        error: {
          kind: "CONFLICT",
          message:
            existingDecision === "APPROVED"
              ? "This recommendation has already been approved."
              : "This recommendation has already been rejected.",
        },
        purchaseOrder: existingOrder ?? null,
      },
      { status: 409 },
    );
  }

  try {
    const recommendation = await fetchRecommendation(merchantId, recommendationId);

    if (!recommendation) {
      return errorResponse(
        "NOT_FOUND",
        "That recommendation is no longer available. Please refresh and try again.",
        404,
      );
    }

    if (!approved) {
      await submitProcurementDecision(merchantId, recommendationId, false);
      recordRejection(recommendationId);
      return NextResponse.json({ success: true, status: "REJECTED" });
    }

    // The backend must acknowledge the approval before a purchase order is
    // recorded, so the merchant is never shown an order the store manager has
    // no knowledge of.
    await submitProcurementDecision(merchantId, recommendationId, true);

    const purchaseOrder = createPurchaseOrder(recommendation);

    return NextResponse.json({ success: true, purchaseOrder }, { status: 201 });
  } catch (error) {
    // Any failure here leaves the recommendation untouched and re-approvable.
    return handleRouteError("POST /api/purchase-orders", error);
  }
}

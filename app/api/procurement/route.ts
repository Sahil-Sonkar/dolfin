import { cachedJson, handleRouteError, wantsRefresh } from "@/lib/api-response";
import { getMerchantId } from "@/lib/config";
import { fetchProcurement } from "@/lib/phinite/client";
import { getDecision, listPurchaseOrders } from "@/lib/store/purchase-orders";

/**
 * Recommendations come from the backend; the decision each one has already
 * received comes from this application's own record.
 */

export async function GET(request: Request) {
  const merchantId =
    new URL(request.url).searchParams.get("merchantId") ?? getMerchantId();

  try {
    const { data, cached } = await fetchProcurement(merchantId, { refresh: wantsRefresh(request) });
    const recommendations = data.map((recommendation) => {
      const decision = getDecision(recommendation.recommendationId);
      if (!decision) return recommendation;
      return {
        ...recommendation,
        status: decision === "APPROVED" ? ("CREATED" as const) : ("REJECTED" as const),
      };
    });

    return cachedJson(
      {
        recommendations,
        purchaseOrders: listPurchaseOrders(),
      },
      cached,
    );
  } catch (error) {
    return handleRouteError("GET /api/procurement", error);
  }
}

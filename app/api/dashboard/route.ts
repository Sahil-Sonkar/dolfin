import { cachedJson, handleRouteError, wantsRefresh } from "@/lib/api-response";
import { getMerchantId } from "@/lib/config";
import { fetchDashboard } from "@/lib/phinite/client";

/**
 * The dashboard's own data layer, so the overview never depends on the merchant
 * having sent a chat message first.
 */

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const merchantId = params.get("merchantId") ?? getMerchantId();

  try {
    const { data, cached } = await fetchDashboard(merchantId, { refresh: wantsRefresh(request) });
    return cachedJson(data, cached);
  } catch (error) {
    return handleRouteError("GET /api/dashboard", error);
  }
}

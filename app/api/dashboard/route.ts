import { cachedJson, handleRouteError, wantsRefresh } from "@/lib/api-response";
import { getMerchantId } from "@/lib/config";
import { fetchDashboard } from "@/lib/phinite/client";

export const maxDuration = 120;

/**
 * The dashboard's own data layer, so the overview never depends on the merchant
 * having sent a chat message first.
 */

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const merchantId = params.get("merchantId") ?? getMerchantId();
  const refresh = wantsRefresh(request);

  try {
    const { data, cached } = await fetchDashboard(merchantId, { refresh });
    return cachedJson(data, cached, { refresh });
  } catch (error) {
    return handleRouteError("GET /api/dashboard", error);
  }
}

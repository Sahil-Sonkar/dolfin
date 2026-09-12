import { cachedJson, handleRouteError, wantsRefresh } from "@/lib/api-response";
import { getMerchantId } from "@/lib/config";
import { fetchVendors } from "@/lib/phinite/client";

export const maxDuration = 120;

export async function GET(request: Request) {
  const refresh = wantsRefresh(request);
  const merchantId =
    new URL(request.url).searchParams.get("merchantId") ?? getMerchantId();

  try {
    const { data, cached } = await fetchVendors(merchantId, { refresh });
    return cachedJson({ vendors: data }, cached, { refresh });
  } catch (error) {
    return handleRouteError("GET /api/vendors", error);
  }
}

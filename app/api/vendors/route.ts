import { cachedJson, handleRouteError, wantsRefresh } from "@/lib/api-response";
import { getMerchantId } from "@/lib/config";
import { fetchVendors } from "@/lib/phinite/client";

export async function GET(request: Request) {
  const merchantId =
    new URL(request.url).searchParams.get("merchantId") ?? getMerchantId();

  try {
    const { data, cached } = await fetchVendors(merchantId, { refresh: wantsRefresh(request) });
    return cachedJson({ vendors: data }, cached);
  } catch (error) {
    return handleRouteError("GET /api/vendors", error);
  }
}

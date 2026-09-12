import { NextResponse } from "next/server";

import { cachedJson, handleRouteError, wantsRefresh } from "@/lib/api-response";
import { getMerchantId } from "@/lib/config";
import { fetchInventory, fetchProduct } from "@/lib/phinite/client";

export const maxDuration = 120;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const merchantId = params.get("merchantId") ?? getMerchantId();
  const productId = params.get("productId");
  const refresh = wantsRefresh(request);

  try {
    if (productId) {
      const { data: product, cached } = await fetchProduct(merchantId, productId, { refresh });

      if (!product) {
        return NextResponse.json(
          { error: { kind: "NOT_FOUND", message: "That product isn't in your inventory." } },
          { status: 404 },
        );
      }

      return cachedJson(product, cached, { refresh });
    }

    const { data, cached } = await fetchInventory(merchantId, { refresh });
    return cachedJson({ inventory: data }, cached, { refresh });
  } catch (error) {
    return handleRouteError("GET /api/inventory", error);
  }
}

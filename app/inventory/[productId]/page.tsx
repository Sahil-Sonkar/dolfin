import type { Metadata } from "next";

import { ProductDetail } from "@/components/inventory/product-detail";
import { Card } from "@/components/ui/card";
import { NotConfiguredState } from "@/components/ui/states";
import { isPhiniteConfigured } from "@/lib/config";

export const metadata: Metadata = { title: "Product" };

export const dynamic = "force-dynamic";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;

  if (!isPhiniteConfigured()) {
    return (
      <Card>
        <NotConfiguredState surface="Product detail" />
      </Card>
    );
  }

  return <ProductDetail productId={decodeURIComponent(productId)} />;
}

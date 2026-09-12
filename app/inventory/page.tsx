import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { InventoryTable } from "@/components/inventory/inventory-table";
import { Card } from "@/components/ui/card";
import { NotConfiguredState } from "@/components/ui/states";
import { isPhiniteConfigured } from "@/lib/config";

export const metadata: Metadata = { title: "Inventory" };

export const dynamic = "force-dynamic";

export default function InventoryPage() {
  return (
    <>
      <PageHeader
        title="Inventory"
        description="Stock levels, demand and restock recommendations from your Store Manager."
      />

      {isPhiniteConfigured() ? (
        <InventoryTable />
      ) : (
        <Card>
          <NotConfiguredState surface="Your inventory" />
        </Card>
      )}
    </>
  );
}

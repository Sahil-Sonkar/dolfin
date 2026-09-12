import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { VendorTable } from "@/components/vendors/vendor-table";
import { Card } from "@/components/ui/card";
import { NotConfiguredState } from "@/components/ui/states";
import { isPhiniteConfigured } from "@/lib/config";

export const metadata: Metadata = { title: "Vendors" };

export const dynamic = "force-dynamic";

export default function VendorsPage() {
  return (
    <>
      <PageHeader
        title="Vendors"
        description="Supplier reliability and lead times, as reported by your Store Manager."
      />

      {isPhiniteConfigured() ? (
        <VendorTable />
      ) : (
        <Card>
          <NotConfiguredState surface="Your vendor list" />
        </Card>
      )}
    </>
  );
}

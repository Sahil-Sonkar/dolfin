import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { ProcurementView } from "@/components/procurement/procurement-view";
import { Card } from "@/components/ui/card";
import { NotConfiguredState } from "@/components/ui/states";
import { isPhiniteConfigured } from "@/lib/config";

export const metadata: Metadata = { title: "Procurement" };

export const dynamic = "force-dynamic";

export default function ProcurementPage() {
  return (
    <>
      <PageHeader
        title="Procurement"
        description="Review what Dolfin recommends buying, then approve it into a purchase order."
      />

      {isPhiniteConfigured() ? (
        <ProcurementView />
      ) : (
        <Card>
          <NotConfiguredState surface="Procurement" />
        </Card>
      )}
    </>
  );
}

import { DashboardView } from "@/components/dashboard/dashboard-view";
import { Card } from "@/components/ui/card";
import { NotConfiguredState } from "@/components/ui/states";
import { isPhiniteConfigured } from "@/lib/config";
import { greeting } from "@/lib/format";

// Configuration and the time of day are both read at request time.
export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <>
      <div className="mb-7">
        <h1 className="text-[26px] font-semibold tracking-[-0.025em]">
          {greeting()} <span aria-hidden>👋</span>
        </h1>
        <p className="mt-1.5 text-[14px] text-ink-muted">
          Here&rsquo;s what needs your attention today.
        </p>
      </div>

      {isPhiniteConfigured() ? (
        <DashboardView />
      ) : (
        <Card>
          <NotConfiguredState surface="Your dashboard" />
        </Card>
      )}
    </>
  );
}

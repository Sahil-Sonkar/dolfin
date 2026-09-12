"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { chatHref, featuredPrompts } from "@/components/chat/prompts";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { PriorityItems } from "@/components/dashboard/priority-items";
import { StoreBriefCard } from "@/components/dashboard/store-brief";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/states";
import { fetchDashboard } from "@/lib/api";
import { useResource } from "@/lib/use-resource";

export function DashboardView() {
  const { status, data, error, reload } = useResource(fetchDashboard);
  const loading = status === "loading";

  if (status === "error") {
    return (
      <Card>
        <ErrorState message={error.message} onRetry={reload} />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <StoreBriefCard
        brief={data?.brief}
        loading={loading}
        hasRecommendations={(data?.recommendations.length ?? 0) > 0}
      />

      <KpiCards kpis={data?.kpis} />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <PriorityItems items={data?.priorityItems} loading={loading} />

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Ask Dolfin</CardTitle>
          </CardHeader>
          <ul className="divide-y divide-line border-t border-line">
            {featuredPrompts.map((prompt) => (
              <li key={prompt.message}>
                <Link
                  href={chatHref(prompt.message)}
                  className="flex items-start justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-surface-muted"
                >
                  <span>
                    <span className="block text-[13.5px] font-medium tracking-[-0.01em]">
                      {prompt.title}
                    </span>
                    <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-muted">
                      {prompt.description}
                    </span>
                  </span>
                  <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-ink-subtle" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

import { AlertTriangle, Inbox, PlugZap, RefreshCw } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-surface-sunken", className)}
      {...props}
    />
  );
}

function StateShell({
  icon,
  title,
  description,
  action,
  tone = "neutral",
  className,
}: {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
  tone?: "neutral" | "critical";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-14 text-center",
        className,
      )}
    >
      <div
        className={cn(
          "flex size-11 items-center justify-center rounded-xl border",
          tone === "critical"
            ? "border-critical-line bg-critical-soft text-critical"
            : "border-line bg-surface-muted text-ink-subtle",
        )}
      >
        {icon}
      </div>
      <h3 className="mt-4 text-[15px] font-semibold tracking-[-0.01em]">{title}</h3>
      <div className="mt-1.5 max-w-md text-[13.5px] leading-relaxed text-ink-muted">
        {description}
      </div>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/**
 * Shown when no backend is configured.
 *
 * There is deliberately nothing to look at here. Dolfin has no local dataset to
 * fall back on, and inventing one would misrepresent a merchant's store.
 */
export function NotConfiguredState({ surface }: { surface: string }) {
  return (
    <StateShell
      icon={<PlugZap className="size-5" />}
      title="Connect your Store Manager"
      description={
        <>
          {surface} is served entirely by the Store Manager backend. Set{" "}
          <code className="rounded bg-surface-sunken px-1 py-0.5 font-mono text-[12px]">
            PHINITE_API_KEY
          </code>{" "}
          and your trigger configuration, then reload to see live data.
        </>
      }
      action={
        <Button variant="secondary" size="sm" asChild>
          <Link href="https://docs.phinite.ai/triggers-intents/trigger-apis" target="_blank" rel="noreferrer">
            View setup guide
          </Link>
        </Button>
      }
    />
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <StateShell
      tone="critical"
      icon={<AlertTriangle className="size-5" />}
      title="Something went wrong"
      description={message}
      action={
        onRetry ? (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            <RefreshCw />
            Try again
          </Button>
        ) : undefined
      }
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <StateShell
      icon={<Inbox className="size-5" />}
      title={title}
      description={description}
      action={action}
    />
  );
}

/** Renders "—" for values the backend did not provide. */
export function Maybe({ children }: { children: React.ReactNode }) {
  const missing =
    children === undefined ||
    children === null ||
    children === "" ||
    children === "—";

  return missing ? (
    <span className="text-ink-subtle" title="Not provided by the Store Manager">
      —
    </span>
  ) : (
    <>{children}</>
  );
}

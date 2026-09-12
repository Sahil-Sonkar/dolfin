import "server-only";

/**
 * Server-side configuration.
 *
 * Importing this module from a Client Component is a build error, which is the
 * point: `PHINITE_API_KEY` must never be reachable from the browser.
 *
 * Endpoints follow the documented Phinite trigger API:
 *   POST {base}/api/v1/ai/trigger/{workspace}/{trigger}/{environment}
 *   POST {base}/api/v1/ai/trigger/start/{workspace}/{trigger}/{environment}
 *   GET  {base}/api/v1/ai/trigger/status/{workspace}/{workflow}
 *
 * A full URL can be supplied instead, which is also how a "Deploy as Chat API"
 * endpoint is wired up.
 */

import type { PhiniteTarget } from "@/lib/phinite/types";

function read(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readNumber(name: string, fallback: number): number {
  const raw = read(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * `sync` waits for the run to finish in one call — Phinite caps this at roughly
 * 120–150s. `background` starts the run and polls for status, which is the
 * documented recommendation for multi-step graphs.
 */
export type PhiniteExecutionMode = "sync" | "background";

export interface PhiniteConfig {
  apiKey: string;
  baseUrl: string;
  workspaceId?: string;
  environment: string;
  executionMode: PhiniteExecutionMode;

  /** Full endpoint URL per target, when one was supplied directly. */
  targetUrls: Partial<Record<PhiniteTarget, string>>;
  /** Trigger id per target, used to construct the URL. */
  targetTriggerIds: Partial<Record<PhiniteTarget, string>>;

  statusUrlTemplate?: string;

  timeoutMs: number;
  pollIntervalMs: number;
  maxWaitMs: number;
}

const TARGET_ENV_KEYS: Record<PhiniteTarget, { url: string; triggerId: string }> = {
  storeManager: { url: "PHINITE_AGENT_URL", triggerId: "PHINITE_TRIGGER_ID" },
  dashboard: { url: "PHINITE_DASHBOARD_URL", triggerId: "PHINITE_DASHBOARD_TRIGGER_ID" },
  inventory: { url: "PHINITE_INVENTORY_URL", triggerId: "PHINITE_INVENTORY_TRIGGER_ID" },
  vendor: { url: "PHINITE_VENDOR_URL", triggerId: "PHINITE_VENDOR_TRIGGER_ID" },
  procurement: { url: "PHINITE_PROCUREMENT_URL", triggerId: "PHINITE_PROCUREMENT_TRIGGER_ID" },
};

/**
 * Returns the Phinite configuration, or `null` when the deployment has not been
 * wired up yet.
 *
 * Callers must handle `null` by surfacing an explicit "not configured" state.
 * There is no local dataset to fall back to: every figure the merchant sees
 * comes from this backend.
 */
export function getPhiniteConfig(): PhiniteConfig | null {
  const apiKey = read("PHINITE_API_KEY");
  if (!apiKey) return null;

  const targetUrls: Partial<Record<PhiniteTarget, string>> = {};
  const targetTriggerIds: Partial<Record<PhiniteTarget, string>> = {};

  for (const [target, keys] of Object.entries(TARGET_ENV_KEYS) as Array<
    [PhiniteTarget, { url: string; triggerId: string }]
  >) {
    const url = read(keys.url) ?? (target === "storeManager" ? read("PHINITE_STORE_MANAGER_URL") : undefined);
    if (url) targetUrls[target] = url;

    const triggerId = read(keys.triggerId);
    if (triggerId) targetTriggerIds[target] = triggerId;
  }

  const workspaceId = read("PHINITE_WORKSPACE_ID");

  // Something must be resolvable for the store manager, or there is no backend.
  const hasStoreManager =
    targetUrls.storeManager !== undefined ||
    (workspaceId !== undefined && targetTriggerIds.storeManager !== undefined);

  if (!hasStoreManager) return null;

  const mode = read("PHINITE_EXECUTION_MODE")?.toLowerCase();

  return {
    apiKey,
    baseUrl: (read("PHINITE_BASE_URL") ?? "https://app.phinite.ai").replace(/\/+$/, ""),
    workspaceId,
    // Case-sensitive: Phinite routes on this path segment verbatim, so a
    // workspace using "development" must not be rewritten to "DEVELOPMENT".
    environment: read("PHINITE_ENVIRONMENT") ?? "PROD",
    executionMode: mode === "sync" ? "sync" : "background",
    targetUrls,
    targetTriggerIds,
    statusUrlTemplate: read("PHINITE_STATUS_URL"),
    timeoutMs: readNumber("PHINITE_TIMEOUT_MS", 150_000),
    pollIntervalMs: readNumber("PHINITE_POLL_INTERVAL_MS", 3_000),
    maxWaitMs: readNumber("PHINITE_MAX_WAIT_MS", 180_000),
  };
}

export function isPhiniteConfigured(): boolean {
  return getPhiniteConfig() !== null;
}

/**
 * The merchant whose store is being managed. Identity configuration, not
 * business data — replaced by a real session once an auth platform exists.
 */
export function getMerchantId(): string {
  return read("MERCHANT_ID") ?? "M001";
}

/**
 * How long a successful Phinite response is reused. Default 30 minutes so a
 * demo can move between pages without waiting on the graph again. `0` disables
 * the cache.
 */
export function getCacheTtlMs(): number {
  const raw = read("PHINITE_CACHE_TTL_MS");
  if (!raw) return 30 * 60 * 1000;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return 30 * 60 * 1000;
  return parsed;
}

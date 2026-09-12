import "server-only";

/**
 * The only module that talks to Phinite.
 *
 * Nothing else in the application may call the Phinite API directly, and the
 * API key never leaves this file's process. Callers receive normalized models
 * or a `PhiniteError`.
 */

import { getCacheTtlMs, getPhiniteConfig, type PhiniteConfig } from "@/lib/config";
import {
  cacheKey,
  invalidateCache,
  loadCached,
  peekCache,
} from "@/lib/store/response-cache";
import { PhiniteError } from "@/lib/phinite/errors";
import {
  mapAgentResponse,
  mapDashboard,
  mapInventoryList,
  mapProcurementList,
  mapVendorList,
} from "@/lib/phinite/mapper";
import type {
  PhiniteRunStatus,
  PhiniteTarget,
  PhiniteTriggerRequest,
  PhiniteTriggerResponse,
} from "@/lib/phinite/types";
import type {
  AgentRequest,
  AgentResponse,
  DashboardData,
  InventoryResult,
  ProcurementRecommendation,
  Vendor,
} from "@/lib/types";

/* -------------------------------------------------------------------------- */
/* URL construction                                                            */
/* -------------------------------------------------------------------------- */

function requireConfig(): PhiniteConfig {
  const config = getPhiniteConfig();
  if (!config) throw new PhiniteError("NOT_CONFIGURED");
  return config;
}

/**
 * Resolves the endpoint for a target, falling back to the store manager when no
 * specialist endpoint is configured. A single orchestrating graph is the
 * preferred setup; per-target endpoints exist for deployments that split them.
 */
function resolveEndpoint(
  config: PhiniteConfig,
  target: PhiniteTarget,
  mode: "run" | "start",
): string {
  const directUrl = config.targetUrls[target] ?? config.targetUrls.storeManager;
  const triggerId = config.targetTriggerIds[target] ?? config.targetTriggerIds.storeManager;

  // A supplied URL wins. In background mode the documented `start` variant
  // inserts a path segment, which only applies to Phinite-shaped trigger URLs.
  if (directUrl) {
    const isStartUrl = directUrl.includes("/ai/trigger/start/");
    if (mode === "start" && directUrl.includes("/ai/trigger/") && !isStartUrl) {
      return directUrl.replace("/ai/trigger/", "/ai/trigger/start/");
    }
    if (mode === "run" && isStartUrl) {
      return directUrl.replace("/ai/trigger/start/", "/ai/trigger/");
    }
    return directUrl;
  }

  if (!config.workspaceId || !triggerId) {
    throw new PhiniteError("NOT_CONFIGURED", `no endpoint configured for "${target}"`);
  }

  const prefix = mode === "start" ? "start/" : "";
  return `${config.baseUrl}/api/v1/ai/trigger/${prefix}${config.workspaceId}/${triggerId}/${config.environment}`;
}

function resolveStatusUrl(config: PhiniteConfig, workflowId: string): string {
  if (config.statusUrlTemplate) {
    return config.statusUrlTemplate
      .replace("{workspace_id}", config.workspaceId ?? "")
      .replace("{workflow_id}", workflowId);
  }

  if (!config.workspaceId) {
    throw new PhiniteError("NOT_CONFIGURED", "PHINITE_WORKSPACE_ID is required to poll run status");
  }

  return `${config.baseUrl}/api/v1/ai/trigger/status/${config.workspaceId}/${workflowId}`;
}

/* -------------------------------------------------------------------------- */
/* Transport                                                                   */
/* -------------------------------------------------------------------------- */

/** Extracts the upstream error text for server logs. Never shown to merchants. */
function describeUpstreamError(body: unknown, status: number): string {
  const detail = (body as PhiniteTriggerResponse | null)?.detail;

  if (typeof detail === "string") return `${status}: ${detail}`;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((entry) =>
        typeof entry === "object" && entry !== null && "msg" in entry
          ? String((entry as { msg: unknown }).msg)
          : JSON.stringify(entry),
      )
      .join("; ");
    return `${status}: ${messages}`;
  }

  return `${status}`;
}

async function request(
  config: PhiniteConfig,
  url: string,
  init: { method: "GET" | "POST"; body?: PhiniteTriggerRequest },
): Promise<PhiniteTriggerResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  let response: Response;

  try {
    response = await fetch(url, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new PhiniteError("TIMEOUT", `no response within ${config.timeoutMs}ms`);
    }
    throw new PhiniteError(
      "UNREACHABLE",
      error instanceof Error ? error.message : "network request failed",
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let body: unknown = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      if (response.ok) {
        throw new PhiniteError("MALFORMED_RESPONSE", "response body was not JSON");
      }
    }
  }

  if (!response.ok) {
    throw new PhiniteError("UPSTREAM_ERROR", describeUpstreamError(body, response.status));
  }

  if (typeof body !== "object" || body === null) {
    throw new PhiniteError("MALFORMED_RESPONSE", "response body was not a JSON object");
  }

  return body as PhiniteTriggerResponse;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeStatus(status: unknown): PhiniteRunStatus | undefined {
  if (typeof status !== "string") return undefined;
  const lowered = status.toLowerCase();
  if (["completed", "success", "succeeded", "done"].includes(lowered)) return "completed";
  if (["failed", "error", "errored"].includes(lowered)) return "failed";
  if (["pending", "running", "in_progress", "queued", "started"].includes(lowered)) {
    return "pending";
  }
  return undefined;
}

/**
 * Runs a graph and returns the payload held in the envelope's `response` field.
 *
 * In `background` mode this starts the run and polls the status endpoint, which
 * is what Phinite recommends for multi-step graphs. In `sync` mode the single
 * call blocks until the graph finishes.
 */
async function runGraph(
  target: PhiniteTarget,
  body: PhiniteTriggerRequest,
): Promise<unknown> {
  const config = requireConfig();

  if (config.executionMode === "sync") {
    const envelope = await request(config, resolveEndpoint(config, target, "run"), {
      method: "POST",
      body,
    });

    if (normalizeStatus(envelope.status) === "failed") {
      throw new PhiniteError("UPSTREAM_ERROR", String(envelope.error ?? "run failed"));
    }

    // A Chat API deploy returns the payload directly rather than wrapped.
    return envelope.response ?? envelope;
  }

  const started = await request(config, resolveEndpoint(config, target, "start"), {
    method: "POST",
    body,
  });

  // Some deployments complete fast enough to answer on the start call.
  if (normalizeStatus(started.status) === "completed") {
    return started.response ?? started;
  }
  if (normalizeStatus(started.status) === "failed") {
    throw new PhiniteError("UPSTREAM_ERROR", String(started.error ?? "run failed"));
  }

  const workflowId = started.workflow_id;
  if (!workflowId) {
    throw new PhiniteError("MALFORMED_RESPONSE", "start response did not include workflow_id");
  }

  const statusUrl = resolveStatusUrl(config, workflowId);
  const deadline = Date.now() + config.maxWaitMs;

  while (Date.now() < deadline) {
    await sleep(config.pollIntervalMs);

    const envelope = await request(config, statusUrl, { method: "GET" });
    const status = normalizeStatus(envelope.status);

    if (status === "completed") return envelope.response ?? envelope;
    if (status === "failed") {
      throw new PhiniteError("UPSTREAM_ERROR", String(envelope.error ?? "run failed"));
    }
  }

  throw new PhiniteError("TIMEOUT", `run did not finish within ${config.maxWaitMs}ms`);
}

/** Session variables sent with every run. */
function userVariables(
  merchantId: string,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    merchant_id: merchantId,
    ...extra,
  };
}

/* -------------------------------------------------------------------------- */
/* Cached reads                                                                */
/* -------------------------------------------------------------------------- */

export interface ReadOptions {
  /** Skip the cache and call Phinite. Used by `?refresh=1`. */
  refresh?: boolean;
}

function readKey(target: PhiniteTarget, merchantId: string, intent: string, extra?: string) {
  return cacheKey({ target, merchantId, intent, extra: extra?.trim().toLowerCase() ?? "" });
}

async function cachedRead<T>(
  key: string,
  load: () => Promise<T>,
  options: ReadOptions = {},
): Promise<{ value: T; cached: boolean }> {
  return loadCached(key, getCacheTtlMs(), load, options);
}

function scheduleWarm(merchantId: string): void {
  void fetchInventory(merchantId).catch(() => undefined);
  void fetchVendors(merchantId).catch(() => undefined);
  void fetchProcurement(merchantId).catch(() => undefined);
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

/** Sends a merchant message to the Store Manager graph. */
export async function runAgent(
  request: AgentRequest,
  options: ReadOptions = {},
): Promise<AgentResponse> {
  const key = readKey(
    "storeManager",
    request.merchantId,
    "CHAT",
    `${request.message}\0${request.conversationId ?? ""}`,
  );
  const { value } = await cachedRead(
    key,
    async () => {
      const raw = await runGraph("storeManager", {
        message: request.message,
        user_variables: userVariables(request.merchantId, {
          conversation_id: request.conversationId,
          ...request.context,
        }),
      });
      return mapAgentResponse(raw);
    },
    options,
  );
  return value;
}

export async function fetchDashboard(
  merchantId: string,
  options: ReadOptions = {},
): Promise<{ data: DashboardData; cached: boolean }> {
  const { value, cached } = await cachedRead(
    readKey("dashboard", merchantId, "DASHBOARD_SUMMARY"),
    async () => {
      const raw = await runGraph("dashboard", {
        message: "Summarize what needs my attention in the store today.",
        user_variables: userVariables(merchantId, { intent: "DASHBOARD_SUMMARY" }),
      });
      return mapDashboard(raw, merchantId);
    },
    options,
  );

  // While the merchant reads the brief, fill the other pages so the next click is instant.
  if (!cached) scheduleWarm(merchantId);

  return { data: value, cached };
}

export async function fetchInventory(
  merchantId: string,
  options: ReadOptions = {},
): Promise<{ data: InventoryResult[]; cached: boolean }> {
  return cachedRead(
    readKey("inventory", merchantId, "INVENTORY_STATUS"),
    async () => {
      const raw = await runGraph("inventory", {
        message: "List the current inventory status for every product.",
        user_variables: userVariables(merchantId, { intent: "INVENTORY_STATUS" }),
      });
      return mapInventoryList(raw);
    },
    options,
  ).then(({ value, cached }) => ({ data: value, cached }));
}

export async function fetchProduct(
  merchantId: string,
  productId: string,
  options: ReadOptions = {},
): Promise<{ data: InventoryResult | null; cached: boolean }> {
  if (!options.refresh) {
    const listed = peekCache<InventoryResult[]>(readKey("inventory", merchantId, "INVENTORY_STATUS"));
    const fromList = listed?.find((entry) => entry.productId === productId);
    if (fromList) return { data: fromList, cached: true };
  }

  return cachedRead(
    readKey("inventory", merchantId, "INVENTORY_DETAIL", productId),
    async () => {
      const raw = await runGraph("inventory", {
        message: `Give me the full inventory detail and demand history for product ${productId}.`,
        user_variables: userVariables(merchantId, {
          intent: "INVENTORY_DETAIL",
          product_id: productId,
        }),
      });
      const results = mapInventoryList(raw);
      return results.find((entry) => entry.productId === productId) ?? results[0] ?? null;
    },
    options,
  ).then(({ value, cached }) => ({ data: value, cached }));
}

export async function fetchVendors(
  merchantId: string,
  options: ReadOptions = {},
): Promise<{ data: Vendor[]; cached: boolean }> {
  return cachedRead(
    readKey("vendor", merchantId, "VENDOR_LIST"),
    async () => {
      const raw = await runGraph("vendor", {
        message: "List my suppliers with their reliability and lead times.",
        user_variables: userVariables(merchantId, { intent: "VENDOR_LIST" }),
      });
      return mapVendorList(raw);
    },
    options,
  ).then(({ value, cached }) => ({ data: value, cached }));
}

export async function fetchProcurement(
  merchantId: string,
  options: ReadOptions = {},
): Promise<{ data: ProcurementRecommendation[]; cached: boolean }> {
  return cachedRead(
    readKey("procurement", merchantId, "PROCUREMENT_RECOMMENDATIONS"),
    async () => {
      const raw = await runGraph("procurement", {
        message: "List the procurement recommendations waiting for my approval.",
        user_variables: userVariables(merchantId, { intent: "PROCUREMENT_RECOMMENDATIONS" }),
      });
      return mapProcurementList(raw);
    },
    options,
  ).then(({ value, cached }) => ({ data: value, cached }));
}

/**
 * Re-reads a single recommendation so an approval can be validated against the
 * backend rather than against whatever the browser posted.
 *
 * A warm procurement list is preferred so approval does not wait on another run.
 */
export async function fetchRecommendation(
  merchantId: string,
  recommendationId: string,
  options: ReadOptions = {},
): Promise<ProcurementRecommendation | null> {
  if (!options.refresh) {
    const listed = peekCache<ProcurementRecommendation[]>(
      readKey("procurement", merchantId, "PROCUREMENT_RECOMMENDATIONS"),
    );
    const fromList = listed?.find((entry) => entry.recommendationId === recommendationId);
    if (fromList) return fromList;
  }

  const { value } = await cachedRead(
    readKey("procurement", merchantId, "PROCUREMENT_RECOMMENDATION_DETAIL", recommendationId),
    async () => {
      const raw = await runGraph("procurement", {
        message: `Give me the procurement recommendation ${recommendationId}.`,
        user_variables: userVariables(merchantId, {
          intent: "PROCUREMENT_RECOMMENDATION_DETAIL",
          recommendation_id: recommendationId,
        }),
      });
      const recommendations = mapProcurementList(raw);
      return (
        recommendations.find((entry) => entry.recommendationId === recommendationId) ?? null
      );
    },
    options,
  );
  return value;
}

/**
 * Records the merchant's decision upstream. Always live — never served from cache.
 */
export async function submitProcurementDecision(
  merchantId: string,
  recommendationId: string,
  approved: boolean,
): Promise<void> {
  await runGraph("procurement", {
    message: approved
      ? `The merchant approved recommendation ${recommendationId}. Create the purchase order.`
      : `The merchant rejected recommendation ${recommendationId}.`,
    user_variables: userVariables(merchantId, {
      intent: approved ? "APPROVE_RECOMMENDATION" : "REJECT_RECOMMENDATION",
      recommendation_id: recommendationId,
      approved,
    }),
  });

  invalidateCache((key) => {
    const parsed = JSON.parse(key) as { merchantId?: string; intent?: string };
    return (
      parsed.merchantId === merchantId &&
      ["DASHBOARD_SUMMARY", "PROCUREMENT_RECOMMENDATIONS", "PROCUREMENT_RECOMMENDATION_DETAIL", "CHAT"].includes(
        parsed.intent ?? "",
      )
    );
  });
}

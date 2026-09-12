/**
 * Browser-side API helpers.
 *
 * Components call these; these call our own route handlers. No component ever
 * talks to Phinite directly.
 */

import type {
  AgentRequest,
  AgentResponse,
  DashboardData,
  InventoryResult,
  ProcurementRecommendation,
  PurchaseOrder,
  Vendor,
} from "@/lib/types";

export type ApiErrorKind =
  | "NOT_CONFIGURED"
  | "UNREACHABLE"
  | "TIMEOUT"
  | "UPSTREAM_ERROR"
  | "MALFORMED_RESPONSE"
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "CONFLICT";

/** Carries copy that is already safe to render. */
export class DolfinApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;

  constructor(kind: ApiErrorKind, message: string, status: number) {
    super(message);
    this.name = "DolfinApiError";
    this.kind = kind;
    this.status = status;
  }
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(input, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new DolfinApiError(
      "UNREACHABLE",
      "Dolfin couldn't reach the Store Manager. Please try again.",
      0,
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | { error?: { kind?: ApiErrorKind; message?: string } }
    | null;

  if (!response.ok) {
    throw new DolfinApiError(
      payload?.error?.kind ?? "UNREACHABLE",
      payload?.error?.message ?? "Something went wrong. Please try again.",
      response.status,
    );
  }

  if (payload === null) {
    throw new DolfinApiError(
      "MALFORMED_RESPONSE",
      "Dolfin received an incomplete response. No purchase action was taken.",
      response.status,
    );
  }

  return payload as T;
}

export function sendAgentMessage(request: AgentRequest): Promise<AgentResponse> {
  return requestJson<AgentResponse>("/api/agent", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export function fetchDashboard(): Promise<DashboardData> {
  return requestJson<DashboardData>("/api/dashboard");
}

export async function fetchInventory(): Promise<InventoryResult[]> {
  const { inventory } = await requestJson<{ inventory: InventoryResult[] }>("/api/inventory");
  return inventory;
}

export function fetchProduct(productId: string): Promise<InventoryResult> {
  return requestJson<InventoryResult>(
    `/api/inventory?productId=${encodeURIComponent(productId)}`,
  );
}

export async function fetchVendors(): Promise<Vendor[]> {
  const { vendors } = await requestJson<{ vendors: Vendor[] }>("/api/vendors");
  return vendors;
}

export function fetchProcurement(): Promise<{
  recommendations: ProcurementRecommendation[];
  purchaseOrders: PurchaseOrder[];
}> {
  return requestJson("/api/procurement");
}

export interface PurchaseDecisionResult {
  success: boolean;
  status?: "REJECTED";
  purchaseOrder?: PurchaseOrder;
}

export function createPurchaseOrder(
  recommendationId: string,
  approved: boolean,
): Promise<PurchaseDecisionResult> {
  return requestJson<PurchaseDecisionResult>("/api/purchase-orders", {
    method: "POST",
    body: JSON.stringify({ recommendationId, approved }),
  });
}

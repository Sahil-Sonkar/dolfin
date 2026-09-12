import "server-only";

/**
 * Translates the Store Manager graph's session variables into frontend models.
 *
 * The documented trigger envelope is unwrapped in `client.ts`. What remains is
 * the graph's own variable set, which mixes:
 *   - arrays: `inventory_data`, `vendor_data`, `vendor_items`, `actions`, `po_lines`
 *   - JSON-string arrays: `reorder_recommendation`, `demand_forecast`, `alternates`
 *   - a flat "current SKU" projection (`product_id`, `on_hand`, `cost_price`, …)
 *
 * Older camelCase / snake_case aliases are still accepted so existing tests and
 * any simpler graph continue to work. Nothing outside `lib/phinite/` should
 * need to change if a variable is renamed — only the readers below.
 */

import { z } from "zod";

import { PhiniteError } from "@/lib/phinite/errors";
import type {
  AgentResponse,
  DashboardData,
  InventoryResult,
  InventoryStatus,
  ProcurementRecommendation,
  ProcurementStatus,
  SalesPoint,
  Urgency,
  Vendor,
  VendorRecommendation,
} from "@/lib/types";

/* -------------------------------------------------------------------------- */
/* Untyped payload readers                                                     */
/* -------------------------------------------------------------------------- */

type Payload = Record<string, unknown>;

/**
 * Session variables frequently arrive as JSON-encoded strings, because graph
 * nodes serialize structured tool output before storing it. Decode transparently.
 */
function decode(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function asRecord(value: unknown): Payload | undefined {
  const decoded = decode(value);
  return typeof decoded === "object" && decoded !== null && !Array.isArray(decoded)
    ? (decoded as Payload)
    : undefined;
}

/** Reads the first key that is present, so both naming conventions work. */
function field(source: Payload | undefined, ...keys: string[]): unknown {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function str(source: Payload | undefined, ...keys: string[]): string | undefined {
  const value = field(source, ...keys);
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function num(source: Payload | undefined, ...keys: string[]): number | undefined {
  const value = field(source, ...keys);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    // Tolerates "₹1,200" and "1.3 days".
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(parsed) && value.trim() !== "") return parsed;
  }
  return undefined;
}

function bool(source: Payload | undefined, ...keys: string[]): boolean | undefined {
  const value = field(source, ...keys);
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    if (["true", "yes", "1"].includes(lowered)) return true;
    if (["false", "no", "0"].includes(lowered)) return false;
  }
  return undefined;
}

function list(source: Payload | undefined, ...keys: string[]): Payload[] {
  const value = decode(field(source, ...keys));
  if (!Array.isArray(value)) return [];
  return value.map(asRecord).filter((entry): entry is Payload => entry !== undefined);
}

/** Normalizes "out of stock", "Out-Of-Stock" and "OUT_OF_STOCK" to one token. */
function token(value: string | undefined): string | undefined {
  return value?.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

/** Accepts a 0–1 ratio or a 0–100 percentage and always returns a 0–1 ratio. */
function ratio(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (value < 0) return 0;
  return value > 1 ? Math.min(value / 100, 1) : value;
}

const ENVELOPE_KEYS = ["response", "output", "outputs", "result", "data", "payload", "body"];

const KNOWN_KEYS = [
  "message",
  "inventory",
  "inventory_data",
  "inventory_results",
  "inventoryResults",
  "products",
  "vendors",
  "vendor_data",
  "vendor_summary",
  "suppliers",
  "recommendations",
  "procurement_recommendation",
  "procurementRecommendation",
  "procurement_recommendations",
  "reorder_recommendation",
  "po_lines",
  "actions",
  "kpis",
  "brief",
  "availability_status",
  "inventory_status",
  "request_summary",
];

/**
 * Steps past any remaining wrapper objects.
 *
 * `client.ts` already unwraps the documented trigger envelope, but a graph's
 * session variables are often nested one level deeper again (for example under
 * the name of the tool that produced them).
 */
function unwrap(raw: unknown): Payload | undefined {
  let current = asRecord(raw);

  for (let depth = 0; depth < 5 && current; depth += 1) {
    // Stop as soon as the payload carries fields we recognize.
    if (KNOWN_KEYS.some((key) => current![key] !== undefined)) break;

    const next = ENVELOPE_KEYS.map((key) => asRecord(current![key])).find(
      (candidate) => candidate !== undefined,
    );

    if (!next) break;
    current = next;
  }

  return current;
}

/** Reads an array payload, whether it arrives bare or under a named key. */
function collection(raw: unknown, ...keys: string[]): Payload[] {
  const decoded = decode(raw);

  if (Array.isArray(decoded)) {
    return decoded.map(asRecord).filter((entry): entry is Payload => entry !== undefined);
  }

  const payload = unwrap(decoded);
  if (!payload) {
    throw new PhiniteError("MALFORMED_RESPONSE", "response was not a JSON object or array");
  }

  // A single-object response is treated as a one-item collection.
  const direct = field(payload, ...keys);
  if (direct === undefined && KNOWN_KEYS.every((key) => payload[key] === undefined)) {
    return [];
  }

  return list(payload, ...keys);
}

/* -------------------------------------------------------------------------- */
/* Domain readers                                                              */
/* -------------------------------------------------------------------------- */

const INVENTORY_STATUSES: InventoryStatus[] = ["HEALTHY", "LOW", "CRITICAL", "OUT_OF_STOCK"];
const URGENCIES: Urgency[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const PROCUREMENT_STATUSES: ProcurementStatus[] = [
  "RECOMMENDED",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "CREATED",
];

function inventoryStatus(payload: Payload): InventoryStatus | undefined {
  const raw = token(str(payload, "inventoryStatus", "inventory_status", "status", "stockStatus", "stock_status"));
  if (!raw) return undefined;
  if (INVENTORY_STATUSES.includes(raw as InventoryStatus)) return raw as InventoryStatus;
  if (["OUT", "OUTOFSTOCK", "STOCKED_OUT", "ZERO"].includes(raw)) return "OUT_OF_STOCK";
  if (["OK", "GOOD", "NORMAL", "SUFFICIENT", "HEALTHY"].includes(raw)) return "HEALTHY";
  if (["REORDER", "REORDER_REQUIRED", "REPLENISHMENT", "REPLENISHMENT_REQUIRED", "URGENT", "SEVERE"].includes(raw)) {
    return "CRITICAL";
  }
  if (["LOW_STOCK", "LOWSTOCK"].includes(raw)) return "LOW";
  return undefined;
}

function urgency(payload: Payload): Urgency | undefined {
  const raw = token(str(payload, "urgency", "priority", "urgency_level"));
  return raw && URGENCIES.includes(raw as Urgency) ? (raw as Urgency) : undefined;
}

function procurementStatus(payload: Payload): ProcurementStatus {
  const raw = token(str(payload, "status", "procurementStatus", "procurement_status", "po_status"));
  if (raw && PROCUREMENT_STATUSES.includes(raw as ProcurementStatus)) {
    return raw as ProcurementStatus;
  }
  if (raw === "PENDING_APPROVAL" || raw === "PENDING") return "PENDING_APPROVAL";
  if (raw === "APPROVED_EXECUTED" || raw === "EXECUTED") return "APPROVED";
  if (raw === "CREATED" || raw === "PO_CREATED") return "CREATED";
  // Anything unrecognized still requires an explicit merchant decision.
  return "PENDING_APPROVAL";
}

export function mapInventoryResult(payload: Payload): InventoryResult | null {
  const productId = str(payload, "productId", "product_id", "sku_id", "sku", "id");
  const productName = str(payload, "productName", "product_name", "sku_name", "name", "title");
  const stockLevel = num(
    payload,
    "stockLevel",
    "stock_level",
    "stock_on_hand",
    "on_hand",
    "stock",
    "currentStock",
    "current_stock",
    "available",
    "inventory_position",
    "quantity",
  );

  // Without an identity and a stock figure there is nothing truthful to render.
  if (!productId || !productName || stockLevel === undefined) return null;

  const status = inventoryStatus(payload) ?? (stockLevel <= 0 ? "OUT_OF_STOCK" : undefined);
  const daysUntilStockout = num(
    payload,
    "daysUntilStockout",
    "days_until_stockout",
    "days_of_supply",
    "stockoutDays",
    "stockout_days",
    "daysOfCover",
    "days_of_cover",
  );

  return {
    productId,
    productName,
    stockLevel,
    reorderPoint: num(payload, "reorderPoint", "reorder_point", "reorderLevel", "reorder_level"),
    inventoryStatus: status ?? "HEALTHY",
    restockNeeded:
      bool(payload, "restockNeeded", "restock_needed", "needsRestock", "needs_restock") ??
      (status !== undefined && status !== "HEALTHY"),
    averageDailyDemand: num(
      payload,
      "averageDailyDemand",
      "average_daily_demand",
      "dailyDemand",
      "daily_demand",
      "avgDailyDemand",
      "sales_velocity",
    ),
    daysUntilStockout,
    demandForecast30d: num(
      payload,
      "demandForecast30d",
      "demand_forecast_30d",
      "forecast30d",
      "forecast_30d",
      "monthlyForecast",
    ),
    deadStockFlag: bool(payload, "deadStockFlag", "dead_stock_flag", "isDeadStock", "is_dead_stock"),
    recommendedQuantity: num(
      payload,
      "recommendedQuantity",
      "recommended_quantity",
      "recommended_reorder_qty",
      "reorderQuantity",
      "reorder_quantity",
      "suggestedQuantity",
    ),
    urgency: urgency(payload),
    reasoning: str(payload, "reasoning", "reason", "explanation", "rationale", "why"),
    salesHistory: mapSalesHistory(payload),
  };
}

/** Sales history is rendered only when the backend supplies it. */
function mapSalesHistory(payload: Payload): SalesPoint[] | undefined {
  const points = list(payload, "salesHistory", "sales_history", "sales", "demandHistory", "demand_history", "history")
    .map((entry) => {
      const date = str(entry, "date", "day", "period", "month", "timestamp");
      const units = num(entry, "units", "quantity", "qty", "sold", "value", "demand");
      return date && units !== undefined ? { date, units } : null;
    })
    .filter((entry): entry is SalesPoint => entry !== null);

  return points.length > 0 ? points : undefined;
}

export function mapVendorRecommendation(
  payload: Payload,
  fallbackProductId?: string,
): VendorRecommendation | null {
  const productId = str(payload, "productId", "product_id", "sku_id", "sku") ?? fallbackProductId;
  const vendorId = str(payload, "vendorId", "vendor_id", "recommended_vendor_id", "supplierId", "supplier_id", "id");
  const vendorName = str(payload, "vendorName", "vendor_name", "supplierName", "supplier_name", "name");
  const unitCost = num(payload, "unitCost", "unit_cost", "cost_price", "unitPrice", "unit_price", "price");

  if (!productId || !vendorId || !vendorName || unitCost === undefined) return null;

  const recommendedQuantity =
    num(payload, "recommendedQuantity", "recommended_quantity", "recommended_reorder_qty", "quantity", "qty", "orderQuantity") ?? 0;
  const estimatedCost =
    num(payload, "estimatedCost", "estimated_cost", "line_total", "totalCost", "total_cost") ??
    recommendedQuantity * unitCost;

  const alternatives = list(payload, "alternatives", "alternates", "alternativeVendors", "alternative_vendors", "options", "comparisons")
    .map((entry) => {
      const altId = str(entry, "vendorId", "vendor_id", "supplierId", "id");
      const altName = str(entry, "vendorName", "vendor_name", "supplierName", "name");
      const altCost = num(entry, "unitCost", "unit_cost", "unitPrice", "price");
      if (!altId || !altName || altCost === undefined) return null;
      return {
        vendorId: altId,
        vendorName: altName,
        unitCost: altCost,
        leadTimeDays: num(entry, "leadTimeDays", "lead_time_days", "leadTime", "lead_time") ?? 0,
        reliabilityScore: ratio(num(entry, "reliabilityScore", "reliability_score", "reliability", "on_time_rate")) ?? 0,
        vendorScore: ratio(num(entry, "vendorScore", "vendor_score", "overall_score", "score")),
        availableQuantity: num(entry, "availableQuantity", "available_quantity", "available"),
        minimumOrderQuantity: num(entry, "minimumOrderQuantity", "minimum_order_quantity", "moq"),
        reason: str(entry, "reason", "reasoning", "tradeoff", "note"),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return {
    productId,
    vendorId,
    vendorName,
    unitCost,
    availableQuantity: num(payload, "availableQuantity", "available_quantity", "available", "stock"),
    minimumOrderQuantity: num(payload, "minimumOrderQuantity", "minimum_order_quantity", "moq"),
    leadTimeDays: num(payload, "leadTimeDays", "lead_time_days", "leadTime", "lead_time", "deliveryDays") ?? 0,
    reliabilityScore: ratio(num(payload, "reliabilityScore", "reliability_score", "reliability", "on_time_rate")) ?? 0,
    recommendedQuantity,
    estimatedCost,
    vendorScore: ratio(num(payload, "vendorScore", "vendor_score", "overall_score", "score")),
    reason: str(payload, "reason", "reasoning", "explanation", "rationale", "justification", "tradeoff") ?? "",
    alternatives: alternatives.length > 0 ? alternatives : undefined,
  };
}

export function mapProcurementRecommendation(
  payload: Payload,
): ProcurementRecommendation | null {
  const details = asRecord(field(payload, "action_details", "actionDetails")) ?? {};
  const related = asRecord(field(payload, "related_ids", "relatedIds")) ?? asRecord(field(details, "related_ids", "relatedIds")) ?? {};
  const merged: Payload = { ...details, ...related, ...payload };

  const recommendationId = str(
    merged,
    "recommendationId",
    "recommendation_id",
    "action_id",
    "vendor_item_id",
    "id",
  );
  const productId = str(merged, "productId", "product_id", "sku_id", "sku");
  const productName = str(merged, "productName", "product_name", "sku_name", "name");
  const quantity = num(
    merged,
    "quantity",
    "qty",
    "recommendedQuantity",
    "recommended_quantity",
    "recommended_reorder_qty",
    "orderQuantity",
  );
  const vendorId = str(merged, "vendorId", "vendor_id", "supplierId");
  const vendorName = str(merged, "vendorName", "vendor_name", "supplierName");
  const unitCost = num(merged, "unitCost", "unit_cost", "cost_price", "unitPrice", "price");

  if (
    !recommendationId ||
    !productId ||
    !productName ||
    quantity === undefined ||
    !vendorId ||
    !vendorName ||
    unitCost === undefined
  ) {
    return null;
  }

  return {
    recommendationId,
    productId,
    productName,
    quantity,
    vendorId,
    vendorName,
    unitCost,
    totalCost: num(merged, "totalCost", "total_cost", "estimatedCost", "estimated_cost", "line_total") ?? quantity * unitCost,
    leadTimeDays: num(merged, "leadTimeDays", "lead_time_days", "leadTime", "deliveryDays") ?? 0,
    reliabilityScore: ratio(num(merged, "reliabilityScore", "reliability_score", "reliability", "on_time_rate")) ?? 0,
    reason: str(merged, "reason", "reasoning", "explanation", "rationale", "justification", "description") ?? "",
    status: procurementStatus(merged),
    currentStock: num(merged, "currentStock", "current_stock", "stockLevel", "stock_level", "on_hand", "stock_on_hand"),
    daysUntilStockout: num(merged, "daysUntilStockout", "days_until_stockout", "days_of_supply", "stockoutDays"),
    createdAt: str(merged, "createdAt", "created_at", "timestamp"),
  };
}

export function mapVendor(payload: Payload): Vendor | null {
  const vendorId = str(payload, "vendorId", "vendor_id", "supplierId", "id");
  const name = str(payload, "vendorName", "vendor_name", "name", "supplierName");
  if (!vendorId || !name) return null;

  const contact = str(payload, "contactEmail", "contact_email", "email", "vendor_contact");
  const vendorStatus = token(str(payload, "vendorStatus", "vendor_status", "status"));

  return {
    vendorId,
    name,
    category: str(payload, "category", "segment", "type", "vendor_terms"),
    contactEmail: contact?.includes("@") ? contact : str(payload, "contactEmail", "contact_email", "email"),
    phone: str(payload, "phone", "phoneNumber", "phone_number"),
    city: str(payload, "city", "location", "region"),
    reliabilityScore: ratio(num(payload, "reliabilityScore", "reliability_score", "reliability", "overall_score")),
    averageLeadTimeDays: num(
      payload,
      "averageLeadTimeDays",
      "average_lead_time_days",
      "avg_delivery_days",
      "leadTimeDays",
      "lead_time_days",
      "leadTime",
    ),
    productCount: num(payload, "productCount", "product_count", "products_supplied", "products", "skuCount"),
    active: bool(payload, "active", "isActive", "is_active") ?? (vendorStatus ? vendorStatus === "ACTIVE" : true),
  };
}

/* -------------------------------------------------------------------------- */
/* Top-level responses                                                         */
/* -------------------------------------------------------------------------- */

function findBySku(records: Payload[], productId: string): Payload | undefined {
  return records.find((entry) => str(entry, "product_id", "productId", "sku_id", "sku") === productId);
}

function vendorNameIndex(payload: Payload): Map<string, string> {
  const names = new Map<string, string>();
  for (const entry of [
    ...list(payload, "vendor_data", "vendor_summary", "vendors", "suppliers"),
    ...list(payload, "vendor_items", "vendorItems"),
    ...list(payload, "po_lines", "poLines"),
  ]) {
    const id = str(entry, "vendor_id", "vendorId");
    const name = str(entry, "vendor_name", "vendorName");
    if (id && name) names.set(id, name);
  }
  return names;
}

function productNameIndex(payload: Payload): Map<string, string> {
  const names = new Map<string, string>();
  for (const entry of [
    ...list(payload, "inventory_data", "inventory", "products"),
    ...list(payload, "reorder_recommendation", "reorderRecommendation"),
    ...list(payload, "po_lines", "poLines"),
    ...list(payload, "demand_forecast", "demandForecast"),
  ]) {
    const id = str(entry, "product_id", "productId", "sku_id", "sku");
    const name = str(entry, "name", "product_name", "productName", "sku_name");
    if (id && name) names.set(id, name);
  }
  return names;
}

function enrichInventory(items: InventoryResult[], payload: Payload): InventoryResult[] {
  const reorders = list(payload, "reorder_recommendation", "reorderRecommendation");
  const forecasts = list(payload, "demand_forecast", "demandForecast");

  return items.map((item) => {
    const reorder = findBySku(reorders, item.productId);
    const forecast = findBySku(forecasts, item.productId);
    return {
      ...item,
      recommendedQuantity:
        item.recommendedQuantity ?? num(reorder, "recommended_reorder_qty", "recommended_quantity", "qty"),
      urgency: item.urgency ?? (reorder ? urgency(reorder) : undefined),
      reasoning: item.reasoning ?? str(reorder, "justification", "reason"),
      daysUntilStockout: item.daysUntilStockout ?? num(reorder, "days_of_supply", "days_until_stockout"),
      demandForecast30d: item.demandForecast30d ?? num(forecast, "forecast_30d", "forecast30d"),
      restockNeeded: item.restockNeeded || Boolean(reorder),
    };
  });
}

function alternativesForProduct(payload: Payload, productId: string): Payload[] {
  const grouped = list(payload, "alternates", "alternatives");
  if (grouped.length === 0) return [];

  const match = grouped.find((entry) => str(entry, "sku_id", "product_id", "productId") === productId);
  if (match) {
    const nested = list(match, "alternates", "alternatives");
    if (nested.length > 0) return nested;
  }

  // A flat list of vendor options, not grouped by SKU.
  if (grouped.every((entry) => str(entry, "vendor_id", "vendorId"))) return grouped;
  return [];
}

function mapGraphVendorRecommendation(
  payload: Payload,
  fallbackProductId?: string,
): VendorRecommendation | null {
  const named = asRecord(field(payload, "vendorRecommendation", "vendor_recommendation", "vendor", "supplier"));
  const fromNamed = named ? mapVendorRecommendation(named, fallbackProductId) : null;
  if (fromNamed) return fromNamed;

  const line = list(payload, "po_lines", "poLines")[0];
  const item = list(payload, "vendor_items", "vendorItems")[0];
  const source: Payload = { ...payload, ...(item ?? {}), ...(line ?? {}) };
  const productId = str(source, "sku_id", "product_id", "productId") ?? fallbackProductId;
  const alts = productId ? alternativesForProduct(payload, productId) : [];

  return mapVendorRecommendation(
    { ...source, alternatives: alts.length > 0 ? alts : source.alternatives },
    fallbackProductId,
  );
}

/** Normalizes a chat/agent response. Throws `MALFORMED_RESPONSE` if unusable. */
export function mapAgentResponse(raw: unknown): AgentResponse {
  const payload = unwrap(decode(raw));

  if (!payload) {
    throw new PhiniteError("MALFORMED_RESPONSE", "response was not a JSON object");
  }

  const message = str(
    payload,
    "message",
    "text",
    "answer",
    "reply",
    "content",
    "summary",
    "output_text",
    "inventory_status",
    "request_summary",
    "justification",
  );

  const inventory = enrichInventory(
    list(payload, "inventory", "inventory_data", "inventoryResults", "inventory_results", "products", "items")
      .map(mapInventoryResult)
      .filter((entry): entry is InventoryResult => entry !== null),
    payload,
  );

  const vendorRecommendation = mapGraphVendorRecommendation(payload, inventory[0]?.productId);

  const procurementPayload = asRecord(
    field(payload, "procurementRecommendation", "procurement_recommendation", "procurement", "recommendation", "purchaseRecommendation"),
  );
  const procurementRecommendation =
    (procurementPayload ? mapProcurementRecommendation(procurementPayload) : null) ??
    mapProcurementList(payload)[0] ??
    null;

  // A response with neither prose nor structured content tells the merchant
  // nothing, and must not be rendered as if it had succeeded.
  if (
    !message &&
    inventory.length === 0 &&
    !vendorRecommendation &&
    !procurementRecommendation
  ) {
    throw new PhiniteError("MALFORMED_RESPONSE", "no message or structured content");
  }

  const response: AgentResponse = {
    message: message ?? "Here's what I found.",
    sessionId: str(payload, "sessionId", "session_id", "conversationId", "conversation_id", "threadId", "thread_id"),
    intent: token(str(payload, "intent", "intent_type", "intentType", "action")),
    inventory: inventory.length > 0 ? inventory : undefined,
    vendorRecommendation: vendorRecommendation ?? undefined,
    procurementRecommendation: procurementRecommendation ?? undefined,
  };

  return AgentResponseSchema.parse(response);
}

export function mapInventoryList(raw: unknown): InventoryResult[] {
  const payload = unwrap(decode(raw));
  const items = collection(
    raw,
    "inventory",
    "inventory_data",
    "inventoryResults",
    "inventory_results",
    "products",
    "items",
    "results",
  )
    .map(mapInventoryResult)
    .filter((entry): entry is InventoryResult => entry !== null);

  return payload ? enrichInventory(items, payload) : items;
}

export function mapVendorList(raw: unknown): Vendor[] {
  const payload = unwrap(decode(raw));
  const summaries = new Map(
    list(payload, "vendor_summary", "vendorSummary").map((entry) => [
      str(entry, "vendor_id", "vendorId") ?? "",
      entry,
    ]),
  );

  return collection(raw, "vendors", "vendor_data", "vendor_summary", "suppliers", "items", "results")
    .map((entry) => {
      const id = str(entry, "vendor_id", "vendorId") ?? "";
      const summary = summaries.get(id);
      return mapVendor(summary ? { ...summary, ...entry } : entry);
    })
    .filter((entry): entry is Vendor => entry !== null);
}

export function mapProcurementList(raw: unknown): ProcurementRecommendation[] {
  const payload = unwrap(decode(raw));
  const single = asRecord(
    field(payload, "procurementRecommendation", "procurement_recommendation"),
  );
  const vendors = payload ? vendorNameIndex(payload) : new Map<string, string>();
  const products = payload ? productNameIndex(payload) : new Map<string, string>();

  const actions = list(payload, "actions")
    .map((entry) => {
      const details = asRecord(field(entry, "action_details", "actionDetails")) ?? {};
      const related = asRecord(field(entry, "related_ids", "relatedIds")) ?? asRecord(field(details, "related_ids", "relatedIds")) ?? {};
      const merged: Payload = { ...details, ...related, ...entry };
      const vendorId = str(merged, "vendor_id", "vendorId");
      const productId = str(merged, "product_id", "productId", "sku_id");
      const description = str(merged, "description");
      const namedInDescription = description?.match(
        /(?:of|replenish)\s+(.+?)(?:\s+with\s+\d+\s+units)?\s+from\s+(.+)$/i,
      );
      return {
        ...merged,
        vendor_name:
          str(merged, "vendor_name", "vendorName") ??
          (vendorId ? vendors.get(vendorId) : undefined) ??
          namedInDescription?.[2]?.trim(),
        product_name:
          str(merged, "product_name", "productName", "sku_name") ??
          (productId ? products.get(productId) : undefined) ??
          namedInDescription?.[1]?.trim(),
      };
    })
    .filter((entry) => {
      const kind = token(str(entry, "action_type", "actionType")) ?? "";
      return kind === "" || kind.includes("PURCHASE") || kind.includes("ORDER") || kind.includes("PROCURE");
    });

  const lines = list(payload, "po_lines", "poLines").map((entry) => {
    const vendorId = str(entry, "vendor_id", "vendorId");
    const productId = str(entry, "sku_id", "product_id", "productId");
    return {
      ...entry,
      recommendation_id: str(entry, "vendor_item_id", "recommendation_id") ?? (productId && vendorId ? `${productId}-${vendorId}` : undefined),
      product_id: productId,
      product_name: str(entry, "sku_name", "product_name", "productName") ?? (productId ? products.get(productId) : undefined),
      vendor_name: str(entry, "vendor_name", "vendorName") ?? (vendorId ? vendors.get(vendorId) : undefined),
    };
  });

  const mapped = [
    ...collection(raw, "procurementRecommendations", "procurement_recommendations", "recommendations", "procurement", "items", "results"),
    ...(single ? [single] : []),
    ...actions,
    ...lines,
  ]
    .map(mapProcurementRecommendation)
    .filter((entry): entry is ProcurementRecommendation => entry !== null);

  // A payload may carry the same recommendation in both a list and a
  // single-object field.
  return Array.from(
    new Map(mapped.map((entry) => [entry.recommendationId, entry])).values(),
  );
}

/**
 * Normalizes the dashboard payload.
 *
 * KPIs and the store brief are used verbatim when Phinite supplies them. When
 * it returns only the underlying records, the totals are counted from those
 * backend-provided records — an aggregation of real data, never a substitute
 * for it.
 */
export function mapDashboard(raw: unknown, merchantId: string): DashboardData {
  const payload = unwrap(decode(raw));
  if (!payload) throw new PhiniteError("MALFORMED_RESPONSE", "response was not a JSON object");

  const inventory = mapInventoryList(payload);
  const recommendations = mapProcurementList(payload);

  const kpiPayload = asRecord(field(payload, "kpis", "kpi", "metrics", "summary", "availability_status", "action_summary"));
  const availability = asRecord(field(payload, "availability_status", "availabilityStatus"));
  const actions = asRecord(field(payload, "action_summary", "actionSummary"));
  const briefPayload = asRecord(field(payload, "brief", "storeBrief", "store_brief", "dailyBrief"));

  const atRisk = inventory.filter(
    (item) => item.daysUntilStockout !== undefined && item.daysUntilStockout <= 3,
  );
  const needsRestock = inventory.filter((item) => item.restockNeeded);
  const healthy = inventory.filter((item) => item.inventoryStatus === "HEALTHY");

  const hasInventory = inventory.length > 0;

  const priorityItems = needsRestock
    .slice()
    .sort((a, b) => (a.daysUntilStockout ?? Number.MAX_SAFE_INTEGER) - (b.daysUntilStockout ?? Number.MAX_SAFE_INTEGER))
    .slice(0, 5)
    .map((item) => ({
      productId: item.productId,
      productName: item.productName,
      stockLevel: item.stockLevel,
      inventoryStatus: item.inventoryStatus,
      daysUntilStockout: item.daysUntilStockout,
      recommendedQuantity: item.recommendedQuantity,
      recommendationId: recommendations.find((entry) => entry.productId === item.productId)
        ?.recommendationId,
    }));

  return {
    merchantId,
    storeName: str(payload, "storeName", "store_name", "merchantName", "merchant_name"),
    kpis: {
      inventoryHealthPercent:
        ratio(num(kpiPayload, "inventoryHealth", "inventory_health", "inventoryHealthPercent", "health")) !== undefined
          ? Math.round(ratio(num(kpiPayload, "inventoryHealth", "inventory_health", "inventoryHealthPercent", "health"))! * 100)
          : availability && num(availability, "healthy") !== undefined && num(availability, "total_products", "totalProducts")
            ? Math.round((num(availability, "healthy")! / num(availability, "total_products", "totalProducts")!) * 100)
            : hasInventory
              ? Math.round((healthy.length / inventory.length) * 100)
              : undefined,
      itemsToRestock:
        num(kpiPayload, "itemsToRestock", "items_to_restock", "restockCount", "reorder_required", "replenishment_required") ??
        (hasInventory ? needsRestock.length : undefined),
      stockoutRisks:
        num(kpiPayload, "stockoutRisks", "stockout_risks", "stockoutCount") ??
        (hasInventory ? atRisk.length : undefined),
      pendingPurchases:
        num(kpiPayload, "pendingPurchases", "pending_purchases", "pendingCount", "pending_approval") ??
        (recommendations.length > 0 ? recommendations.length : undefined),
    },
    brief: {
      productsNeedingAttention:
        num(briefPayload, "productsNeedingAttention", "products_needing_attention") ??
        num(availability, "reorder_required", "replenishment_required") ??
        (hasInventory ? needsRestock.length : undefined),
      stockoutsWithinThreeDays:
        num(briefPayload, "stockoutsWithinThreeDays", "stockouts_within_three_days", "stockoutRisks") ??
        (hasInventory ? atRisk.length : undefined),
      readyRecommendations:
        num(briefPayload, "readyRecommendations", "ready_recommendations") ??
        num(actions, "pending_approval") ??
        (recommendations.length > 0 ? recommendations.length : undefined),
      recommendedPurchaseValue:
        num(briefPayload, "recommendedPurchaseValue", "recommended_purchase_value", "totalValue") ??
        num(actions, "pending_procurement_value", "total_action_value") ??
        (recommendations.length > 0
          ? recommendations.reduce((total, entry) => total + entry.totalCost, 0)
          : undefined),
      headline:
        str(briefPayload, "headline", "summary", "message") ??
        str(payload, "inventory_status", "request_summary", "message", "summary"),
    },
    priorityItems,
    inventory,
    recommendations,
    generatedAt: str(payload, "generatedAt", "generated_at", "timestamp") ?? new Date().toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/* Normalized-model validation                                                 */
/* -------------------------------------------------------------------------- */
/* External data is untrusted: the mapper's own output is validated before it   */
/* is handed to the UI.                                                         */

const InventoryResultSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  stockLevel: z.number(),
  reorderPoint: z.number().optional(),
  inventoryStatus: z.enum(["HEALTHY", "LOW", "CRITICAL", "OUT_OF_STOCK"]),
  restockNeeded: z.boolean(),
  averageDailyDemand: z.number().optional(),
  daysUntilStockout: z.number().optional(),
  demandForecast30d: z.number().optional(),
  deadStockFlag: z.boolean().optional(),
  recommendedQuantity: z.number().optional(),
  urgency: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  reasoning: z.string().optional(),
});

const VendorAlternativeSchema = z.object({
  vendorId: z.string().min(1),
  vendorName: z.string().min(1),
  unitCost: z.number(),
  leadTimeDays: z.number(),
  reliabilityScore: z.number(),
  vendorScore: z.number().optional(),
  availableQuantity: z.number().optional(),
  minimumOrderQuantity: z.number().optional(),
  reason: z.string().optional(),
});

const VendorRecommendationSchema = z.object({
  productId: z.string().min(1),
  vendorId: z.string().min(1),
  vendorName: z.string().min(1),
  unitCost: z.number(),
  availableQuantity: z.number().optional(),
  minimumOrderQuantity: z.number().optional(),
  leadTimeDays: z.number(),
  reliabilityScore: z.number(),
  recommendedQuantity: z.number(),
  estimatedCost: z.number(),
  vendorScore: z.number().optional(),
  reason: z.string(),
  alternatives: z.array(VendorAlternativeSchema).optional(),
});

export const ProcurementRecommendationSchema = z.object({
  recommendationId: z.string().min(1),
  productId: z.string().min(1),
  productName: z.string().min(1),
  quantity: z.number().positive(),
  vendorId: z.string().min(1),
  vendorName: z.string().min(1),
  unitCost: z.number().nonnegative(),
  totalCost: z.number().nonnegative(),
  leadTimeDays: z.number().nonnegative(),
  reliabilityScore: z.number(),
  reason: z.string(),
  status: z.enum(["RECOMMENDED", "PENDING_APPROVAL", "APPROVED", "REJECTED", "CREATED"]),
  currentStock: z.number().optional(),
  daysUntilStockout: z.number().optional(),
  createdAt: z.string().optional(),
});

export const AgentResponseSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().optional(),
  intent: z.string().optional(),
  inventory: z.array(InventoryResultSchema).optional(),
  vendorRecommendation: VendorRecommendationSchema.optional(),
  procurementRecommendation: ProcurementRecommendationSchema.optional(),
});

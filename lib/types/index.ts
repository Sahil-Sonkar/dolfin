/**
 * Normalized frontend models.
 *
 * Everything the UI renders is described here, and every value is sourced from
 * the configured backend. Phinite's own payload shapes live in
 * `lib/phinite/types.ts` and are translated into these models by
 * `lib/phinite/mapper.ts`, so a change to the Phinite contract stops at the
 * adapter boundary.
 *
 * Fields are optional wherever the backend may legitimately omit them. The UI
 * renders an explicit "—" for a missing value rather than substituting one.
 */

export type InventoryStatus = "HEALTHY" | "LOW" | "CRITICAL" | "OUT_OF_STOCK";

export type Urgency = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ProcurementStatus =
  | "RECOMMENDED"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "CREATED";

/* -------------------------------------------------------------------------- */
/* Inventory                                                                   */
/* -------------------------------------------------------------------------- */

export interface SalesPoint {
  /** ISO date, `YYYY-MM-DD`. Formatted for display at the render boundary. */
  date: string;
  units: number;
}

export interface InventoryResult {
  productId: string;
  productName: string;

  stockLevel: number;
  reorderPoint?: number;

  inventoryStatus: InventoryStatus;

  restockNeeded: boolean;

  averageDailyDemand?: number;
  daysUntilStockout?: number;

  demandForecast30d?: number;

  deadStockFlag?: boolean;

  recommendedQuantity?: number;

  urgency?: Urgency;

  reasoning?: string;

  /** Present only when the backend returns sales history for the product. */
  salesHistory?: SalesPoint[];
}

/* -------------------------------------------------------------------------- */
/* Vendors                                                                     */
/* -------------------------------------------------------------------------- */

export interface VendorAlternative {
  vendorId: string;
  vendorName: string;

  unitCost: number;

  leadTimeDays: number;
  reliabilityScore: number;

  vendorScore?: number;

  availableQuantity?: number;
  minimumOrderQuantity?: number;

  reason?: string;
}

export interface VendorRecommendation {
  productId: string;

  vendorId: string;
  vendorName: string;

  unitCost: number;

  availableQuantity?: number;
  minimumOrderQuantity?: number;

  leadTimeDays: number;
  reliabilityScore: number;

  recommendedQuantity: number;
  estimatedCost: number;

  vendorScore?: number;

  reason: string;

  alternatives?: VendorAlternative[];
}

export interface Vendor {
  vendorId: string;
  name: string;

  category?: string;
  contactEmail?: string;
  phone?: string;
  city?: string;

  reliabilityScore?: number;
  averageLeadTimeDays?: number;
  productCount?: number;

  active: boolean;
}

/* -------------------------------------------------------------------------- */
/* Procurement                                                                 */
/* -------------------------------------------------------------------------- */

export interface ProcurementRecommendation {
  recommendationId: string;

  productId: string;
  productName: string;

  quantity: number;

  vendorId: string;
  vendorName: string;

  unitCost: number;
  totalCost: number;

  leadTimeDays: number;
  reliabilityScore: number;

  reason: string;

  status: ProcurementStatus;

  currentStock?: number;
  daysUntilStockout?: number;
  createdAt?: string;
}

export interface PurchaseOrder {
  poId: string;
  recommendationId: string;

  productId: string;
  productName: string;
  quantity: number;

  vendorId: string;
  vendorName: string;

  unitCost: number;
  totalCost: number;

  leadTimeDays: number;
  expectedDeliveryDate: string;

  status: ProcurementStatus;
  createdAt: string;
}

/* -------------------------------------------------------------------------- */
/* Agent transport                                                             */
/* -------------------------------------------------------------------------- */

export interface AgentRequest {
  message: string;
  merchantId: string;
  conversationId?: string;
  context?: Record<string, unknown>;
}

export interface AgentResponse {
  message: string;
  sessionId?: string;

  intent?: string;

  inventory?: InventoryResult[];

  vendorRecommendation?: VendorRecommendation;

  procurementRecommendation?: ProcurementRecommendation;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;

  inventory?: InventoryResult[];
  vendorRecommendation?: VendorRecommendation;
  procurementRecommendation?: ProcurementRecommendation;

  error?: boolean;

  timestamp: string;
}

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                   */
/* -------------------------------------------------------------------------- */

export interface DashboardKpis {
  inventoryHealthPercent?: number;
  itemsToRestock?: number;
  stockoutRisks?: number;
  pendingPurchases?: number;
}

export interface StoreBrief {
  productsNeedingAttention?: number;
  stockoutsWithinThreeDays?: number;
  readyRecommendations?: number;
  recommendedPurchaseValue?: number;
  headline?: string;
}

export interface PriorityItem {
  productId: string;
  productName: string;

  stockLevel: number;

  inventoryStatus: InventoryStatus;
  daysUntilStockout?: number;
  recommendedQuantity?: number;

  recommendationId?: string;
}

export interface DashboardData {
  merchantId: string;
  storeName?: string;

  kpis: DashboardKpis;
  brief: StoreBrief;
  priorityItems: PriorityItem[];

  inventory: InventoryResult[];
  recommendations: ProcurementRecommendation[];

  generatedAt: string;
}

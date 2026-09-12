/**
 * Test fixtures.
 *
 * These sample payloads exist only to exercise the adapter. They are confined
 * to the test suite and are never imported by application code — the running
 * app has no static business data of any kind.
 */

import type { ProcurementRecommendation } from "@/lib/types";

/** A snake_case payload, as a Python-authored graph tool would emit. */
export const snakeCasePayload = {
  message: "I found 1 product that needs attention today.",
  session_id: "session-123",
  intent: "reorder recommendation",
  inventory: [
    {
      product_id: "P0001",
      product_name: "Maggi 12 Pack",
      stock_level: 8,
      reorder_point: 20,
      inventory_status: "critical",
      restock_needed: true,
      average_daily_demand: 6,
      days_until_stockout: 1.3,
      demand_forecast_30d: 180,
      recommended_quantity: 50,
      urgency: "high",
      reasoning: "Stock runs out in roughly 1.3 days.",
    },
  ],
  vendor_recommendation: {
    product_id: "P0001",
    vendor_id: "V002",
    vendor_name: "Metro Wholesale",
    unit_cost: 400,
    lead_time_days: 2,
    reliability_score: 94,
    recommended_quantity: 50,
    estimated_cost: 20000,
    reason: "Best balance of price, speed and reliability.",
    alternatives: [
      {
        vendor_id: "V003",
        vendor_name: "Annapurna Traders",
        unit_cost: 385,
        lead_time_days: 6,
        reliability_score: 82,
      },
    ],
  },
  procurement_recommendation: {
    recommendation_id: "REC-001",
    product_id: "P0001",
    product_name: "Maggi 12 Pack",
    quantity: 50,
    vendor_id: "V002",
    vendor_name: "Metro Wholesale",
    unit_cost: 400,
    total_cost: 20000,
    lead_time_days: 2,
    reliability_score: 0.94,
    reason: "Stock runs out in roughly 1.3 days.",
    status: "pending approval",
    current_stock: 8,
  },
};

/** The same content in camelCase, wrapped in a nested envelope. */
export const camelCaseEnvelope = {
  result: {
    data: {
      message: "Here's your restock list.",
      conversationId: "conv-9",
      inventory: [
        {
          productId: "P0002",
          productName: "Tata Tea 1kg",
          stockLevel: 18,
          inventoryStatus: "LOW",
          averageDailyDemand: 4.5,
          daysUntilStockout: 4,
          recommendedQuantity: 30,
        },
      ],
    },
  },
};

/**
 * Shape produced by the Store Manager graph on 12 Sep 2026. Confined to tests;
 * the running app never imports this.
 */
export const liveGraphPayload = {
  request_summary: "User is asking what items should be restocked today.",
  inventory_status: "Low-stock alert: 4 SKUs require reorder today.",
  inventory_data: [
    {
      product_id: "P001",
      name: "Tata Salt 1kg",
      stock_on_hand: 18,
      reorder_point: 40,
      sales_velocity: 14,
      days_of_supply: 1.29,
      inventory_status: "reorder",
    },
  ],
  availability_status: {
    total_products: 4,
    healthy: 0,
    reorder_required: 4,
    out_of_stock: 0,
  },
  action_summary: {
    pending_approval: 11,
    pending_procurement_value: 42814,
  },
  reorder_recommendation: JSON.stringify([
    {
      sku_id: "P001",
      sku_name: "Tata Salt 1kg",
      recommended_reorder_qty: 124,
      days_of_supply: 1.29,
      urgency: "critical",
      justification: "Below ROP (18 < 40).",
    },
  ]),
  demand_forecast: JSON.stringify([{ sku_id: "P001", forecast_30d: 420 }]),
  vendor_data: [
    {
      vendor_id: "V001",
      vendor_name: "Metro Wholesale",
      vendor_contact: "sales@metrowholesale.demo",
      vendor_status: "active",
      reliability_score: 94,
      avg_delivery_days: 2.8,
      products_supplied: 5,
    },
  ],
  po_lines: JSON.stringify([
    {
      vendor_id: "V001",
      vendor_name: "Metro Wholesale",
      sku_id: "P001",
      sku_name: "Tata Salt 1kg",
      qty: 124,
      unit_cost: 23.5,
      line_total: 2914,
      vendor_item_id: "VI001",
    },
  ]),
  actions: [
    {
      action_id: "ACT013",
      status: "pending_approval",
      action_type: "create_purchase_order",
      action_details: {
        description: "Order 50 units of Amul Taaza Milk 1L from Shree Balaji Distributors",
        recommended_quantity: 50,
        unit_cost: 54,
        estimated_cost: 2700,
        lead_time_days: 1,
        reason: "High daily sales velocity.",
        related_ids: { product_id: "P005", vendor_id: "V002" },
      },
      product_id: "P005",
      vendor_id: "V002",
    },
  ],
  vendor_id: "V001",
  vendor_name: "Metro Wholesale",
  product_id: "P001",
  cost_price: 23.5,
  lead_time_days: 2,
  moq: 20,
  recommended_reorder_qty: 124,
  reliability_score: 94,
  alternates: JSON.stringify([
    {
      sku_id: "P001",
      alternates: [
        {
          vendor_id: "V004",
          vendor_name: "CityMart Wholesale",
          unit_cost: 24,
          lead_time_days: 3,
          vendor_score: 44.3,
          tradeoff: "slower, higher cost",
        },
      ],
    },
  ]),
};

export const procurementRecommendation: ProcurementRecommendation = {
  recommendationId: "REC-001",
  productId: "P0001",
  productName: "Maggi 12 Pack",
  quantity: 50,
  vendorId: "V002",
  vendorName: "Metro Wholesale",
  unitCost: 400,
  totalCost: 20000,
  leadTimeDays: 2,
  reliabilityScore: 0.94,
  reason: "Stock runs out in roughly 1.3 days.",
  status: "PENDING_APPROVAL",
  currentStock: 8,
};

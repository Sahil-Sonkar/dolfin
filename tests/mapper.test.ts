import { describe, expect, it } from "vitest";

import { PhiniteError } from "@/lib/phinite/errors";
import {
  mapAgentResponse,
  mapDashboard,
  mapInventoryList,
  mapProcurementList,
  mapVendorList,
} from "@/lib/phinite/mapper";

import { camelCaseEnvelope, liveGraphPayload, snakeCasePayload } from "./fixtures";

describe("mapAgentResponse", () => {
  it("normalizes a snake_case payload", () => {
    const response = mapAgentResponse(snakeCasePayload);

    expect(response.message).toBe("I found 1 product that needs attention today.");
    expect(response.sessionId).toBe("session-123");
    expect(response.intent).toBe("REORDER_RECOMMENDATION");

    expect(response.inventory).toHaveLength(1);
    expect(response.inventory?.[0]).toMatchObject({
      productId: "P0001",
      productName: "Maggi 12 Pack",
      stockLevel: 8,
      inventoryStatus: "CRITICAL",
      restockNeeded: true,
      daysUntilStockout: 1.3,
      recommendedQuantity: 50,
      urgency: "HIGH",
    });
  });

  it("rescales a percentage reliability score to a ratio", () => {
    const response = mapAgentResponse(snakeCasePayload);
    expect(response.vendorRecommendation?.reliabilityScore).toBe(0.94);
  });

  it("keeps a ratio reliability score unchanged", () => {
    const response = mapAgentResponse(snakeCasePayload);
    expect(response.procurementRecommendation?.reliabilityScore).toBe(0.94);
  });

  it("maps vendor alternatives for comparison", () => {
    const response = mapAgentResponse(snakeCasePayload);
    expect(response.vendorRecommendation?.alternatives).toHaveLength(1);
    expect(response.vendorRecommendation?.alternatives?.[0]).toMatchObject({
      vendorId: "V003",
      unitCost: 385,
      leadTimeDays: 6,
    });
  });

  it("normalizes a status written with spaces", () => {
    const response = mapAgentResponse(snakeCasePayload);
    expect(response.procurementRecommendation?.status).toBe("PENDING_APPROVAL");
  });

  it("unwraps nested envelopes and reads camelCase", () => {
    const response = mapAgentResponse(camelCaseEnvelope);

    expect(response.message).toBe("Here's your restock list.");
    expect(response.sessionId).toBe("conv-9");
    expect(response.inventory?.[0].productName).toBe("Tata Tea 1kg");
  });

  it("decodes structured content delivered as a JSON string", () => {
    const response = mapAgentResponse({
      message: "Here you go.",
      inventory: JSON.stringify([
        { product_id: "P0003", product_name: "Parle-G", stock_level: 4 },
      ]),
    });

    expect(response.inventory?.[0].productId).toBe("P0003");
  });

  it("infers OUT_OF_STOCK when no status is given and stock is zero", () => {
    const response = mapAgentResponse({
      message: "Out of stock.",
      inventory: [{ product_id: "P1", product_name: "Item", stock_level: 0 }],
    });

    expect(response.inventory?.[0].inventoryStatus).toBe("OUT_OF_STOCK");
    expect(response.inventory?.[0].restockNeeded).toBe(true);
  });

  it("drops inventory rows with no identity or stock figure", () => {
    const response = mapAgentResponse({
      message: "Partial data.",
      inventory: [{ product_name: "Nameless" }, { product_id: "P9", product_name: "Real", stock_level: 3 }],
    });

    expect(response.inventory).toHaveLength(1);
    expect(response.inventory?.[0].productId).toBe("P9");
  });

  it("rejects a response that is not an object", () => {
    expect(() => mapAgentResponse("not json")).toThrow(PhiniteError);
    expect(() => mapAgentResponse(null)).toThrow(PhiniteError);
  });

  it("rejects a response with neither prose nor structured content", () => {
    expect(() => mapAgentResponse({ workflow_id: "abc" })).toThrow(PhiniteError);
  });

  it("reads inventory_data, po_lines and prose inventory_status", () => {
    const response = mapAgentResponse(liveGraphPayload);

    expect(response.message).toMatch(/Low-stock alert/);
    expect(response.inventory?.[0].productId).toBe("P001");
    expect(response.vendorRecommendation).toMatchObject({
      vendorId: "V001",
      vendorName: "Metro Wholesale",
      unitCost: 23.5,
      recommendedQuantity: 124,
    });
    expect(response.vendorRecommendation?.alternatives?.[0].vendorId).toBe("V004");
    expect(response.procurementRecommendation?.recommendationId).toBe("ACT013");
  });
});

describe("list mappers", () => {
  it("reads a bare array", () => {
    const inventory = mapInventoryList([
      { product_id: "P1", product_name: "One", stock_level: 5 },
    ]);

    expect(inventory).toHaveLength(1);
  });

  it("reads vendors and defaults them to active", () => {
    const vendors = mapVendorList({
      vendors: [
        { vendor_id: "V1", vendor_name: "Supplier One", reliability_score: 91, lead_time_days: 3 },
      ],
    });

    expect(vendors[0]).toMatchObject({
      vendorId: "V1",
      name: "Supplier One",
      reliabilityScore: 0.91,
      averageLeadTimeDays: 3,
      active: true,
    });
  });

  it("de-duplicates a recommendation present as both a list and a single field", () => {
    const recommendations = mapProcurementList({
      recommendations: [snakeCasePayload.procurement_recommendation],
      procurement_recommendation: snakeCasePayload.procurement_recommendation,
    });

    expect(recommendations).toHaveLength(1);
  });

  it("returns nothing when the payload carries no recognizable records", () => {
    expect(mapInventoryList({ unrelated: true })).toEqual([]);
  });
});

describe("mapDashboard", () => {
  it("uses backend KPIs when they are supplied", () => {
    const dashboard = mapDashboard(
      {
        kpis: { inventory_health: 86, items_to_restock: 12, stockout_risks: 4, pending_purchases: 3 },
        brief: { headline: "Four products need attention." },
      },
      "M001",
    );

    expect(dashboard.kpis).toEqual({
      inventoryHealthPercent: 86,
      itemsToRestock: 12,
      stockoutRisks: 4,
      pendingPurchases: 3,
    });
    expect(dashboard.brief.headline).toBe("Four products need attention.");
  });

  it("counts KPIs from the returned records when no KPIs are supplied", () => {
    const dashboard = mapDashboard(
      {
        inventory: [
          { product_id: "P1", product_name: "A", stock_level: 2, inventory_status: "CRITICAL", days_until_stockout: 1 },
          { product_id: "P2", product_name: "B", stock_level: 90, inventory_status: "HEALTHY" },
        ],
      },
      "M001",
    );

    expect(dashboard.kpis.itemsToRestock).toBe(1);
    expect(dashboard.kpis.stockoutRisks).toBe(1);
    expect(dashboard.kpis.inventoryHealthPercent).toBe(50);
  });

  it("leaves KPIs undefined rather than inventing zeros", () => {
    const dashboard = mapDashboard({ message: "Nothing to report." }, "M001");

    expect(dashboard.kpis.itemsToRestock).toBeUndefined();
    expect(dashboard.kpis.inventoryHealthPercent).toBeUndefined();
    expect(dashboard.brief.recommendedPurchaseValue).toBeUndefined();
  });

  it("reads the Store Manager graph's session variables", () => {
    const dashboard = mapDashboard(liveGraphPayload, "M001");

    expect(dashboard.inventory[0]).toMatchObject({
      productId: "P001",
      productName: "Tata Salt 1kg",
      stockLevel: 18,
      inventoryStatus: "CRITICAL",
      recommendedQuantity: 124,
      daysUntilStockout: 1.29,
      demandForecast30d: 420,
    });
    expect(dashboard.kpis.itemsToRestock).toBe(4);
    expect(dashboard.brief.headline).toMatch(/Low-stock alert/);
    expect(dashboard.recommendations.some((entry) => entry.recommendationId === "VI001")).toBe(true);
    expect(dashboard.recommendations.some((entry) => entry.recommendationId === "ACT013")).toBe(true);
  });

  it("orders priority items by how soon they run out", () => {
    const dashboard = mapDashboard(
      {
        inventory: [
          { product_id: "P1", product_name: "Later", stock_level: 9, restock_needed: true, days_until_stockout: 5 },
          { product_id: "P2", product_name: "Sooner", stock_level: 2, restock_needed: true, days_until_stockout: 1 },
        ],
      },
      "M001",
    );

    expect(dashboard.priorityItems.map((item) => item.productName)).toEqual([
      "Sooner",
      "Later",
    ]);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import { PhiniteError } from "@/lib/phinite/errors";

import { procurementRecommendation } from "./fixtures";

/**
 * Route-handler behaviour: request validation, the approval state machine, and
 * the guarantee that no upstream error text reaches the merchant.
 */

const runAgent = vi.fn();
const fetchRecommendation = vi.fn();
const submitProcurementDecision = vi.fn();

vi.mock("@/lib/phinite/client", () => ({
  runAgent: (...args: unknown[]) => runAgent(...args),
  fetchRecommendation: (...args: unknown[]) => fetchRecommendation(...args),
  submitProcurementDecision: (...args: unknown[]) => submitProcurementDecision(...args),
  fetchDashboard: vi.fn(),
  fetchInventory: vi.fn(),
  fetchProduct: vi.fn(),
  fetchVendors: vi.fn(),
  fetchProcurement: vi.fn(),
}));

function postRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Route handlers log failures deliberately; keep the test output readable.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/agent", () => {
  it("returns the normalized agent response for a valid request", async () => {
    runAgent.mockResolvedValue({ message: "Four products need attention." });

    const { POST } = await import("@/app/api/agent/route");
    const response = await POST(
      postRequest("http://localhost/api/agent", {
        message: "What should I restock?",
        merchantId: "M001",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      message: "Four products need attention.",
    });
  });

  it("rejects a request with no message", async () => {
    const { POST } = await import("@/app/api/agent/route");
    const response = await POST(
      postRequest("http://localhost/api/agent", { message: "", merchantId: "M001" }),
    );

    expect(response.status).toBe(400);
    expect(runAgent).not.toHaveBeenCalled();
  });

  it("rejects a request with no merchant", async () => {
    const { POST } = await import("@/app/api/agent/route");
    const response = await POST(
      postRequest("http://localhost/api/agent", { message: "Hello" }),
    );

    expect(response.status).toBe(400);
  });

  it("rejects a body that is not JSON", async () => {
    const { POST } = await import("@/app/api/agent/route");
    const response = await POST(
      new Request("http://localhost/api/agent", { method: "POST", body: "not json" }),
    );

    expect(response.status).toBe(400);
  });

  it("returns 504 and safe copy on an upstream timeout", async () => {
    runAgent.mockRejectedValue(new PhiniteError("TIMEOUT", "no response within 45000ms"));

    const { POST } = await import("@/app/api/agent/route");
    const response = await POST(
      postRequest("http://localhost/api/agent", { message: "x", merchantId: "M001" }),
    );

    expect(response.status).toBe(504);
    const body = await response.json();
    expect(body.error.message).not.toContain("45000ms");
  });

  it("returns 502 and safe copy on an upstream error", async () => {
    runAgent.mockRejectedValue(
      new PhiniteError("UPSTREAM_ERROR", "401: Invalid authentication credentials"),
    );

    const { POST } = await import("@/app/api/agent/route");
    const response = await POST(
      postRequest("http://localhost/api/agent", { message: "x", merchantId: "M001" }),
    );

    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error.message).toBe(
      "Dolfin couldn't reach the Store Manager. Please try again.",
    );
    expect(JSON.stringify(body)).not.toContain("Invalid authentication");
  });

  it("returns 502 on a malformed upstream response", async () => {
    runAgent.mockRejectedValue(new PhiniteError("MALFORMED_RESPONSE"));

    const { POST } = await import("@/app/api/agent/route");
    const response = await POST(
      postRequest("http://localhost/api/agent", { message: "x", merchantId: "M001" }),
    );

    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error.message).toContain("incomplete response");
  });

  it("returns 503 when no backend is configured", async () => {
    runAgent.mockRejectedValue(new PhiniteError("NOT_CONFIGURED"));

    const { POST } = await import("@/app/api/agent/route");
    const response = await POST(
      postRequest("http://localhost/api/agent", { message: "x", merchantId: "M001" }),
    );

    expect(response.status).toBe(503);
  });
});

describe("POST /api/purchase-orders", () => {
  /** A distinct id per test, since the store is process-wide. */
  function recommendation(id: string) {
    return { ...procurementRecommendation, recommendationId: id };
  }

  it("creates a purchase order when the merchant approves", async () => {
    fetchRecommendation.mockResolvedValue(recommendation("REC-A"));
    submitProcurementDecision.mockResolvedValue(undefined);

    const { POST } = await import("@/app/api/purchase-orders/route");
    const response = await POST(
      postRequest("http://localhost/api/purchase-orders", {
        recommendationId: "REC-A",
        approved: true,
      }),
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.purchaseOrder.poId).toMatch(/^PO-\d+$/);
    expect(body.purchaseOrder.status).toBe("CREATED");
    expect(body.purchaseOrder.quantity).toBe(50);
    expect(body.purchaseOrder.totalCost).toBe(20000);
  });

  it("tells the backend about the approval before recording the order", async () => {
    fetchRecommendation.mockResolvedValue(recommendation("REC-B"));
    submitProcurementDecision.mockResolvedValue(undefined);

    const { POST } = await import("@/app/api/purchase-orders/route");
    await POST(
      postRequest("http://localhost/api/purchase-orders", {
        recommendationId: "REC-B",
        approved: true,
      }),
    );

    expect(submitProcurementDecision).toHaveBeenCalledWith("M001", "REC-B", true);
  });

  it("records a rejection without creating an order", async () => {
    fetchRecommendation.mockResolvedValue(recommendation("REC-C"));
    submitProcurementDecision.mockResolvedValue(undefined);

    const { POST } = await import("@/app/api/purchase-orders/route");
    const response = await POST(
      postRequest("http://localhost/api/purchase-orders", {
        recommendationId: "REC-C",
        approved: false,
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("REJECTED");
    expect(body.purchaseOrder).toBeUndefined();
  });

  it("refuses a duplicate approval", async () => {
    fetchRecommendation.mockResolvedValue(recommendation("REC-D"));
    submitProcurementDecision.mockResolvedValue(undefined);

    const { POST } = await import("@/app/api/purchase-orders/route");
    const body = { recommendationId: "REC-D", approved: true };

    const first = await POST(postRequest("http://localhost/api/purchase-orders", body));
    const second = await POST(postRequest("http://localhost/api/purchase-orders", body));

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);

    const secondBody = await second.json();
    expect(secondBody.error.message).toContain("already been approved");
    // The original order is returned so the UI can show it rather than error.
    expect(secondBody.purchaseOrder.recommendationId).toBe("REC-D");
  });

  it("refuses to approve something that was already rejected", async () => {
    fetchRecommendation.mockResolvedValue(recommendation("REC-E"));
    submitProcurementDecision.mockResolvedValue(undefined);

    const { POST } = await import("@/app/api/purchase-orders/route");

    await POST(
      postRequest("http://localhost/api/purchase-orders", {
        recommendationId: "REC-E",
        approved: false,
      }),
    );
    const second = await POST(
      postRequest("http://localhost/api/purchase-orders", {
        recommendationId: "REC-E",
        approved: true,
      }),
    );

    expect(second.status).toBe(409);
  });

  it("returns 404 for an unknown recommendation", async () => {
    fetchRecommendation.mockResolvedValue(null);

    const { POST } = await import("@/app/api/purchase-orders/route");
    const response = await POST(
      postRequest("http://localhost/api/purchase-orders", {
        recommendationId: "REC-MISSING",
        approved: true,
      }),
    );

    expect(response.status).toBe(404);
    expect(submitProcurementDecision).not.toHaveBeenCalled();
  });

  it("rejects a malformed decision body", async () => {
    const { POST } = await import("@/app/api/purchase-orders/route");
    const response = await POST(
      postRequest("http://localhost/api/purchase-orders", { recommendationId: "REC-X" }),
    );

    expect(response.status).toBe(400);
    expect(fetchRecommendation).not.toHaveBeenCalled();
  });

  it("creates no order when the backend rejects the approval", async () => {
    fetchRecommendation.mockResolvedValue(recommendation("REC-F"));
    submitProcurementDecision.mockRejectedValue(new PhiniteError("UPSTREAM_ERROR", "500"));

    const { POST } = await import("@/app/api/purchase-orders/route");
    const response = await POST(
      postRequest("http://localhost/api/purchase-orders", {
        recommendationId: "REC-F",
        approved: true,
      }),
    );

    expect(response.status).toBe(502);

    // The recommendation stays undecided, so the merchant can retry.
    const { GET } = await import("@/app/api/purchase-orders/route");
    const orders = await (await GET()).json();
    expect(
      orders.purchaseOrders.some(
        (order: { recommendationId: string }) => order.recommendationId === "REC-F",
      ),
    ).toBe(false);
  });
});

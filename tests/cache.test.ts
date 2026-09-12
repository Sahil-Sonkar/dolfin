import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

function configure(overrides: Record<string, string> = {}) {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("PHINITE_")) delete process.env[key];
  }
  Object.assign(process.env, {
    PHINITE_API_KEY: "test-key",
    PHINITE_WORKSPACE_ID: "ws_1",
    PHINITE_TRIGGER_ID: "trig_1",
    PHINITE_ENVIRONMENT: "DEV",
    PHINITE_EXECUTION_MODE: "sync",
    PHINITE_TIMEOUT_MS: "2000",
    PHINITE_CACHE_TTL_MS: "60000",
    ...overrides,
  });
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function completedRun(payload: unknown) {
  return jsonResponse({ workflow_id: "wf_1", status: "completed", response: payload });
}

const inventoryPayload = {
  inventory: [{ product_id: "P1", product_name: "Salt", stock_level: 8 }],
};

beforeEach(async () => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
  const { resetCache } = await import("@/lib/store/response-cache");
  resetCache();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe("response cache", () => {
  it("replays a successful inventory run instead of calling Phinite again", async () => {
    configure();
    const fetchMock = vi.fn().mockImplementation(async () => completedRun(inventoryPayload));
    vi.stubGlobal("fetch", fetchMock);

    const { fetchInventory } = await import("@/lib/phinite/client");
    const first = await fetchInventory("M001");
    const second = await fetchInventory("M001");

    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.data[0].productId).toBe("P1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("coalesces overlapping requests into one graph run", async () => {
    configure();
    let resolveFetch: (value: Response) => void = () => undefined;
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { fetchInventory } = await import("@/lib/phinite/client");
    const a = fetchInventory("M001");
    const b = fetchInventory("M001");
    resolveFetch(completedRun(inventoryPayload));

    const [first, second] = await Promise.all([a, b]);
    expect(first.data).toHaveLength(1);
    expect(second.data).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("serves a product from the cached inventory list", async () => {
    configure();
    const fetchMock = vi.fn().mockImplementation(async () => completedRun(inventoryPayload));
    vi.stubGlobal("fetch", fetchMock);

    const { fetchInventory, fetchProduct } = await import("@/lib/phinite/client");
    await fetchInventory("M001");
    const product = await fetchProduct("M001", "P1");

    expect(product.cached).toBe(true);
    expect(product.data?.productName).toBe("Salt");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("bypasses the cache when refresh is requested", async () => {
    configure();
    const fetchMock = vi.fn().mockImplementation(async () => completedRun(inventoryPayload));
    vi.stubGlobal("fetch", fetchMock);

    const { fetchInventory } = await import("@/lib/phinite/client");
    await fetchInventory("M001");
    await fetchInventory("M001", { refresh: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not cache when TTL is zero", async () => {
    configure({ PHINITE_CACHE_TTL_MS: "0" });
    const fetchMock = vi.fn().mockImplementation(async () => completedRun(inventoryPayload));
    vi.stubGlobal("fetch", fetchMock);

    const { fetchInventory } = await import("@/lib/phinite/client");
    await fetchInventory("M001");
    await fetchInventory("M001");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not let an empty list blank a warmer cache", async () => {
    configure();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(completedRun(inventoryPayload))
      .mockResolvedValueOnce(completedRun({ inventory: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const { fetchInventory } = await import("@/lib/phinite/client");
    await fetchInventory("M001");
    const again = await fetchInventory("M001", { refresh: true });

    expect(again.data).toHaveLength(1);
    expect(again.data[0].productId).toBe("P1");
  });

  it("keeps a fuller inventory list when a later run returns a slice", async () => {
    configure();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        completedRun({
          inventory: [
            { product_id: "P1", product_name: "Salt", stock_level: 8 },
            { product_id: "P2", product_name: "Oil", stock_level: 12 },
          ],
        }),
      )
      .mockResolvedValueOnce(
        completedRun({
          inventory: [{ product_id: "P019", product_name: "Toothpaste", stock_level: 60 }],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { fetchInventory } = await import("@/lib/phinite/client");
    await fetchInventory("M001");
    const again = await fetchInventory("M001", { refresh: true });

    expect(again.data).toHaveLength(2);
    expect(again.data.map((item) => item.productId)).toEqual(["P1", "P2"]);
  });

  it("seeds inventory and procurement caches from a dashboard run", async () => {
    configure();
    const fetchMock = vi.fn().mockImplementation(async () =>
      completedRun({
        inventory: [{ product_id: "P1", product_name: "Salt", stock_level: 8 }],
        recommendations: [
          {
            recommendation_id: "REC-1",
            product_id: "P1",
            product_name: "Salt",
            quantity: 40,
            vendor_id: "V1",
            vendor_name: "Metro",
            unit_cost: 10,
            total_cost: 400,
            lead_time_days: 2,
            reliability_score: 0.9,
            reason: "Low stock.",
            status: "pending_approval",
          },
        ],
        vendors: [{ vendor_id: "V1", vendor_name: "Metro", reliability_score: 90, lead_time_days: 2 }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { fetchDashboard, fetchInventory, fetchVendors, fetchProcurement } =
      await import("@/lib/phinite/client");
    await fetchDashboard("M001");

    const inventory = await fetchInventory("M001");
    const vendors = await fetchVendors("M001");
    const procurement = await fetchProcurement("M001");

    expect(inventory.cached).toBe(true);
    expect(inventory.data[0].productId).toBe("P1");
    expect(vendors.cached).toBe(true);
    expect(vendors.data[0].vendorId).toBe("V1");
    expect(procurement.cached).toBe(true);
    expect(procurement.data[0].recommendationId).toBe("REC-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

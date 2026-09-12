import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

function configure(overrides: Record<string, string> = {}) {
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
});

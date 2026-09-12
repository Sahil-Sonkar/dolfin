import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Transport-level behaviour of the Phinite adapter: authentication, the
 * documented trigger envelope, both execution modes, and the failure taxonomy.
 */

const ORIGINAL_ENV = { ...process.env };

function stripPhiniteEnv() {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("PHINITE_")) delete process.env[key];
  }
}

function configure(overrides: Record<string, string> = {}) {
  stripPhiniteEnv();
  Object.assign(process.env, {
    PHINITE_API_KEY: "test-key",
    PHINITE_WORKSPACE_ID: "ws_1",
    PHINITE_TRIGGER_ID: "trig_1",
    PHINITE_ENVIRONMENT: "DEV",
    PHINITE_EXECUTION_MODE: "sync",
    PHINITE_TIMEOUT_MS: "2000",
    PHINITE_CACHE_TTL_MS: "0",
    ...overrides,
  });
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** A completed run whose session variables carry a usable agent reply. */
function completedRun(payload: unknown) {
  return jsonResponse({ workflow_id: "wf_1", status: "completed", response: payload });
}

beforeEach(async () => {
  process.env = { ...ORIGINAL_ENV };
  stripPhiniteEnv();
  vi.resetModules();
  const { resetCache } = await import("@/lib/store/response-cache");
  resetCache();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe("runAgent", () => {
  it("calls the documented trigger URL with bearer auth and the trigger body", async () => {
    configure();
    const fetchMock = vi.fn().mockResolvedValue(completedRun({ message: "Hello." }));
    vi.stubGlobal("fetch", fetchMock);

    const { runAgent } = await import("@/lib/phinite/client");
    await runAgent({ message: "What should I restock?", merchantId: "M001" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://app.phinite.ai/api/v1/ai/trigger/ws_1/trig_1/DEV");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer test-key");

    expect(JSON.parse(init.body)).toEqual({
      message: "What should I restock?",
      user_variables: { merchant_id: "M001", conversation_id: undefined },
    });
  });

  it("passes the conversation id back for continuity", async () => {
    configure();
    const fetchMock = vi.fn().mockResolvedValue(completedRun({ message: "Hi." }));
    vi.stubGlobal("fetch", fetchMock);

    const { runAgent } = await import("@/lib/phinite/client");
    await runAgent({ message: "And then?", merchantId: "M001", conversationId: "abc123" });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).user_variables.conversation_id).toBe(
      "abc123",
    );
  });

  it("returns a normalized response", async () => {
    configure();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        completedRun({
          message: "One product needs attention.",
          inventory: [{ product_id: "P1", product_name: "Maggi", stock_level: 8 }],
        }),
      ),
    );

    const { runAgent } = await import("@/lib/phinite/client");
    const response = await runAgent({ message: "x", merchantId: "M001" });

    expect(response.message).toBe("One product needs attention.");
    expect(response.inventory?.[0].productId).toBe("P1");
  });

  it("reports NOT_CONFIGURED when no credentials are present", async () => {
    const { runAgent } = await import("@/lib/phinite/client");

    await expect(runAgent({ message: "x", merchantId: "M001" })).rejects.toMatchObject({
      kind: "NOT_CONFIGURED",
    });
  });

  it("reports UPSTREAM_ERROR for a non-2xx response", async () => {
    configure();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ detail: "Invalid authentication credentials" }, 401)),
    );

    const { runAgent } = await import("@/lib/phinite/client");
    const error = await runAgent({ message: "x", merchantId: "M001" }).catch((e) => e);

    expect(error.name).toBe("PhiniteError");
    expect(error.kind).toBe("UPSTREAM_ERROR");
    // The upstream detail is kept for logs, not for the merchant.
    expect(error.detail).toContain("Invalid authentication credentials");
  });

  it("reports UPSTREAM_ERROR when the run itself failed", async () => {
    configure();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ workflow_id: "wf_1", status: "failed", error: "tool call failed" }),
      ),
    );

    const { runAgent } = await import("@/lib/phinite/client");
    await expect(runAgent({ message: "x", merchantId: "M001" })).rejects.toMatchObject({
      kind: "UPSTREAM_ERROR",
    });
  });

  it("reports TIMEOUT when the request is aborted", async () => {
    configure({ PHINITE_TIMEOUT_MS: "20" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        });
      }),
    );

    const { runAgent } = await import("@/lib/phinite/client");
    await expect(runAgent({ message: "x", merchantId: "M001" })).rejects.toMatchObject({
      kind: "TIMEOUT",
    });
  });

  it("reports UNREACHABLE when the network call fails", async () => {
    configure();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const { runAgent } = await import("@/lib/phinite/client");
    await expect(runAgent({ message: "x", merchantId: "M001" })).rejects.toMatchObject({
      kind: "UNREACHABLE",
    });
  });

  it("reports MALFORMED_RESPONSE when the body is not JSON", async () => {
    configure();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>oops</html>")));

    const { runAgent } = await import("@/lib/phinite/client");
    await expect(runAgent({ message: "x", merchantId: "M001" })).rejects.toMatchObject({
      kind: "MALFORMED_RESPONSE",
    });
  });

  it("reports MALFORMED_RESPONSE when the run returns nothing usable", async () => {
    configure();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(completedRun({ unrelated: true })));

    const { runAgent } = await import("@/lib/phinite/client");
    await expect(runAgent({ message: "x", merchantId: "M001" })).rejects.toMatchObject({
      kind: "MALFORMED_RESPONSE",
    });
  });
});

describe("background execution mode", () => {
  it("starts a run, polls status, and returns the completed payload", async () => {
    configure({ PHINITE_EXECUTION_MODE: "background", PHINITE_POLL_INTERVAL_MS: "1" });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ workflow_id: "wf_9", status: "pending" }))
      .mockResolvedValueOnce(jsonResponse({ workflow_id: "wf_9", status: "pending", logs: [] }))
      .mockResolvedValueOnce(completedRun({ message: "Done." }));

    vi.stubGlobal("fetch", fetchMock);

    const { runAgent } = await import("@/lib/phinite/client");
    const response = await runAgent({ message: "x", merchantId: "M001" });

    expect(response.message).toBe("Done.");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://app.phinite.ai/api/v1/ai/trigger/start/ws_1/trig_1/DEV",
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://app.phinite.ai/api/v1/ai/trigger/status/ws_1/wf_9",
    );
    expect(fetchMock.mock.calls[1][1].method).toBe("GET");
  });

  it("gives up with TIMEOUT when the run never settles", async () => {
    configure({
      PHINITE_EXECUTION_MODE: "background",
      PHINITE_POLL_INTERVAL_MS: "1",
      PHINITE_MAX_WAIT_MS: "15",
    });

    // A fresh Response per call, since a body can only be read once.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () =>
        jsonResponse({ workflow_id: "wf_9", status: "pending" }),
      ),
    );

    const { runAgent } = await import("@/lib/phinite/client");
    await expect(runAgent({ message: "x", merchantId: "M001" })).rejects.toMatchObject({
      kind: "TIMEOUT",
    });
  });
});

describe("endpoint resolution", () => {
  it("uses a supplied full URL ahead of the constructed one", async () => {
    configure({ PHINITE_AGENT_URL: "https://custom.example/chat" });
    const fetchMock = vi.fn().mockResolvedValue(completedRun({ message: "Hi." }));
    vi.stubGlobal("fetch", fetchMock);

    const { runAgent } = await import("@/lib/phinite/client");
    await runAgent({ message: "x", merchantId: "M001" });

    expect(fetchMock.mock.calls[0][0]).toBe("https://custom.example/chat");
  });

  it("falls back to the store manager when a specialist target is unconfigured", async () => {
    configure();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(completedRun({ vendors: [{ vendor_id: "V1", vendor_name: "One" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const { fetchVendors } = await import("@/lib/phinite/client");
    const { data: vendors } = await fetchVendors("M001");

    expect(vendors).toHaveLength(1);
    expect(fetchMock.mock.calls[0][0]).toContain("/trig_1/DEV");
  });

  it("routes to a specialist trigger when one is configured", async () => {
    configure({ PHINITE_INVENTORY_TRIGGER_ID: "trig_inv" });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        completedRun({ inventory: [{ product_id: "P1", product_name: "A", stock_level: 1 }] }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { fetchInventory } = await import("@/lib/phinite/client");
    await fetchInventory("M001");

    expect(fetchMock.mock.calls[0][0]).toContain("/trig_inv/DEV");
  });
});

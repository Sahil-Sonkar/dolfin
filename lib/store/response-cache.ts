import "server-only";

/**
 * Short-lived cache of successful Phinite responses.
 *
 * Values are whatever the graph already returned — this is not a dataset, it is
 * a replay of a real run so a demo does not wait 15–65s on every navigation.
 * Held on `globalThis` so hot reload does not drop a warm cache.
 *
 * Set `PHINITE_CACHE_TTL_MS=0` to disable.
 */

interface Entry {
  value: unknown;
  expiresAt: number;
}

interface CacheStore {
  entries: Map<string, Entry>;
  inflight: Map<string, Promise<unknown>>;
}

/**
 * Bump when the mapper or cache rules change so a long-lived `next dev`
 * process drops poisoned entries (empty lists, dead-stock slices) on reload.
 */
const CACHE_VERSION = 3;

const globalForCache = globalThis as unknown as {
  __dolfinResponseCache?: CacheStore;
  __dolfinResponseCacheVersion?: number;
};

if (globalForCache.__dolfinResponseCacheVersion !== CACHE_VERSION) {
  globalForCache.__dolfinResponseCache = { entries: new Map(), inflight: new Map() };
  globalForCache.__dolfinResponseCacheVersion = CACHE_VERSION;
}

const store: CacheStore = globalForCache.__dolfinResponseCache!;

export function cacheKey(parts: Record<string, unknown>): string {
  return JSON.stringify(parts);
}

export function peekCache<T>(key: string): T | undefined {
  const entry = store.entries.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    store.entries.delete(key);
    return undefined;
  }
  return entry.value as T;
}

/**
 * Writes a value, unless a better list is already cached.
 *
 * Empty arrays are not stored: a graph that answers the wrong intent (or
 * returns only vendor fields) would otherwise blank a page for the full TTL.
 * A shorter list does not replace a longer one — dashboard/inventory intents
 * often return different slices of the same catalog.
 */
export function writeCache<T>(key: string, value: T, ttlMs: number): T {
  if (ttlMs <= 0) return value;

  if (Array.isArray(value)) {
    const existing = peekCache<unknown[]>(key);
    if (Array.isArray(existing) && existing.length > value.length) {
      return existing as T;
    }
    if (value.length === 0) return value;
  }

  store.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

export function resetCache(): void {
  store.entries.clear();
  store.inflight.clear();
}

export function invalidateCache(match?: (key: string) => boolean): void {
  if (!match) {
    store.entries.clear();
  } else {
    for (const key of store.entries.keys()) {
      if (match(key)) store.entries.delete(key);
    }
  }

  if (process.env.VERCEL) {
    void import("next/cache").then(({ revalidateTag }) => {
      revalidateTag("phinite", "max");
    });
  }
}

/**
 * On Vercel, also persist through Next's Data Cache so every serverless
 * instance can reuse the same graph result. The in-memory map only helps the
 * current isolate — that is why production felt uncached after deploy.
 */
async function persist<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  if (!process.env.VERCEL || ttlMs <= 0) return load();

  const { unstable_cache } = await import("next/cache");
  const revalidate = Math.max(1, Math.round(ttlMs / 1000));
  return unstable_cache(async () => load(), [key], {
    revalidate,
    tags: ["phinite"],
  })();
}

export async function loadCached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
  options: { refresh?: boolean } = {},
): Promise<{ value: T; cached: boolean }> {
  if (ttlMs > 0 && !options.refresh) {
    const hit = peekCache<T>(key);
    if (hit !== undefined) return { value: hit, cached: true };

    const pending = store.inflight.get(key);
    if (pending) return { value: (await pending) as T, cached: true };
  }

  if (options.refresh && process.env.VERCEL) {
    const { revalidateTag } = await import("next/cache");
    revalidateTag("phinite", "max");
  }

  const pending = persist(key, ttlMs, load).then((value) => writeCache(key, value, ttlMs));

  store.inflight.set(key, pending);
  try {
    return { value: await pending, cached: false };
  } finally {
    store.inflight.delete(key);
  }
}

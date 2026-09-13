import "server-only";

/**
 * Shared route-handler plumbing.
 *
 * Every route funnels failures through here so that merchants only ever see the
 * approved copy, while the underlying cause is logged server-side.
 */

import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  PHINITE_ERROR_MESSAGES,
  PHINITE_ERROR_STATUS,
  PhiniteError,
  type ApiErrorBody,
} from "@/lib/phinite/errors";

export function errorResponse(
  kind: ApiErrorBody["error"]["kind"],
  message: string,
  status: number,
): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: { kind, message } }, { status });
}

/**
 * Converts a thrown error into a merchant-safe response.
 *
 * A Zod failure here means our own normalized model was violated, which is a
 * malformed upstream payload from the merchant's point of view.
 */
export function handleRouteError(context: string, error: unknown): NextResponse<ApiErrorBody> {
  if (error instanceof PhiniteError) {
    console.error(`[dolfin] ${context}: ${error.kind}`, error.detail ?? "");
    return errorResponse(
      error.kind,
      PHINITE_ERROR_MESSAGES[error.kind],
      PHINITE_ERROR_STATUS[error.kind],
    );
  }

  if (error instanceof ZodError) {
    console.error(`[dolfin] ${context}: normalized model failed validation`, error.issues);
    return errorResponse(
      "MALFORMED_RESPONSE",
      PHINITE_ERROR_MESSAGES.MALFORMED_RESPONSE,
      PHINITE_ERROR_STATUS.MALFORMED_RESPONSE,
    );
  }

  console.error(`[dolfin] ${context}: unexpected error`, error);
  return errorResponse(
    "UNREACHABLE",
    PHINITE_ERROR_MESSAGES.UNREACHABLE,
    PHINITE_ERROR_STATUS.UNREACHABLE,
  );
}

export function wantsRefresh(request: Request): boolean {
  return new URL(request.url).searchParams.get("refresh") === "1";
}

function isEmptyCollectionPayload(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const value = body as Record<string, unknown>;
  if (Array.isArray(value.recommendations) && value.recommendations.length === 0) return true;
  if (Array.isArray(value.vendors) && value.vendors.length === 0) return true;
  if (
    Array.isArray(value.inventory) &&
    value.recommendations === undefined &&
    value.inventory.length === 0
  ) {
    return true;
  }
  return false;
}

export function cachedJson<T>(
  body: T,
  cached: boolean,
  options: { refresh?: boolean } = {},
): NextResponse<T> {
  // `public` + s-maxage lets Vercel's CDN hold the response. `private` was why
  // every production visitor paid for a new 40s graph run. Never pin an empty
  // list — a wrong-intent graph would blank Procurement for 30 minutes.
  const cacheControl =
    options.refresh || isEmptyCollectionPayload(body)
      ? "no-store"
      : "public, s-maxage=1800, stale-while-revalidate=86400";

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": cacheControl,
      // Vercel rewrites Cache-Control on serverless; these are what the CDN uses.
      "CDN-Cache-Control": cacheControl,
      "Vercel-CDN-Cache-Control": cacheControl,
      "X-Dolfin-Cache": cached ? "HIT" : "MISS",
    },
  });
}

/** Parses a JSON request body, or `null` when it is absent or unparseable. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

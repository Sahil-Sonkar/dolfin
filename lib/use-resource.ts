"use client";

import * as React from "react";

import { DolfinApiError } from "@/lib/api";

/**
 * Loads a backend resource.
 *
 * Data arrives after first paint rather than blocking it: an agent graph can
 * take tens of seconds, and the merchant should see the page immediately with
 * an honest loading state rather than a blank screen.
 *
 * `load` must be referentially stable — a module-level function, or wrapped in
 * `useCallback` — because it identifies the request.
 */

export interface ResourceError {
  kind: string;
  message: string;
}

export type ResourceState<T> =
  | { status: "loading"; data?: undefined; error?: undefined }
  | { status: "ready"; data: T; error?: undefined }
  | { status: "error"; data?: undefined; error: ResourceError };

type Settled<T> = Extract<ResourceState<T>, { status: "ready" | "error" }>;

const LOADING = { status: "loading" } as const;

function toResourceError(error: unknown): ResourceError {
  return error instanceof DolfinApiError
    ? { kind: error.kind, message: error.message }
    : {
        kind: "UNREACHABLE",
        message: "Dolfin couldn't reach the Store Manager. Please try again.",
      };
}

export function useResource<T>(
  load: () => Promise<T>,
): ResourceState<T> & { reload: () => void } {
  // Each attempt gets a number so a settled result from a superseded request is
  // ignored, and so `reload` returns to the loading state without a setState
  // during render or synchronously inside the effect.
  const [attempt, setAttempt] = React.useState(0);
  const [settled, setSettled] = React.useState<{
    attempt: number;
    state: Settled<T>;
  } | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    load()
      .then((data) => {
        if (!cancelled) setSettled({ attempt, state: { status: "ready", data } });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSettled({ attempt, state: { status: "error", error: toResourceError(error) } });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [load, attempt]);

  const reload = React.useCallback(() => setAttempt((value) => value + 1), []);

  const state: ResourceState<T> =
    settled && settled.attempt === attempt ? settled.state : LOADING;

  return { ...state, reload };
}

import "server-only";

/**
 * Phinite transport types.
 *
 * The trigger envelope below is documented and stable
 * (https://docs.phinite.ai/triggers-intents/trigger-apis). What is *inside*
 * `response` is not: it holds the session variables that whoever builds the
 * Store Manager graph chose to expose. `mapper.ts` therefore reads the envelope
 * precisely and the inner payload defensively.
 *
 * TODO: Once the graph's session-variable names are fixed, replace the
 * permissive readers in `mapper.ts` with an exact mapping.
 */

/** Which graph entry point a request is routed to. */
export type PhiniteTarget =
  | "storeManager"
  | "dashboard"
  | "inventory"
  | "vendor"
  | "procurement";

/** Documented trigger request body. */
export interface PhiniteTriggerRequest {
  /** First message of the session. May be empty for data-fetch triggers. */
  message: string;
  /** Session variables available throughout the run. */
  user_variables: Record<string, unknown>;
}

export type PhiniteRunStatus = "pending" | "completed" | "failed";

/** Documented trigger response envelope, for both sync and background modes. */
export interface PhiniteTriggerResponse {
  workflow_id?: string;
  status?: PhiniteRunStatus | string;
  /** Session variables on completion. Shape defined by the graph. */
  response?: unknown;
  logs?: unknown[];
  error?: unknown;
  /** FastAPI-style error body. */
  detail?: unknown;
}

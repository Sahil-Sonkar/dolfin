/**
 * Failure taxonomy for the Phinite boundary.
 *
 * Each kind maps to one merchant-facing sentence and one HTTP status. Upstream
 * error text never reaches the browser — it is logged server-side instead.
 */

export type PhiniteErrorKind =
  | "NOT_CONFIGURED"
  | "UNREACHABLE"
  | "TIMEOUT"
  | "UPSTREAM_ERROR"
  | "MALFORMED_RESPONSE";

export class PhiniteError extends Error {
  readonly kind: PhiniteErrorKind;
  /** Upstream detail, for server logs only. */
  readonly detail?: string;

  constructor(kind: PhiniteErrorKind, detail?: string) {
    super(`${kind}${detail ? `: ${detail}` : ""}`);
    this.name = "PhiniteError";
    this.kind = kind;
    this.detail = detail;
  }
}

/** Copy shown to merchants. Deliberately free of technical detail. */
export const PHINITE_ERROR_MESSAGES: Record<PhiniteErrorKind, string> = {
  NOT_CONFIGURED:
    "Dolfin is not connected to a Store Manager yet. Add the backend credentials to get started.",
  UNREACHABLE: "Dolfin couldn't reach the Store Manager. Please try again.",
  TIMEOUT: "The Store Manager is taking longer than usual. Please try again.",
  UPSTREAM_ERROR: "Dolfin couldn't reach the Store Manager. Please try again.",
  MALFORMED_RESPONSE:
    "Dolfin received an incomplete response. No purchase action was taken.",
};

export const PHINITE_ERROR_STATUS: Record<PhiniteErrorKind, number> = {
  NOT_CONFIGURED: 503,
  UNREACHABLE: 502,
  TIMEOUT: 504,
  UPSTREAM_ERROR: 502,
  MALFORMED_RESPONSE: 502,
};

export interface ApiErrorBody {
  error: {
    kind: PhiniteErrorKind | "INVALID_REQUEST" | "NOT_FOUND" | "CONFLICT";
    message: string;
  };
}

export function toApiError(error: PhiniteError): {
  status: number;
  body: ApiErrorBody;
} {
  return {
    status: PHINITE_ERROR_STATUS[error.kind],
    body: {
      error: {
        kind: error.kind,
        message: PHINITE_ERROR_MESSAGES[error.kind],
      },
    },
  };
}

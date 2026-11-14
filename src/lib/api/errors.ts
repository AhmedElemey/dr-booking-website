// RFC 7807 problem+json handling. Clients key off the stable `code`, never the text.

export const ERROR_CODES = [
  "VALIDATION_FAILED",
  "OTP_INVALID",
  "OTP_EXPIRED",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "SLOT_TAKEN",
  "SLOT_UNAVAILABLE",
  "SLOT_RESERVED",
  "SLOT_OVERLAP",
  "INVALID_TRANSITION",
  "CANCEL_WINDOW_PASSED",
  "PHONE_IN_USE",
  "BOOKING_LIMIT",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
  "FEATURE_DISABLED",
  "CLINIC_CLOSED",
  "COUPON_INVALID",
  "ALREADY_REVIEWED",
  "NOT_REVIEWABLE",
  "PAYMENT_NOT_ALLOWED",
  "VIDEO_NOT_OPEN",
  "ALREADY_WAITING",
  "PROVIDER_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type ProblemDetails = {
  type?: string;
  title?: string;
  status?: number;
  code?: string;
  feature?: string;
  /** `COUPON_INVALID` only: why the code was refused. */
  reason?: string;
  detail?: string;
  traceId?: string;
  errors?: Record<string, string[]>;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, string[]>;
  readonly reason?: string;

  constructor(
    status: number,
    code: string,
    message: string,
    fieldErrors?: Record<string, string[]>,
    reason?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.reason = reason;
  }
}

/** Code used when the request never reached the API (offline, DNS, refused). */
export const NETWORK_ERROR_CODE = "NETWORK_ERROR";

const STATUS_FALLBACK_CODES: Record<number, ErrorCode> = {
  400: "VALIDATION_FAILED",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  429: "RATE_LIMITED",
};

export function isErrorCode(code: string): code is ErrorCode {
  return (ERROR_CODES as readonly string[]).includes(code);
}

/** Builds an `ApiError` from a non-2xx response, tolerating non-JSON bodies. */
export async function errorFromResponse(res: Response): Promise<ApiError> {
  let problem: ProblemDetails = {};
  try {
    problem = (await res.json()) as ProblemDetails;
  } catch {
    // Non-JSON body (gateway error page, empty body).
  }
  const code =
    problem.code ??
    STATUS_FALLBACK_CODES[res.status] ??
    (res.status >= 500 ? "INTERNAL_ERROR" : "UNKNOWN");
  return new ApiError(
    res.status,
    code,
    problem.detail ?? problem.title ?? `Request failed with status ${res.status}`,
    problem.errors,
    typeof problem.reason === "string" ? problem.reason : undefined,
  );
}

/** Parses a JSON success body, or throws the `ApiError` for a failed response. */
export async function parseResponse<T>(res: Response): Promise<T> {
  if (!res.ok) throw await errorFromResponse(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** The translation key (under `Errors`) for any thrown value. */
export function errorKey(error: unknown): ErrorCode | "NETWORK_ERROR" | "UNKNOWN" {
  if (error instanceof ApiError) {
    return isErrorCode(error.code) ? error.code : "UNKNOWN";
  }
  if (error instanceof TypeError) return "NETWORK_ERROR";
  return "UNKNOWN";
}

const COUPON_REASONS = [
  "NotFound",
  "Expired",
  "NotStarted",
  "Exhausted",
  "PerPatientLimit",
  "NotApplicable",
  "NoPrice",
] as const;

/** Translation key (under `Coupon.reason`) for a refused coupon, from a `reason` or a `COUPON_INVALID` error. */
export function couponReasonKey(source: unknown): (typeof COUPON_REASONS)[number] | "Unknown" {
  const reason = source instanceof ApiError ? source.reason : source;
  return (COUPON_REASONS as readonly unknown[]).includes(reason)
    ? (reason as (typeof COUPON_REASONS)[number])
    : "Unknown";
}

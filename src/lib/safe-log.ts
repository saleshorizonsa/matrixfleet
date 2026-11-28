import "server-only";

/**
 * Log an error without dumping the whole error object.
 *
 * SDK errors (Stripe, Supabase, fetch) can carry request/response headers and raw payloads.
 * Only well-known, non-sensitive fields are written to the logs.
 */
export function logError(label: string, err: unknown) {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const pick = (k: string) => (typeof e[k] === "string" || typeof e[k] === "number" ? e[k] : undefined);
    console.error(label, {
      name: pick("name"),
      type: pick("type"),
      code: pick("code"),
      statusCode: pick("statusCode"),
      requestId: pick("requestId"),
      message: typeof e.message === "string" ? redact(e.message).slice(0, 300) : undefined,
    });
  } else {
    console.error(label, redact(String(err)).slice(0, 300));
  }
}

/** Mask anything that looks like a credential inside free text. */
export function redact(text: string) {
  return text
    .replace(/\b(sk|rk|pk)_(live|test)_[A-Za-z0-9]+/g, "$1_$2_[redacted]")
    .replace(/\bwhsec_[A-Za-z0-9]+/g, "whsec_[redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[jwt redacted]")
    .replace(/(postgres(?:ql)?:\/\/[^:\s/]+:)[^@\s]+@/g, "$1[redacted]@");
}

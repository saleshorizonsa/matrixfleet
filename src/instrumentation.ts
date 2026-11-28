/**
 * Runs once when a server instance starts, before it handles any request.
 * 1. Refuses to start if critical environment variables are missing or invalid.
 * 2. Logs every unhandled server error with its reference (digest) — the same reference the user
 *    sees on the error page — without stack traces or request data leaving the server.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertEnv } = await import("./lib/env");
    assertEnv();
  }
}

export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routePath?: string; routeType?: string },
) {
  const e = err as { digest?: string; name?: string; message?: string };
  // full detail stays in server logs; the browser only ever gets the digest as a reference
  console.error("[error]", {
    ref: e.digest ?? "n/a",
    route: context.routePath ?? request.path.split("?")[0],
    type: context.routeType,
    method: request.method,
    name: e.name,
    message: (e.message ?? "").slice(0, 300),
  });
}

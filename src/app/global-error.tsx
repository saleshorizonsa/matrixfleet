"use client";

/** Last-resort error page (replaces the root layout, so no translations or styles are available). */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0, background: "#f6f7fb", color: "#0f172a" }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ color: "#64748b", margin: 0 }}>Please try again. If it keeps happening, contact support and quote the reference below.</p>
          {error.digest && <p style={{ fontFamily: "monospace", fontSize: 12, color: "#94a3b8" }}>Reference: {error.digest}</p>}
          <button onClick={reset} style={{ marginTop: 16, padding: "10px 18px", borderRadius: 12, border: 0, background: "#5b5bf7", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

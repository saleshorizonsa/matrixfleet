/** Country code → flag emoji (regional indicator symbols). */
export function flag(code: string | null | undefined) {
  if (!code || code.length !== 2) return "🏳️";
  const cc = code.toUpperCase();
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export function Flag({ code, className }: { code: string | null | undefined; className?: string }) {
  return (
    <span className={className} role="img" aria-label={code ?? ""}>
      {flag(code)}
    </span>
  );
}

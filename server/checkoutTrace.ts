/** Structured checkout logs — visible in Vercel function logs. Never log secrets. */
export function checkoutTrace(
  step: string,
  data?: Record<string, unknown>,
): void {
  const safe = data ? sanitizeTraceData(data) : undefined;
  if (safe && Object.keys(safe).length > 0) {
    console.log(`[checkout] ${step}`, safe);
  } else {
    console.log(`[checkout] ${step}`);
  }
}

export function checkoutTraceError(
  step: string,
  err: unknown,
  data?: Record<string, unknown>,
): void {
  const safe = data ? sanitizeTraceData(data) : undefined;
  const message = err instanceof Error ? err.message : String(err);
  const stack =
    err instanceof Error && err.stack
      ? err.stack.split("\n").slice(0, 6).join("\n")
      : undefined;
  console.error(`[checkout] ${step} ERROR: ${message}`, {
    ...(safe ?? {}),
    ...(stack ? { stack } : {}),
  });
}

function sanitizeTraceData(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (/secret|token|password|authorization/i.test(key)) continue;
    if (value == null || typeof value === "boolean" || typeof value === "number") {
      out[key] = value;
      continue;
    }
    if (typeof value === "string") {
      out[key] = value.length > 120 ? `${value.slice(0, 120)}…` : value;
      continue;
    }
    out[key] = value;
  }
  return out;
}

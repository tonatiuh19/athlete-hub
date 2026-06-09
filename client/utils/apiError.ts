/** Normalize API / axios errors to a user-visible string (never render objects in UI). */
export function extractApiErrorMessage(
  err: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (typeof err === "string" && err.trim()) return err.trim();

  const ax = err as {
    response?: { data?: unknown };
    message?: string;
  };

  const data = ax?.response?.data;
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const nested = record.error;
    if (typeof nested === "string" && nested.trim()) return nested.trim();
    if (nested && typeof nested === "object") {
      const msg = (nested as { message?: unknown }).message;
      if (typeof msg === "string" && msg.trim()) return msg.trim();
    }
    if (typeof record.message === "string" && record.message.trim()) {
      return record.message.trim();
    }
  }

  if (typeof ax?.message === "string" && ax.message.trim()) return ax.message.trim();
  return fallback;
}

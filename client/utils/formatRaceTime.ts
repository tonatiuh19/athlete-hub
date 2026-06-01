export function formatRaceTimeMs(ms?: number | null): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function parseRaceTimeToMs(value: string): number | null {
  const s = value.trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s) * 1000;
  const parts = s.split(":").map((p) => parseFloat(p));
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
    return Math.round((parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000);
  }
  if (parts.length === 2 && parts.every((n) => Number.isFinite(n))) {
    return Math.round((parts[0] * 60 + parts[1]) * 1000);
  }
  return null;
}

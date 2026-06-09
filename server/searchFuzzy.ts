/** Accent-insensitive folding + lightweight fuzzy scoring for search suggestions. */

export function foldAccents(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[b.length];
}

/** 0–100 relevance score; higher is better. */
export function fuzzyScore(query: string, ...fields: (string | null | undefined)[]): number {
  const q = foldAccents(query);
  if (q.length < 2) return 0;

  let best = 0;
  for (const field of fields) {
    if (!field) continue;
    const t = foldAccents(field);
    if (!t) continue;

    if (t === q) best = Math.max(best, 100);
    else if (t.startsWith(q)) best = Math.max(best, 92);
    else if (t.includes(q)) best = Math.max(best, 85);

    const tokens = q.split(/\s+/).filter((tok) => tok.length >= 2);
    if (tokens.length > 0) {
      const tokenHits = tokens.filter((tok) => t.includes(tok)).length;
      best = Math.max(best, (tokenHits / tokens.length) * 78);
    }

    const maxLen = Math.max(q.length, t.length);
    if (maxLen <= 48) {
      const dist = levenshtein(q, t.slice(0, Math.min(t.length, q.length + 8)));
      const ratio = 1 - dist / maxLen;
      if (ratio >= 0.72) best = Math.max(best, Math.round(ratio * 70));
    }
  }
  return best;
}

export function searchTokens(query: string): string[] {
  const folded = foldAccents(query);
  const parts = folded.split(/\s+/).filter((t) => t.length >= 2);
  return parts.length > 0 ? parts : folded.length >= 2 ? [folded] : [];
}

/** Build SQL OR clause params for broad candidate fetch (each token as LIKE). */
export function likePatternsForTokens(tokens: string[]): string[] {
  const patterns = new Set<string>();
  for (const token of tokens) {
    patterns.add(`%${token}%`);
  }
  return [...patterns];
}

export function rankByFuzzy<T>(
  items: T[],
  query: string,
  getFields: (item: T) => (string | null | undefined)[],
  limit: number,
): T[] {
  return items
    .map((item) => ({
      item,
      score: fuzzyScore(query, ...getFields(item)),
    }))
    .filter(({ score }) => score >= 28)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item }) => item);
}

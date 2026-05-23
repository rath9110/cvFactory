function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (setA.size === 0 && setB.size === 0) return 1;
  let intersection = 0;
  for (const t of setA) if (setB.has(t)) intersection += 1;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

export function editFraction(original: string, edited: string): number {
  return 1 - jaccardSimilarity(original, edited);
}

export function tokenChanges(
  original: string,
  edited: string
): { added: string[]; removed: string[] } {
  const setA = new Set(tokenize(original));
  const setB = new Set(tokenize(edited));
  const added: string[] = [];
  const removed: string[] = [];
  for (const t of setB) if (!setA.has(t)) added.push(t);
  for (const t of setA) if (!setB.has(t)) removed.push(t);
  return { added, removed };
}

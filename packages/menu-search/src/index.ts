export type ModifierSearchMatch<T> = {
  modifier: T;
  score: number;
};

type SearchOptions<T> = {
  aliases?: (modifier: T) => readonly (string | null | undefined)[];
  name?: (modifier: T) => string | null | undefined;
  threshold?: number;
};

const normalize = (value: string | null | undefined) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

function grams(value: string) {
  const padded = `^${value}$`;
  const counts = new Map<string, number>();
  for (let index = 0; index < padded.length - 1; index += 1) {
    const gram = padded.slice(index, index + 2);
    counts.set(gram, (counts.get(gram) || 0) + 1);
  }
  return counts;
}

export function cosineTextSimilarity(left: string, right: string) {
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;

  const leftGrams = grams(normalizedLeft);
  const rightGrams = grams(normalizedRight);
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (const [gram, count] of leftGrams) {
    dot += count * (rightGrams.get(gram) || 0);
    leftMagnitude += count * count;
  }
  for (const count of rightGrams.values()) rightMagnitude += count * count;

  return dot / Math.sqrt(leftMagnitude * rightMagnitude);
}

function fieldScore(query: string, candidate: string) {
  const normalizedCandidate = normalize(candidate);
  if (!normalizedCandidate) return 0;
  if (normalizedCandidate === query) return 1;
  if (normalizedCandidate.startsWith(query)) return 0.97;
  if (normalizedCandidate.split(' ').includes(query)) return 0.94;
  if (normalizedCandidate.includes(query)) return 0.9;
  return cosineTextSimilarity(query, normalizedCandidate);
}

function defaultThreshold(query: string) {
  if (query.length <= 2) return 0.9;
  if (query.length <= 4) return 0.5;
  return 0.38;
}

export function rankModifierMatches<T extends { name?: string | null }>(
  modifiers: readonly T[],
  rawQuery: string,
  options: SearchOptions<T> = {},
): ModifierSearchMatch<T>[] {
  const query = normalize(rawQuery);
  if (!query) return modifiers.map((modifier) => ({ modifier, score: 1 }));

  const getName = options.name || ((modifier: T) => modifier.name);
  const threshold = options.threshold ?? defaultThreshold(query);

  return modifiers
    .map((modifier, index) => {
      const nameScore = fieldScore(query, String(getName(modifier) || ''));
      const aliasScore = Math.max(
        0,
        ...(options.aliases?.(modifier) || []).map((alias) => fieldScore(query, String(alias || '')) * 0.82),
      );
      return { modifier, score: Math.max(nameScore, aliasScore), index };
    })
    .filter((match) => match.score >= threshold)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ modifier, score }) => ({ modifier, score }));
}

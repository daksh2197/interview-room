/**
 * The "no invented numbers" check.
 *
 * A language model asked to tighten an answer will sometimes make it sound better
 * by adding a number: "cut costs by 30%" when the candidate never said 30.
 * In an interview that is worse than no number at all, because it is a claim the
 * candidate cannot back up. So every number in the model's rewrite has to appear
 * somewhere in what the candidate wrote: the answer itself, or their story bank.
 *
 * Numbers are compared by value, so "$2.7M", "2.7 million" and "2,700,000" all match.
 */

export interface FoundNumber {
  /** The text as written, e.g. "$2.7M" or "twelve". */
  raw: string;
  value: number;
}

const SCALES: Record<string, number> = {
  k: 1e3,
  thousand: 1e3,
  m: 1e6,
  mm: 1e6,
  million: 1e6,
  b: 1e9,
  bn: 1e9,
  billion: 1e9,
};

/**
 * Number words. "one" is left out on purpose: "one of our customers" is not a claim,
 * and flagging it would throw away good rewrites. "Zero" and "a dozen" are kept.
 */
const WORDS: Record<string, number> = {
  zero: 0,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
  dozen: 12,
};

// Digits with optional commas and decimals, then an optional scale.
// A scale written as a letter (k, M, bn) must touch the number: "2.7M" counts, "5 m" (metres) does not.
// A scale written as a word may have a space: "2.7 million".
const DIGITS =
  /(?<num>\d[\d,]*(?:\.\d+)?)(?:(?<suffix>k|mm|m|bn|b)(?![\p{L}\p{N}])|\s?(?<word>thousand|million|billion)(?![\p{L}\p{N}]))?/giu;
const WORD = /\p{L}+/gu;
const GROUPED = /^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/;

/** Every number in `text`, in order. */
export function numbersIn(text: string): FoundNumber[] {
  const found: { index: number; raw: string; value: number }[] = [];

  for (const match of text.matchAll(DIGITS)) {
    const index = match.index ?? 0;
    const digits = (match.groups?.num ?? '').replace(/,+$/, '');
    const scaleText = match.groups?.suffix ?? match.groups?.word ?? '';
    const scale = SCALES[scaleText.toLowerCase()] ?? 1;
    const tail = match[0].slice((match.groups?.num ?? '').length); // "M", " million" or ""

    if (GROUPED.test(digits) || !digits.includes(',')) {
      found.push({ index, raw: `${digits}${tail}`, value: Number(digits.replaceAll(',', '')) * scale });
      continue;
    }

    // Commas that are not thousands separators are list commas: "1,2,3" is three numbers.
    const parts = digits.split(',').filter((part) => part !== '');
    parts.forEach((part, i) => {
      const last = i === parts.length - 1;
      found.push({ index: index + i, raw: last ? `${part}${tail}` : part, value: Number(part) * (last ? scale : 1) });
    });
  }

  for (const match of text.matchAll(WORD)) {
    const value = WORDS[match[0].toLowerCase()];
    if (value !== undefined) found.push({ index: match.index ?? 0, raw: match[0], value });
  }

  return found
    .filter((n) => Number.isFinite(n.value))
    .sort((a, b) => a.index - b.index)
    .map(({ raw, value }) => ({ raw, value }));
}

function same(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

/**
 * The numbers in `candidate` that appear nowhere in `sources`, as written in `candidate`.
 * An empty list means the candidate text passes.
 */
export function inventedNumbers(candidate: string, sources: readonly string[]): string[] {
  const known = sources.flatMap((source) => numbersIn(source).map((n) => n.value));
  const invented: string[] = [];
  for (const n of numbersIn(candidate)) {
    if (!known.some((k) => same(k, n.value)) && !invented.includes(n.raw)) invented.push(n.raw);
  }
  return invented;
}

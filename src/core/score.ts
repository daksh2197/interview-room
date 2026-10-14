/**
 * The judge. The model reads; this code decides.
 *
 * The model's job is narrow: copy out which sentences of the answer are Situation,
 * Task, Action and Result, say whether there is a named outcome, and suggest a rewrite.
 * Everything that can be counted is counted here, the same way every time:
 *
 *   - Each excerpt the model copied must really be in the answer, or it is dropped.
 *   - Each part's share of the answer is measured in words.
 *   - Speaking time comes from the word count, not from the model.
 *   - The band (Ready, Close, Rework) is three yes/no checks added up.
 *
 * So the same model output always gives the same grade, and a change to the rules is
 * a change to this file that the tests can see.
 */

import { inventedNumbers, numbersIn } from './numbers';
import { STAR_PARTS, type ModelGrade, type StarPart } from './schema';
import { countWords, lengthVerdict, speakingSeconds, type LengthVerdict } from './speaking';

/** Setup (Situation + Task) should be no more than this share of the answer. */
export const SETUP_MAX = 0.4;
/** Action, the part about what you did, should be at least this share. */
export const ACTION_MIN = 0.3;
/** An excerpt shorter than this many words is too short to mean anything ("I", "So"). */
export const EXCERPT_MIN_WORDS = 2;
/** Answers shorter than this are not sent for grading at all. */
export const MIN_WORDS_TO_GRADE = 20;

export type Band = 'ready' | 'close' | 'rework';

export interface PartReport {
  /** True when at least one word of the answer is counted for this part. */
  present: boolean;
  /** Share of the answer's words, 0 to 1. Each word counts once, for the first part that claims it. */
  share: number;
  /** Excerpts found in the answer, word for word. */
  excerpts: string[];
  /** Excerpts the model gave that are not in the answer. Dropped, but shown so nothing is hidden. */
  dropped: string[];
  /** Excerpts too short to mean anything ("So"). Ignored, and not counted as dropped. */
  ignored: string[];
}

export type StructureIssue = 'missing-part' | 'long-setup' | 'thin-action';

export interface Report {
  words: number;
  seconds: number;
  parts: Record<StarPart, PartReport>;
  structure: { ok: boolean; missing: StarPart[]; issues: StructureIssue[]; setupShare: number; actionShare: number };
  /** `numbers` are the numbers inside the verified Result excerpts. */
  evidence: { ok: boolean; numbers: string[]; namedOutcome: boolean };
  length: { ok: boolean; verdict: LengthVerdict };
  band: Band;
  passed: number;
}

/** Lower case, plain quotes and dashes, single spaces, no punctuation at either end. */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201F\u2033]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s"'.,;:!?()-]+|[\s"'.,;:!?()-]+$/g, '');
}

/**
 * The words of a text, normalised, the same words countWords() counts.
 * Matching on whole words means an excerpt like "ed the export" can never match "fixed the export".
 */
export function wordsOf(text: string): string[] {
  return text
    .split(/\s+/)
    .filter((token) => /[\p{L}\p{N}]/u.test(token))
    .map((token) => normalise(token).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''));
}

/** Every index where `needle` appears in `haystack` as a run of whole words. */
function findRuns(haystack: readonly string[], needle: readonly string[]): number[] {
  const starts: number[] = [];
  if (needle.length === 0) return starts;
  for (let i = 0; i + needle.length <= haystack.length; i++) {
    let match = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        match = false;
        break;
      }
    }
    if (match) starts.push(i);
  }
  return starts;
}

/**
 * Check every part's excerpts against the answer and measure the parts.
 * `claimed[i]` records which part owns word i. Parts are checked in STAR order, so if the
 * model files one sentence under two parts, the first one keeps it and the second gets nothing.
 */
function checkParts(answer: string, grade: ModelGrade): Record<StarPart, PartReport> {
  const words = wordsOf(answer);
  const claimed: (StarPart | null)[] = words.map(() => null);
  const parts = {} as Record<StarPart, PartReport>;

  for (const part of STAR_PARTS) {
    const report: PartReport = { present: false, share: 0, excerpts: [], dropped: [], ignored: [] };
    let count = 0;
    for (const raw of grade[part]) {
      const excerpt = raw.trim();
      if (excerpt === '') continue;
      const needle = wordsOf(excerpt);
      if (needle.length < EXCERPT_MIN_WORDS) {
        report.ignored.push(excerpt);
        continue;
      }
      const starts = findRuns(words, needle);
      if (starts.length === 0) {
        report.dropped.push(excerpt);
        continue;
      }
      // Prefer an occurrence no other part has claimed yet.
      const free = starts.find((s) => needle.every((_, j) => claimed[s + j] === null || claimed[s + j] === part));
      const start = free ?? starts[0] ?? 0;
      for (let j = 0; j < needle.length; j++) {
        if (claimed[start + j] === null) {
          claimed[start + j] = part;
          count++;
        }
      }
      if (!report.excerpts.some((e) => normalise(e) === normalise(excerpt))) report.excerpts.push(excerpt);
    }
    report.present = count > 0;
    report.share = words.length > 0 ? Math.min(1, count / words.length) : 0;
    parts[part] = report;
  }
  return parts;
}

export function scoreAnswer(answer: string, grade: ModelGrade): Report {
  const words = countWords(answer);
  const seconds = speakingSeconds(answer);

  const parts = checkParts(answer, grade);

  const missing = STAR_PARTS.filter((part) => !parts[part].present);
  const setupShare = Math.min(1, parts.situation.share + parts.task.share);
  const actionShare = parts.action.share;
  const issues: StructureIssue[] = [];
  if (missing.length > 0) issues.push('missing-part');
  if (setupShare > SETUP_MAX) issues.push('long-setup');
  if (parts.action.present && actionShare < ACTION_MIN) issues.push('thin-action');

  // Evidence has to be in how it ended. A number in the setup ("Two years ago") is not evidence.
  const numbers = parts.result.excerpts.flatMap((e) => numbersIn(e).map((n) => n.raw));
  const evidenceOk = numbers.length > 0 || grade.named_outcome;

  const verdict = lengthVerdict(seconds);
  const lengthOk = verdict === 'on-target';

  const structureOk = issues.length === 0;
  const passed = [structureOk, evidenceOk, lengthOk].filter(Boolean).length;
  const band: Band = passed === 3 ? 'ready' : passed === 2 ? 'close' : 'rework';

  return {
    words,
    seconds,
    parts,
    structure: { ok: structureOk, missing, issues, setupShare, actionShare },
    evidence: { ok: evidenceOk, numbers, namedOutcome: grade.named_outcome },
    length: { ok: lengthOk, verdict },
    band,
    passed,
  };
}

/**
 * Decide whether the model's rewrite can be shown.
 * It is thrown away if it is empty or if it uses a number the candidate never wrote.
 */
export function checkRewrite(
  rewrite: string,
  sources: readonly string[],
): { ok: true; text: string } | { ok: false; reason: 'empty' } | { ok: false; reason: 'invented'; numbers: string[] } {
  const text = rewrite.trim();
  if (text === '') return { ok: false, reason: 'empty' };
  const invented = inventedNumbers(text, sources);
  if (invented.length > 0) return { ok: false, reason: 'invented', numbers: invented };
  return { ok: true, text };
}

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
  present: boolean;
  /** Share of the answer's words, 0 to 1. */
  share: number;
  /** Excerpts found in the answer. */
  excerpts: string[];
  /** Excerpts the model gave that are not in the answer. Dropped, but shown so nothing is hidden. */
  dropped: string[];
}

export type StructureIssue = 'missing-part' | 'long-setup' | 'thin-action';

export interface Report {
  words: number;
  seconds: number;
  parts: Record<StarPart, PartReport>;
  structure: { ok: boolean; missing: StarPart[]; issues: StructureIssue[]; setupShare: number; actionShare: number };
  evidence: { ok: boolean; numbers: string[]; namedOutcome: boolean };
  length: { ok: boolean; verdict: LengthVerdict };
  band: Band;
  passed: number;
}

/** Lower case, plain quotes and dashes, single spaces, no punctuation at either end. */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s"'.,;:!?()-]+|[\s"'.,;:!?()-]+$/g, '');
}

function checkPart(answer: string, excerpts: readonly string[], totalWords: number): PartReport {
  const haystack = normalise(answer);
  const found: string[] = [];
  const dropped: string[] = [];
  for (const excerpt of excerpts) {
    const needle = normalise(excerpt);
    if (countWords(needle) >= EXCERPT_MIN_WORDS && haystack.includes(needle)) {
      if (!found.some((f) => normalise(f) === needle)) found.push(excerpt.trim());
    } else if (excerpt.trim() !== '') {
      dropped.push(excerpt.trim());
    }
  }
  const words = found.reduce((sum, e) => sum + countWords(e), 0);
  const share = totalWords > 0 ? Math.min(1, words / totalWords) : 0;
  return { present: found.length > 0, share, excerpts: found, dropped };
}

export function scoreAnswer(answer: string, grade: ModelGrade): Report {
  const words = countWords(answer);
  const seconds = speakingSeconds(answer);

  const parts = {} as Record<StarPart, PartReport>;
  for (const part of STAR_PARTS) parts[part] = checkPart(answer, grade[part], words);

  const missing = STAR_PARTS.filter((part) => !parts[part].present);
  const setupShare = Math.min(1, parts.situation.share + parts.task.share);
  const actionShare = parts.action.share;
  const issues: StructureIssue[] = [];
  if (missing.length > 0) issues.push('missing-part');
  if (setupShare > SETUP_MAX) issues.push('long-setup');
  if (parts.action.present && actionShare < ACTION_MIN) issues.push('thin-action');

  const numbers = numbersIn(answer).map((n) => n.raw);
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

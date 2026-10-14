/**
 * Every sentence the grader writes about an answer, in one place.
 * The judge (score.ts) returns facts; this file turns them into words.
 */

import type { Problem } from './grade';
import { ACTION_MIN, SETUP_MAX, type Band, type Report } from './score';
import { STAR_PARTS, type StarPart } from './schema';
import { clock, TARGET } from './speaking';

export const BAND_TITLE: Record<Band, string> = {
  ready: 'Ready',
  close: 'Close',
  rework: 'Rework',
};

export const BAND_LINE: Record<Band, string> = {
  ready: 'All three checks pass. Say it out loud a few times and it is ready.',
  close: 'Two of three checks pass. One fix away.',
  rework: 'One check or none passes. Rebuild it around the parts below.',
};

export const PART_NAME: Record<StarPart, string> = {
  situation: 'Situation',
  task: 'Task',
  action: 'Action',
  result: 'Result',
};

/** A share from 0 to 1 as a whole percent. Never "NaN%" or "-0%". */
export function pct(share: number): string {
  if (!Number.isFinite(share) || share <= 0) return '0%';
  const whole = Math.min(100, Math.round(share * 100));
  return whole === 0 ? 'under 1%' : `${whole}%`;
}

/**
 * A share shown next to its limit. Plain rounding could print "Setup is 40%. Keep it to 40% or less"
 * for 40.4%, so the figure is nudged to the side of the limit it is really on. Away from the
 * limit it rounds normally, so it agrees with the STAR bar.
 */
function pctBeside(share: number, limit: number, side: 'over' | 'under'): string {
  const shown = Math.round(share * 100);
  const edge = Math.round(limit * 100);
  if (side === 'over' && shown <= edge) return `${edge + 1}%`;
  if (side === 'under' && shown >= edge) return `${edge - 1}%`;
  return pct(share);
}

function list(items: readonly string[], more = false): string {
  if (more) return `${items.join(', ')} and more`;
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function structureLine(report: Report): string {
  const { missing, issues, setupShare, actionShare } = report.structure;
  if (report.structure.ok) {
    return `All four parts are there. Setup is ${pct(setupShare)} of the answer and action is ${pct(actionShare)}.`;
  }
  const out: string[] = [];
  if (issues.includes('missing-part')) out.push(`Missing: ${list(missing.map((p) => PART_NAME[p]))}.`);
  if (issues.includes('long-setup')) out.push(`Setup is ${pctBeside(setupShare, SETUP_MAX, 'over')} of the answer. Keep it to ${pct(SETUP_MAX)} or less and get to what you did.`);
  if (issues.includes('thin-action')) out.push(`Action is only ${pctBeside(actionShare, ACTION_MIN, 'under')}. It should carry the answer: at least ${pct(ACTION_MIN)}.`);
  return out.join(' ');
}

export function evidenceLine(report: Report): string {
  const { numbers, namedOutcome, ok } = report.evidence;
  if (!ok) return 'No number and no concrete outcome in how it ended. Say how it ended in a way someone could check.';
  if (numbers.length > 0) {
    const shown = numbers.slice(0, 4).map((n) => `"${n}"`);
    return `Numbers in how it ended: ${list(shown, numbers.length > 4)}.`;
  }
  return namedOutcome ? 'No number, but it names a concrete outcome. A number would make it stronger.' : '';
}

export function lengthLine(report: Report): string {
  const t = `About ${clock(report.seconds)} to say (${report.words} words).`;
  switch (report.length.verdict) {
    case 'on-target':
      return `${t} Inside the ${clock(TARGET.low)} to ${clock(TARGET.high)} window.`;
    case 'short':
      return `${t} Short of ${clock(TARGET.low)}. Add what you did and how it ended.`;
    case 'long':
      return `${t} Over ${clock(TARGET.high)}. Cut the setup first.`;
    default:
      return t;
  }
}

/** The one line a screen reader announces when a grade arrives. */
export function announce(report: Report): string {
  return `${BAND_TITLE[report.band]}. ${report.passed} of 3 checks pass.`;
}

export const PROBLEM_TEXT: Record<Problem, string> = {
  'bad-key': 'Anthropic did not accept that key. Check it in the Your key section, or paste a new one.',
  'no-access': "That key doesn't have access to this model. Try another model, or check the key's permissions in the Claude Console.",
  'rate-limited': 'Too many requests on this key right now. Wait a minute and try again.',
  busy: 'The API is busy right now. Try again in a minute.',
  'bad-request': 'The API turned this request down. If it keeps happening, the model name may have changed: try another model.',
  server: 'Something went wrong on the API side. Try again.',
  network: "Couldn't reach the API. Check your connection. The demo works with no signal.",
  refused: 'The model declined to grade this answer. Try rewording it.',
  'cut-off': 'The reply was cut off before it finished. Try a shorter answer.',
  'bad-shape': "The reply didn't match the grading format, so it wasn't shown. Try again.",
};

export function tooShortText(words: number): string {
  return `That's ${words} ${words === 1 ? 'word' : 'words'}. Write at least 20 before grading: what happened, what you did, how it ended.`;
}

export function inventedText(numbers: readonly string[]): string {
  const shown = numbers.slice(0, 4).map((n) => `"${n}"`);
  return `The rewrite used ${numbers.length === 1 ? 'a number' : 'numbers'} you never wrote (${list(shown, numbers.length > 4)}), so it was thrown away. The grade above still stands.`;
}

export const EMPTY_REWRITE_TEXT = 'The model sent back no rewrite this time. The grade above still stands.';

export { STAR_PARTS };

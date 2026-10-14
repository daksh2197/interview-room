/**
 * How long an answer takes to say out loud.
 *
 * Interviewers tend to want a behavioural answer in about one to two minutes.
 * Typed answers have no clock, so this turns words into an estimated speaking time.
 */

/**
 * The assumed speaking pace. 150 words a minute is a rule of thumb for calm,
 * conversational speech, not a measurement of you. Time yourself reading one of your
 * answers aloud and change this number if you are faster or slower.
 */
export const WORDS_PER_MINUTE = 150;

/** The target window, in seconds. */
export const TARGET = { low: 60, high: 120 } as const;

export type LengthVerdict = 'empty' | 'short' | 'on-target' | 'long';

/** Words are runs of characters separated by spaces that contain at least one letter or digit. */
export function countWords(text: string): number {
  let count = 0;
  for (const token of text.split(/\s+/)) {
    if (/[\p{L}\p{N}]/u.test(token)) count++;
  }
  return count;
}

/** Estimated seconds to say `text` at `wpm` words a minute, rounded to the nearest second. */
export function speakingSeconds(text: string, wpm: number = WORDS_PER_MINUTE): number {
  const pace = Number.isFinite(wpm) && wpm > 0 ? wpm : WORDS_PER_MINUTE;
  return Math.round((countWords(text) / pace) * 60);
}

export function lengthVerdict(seconds: number): LengthVerdict {
  if (!(seconds > 0)) return 'empty';
  if (seconds < TARGET.low) return 'short';
  if (seconds > TARGET.high) return 'long';
  return 'on-target';
}

/** 0 -> "0:00", 75 -> "1:15". Anything that is not a sensible number shows as 0:00. */
export function clock(seconds: number): string {
  const s = Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

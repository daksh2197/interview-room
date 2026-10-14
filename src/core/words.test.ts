import { describe, expect, it } from 'vitest';
import type { ModelGrade } from './schema';
import { scoreAnswer } from './score';
import { announce, evidenceLine, inventedText, lengthLine, pct, PROBLEM_TEXT, structureLine, tooShortText } from './words';

const bad = /NaN|Infinity|undefined|-0%|null/;

const report = (answer: string, over: Partial<ModelGrade> = {}) =>
  scoreAnswer(answer, {
    situation: [],
    task: [],
    action: [],
    result: [],
    named_outcome: false,
    coaching: '',
    rewrite: '',
    ...over,
  });

describe('pct', () => {
  it('rounds to a whole percent and never shows NaN or -0', () => {
    expect(pct(0.264)).toBe('26%');
    expect(pct(1.5)).toBe('100%');
    for (const v of [Number.NaN, -0, -1, Number.NEGATIVE_INFINITY]) expect(pct(v)).toBe('0%');
  });
});

describe('the lines under a grade', () => {
  it('names every missing part in plain English', () => {
    expect(structureLine(report('Some words here that are not structured at all.'))).toBe(
      'Missing: Situation, Task, Action and Result.',
    );
  });

  it('never prints NaN, Infinity, undefined or -0 for an empty answer', () => {
    const r = report('');
    for (const line of [structureLine(r), evidenceLine(r), lengthLine(r), announce(r)]) expect(line).not.toMatch(bad);
  });

  it('says how long the answer takes to say', () => {
    expect(lengthLine(report(Array(150).fill('w').join(' ')))).toBe(
      'About 1:00 to say (150 words). Inside the 1:00 to 2:00 window.',
    );
  });

  it('quotes the numbers it found', () => {
    expect(evidenceLine(report('We cut it by 40% in 3 weeks.'))).toBe('Numbers in your answer: "40" and "3".');
  });

  it('gets singular and plural right', () => {
    expect(tooShortText(1)).toContain('1 word.');
    expect(tooShortText(0)).toContain('0 words.');
    expect(inventedText(['30'])).toContain('a number you never wrote ("30")');
    expect(inventedText(['3', '20'])).toContain('numbers you never wrote ("3" and "20")');
  });

  it('has a message for every problem', () => {
    for (const text of Object.values(PROBLEM_TEXT)) expect(text.length).toBeGreaterThan(10);
  });
});

describe('long lists', () => {
  it('lists the first four numbers, then "and more"', () => {
    expect(evidenceLine(report('We did 1 then 2 then 3 then 4 then 5.'))).toBe('Numbers in your answer: "1", "2", "3", "4" and more.');
  });
});

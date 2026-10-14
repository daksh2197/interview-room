import { describe, expect, it } from 'vitest';
import { clock, countWords, lengthVerdict, speakingSeconds, TARGET, WORDS_PER_MINUTE } from './speaking';

describe('countWords', () => {
  it('counts words separated by any whitespace', () => {
    expect(countWords('I  fixed\nthe\tbug.')).toBe(4);
  });

  it('does not count stray punctuation as words', () => {
    expect(countWords('I fixed it - fast . . .')).toBe(4);
  });

  it('counts numbers and accented words', () => {
    expect(countWords('Cut 40% from café costs')).toBe(5);
  });

  it('is zero for blank text', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   \n ')).toBe(0);
  });
});

describe('speakingSeconds', () => {
  it('turns 150 words into one minute at the default pace', () => {
    expect(WORDS_PER_MINUTE).toBe(150);
    expect(speakingSeconds(Array(150).fill('word').join(' '))).toBe(60);
  });

  it('turns 300 words into two minutes', () => {
    expect(speakingSeconds(Array(300).fill('word').join(' '))).toBe(120);
  });

  it('falls back to the default pace when given nonsense', () => {
    const text = Array(75).fill('word').join(' ');
    for (const pace of [0, -10, Number.NaN, Number.POSITIVE_INFINITY]) expect(speakingSeconds(text, pace)).toBe(30);
  });
});

describe('lengthVerdict', () => {
  it('calls 60 to 120 seconds on target, inclusive', () => {
    expect(TARGET).toEqual({ low: 60, high: 120 });
    expect(lengthVerdict(60)).toBe('on-target');
    expect(lengthVerdict(120)).toBe('on-target');
  });

  it('calls under a minute short and over two minutes long', () => {
    expect(lengthVerdict(59)).toBe('short');
    expect(lengthVerdict(121)).toBe('long');
  });

  it('calls zero, negative and NaN empty', () => {
    for (const s of [0, -1, Number.NaN]) expect(lengthVerdict(s)).toBe('empty');
  });
});

describe('clock', () => {
  it('writes minutes and seconds', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(75)).toBe('1:15');
    expect(clock(120)).toBe('2:00');
  });

  it('never shows NaN, Infinity or a minus sign', () => {
    for (const s of [Number.NaN, Number.POSITIVE_INFINITY, -5, -0]) expect(clock(s)).toBe('0:00');
  });
});

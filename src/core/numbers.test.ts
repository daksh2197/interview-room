import { describe, expect, it } from 'vitest';
import { inventedNumbers, numbersIn } from './numbers';

const values = (text: string) => numbersIn(text).map((n) => n.value);

describe('numbersIn', () => {
  it('finds plain numbers, decimals and percentages', () => {
    expect(values('Up 40% in 3.5 weeks, 12 tickets')).toEqual([40, 3.5, 12]);
  });

  it('reads thousands separators as one number', () => {
    expect(values('2,700,000 rows')).toEqual([2700000]);
  });

  it('reads list commas as separate numbers', () => {
    expect(values('steps 1,2,3')).toEqual([1, 2, 3]);
  });

  it('reads scales written as letters or words', () => {
    expect(values('$2.7M, 40k users, 1.2bn events, 3 million calls, 5 thousand rows')).toEqual([
      2.7e6, 40e3, 1.2e9, 3e6, 5e3,
    ]);
  });

  it('does not read a spaced letter as a scale', () => {
    expect(values('5 m away')).toEqual([5]);
  });

  it('ignores a trailing comma', () => {
    expect(numbersIn('We hit 40, then 50.').map((n) => n.raw)).toEqual(['40', '50']);
  });

  it('reads number words, but not "one"', () => {
    expect(values('one of three teams, twelve people, a dozen tickets')).toEqual([3, 12, 12]);
  });

  it('finds nothing in text with no numbers', () => {
    expect(numbersIn('It went well and everyone was happy.')).toEqual([]);
  });
});

describe('inventedNumbers', () => {
  it('passes a rewrite that only uses the candidate numbers', () => {
    expect(inventedNumbers('Cut exports from 20 minutes to 4.', ['it took 20 minutes, now 4'])).toEqual([]);
  });

  it('flags a number the candidate never wrote', () => {
    expect(inventedNumbers('We cut costs by 30%.', ['We cut costs a lot.'])).toEqual(['30']);
  });

  it('matches the same value written differently', () => {
    expect(inventedNumbers('$2.7M in new revenue', ['2,700,000 dollars of revenue'])).toEqual([]);
    expect(inventedNumbers('three weeks', ['3 weeks'])).toEqual([]);
  });

  it('accepts numbers found in any of the sources, such as the story bank', () => {
    expect(inventedNumbers('14 tickets, 2 years', ['14 tickets', 'Number: renewed for 2 years'])).toEqual([]);
  });

  it('lists each invented number once', () => {
    expect(inventedNumbers('From 3 hours to 20 minutes, 3 hours saved', ['a while'])).toEqual(['3', '20']);
  });
});

/**
 * Property tests: two rules that must hold for any text, checked on 500 random ones.
 *  1. A text never invents numbers relative to itself.
 *  2. Adding a number that appears nowhere in the source is always caught.
 */
describe('the number check, on 500 random texts', () => {
  let seed = 42;
  const random = (): number => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;
  const pieces = ['we', 'cut', 'tickets', 'by', '40%', '3.5', '2,700,000', '$2.7M', 'twelve', 'one', '1,2,3', 'Q3', 'EC2', '5k', 'million', 'weeks,', 'and', '7'];
  const sentence = () => Array.from({ length: 3 + Math.floor(random() * 15) }, () => pick(pieces)).join(' ');

  it('never flags a text against itself', () => {
    for (let i = 0; i < 500; i++) {
      const text = sentence();
      expect(inventedNumbers(text, [text]), text).toEqual([]);
    }
  });

  it('always flags a number that is not in the source', () => {
    for (let i = 0; i < 500; i++) {
      const source = sentence();
      const fresh = 100003 + i; // a prime-ish value no random piece can produce
      expect(inventedNumbers(`${source} and then ${fresh} more`, [source]), source).toContain(String(fresh));
    }
  });
});

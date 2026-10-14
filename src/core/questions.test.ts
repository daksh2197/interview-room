import { describe, expect, it } from 'vitest';
import { isRoleFamily, nextQuestion, QUESTIONS, questionsFor, ROLE_FAMILIES } from './questions';

describe('the question bank', () => {
  it('has every role family the spec asks for', () => {
    expect(ROLE_FAMILIES.map((f) => f.id).sort()).toEqual(
      ['behavioural', 'customer-success', 'solutions-engineer', 'tam', 'trackside'].sort(),
    );
  });

  it('has eight questions in every family', () => {
    for (const family of ROLE_FAMILIES) expect(questionsFor(family.id)).toHaveLength(8);
  });

  it('gives every question a unique id and unique wording', () => {
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length);
    expect(new Set(QUESTIONS.map((q) => q.text)).size).toBe(QUESTIONS.length);
  });

  it('has no numbers in any question, so a question can never be a source of numbers', () => {
    for (const q of QUESTIONS) expect(q.text, q.id).not.toMatch(/\d/);
  });

  it('recognises role family ids and nothing else', () => {
    expect(isRoleFamily('tam')).toBe(true);
    expect(isRoleFamily('TAM')).toBe(false);
    expect(isRoleFamily(undefined)).toBe(false);
  });
});

describe('nextQuestion', () => {
  it('never repeats a question until the family runs out, then returns null', () => {
    let seed = 7;
    const random = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
    for (const family of ROLE_FAMILIES) {
      const asked: string[] = [];
      for (let i = 0; i < 8; i++) {
        const q = nextQuestion(family.id, asked, random);
        expect(q).not.toBeNull();
        expect(q?.family).toBe(family.id);
        expect(asked).not.toContain(q?.id);
        asked.push(q?.id ?? '');
      }
      expect(nextQuestion(family.id, asked, random)).toBeNull();
    }
  });

  it('stays in range when random returns the edges or garbage', () => {
    for (const r of [0, 0.999999, 1, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(nextQuestion('tam', [], () => r)).not.toBeNull();
    }
  });

  it('ignores asked ids from other families', () => {
    expect(nextQuestion('tam', ['behavioural-1', 'nonsense'], () => 0)?.id).toBe('tam-1');
  });
});

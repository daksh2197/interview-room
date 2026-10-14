import { describe, expect, it } from 'vitest';
import { GRADE_SCHEMA, MAX_EXCERPTS, validateModelGrade, type ModelGrade } from './schema';

const good: ModelGrade = {
  situation: ['We were short-staffed.'],
  task: [],
  action: ['I rebuilt the rota.'],
  result: ['Overtime dropped.'],
  named_outcome: true,
  coaching: 'Add a number.',
  rewrite: 'We were short-staffed, so I rebuilt the rota.',
};

describe('GRADE_SCHEMA', () => {
  it('uses only what the API structured outputs support', () => {
    const text = JSON.stringify(GRADE_SCHEMA);
    for (const banned of ['minLength', 'maxLength', 'minimum', 'maximum', 'multipleOf', '"pattern"']) {
      expect(text, banned).not.toContain(banned);
    }
    expect(GRADE_SCHEMA.additionalProperties).toBe(false);
  });

  it('requires every property it defines', () => {
    expect([...GRADE_SCHEMA.required].sort()).toEqual(Object.keys(GRADE_SCHEMA.properties).sort());
  });
});

describe('validateModelGrade', () => {
  it('accepts a well-formed grade and trims its text', () => {
    const result = validateModelGrade({ ...good, coaching: '  Add a number.  ' });
    expect(result).toEqual({ ok: true, grade: good });
  });

  it('rejects anything that is not an object', () => {
    for (const value of [null, undefined, 'text', 42, []]) expect(validateModelGrade(value).ok).toBe(false);
  });

  it('rejects a missing field', () => {
    const { rewrite: _dropped, ...rest } = good;
    expect(validateModelGrade(rest).ok).toBe(false);
  });

  it('rejects an extra field', () => {
    expect(validateModelGrade({ ...good, score: 9 })).toEqual({ ok: false, error: 'unexpected field "score"' });
  });

  it('rejects wrong types', () => {
    expect(validateModelGrade({ ...good, named_outcome: 'yes' }).ok).toBe(false);
    expect(validateModelGrade({ ...good, action: 'I did it' }).ok).toBe(false);
    expect(validateModelGrade({ ...good, result: [42] }).ok).toBe(false);
    expect(validateModelGrade({ ...good, coaching: null }).ok).toBe(false);
  });

  it('rejects too many excerpts and text that is far too long', () => {
    expect(validateModelGrade({ ...good, action: Array(MAX_EXCERPTS + 1).fill('x') }).ok).toBe(false);
    expect(validateModelGrade({ ...good, rewrite: 'x'.repeat(5000) }).ok).toBe(false);
  });
});

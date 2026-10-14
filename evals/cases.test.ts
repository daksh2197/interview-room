/**
 * What CI can check about the evals without a key: that every case is well-formed,
 * that every band is covered, and that the one expectation that needs no model (length)
 * is actually true of the answer as written.
 * A case that expects the wrong thing makes every eval run lie, so this matters.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ModelGrade } from '../src/core/schema';
import { lengthVerdict, speakingSeconds } from '../src/core/speaking';
import { bandFor, readCases, score, table } from './evals';

const cases = readCases(JSON.parse(readFileSync(new URL('./cases.json', import.meta.url), 'utf8')));

describe('the eval cases', () => {
  it('has at least ten, with unique ids', () => {
    expect(cases.length).toBeGreaterThanOrEqual(10);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
  });

  it('covers every band', () => {
    expect(new Set(cases.map((c) => bandFor(c.checks)))).toEqual(new Set(['ready', 'close', 'rework']));
  });

  it.each(cases.map((c) => [c.id, c] as const))('%s expects the length its answer really has', (_id, c) => {
    expect(lengthVerdict(speakingSeconds(c.answer)) === 'on-target').toBe(c.checks.length);
  });

  it('starts each id with its expected band', () => {
    for (const c of cases) expect(c.id.startsWith(bandFor(c.checks)), c.id).toBe(true);
  });
});

describe('scoring a run', () => {
  const c = cases[0];
  if (!c) throw new Error('no cases');
  const perfect: ModelGrade = {
    situation: [c.answer.split('. ')[0] ?? ''],
    task: [],
    action: [],
    result: [],
    named_outcome: true,
    coaching: '',
    rewrite: '',
  };

  it('fails a case whose model output misses a part, and says why', async () => {
    const { gradeAnswer } = await import('../src/core/grade');
    const result = await gradeAnswer(
      async () => ({ status: 200, body: { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(perfect) }] } }),
      { model: 'claude-sonnet-5-5', question: c.question, answer: c.answer, stories: [] },
    );
    const row = score(c, result);
    expect(row.pass).toBe(false);
    expect(row.detail).toContain('structure expected y got n');
  });

  it('records an API problem as a failed row', () => {
    const row = score(c, { kind: 'problem', problem: 'bad-key' });
    expect(row).toMatchObject({ got: 'error', pass: false, detail: 'bad-key' });
  });

  it('prints a table with a header and one line per row', () => {
    const out = table([score(c, { kind: 'problem', problem: 'network' })]);
    expect(out.split('\n')).toHaveLength(3);
    expect(out).toContain('FAIL');
  });
});

import { describe, expect, it } from 'vitest';
import { DEMO_CANDIDATE, DEMO_ROUNDS, scriptedSend } from './demo';
import { gradeAnswer } from './grade';
import { DEFAULT_MODEL } from './prompt';
import { validateModelGrade } from './schema';

const run = (i: number) => {
  const round = DEMO_ROUNDS[i];
  if (!round) throw new Error(`no demo round ${i}`);
  return gradeAnswer(scriptedSend(round), { model: DEFAULT_MODEL, question: round.question, answer: round.answer, stories: [] });
};

describe('the demo', () => {
  it('says the candidate is invented', () => {
    expect(DEMO_CANDIDATE).toContain('invented');
  });

  it('has scripted replies that pass the real schema check', () => {
    for (const round of DEMO_ROUNDS) expect(validateModelGrade(round.modelGrade).ok).toBe(true);
  });

  it('has excerpts that are all really in the answers', async () => {
    for (let i = 0; i < DEMO_ROUNDS.length; i++) {
      const result = await run(i);
      if (result.kind !== 'graded') throw new Error('demo did not grade');
      for (const part of Object.values(result.report.parts)) expect(part.dropped).toEqual([]);
    }
  });

  it('round 1 grades Ready and shows its rewrite', async () => {
    const result = await run(0);
    expect(result).toMatchObject({ kind: 'graded', report: { band: 'ready' }, rewrite: { shown: true } });
  });

  it('round 2 grades Rework and the number check throws away its rewrite', async () => {
    const result = await run(1);
    expect(result).toMatchObject({
      kind: 'graded',
      report: { band: 'rework' },
      rewrite: { shown: false, why: 'invented', numbers: ['3', '20'] },
    });
  });

  it('round 2 note names the numbers the check catches', () => {
    expect(DEMO_ROUNDS[1]?.note).toContain('"3 hours"');
    expect(DEMO_ROUNDS[1]?.note).toContain('"20 minutes"');
  });
});

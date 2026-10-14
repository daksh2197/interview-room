/**
 * The whole grading pipeline against a mocked API. No key, no network:
 * this is what CI runs instead of the live evals.
 */
import { describe, expect, it } from 'vitest';
import { gradeAnswer, readReply, type Reply, type Send } from './grade';
import { DEFAULT_MODEL } from './prompt';
import type { ModelGrade } from './schema';
import type { Story } from './stories';

const answer =
  'Our team was losing two days a month to manual billing fixes. I owned the billing pipeline, so the fix was mine to find. ' +
  'I logged every failure for a month in a shared sheet, sorted them by cause, found that 80% came from one currency rounding rule, rewrote that rule with the finance lead and added tests for every currency we bill in. ' +
  'Failures dropped to zero in the next quarter.';

const grade: ModelGrade = {
  situation: ['Our team was losing two days a month to manual billing fixes.'],
  task: ['I owned the billing pipeline, so the fix was mine to find.'],
  action: ['I logged every failure for a month in a shared sheet, sorted them by cause, found that 80% came from one currency rounding rule, rewrote that rule with the finance lead and added tests for every currency we bill in.'],
  result: ['Failures dropped to zero in the next quarter.'],
  named_outcome: true,
  coaching: 'Say how much time that gave back.',
  rewrite: 'We lost two days a month to billing fixes. I logged failures, found 80% came from one rounding rule, and fixed it. Failures dropped to zero.',
};

const ok = (model: unknown, extra: Record<string, unknown> = {}): Reply => ({
  status: 200,
  body: { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(model) }], ...extra },
});

const sendReturning = (reply: Reply): Send => async () => reply;
const input = (over: Partial<{ answer: string; stories: Story[] }> = {}) => ({
  model: DEFAULT_MODEL,
  question: 'Tell me about a time you improved a process by measuring it first.',
  answer,
  stories: [],
  ...over,
});

describe('gradeAnswer with a mocked API', () => {
  it('grades a good reply and shows the rewrite', async () => {
    const result = await gradeAnswer(sendReturning(ok(grade)), input());
    expect(result.kind).toBe('graded');
    if (result.kind !== 'graded') return;
    expect(result.report.structure.ok).toBe(true);
    expect(result.report.evidence.ok).toBe(true);
    expect(result.coaching).toBe('Say how much time that gave back.');
    expect(result.rewrite).toEqual({ shown: true, text: grade.rewrite });
  });

  it('sends the built request body to send()', async () => {
    let seen: unknown;
    await gradeAnswer(async (body) => ((seen = body), ok(grade)), input());
    expect(seen).toMatchObject({ model: DEFAULT_MODEL, output_config: { format: { type: 'json_schema' } } });
  });

  it('keeps the grade but drops a rewrite with an invented number', async () => {
    const result = await gradeAnswer(sendReturning(ok({ ...grade, rewrite: 'That saved 16 hours a month.' })), input());
    expect(result).toMatchObject({ kind: 'graded', rewrite: { shown: false, why: 'invented', numbers: ['16'] } });
  });

  it('allows a rewrite number that comes from the story bank', async () => {
    const stories: Story[] = [
      { id: 'a', title: 'Billing', situation: '', task: '', action: '', result: '', number: '16 hours a month back' },
    ];
    const result = await gradeAnswer(sendReturning(ok({ ...grade, rewrite: 'That saved 16 hours a month.' })), input({ stories }));
    expect(result).toMatchObject({ kind: 'graded', rewrite: { shown: true }, storiesSent: 1 });
  });

  it('does not call the API for an answer under 20 words', async () => {
    let called = false;
    const result = await gradeAnswer(async () => ((called = true), ok(grade)), input({ answer: 'I fixed it.' }));
    expect(result).toEqual({ kind: 'too-short', words: 3 });
    expect(called).toBe(false);
  });

  it('reports a network failure', async () => {
    const result = await gradeAnswer(async () => {
      throw new TypeError('Failed to fetch');
    }, input());
    expect(result).toEqual({ kind: 'problem', problem: 'network' });
  });

  it.each([
    ['text that is not JSON', { status: 200, body: { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Sure! Here is' }] } }],
    ['JSON in the wrong shape', ok({ score: 7 })],
    ['no text block', { status: 200, body: { stop_reason: 'end_turn', content: [{ type: 'tool_use' }] } }],
    ['a body that is not an object', { status: 200, body: null }],
  ] as const)('reports bad-shape for %s', async (_name, reply) => {
    expect(await gradeAnswer(sendReturning(reply as Reply), input())).toEqual({ kind: 'problem', problem: 'bad-shape' });
  });
});

describe('readReply', () => {
  it.each([
    [401, 'bad-key'],
    [403, 'no-access'],
    [429, 'rate-limited'],
    [529, 'busy'],
    [503, 'busy'],
    [400, 'bad-request'],
    [404, 'bad-request'],
    [500, 'server'],
    [0, 'server'],
  ] as const)('maps HTTP %i to %s', (status, problem) => {
    expect(readReply({ status, body: { type: 'error' } })).toEqual({ ok: false, problem });
  });

  it('treats a refusal as a problem, not a grade', () => {
    expect(readReply(ok(grade, { stop_reason: 'refusal' }))).toEqual({ ok: false, problem: 'refused' });
  });

  it('treats a reply cut off at the token limit as a problem', () => {
    expect(readReply(ok(grade, { stop_reason: 'max_tokens' }))).toEqual({ ok: false, problem: 'cut-off' });
  });

  it('finds the text block even when it is not first', () => {
    const reply: Reply = { status: 200, body: { stop_reason: 'end_turn', content: [{ type: 'thinking' }, { type: 'text', text: '{}' }] } };
    expect(readReply(reply)).toEqual({ ok: true, text: '{}' });
  });
});

/**
 * The grading pipeline, start to finish:
 *
 *   answer -> too short? stop -> buildRequest() -> send() -> readReply() -> validateModelGrade()
 *          -> scoreAnswer() -> checkRewrite() -> result
 *
 * `send` is passed in. In the app it calls the Anthropic API with your key
 * (src/api/anthropic.ts). In the tests it is a fake that returns whatever the test wants,
 * which is how every failure path here is tested with no key and no network.
 */

import { buildRequest, storiesForPrompt, type GradeInput } from './prompt';
import { validateModelGrade } from './schema';
import { checkRewrite, MIN_WORDS_TO_GRADE, scoreAnswer, type Report } from './score';
import { countWords } from './speaking';

export interface Reply {
  status: number;
  body: unknown;
}

/** Sends one request body and returns the HTTP status and parsed JSON. Throws if the network fails. */
export type Send = (body: ReturnType<typeof buildRequest>) => Promise<Reply>;

export type Problem =
  | 'bad-key'
  | 'no-access'
  | 'rate-limited'
  | 'busy'
  | 'bad-request'
  | 'server'
  | 'network'
  | 'refused'
  | 'cut-off'
  | 'bad-shape';

export type Rewrite = { shown: true; text: string } | { shown: false; why: 'empty' } | { shown: false; why: 'invented'; numbers: string[] };

export type GradeResult =
  | { kind: 'too-short'; words: number }
  | { kind: 'problem'; problem: Problem }
  | { kind: 'graded'; report: Report; coaching: string; rewrite: Rewrite; storiesSent: number };

/** Turn an HTTP reply from /v1/messages into the model's text, or name what went wrong. */
export function readReply(reply: Reply): { ok: true; text: string } | { ok: false; problem: Problem } {
  const { status, body } = reply;
  if (status === 401) return { ok: false, problem: 'bad-key' };
  if (status === 403) return { ok: false, problem: 'no-access' };
  if (status === 429) return { ok: false, problem: 'rate-limited' };
  if (status === 529 || status === 503) return { ok: false, problem: 'busy' };
  if (status === 400 || status === 404 || status === 413) return { ok: false, problem: 'bad-request' };
  if (status !== 200) return { ok: false, problem: 'server' };

  if (typeof body !== 'object' || body === null) return { ok: false, problem: 'bad-shape' };
  const message = body as { stop_reason?: unknown; content?: unknown };
  if (message.stop_reason === 'refusal') return { ok: false, problem: 'refused' };
  if (message.stop_reason === 'max_tokens') return { ok: false, problem: 'cut-off' };
  if (!Array.isArray(message.content)) return { ok: false, problem: 'bad-shape' };

  const block = message.content.find(
    (b): b is { type: 'text'; text: string } =>
      typeof b === 'object' && b !== null && (b as { type?: unknown }).type === 'text' && typeof (b as { text?: unknown }).text === 'string',
  );
  if (!block) return { ok: false, problem: 'bad-shape' };
  return { ok: true, text: block.text };
}

export async function gradeAnswer(send: Send, input: GradeInput): Promise<GradeResult> {
  const words = countWords(input.answer);
  if (words < MIN_WORDS_TO_GRADE) return { kind: 'too-short', words };

  const body = buildRequest(input);
  let reply: Reply;
  try {
    reply = await send(body);
  } catch {
    return { kind: 'problem', problem: 'network' };
  }

  const read = readReply(reply);
  if (!read.ok) return { kind: 'problem', problem: read.problem };

  let parsed: unknown;
  try {
    parsed = JSON.parse(read.text);
  } catch {
    return { kind: 'problem', problem: 'bad-shape' };
  }
  const valid = validateModelGrade(parsed);
  if (!valid.ok) return { kind: 'problem', problem: 'bad-shape' };

  const report = scoreAnswer(input.answer, valid.grade);
  const bank = storiesForPrompt(input.stories);
  const checked = checkRewrite(valid.grade.rewrite, [input.answer, bank.text]);
  const rewrite: Rewrite = checked.ok
    ? { shown: true, text: checked.text }
    : checked.reason === 'empty'
      ? { shown: false, why: 'empty' }
      : { shown: false, why: 'invented', numbers: checked.numbers };

  return { kind: 'graded', report, coaching: valid.grade.coaching, rewrite, storiesSent: bank.sent };
}

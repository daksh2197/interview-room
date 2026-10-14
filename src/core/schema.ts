/**
 * The shape the model must answer in, and the check that it did.
 *
 * GRADE_SCHEMA goes to the API as a structured-output format, so the model's reply is
 * constrained to this shape. validateModelGrade() checks it again on arrival anyway:
 * the API can still return something else (a refusal, a reply cut off at the token limit),
 * and the screen should never have to guess.
 *
 * The API's structured outputs do not support minLength, maxLength, minimum or maximum,
 * so limits like "at most 6 excerpts" are enforced here instead of in the schema.
 */

export const STAR_PARTS = ['situation', 'task', 'action', 'result'] as const;
export type StarPart = (typeof STAR_PARTS)[number];

export interface ModelGrade {
  situation: string[];
  task: string[];
  action: string[];
  result: string[];
  named_outcome: boolean;
  coaching: string;
  rewrite: string;
}

const excerpts = (what: string) => ({
  type: 'array',
  items: { type: 'string' },
  description: `Sentences or phrases copied word for word from the answer that ${what}. Empty if there are none.`,
});

export const GRADE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['situation', 'task', 'action', 'result', 'named_outcome', 'coaching', 'rewrite'],
  properties: {
    situation: excerpts('set the scene: where, when, what was going on'),
    task: excerpts("say what the candidate had to do or what was at stake for them"),
    action: excerpts('describe what the candidate personally did'),
    result: excerpts('say how it ended: the outcome, a number, what changed'),
    named_outcome: {
      type: 'boolean',
      description:
        'True if the answer names a concrete outcome: a number, something shipped or fixed, a customer kept, a decision made. False for vague endings like "it went well".',
    },
    coaching: {
      type: 'string',
      description: 'One or two sentences: the single change that would most improve this answer.',
    },
    rewrite: {
      type: 'string',
      description:
        'The answer tightened into Situation, Task, Action, Result order, in the first person, using only facts the candidate wrote. Square brackets mark anything missing, e.g. [the number: how much faster?].',
    },
  },
} as const;

export const MAX_EXCERPTS = 6;
export const MAX_TEXT = 4000;

export type Validation = { ok: true; grade: ModelGrade } | { ok: false; error: string };

export function validateModelGrade(value: unknown): Validation {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, error: 'not an object' };
  }
  const v = value as Record<string, unknown>;
  const allowed = new Set<string>(GRADE_SCHEMA.required);
  for (const key of Object.keys(v)) {
    if (!allowed.has(key)) return { ok: false, error: `unexpected field "${key}"` };
  }
  for (const part of STAR_PARTS) {
    const list = v[part];
    if (!Array.isArray(list)) return { ok: false, error: `${part} is not a list` };
    if (list.length > MAX_EXCERPTS) return { ok: false, error: `${part} has more than ${MAX_EXCERPTS} excerpts` };
    if (!list.every((item) => typeof item === 'string' && item.length <= MAX_TEXT)) {
      return { ok: false, error: `${part} has an item that isn't short text` };
    }
  }
  if (typeof v.named_outcome !== 'boolean') return { ok: false, error: 'named_outcome is not true or false' };
  for (const key of ['coaching', 'rewrite'] as const) {
    const text = v[key];
    if (typeof text !== 'string' || text.length > MAX_TEXT) return { ok: false, error: `${key} is not short text` };
  }
  return {
    ok: true,
    grade: {
      situation: v.situation as string[],
      task: v.task as string[],
      action: v.action as string[],
      result: v.result as string[],
      named_outcome: v.named_outcome,
      coaching: (v.coaching as string).trim(),
      rewrite: (v.rewrite as string).trim(),
    },
  };
}

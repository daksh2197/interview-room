/**
 * The question bank and the rule for picking the next question.
 *
 * Every question here was written for this app. None is copied from a company's
 * interview guide, and none pretends to come from a real interviewer.
 */

export type RoleFamily = 'tam' | 'customer-success' | 'solutions-engineer' | 'trackside' | 'behavioural' | 'data-ai';

export interface Question {
  /** Stable id, e.g. "tam-3". Used to remember which questions you've had. */
  id: string;
  family: RoleFamily;
  text: string;
}

export const ROLE_FAMILIES: readonly { id: RoleFamily; label: string }[] = [
  { id: 'behavioural', label: 'General behavioural' },
  { id: 'tam', label: 'Technical account manager' },
  { id: 'customer-success', label: 'Customer success' },
  { id: 'solutions-engineer', label: 'Solutions engineer' },
  { id: 'trackside', label: 'Race or trackside engineer' },
  { id: 'data-ai', label: 'Data and AI adoption' },
];

const BANK: Record<RoleFamily, readonly string[]> = {
  behavioural: [
    'Tell me about a time you failed. What happened next?',
    "Describe the hardest feedback you've received and what you did with it.",
    'Tell me about a time you led something without having the authority to.',
    'Describe a disagreement with a teammate and how it ended.',
    'Tell me about a time you had to learn something quickly to get a job done.',
    'Tell me about the piece of work you are proudest of.',
    'Describe a time you changed your mind because of evidence.',
    'Tell me about a time you did more than you were asked to.',
  ],
  tam: [
    "Tell me about a time a customer's production system went down and you were their main contact.",
    'Describe a time you said no to a customer request. How did you keep the relationship?',
    "Tell me about a time you found a way to cut a customer's costs.",
    'Walk me through a time you explained a technical problem to a non-technical executive.',
    'Tell me about an account that was at risk of leaving. What did you do?',
    "Describe a time you got an internal engineering team to prioritise your customer's issue.",
    'Tell me about a time you planned a large migration or launch with a customer.',
    'Describe a time you made a mistake with a customer. What happened next?',
  ],
  'customer-success': [
    "Tell me about a customer who wasn't using what they paid for. What did you change?",
    'Describe a renewal you saved.',
    'Tell me about a time you grew an account.',
    'Describe a time you dealt with an angry customer.',
    'Tell me about a time you used data to spot a customer problem early.',
    'Tell me about a time you had more accounts than hours and had to choose where to spend your time.',
    'Describe how you onboarded a difficult customer.',
    'Tell me about customer feedback that changed the product.',
  ],
  'solutions-engineer': [
    'Tell me about a demo that went wrong. What did you do in the room?',
    'Describe a proof of concept you ran. How did you define success?',
    'Tell me about a technical evaluation you lost. What did you learn?',
    'Describe a time you had to learn a new technology fast to win a deal.',
    "Tell me about a time you pushed back on a promise someone in sales wanted to make.",
    "Walk me through a solution you designed for a requirement you'd never seen before.",
    "Tell me about a time you turned a customer's objection into something you could deliver.",
    "Describe a time you worked with a customer's security team to get approval.",
  ],
  trackside: [
    'Tell me about a time you found a problem in data that nobody else had noticed.',
    'Describe a time you had to make a decision quickly with incomplete information.',
    'Tell me about a time hardware or software failed at the worst possible moment.',
    'Describe a time you explained technical data to someone who had to act on it immediately.',
    'Tell me about a tool you built that other people relied on.',
    'Tell me about a time you worked to a deadline that could not move.',
    'Describe a time you disagreed with a senior colleague about a technical call.',
    'Tell me about a time you improved a process by measuring it first.',
  ],
  'data-ai': [
    'Tell me about a time you got a sceptical team to trust a dashboard they had been ignoring.',
    'Describe a time a metric disagreed with what a senior leader felt was true. How did you handle it?',
    'Tell me about a time you introduced an AI tool to people who did not want it.',
    'Tell me about a time you tried to show whether a new tool really saved people time. What did you measure, and what did you find?',
    'Describe a time you discovered a data quality problem after people had already acted on the numbers.',
    'Tell me about a time you had to explain what a model cannot do to someone who wanted it to do more.',
    'Tell me about a time you handled a privacy or consent question about putting customer data into a tool.',
    'Tell me about a time you decided a task should stay manual, or that a tool should not be used. How did you make the case?',
  ],
};

export const QUESTIONS: readonly Question[] = (Object.keys(BANK) as RoleFamily[]).flatMap((family) =>
  BANK[family].map((text, i) => ({ id: `${family}-${i + 1}`, family, text })),
);

export function isRoleFamily(value: unknown): value is RoleFamily {
  return typeof value === 'string' && ROLE_FAMILIES.some((f) => f.id === value);
}

export function questionsFor(family: RoleFamily): Question[] {
  return QUESTIONS.filter((q) => q.family === family);
}

/**
 * A random question from `family` that is not in `asked`.
 * Returns null once every question in the family has been asked.
 *
 * `random` is passed in (Math.random in the app) so tests can make it repeatable.
 */
export function nextQuestion(
  family: RoleFamily,
  asked: readonly string[],
  random: () => number = Math.random,
): Question | null {
  const left = questionsFor(family).filter((q) => !asked.includes(q.id));
  if (left.length === 0) return null;
  const r = random();
  const i = Number.isFinite(r) ? Math.min(left.length - 1, Math.max(0, Math.floor(r * left.length))) : 0;
  return left[i] ?? null;
}

/**
 * Runs the eval set against the live API with your own key and prints a pass/fail table.
 *
 *   ANTHROPIC_API_KEY=sk-ant-... npm run evals
 *   ANTHROPIC_API_KEY=sk-ant-... npm run evals -- --model claude-haiku-5-5
 *
 * Not part of CI: it costs money and needs a key. CI runs cases.test.ts instead,
 * which checks the cases themselves and the scoring with no network.
 * The key is read from the environment and never printed.
 */

import { readFileSync } from 'node:fs';
import { makeSend } from '../src/api/anthropic';
import { gradeAnswer } from '../src/core/grade';
import { DEFAULT_MODEL, isModelId, PROMPT_VERSION } from '../src/core/prompt';
import { readCases, score, table, type Row } from './evals';

const key = process.env.ANTHROPIC_API_KEY?.trim();
if (!key) {
  console.error('Set ANTHROPIC_API_KEY to run the evals. They call the live API and are billed to that key.');
  process.exit(2);
}

const flag = process.argv.indexOf('--model');
const model = flag > -1 ? process.argv[flag + 1] : DEFAULT_MODEL;
if (!isModelId(model)) {
  console.error(`Unknown model "${model}".`);
  process.exit(2);
}

const cases = readCases(JSON.parse(readFileSync(new URL('./cases.json', import.meta.url), 'utf8')));
const send = makeSend(key);
const rows: Row[] = [];

console.log(`Prompt v${PROMPT_VERSION}, ${model}, ${cases.length} cases\n`);
for (const c of cases) {
  // One at a time: slower, but kind to rate limits and easy to read.
  const result = await gradeAnswer(send, { model, question: c.question, answer: c.answer, stories: [] });
  const row = score(c, result);
  rows.push(row);
  process.stdout.write(row.pass ? '.' : 'F');
}

console.log(`\n\n${table(rows)}\n`);
for (const row of rows.filter((r) => !r.pass)) console.log(`${row.id}: ${row.detail}`);
const passed = rows.filter((r) => r.pass).length;
console.log(`\n${passed} of ${rows.length} passed`);
process.exit(passed === rows.length ? 0 : 1);

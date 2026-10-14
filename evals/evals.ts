/**
 * The eval set, read and scored. Shared by the live runner (run.ts) and the CI test (cases.test.ts).
 */

import type { GradeResult } from '../src/core/grade';
import type { Band } from '../src/core/score';

export interface EvalCase {
  id: string;
  why: string;
  family: string;
  question: string;
  answer: string;
  checks: { structure: boolean; evidence: boolean; length: boolean };
  /** Optional: what named_outcome must be (used to catch the model obeying an injected instruction). */
  named_outcome?: boolean;
}

export interface Row {
  id: string;
  expected: Band;
  got: Band | 'error';
  checks: string;
  rewrite: string;
  pass: boolean;
  detail: string;
}

export function bandFor(checks: EvalCase['checks']): Band {
  const passed = [checks.structure, checks.evidence, checks.length].filter(Boolean).length;
  return passed === 3 ? 'ready' : passed === 2 ? 'close' : 'rework';
}

export function readCases(data: unknown): EvalCase[] {
  const cases = (data as { cases?: unknown }).cases;
  if (!Array.isArray(cases)) throw new Error('evals/cases.json has no "cases" list');
  for (const c of cases) {
    const ok =
      typeof c?.id === 'string' &&
      typeof c.question === 'string' &&
      typeof c.answer === 'string' &&
      ['structure', 'evidence', 'length'].every((k) => typeof c.checks?.[k] === 'boolean');
    if (!ok) throw new Error(`evals/cases.json: case ${JSON.stringify(c?.id)} is missing a field`);
  }
  return cases as EvalCase[];
}

const mark = (b: boolean) => (b ? 'y' : 'n');

/** Compare one live result with what the case expects. */
export function score(c: EvalCase, result: GradeResult): Row {
  const expected = bandFor(c.checks);
  if (result.kind !== 'graded') {
    return {
      id: c.id,
      expected,
      got: 'error',
      checks: '-',
      rewrite: '-',
      pass: false,
      detail: result.kind === 'problem' ? result.problem : `too short (${result.words} words)`,
    };
  }
  const r = result.report;
  const got = { structure: r.structure.ok, evidence: r.evidence.ok, length: r.length.ok };
  const wrong = (['structure', 'evidence', 'length'] as const).filter((k) => got[k] !== c.checks[k]);
  const outcomeWrong = c.named_outcome !== undefined && r.evidence.namedOutcome !== c.named_outcome;
  const detail = [
    ...wrong.map((k) => `${k} expected ${mark(c.checks[k])} got ${mark(got[k])}`),
    ...(outcomeWrong ? [`named_outcome expected ${c.named_outcome} got ${r.evidence.namedOutcome}`] : []),
    ...(r.structure.ok ? [] : [`structure: ${r.structure.issues.join(', ')}`]),
  ].join('; ');
  return {
    id: c.id,
    expected,
    got: r.band,
    checks: `S${mark(got.structure)} E${mark(got.evidence)} L${mark(got.length)}`,
    rewrite: result.rewrite.shown ? 'kept' : result.rewrite.why === 'invented' ? `thrown away (${result.rewrite.numbers.join(', ')})` : 'empty',
    pass: wrong.length === 0 && !outcomeWrong,
    detail,
  };
}

export function table(rows: readonly Row[]): string {
  const head = ['case', 'expected', 'got', 'checks', 'rewrite', 'pass'];
  const body = rows.map((r) => [r.id, r.expected, r.got, r.checks, r.rewrite, r.pass ? 'PASS' : 'FAIL']);
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((row) => (row[i] ?? '').length)));
  const line = (cells: string[]) => cells.map((cell, i) => cell.padEnd(widths[i] ?? 0)).join('  ');
  return [line(head), line(widths.map((w) => '-'.repeat(w))), ...body.map(line)].join('\n');
}

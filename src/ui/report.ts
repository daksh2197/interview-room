/**
 * Draws a grade on the page. Every piece of text goes in through textContent,
 * never innerHTML, because the answer and the model's reply are both text we didn't write.
 */

import type { GradeResult } from '../core/grade';
import { STAR_PARTS } from '../core/schema';
import {
  BAND_LINE,
  BAND_TITLE,
  EMPTY_REWRITE_TEXT,
  evidenceLine,
  inventedText,
  lengthLine,
  PART_NAME,
  pct,
  PROBLEM_TEXT,
  structureLine,
  tooShortText,
} from '../core/words';

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function check(name: string, ok: boolean, line: string): HTMLLIElement {
  const item = make('li', 'check');
  item.dataset.ok = String(ok);
  const head = make('p', 'check-head');
  head.append(make('span', 'check-name', name), make('span', 'pill', ok ? 'Pass' : 'Fix'));
  item.append(head, make('p', 'check-line', line));
  return item;
}

/** Replace the contents of `container` with `result`. */
export function renderResult(container: HTMLElement, result: GradeResult): void {
  container.replaceChildren();
  container.dataset.state = result.kind;

  if (result.kind === 'too-short') {
    container.append(make('p', 'problem', tooShortText(result.words)));
    return;
  }
  if (result.kind === 'problem') {
    container.append(make('p', 'problem', PROBLEM_TEXT[result.problem]));
    return;
  }

  const { report } = result;
  container.dataset.band = report.band;

  const band = make('div', 'band');
  band.append(make('p', 'band-word', BAND_TITLE[report.band]), make('p', 'band-line', BAND_LINE[report.band]));

  // The answer as four blocks, each as wide as its share of the words.
  const bar = make('div', 'star');
  bar.setAttribute('role', 'img');
  bar.setAttribute(
    'aria-label',
    STAR_PARTS.map((p) => `${PART_NAME[p]} ${report.parts[p].present ? pct(report.parts[p].share) : 'missing'}`).join(', '),
  );
  for (const part of STAR_PARTS) {
    const r = report.parts[part];
    const seg = make('div', 'star-seg');
    seg.dataset.part = part;
    seg.dataset.present = String(r.present);
    seg.style.setProperty('--share', String(r.present ? Math.max(r.share, 0.06) : 0.06));
    seg.append(make('span', 'star-letter', PART_NAME[part].charAt(0)), make('span', 'star-pct', r.present ? pct(r.share) : 'missing'));
    bar.append(seg);
  }

  const checks = make('ul', 'checks');
  checks.append(
    check('Structure', report.structure.ok, structureLine(report)),
    check('Evidence', report.evidence.ok, evidenceLine(report)),
    check('Length', report.length.ok, lengthLine(report)),
  );

  container.append(band, bar, checks);

  if (result.coaching) {
    const coach = make('div', 'coach');
    coach.append(make('h3', undefined, 'The one fix'), make('p', undefined, result.coaching));
    container.append(coach);
  }

  const rewrite = make('div', 'rewrite');
  rewrite.append(make('h3', undefined, 'Tighter version'));
  if (result.rewrite.shown) {
    rewrite.append(make('p', 'rewrite-text', result.rewrite.text));
    rewrite.append(make('p', 'note', 'Uses only what you wrote. Anything in [brackets] is yours to fill in.'));
  } else if (result.rewrite.why === 'invented') {
    rewrite.dataset.rejected = 'true';
    rewrite.append(make('p', 'problem', inventedText(result.rewrite.numbers)));
  } else {
    rewrite.append(make('p', 'note', EMPTY_REWRITE_TEXT));
  }
  container.append(rewrite);

  const dropped = STAR_PARTS.reduce((n, p) => n + report.parts[p].dropped.length, 0);
  if (dropped > 0) {
    container.append(
      make(
        'p',
        'note',
        `The model quoted ${dropped} ${dropped === 1 ? 'line' : 'lines'} that ${dropped === 1 ? "isn't" : "aren't"} in your answer. ${dropped === 1 ? 'It was' : 'They were'} ignored.`,
      ),
    );
  }
}

export function renderLoading(container: HTMLElement): void {
  container.replaceChildren(make('p', 'loading', 'Grading your answer.'));
  container.dataset.state = 'loading';
  delete container.dataset.band;
}

export function clearResult(container: HTMLElement): void {
  container.replaceChildren();
  delete container.dataset.state;
  delete container.dataset.band;
}

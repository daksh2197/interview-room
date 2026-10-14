import { describe, expect, it } from 'vitest';
import type { ModelGrade } from './schema';
import { ACTION_MIN, checkRewrite, normalise, scoreAnswer, SETUP_MAX } from './score';

const words = (n: number, word = 'word') => Array(n).fill(word).join(' ');

/** Build an answer from four parts and a grade that copies them exactly. */
function build(parts: { s: string; t: string; a: string; r: string }, named = false) {
  const answer = [parts.s, parts.t, parts.a, parts.r].filter(Boolean).join(' ');
  const grade: ModelGrade = {
    situation: parts.s ? [parts.s] : [],
    task: parts.t ? [parts.t] : [],
    action: parts.a ? [parts.a] : [],
    result: parts.r ? [parts.r] : [],
    named_outcome: named,
    coaching: '',
    rewrite: '',
  };
  return { answer, grade };
}

describe('the rules', () => {
  it('are 40% for setup and 30% for action', () => {
    expect(SETUP_MAX).toBe(0.4);
    expect(ACTION_MIN).toBe(0.3);
  });
});

describe('scoreAnswer', () => {
  it('grades a balanced, 90-second answer with a number as Ready', () => {
    const { answer, grade } = build({
      s: `situation ${words(29)}.`,
      t: `task ${words(14)}.`,
      a: `action ${words(119)}.`,
      r: `It ended with 12 renewals ${words(55)}.`,
    });
    const report = scoreAnswer(answer, grade);
    expect(report.words).toBe(225);
    expect(report.seconds).toBe(90);
    expect(report.structure.ok).toBe(true);
    expect(report.evidence).toEqual({ ok: true, numbers: ['12'], namedOutcome: false });
    expect(report.length).toEqual({ ok: true, verdict: 'on-target' });
    expect(report.band).toBe('ready');
  });

  it('measures each part as a share of the words', () => {
    const { answer, grade } = build({ s: words(20, 's'), t: words(20, 't'), a: words(40, 'a'), r: words(20, 'r') });
    const report = scoreAnswer(answer, grade);
    expect(report.parts.situation.share).toBeCloseTo(0.2);
    expect(report.parts.action.share).toBeCloseTo(0.4);
    expect(report.structure.setupShare).toBeCloseTo(0.4);
    expect(report.structure.issues).toEqual([]);
  });

  it('flags setup over 40%', () => {
    const { answer, grade } = build({ s: words(30, 's'), t: words(20, 't'), a: words(35, 'a'), r: words(15, 'r') });
    expect(scoreAnswer(answer, grade).structure.issues).toEqual(['long-setup']);
  });

  it('flags action under 30%', () => {
    const { answer, grade } = build({ s: words(20, 's'), t: words(10, 't'), a: words(25, 'a'), r: words(45, 'r') });
    expect(scoreAnswer(answer, grade).structure.issues).toEqual(['thin-action']);
  });

  it('flags a missing result and names it', () => {
    const { answer, grade } = build({ s: words(20, 's'), t: words(10, 't'), a: words(70, 'a'), r: '' });
    const report = scoreAnswer(answer, grade);
    expect(report.structure.missing).toEqual(['result']);
    expect(report.structure.issues).toContain('missing-part');
  });

  it('drops excerpts the model made up, and keeps them visible', () => {
    const answer = 'We were losing a customer. I called them every week. They stayed for 2 more years.';
    const grade: ModelGrade = {
      situation: ['We were losing a customer.'],
      task: ['I had to save the account worth millions.'],
      action: ['I called them every week.'],
      result: ['They stayed for 2 more years.'],
      named_outcome: true,
      coaching: '',
      rewrite: '',
    };
    const report = scoreAnswer(answer, grade);
    expect(report.parts.task.present).toBe(false);
    expect(report.parts.task.dropped).toEqual(['I had to save the account worth millions.']);
    expect(report.structure.missing).toEqual(['task']);
  });

  it('matches excerpts despite curly quotes, case and spacing', () => {
    const answer = 'I said “we’re fixing it”   today, and we did.';
    const grade: ModelGrade = {
      situation: [],
      task: [],
      action: ['i said "we\'re fixing it" today'],
      result: [],
      named_outcome: false,
      coaching: '',
      rewrite: '',
    };
    expect(scoreAnswer(answer, grade).parts.action.present).toBe(true);
  });

  it('ignores one-word excerpts and counts a repeated excerpt once', () => {
    const answer = 'So I rebuilt the whole pipeline over a weekend.';
    const grade: ModelGrade = {
      situation: [],
      task: [],
      action: ['So', 'I rebuilt the whole pipeline', 'I rebuilt the whole pipeline'],
      result: [],
      named_outcome: false,
      coaching: '',
      rewrite: '',
    };
    const part = scoreAnswer(answer, grade).parts.action;
    expect(part.excerpts).toEqual(['I rebuilt the whole pipeline']);
    expect(part.ignored).toEqual(['So']);
    expect(part.dropped).toEqual([]);
    expect(part.share).toBeCloseTo(5 / 9);
  });

  it('counts a sentence once even if the model files it under every part', () => {
    const answer = 'I fixed the export bug for the customer. ' + words(20);
    const sentence = 'I fixed the export bug for the customer.';
    const report = scoreAnswer(answer, {
      situation: [sentence], task: [sentence], action: [sentence], result: [sentence],
      named_outcome: false, coaching: '', rewrite: '',
    });
    expect(report.parts.situation.present).toBe(true);
    expect(report.structure.missing).toEqual(['task', 'action', 'result']);
    const total = Object.values(report.parts).reduce((sum, p) => sum + p.share, 0);
    expect(total).toBeLessThanOrEqual(1);
  });

  it('counts overlapping excerpts in one part once', () => {
    const answer = 'Then I fixed the export bug quickly.';
    const report = scoreAnswer(answer, {
      situation: [], task: [], result: [],
      action: ['I fixed the export bug', 'fixed the export bug', 'the export bug'],
      named_outcome: false, coaching: '', rewrite: '',
    });
    expect(report.parts.action.share).toBeCloseTo(5 / 7);
  });

  it('only matches whole words, never the middle of a word', () => {
    const answer = 'I fixed the export bug and then tested it.';
    const report = scoreAnswer(answer, {
      situation: [], task: [], result: [],
      action: ['ed the export', 'xport bug and t'],
      named_outcome: false, coaching: '', rewrite: '',
    });
    expect(report.parts.action.present).toBe(false);
    expect(report.parts.action.dropped).toEqual(['ed the export', 'xport bug and t']);
  });

  it('takes evidence only from the result, so a number in the setup does not count', () => {
    const answer = 'Two years ago our reports were slow. I rewrote them. In the end it went well.';
    const report = scoreAnswer(answer, {
      situation: ['Two years ago our reports were slow.'], task: [], action: ['I rewrote them.'],
      result: ['In the end it went well.'], named_outcome: false, coaching: '', rewrite: '',
    });
    expect(report.evidence).toEqual({ ok: false, numbers: [], namedOutcome: false });
  });

  it('finds no evidence in a result whose words all belong to the setup', () => {
    const answer = 'Two years ago we had 300 open tickets. ' + words(30);
    const sentence = 'Two years ago we had 300 open tickets.';
    const report = scoreAnswer(answer, {
      situation: [sentence], task: [], action: [], result: [sentence],
      named_outcome: false, coaching: '', rewrite: '',
    });
    expect(report.parts.result).toMatchObject({ present: false, excerpts: [] });
    expect(report.evidence).toEqual({ ok: false, numbers: [], namedOutcome: false });
  });

  it('accepts a named outcome without a number as evidence', () => {
    const { answer, grade } = build({ s: words(10), t: words(10), a: words(30), r: 'They shipped it.' }, true);
    expect(scoreAnswer(answer, grade).evidence.ok).toBe(true);
  });

  it('bands two passing checks as Close and one as Rework', () => {
    const balanced = { s: words(20, 's'), t: words(10, 't'), a: words(60, 'a'), r: words(10, 'r') };
    const short = build(balanced); // structure ok, no evidence, 100 words is 40 s: one check
    expect(scoreAnswer(short.answer, short.grade).band).toBe('rework');
    const shortWithEvidence = build(balanced, true); // two checks
    expect(scoreAnswer(shortWithEvidence.answer, shortWithEvidence.grade).band).toBe('close');
  });

  it('never produces NaN or a share outside 0 to 1, whatever the model sends (property test)', () => {
    let seed = 3;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const vocab = ['I', 'we', 'fixed', 'the', '40%', 'bug', '.', '', '  ', 'customer', '“quoted”'];
    const text = (n: number) => Array.from({ length: n }, () => vocab[Math.floor(random() * vocab.length)]).join(' ');
    for (let i = 0; i < 500; i++) {
      const answer = text(Math.floor(random() * 80));
      const slice = () => answer.split('.').filter(() => random() > 0.5);
      const grade: ModelGrade = {
        situation: slice(),
        task: [text(3)],
        action: [answer, answer],
        result: slice(),
        named_outcome: random() > 0.5,
        coaching: '',
        rewrite: '',
      };
      const report = scoreAnswer(answer, grade);
      for (const part of Object.values(report.parts)) {
        expect(part.share).toBeGreaterThanOrEqual(0);
        expect(part.share).toBeLessThanOrEqual(1);
      }
      expect(Number.isFinite(report.structure.setupShare)).toBe(true);
      expect(['ready', 'close', 'rework']).toContain(report.band);
    }
  });
});

describe('checkRewrite', () => {
  it('shows a rewrite that only uses the candidate numbers', () => {
    expect(checkRewrite('  Cut it from 20 to 4.  ', ['20 minutes down to 4'])).toEqual({ ok: true, text: 'Cut it from 20 to 4.' });
  });

  it('throws away a rewrite with an invented number and says which', () => {
    expect(checkRewrite('Saved 30% in 2 weeks.', ['saved a lot in 2 weeks'])).toEqual({
      ok: false,
      reason: 'invented',
      numbers: ['30'],
    });
  });

  it('throws away an empty rewrite', () => {
    expect(checkRewrite('   ', ['x'])).toEqual({ ok: false, reason: 'empty' });
  });
});

describe('normalise', () => {
  it('lower-cases, straightens quotes and dashes, and trims punctuation', () => {
    expect(normalise('  “Hello” — World!  ')).toBe('hello" - world');
  });
});

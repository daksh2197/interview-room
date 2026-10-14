import { describe, expect, it } from 'vitest';
import { exportStories, FILE_FORMAT, importStories, LIMITS, mergeStories, storiesAsText, type Story } from './stories';

const story = (over: Partial<Story> = {}): Story => ({
  id: 's1',
  title: 'Sample: saved a renewal',
  situation: 'A sample customer was about to leave.',
  task: 'Find out why.',
  action: 'I read 14 tickets and fixed the export.',
  result: 'They renewed.',
  number: '2 years',
  ...over,
});

describe('export and import', () => {
  it('round-trips a story bank exactly', () => {
    const bank = [story(), story({ id: 's2', title: 'Second', number: '' })];
    const back = importStories(exportStories(bank));
    expect(back).toEqual({ ok: true, stories: bank });
  });

  it('round-trips 200 random story banks (property test)', () => {
    let seed = 99;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const chars = 'abc XYZ 019 "quotes" \\ / é ₹ \u{1F697} <b>&amp;</b>\n';
    const text = (max: number) =>
      Array.from({ length: Math.floor(random() * max) }, () => chars[Math.floor(random() * chars.length)]).join('').trim();
    for (let i = 0; i < 200; i++) {
      const bank: Story[] = Array.from({ length: 1 + Math.floor(random() * 5) }, (_, j) => ({
        id: `s${j}`,
        title: text(40) || 'x',
        situation: text(200),
        task: text(100),
        action: text(300),
        result: text(100),
        number: text(20),
      }));
      expect(importStories(exportStories(bank))).toEqual({ ok: true, stories: bank });
    }
  });

  it('writes only story fields, so nothing else can leak into an export', () => {
    const sneaky = { ...story(), apiKey: 'sk-ant-should-never-appear' } as Story;
    const file = exportStories([sneaky]);
    expect(file).not.toContain('sk-ant');
    expect(Object.keys(JSON.parse(file).stories[0]).sort()).toEqual(
      ['action', 'id', 'number', 'result', 'situation', 'task', 'title'].sort(),
    );
  });

  it('rejects text that is not JSON', () => {
    expect(importStories('not json').ok).toBe(false);
  });

  it('rejects JSON that is not a story bank export', () => {
    for (const text of ['null', '[]', '42', '{}', '{"format":"something-else","version":1,"stories":[]}']) {
      expect(importStories(text).ok, text).toBe(false);
    }
  });

  it('rejects a file from a different version', () => {
    expect(importStories(JSON.stringify({ format: FILE_FORMAT, version: 2, stories: [] }))).toEqual({
      ok: false,
      error: 'That file comes from a different version of Interview Room.',
    });
  });

  it('rejects a story with a field that is not text', () => {
    const bad = JSON.stringify({ format: FILE_FORMAT, version: 1, stories: [{ ...story(), task: 7 }] });
    expect(importStories(bad).ok).toBe(false);
  });

  it('rejects more stories than the limit', () => {
    const many = JSON.stringify({ format: FILE_FORMAT, version: 1, stories: Array(LIMITS.stories + 1).fill(story()) });
    expect(importStories(many).ok).toBe(false);
  });

  it('fills in missing fields, replaces bad ids, trims, cuts long text and skips blank stories', () => {
    const file = JSON.stringify({
      format: FILE_FORMAT,
      version: 1,
      stories: [{ id: '../../etc', title: '  Padded  ', action: 'x'.repeat(LIMITS.text + 50) }, { id: 'blank' }],
    });
    const result = importStories(file);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.stories).toHaveLength(1);
    expect(result.stories[0]).toMatchObject({ id: 'imported-1', title: 'Padded', situation: '', number: '' });
    expect(result.stories[0]?.action).toHaveLength(LIMITS.text);
  });
});

describe('mergeStories', () => {
  it('skips exact duplicates, so importing the same file twice changes nothing', () => {
    const bank = [story()];
    expect(mergeStories(bank, [story()])).toEqual(bank);
  });

  it('gives a clashing id a new one', () => {
    const merged = mergeStories([story()], [story({ title: 'Different' })]);
    expect(merged.map((s) => s.id)).toEqual(['s1', 's1-2']);
  });

  it('never goes past the limit', () => {
    const existing = Array.from({ length: LIMITS.stories - 1 }, (_, i) => story({ id: `e${i}`, title: `e${i}` }));
    const merged = mergeStories(existing, [story({ id: 'a', title: 'a' }), story({ id: 'b', title: 'b' })]);
    expect(merged).toHaveLength(LIMITS.stories);
  });
});

describe('storiesAsText', () => {
  it('labels every field so the model can tell them apart', () => {
    expect(storiesAsText([story()])).toContain('Number: 2 years');
    expect(storiesAsText([])).toBe('');
  });
});

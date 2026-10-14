/**
 * The story bank: the candidate's own stories, in STAR shape, plus the number that proves each one.
 *
 * Stories live in the browser and move between devices as a JSON file.
 * This file turns stories into that file and back, and refuses anything that isn't one.
 */

export interface Story {
  id: string;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  /** The number that proves it, as the candidate would say it: "40% fewer tickets". */
  number: string;
}

export const STORY_TEXT_FIELDS = ['title', 'situation', 'task', 'action', 'result', 'number'] as const;
type TextField = (typeof STORY_TEXT_FIELDS)[number];

export const LIMITS = {
  stories: 200,
  title: 120,
  number: 200,
  text: 4000,
} as const;

export const FILE_FORMAT = 'interview-room/stories';
export const FILE_VERSION = 1;

export type ImportResult = { ok: true; stories: Story[] } | { ok: false; error: string };

function limitFor(field: TextField): number {
  if (field === 'title') return LIMITS.title;
  if (field === 'number') return LIMITS.number;
  return LIMITS.text;
}

/** Trim every field and cut it to its limit. */
export function cleanStory(story: Story): Story {
  const clean = { id: story.id } as Story;
  for (const field of STORY_TEXT_FIELDS) clean[field] = story[field].trim().slice(0, limitFor(field));
  return clean;
}

export function isBlank(story: Story): boolean {
  return STORY_TEXT_FIELDS.every((field) => story[field].trim() === '');
}

/**
 * The export file. Only story fields go in: nothing else the app knows about
 * (your key, your settings) can end up in a file you send to someone.
 */
export function exportStories(stories: readonly Story[]): string {
  const body = {
    format: FILE_FORMAT,
    version: FILE_VERSION,
    stories: stories.map((s) => {
      const out: Record<string, string> = { id: s.id };
      for (const field of STORY_TEXT_FIELDS) out[field] = s[field];
      return out;
    }),
  };
  return `${JSON.stringify(body, null, 2)}\n`;
}

const ID = /^[A-Za-z0-9_-]{1,40}$/;

export function importStories(text: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn't JSON. Pick a file exported from Interview Room." };
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { ok: false, error: "That file isn't a story bank export." };
  }
  const file = data as Record<string, unknown>;
  if (file.format !== FILE_FORMAT) {
    return { ok: false, error: "That file isn't a story bank export." };
  }
  if (file.version !== FILE_VERSION) {
    return { ok: false, error: 'That file comes from a different version of Interview Room.' };
  }
  if (!Array.isArray(file.stories)) {
    return { ok: false, error: 'That file has no stories list.' };
  }
  if (file.stories.length > LIMITS.stories) {
    return { ok: false, error: `That file has more than ${LIMITS.stories} stories.` };
  }

  const stories: Story[] = [];
  for (const [i, item] of file.stories.entries()) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      return { ok: false, error: `Story ${i + 1} is not a story.` };
    }
    const raw = item as Record<string, unknown>;
    const story = { id: typeof raw.id === 'string' && ID.test(raw.id) ? raw.id : `imported-${i + 1}` } as Story;
    for (const field of STORY_TEXT_FIELDS) {
      const value = raw[field] ?? '';
      if (typeof value !== 'string') return { ok: false, error: `Story ${i + 1} has a ${field} that isn't text.` };
      story[field] = value;
    }
    const clean = cleanStory(story);
    if (!isBlank(clean)) stories.push(clean);
  }
  return { ok: true, stories };
}

function sameContent(a: Story, b: Story): boolean {
  return STORY_TEXT_FIELDS.every((field) => a[field] === b[field]);
}

/**
 * Add `incoming` to `existing`. Exact duplicates are skipped, so importing the same
 * file twice changes nothing. A clashing id gets a new one. Never more than the limit.
 */
export function mergeStories(existing: readonly Story[], incoming: readonly Story[]): Story[] {
  const merged = [...existing];
  const ids = new Set(merged.map((s) => s.id));
  for (const story of incoming) {
    if (merged.length >= LIMITS.stories) break;
    if (merged.some((s) => sameContent(s, story))) continue;
    let id = story.id;
    for (let n = 2; ids.has(id); n++) id = `${story.id.slice(0, 34)}-${n}`;
    ids.add(id);
    merged.push({ ...story, id });
  }
  return merged;
}

/** The story bank as plain text, for the prompt and for the number check. */
export function storiesAsText(stories: readonly Story[]): string {
  return stories
    .map((s) =>
      [
        `Title: ${s.title}`,
        `Situation: ${s.situation}`,
        `Task: ${s.task}`,
        `Action: ${s.action}`,
        `Result: ${s.result}`,
        `Number: ${s.number}`,
      ].join('\n'),
    )
    .join('\n\n');
}

/**
 * The wiring. This file reads the page, hands answers to the grading pipeline
 * (core/grade.ts), and paints what comes back. It makes no grading decisions of its own.
 *
 *   question -> your answer -> gradeAnswer(send) -> renderResult() -> screen
 *
 * The only network call is inside `send`, built from your key in api/anthropic.ts.
 */

import './styles/fonts.css';
import './styles/brand.css';
import './styles/app.css';

import { makeSend } from './api/anthropic';
import { DEMO_CANDIDATE, DEMO_ROUNDS, scriptedSend } from './core/demo';
import { gradeAnswer } from './core/grade';
import { DEFAULT_MODEL, isModelId, MODELS, type ModelId } from './core/prompt';
import { isRoleFamily, nextQuestion, questionsFor, ROLE_FAMILIES, type Question, type RoleFamily } from './core/questions';
import { ACTION_MIN, SETUP_MAX } from './core/score';
import { clock, countWords, lengthVerdict, speakingSeconds, TARGET, WORDS_PER_MINUTE } from './core/speaking';
import { exportStories, importStories, isBlank, mergeStories, type Story } from './core/stories';
import { announce, BAND_TITLE, pct, PROBLEM_TEXT, tooShortText } from './core/words';
import { clearResult, renderLoading, renderResult } from './ui/report';
import { attachSpeech } from './ui/speech';

const KEYS = {
  apiKey: 'interview-room:key',
  model: 'interview-room:model',
  family: 'interview-room:family',
  stories: 'interview-room:stories:v1',
} as const;

/** Import files bigger than this are refused before they are read. */
const MAX_IMPORT_BYTES = 2_000_000;
const MAX_ANSWER = 6000;

// ---------- small helpers ----------

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`index.html is missing an element with id="${id}"`);
  return found as T;
}

/** Change text only when it is different, so screen readers don't repeat themselves. */
function setText(target: HTMLElement, text: string): void {
  if (target.textContent !== text) target.textContent = text;
}

// Storage can be switched off (private windows, some embeds). The app must still work.
function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function save(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
function drop(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* nothing to forget */
  }
}

const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, reducedMotion() ? 0 : ms));

// ---------- state ----------

let family: RoleFamily = 'behavioural';
let asked: string[] = [];
let current: Question | null = null;
let stories: Story[] = [];
let lastDeleted: { story: Story; index: number } | null = null;
let grading = false;

function apiKey(): string {
  return (load(KEYS.apiKey) ?? '').trim();
}
function model(): ModelId {
  const saved = load(KEYS.model);
  return isModelId(saved) ? saved : DEFAULT_MODEL;
}

// ---------- practice ----------

function showQuestion(): void {
  const total = questionsFor(family).length;
  const q = el('question');
  const count = el('q-count');
  const next = el<HTMLButtonElement>('next');
  if (current) {
    setText(count, `Question ${asked.length} of ${total}`);
    setText(q, current.text);
    setText(next, 'Next question');
  } else {
    setText(count, `All ${total} done`);
    setText(q, `That's every question in this set. Start again, or pick another role.`);
    setText(next, 'Start the set again');
  }
  el<HTMLButtonElement>('grade').disabled = current === null;
}

function askNext(): void {
  if (current === null && asked.length > 0) asked = [];
  current = nextQuestion(family, asked);
  if (current) asked.push(current.id);
  el<HTMLTextAreaElement>('answer').value = '';
  clearResult(el('result'));
  setText(el('status'), '');
  updatePace();
  showQuestion();
}

function updatePace(): void {
  const text = el<HTMLTextAreaElement>('answer').value;
  const words = countWords(text);
  const seconds = speakingSeconds(text);
  const verdict = lengthVerdict(seconds);
  // The bar runs from 0 to 2:30. The lit window is the 1:00 to 2:00 target.
  const fill = Math.min(1, seconds / 150);
  const pace = el('pace');
  pace.style.setProperty('--fill', String(fill));
  pace.dataset.verdict = verdict;
  const where =
    verdict === 'on-target' ? 'in the window' : verdict === 'long' ? 'over' : verdict === 'short' ? 'under' : '';
  setText(
    el('pace-read'),
    `${words} ${words === 1 ? 'word' : 'words'}, about ${clock(seconds)} to say${where ? `, ${where}` : ''}. Aim for ${clock(TARGET.low)} to ${clock(TARGET.high)}.`,
  );
}

function updateKeyHint(): void {
  el('key-hint').hidden = apiKey() !== '';
}

async function grade(): Promise<void> {
  if (grading || !current) return;
  const answer = el<HTMLTextAreaElement>('answer').value.slice(0, MAX_ANSWER);
  const result = el('result');
  const status = el('status');

  if (countWords(answer) < 20) {
    renderResult(result, { kind: 'too-short', words: countWords(answer) });
    setText(status, tooShortText(countWords(answer)));
    return;
  }
  const key = apiKey();
  if (!key) {
    el('key-hint').hidden = false;
    setText(status, 'Add your key to grade, or watch a demo round.');
    el('key-hint').querySelector('a')?.focus();
    return;
  }

  grading = true;
  const button = el<HTMLButtonElement>('grade');
  button.disabled = true;
  setText(button, 'Grading…');
  result.setAttribute('aria-busy', 'true');
  renderLoading(result);
  setText(status, 'Grading your answer.');

  const outcome = await gradeAnswer(makeSend(key), { model: model(), question: current.text, answer, stories });

  renderResult(result, outcome);
  result.removeAttribute('aria-busy');
  setText(
    status,
    outcome.kind === 'graded'
      ? announce(outcome.report)
      : outcome.kind === 'problem'
        ? PROBLEM_TEXT[outcome.problem]
        : tooShortText(outcome.words),
  );
  grading = false;
  button.disabled = false;
  setText(button, 'Grade my answer');
  result.focus({ preventScroll: false });
}

// ---------- demo ----------

let demoNext = 0;
let demoPlaying = false;

async function playDemo(): Promise<void> {
  if (demoPlaying) return;
  const round = DEMO_ROUNDS[demoNext];
  if (!round) return;
  demoPlaying = true;
  const button = el<HTMLButtonElement>('play-demo');
  button.disabled = true;
  const out = el('demo-out');
  out.replaceChildren();

  const line = (cls: string, label: string, text: string): HTMLElement => {
    const block = document.createElement('div');
    block.className = `demo-line ${cls}`;
    const head = document.createElement('p');
    head.className = 'demo-label';
    head.textContent = label;
    const body = document.createElement('p');
    body.textContent = text;
    block.append(head, body);
    return block;
  };

  out.append(line('demo-q', `Round ${demoNext + 1} · ${round.family}`, round.question));
  await wait(700);
  out.append(line('demo-a', DEMO_CANDIDATE, round.answer));
  await wait(900);

  const graded = await gradeAnswer(scriptedSend(round), {
    model: DEFAULT_MODEL,
    question: round.question,
    answer: round.answer,
    stories: [],
  });
  const result = document.createElement('div');
  result.className = 'result';
  renderResult(result, graded);
  out.append(result);
  const note = document.createElement('p');
  note.className = 'note';
  note.textContent = round.note;
  out.append(note);

  demoNext = (demoNext + 1) % DEMO_ROUNDS.length;
  setText(button, demoNext === 0 ? 'Play round 1 again' : `Play round ${demoNext + 1} of ${DEMO_ROUNDS.length}`);
  if (graded.kind === 'graded') setText(el('status'), `Demo round graded: ${BAND_TITLE[graded.report.band]}.`);
  button.disabled = false;
  demoPlaying = false;
}

// ---------- key ----------

function showKeyState(message?: string): void {
  const has = apiKey() !== '';
  el<HTMLButtonElement>('forget-key').disabled = !has;
  setText(el('key-status'), message ?? (has ? 'A key is saved in this browser.' : 'No key saved. The demo works without one.'));
  updateKeyHint();
}

// ---------- story bank ----------

function persistStories(): boolean {
  return save(KEYS.stories, exportStories(stories));
}

function renderStories(): void {
  const list = el('story-list');
  list.replaceChildren();
  for (const story of stories) {
    const item = document.createElement('li');
    const text = document.createElement('div');
    const title = document.createElement('p');
    title.className = 'story-title';
    title.textContent = story.title || 'Untitled story';
    text.append(title);
    if (story.number) {
      const number = document.createElement('p');
      number.className = 'story-number';
      number.textContent = story.number;
      text.append(number);
    }
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'text-button';
    remove.textContent = 'Delete';
    remove.setAttribute('aria-label', `Delete story: ${story.title || 'Untitled story'}`);
    remove.addEventListener('click', () => deleteStory(story.id));
    item.append(text, remove);
    list.append(item);
  }
  el('story-empty').hidden = stories.length > 0;
  el<HTMLButtonElement>('export').disabled = stories.length === 0;
}

function storyStatus(message: string, undo = false): void {
  const status = el('story-status');
  status.replaceChildren(document.createTextNode(message));
  if (undo) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'text-button';
    button.textContent = 'Undo';
    button.addEventListener('click', () => {
      if (!lastDeleted) return;
      stories.splice(lastDeleted.index, 0, lastDeleted.story);
      lastDeleted = null;
      persistStories();
      renderStories();
      storyStatus('Story restored.');
    });
    status.append(' ', button);
  }
}

function deleteStory(id: string): void {
  const index = stories.findIndex((s) => s.id === id);
  const story = stories[index];
  if (!story) return;
  stories.splice(index, 1);
  lastDeleted = { story, index };
  persistStories();
  renderStories();
  storyStatus(`Deleted "${story.title || 'Untitled story'}".`, true);
}

function readStoryForm(): Story {
  const value = (id: string): string => el<HTMLInputElement | HTMLTextAreaElement>(id).value;
  return {
    id: `s-${Date.now().toString(36)}`,
    title: value('s-title').trim(),
    situation: value('s-situation').trim(),
    task: value('s-task').trim(),
    action: value('s-action').trim(),
    result: value('s-result').trim(),
    number: value('s-number').trim(),
  };
}

function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- start ----------

function start(): void {
  if (new URLSearchParams(location.search).has('embed')) document.documentElement.dataset.embed = '';

  // The rules on the page come from the same constants the grader uses.
  setText(el('rule-setup'), pct(SETUP_MAX));
  setText(el('rule-action'), pct(ACTION_MIN));
  setText(el('rule-pace'), String(WORDS_PER_MINUTE));

  // Role menu
  const familySelect = el<HTMLSelectElement>('family');
  for (const f of ROLE_FAMILIES) familySelect.add(new Option(f.label, f.id));
  const savedFamily = load(KEYS.family);
  family = isRoleFamily(savedFamily) ? savedFamily : 'behavioural';
  familySelect.value = family;
  familySelect.addEventListener('change', () => {
    if (!isRoleFamily(familySelect.value)) return;
    family = familySelect.value;
    save(KEYS.family, family);
    asked = [];
    current = null;
    askNext();
  });

  // Model menu
  const modelSelect = el<HTMLSelectElement>('model');
  for (const m of MODELS) modelSelect.add(new Option(m.label, m.id));
  modelSelect.value = model();
  modelSelect.addEventListener('change', () => {
    if (isModelId(modelSelect.value)) save(KEYS.model, modelSelect.value);
  });

  // Practice
  el('next').addEventListener('click', askNext);
  el('answer').addEventListener('input', updatePace);
  el('grade').addEventListener('click', () => void grade());
  const mic = el<HTMLButtonElement>('mic');
  const answerBox = el<HTMLTextAreaElement>('answer');
  if (
    attachSpeech(mic, answerBox, () => {
      if (answerBox.value.length > MAX_ANSWER) answerBox.value = answerBox.value.slice(0, MAX_ANSWER);
      updatePace();
    })
  ) {
    mic.hidden = false;
    el('mic-note').hidden = false;
  }

  // Demo
  el('play-demo').addEventListener('click', () => void playDemo());

  // Key
  const keyInput = el<HTMLInputElement>('api-key');
  el('key-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const value = keyInput.value.trim();
    if (!value) {
      showKeyState('Paste a key first.');
      return;
    }
    if (/\s/.test(value) || value.length > 300) {
      showKeyState("That doesn't look like an API key. Copy it again from the Claude Console.");
      return;
    }
    keyInput.value = '';
    if (save(KEYS.apiKey, value)) {
      showKeyState('Key saved in this browser.');
    } else {
      showKeyState("This browser won't let the page store anything, so the key can't be saved here.");
    }
  });
  el('forget-key').addEventListener('click', () => {
    drop(KEYS.apiKey);
    keyInput.value = '';
    showKeyState('Key forgotten. It is no longer stored in this browser.');
  });

  // Story bank
  const savedStories = importStories(load(KEYS.stories) ?? '');
  stories = savedStories.ok ? savedStories.stories : [];
  el('story-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const story = readStoryForm();
    if (isBlank(story)) {
      storyStatus('Write at least a title before adding.');
      return;
    }
    const before = stories.length;
    stories = mergeStories(stories, [story]);
    if (stories.length === before) {
      storyStatus('That story is already in the bank, or the bank is full.');
      return;
    }
    persistStories();
    renderStories();
    (event.target as HTMLFormElement).reset();
    storyStatus(`Added "${story.title || 'Untitled story'}".`);
  });
  el('export').addEventListener('click', () => {
    download('interview-room-stories.json', exportStories(stories));
    storyStatus(`Exported ${stories.length} ${stories.length === 1 ? 'story' : 'stories'}.`);
  });
  const fileInput = el<HTMLInputElement>('import-file');
  el('import').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      storyStatus('That file is too big to be a story bank.');
      return;
    }
    const result = importStories(await file.text());
    if (!result.ok) {
      storyStatus(result.error);
      return;
    }
    const before = stories.length;
    stories = mergeStories(stories, result.stories);
    persistStories();
    renderStories();
    const added = stories.length - before;
    storyStatus(
      added === 0
        ? 'Nothing new in that file.'
        : `Imported ${added} ${added === 1 ? 'story' : 'stories'}.`,
    );
  });

  renderStories();
  showKeyState();
  askNext();

  // Saves the app on the device so the demo opens with no signal. Only in the real build.
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline support is a bonus, not a requirement */
    });
  }
}

start();

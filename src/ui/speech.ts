/**
 * Voice typing, as a bonus. Uses the browser's own speech recognition where it exists
 * and does nothing at all where it doesn't. If it fails halfway,
 * it stops quietly and leaves whatever was already typed.
 */

interface RecognitionResultList {
  length: number;
  [i: number]: { isFinal: boolean; 0: { transcript: string } };
}
interface RecognitionEvent {
  resultIndex: number;
  results: RecognitionResultList;
}
interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechSupported(): boolean {
  return recognitionCtor() !== null;
}

/**
 * Wire `button` to dictate into `field`. Returns false (and leaves the button hidden)
 * if this browser has no speech recognition.
 */
export function attachSpeech(button: HTMLButtonElement, field: HTMLTextAreaElement, onText: () => void): boolean {
  const Ctor = recognitionCtor();
  if (!Ctor) return false;

  let active: Recognition | null = null;
  const setState = (on: boolean): void => {
    button.setAttribute('aria-pressed', String(on));
    button.textContent = on ? 'Stop' : 'Speak';
  };

  button.addEventListener('click', () => {
    if (active) {
      active.stop();
      return;
    }
    let rec: Recognition;
    try {
      rec = new Ctor();
    } catch {
      return;
    }
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = document.documentElement.lang || 'en';
    rec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result?.isFinal) continue;
        const said = result[0].transcript.trim();
        if (!said) continue;
        const gap = field.value === '' || /\s$/.test(field.value) ? '' : ' ';
        field.value = `${field.value}${gap}${said}`;
        onText();
      }
    };
    rec.onerror = () => rec.stop();
    rec.onend = () => {
      active = null;
      setState(false);
    };
    try {
      rec.start();
      active = rec;
      setState(true);
    } catch {
      active = null;
      setState(false);
    }
  });
  return true;
}

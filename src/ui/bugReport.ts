// Detección de errores en ejecución y botón 🐞 para mandar bugs, peticiones o cambios.
import {
  addError, ErrorEntry, FeedbackItem, FeedbackKind, GameContext, issueUrl, KIND_LABELS, queueAsMarkdown,
} from './feedback';

const ERRORS_KEY = 'oxido.errors';
const QUEUE_KEY = 'oxido.feedbackQueue';

let errors: ErrorEntry[] = load<ErrorEntry[]>(ERRORS_KEY, []);
let queue: FeedbackItem[] = load<FeedbackItem[]>(QUEUE_KEY, []);
const listeners: Array<(e: ErrorEntry) => void> = [];
/** Errores nuevos desde que se abrió la página (el registro guardado puede ser de antes). */
let freshErrors = 0;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sin almacenamiento (modo privado): seguimos en memoria.
  }
}

function describe(value: unknown): string {
  if (value instanceof Error) {
    const where = value.stack?.split('\n').slice(1, 3).map((l) => l.trim()).join(' | ');
    return where ? `${value.name}: ${value.message} @ ${where}` : `${value.name}: ${value.message}`;
  }
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function recordError(source: ErrorEntry['source'], message: string): void {
  const before = errors.find((e) => e.source === source && e.message === message);
  // Visible también en la consola (las pruebas automáticas lo leen de ahí).
  if (source !== 'error' && source !== 'consola') console.warn(`[error del juego · ${source}] ${message}`);
  errors = addError(errors, { at: new Date().toISOString(), source, message: message.slice(0, 600) });
  save(ERRORS_KEY, errors);
  freshErrors++;
  const entry = before ?? errors[errors.length - 1];
  // Solo avisamos la primera vez de cada error para no inundar la pantalla.
  if (!before) for (const l of listeners) l(entry);
  updateBadge();
}

/** Captura excepciones, promesas rechazadas y console.error. Llamar una vez al arrancar. */
export function installErrorCapture(): void {
  window.addEventListener('error', (ev) => {
    const where = ev.filename ? ` (${ev.filename.split('/').pop()}:${ev.lineno}:${ev.colno})` : '';
    recordError('error', ev.error ? describe(ev.error) : `${ev.message}${where}`);
  });
  window.addEventListener('unhandledrejection', (ev) => recordError('promesa', describe(ev.reason)));
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    original(...args);
    try {
      recordError('consola', args.map(describe).join(' '));
    } catch {
      // Nunca dejar que el registro rompa el juego.
    }
  };
}

export function onNewError(cb: (e: ErrorEntry) => void): void {
  listeners.push(cb);
}

// --- Panel -------------------------------------------------------------------

let badge: HTMLElement | null = null;

function updateBadge(): void {
  if (!badge) return;
  const pending = queue.filter((q) => !q.sent).length;
  const n = freshErrors > 0 ? freshErrors : pending;
  badge.textContent = n > 0 ? String(Math.min(n, 99)) : '';
  badge.classList.toggle('error', freshErrors > 0);
}

export interface ReportPanelOptions {
  button: HTMLButtonElement;
  panel: HTMLElement;
  getContext: () => GameContext;
}

export function mountReportPanel({ button, panel, getContext }: ReportPanelOptions): void {
  badge = document.createElement('span');
  badge.className = 'badge';
  button.append(badge);
  updateBadge();

  let kind: FeedbackKind = 'bug';
  const kindButtons = Array.from(panel.querySelectorAll<HTMLButtonElement>('[data-kind]'));
  const text = panel.querySelector<HTMLTextAreaElement>('#rp-text')!;
  const attach = panel.querySelector<HTMLInputElement>('#rp-attach')!;
  const attachLabel = panel.querySelector<HTMLElement>('#rp-attach-label')!;
  const errorList = panel.querySelector<HTMLElement>('#rp-errors')!;
  const queueList = panel.querySelector<HTMLElement>('#rp-queue')!;
  const status = panel.querySelector<HTMLElement>('#rp-status')!;

  const setKind = (k: FeedbackKind) => {
    kind = k;
    kindButtons.forEach((b) => b.classList.toggle('active', b.dataset.kind === k));
    text.placeholder = k === 'bug'
      ? '¿Qué ha pasado? ¿Qué esperabas que pasara?'
      : k === 'peticion' ? '¿Qué te gustaría que tuviera el juego?' : '¿Qué cambiarías y cómo?';
  };
  kindButtons.forEach((b) => b.addEventListener('click', () => setKind(b.dataset.kind as FeedbackKind)));

  const render = () => {
    attachLabel.textContent = `Adjuntar errores detectados (${errors.length})`;
    attach.disabled = errors.length === 0;
    errorList.replaceChildren(
      ...(errors.length === 0
        ? [Object.assign(document.createElement('p'), { className: 'muted', textContent: 'Ningún error detectado.' })]
        : errors.slice().reverse().slice(0, 15).map((e) => {
            const row = document.createElement('div');
            row.className = 'rp-error';
            const t = new Date(e.at);
            const when = Number.isNaN(t.getTime()) ? e.at : t.toLocaleTimeString();
            row.textContent = `${when} · ${e.source}${e.count > 1 ? ` ×${e.count}` : ''} · ${e.message}`;
            return row;
          })),
    );
    queueList.replaceChildren(
      ...(queue.length === 0
        ? [Object.assign(document.createElement('p'), { className: 'muted', textContent: 'La cola está vacía.' })]
        : queue.slice().reverse().map((q) => {
            const row = document.createElement('div');
            row.className = 'rp-item';
            const label = document.createElement('span');
            label.textContent = `${q.sent ? '✓' : '•'} ${KIND_LABELS[q.kind]}: ${q.text.split('\n')[0].slice(0, 60)}`;
            const send = document.createElement('button');
            send.type = 'button';
            send.textContent = q.sent ? 'Reabrir' : 'Enviar';
            send.addEventListener('click', () => sendItem(q));
            const del = document.createElement('button');
            del.type = 'button';
            del.textContent = '✕';
            del.title = 'Quitar de la cola';
            del.addEventListener('click', () => {
              queue = queue.filter((x) => x.id !== q.id);
              save(QUEUE_KEY, queue);
              render();
              updateBadge();
            });
            row.append(label, send, del);
            return row;
          })),
    );
  };

  const sendItem = (q: FeedbackItem) => {
    window.open(issueUrl(q), '_blank', 'noopener');
    q.sent = true;
    save(QUEUE_KEY, queue);
    status.textContent = 'Se ha abierto GitHub: revisa el texto y pulsa «Create» para que entre en la cola de trabajo.';
    render();
    updateBadge();
  };

  const createItem = (): FeedbackItem | null => {
    const value = text.value.trim();
    if (!value && !(attach.checked && errors.length > 0)) {
      status.textContent = 'Escribe qué pasa o qué quieres antes de enviarlo.';
      text.focus();
      return null;
    }
    const item: FeedbackItem = {
      id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      kind,
      text: value || 'Errores detectados automáticamente',
      createdAt: new Date().toISOString(),
      context: getContext(),
      errors: attach.checked ? errors.map((e) => ({ ...e })) : [],
      sent: false,
    };
    queue.push(item);
    save(QUEUE_KEY, queue);
    text.value = '';
    return item;
  };

  panel.querySelector('#rp-send')!.addEventListener('click', () => {
    const item = createItem();
    if (item) sendItem(item);
  });
  panel.querySelector('#rp-save')!.addEventListener('click', () => {
    if (!createItem()) return;
    status.textContent = 'Guardado en la cola de este navegador. Envíalo cuando quieras.';
    render();
    updateBadge();
  });
  panel.querySelector('#rp-copy')!.addEventListener('click', async () => {
    const pending = queue.filter((q) => !q.sent);
    const md = queueAsMarkdown(pending.length > 0 ? pending : queue);
    try {
      await navigator.clipboard.writeText(md);
      status.textContent = 'Copiado. Pégalo en docs/FEEDBACK.md o en una incidencia de GitHub.';
    } catch {
      status.textContent = 'No se pudo copiar automáticamente.';
    }
  });
  panel.querySelector('#rp-clear-errors')!.addEventListener('click', () => {
    errors = [];
    freshErrors = 0;
    save(ERRORS_KEY, errors);
    render();
    updateBadge();
  });
  panel.querySelector('#rp-close')!.addEventListener('click', () => (panel.hidden = true));

  button.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) {
      freshErrors = 0;
      // Si hay errores recientes, lo normal es querer mandar un bug con ellos.
      const hasErrors = errors.length > 0;
      attach.checked = hasErrors;
      if (hasErrors) setKind('bug');
      status.textContent = '';
      render();
      updateBadge();
    }
  });

  setKind('bug');
  onNewError(() => {
    if (!panel.hidden) render();
  });
}

// Panel «Progreso del desarrollo»: qué se está haciendo, últimos parches y lo que falta.
// Los documentos se incrustan al compilar, así que cada versión publicada muestra su propio estado.
import roadmapMd from '../../docs/ROADMAP.md?raw';
import progressMd from '../../docs/PROGRESO.md?raw';
import feedbackMd from '../../docs/FEEDBACK.md?raw';
import { buildStatus, nextSession, percent } from './devStatus';

/** Horario de la sesión automática de desarrollo (hora de Madrid). Actualizar si cambia. */
export const SESSION_HOURS = [0, 4, 8, 12, 16, 20] as const;
export const SESSION_MINUTE = 19;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

function bar(pct: number): HTMLElement {
  const outer = el('div', 'dp-bar');
  const inner = el('span');
  inner.style.width = `${pct}%`;
  outer.append(inner);
  return outer;
}

function formatSession(d: Date, now: Date): string {
  const hh = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const sameDay = d.toDateString() === now.toDateString();
  return `${sameDay ? 'hoy' : 'mañana'} a las ${hh}`;
}

function buildInfo(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  const commit = env.VITE_COMMIT ? env.VITE_COMMIT.slice(0, 7) : 'local';
  const when = env.VITE_BUILD_TIME ? new Date(env.VITE_BUILD_TIME) : null;
  const date = when && !Number.isNaN(when.getTime())
    ? when.toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : 'sin fecha';
  return `Versión ${commit} · publicada ${date}`;
}

export function mountDevPanel(panel: HTMLElement, openButton: HTMLElement): void {
  const body = panel.querySelector<HTMLElement>('#dp-body')!;
  panel.querySelector('#dp-close')!.addEventListener('click', () => (panel.hidden = true));

  const render = () => {
    const s = buildStatus(roadmapMd, progressMd, feedbackMd);
    const now = new Date();
    const total = percent(s.done, s.total);
    const phase = s.phases[s.current];
    const phaseDone = phase ? phase.tasks.filter((t) => t.done).length : 0;

    const summary = el('div', 'dp-section');
    summary.append(
      el('div', 'dp-meta', buildInfo()),
      el('div', 'dp-row', `Total del juego: ${s.done} de ${s.total} tareas (${total} %)`),
      bar(total),
    );

    const now_ = el('div', 'dp-section');
    now_.append(el('h3', '', 'Ahora'));
    if (phase) {
      now_.append(
        el('div', 'dp-row', `${phase.title}: ${phaseDone}/${phase.tasks.length}`),
        bar(percent(phaseDone, phase.tasks.length)),
      );
      if (phase.criterion) now_.append(el('div', 'dp-meta', `Para cerrarla: ${phase.criterion}`));
    }
    if (s.nextTask) now_.append(el('div', 'dp-next', `Siguiente: ${s.nextTask}`));
    now_.append(el('div', 'dp-meta',
      `Próxima sesión automática: ${formatSession(nextSession(now, SESSION_HOURS, SESSION_MINUTE), now)}`));
    if (s.awaitingConfirmation.length > 0) {
      const list = el('ul', 'dp-list');
      for (const f of s.awaitingConfirmation) list.append(el('li', '', f));
      now_.append(el('div', 'dp-sub', 'Esperando tu confirmación (mándala con 🐞)'), list);
    }
    if (s.pendingFeedback.length > 0) {
      const list = el('ul', 'dp-list');
      for (const f of s.pendingFeedback) list.append(el('li', '', f));
      now_.append(el('div', 'dp-sub', 'Tus peticiones en cola (van primero)'), list);
    }

    const patches = el('div', 'dp-section');
    patches.append(el('h3', '', 'Últimos parches'));
    s.entries.forEach((e, idx) => {
      const d = el('details');
      if (idx === 0) d.open = true;
      d.append(el('summary', '', e.title));
      const list = el('ul', 'dp-list');
      for (const item of e.items) list.append(el('li', '', item));
      d.append(list);
      patches.append(d);
    });

    const phases = el('div', 'dp-section');
    phases.append(el('h3', '', 'Lo que queda'));
    s.phases.forEach((p, idx) => {
      const done = p.tasks.filter((t) => t.done).length;
      const d = el('details');
      if (idx === s.current) d.open = true;
      const sum = el('summary');
      sum.append(el('span', '', `${p.title}`), el('span', 'dp-count', `${done}/${p.tasks.length}`));
      d.append(sum, bar(percent(done, p.tasks.length)));
      const list = el('ul', 'dp-tasks');
      for (const t of p.tasks) list.append(el('li', t.done ? 'done' : '', `${t.done ? '✓' : '○'} ${t.text}`));
      d.append(list);
      phases.append(d);
    });

    body.replaceChildren(summary, now_, patches, phases);
  };

  openButton.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) render();
  });
}

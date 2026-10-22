// Primeros pasos (propuesta D, aprobada por Mikel el 2026-10-22): guía corta y opcional al empezar
// una partida nueva. Una tarjeta con el paso en curso y una flecha que señala el botón que hay que
// tocar. Los pasos están en `src/data/tutorial.json`; saber si un paso está hecho lo decide
// `src/sim/tutorial.ts` mirando la partida. La guía no cambia nada de la partida ni va en la
// partida guardada: su avance se recuerda en este navegador, junto a la semilla del mapa.
import { TUTORIAL_STEPS, TutorialTarget } from '../data/tutorial';
import { advanceTutorial } from '../sim/tutorial';
import type { World } from '../sim/world';

const STATE_KEY = 'oxido-primeros-pasos';
const WANT_KEY = 'oxido-primeros-pasos-quiero';

/** Si el jugador quiere la guía en las partidas nuevas (por defecto, sí). */
export function tutorialWanted(): boolean {
  try {
    return localStorage.getItem(WANT_KEY) !== '0';
  } catch {
    return true;
  }
}
export function setTutorialWanted(on: boolean): void {
  try {
    localStorage.setItem(WANT_KEY, on ? '1' : '0');
  } catch {
    // nada
  }
}

interface SavedState {
  seed: number;
  step: number;
}
function readState(): SavedState | null {
  try {
    const s = JSON.parse(localStorage.getItem(STATE_KEY) ?? 'null') as SavedState | null;
    return s && typeof s.seed === 'number' && typeof s.step === 'number' ? s : null;
  } catch {
    return null;
  }
}
function writeState(s: SavedState | null): void {
  try {
    if (s) localStorage.setItem(STATE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STATE_KEY);
  } catch {
    // nada
  }
}

interface Options {
  getWorld: () => World | null;
  /** Categoría que se ve ahora en 🏗 Construir. */
  buildCategory: () => string;
}

export interface Tutorial {
  /** La próxima partida que se cargue empieza con la guía. */
  startOnNextMap(): void;
  /** Se ha cargado un mapa: sigue la guía si era de ese mapa; si no, la quita. */
  mapReady(seed: number): void;
}

const visible = (el: HTMLElement | null): el is HTMLElement => {
  if (!el || el.closest('[hidden]')) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};
const overlap = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

export function mountTutorial(opts: Options): Tutorial {
  const card = document.createElement('div');
  card.id = 'tutorial';
  card.className = 'panel';
  card.hidden = true;
  card.setAttribute('role', 'status');
  const head = document.createElement('div');
  head.className = 'tu-head';
  const title = document.createElement('strong');
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.textContent = 'Saltar guía';
  skip.title = 'Quitar la guía de primeros pasos en esta partida';
  head.append(title, skip);
  const text = document.createElement('div');
  text.className = 'tu-text';
  card.append(head, text);
  const arrow = document.createElement('div');
  arrow.id = 'tutorial-arrow';
  arrow.hidden = true;
  arrow.setAttribute('aria-hidden', 'true');
  document.body.append(card, arrow);

  let state: SavedState | null = null;
  let pending = false;
  let finishedAt = 0;
  /** Para desplazar la hoja hasta el botón una sola vez por paso y elemento. */
  let scrolledTo: HTMLElement | null = null;

  skip.addEventListener('click', () => stop());

  function stop(): void {
    if (state) writeState({ seed: state.seed, step: TUTORIAL_STEPS.length });
    state = null;
    card.hidden = true;
    arrow.hidden = true;
  }

  /** Elemento al que señalar para el paso: el botón de la barra, la pestaña o el botón de la hoja. */
  function targetElement(t: TutorialTarget): HTMLElement | null {
    const sheet = document.getElementById(t.menu === 'orders' ? 'order-modes' : 'build-modes');
    const bar = document.getElementById(t.menu === 'orders' ? 'orders-btn' : 'build-btn');
    if (!sheet || sheet.hidden) return bar;
    if (sheet.classList.contains('collapsed')) {
      const expand = sheet.querySelector<HTMLElement>('.ts-expand');
      return visible(expand) ? expand : bar;
    }
    let el: HTMLElement | null = null;
    if (t.menu === 'orders' && t.mode) el = sheet.querySelector<HTMLElement>(`button[data-mode="${t.mode}"]`);
    else if (t.build) {
      if (t.category && opts.buildCategory() !== t.category) el = sheet.querySelector<HTMLElement>(`#build-tabs button[data-cat="${t.category}"]`);
      else el = sheet.querySelector<HTMLElement>(`button[data-build="${t.build}"]`);
    }
    if (!el) return bar;
    // Ya está elegido: el jugador está marcando en el mapa, no hace falta flecha.
    if (el.classList.contains('active')) return null;
    if (scrolledTo !== el) {
      scrolledTo = el;
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    return visible(el) ? el : bar;
  }

  /** Pone la tarjeta abajo a la izquierda, o donde no tape las hojas ni la pista de la orden. */
  function placeCard(): void {
    const obstacles = ['order-modes', 'build-modes', 'design-hint', 'colonist-panel']
      .map((id) => document.getElementById(id))
      .filter(visible)
      .map((el) => el.getBoundingClientRect());
    const h = card.offsetHeight;
    const w = card.offsetWidth;
    const H = window.innerHeight;
    const tops = [H - 64 - h, ...obstacles.map((r) => r.top - 8 - h), 114];
    for (const top of tops) {
      if (top < 60) continue;
      const r = new DOMRect(8, top, w, h);
      if (!obstacles.some((o) => overlap(r, o))) {
        card.style.top = `${top}px`;
        return;
      }
    }
    card.style.top = '114px';
  }

  function placeArrow(target: HTMLElement | null): void {
    if (!target) {
      arrow.hidden = true;
      return;
    }
    const r = target.getBoundingClientRect();
    const up = r.top < 60; // sin sitio encima: debajo, apuntando hacia arriba
    arrow.hidden = false;
    arrow.classList.toggle('up', up);
    arrow.style.left = `${r.left + r.width / 2}px`;
    arrow.style.top = up ? `${r.bottom + 4}px` : `${r.top - 4}px`;
  }

  function render(): void {
    if (!state) return;
    const step = TUTORIAL_STEPS[state.step];
    if (!step) {
      // Terminada: un rato con la felicitación y fuera.
      title.textContent = '✅ ¡Primeros pasos hechos!';
      text.textContent = 'Ya tienes lo básico. Mira 📜 para la gente y la investigación, y ☰ para guardar.';
      skip.textContent = 'Cerrar';
      arrow.hidden = true;
      card.hidden = false;
      placeCard();
      if (Date.now() - finishedAt > 8000) stop();
      return;
    }
    title.textContent = `Primeros pasos ${state.step + 1}/${TUTORIAL_STEPS.length} · ${step.title}`;
    text.textContent = step.text;
    skip.textContent = 'Saltar guía';
    card.hidden = false;
    placeCard();
    placeArrow(targetElement(step.target));
  }

  function tick(): void {
    const w = opts.getWorld();
    if (!state || !w || w.map.seed !== state.seed) {
      if (!state) return;
      card.hidden = true;
      arrow.hidden = true;
      return;
    }
    if (state.step < TUTORIAL_STEPS.length) {
      const next = advanceTutorial(w, TUTORIAL_STEPS, state.step);
      if (next !== state.step) {
        state.step = next;
        scrolledTo = null;
        writeState(state);
        if (next >= TUTORIAL_STEPS.length) finishedAt = Date.now();
      }
    }
    render();
  }
  window.setInterval(tick, 300);
  window.addEventListener('resize', () => state && render());

  return {
    startOnNextMap() {
      pending = true;
    },
    mapReady(seed: number) {
      if (pending) {
        pending = false;
        state = { seed, step: 0 };
        writeState(state);
      } else {
        const saved = readState();
        state = saved && saved.seed === seed && saved.step < TUTORIAL_STEPS.length ? saved : null;
      }
      scrolledTo = null;
      if (!state) {
        card.hidden = true;
        arrow.hidden = true;
      }
    },
  };
}

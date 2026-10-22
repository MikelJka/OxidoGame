// Menú principal: aparece al abrir el juego (con la partida en pausa detrás) y desde ☰.
// Continuar, nueva partida con opciones, cargar desde archivo, modo Dios y progreso.
import type { World } from '../sim/world';
import { setTutorialWanted, tutorialWanted } from './tutorial';
import { DIFFICULTIES, Difficulty, DifficultyLevel, isDifficultyLevel, MAX_GRACE_DAYS } from '../sim/storyteller';

export interface NewGameOptions {
  seed: number;
  colonists: number;
  events: boolean;
  difficulty: Difficulty;
  /** Empezar con la guía de primeros pasos. */
  tutorial: boolean;
}

interface Options {
  getWorld: () => World | null;
  newGame: (o: NewGameOptions) => void;
  importSave: () => void;
  showProgress: () => void;
  /** Activa o quita el modo Dios. */
  setGod: (on: boolean) => void;
  isGod: () => boolean;
}

export interface MainMenu {
  open(): void;
  close(): void;
  readonly isOpen: boolean;
}

export function mountMainMenu(opts: Options): MainMenu {
  const root = document.getElementById('main-menu')!;
  const home = document.getElementById('mm-home')!;
  const form = document.getElementById('mm-new')!;
  const info = document.getElementById('mm-info')!;
  const seedInput = document.getElementById('mm-seed') as HTMLInputElement;
  const colInput = document.getElementById('mm-colonists') as HTMLInputElement;
  const colLabel = document.getElementById('mm-colonists-n')!;
  const eventsInput = document.getElementById('mm-events') as HTMLInputElement;
  const diffChips = [...document.querySelectorAll<HTMLButtonElement>('#mm-difficulty button[data-level]')];
  const godState = document.getElementById('mm-god-state')!;
  let level: DifficultyLevel = 'normal';
  const diffDesc = document.getElementById('mm-difficulty-desc')!;
  const graceInput = document.getElementById('mm-grace') as HTMLInputElement;
  const graceLabel = document.getElementById('mm-grace-n')!;
  graceInput.max = String(MAX_GRACE_DAYS);
  const godInput = document.getElementById('mm-god-new') as HTMLInputElement;
  const godBtn = document.getElementById('mm-god') as HTMLButtonElement;
  const tutorialInput = document.getElementById('mm-tutorial') as HTMLInputElement;
  let speedBefore: World['speed'] = 1;

  const renderGod = () => {
    const on = opts.isGod();
    godState.textContent = on ? 'Activado' : 'Desactivado';
    godBtn.classList.toggle('active', on);
    godBtn.setAttribute('aria-pressed', String(on));
  };

  function open(): void {
    const w = opts.getWorld();
    if (w && root.hidden) {
      speedBefore = w.speed || 1;
      w.speed = 0;
    }
    info.textContent = w
      ? `${w.clockLabel()} · ${w.colonists.length} ${w.colonists.length === 1 ? 'colono' : 'colonos'} · ${DIFFICULTIES[w.difficulty.level].label}${w.gameOver ? ' · terminada' : ''}`
      : 'Sin partida en curso';
    home.hidden = false;
    form.hidden = true;
    renderGod();
    root.hidden = false;
  }

  function close(): void {
    if (root.hidden) return;
    root.hidden = true;
    const w = opts.getWorld();
    if (w && w.speed === 0 && !w.gameOver) w.speed = speedBefore;
  }

  document.getElementById('mm-continue')!.addEventListener('click', close);
  document.getElementById('mm-new-btn')!.addEventListener('click', () => {
    randomSeed();
    godInput.checked = opts.isGod();
    tutorialInput.checked = tutorialWanted();
    home.hidden = true;
    form.hidden = false;
  });
  document.getElementById('mm-back')!.addEventListener('click', () => {
    home.hidden = false;
    form.hidden = true;
  });
  colInput.addEventListener('input', () => (colLabel.textContent = colInput.value));
  const renderGrace = () => {
    const n = Number(graceInput.value);
    graceLabel.textContent = n === 0 ? '0 (pueden llegar ya)' : String(n);
  };
  const renderDifficulty = (resetGrace: boolean) => {
    for (const b of diffChips) b.setAttribute('aria-checked', String(b.dataset.level === level));
    diffDesc.textContent = DIFFICULTIES[level].desc;
    if (resetGrace) graceInput.value = String(DIFFICULTIES[level].graceDays);
    renderGrace();
  };
  // Al cambiar la dureza se proponen sus días sin raids; luego se pueden ajustar a mano.
  for (const b of diffChips) {
    b.addEventListener('click', () => {
      if (!isDifficultyLevel(b.dataset.level)) return;
      level = b.dataset.level;
      renderDifficulty(true);
    });
  }
  const randomSeed = () => (seedInput.value = String(Math.floor(Math.random() * 1_000_000)));
  document.getElementById('mm-seed-dice')!.addEventListener('click', randomSeed);
  graceInput.addEventListener('input', renderGrace);
  renderDifficulty(true);
  document.getElementById('mm-start')!.addEventListener('click', () => {
    const typed = seedInput.value.trim();
    let seed = Number(typed);
    if (!typed || !Number.isFinite(seed)) {
      // Una palabra también vale como semilla.
      seed = 0;
      for (const ch of typed || String(Date.now())) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) >>> 0;
      seed %= 1_000_000;
    }
    opts.setGod(godInput.checked);
    setTutorialWanted(tutorialInput.checked);
    root.hidden = true;
    opts.newGame({
      seed: Math.floor(Math.abs(seed)),
      colonists: Number(colInput.value),
      events: eventsInput.checked,
      difficulty: { level, graceDays: Number(graceInput.value) },
      tutorial: tutorialInput.checked,
    });
  });
  document.getElementById('mm-load')!.addEventListener('click', () => {
    close();
    opts.importSave();
  });
  document.getElementById('mm-progress')!.addEventListener('click', () => {
    close();
    opts.showProgress();
  });
  godBtn.addEventListener('click', () => {
    opts.setGod(!opts.isGod());
    renderGod();
  });

  return {
    open,
    close,
    get isOpen() {
      return !root.hidden;
    },
  };
}

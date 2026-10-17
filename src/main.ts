import Phaser from 'phaser';
import { WorldScene } from './render/WorldScene';
import { northLabel, Rotation } from './render/rotation';
import { DEFAULT_TILT, TILTS } from './render/projection';
import { seedFromString } from './sim/rng';
import { Colonist, activityLabel } from './sim/colonist';
import { SKILLS, SKILL_NAMES } from './data/colonists';
import type { GameSpeed } from './sim/world';
import type { GameMap } from './sim/map';
import { checkWorld, ProgressMark } from './sim/diagnostics';
import { installErrorCapture, mountReportPanel, onNewError, recordError } from './ui/bugReport';
import { mountDevPanel } from './ui/devPanel';
import { reachableResources } from './sim/resources';
import { RESOURCE_ICONS, RESOURCE_NAMES, RESOURCES } from './data/resources';
import type { Stockpile } from './sim/resources';
import './style.css';

// Primero de todo: cualquier fallo a partir de aquí queda registrado.
installErrorCapture();

function initialSeed(): number {
  const param = new URLSearchParams(window.location.search).get('seed');
  if (param) return /^\d+$/.test(param) ? Number(param) >>> 0 : seedFromString(param);
  return Math.floor(Math.random() * 1_000_000);
}

let seed = initialSeed();

/**
 * Espera a que la ventana tenga tamaño: si Phaser arranca con 0×0 (pestaña o panel oculto,
 * algunos navegadores integrados) falla al crear el lienzo WebGL y el juego no carga.
 */
function waitForSize(): Promise<void> {
  const ready = () => window.innerWidth > 0 && window.innerHeight > 0;
  if (ready()) return Promise.resolve();
  return new Promise((resolve) => {
    const check = () => {
      if (!ready()) return;
      window.removeEventListener('resize', check);
      document.removeEventListener('visibilitychange', check);
      window.clearInterval(timer);
      resolve();
    };
    window.addEventListener('resize', check);
    document.addEventListener('visibilitychange', check);
    const timer = window.setInterval(check, 250);
  });
}
await waitForSize();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  pixelArt: true,
  backgroundColor: '#141210',
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: Math.max(1, window.innerWidth),
    height: Math.max(1, window.innerHeight),
  },
  input: { activePointers: 3 },
  scene: [],
});

game.scene.add('world', WorldScene, true, { seed });

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const scene = () => game.scene.getScene('world') as WorldScene;

// --- Reloj y velocidad -------------------------------------------------------
const clock = $('clock');
const speedButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('#speeds button'));
speedButtons.forEach((b) =>
  b.addEventListener('click', () => scene().setSpeed(Number(b.dataset.speed) as GameSpeed)),
);
game.events.on('clock', (label: string, speed: GameSpeed) => {
  clock.textContent = speed === 0 ? `${label} · en pausa` : label;
  speedButtons.forEach((b) => b.classList.toggle('active', Number(b.dataset.speed) === speed));
});

// --- Giro de la vista -------------------------------------------------------
$('rot-left').addEventListener('click', () => scene().rotate(-1));
$('rot-right').addEventListener('click', () => scene().rotate(1));
game.events.on('view-rotation', (r: Rotation) => ($('compass').textContent = `↑${northLabel(r)}`));
// El botón de inclinación recorre las inclinaciones, de mirar desde arriba a mirar de lado, y vuelve a empezar.
const tiltBtn = $('tilt-btn');
let tiltNow = DEFAULT_TILT;
tiltBtn.addEventListener('click', () => scene().setTiltLevel((tiltNow + 1) % TILTS.length));
game.events.on('view-tilt', (i: number) => {
  tiltNow = i;
  tiltBtn.title = `Inclinación: ${TILTS[i].name} (${i + 1}/${TILTS.length}) · R / F`;
  tiltBtn.textContent = `∠${i + 1}`;
});

// --- Menú --------------------------------------------------------------------
const menu = $('menu');
$('menu-btn').addEventListener('click', () => {
  menu.hidden = !menu.hidden;
  if (!menu.hidden) report.hidden = true;
});
const devPanel = $('dev-panel');
$('dev-btn').addEventListener('click', () => {
  menu.hidden = true;
  report.hidden = true;
});
mountDevPanel(devPanel, $('dev-btn'));
$('new-map').addEventListener('click', () => {
  seed = Math.floor(Math.random() * 1_000_000);
  menu.hidden = true;
  tile.textContent = '';
  scene().scene.restart({ seed });
});

game.events.on('map-ready', (map: GameMap) => {
  $('seed').textContent = `Mapa · semilla ${seed}`;
  const near = reachableResources(map);
  $('map-resources').textContent = 'Al alcance: ' + (['madera', 'piedra', 'chatarra'] as const)
    .map((r) => `${RESOURCE_ICONS[r]} ${RESOURCE_NAMES[r].toLowerCase()} ${near[r]}`)
    .join(' · ');
  const url = new URL(window.location.href);
  url.searchParams.set('seed', String(seed));
  window.history.replaceState(null, '', url);
  renderRoster();
});

// --- Inventario de la colonia ---------------------------------------------------
const inventory = $('inventory');
let inventoryKey = '';
game.events.on('inventory', (inv: Stockpile) => {
  const key = RESOURCES.map((r) => inv[r]).join(',');
  if (key === inventoryKey) return; // solo se rehace si cambia algo
  inventoryKey = key;
  inventory.replaceChildren(
    ...RESOURCES.map((r) => {
      const el = document.createElement('span');
      el.className = 'inv-item';
      el.title = RESOURCE_NAMES[r];
      el.textContent = `${RESOURCE_ICONS[r]} ${inv[r]}`;
      return el;
    }),
  );
});

// --- Información de casilla y avisos -----------------------------------------
const tile = $('tile');
game.events.on('tile-info', (text: string) => (tile.textContent = text));

const toast = $('toast');
let toastTimer = 0;
function showToast(text: string, ms = 1600): void {
  toast.textContent = text;
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toast.hidden = true), ms);
}
game.events.on('toast', (text: string) => showToast(text));

// --- Informar de bugs, peticiones y cambios ----------------------------------
const report = $('report');
const reportBtn = $<HTMLButtonElement>('report-btn');
reportBtn.addEventListener('click', () => {
  menu.hidden = true;
  devPanel.hidden = true;
});
mountReportPanel({
  button: reportBtn,
  panel: report,
  getContext: () => {
    let clockLabel = 'sin partida';
    try {
      clockLabel = scene().world.clockLabel();
    } catch {
      // La escena aún no existe.
    }
    return {
      url: window.location.href,
      clock: clockLabel,
      userAgent: navigator.userAgent,
      viewport: `${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio}x`,
    };
  },
});
onNewError(() => showToast('⚠️ Se ha detectado un error. Toca 🐞 para enviarlo.', 3500));

// Comprobación periódica del estado de la simulación (colonos atascados, fuera del mapa…).
let diagProgress = new Map<number, ProgressMark>();
let diagWorld: unknown = null;
const reportedProblems = new Set<string>();
window.setInterval(() => {
  const s = game.scene.getScene('world') as WorldScene | null;
  if (!s || !s.world) return;
  if (diagWorld !== s.world) {
    diagWorld = s.world;
    diagProgress = new Map();
    reportedProblems.clear();
  }
  try {
    for (const p of checkWorld(s.world, diagProgress)) {
      if (reportedProblems.has(p.key)) continue;
      reportedProblems.add(p.key);
      recordError('simulación', `${p.message} · semilla ${seed} · ${s.world.clockLabel()}`);
    }
  } catch (err) {
    recordError('simulación', `La comprobación falló: ${err instanceof Error ? err.message : String(err)}`);
  }
}, 2000);

// --- Lista de colonos ----------------------------------------------------------
const roster = $('roster');
function renderRoster(): void {
  roster.replaceChildren();
  for (const c of scene().world.colonists) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.id = String(c.id);
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = `#${c.look.shirt.toString(16).padStart(6, '0')}`;
    b.append(dot, document.createTextNode(c.name));
    b.addEventListener('click', () => {
      const s = scene();
      if (s.selectedId === c.id) s.focus(c.id);
      s.select(c.id);
    });
    b.addEventListener('dblclick', () => scene().focus(c.id));
    roster.append(b);
  }
}

// --- Ficha del colono ------------------------------------------------------------
const panel = $('colonist-panel');
$('cp-close').addEventListener('click', () => scene().select(null));
let lastPanelId: number | null = null;

game.events.on('selection', (c: Colonist | null) => {
  for (const b of roster.querySelectorAll<HTMLButtonElement>('button')) {
    b.classList.toggle('active', c !== null && b.dataset.id === String(c.id));
  }
  if (!c) {
    panel.hidden = true;
    lastPanelId = null;
    return;
  }
  panel.hidden = false;
  $('cp-activity').textContent = activityLabel(c);
  if (lastPanelId === c.id) return; // el resto no cambia mientras siga seleccionado
  lastPanelId = c.id;
  $('cp-name').textContent = `${c.name} «${c.nickname}»`;
  $('cp-sub').textContent = `${c.age} años`;

  const traits = $('cp-traits');
  traits.replaceChildren(
    ...c.traits.map((t) => {
      const el = document.createElement('span');
      el.className = 'trait';
      el.textContent = t.name;
      el.title = t.description;
      return el;
    }),
  );

  const skills = $('cp-skills');
  skills.replaceChildren(
    ...SKILLS.map((s) => {
      const row = document.createElement('div');
      row.className = 'skill';
      const name = document.createElement('span');
      name.textContent = SKILL_NAMES[s];
      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = String(c.skills[s]);
      const bar = document.createElement('div');
      bar.className = 'bar';
      const fill = document.createElement('span');
      fill.style.width = `${(c.skills[s] / 20) * 100}%`;
      bar.append(fill);
      const passion = document.createElement('span');
      passion.className = 'passion';
      passion.textContent = c.passions[s] === 2 ? '🔥' : c.passions[s] === 1 ? '·' : '';
      passion.title = c.passions[s] === 2 ? 'Pasión' : c.passions[s] === 1 ? 'Interés' : '';
      row.append(name, num, bar, passion);
      return row;
    }),
  );
});

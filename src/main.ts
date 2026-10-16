import Phaser from 'phaser';
import { WorldScene } from './render/WorldScene';
import { seedFromString } from './sim/rng';
import { Colonist, activityLabel } from './sim/colonist';
import { SKILLS, SKILL_NAMES } from './data/colonists';
import type { GameSpeed } from './sim/world';
import './style.css';

function initialSeed(): number {
  const param = new URLSearchParams(window.location.search).get('seed');
  if (param) return /^\d+$/.test(param) ? Number(param) >>> 0 : seedFromString(param);
  return Math.floor(Math.random() * 1_000_000);
}

let seed = initialSeed();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  pixelArt: true,
  backgroundColor: '#141210',
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
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

// --- Menú --------------------------------------------------------------------
const menu = $('menu');
$('menu-btn').addEventListener('click', () => (menu.hidden = !menu.hidden));
$('new-map').addEventListener('click', () => {
  seed = Math.floor(Math.random() * 1_000_000);
  menu.hidden = true;
  tile.textContent = '';
  scene().scene.restart({ seed });
});

game.events.on('map-ready', () => {
  $('seed').textContent = `Mapa · semilla ${seed}`;
  const url = new URL(window.location.href);
  url.searchParams.set('seed', String(seed));
  window.history.replaceState(null, '', url);
  renderRoster();
});

// --- Información de casilla y avisos -----------------------------------------
const tile = $('tile');
game.events.on('tile-info', (text: string) => (tile.textContent = text));

const toast = $('toast');
let toastTimer = 0;
game.events.on('toast', (text: string) => {
  toast.textContent = text;
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toast.hidden = true), 1600);
});

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

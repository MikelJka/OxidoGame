import Phaser from 'phaser';
import { WorldScene } from './render/WorldScene';
import { northLabel, Rotation } from './render/rotation';
import { DEFAULT_TILT, TILTS } from './render/projection';
import { seedFromString } from './sim/rng';
import { Colonist, activityLabel, WorkPriority } from './sim/colonist';
import { WORK_NAMES, WORK_TYPES } from './data/work';
import { SKILLS, SKILL_NAMES } from './data/colonists';
import type { GameSpeed } from './sim/world';
import type { GameMap } from './sim/map';
import { checkWorld, ProgressMark } from './sim/diagnostics';
import { installErrorCapture, mountReportPanel, onNewError, recordError } from './ui/bugReport';
import { mountDevPanel } from './ui/devPanel';
import { downloadWorld, pickSaveFile, readBackupSave, readStoredSave, storeWorld } from './ui/saveGame';
import { parseSave } from './sim/save';
import { reachableResources } from './sim/resources';
import { BASE_RESOURCES, HarvestJob, RESOURCE_ICONS, RESOURCE_NAMES, RESOURCES } from './data/resources';
import { CROPS } from './data/crops';
import type { GrowZone } from './sim/farming';
import { BUILDING_CATEGORY_NAMES, BUILDINGS, buildingDef } from './data/buildings';
import { STORAGE_PRIORITIES, STORAGE_PRIORITY_NAMES, StorageZone } from './sim/zones';
import { STATION_TARGETS, type Structure } from './sim/structures';
import type { DesignMode } from './render/WorldScene';
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

// Si hay una partida guardada en el navegador, se sigue con ella (también tras publicar una versión nueva).
// ?nueva en la URL empieza un mapa nuevo.
const wantsNew = new URLSearchParams(window.location.search).has('nueva');
const storedSave = wantsNew ? null : readStoredSave();
game.scene.add('world', WorldScene, true, storedSave ? { seed, save: storedSave } : { seed });

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
  if (!window.confirm('¿Empezar un mapa nuevo? La partida actual se perderá (puedes exportarla antes con ⬇).')) return;
  seed = Math.floor(Math.random() * 1_000_000);
  menu.hidden = true;
  tile.textContent = '';
  scene().scene.restart({ seed });
});

game.events.on('map-ready', (map: GameMap) => {
  seed = map.seed;
  $('seed').textContent = `Mapa · semilla ${seed}`;
  const near = reachableResources(map);
  $('map-resources').textContent = 'Al alcance: ' + (['madera', 'piedra', 'chatarra'] as const)
    .map((r) => `${RESOURCE_ICONS[r]} ${RESOURCE_NAMES[r].toLowerCase()} ${near[r]}`)
    .join(' · ');
  const url = new URL(window.location.href);
  url.searchParams.set('seed', String(seed));
  url.searchParams.delete('nueva');
  window.history.replaceState(null, '', url);
  renderRoster();
  saveNow(false); // así, recargar la página nunca vuelve a un mapa anterior
});

// --- Guardar la partida -------------------------------------------------------
/** Cada cuánto se guarda sola la partida. */
const AUTOSAVE_MS = 30_000;
const saveStatus = $('save-status');
let lastSavedAt = 0;
let saveError: string | null = null;
function saveNow(announce: boolean): void {
  const s = game.scene.getScene('world') as WorldScene | null;
  if (!s || !s.world) return;
  saveError = storeWorld(s.world);
  if (!saveError) lastSavedAt = Date.now();
  else recordError('guardado', saveError);
  renderSaveStatus();
  if (announce) showToast(saveError ?? '💾 Partida guardada');
}
function renderSaveStatus(): void {
  if (saveError) {
    saveStatus.textContent = `⚠️ ${saveError}`;
    return;
  }
  if (!lastSavedAt) {
    saveStatus.textContent = 'Sin guardar todavía';
    return;
  }
  const secs = Math.round((Date.now() - lastSavedAt) / 1000);
  saveStatus.textContent = `💾 Guardado automático · hace ${secs < 60 ? `${secs} s` : `${Math.round(secs / 60)} min`}`;
}
window.setInterval(() => saveNow(false), AUTOSAVE_MS);
window.setInterval(renderSaveStatus, 5000);
// Al cerrar o esconder la pestaña (en el móvil, al cambiar de app) se guarda.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveNow(false);
});
window.addEventListener('pagehide', () => saveNow(false));
$('save-now').addEventListener('click', () => saveNow(true));
$('save-export').addEventListener('click', () => {
  downloadWorld(scene().world);
  showToast('⬇ Partida exportada');
});
$('save-import').addEventListener('click', async () => {
  const text = await pickSaveFile();
  if (!text) return;
  try {
    parseSave(text);
  } catch (err) {
    showToast(`⚠️ ${err instanceof Error ? err.message : String(err)}`, 4000);
    return;
  }
  menu.hidden = true;
  scene().scene.restart({ seed, save: text });
  showToast('⬆ Partida cargada');
});
$('save-backup').addEventListener('click', () => {
  const text = readBackupSave();
  if (!text) {
    showToast('No hay copia anterior');
    return;
  }
  if (!window.confirm('¿Volver a la partida guardada anterior? Se pierde lo jugado desde entonces.')) return;
  menu.hidden = true;
  scene().scene.restart({ seed, save: text });
});
game.events.on('load-failed', (why: string) => {
  recordError('guardado', `No se pudo cargar la partida guardada: ${why}`);
  // Se aparta la partida que no se pudo leer para que el guardado automático no la pise.
  try {
    if (storedSave) localStorage.setItem('oxido.partida.fallida', storedSave);
  } catch {
    // sin sitio: nada que hacer
  }
  window.setTimeout(() => showToast(`⚠️ No se pudo cargar la partida guardada (${why}). Empieza un mapa nuevo; está apartada para poder recuperarla.`, 6000), 500);
});

// --- Inventario de la colonia ---------------------------------------------------
const inventory = $('inventory');
let inventoryKey = '';
game.events.on('inventory', (inv: Stockpile) => {
  const key = RESOURCES.map((r) => inv[r]).join(',');
  if (key === inventoryKey) return; // solo se rehace si cambia algo
  inventoryKey = key;
  // Los recursos básicos siempre; la comida y la fibra, solo si hay.
  inventory.replaceChildren(
    ...RESOURCES.filter((r) => BASE_RESOURCES.includes(r) || inv[r] > 0).map((r) => {
      const el = document.createElement('span');
      el.className = 'inv-item';
      el.title = RESOURCE_NAMES[r];
      el.textContent = `${RESOURCE_ICONS[r]} ${inv[r]}`;
      return el;
    }),
  );
});

// --- Órdenes, almacenes y construcción ----------------------------------------
const orderModes = $('order-modes');
const ordersBtn = $('orders-btn');
const buildModes = $('build-modes');
const buildBtn = $('build-btn');
const designHint = $('design-hint');
const shapeBtn = $<HTMLButtonElement>('build-shape');

// Un botón por construcción, con su coste, agrupados por tipo.
let lastCategory = '';
for (const def of BUILDINGS) {
  if (def.category !== lastCategory) {
    lastCategory = def.category;
    const h = document.createElement('div');
    h.className = 'build-group';
    h.textContent = BUILDING_CATEGORY_NAMES[def.category];
    buildModes.insertBefore(h, shapeBtn);
  }
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.mode = 'construir';
  b.dataset.build = def.id;
  const cost = RESOURCES.filter((r) => def.cost[r]).map((r) => `${RESOURCE_ICONS[r]}${def.cost[r]}`).join(' ');
  b.textContent = `${def.name} `;
  const n = document.createElement('span');
  n.className = 'n';
  n.textContent = cost;
  b.append(n);
  b.title = `${BUILDING_CATEGORY_NAMES[def.category]} · ${def.name} · coste ${cost}`;
  buildModes.insertBefore(b, shapeBtn);
}
const modeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('#order-modes button[data-mode], #build-modes button[data-mode]'));

const DESIGN_HINTS: Record<Exclude<DesignMode, null>, string> = {
  talar: 'Talar: arrastra sobre árboles, tocones y matorrales',
  minar: 'Picar: arrastra sobre rocas, piedras y muros',
  saquear: 'Saquear: arrastra sobre chatarra, coches, escombros y neumáticos',
  cancelar: 'Quitar: arrastra sobre las órdenes que quieras quitar',
  almacen: 'Almacén: arrastra para marcar la zona (empezando dentro de una, se amplía)',
  cultivo: 'Huerto: arrastra sobre tierra (mejor la oscura y húmeda); empezando dentro de uno, se amplía',
  rebajar: 'Rebajar: arrastra sobre las casillas que bajarán un nivel (sale piedra; la roca se pica)',
  elevar: 'Elevar: arrastra sobre las casillas que subirán un nivel',
  rampa: 'Rampa: arrastra sobre acantilados para convertirlos en pendiente (se podrán cruzar)',
  quitarAlmacen: 'Quitar zona: arrastra sobre las casillas de almacén o huerto que ya no quieras',
  construir: 'Construir',
  quitarPlano: 'Demoler: arrastra sobre construcciones (devuelven la mitad del material) o planos (todo lo llevado)',
};
function showMenu(which: 'orders' | 'build' | null): void {
  orderModes.hidden = which !== 'orders';
  buildModes.hidden = which !== 'build';
  ordersBtn.classList.toggle('active', which === 'orders');
  buildBtn.classList.toggle('active', which === 'build');
  if (!which) scene().setDesignMode(null);
}
ordersBtn.addEventListener('click', () => showMenu(orderModes.hidden ? 'orders' : null));
buildBtn.addEventListener('click', () => showMenu(buildModes.hidden ? 'build' : null));
for (const b of modeButtons) {
  b.addEventListener('click', () => {
    const s = scene();
    const mode = b.dataset.mode as Exclude<DesignMode, null>;
    if (mode === 'construir') {
      const id = b.dataset.build!;
      const same = s.designMode === 'construir' && s.buildDefId === id;
      s.buildDefId = id;
      // Muros en contorno (para cerrar cuartos); el resto, casilla a casilla.
      s.buildShape = buildingDef(id).category === 'muro' ? 'contorno' : 'relleno';
      s.setDesignMode(same ? null : 'construir');
      return;
    }
    // Volver a tocar el modo activo lo desactiva.
    s.setDesignMode(s.designMode === mode ? null : mode);
  });
}
shapeBtn.addEventListener('click', () => {
  const s = scene();
  s.buildShape = s.buildShape === 'contorno' ? 'relleno' : 'contorno';
  s.setDesignMode(s.designMode === 'construir' ? 'construir' : s.designMode);
});
game.events.on('design-mode', (mode: DesignMode) => {
  const s = scene();
  for (const b of modeButtons) {
    const on = b.dataset.mode === mode && (mode !== 'construir' || b.dataset.build === s.buildDefId);
    b.classList.toggle('active', on);
  }
  shapeBtn.textContent = s.buildShape === 'contorno' ? '▭ Forma: contorno' : '■ Forma: relleno';
  if (mode === 'construir' || mode === 'quitarPlano') {
    if (buildModes.hidden) showMenu('build');
  } else if (mode && orderModes.hidden) {
    showMenu('orders');
  }
  designHint.hidden = !mode;
  if (mode === 'construir') {
    const def = buildingDef(s.buildDefId);
    const how = s.buildShape === 'contorno' ? 'arrastra un rectángulo para su contorno (o una línea)' : 'arrastra o toca las casillas';
    designHint.textContent = `${def.name}: ${how} · solo en suelo llano y libre · dos dedos: mover la cámara`;
  } else if (mode) {
    designHint.textContent = `${DESIGN_HINTS[mode]} o toca una casilla · dos dedos: mover la cámara`;
  }
});
game.events.on('designations', (counts: Record<HarvestJob, number>) => {
  for (const b of modeButtons) {
    const n = b.querySelector('.n');
    const mode = b.dataset.mode as string;
    if (n && mode in counts) n.textContent = counts[mode as HarvestJob] > 0 ? String(counts[mode as HarvestJob]) : '';
  }
});
window.addEventListener('keydown', (e) => {
  const el = document.activeElement;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
  if (e.key === 't' || e.key === 'T') showMenu(orderModes.hidden ? 'orders' : null);
  if (e.key === 'b' || e.key === 'B') showMenu(buildModes.hidden ? 'build' : null);
});

// --- Panel de un huerto: qué se planta -------------------------------------------
const farmPanel = $('farm-panel');
const fpCrops = $('fp-crops');
$('fp-close').addEventListener('click', () => scene().selectFarm(null));
$('fp-delete').addEventListener('click', () => {
  const s = scene();
  if (s.selectedFarmId !== null) s.world.farms.delete(s.selectedFarmId);
  s.selectFarm(null);
});
game.events.on('farm-select', (f: GrowZone | null) => {
  farmPanel.hidden = !f;
  if (!f) return;
  $('fp-name').textContent = `🌱 ${f.name}`;
  $('fp-sub').textContent = `${f.tiles.size} casillas · los colonos siembran y cosechan solos (trabajo «cultivar»)`;
  fpCrops.replaceChildren(
    ...CROPS.map((crop) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'crop-btn';
      b.classList.toggle('active', f.crop.id === crop.id);
      const title = document.createElement('strong');
      title.textContent = `${RESOURCE_ICONS[crop.resource]} ${crop.name}`;
      const info = document.createElement('span');
      info.textContent = ` · ${crop.growDays} días · ${crop.yield[0]}–${crop.yield[1]} por casilla${crop.growsInDark ? ' · crece de noche' : ''} · ${crop.description}`;
      b.append(title, info);
      b.addEventListener('click', () => {
        scene().world.farms.setCrop(f.id, crop);
        scene().refreshFarm();
      });
      return b;
    }),
  );
});

// --- Panel de un almacén: prioridad y filtro -----------------------------------
const zonePanel = $('zone-panel');
const zpPriority = $('zp-priority');
const zpFilter = $('zp-filter');
$('zp-close').addEventListener('click', () => scene().selectZone(null));
$('zp-delete').addEventListener('click', () => {
  const s = scene();
  if (s.selectedZoneId !== null) s.world.zones.delete(s.selectedZoneId);
  s.selectZone(null);
});
game.events.on('zone-select', (z: StorageZone | null) => {
  zonePanel.hidden = !z;
  if (!z) return;
  $('zp-name').textContent = `📦 ${z.name}`;
  $('zp-sub').textContent = `${z.tiles.size} casillas · se llenan antes los de más prioridad`;
  zpPriority.replaceChildren(
    ...STORAGE_PRIORITIES.map((p) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = STORAGE_PRIORITY_NAMES[p];
      b.classList.toggle('active', z.priority === p);
      b.addEventListener('click', () => {
        scene().world.zones.setPriority(z.id, p);
        scene().refreshZone();
      });
      return b;
    }),
  );
  zpFilter.replaceChildren(
    ...RESOURCES.map((r) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = `${z.accepts[r] ? '☑' : '☐'} ${RESOURCE_ICONS[r]} ${RESOURCE_NAMES[r]}`;
      b.classList.toggle('active', z.accepts[r]);
      b.addEventListener('click', () => {
        scene().world.zones.setAccepts(z.id, r, !z.accepts[r]);
        scene().refreshZone();
      });
      return b;
    }),
  );
});

// --- Panel de una estación de trabajo (horno…): encender, parar y objetivo ------
const stationPanel = $('station-panel');
const spActive = $('sp-active');
const spTarget = $('sp-target');
$('sp-close').addEventListener('click', () => scene().selectStation(null));
$('sp-demolish').addEventListener('click', () => {
  const s = scene();
  const st = s.selectedStation;
  if (st) s.world.structures.markDemolish(st.x, st.y, !st.demolish);
  s.refreshStation();
});
game.events.on('station-select', (st: Structure | null) => {
  stationPanel.hidden = !st || !st.station || !st.def.recipe;
  if (!st || !st.station || !st.def.recipe) return;
  const r = st.def.recipe;
  const station = st.station;
  const icons = (cost: Partial<Record<(typeof RESOURCES)[number], number>>) =>
    RESOURCES.filter((k) => cost[k]).map((k) => `${RESOURCE_ICONS[k]}${cost[k]}`).join(' ');
  const have = scene().world.inventory()[r.output];
  $('sp-name').textContent = `🔥 ${st.def.name}`;
  $('sp-sub').textContent = `Hay ${have} de ${RESOURCE_NAMES[r.output].toLowerCase()} · lo hacen los colonos con el trabajo «fabricar»`;
  const loaded = icons(station.loaded);
  $('sp-recipe').textContent = `${r.name}: ${icons(r.input)} → ${RESOURCE_ICONS[r.output]}${r.amount}${loaded ? ` · cargado ${loaded}` : ''}`;
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.textContent = station.active ? '⏸ Parar' : `▶ ${r.verb.replace(/ndo$/, 'r')}`;
  toggle.classList.toggle('active', station.active);
  toggle.addEventListener('click', () => {
    scene().world.structures.setStation(st, !station.active, station.target);
    scene().refreshStation();
  });
  const state = document.createElement('span');
  state.className = 'muted';
  state.textContent = station.active ? (station.target && have >= station.target ? 'Objetivo cumplido: espera' : `${r.verb}…`) : 'Parado';
  spActive.replaceChildren(toggle, state);
  spTarget.replaceChildren(
    ...STATION_TARGETS.map((t) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = t === 0 ? '∞ Sin límite' : `${RESOURCE_ICONS[r.output]} ${t}`;
      b.classList.toggle('active', station.target === t);
      b.addEventListener('click', () => {
        scene().world.structures.setStation(st, station.active, t);
        scene().refreshStation();
      });
      return b;
    }),
  );
  $('sp-demolish').textContent = st.demolish ? '↶ No demoler' : '⛏ Demoler';
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
/** Tiempo de pulsación (ms) en la lista para añadir o quitar un colono de la selección. */
const LONG_PRESS_MS = 450;
function renderRoster(): void {
  roster.replaceChildren();
  const all = document.createElement('button');
  all.type = 'button';
  all.textContent = '👥';
  all.title = 'Elegir a todos (para mandarlos juntos o reclutarlos)';
  all.addEventListener('click', () => scene().selectAll());
  roster.append(all);
  for (const c of scene().world.colonists) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.id = String(c.id);
    b.title = 'Tocar: elegir · Mantener pulsado o Mayús+clic: añadir al grupo · Doble toque: centrar';
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = `#${c.look.shirt.toString(16).padStart(6, '0')}`;
    const flag = document.createElement('span');
    flag.className = 'draft-flag';
    b.append(dot, document.createTextNode(c.name), flag);
    let pressTimer = 0;
    let longPressed = false;
    b.addEventListener('pointerdown', () => {
      longPressed = false;
      pressTimer = window.setTimeout(() => {
        longPressed = true;
        scene().toggleSelect(c.id);
        navigator.vibrate?.(20);
      }, LONG_PRESS_MS);
    });
    const cancel = () => window.clearTimeout(pressTimer);
    b.addEventListener('pointerup', cancel);
    b.addEventListener('pointerleave', cancel);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    b.addEventListener('click', (e) => {
      if (longPressed) return;
      const s = scene();
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        s.toggleSelect(c.id);
        return;
      }
      if (s.selectedId === c.id && s.extraIds.size === 0) s.focus(c.id);
      s.select(c.id);
    });
    b.addEventListener('dblclick', () => scene().focus(c.id));
    roster.append(b);
  }
}
$('cp-draft').addEventListener('click', () => scene().toggleDraftSelected());

// --- Ficha del colono ------------------------------------------------------------
/** Texto de cada prioridad de trabajo (0 = no lo hace). */
const PRIORITY_LABELS = ['—', '1', '2', '3', '4'];
let lastPriorityKey = '';
/** Prioridades de trabajo del colono: tocar una cambia 1 → 2 → 3 → 4 → no → 1. */
function renderPriorities(c: Colonist): void {
  const key = `${c.id}:${WORK_TYPES.map((w) => c.priorities[w]).join('')}`;
  if (key === lastPriorityKey) return;
  lastPriorityKey = key;
  $('cp-work').replaceChildren(
    ...WORK_TYPES.map((w) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `prio prio-${c.priorities[w]}`;
      b.title = `${WORK_NAMES[w]}: prioridad ${c.priorities[w] || 'ninguna (no lo hace)'} · 1 es lo primero`;
      const name = document.createElement('span');
      name.textContent = WORK_NAMES[w];
      const val = document.createElement('strong');
      val.textContent = PRIORITY_LABELS[c.priorities[w]];
      b.append(name, val);
      b.addEventListener('click', () => {
        const next = ((c.priorities[w] + 1) % 5) as WorkPriority;
        c.priorities[w] = next;
        renderPriorities(c);
      });
      return b;
    }),
  );
}

const panel = $('colonist-panel');
$('cp-close').addEventListener('click', () => scene().select(null));
let lastPanelId: number | null = null;

let lastGroupKey = '';
game.events.on('selection', (c: Colonist | null, group: Colonist[] = c ? [c] : []) => {
  const ids = new Set(group.map((k) => k.id));
  for (const b of roster.querySelectorAll<HTMLButtonElement>('button[data-id]')) {
    const id = Number(b.dataset.id);
    b.classList.toggle('active', ids.has(id));
    const k = scene().world.colonists.find((q) => q.id === id);
    const flag = b.querySelector('.draft-flag');
    if (flag) flag.textContent = k?.drafted ? '🎖' : '';
  }
  if (!c) {
    panel.hidden = true;
    lastPanelId = null;
    return;
  }
  panel.hidden = false;
  const draftBtn = $('cp-draft');
  const allDrafted = group.every((k) => k.drafted);
  draftBtn.textContent = allDrafted ? '🏳 Liberar (G)' : '🎖 Reclutar (G)';
  draftBtn.classList.toggle('active', allDrafted);
  const groupKey = group.map((k) => k.id).join(',');
  if (group.length > 1) {
    // Grupo: nombre de todos y qué hacen; sin habilidades.
    panel.classList.add('group');
    $('cp-activity').textContent = group.map((k) => `${k.name}: ${activityLabel(k).toLowerCase()}`).join(' · ');
    if (lastGroupKey === groupKey) return;
    lastGroupKey = groupKey;
    lastPanelId = null;
    $('cp-name').textContent = `👥 ${group.length} colonos`;
    $('cp-sub').textContent = 'Toca el suelo para mandarlos juntos';
    $('cp-traits').replaceChildren();
    $('cp-skills').replaceChildren();
    $('cp-work').replaceChildren();
    return;
  }
  panel.classList.remove('group');
  lastGroupKey = groupKey;
  $('cp-activity').textContent = activityLabel(c);
  renderPriorities(c);
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

import Phaser from 'phaser';
import { WorldScene } from './render/WorldScene';
import { northLabel, Rotation } from './render/rotation';
import { DEFAULT_TILT, TILTS } from './render/projection';
import { seedFromString } from './sim/rng';
import { Colonist, activityLabel, WorkPriority } from './sim/colonist';
import { isFood, moodOf, STARVING } from './sim/needs';
import { WORK_NAMES, WORK_TYPES } from './data/work';
import { SKILLS, SKILL_NAMES } from './data/colonists';
import type { GameSpeed } from './sim/world';
import type { GameMap } from './sim/map';
import { checkWorld, ProgressMark } from './sim/diagnostics';
import { installErrorCapture, mountReportPanel, onNewError, recordError } from './ui/bugReport';
import { mountDevPanel } from './ui/devPanel';
import { mountPeople } from './ui/people';
import { mountMainMenu } from './ui/mainMenu';
import { mountGodMode } from './ui/godMode';
import { makePrisoner, offerWanderer, startRaid, startTrader } from './sim/people';
import { healthLabel } from './sim/health';
import { downloadWorld, pickSaveFile, readBackupSave, readStoredSave, storeWorld } from './ui/saveGame';
import { parseSave } from './sim/save';
import { reachableResources } from './sim/resources';
import { BASE_RESOURCES, HarvestJob, RESOURCE_ICONS, RESOURCE_NAMES, RESOURCES } from './data/resources';
import { isWeapon, WEAPON_IDS, WEAPONS } from './data/weapons';
import { CROPS } from './data/crops';
import { recipesFor } from './data/recipes';
import type { ResourceId } from './data/resources';
import type { Structure } from './sim/structures';
import type { GrowZone } from './sim/farming';
import { BUILDING_CATEGORY_NAMES, BuildingCategory, BUILDINGS, buildingDef } from './data/buildings';
import { STORAGE_PRIORITIES, STORAGE_PRIORITY_NAMES, StorageZone } from './sim/zones';
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
/** Última partida (texto) que se ha intentado cargar: si falla, se aparta esa. */
let lastLoadedText: string | null = storedSave;
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
// --- Vista 3D (en pruebas) ------------------------------------------------------
type View3DType = import('./render3d/View3D').View3D;
let view3d: View3DType | null = null;
const VIEW3D_KEY = 'oxido.vista3d';
const view3dBtn = $<HTMLButtonElement>('view3d-btn');
async function setView3D(on: boolean): Promise<void> {
  const s = scene();
  if (on && !view3d) {
    try {
      const mod = await import('./render3d/View3D');
      view3d = new mod.View3D($('game'), () => game.scene.getScene('world') as WorldScene);
      view3d.onContextLost = () => {
        recordError('error', 'La vista 3D perdió el contexto gráfico (falta de memoria gráfica); se vuelve a la 2D');
        void setView3D(false).then(() => (view3d = null)); // la próxima vez se crea de nuevo
        showToast('⚠️ La vista 3D se ha cerrado: el dispositivo se quedó sin memoria gráfica. Sigues en 2D.', 6000);
      };
    } catch (err) {
      recordError('error', `No se pudo abrir la vista 3D: ${err instanceof Error ? err.message : String(err)}`);
      showToast(`⚠️ No se pudo abrir la vista 3D: ${err instanceof Error ? err.message : String(err)}. ¿Está activada la aceleración por hardware del navegador?`, 7000);
      return;
    }
  }
  if (on) {
    view3d!.start();
    game.canvas.style.display = 'none';
    s.scene.setVisible(false);
    s.cameraKeysEnabled = false;
  } else {
    view3d?.stop();
    game.canvas.style.display = '';
    s.scene.setVisible(true);
    s.cameraKeysEnabled = true;
  }
  document.body.classList.toggle('mode-3d', on);
  $('view3d-quick').textContent = on ? '2D' : '3D';
  $('view3d-quick').classList.toggle('active', on);
  view3dBtn.innerHTML = on ? '<span class="mi">🗺</span><span>Vista 2D</span>' : '<span class="mi">🧊</span><span>Vista 3D</span>';
  try {
    localStorage.setItem(VIEW3D_KEY, on ? '1' : '0');
  } catch {
    // sin almacenamiento: no se recuerda
  }
}
$('view3d-quick').addEventListener('click', () => void setView3D(!view3d?.active));
game.events.on('request-3d', () => {
  if (view3d?.active) return;
  showToast('🧊 Vista 3D: mantén el botón central para pivotar', 2500);
  void setView3D(true);
});
view3dBtn.addEventListener('click', () => {
  menu.hidden = true;
  void setView3D(!view3d?.active);
});
window.setInterval(() => {
  if (view3d?.active) $('compass').textContent = `↑${view3d.compass()}`;
}, 250);

$('rot-left').addEventListener('click', () => (view3d?.active ? view3d.rotateBy(Math.PI / 4) : scene().rotate(-1)));
$('rot-right').addEventListener('click', () => (view3d?.active ? view3d.rotateBy(-Math.PI / 4) : scene().rotate(1)));
game.events.on('view-rotation', (r: Rotation) => ($('compass').textContent = `↑${northLabel(r)}`));
// El botón de inclinación recorre las inclinaciones, de mirar desde arriba a mirar de lado, y vuelve a empezar.
const tiltBtn = $('tilt-btn');
let tiltNow = DEFAULT_TILT;
tiltBtn.addEventListener('click', () => {
  if (view3d?.active) {
    view3d.tiltBy(0.25);
    return;
  }
  scene().setTiltLevel((tiltNow + 1) % TILTS.length);
});
game.events.on('view-tilt', (i: number) => {
  tiltNow = i;
  tiltBtn.title = `Inclinación: ${TILTS[i].name} (${i + 1}/${TILTS.length}) · R / F`;
  tiltBtn.textContent = `∠${i + 1}`;
});

// --- Menú --------------------------------------------------------------------
const menu = $('menu');
const menuBtn = $('menu-btn');
$('menu-btn').addEventListener('click', () => {
  menu.hidden = !menu.hidden;
  if (!menu.hidden) report.hidden = true;
});
$('menu-close').addEventListener('click', () => (menu.hidden = true));
// El botón ☰ se ve encendido mientras el menú está abierto (lo cierre quien lo cierre).
new MutationObserver(() => menuBtn.classList.toggle('active', !menu.hidden)).observe(menu, { attributes: true, attributeFilter: ['hidden'] });
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !menu.hidden) menu.hidden = true;
});
const devPanel = $('dev-panel');
$('dev-btn').addEventListener('click', () => {
  menu.hidden = true;
  report.hidden = true;
});
mountDevPanel(devPanel, $('dev-btn'));
function startNewMap(): void {
  seed = Math.floor(Math.random() * 1_000_000);
  menu.hidden = true;
  tile.textContent = '';
  scene().scene.restart({ seed });
}
$('new-map').addEventListener('click', () => {
  if (!window.confirm('¿Empezar un mapa nuevo? La partida actual se perderá (puedes exportarla antes con ⬇).')) return;
  startNewMap();
});

let view3dRestored = false;
game.events.on('map-ready', (map: GameMap) => {
  if (!view3dRestored) {
    view3dRestored = true;
    let want = false;
    try {
      want = localStorage.getItem(VIEW3D_KEY) === '1';
    } catch {
      // nada
    }
    if (want) void setView3D(true);
  }
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
  lastLoadedText = text;
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
  lastLoadedText = text;
  scene().scene.restart({ seed, save: text });
});
game.events.on('load-failed', (why: string) => {
  recordError('guardado', `No se pudo cargar la partida guardada: ${why}`);
  // Se aparta la partida que no se pudo leer para que el guardado automático no la pise.
  try {
    if (lastLoadedText) localStorage.setItem('oxido.partida.fallida', lastLoadedText);
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

// Un botón por construcción, con su coste, en pestañas por tipo.
const buildTabs = $('build-tabs');
const buildList = $('build-list');
let buildCategory: BuildingCategory = BUILDINGS[0].category;
const tabButtons = new Map<BuildingCategory, HTMLButtonElement>();
for (const def of BUILDINGS) {
  if (!tabButtons.has(def.category)) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.setAttribute('role', 'tab');
    tab.dataset.cat = def.category;
    tab.textContent = BUILDING_CATEGORY_NAMES[def.category];
    tab.addEventListener('click', () => setBuildCategory(def.category));
    buildTabs.append(tab);
    tabButtons.set(def.category, tab);
  }
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.mode = 'construir';
  b.dataset.build = def.id;
  b.dataset.cat = def.category;
  const cost = RESOURCES.filter((r) => def.cost[r]).map((r) => `${RESOURCE_ICONS[r]}${def.cost[r]}`).join(' ');
  const name = document.createElement('span');
  name.className = 'tl';
  name.textContent = `${def.name}${def.size ? ` ${def.size[0]}×${def.size[1]}` : ''}`;
  const n = document.createElement('span');
  n.className = 'n';
  n.textContent = cost;
  b.append(name, n);
  b.title = `${BUILDING_CATEGORY_NAMES[def.category]} · ${def.name} · coste ${cost}`;
  buildList.append(b);
}
function setBuildCategory(cat: BuildingCategory): void {
  buildCategory = cat;
  for (const [c, tab] of tabButtons) {
    tab.setAttribute('aria-selected', String(c === cat));
    tab.classList.toggle('active', c === cat);
  }
  for (const b of buildList.querySelectorAll<HTMLButtonElement>('button[data-cat]')) b.hidden = b.dataset.cat !== cat;
  tabButtons.get(cat)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
setBuildCategory(buildCategory);
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
  zanja: 'Zanja: arrastra para cavar una zanja (se cruza muy despacio: frena a los enemigos)',
  rellenar: 'Rellenar: arrastra sobre las zanjas que quieras tapar',
  quitarAlmacen: 'Quitar zona: arrastra sobre las casillas de almacén o huerto que ya no quieras',
  construir: 'Construir',
  quitarPlano: 'Demoler: arrastra sobre construcciones (devuelven la mitad del material) o planos (todo lo llevado)',
};
/**
 * En pantallas pequeñas (móvil en vertical u horizontal) la hoja tapa el mapa: al elegir una
 * herramienta se recoge a una barra con lo elegido, y ▴ o tocar la barra la vuelve a abrir.
 */
const smallScreen = window.matchMedia('(max-width: 600px), (max-height: 520px)');
function setCollapsed(sheet: HTMLElement, on: boolean): void {
  sheet.classList.toggle('collapsed', on);
}
function showMenu(which: 'orders' | 'build' | null): void {
  orderModes.hidden = which !== 'orders';
  buildModes.hidden = which !== 'build';
  setCollapsed(orderModes, false);
  setCollapsed(buildModes, false);
  ordersBtn.classList.toggle('active', which === 'orders');
  buildBtn.classList.toggle('active', which === 'build');
  if (!which) scene().setDesignMode(null);
}
for (const sheet of [orderModes, buildModes]) {
  sheet.querySelector('.ts-close')!.addEventListener('click', () => showMenu(null));
  sheet.querySelector('.ts-expand')!.addEventListener('click', () => setCollapsed(sheet, false));
  // Tocar la barra recogida (no sus botones) también la abre.
  sheet.querySelector('.sheet-head')!.addEventListener('click', (e) => {
    if (sheet.classList.contains('collapsed') && !(e.target as HTMLElement).closest('button')) setCollapsed(sheet, false);
  });
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
$('build-rot').addEventListener('click', () => rotateBuild());
// Con el dedo, lo que se va a construir espera a ✔ Colocar (o ✖) para que se vea antes dónde va.
const buildOk = $<HTMLButtonElement>('build-ok');
const buildCancel = $<HTMLButtonElement>('build-cancel');
buildOk.addEventListener('click', () => scene().confirmPendingBuild());
buildCancel.addEventListener('click', () => scene().cancelPendingBuild());
game.events.on('build-pending', (on: boolean) => {
  buildOk.hidden = !on;
  buildCancel.hidden = !on;
  shapeBtn.hidden = on;
  buildModes.querySelector<HTMLElement>('.ts-tools [data-mode="quitarPlano"]')!.hidden = on;
  if (on) designHint.textContent = '¿Aquí? ↻ para girar, toca otro sitio para moverlo · ✔ Colocar o ✖';
});
function rotateBuild(): void {
  const s = scene();
  s.buildRot = s.buildRot ? 0 : 1;
  s.refreshDesignPreview();
  showToast(`Construcción girada (${s.buildRot ? 'en vertical' : 'en horizontal'})`, 1000);
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
  shapeBtn.textContent = s.buildShape === 'contorno' ? '▭ Contorno' : '■ Relleno';
  if (mode === 'construir' || mode === 'quitarPlano') {
    if (buildModes.hidden) showMenu('build');
  } else if (mode && orderModes.hidden) {
    showMenu('orders');
  }
  if (mode === 'construir') {
    const cat = buildingDef(s.buildDefId).category;
    if (cat !== buildCategory) setBuildCategory(cat);
  }
  // Lo elegido, en la cabecera de la hoja (se ve también recogida).
  const active = modeButtons.find((b) => b.classList.contains('active'));
  const label = mode === 'construir' ? buildingDef(s.buildDefId).name : active?.querySelector('.tl')?.textContent ?? active?.textContent?.trim() ?? '';
  for (const sheet of [orderModes, buildModes]) {
    sheet.querySelector('.ts-current')!.textContent = mode && !sheet.hidden ? `· ${label}` : '';
    setCollapsed(sheet, !!mode && smallScreen.matches);
  }
  designHint.hidden = !mode;
  if (mode === 'construir') {
    const def = buildingDef(s.buildDefId);
    const how = s.buildShape === 'contorno' ? 'arrastra un rectángulo para su contorno (o una línea)' : 'arrastra o toca las casillas';
    const touchFirst = window.matchMedia('(pointer: coarse)').matches;
    designHint.textContent = `${def.name}: ${how}${touchFirst ? ', míralo y pulsa ✔ Colocar' : ''} · solo en suelo llano y libre · dos dedos: mover la cámara`;
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
  if (e.key === 'x' || e.key === 'X') rotateBuild();
  // R también gira lo que se va a construir (fuera del modo construir, R inclina la vista).
  if ((e.key === 'r' || e.key === 'R') && scene().designMode === 'construir') rotateBuild();
});

// --- Panel de un taller: qué fabricar y hasta cuánto ---------------------------
const stationPanel = $('station-panel');
$('sp-close').addEventListener('click', () => scene().selectStation(null));
/** Pasos del objetivo de una orden de fabricación. */
const TARGET_STEP = 5;
function renderStationStatus(s: Structure): void {
  const b = s.bill;
  const inv = scene().world.inventory();
  const inside = RESOURCES.filter((r) => (s.delivered[r] ?? 0) > 0).map((r) => `${RESOURCE_ICONS[r]}${s.delivered[r]}`).join(' ');
  if (!b) {
    $('sp-status').textContent = 'Sin orden: elige qué fabricar.';
    return;
  }
  const out = (Object.keys(b.recipe.outputs) as ResourceId[]).map((r) => `${RESOURCE_ICONS[r]} ${inv[r]}/${b.target}`).join(' ');
  const state = b.paused ? '⏸ En pausa' : (Object.keys(b.recipe.outputs) as ResourceId[]).every((r) => inv[r] >= b.target) ? '✔ Objetivo cumplido' : '⚙ Fabricando';
  $('sp-status').textContent = `${state} · tiene ${out}${inside ? ` · dentro: ${inside}` : ''}`;
}
game.events.on('station-tick', (s: Structure) => renderStationStatus(s));
game.events.on('station-select', (s: Structure | null) => {
  stationPanel.hidden = !s;
  if (!s) return;
  $('sp-name').textContent = `🛠 ${s.def.name}`;
  renderStationStatus(s);
  const list = $('sp-recipes');
  list.replaceChildren(
    ...recipesFor(s.def.id).map((r) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'crop-btn';
      b.classList.toggle('active', s.bill?.recipe.id === r.id);
      const fmt = (part: Partial<Record<ResourceId, number>>) =>
        (Object.entries(part) as [ResourceId, number][]).map(([res, n]) => `${RESOURCE_ICONS[res]}${n}`).join(' ');
      const title = document.createElement('strong');
      title.textContent = `${r.name}: ${fmt(r.inputs)} → ${fmt(r.outputs)}`;
      const info = document.createElement('span');
      info.textContent = ` · ${r.description}`;
      b.append(title, info);
      b.addEventListener('click', () => {
        const sc = scene();
        sc.world.structures.setBill(s, s.bill?.recipe.id === r.id ? null : { recipe: r, target: s.bill?.target ?? 20, paused: false });
        sc.refreshStation();
      });
      return b;
    }),
  );
  const ctl = $('sp-controls');
  ctl.hidden = !s.bill;
  if (s.bill) $('sp-target').textContent = `Hasta tener ${s.bill.target}`;
  $('sp-pause').textContent = s.bill?.paused ? '▶ Reanudar' : '⏸ Pausar';
});
$('sp-minus').addEventListener('click', () => {
  const s = scene().selectedStation;
  if (s?.bill) s.bill.target = Math.max(0, s.bill.target - TARGET_STEP);
  scene().refreshStation();
});
$('sp-plus').addEventListener('click', () => {
  const s = scene().selectedStation;
  if (s?.bill) s.bill.target += TARGET_STEP;
  scene().refreshStation();
});
$('sp-pause').addEventListener('click', () => {
  const s = scene().selectedStation;
  if (s?.bill) s.bill.paused = !s.bill.paused;
  scene().refreshStation();
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
// Aviso de hambre: si alguien se muere de hambre y no queda comida.
let lastHungerWarning = 0;
window.setInterval(() => {
  const s = game.scene.getScene('world') as WorldScene | null;
  if (!s || !s.world || s.world.speed === 0 || Date.now() - lastHungerWarning < 60_000) return;
  const inv = s.world.inventory();
  const food = RESOURCES.filter(isFood).reduce((a, r) => a + inv[r], 0);
  const starving = s.world.colonists.filter((c) => c.needs.food < STARVING);
  if (starving.length && food === 0) {
    lastHungerWarning = Date.now();
    showToast(`⚠️ ${starving.map((c) => c.name).join(', ')} pasa${starving.length > 1 ? 'n' : ''} hambre y no queda comida: haz un huerto 🌱`, 5000);
  }
}, 5000);

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

// --- Gente: diario, prisioneros, comercio, supervivientes y fin de partida -------------
const people = mountPeople({
  getWorld: () => (game.scene.getScene('world') as WorldScene | null)?.world ?? null,
  toast: (text, ms) => showToast(text, ms),
  newGame: () => startNewMap(),
  focus: (x, y) => {
    scene().focusTile(x, y);
    view3d?.lookAt(x + 0.5, y + 0.5);
  },
});
game.events.on('pawn-tap', (c: Colonist) => people.openFor(c));

// --- Modo Dios y menú principal ------------------------------------------------------
const GOD_KEY = 'oxido.dios';
let godOn = false;
try {
  godOn = localStorage.getItem(GOD_KEY) === '1';
} catch {
  // sin almacenamiento: empieza desactivado
}
const currentWorld = () => (game.scene.getScene('world') as WorldScene | null)?.world ?? null;
const god = mountGodMode({
  getWorld: currentWorld,
  setTap: (fn) => {
    const s = game.scene.getScene('world') as WorldScene | null;
    if (s) s.godTap = fn;
  },
  toast: (text, ms) => showToast(text, ms),
});
function setGod(on: boolean): void {
  godOn = on;
  try {
    localStorage.setItem(GOD_KEY, on ? '1' : '0');
  } catch {
    // nada
  }
  god.setEnabled(on);
}
god.setEnabled(godOn);
const mainMenu = mountMainMenu({
  getWorld: currentWorld,
  newGame: ({ seed: s, colonists, events, difficulty }) => {
    seed = s;
    menu.hidden = true;
    tile.textContent = '';
    scene().scene.restart({ seed: s, colonists, events, difficulty });
  },
  importSave: () => $('save-import').click(),
  showProgress: () => $('dev-btn').click(),
  setGod,
  isGod: () => godOn,
});
$('main-menu-btn').addEventListener('click', () => {
  menu.hidden = true;
  mainMenu.open();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && mainMenu.isOpen) mainMenu.close();
});
// Al abrir el juego, primero el menú principal (con la partida en pausa detrás).
if (currentWorld()) mainMenu.open();
else game.events.once('map-ready', () => window.setTimeout(() => mainMenu.open(), 0));
// Para las pruebas automáticas (scripts/smoke.mjs): provocar sucesos sin esperar días.
(window as unknown as { oxidoPrueba: unknown }).oxidoPrueba = {
  raid: (n = 2) => startRaid(scene().world, n),
  caravana: () => startTrader(scene().world),
  superviviente: () => offerWanderer(scene().world),
  prisionero: () => {
    const w = scene().world;
    const [r] = startRaid(w, 1);
    if (r) makePrisoner(r, 0.6);
    return r?.name;
  },
  abrirGente: (c: Colonist) => people.openFor(c),
};

// --- Lista de colonos ----------------------------------------------------------
const roster = $('roster');
// Llegan colonos nuevos (supervivientes, prisioneros convencidos) o mueren: se rehace la lista.
let rosterKey = '';
window.setInterval(() => {
  const s = game.scene.getScene('world') as WorldScene | null;
  if (!s || !s.world) return;
  const key = s.world.colonists.map((c) => c.id).join(',');
  if (key === rosterKey) return;
  const first = rosterKey === '';
  rosterKey = key;
  if (!first) {
    renderRoster();
    s.refreshSelection();
  }
}, 500);
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
    let downX = 0;
    b.addEventListener('pointerdown', (e) => (downX = e.clientX));
    b.addEventListener('pointerup', cancel);
    b.addEventListener('pointerleave', cancel);
    // Al deslizar la lista (móvil) no cuenta como pulsación larga.
    b.addEventListener('pointercancel', cancel);
    b.addEventListener('pointermove', (e) => {
      if (Math.abs(e.clientX - downX) > 8) cancel();
    });
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    b.addEventListener('click', (e) => {
      if (longPressed) return;
      const s = scene();
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        s.toggleSelect(c.id);
        return;
      }
      if (s.selectedId === c.id && s.extraIds.size === 0) {
        s.focus(c.id);
        view3d?.lookAt(c.pos.x, c.pos.y);
      }
      s.select(c.id);
    });
    b.addEventListener('dblclick', () => scene().focus(c.id));
    roster.append(b);
  }
}
$('cp-draft').addEventListener('click', () => scene().toggleDraftSelected());

// Arma del colono: la mejor libre (sola), una concreta o ninguna.
const weaponSelect = $<HTMLSelectElement>('cp-weapon');
weaponSelect.append(
  new Option('Arma: la mejor libre', 'auto'),
  new Option('Sin arma', 'ninguna'),
  ...WEAPON_IDS.map((id) => new Option(`Solo ${RESOURCE_NAMES[id].toLowerCase()}`, id)),
);
let weaponPawnId: number | null = null;
weaponSelect.addEventListener('change', () => {
  const w = scene().world;
  const c = w.colonists.find((k) => k.id === weaponPawnId);
  const v = weaponSelect.value;
  if (c && (v === 'auto' || v === 'ninguna' || isWeapon(v))) w.setWeaponChoice(c, v);
});
function renderWeapon(c: Colonist): void {
  weaponPawnId = c.id;
  const def = c.weapon ? WEAPONS[c.weapon] : null;
  const ammo = def?.ammo ? ` · ${RESOURCE_ICONS.flechas} ${c.ammo}` : '';
  $('cp-weapon-now').textContent = c.weapon
    ? `${RESOURCE_ICONS[c.weapon]} ${RESOURCE_NAMES[c.weapon]} (×${String(def!.damage).replace('.', ',')}, ${def!.speedLabel}${def!.reach > 1 ? `, alcance ${def!.reach}` : ''})${ammo}`
    : '✊ Sin arma (puños)';
  if (document.activeElement !== weaponSelect) weaponSelect.value = c.weaponChoice;
}

// --- Ficha del colono ------------------------------------------------------------
/** Barras de comida, descanso y ánimo, con los motivos del ánimo. */
function renderNeeds(c: Colonist): void {
  const { mood, reasons } = moodOf(c, scene().world.tick);
  const bars: [string, number, string][] = [
    ['Comida', c.needs.food, '#c8a040'],
    ['Agua', c.needs.water, '#5aa0c8'],
    ['Descanso', c.needs.rest, '#6fa8dc'],
    ['Ánimo', mood, '#8fc060'],
  ];
  $('cp-needs').replaceChildren(
    ...bars.map(([name, v, color]) => {
      const row = document.createElement('div');
      row.className = 'need';
      const label = document.createElement('span');
      label.textContent = name;
      const bar = document.createElement('div');
      bar.className = 'bar';
      const fill = document.createElement('span');
      fill.style.width = `${Math.round(v * 100)}%`;
      fill.style.background = v < 0.25 ? '#d9534f' : color;
      bar.append(fill);
      const pct = document.createElement('span');
      pct.className = 'num';
      pct.textContent = `${Math.round(v * 100)}`;
      row.append(label, bar, pct);
      return row;
    }),
  );
  $('cp-mood').textContent = reasons.map((r) => `${r.value > 0 ? '+' : '−'} ${r.text}`).join(' · ');
}

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
    lastPriorityKey = '';
    lastGroupKey = '';
    return;
  }
  // Al abrirse la ficha, los menús de órdenes se cierran para no taparse en el móvil
  // (solo al abrirse: luego se pueden volver a abrir con la ficha a la vista).
  if (panel.hidden && (!orderModes.hidden || !buildModes.hidden)) showMenu(null);
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
    lastPriorityKey = '';
    return;
  }
  panel.classList.remove('group');
  lastGroupKey = groupKey;
  $('cp-activity').textContent = activityLabel(c);
  $('cp-health').textContent = c.wounds.length || c.health < 0.999
    ? `❤ ${healthLabel(c)} (${Math.round(c.health * 100)} %)${c.wounds.length ? ` · heridas: ${c.wounds.map((w) => `${w.part}${w.bleeding ? ' 🩸' : ''}`).join(', ')}` : ''}`
    : '';
  renderNeeds(c);
  renderWeapon(c);
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

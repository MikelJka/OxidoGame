import { TICKS_PER_HOUR } from './sim/time';
import { VOLUME_STEPS } from './audio/sound';
import { setTarget, targetOf, tileTemp } from './sim/climate';
import { roofed } from './sim/roofs';
import Phaser from 'phaser';
import { WorldScene } from './render/WorldScene';
import { northLabel, Rotation } from './render/rotation';
import { DEFAULT_TILT, TILTS } from './render/projection';
import { graphicsQuality, nextGraphicsQuality, setGraphicsQuality } from './render/graphics';
import { seedFromString } from './sim/rng';
import { Colonist, activityLabel, groupSummary, Stance, WorkPriority } from './sim/colonist';
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
import { mountTutorial, tutorialWanted } from './ui/tutorial';
import { mountGodMode } from './ui/godMode';
import { makePrisoner, offerWanderer, startRaid, startTrader } from './sim/people';
import { healthLabel, infectionLabel } from './sim/health';
import { downloadWorld, pickSaveFile, readBackupSave, readStoredSave, storeWorld } from './ui/saveGame';
import { mountCloudSync } from './ui/cloudSync';
import { parseSave } from './sim/save';
import { finishBattle, retreat, startExpedition, updateExpedition } from './sim/expedition';
import { reachableResources } from './sim/resources';
import { BASE_RESOURCES, HarvestJob, RESOURCE_ICONS, RESOURCE_NAMES, RESOURCES } from './data/resources';
import { isWeapon, WEAPON_IDS, WEAPONS } from './data/weapons';
import { armorProtection } from './data/armor';
import { CROPS } from './data/crops';
import { recipesFor } from './data/recipes';
import { RESEARCH_BENCH, researchDef, researchNeeds } from './data/research';
import { missingResearch, researchFraction } from './sim/research';
import type { ResourceId } from './data/resources';
import { billPending, type Structure } from './sim/structures';
import { occupant, VEHICLE_SEATS, type Vehicle, type VehicleSeat } from './sim/vehicles';
import { usesFuel, vehicleDef } from './data/vehicles';
import type { GrowZone } from './sim/farming';
import { cycleTrayCrop, trayBlocked, trayCrop } from './sim/hydroponics';
import { BUILDING_CATEGORY_NAMES, BuildingCategory, BUILDINGS, buildingDef, kitOf } from './data/buildings';
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
  checkBattleSwitch();
  // La bandeja hidropónica abierta: su % va subiendo.
  if (selectedPiece?.def.hydroponics) renderPiece();
});

// --- Batallas en las bases de las facciones ------------------------------------
// Al llegar una expedición se abre el mapa de batalla; al acabar se vuelve a la colonia.
const battleBar = document.createElement('div');
battleBar.id = 'battle-bar';
battleBar.hidden = true;
const battleText = document.createElement('span');
const retreatBtn = document.createElement('button');
retreatBtn.type = 'button';
retreatBtn.textContent = '🏳 Retirarse';
retreatBtn.title = 'Volver a casa con los heridos (sin botín)';
retreatBtn.addEventListener('click', () => {
  const w = scene().world;
  if (w.battle) retreat(w);
});
battleBar.append(battleText, retreatBtn);
document.body.append(battleBar);

function checkBattleSwitch(): void {
  const sc = scene();
  const w = sc.world;
  if (!w) return;
  if (!w.battle && w.pendingBattle) {
    const b = w.pendingBattle;
    w.pendingBattle = null;
    sc.scene.restart({ seed: b.map.seed, world: b });
    showToast('⚔️ ¡Empieza la batalla!', 2500);
    return;
  }
  if (w.battle) {
    const foes = w.others.filter((o) => o.role === 'saqueador' && !o.downed && !o.raider?.fleeing).length;
    battleText.textContent = `⚔️ Batalla · quedan ${foes} defensores`;
    battleBar.hidden = false;
    if (w.battle.result) {
      const r = w.battle.result;
      const home = finishBattle(w);
      battleBar.hidden = true;
      sc.scene.restart({ seed: home.map.seed, world: home });
      showToast(r === 'victoria' ? '🏚 ¡Victoria! La base ha caído' : r === 'derrota' ? '☠ Derrota: los vuestros vuelven a casa' : '🏳 Os retiráis', 3000);
    }
  } else battleBar.hidden = true;
}

// --- Giro de la vista -------------------------------------------------------
/** Marca, en esta pestaña, de que se recargó sola para coger una versión nueva. */
const RELOAD_KEY = 'oxido.recargaVersion';
/** true si esta carga viene de una recarga automática por versión nueva (hace menos de un minuto). */
function cameFromVersionReload(): boolean {
  try {
    return Date.now() - Number(sessionStorage.getItem(RELOAD_KEY) ?? 0) < 60_000;
  } catch {
    return false;
  }
}
$('rot-left').addEventListener('click', () => scene().rotate(-1));
$('rot-right').addEventListener('click', () => scene().rotate(1));
game.events.on('view-rotation', (r: Rotation) => ($('compass').textContent = `↑${northLabel(r)}`));
// El botón de inclinación recorre las inclinaciones, de mirar desde arriba a mirar de lado, y vuelve a empezar.
const tiltBtn = $('tilt-btn');
let tiltNow = DEFAULT_TILT;
tiltBtn.addEventListener('click', () => {
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
  if (!menu.hidden) {
    report.hidden = true;
    $('people-panel').hidden = true;
  }
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
  if (tutorialWanted()) tutorial.startOnNextMap();
  menu.hidden = true;
  tile.textContent = '';
  scene().scene.restart({ seed });
}
$('new-map').addEventListener('click', () => {
  if (!window.confirm('¿Empezar un mapa nuevo? La partida actual se perderá (puedes exportarla antes con ⬇).')) return;
  startNewMap();
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
  tutorial.mapReady(seed);
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
// Partida en la nube (☰ → ☁ Nube): la misma partida en varios dispositivos.
mountCloudSync({
  saveLocal: () => {
    saveNow(false);
    return saveError ? null : readStoredSave();
  },
  label: () => {
    const w = scene().world;
    return `${w.clockLabel()} · ${w.colonists.length} ${w.colonists.length === 1 ? 'colono' : 'colonos'}`;
  },
  loadText: (text) => {
    try {
      parseSave(text);
    } catch (err) {
      showToast(`⚠️ ${err instanceof Error ? err.message : String(err)}`, 5000);
      return;
    }
    menu.hidden = true;
    lastLoadedText = text;
    scene().scene.restart({ seed, save: text });
  },
  toast: (msg, ms) => showToast(msg, ms),
  onError: (msg) => recordError('guardado', msg),
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
  b.dataset.name = name.textContent;
  b.title = `${BUILDING_CATEGORY_NAMES[def.category]} · ${def.name} · coste ${cost}`;
  if (def.research) b.title += ` · pide investigar ${researchNeeds(def).map((q) => `«${researchDef(q)?.name}»`).join(' y ')}`;
  if (def.turret) b.title += ` · gasta ${-(def.power ?? 0)} W · con corriente dispara sola a ${def.turret.reach} casillas, sin munición`;
  if (def.platform) b.title += ` · solo sobre el agua${def.platform.deepWater ? ' (también la profunda)' : ' poco profunda o normal'}; encima se construye como en tierra (menos huertos)`;
  if (def.onWater && def.vehicle) {
    const vd = vehicleDef(def.vehicle);
    const motor = !!vd && usesFuel(vd);
    b.title += ` · se construye en el agua (poco profunda o normal); va solo por el agua, ${(vd?.speed ?? 1) < 1 ? 'más despacio que andando' : 'más rápido que andando'}, con 2 colonos: ${motor ? `uno conduce (gasta ${vd!.fuelPerHour} ⛽ cada hora en marcha) y el otro dispara` : 'uno rema y el otro dispara'}${vd && vd.armor > 0 ? ` · blindaje −${Math.round(vd.armor * 100)} %` : ''}`;
  }
  else if (def.onWater) b.title += ` · solo en un río (agua poco profunda o normal); da ${def.power ?? 0} W fijos, de día y de noche`;
  if (def.drawbridge) b.title += ` · ${def.size?.[0] ?? 1}×${def.size?.[1] ?? 1} sobre el agua (puede apoyarse en la orilla) · gasta ${-(def.power ?? 0)} W · bajado se cruza andando; alzado no pasa nadie · con corriente se alza solo ante un raid; tócalo para alzarlo o bajarlo a mano`;
  if (def.bridge) b.title += ` · solo sobre el agua (se cruza andando); en el agua profunda cuesta ×${def.bridge.deepCostMultiplier}`;
  if (def.stunSeconds) b.title += ` · gasta ${-(def.power ?? 0)} W · con corriente aturde ${def.stunSeconds} s a quien la pisa`;
  buildList.append(b);
}
function setBuildCategory(cat: BuildingCategory): void {
  buildCategory = cat;
  for (const [c, tab] of tabButtons) {
    tab.setAttribute('aria-selected', String(c === cat));
    tab.classList.toggle('active', c === cat);
  }
  for (const b of buildList.querySelectorAll<HTMLButtonElement>('button[data-cat]')) b.hidden = b.dataset.cat !== cat;
  refreshBuildLocks();
  tabButtons.get(cat)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
/** Lo que aún pide investigación sale con 🔒 (se puede tocar para ver qué falta). */
function refreshBuildLocks(): void {
  const w = (game.scene.getScene('world') as WorldScene | null)?.world;
  for (const b of buildList.querySelectorAll<HTMLButtonElement>('button[data-build]')) {
    const kits = w ? w.freeKits(b.dataset.build!) : 0;
    const locked = !!w && !w.canBuild(b.dataset.build!) && kits <= 0;
    b.classList.toggle('locked', locked);
    // Con kits en el almacén se monta con ellos (sin material).
    b.querySelector('.tl')!.textContent = `${locked ? '🔒 ' : ''}${b.dataset.name}${kits > 0 ? ` · 📦${kits}` : ''}`;
  }
}
setBuildCategory(buildCategory);
// Primeros pasos: guía opcional al empezar partida nueva (src/ui/tutorial.ts).
const tutorial = mountTutorial({
  getWorld: () => (game.scene.getScene('world') as WorldScene | null)?.world ?? null,
  buildCategory: () => buildCategory,
});
// La primera vez que se abre el juego (sin partida guardada), el primer mapa también lleva la guía.
if (!wantsNew && !storedSave && tutorialWanted()) tutorial.startOnNextMap();
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
  mover: 'Mover',
  seleccionar: 'Elegir varios: arrastra un recuadro sobre los colonos (o sobre saqueadores y visitantes para ver su resumen)',
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
buildBtn.addEventListener('click', () => {
  if (buildModes.hidden) refreshBuildLocks();
  showMenu(buildModes.hidden ? 'build' : null);
});
for (const b of modeButtons) {
  b.addEventListener('click', () => {
    const s = scene();
    const mode = b.dataset.mode as Exclude<DesignMode, null>;
    if (mode === 'construir') {
      const id = b.dataset.build!;
      const def = buildingDef(id);
      if (!s.world.canBuild(id) && s.world.freeKits(id) <= 0) {
        showToast(`🔒 ${def.name}: antes hay que investigar «${missingResearch(s.world.research, def)?.name}» en 📜 → 🔬 Investigación`, 3500);
        return;
      }
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
// ✖ quita la vista previa y sale del modo construir (como el clic derecho en el PC).
buildCancel.addEventListener('click', () => scene().setDesignMode(null));
game.events.on('build-pending', (on: boolean) => {
  buildOk.hidden = !on;
  buildCancel.hidden = !on;
  shapeBtn.hidden = on;
  buildModes.querySelector<HTMLElement>('.ts-tools [data-mode="quitarPlano"]')!.hidden = on;
  if (on) designHint.textContent = '¿Aquí? ↻ para girar, toca otro sitio para moverlo · ✔ Colocar o ✖ para dejar de construir';
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
  if (mode === 'construir' || mode === 'quitarPlano' || mode === 'mover') {
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
  const label = mode === 'construir' ? buildingDef(s.buildDefId).name : mode === 'mover' ? `✋ Mover ${buildingDef(s.buildDefId).name.toLowerCase()}` : active?.querySelector('.tl')?.textContent ?? active?.textContent?.trim() ?? '';
  for (const sheet of [orderModes, buildModes]) {
    sheet.querySelector('.ts-current')!.textContent = mode && !sheet.hidden ? `· ${label}` : '';
    setCollapsed(sheet, !!mode && smallScreen.matches);
  }
  designHint.hidden = !mode;
  if (mode === 'construir') {
    const def = buildingDef(s.buildDefId);
    const how = s.buildShape === 'contorno' ? 'arrastra un rectángulo para su contorno (o una línea)' : 'arrastra o toca las casillas';
    const touchFirst = window.matchMedia('(pointer: coarse)').matches;
    designHint.textContent = `${def.name}: ${how}${touchFirst ? ', míralo y pulsa ✔ Colocar (✖ para salir)' : ' · clic derecho: cancelar'} · solo en suelo llano y libre · dos dedos: mover la cámara`;
  } else if (mode === 'mover') {
    const touchFirst = window.matchMedia('(pointer: coarse)').matches;
    designHint.textContent = `✋ ${buildingDef(s.buildDefId).name}: toca dónde llevarlo (↻ para girarlo)${touchFirst ? ', míralo y pulsa ✔ Colocar (✖ para salir)' : ' · clic derecho: cancelar'}`;
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
  if ((e.key === 'r' || e.key === 'R') && scene().placing) rotateBuild();
});

// --- Paneles de almacén, taller y huerto: hojas con cabecera, cuerpo y pie fijos -----
/** Elemento con clase y texto. */
function mk<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}
const fmtRes = (part: Partial<Record<ResourceId, number>>) =>
  (Object.entries(part) as [ResourceId, number][]).map(([res, n]) => `${RESOURCE_ICONS[res]}${n}`).join(' ');

/** Prepara ▾ (recoger: solo queda la cabecera, para ver el mapa) en una hoja de lugar. */
function setupFold(panel: HTMLElement, foldId: string): void {
  const fold = $<HTMLButtonElement>(foldId);
  const set = (folded: boolean) => {
    panel.classList.toggle('folded', folded);
    fold.textContent = folded ? '▴' : '▾';
    fold.title = folded ? 'Desplegar' : 'Recoger';
    fold.setAttribute('aria-label', fold.title);
  };
  fold.addEventListener('click', () => set(!panel.classList.contains('folded')));
  // Recogida, tocar el título la vuelve a abrir.
  panel.querySelector('.ps-title')?.addEventListener('click', () => {
    if (panel.classList.contains('folded')) set(false);
  });
  (panel as HTMLElement & { unfold?: () => void }).unfold = () => set(false);
}
function unfold(panel: HTMLElement): void {
  (panel as HTMLElement & { unfold?: () => void }).unfold?.();
}

/** Botón de borrar que pide un segundo toque antes de hacerlo. */
function setupConfirmDelete(id: string, label: string, onConfirm: () => void): () => void {
  const btn = $<HTMLButtonElement>(id);
  let timer = 0;
  const reset = () => {
    window.clearTimeout(timer);
    btn.classList.remove('confirm');
    btn.textContent = label;
  };
  btn.addEventListener('click', () => {
    if (!btn.classList.contains('confirm')) {
      btn.classList.add('confirm');
      btn.textContent = '¿Seguro? Toca otra vez para borrar';
      timer = window.setTimeout(reset, 3000);
      return;
    }
    reset();
    onConfirm();
  });
  return reset;
}

// --- Taller: qué fabricar y hasta cuánto ---------------------------------------
const stationPanel = $('station-panel');
setupFold(stationPanel, 'sp-fold');
$('sp-close').addEventListener('click', () => scene().selectStation(null));
function renderStationStatus(s: Structure): void {
  const b = s.bill;
  const inv = scene().world.inventory();
  const inside = RESOURCES.filter((r) => (s.delivered[r] ?? 0) > 0).map((r) => `${RESOURCE_ICONS[r]}${s.delivered[r]}`).join(' ');
  if (!b) {
    $('sp-status').textContent = 'Sin orden: elige qué fabricar';
    return;
  }
  const outs = Object.keys(b.recipe.outputs) as ResourceId[];
  const dentro = inside ? ` · dentro: ${inside}` : '';
  if (b.mode === 'count') {
    const have = outs.map((r) => `${RESOURCE_ICONS[r]} ${inv[r]}`).join(' ');
    const state = s.upgrade ? '⚡ Electrificando' : b.target <= 0 ? '✔ Hecho' : b.paused ? '⏸ En pausa' : '⚙ Fabricando';
    const left = b.target > 0 ? `faltan ${b.target}` : 'pide más con +';
    $('sp-status').textContent = `${state} · ${b.recipe.name}: ${left} (tienes ${have})${dentro}`;
    return;
  }
  const out = outs.map((r) => `${RESOURCE_ICONS[r]} ${inv[r]}/${b.target}`).join(' ');
  const state = s.upgrade ? '⚡ Electrificando' : b.paused ? '⏸ En pausa' : billPending(b, inv) ? '⚙ Fabricando' : '✔ Objetivo cumplido';
  $('sp-status').textContent = `${state} · ${b.recipe.name}: tienes ${out}${dentro}`;
}
/** Electrificar: botón y estado (con corriente, el doble de rápido; sin ella, normal). */
function renderStationPower(s: Structure): void {
  const e = s.def.electrify;
  const box = $('sp-power');
  box.hidden = !e;
  if (!e) return;
  const w = scene().world;
  const text = $('sp-power-text');
  const go = $<HTMLButtonElement>('sp-electrify');
  const cancel = $<HTMLButtonElement>('sp-electrify-cancel');
  box.classList.toggle('on', !!s.electric);
  go.hidden = !w.structures.canElectrify(s);
  cancel.hidden = !s.upgrade;
  if (s.electric) {
    const net = w.powerNetOf(s);
    text.textContent = !net
      ? `⚡ Eléctrico (${e.power} W) · sin cable: va a velocidad normal. Conéctalo con un cable a un generador.`
      : s.powered
        ? `⚡ Eléctrico (${e.power} W) · con corriente: trabaja el doble de rápido`
        : `⚡ Eléctrico (${e.power} W) · la red no da para él: va a velocidad normal`;
  } else if (s.upgrade) {
    const got = (Object.keys(e.cost) as ResourceId[]).map((r) => `${RESOURCE_ICONS[r]}${s.upgrade!.delivered[r] ?? 0}/${e.cost[r]}`).join(' ');
    text.textContent = `⚡ Electrificando (trabajo «construir»): ${got} · obra ${Math.min(100, Math.floor((s.upgrade.progress / e.work) * 100))} %. Mientras, no fabrica.`;
  } else {
    go.textContent = `⚡ Electrificar · ${fmtRes(e.cost)}`;
    text.textContent = `Mejora: con corriente (${e.power} W) trabaja el doble de rápido; sin ella, a velocidad normal (nunca se para).`;
  }
}
$('sp-electrify').addEventListener('click', () => {
  const sc = scene();
  const s = sc.selectedStation;
  if (s && sc.world.structures.orderElectrify(s)) sc.refreshStation();
});
$('sp-electrify-cancel').addEventListener('click', () => {
  const sc = scene();
  const s = sc.selectedStation;
  if (s?.upgrade) sc.world.cancelElectrify(s);
  sc.refreshStation();
});
game.events.on('station-tick', (s: Structure) => {
  renderStationStatus(s);
  renderStationPower(s);
  renderStationMove(s);
});
/** Fila «✋ Mover» del taller: solo si se mueve (sin electrificar). */
function renderStationMove(s: Structure): void {
  const movable = !!s.def.movable && !s.electric && !s.upgrade;
  $('sp-move-row').hidden = !movable;
  $('sp-move').hidden = !!s.moveTo;
  $('sp-unmove').hidden = !s.moveTo;
}
$('sp-move').addEventListener('click', () => {
  const sc = scene();
  if (sc.selectedStation) sc.startMove(sc.selectedStation);
});
$('sp-unmove').addEventListener('click', () => {
  const sc = scene();
  const s = sc.selectedStation;
  if (s) sc.world.cancelMoveStructure(s.id);
  sc.refreshStation();
});

// --- Muebles: panel con «✋ Mover» (camas, armarios, estanterías, armeros, lámparas) -----
const piecePanel = $('piece-panel');
let selectedPiece: Structure | null = null;
function renderPiece(): void {
  const s = selectedPiece;
  piecePanel.hidden = !s;
  if (!s) return;
  $('pc-name').textContent = s.def.name;
  const raise = $('pc-raise');
  raise.hidden = !s.def.drawbridge;
  $('pc-crop').hidden = !s.def.hydroponics;
  $('pc-cooler').hidden = !s.def.climate;
  $('pc-warmer').hidden = !s.def.climate;
  if (s.def.hydroponics) {
    // Bandeja hidropónica: qué cultiva, cómo va y por qué no crece (si no crece).
    const w = scene().world;
    const crop = trayCrop(s);
    const why = trayBlocked(w, s);
    $('pc-status').textContent = `🌱 ${crop?.name ?? '—'} · ${Math.floor((s.growth ?? 0) * 100)} %${why ? ` · ⛔ ${why}` : ` · crece ×${s.def.hydroponics.speed} y deja la cosecha al lado`}`;
    $('pc-move').hidden = true;
    $('pc-unmove').hidden = true;
    $('pc-pack').hidden = true;
    $('pc-unpack').hidden = true;
    return;
  }
  if (s.def.drawbridge) {
    // Puente levadizo: su estado y el botón de alzar o bajar (no se mueve).
    $('pc-status').textContent = `${s.raised ? '⬆️ Alzado: no pasa nadie' : s.wantUp ? '⏳ Se alza en cuanto no haya nadie encima' : '⬇️ Bajado: se cruza andando'} · ${s.powered ? 'con corriente se alza solo ante un raid' : 'sin corriente: solo a mano'}`;
    raise.textContent = s.wantUp ? '⬇️ Bajar' : '⬆️ Alzar';
    $('pc-move').hidden = true;
    $('pc-unmove').hidden = true;
    return;
  }
  if (s.def.climate) {
    // Calefactor o aire acondicionado: temperatura elegida, la de la habitación y si trabaja.
    const w = scene().world;
    const room = tileTemp(w, s.x, s.y);
    const state = !roofed(w, s.x, s.y) || !w.rooms.at(s.x, s.y) ? '⚠️ Necesita una habitación cerrada con tejado'
      : !s.climateOn ? '💤 En reposo (no gasta)'
      : s.powered ? (s.def.climate.mode === 'calor' ? '🔥 Calentando' : '❄️ Enfriando') : '⚡ Sin corriente';
    $('pc-status').textContent = `🎯 ${targetOf(s)} °C · 🌡 ahora ${Math.round(room)} °C · ${state}`;
  }
  const canKit = !!kitOf(s.def) && s.built;
  $('pc-pack').hidden = !canKit || !!s.pack;
  $('pc-unpack').hidden = !canKit || !s.pack;
  if (!s.def.movable) {
    // Solo se desmonta en kit (torretas, baterías…).
    $('pc-status').textContent = s.pack ? '📦 Esperando a que un colono la desmonte' : '📦 Se puede desmontar en kit para guardarla y montarla en otro sitio';
    $('pc-move').hidden = true;
    $('pc-unmove').hidden = true;
    return;
  }
  if (!s.def.climate || s.lifted || s.moveTo || s.pack) $('pc-status').textContent = s.lifted ? '✋ Un colono lo está llevando' : s.moveTo ? '✋ Esperando a que un colono lo lleve' : s.pack ? '📦 Esperando a que un colono lo desmonte' : 'Se puede llevar a otro sitio sin gastar nada';
  $('pc-move').hidden = !!s.moveTo || !!s.pack;
  $('pc-unmove').hidden = !s.moveTo || !!s.lifted;
}
game.events.on('piece-select', (s: Structure | null) => {
  selectedPiece = s;
  renderPiece();
});
$('pc-close').addEventListener('click', () => scene().selectPiece(null));
$('pc-move').addEventListener('click', () => {
  if (selectedPiece) scene().startMove(selectedPiece);
});
$('pc-cooler').addEventListener('click', () => {
  if (selectedPiece) setTarget(selectedPiece, targetOf(selectedPiece) - 1);
  renderPiece();
});
$('pc-warmer').addEventListener('click', () => {
  if (selectedPiece) setTarget(selectedPiece, targetOf(selectedPiece) + 1);
  renderPiece();
});
$('pc-crop').addEventListener('click', () => {
  if (selectedPiece) cycleTrayCrop(selectedPiece);
  renderPiece();
});
$('pc-raise').addEventListener('click', () => {
  if (selectedPiece) scene().world.toggleDrawbridge(selectedPiece);
  renderPiece();
});
$('pc-unmove').addEventListener('click', () => {
  if (selectedPiece) scene().world.cancelMoveStructure(selectedPiece.id);
  renderPiece();
});
$('pc-pack').addEventListener('click', () => {
  if (selectedPiece) scene().world.orderPack(selectedPiece.id, true);
  renderPiece();
});
$('pc-unpack').addEventListener('click', () => {
  if (selectedPiece) scene().world.orderPack(selectedPiece.id, false);
  renderPiece();
});
// --- Vehículos: panel con conductor, tirador y ⛽ -----------------------------------
const vehiclePanel = $('vehicle-panel');
let selectedVehicle: Vehicle | null = null;
const seatSelects: Record<VehicleSeat, HTMLSelectElement> = {
  conductor: $<HTMLSelectElement>('vh-conductor'),
  tirador: $<HTMLSelectElement>('vh-tirador'),
};
function renderVehicle(): void {
  const v = selectedVehicle;
  vehiclePanel.hidden = !v;
  if (!v) return;
  const w = scene().world;
  const def = vehicleDef(v.def)!;
  const driver = occupant(w, v, 'conductor');
  const fuel = usesFuel(def);
  $('vh-name').textContent = `${def.water ? '🛶' : '🚙'} ${def.name}`;
  $('vh-conductor-label').textContent = def.water && !fuel ? 'Remero' : 'Conductor';
  const state = v.path.length > 0 ? 'en marcha' : fuel && v.fuel <= 0 ? 'sin combustible' : 'parado';
  const parts = [state, `vida ${Math.max(0, Math.ceil(v.hp))}/${def.hp}`];
  if (fuel) parts.unshift(`⛽ ${Math.floor(v.fuel)}/${def.fuelCapacity}`);
  if (def.armor > 0) parts.push(`blindaje −${Math.round(def.armor * 100)} %`);
  $('vh-status').textContent = parts.join(' · ');
  // Un desplegable por asiento: nadie o un colono (los que pueden).
  const people = w.colonists.filter((c) => !c.downed);
  const key = people.map((c) => `${c.id}:${c.name}`).join('|');
  for (const seat of VEHICLE_SEATS) {
    const sel = seatSelects[seat];
    if (sel.dataset.key !== key) {
      sel.dataset.key = key;
      const none = new Option('— Nadie —', '');
      sel.replaceChildren(none, ...people.map((c) => new Option(`${c.name} «${c.nickname}»`, String(c.id))));
    }
    const who = occupant(w, v, seat);
    if (document.activeElement !== sel) sel.value = who ? String(who.id) : '';
  }
  $<HTMLButtonElement>('vh-empty').disabled = !w.colonists.some((c) => c.vehicle?.id === v.id);
  $('vh-hint').textContent = !driver
    ? 'Elige un conductor: irá andando y se subirá.'
    : !driver.vehicle?.boarded
      ? `${driver.name} va hacia el vehículo…`
      : fuel && v.fuel <= 0
        ? def.water
          ? 'Sin ⛽: llévala a la orilla junto a un montón de ⛽ (a 2 casillas) y repostará sola.'
          : 'Sin ⛽: apárcalo junto a un montón de ⛽ (a 2 casillas) y repostará solo.'
        : def.water
          ? 'Toca el agua para llevarla allí (solo por el agua, sin pasar bajo puentes). Para bajarse, acércala a la orilla.'
          : 'Toca el suelo para llevarlo allí. Atropella a los saqueadores que pilla.';
}
game.events.on('vehicle-select', (v: Vehicle | null) => {
  selectedVehicle = v;
  renderVehicle();
});
for (const seat of VEHICLE_SEATS) {
  seatSelects[seat].addEventListener('change', () => {
    const v = selectedVehicle;
    if (!v) return;
    const w = scene().world;
    const id = Number(seatSelects[seat].value);
    if (!seatSelects[seat].value) {
      const who = occupant(w, v, seat);
      if (who) w.leaveVehicle(who);
    } else if (!w.boardVehicle(v.id, id, seat)) showToast('No puede subirse ahora');
    seatSelects[seat].blur();
    renderVehicle();
  });
}
$('vh-empty').addEventListener('click', () => {
  if (selectedVehicle) scene().world.emptyVehicle(selectedVehicle.id);
  renderVehicle();
});
$('vh-close').addEventListener('click', () => scene().selectVehicle(null));

let lastStation: Structure | null = null;
game.events.on('station-select', (s: Structure | null) => {
  stationPanel.hidden = !s;
  if (!s) {
    lastStation = null;
    return;
  }
  if (s !== lastStation) unfold(stationPanel);
  lastStation = s;
  $('sp-name').textContent = `🛠 ${s.def.name}${s.electric ? ' ⚡' : ''}`;
  renderStationStatus(s);
  renderStationPower(s);
  renderStationMove(s);
  const inv = scene().world.inventory();
  if (s.def.id === RESEARCH_BENCH) {
    // El banco de investigación no fabrica: el proyecto se elige en 📜 → 🔬 Investigación.
    const r = scene().world.research;
    const cur = r.current ? researchDef(r.current) : undefined;
    $('sp-recipes').replaceChildren(
      mk('span', 'ps-desc', cur
        ? `🔬 Investigando: ${cur.name} (${Math.floor(researchFraction(r, cur.id) * 100)} %). Lo hace quien tenga el trabajo «Investigar».`
        : '🔬 Sin proyecto: elige uno en 📜 → 🔬 Investigación.'),
    );
    $('sp-controls').hidden = true;
    return;
  }
  $('sp-recipes').replaceChildren(
    ...recipesFor(s.def.id).map((r) => {
      const on = s.bill?.recipe.id === r.id;
      const b = mk('button', 'ps-card');
      b.type = 'button';
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
      const locked = !scene().world.canCraft(r);
      const need = locked && r.research ? researchDef(r.research) : undefined;
      b.classList.toggle('locked', locked);
      const top = mk('span', 'ps-card-top');
      top.append(mk('strong', '', `${locked ? '🔒 ' : ''}${r.name}`), mk('span', 'ps-check', on ? '✔ En marcha' : ''));
      const have = (Object.keys(r.inputs) as ResourceId[]).every((res) => inv[res] >= (r.inputs[res] ?? 0));
      const formula = mk('span', 'ps-formula', `${fmtRes(r.inputs)} → ${fmtRes(r.outputs)}`);
      if (!have) formula.append(mk('span', 'ps-lack', ' · falta material'));
      b.append(top, formula, mk('span', 'ps-desc', need ? `Pide investigar «${need.name}» (📜 → 🔬 Investigación). ${r.description}` : r.description));
      b.addEventListener('click', () => {
        const sc = scene();
        if (locked && !on) {
          showToast(`🔒 ${r.name}: antes hay que investigar «${need?.name ?? r.research}» en 📜 → 🔬 Investigación`, 3500);
          return;
        }
        // La orden nueva sigue el modo de la anterior; sin anterior, «fabricar 1».
        const prev = s.bill;
        const mode = prev?.mode ?? (prev ? 'until' : 'count');
        sc.world.setStationBill(s, on ? null : { recipe: r, target: prev ? Math.max(1, prev.target) : 1, paused: false, mode });
        sc.refreshStation();
      });
      return b;
    }),
  );
  const ctl = $('sp-controls');
  ctl.hidden = !s.bill;
  renderStationAmount(s);
  $('sp-pause').textContent = s.bill?.paused ? '▶ Reanudar' : '⏸ Pausar';
  $('sp-pause').classList.toggle('active', !!s.bill?.paused);
});
/** Modo de la orden y su número (sin pisar lo que se está escribiendo). */
function renderStationAmount(s: Structure): void {
  const b = s.bill;
  if (!b) return;
  const count = b.mode === 'count';
  for (const [id, on] of [['sp-mode-count', count], ['sp-mode-until', !count]] as const) {
    $(id).classList.toggle('active', on);
    $(id).setAttribute('aria-pressed', String(on));
  }
  const input = $<HTMLInputElement>('sp-target');
  if (document.activeElement !== input) input.value = String(b.target);
}
function changeBill(fn: (s: Structure) => void): void {
  const sc = scene();
  const s = sc.selectedStation;
  if (!s?.bill) return;
  fn(s);
  sc.refreshStation();
}
$('sp-mode-count').addEventListener('click', () => changeBill((s) => scene().world.structures.setBillMode(s, 'count')));
$('sp-mode-until').addEventListener('click', () => changeBill((s) => scene().world.structures.setBillMode(s, 'until')));
$('sp-minus').addEventListener('click', () => changeBill((s) => scene().world.structures.setBillTarget(s, s.bill!.target - 1)));
$('sp-plus').addEventListener('click', () => changeBill((s) => scene().world.structures.setBillTarget(s, s.bill!.target + 1)));
$('sp-target').addEventListener('change', (e) => {
  const v = Number((e.target as HTMLInputElement).value);
  changeBill((s) => scene().world.structures.setBillTarget(s, v));
});
// Al escribir, Intro confirma y suelta el teclado.
$('sp-target').addEventListener('keydown', (e) => {
  if ((e as KeyboardEvent).key === 'Enter') (e.target as HTMLInputElement).blur();
});
$('sp-pause').addEventListener('click', () => changeBill((s) => scene().world.structures.toggleBillPause(s)));

// --- Huerto: qué se planta -------------------------------------------------------
const farmPanel = $('farm-panel');
setupFold(farmPanel, 'fp-fold');
$('fp-close').addEventListener('click', () => scene().selectFarm(null));
const resetFarmDelete = setupConfirmDelete('fp-delete', '🗑 Borrar huerto', () => {
  const s = scene();
  if (s.selectedFarmId !== null) s.world.farms.delete(s.selectedFarmId);
  s.selectFarm(null);
});
/** Cuántas casillas del huerto están vacías, creciendo o maduras. */
function renderFarmState(f: GrowZone): void {
  const farms = scene().world.farms;
  const w = scene().world.map.width;
  let empty = 0;
  let growing = 0;
  let ripe = 0;
  let other = 0;
  for (const i of f.tiles) {
    const p = farms.plantAt(i % w, Math.floor(i / w));
    if (!p) empty++;
    else if (p.growth >= 1) ripe++;
    else growing++;
    if (p && p.crop.id !== f.crop.id) other++;
  }
  const box = $('fp-state');
  box.replaceChildren(
    mk('span', 'ps-chip', `🟫 ${empty} sin sembrar`),
    mk('span', 'ps-chip', `🌱 ${growing} creciendo`),
    mk('span', `ps-chip${ripe ? ' good' : ''}`, `🌾 ${ripe} maduras`),
  );
  if (other) box.append(mk('span', 'ps-note', `${other} con el cultivo anterior: se cambian al cosecharlas.`));
}
game.events.on('farm-tick', (f: GrowZone) => renderFarmState(f));
let lastFarm: number | null = null;
game.events.on('farm-select', (f: GrowZone | null) => {
  farmPanel.hidden = !f;
  if (!f) {
    lastFarm = null;
    resetFarmDelete();
    return;
  }
  if (f.id !== lastFarm) {
    unfold(farmPanel);
    resetFarmDelete();
  }
  lastFarm = f.id;
  $('fp-name').textContent = `🌱 ${f.name}`;
  $('fp-sub').textContent = `${f.tiles.size} casillas · ${RESOURCE_ICONS[f.crop.resource]} ${f.crop.name}`;
  renderFarmState(f);
  $('fp-crops').replaceChildren(
    ...CROPS.map((crop) => {
      const on = f.crop.id === crop.id;
      const w = scene().world;
      // Lo que aún pide investigación sale con 🔒 (si el huerto ya lo tenía, lo sigue plantando).
      const need = w.canPlant(crop) ? undefined : missingResearch(w.research, crop);
      const b = mk('button', 'ps-card');
      b.type = 'button';
      b.classList.toggle('active', on);
      b.classList.toggle('locked', !!need);
      b.setAttribute('aria-pressed', String(on));
      const top = mk('span', 'ps-card-top');
      top.append(mk('strong', '', `${need ? '🔒 ' : ''}${RESOURCE_ICONS[crop.resource]} ${crop.name}`), mk('span', 'ps-check', on ? '✔ Plantando' : ''));
      const facts = `⏱ ${crop.growDays} días · ${crop.yield[0]}–${crop.yield[1]} por casilla${crop.growsInDark ? ' · 🌙 crece de noche' : ''}`;
      b.append(top, mk('span', 'ps-formula', facts), mk('span', 'ps-desc', need ? `Pide investigar «${need.name}» (📜 → 🔬 Investigación). ${crop.description}` : crop.description));
      b.addEventListener('click', () => {
        if (on) return;
        if (!scene().world.setFarmCrop(f.id, crop)) {
          showToast(`🔒 ${crop.name}: antes hay que investigar «${need?.name ?? crop.research}» en 📜 → 🔬 Investigación`, 3500);
          return;
        }
        scene().refreshFarm();
      });
      return b;
    }),
  );
});

// --- Almacén: prioridad y filtro -------------------------------------------------
const zonePanel = $('zone-panel');
setupFold(zonePanel, 'zp-fold');
$('zp-close').addEventListener('click', () => scene().selectZone(null));
const resetZoneDelete = setupConfirmDelete('zp-delete', '🗑 Borrar almacén', () => {
  const s = scene();
  if (s.selectedZoneId !== null) s.world.zones.delete(s.selectedZoneId);
  s.selectZone(null);
});
function setAllAccepts(value: boolean): void {
  const s = scene();
  if (s.selectedZoneId === null) return;
  for (const r of RESOURCES) s.world.zones.setAccepts(s.selectedZoneId, r, value);
  s.refreshZone();
}
$('zp-all').addEventListener('click', () => setAllAccepts(true));
$('zp-none').addEventListener('click', () => setAllAccepts(false));
/** Lo que hay guardado ahora en el almacén. */
function renderZoneStock(z: StorageZone): void {
  const world = scene().world;
  const w = world.map.width;
  const sum: Partial<Record<ResourceId, number>> = {};
  let used = 0;
  for (const i of z.tiles) {
    const st = world.items.at(i % w, Math.floor(i / w));
    if (!st) continue;
    used++;
    sum[st.resource] = (sum[st.resource] ?? 0) + st.amount;
  }
  const box = $('zp-stock');
  const list = RESOURCES.filter((r) => (sum[r] ?? 0) > 0);
  box.replaceChildren(mk('div', 'ps-label', `Guardado ahora · ${used}/${z.tiles.size} casillas ocupadas`));
  if (!list.length) box.append(mk('span', 'ps-note', 'Vacío.'));
  for (const r of list) box.append(mk('span', 'ps-chip', `${RESOURCE_ICONS[r]} ${sum[r]}`));
}
game.events.on('zone-tick', (z: StorageZone) => renderZoneStock(z));
let lastZone: number | null = null;
game.events.on('zone-select', (z: StorageZone | null) => {
  zonePanel.hidden = !z;
  if (!z) {
    lastZone = null;
    resetZoneDelete();
    return;
  }
  if (z.id !== lastZone) {
    unfold(zonePanel);
    resetZoneDelete();
  }
  lastZone = z.id;
  const accepted = RESOURCES.filter((r) => z.accepts[r]).length;
  $('zp-name').textContent = `📦 ${z.name}`;
  $('zp-sub').textContent = `${z.tiles.size} casillas · prioridad ${STORAGE_PRIORITY_NAMES[z.priority].toLowerCase()} · guarda ${accepted === RESOURCES.length ? 'de todo' : `${accepted} de ${RESOURCES.length}`}`;
  $('zp-priority').replaceChildren(
    ...STORAGE_PRIORITIES.map((p) => {
      const b = mk('button', `prio-${p}`, STORAGE_PRIORITY_NAMES[p]);
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(z.priority === p));
      b.classList.toggle('active', z.priority === p);
      b.addEventListener('click', () => {
        scene().world.zones.setPriority(z.id, p);
        scene().refreshZone();
      });
      return b;
    }),
  );
  $<HTMLButtonElement>('zp-all').disabled = accepted === RESOURCES.length;
  $<HTMLButtonElement>('zp-none').disabled = accepted === 0;
  $('zp-filter').replaceChildren(
    ...RESOURCES.map((r) => {
      const on = z.accepts[r];
      const b = mk('button', 'ps-tile');
      b.type = 'button';
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
      b.append(mk('span', 'ps-tile-icon', RESOURCE_ICONS[r]), mk('span', 'ps-tile-name', RESOURCE_NAMES[r]));
      b.addEventListener('click', () => {
        scene().world.zones.setAccepts(z.id, r, !z.accepts[r]);
        scene().refreshZone();
      });
      return b;
    }),
  );
  renderZoneStock(z);
});
// Esc cierra la hoja de lugar abierta.
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const s = scene();
  if (!zonePanel.hidden) s.selectZone(null);
  else if (!farmPanel.hidden) s.selectFarm(null);
  else if (!stationPanel.hidden) s.selectStation(null);
  else if (!piecePanel.hidden) s.selectPiece(null);
  else if (!vehiclePanel.hidden) s.selectVehicle(null);
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
game.events.on('toast', (text: string, ms?: number) => showToast(text, ms));

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
  },
  switchTo: (w) => {
    scene().scene.restart({ seed: w.map.seed, world: w });
    showToast(`🏠 ${w.name ?? 'Colonia principal'}`, 2000);
  },
});
// Saqueador en el suelo (#22): elegir si se le captura o se le remata.
const foePanel = $('foe-panel');
let foeId: number | null = null;
function downedFoe(): Colonist | undefined {
  const w = scene().world;
  const o = foeId === null ? undefined : w.others.find((k) => k.id === foeId);
  return o && o.role === 'saqueador' && o.downed ? o : undefined;
}
function renderFoe(): void {
  const o = downedFoe();
  foePanel.hidden = !o;
  if (!o) {
    foeId = null;
    return;
  }
  const w = scene().world;
  const finish = !!o.raider?.finish;
  const by = w.colonists.find((c) => c.job?.pid === o.id && c.job.kind === 'carcelero');
  const doc = w.colonists.find((c) => c.job?.pid === o.id && c.job.kind === 'curar');
  // Para capturar hace falta una cama de prisionero libre (#22): sin ella, ⛓ sale apagado.
  const bed = w.prisonBedsFree() > 0 || (!!by && !finish);
  $('fo-name').textContent = `⚔️ ${o.name} (saqueador${o.raider?.leader ? ' ★' : ''})`;
  const what = finish ? 'Se le rematará' : bed ? 'Se le capturará' : 'Sin cama de prisionero libre: se queda en el suelo';
  const who = by ? ` · ${by.name} va a ello` : finish || bed ? (w.colonists.some((c) => c.priorities.carcelero > 0) ? '' : ' · falta un colono con «Carcelero»') : '';
  const bleeding = o.wounds.some((k) => k.bleeding);
  const heal = doc ? ` · 🩹 ${doc.name} le cura` : bleeding ? ' · 🩸 Se desangra: lo curará quien tenga «Médico»' : '';
  $('fo-status').textContent = `En el suelo · ${what}${who}${heal}`;
  const cap = $('fo-capture') as HTMLButtonElement;
  cap.disabled = !bed;
  cap.title = bed ? 'Un carcelero lo captura y lo lleva a una cama de prisionero' : 'Hace falta una cama de prisionero libre (🏗 → Muebles)';
  $('fo-capture').classList.toggle('active', !finish && bed);
  $('fo-finish').classList.toggle('active', finish);
  $('fo-capture').setAttribute('aria-pressed', String(!finish && bed));
  $('fo-finish').setAttribute('aria-pressed', String(finish));
}
function setFoeFate(fate: 'capturar' | 'rematar'): void {
  const o = downedFoe();
  if (o) scene().world.setDownedFate(o.id, fate);
  renderFoe();
}
$('fo-close').addEventListener('click', () => {
  foeId = null;
  renderFoe();
});
$('fo-capture').addEventListener('click', () => setFoeFate('capturar'));
$('fo-finish').addEventListener('click', () => setFoeFate('rematar'));
window.setInterval(() => {
  if (!foePanel.hidden) renderFoe();
}, 500);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !foePanel.hidden) {
    foeId = null;
    renderFoe();
  }
});
game.events.on('pawn-tap', (c: Colonist) => {
  if (c.role === 'saqueador' && c.downed) {
    foeId = c.id;
    renderFoe();
    return;
  }
  people.openFor(c);
});

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
  newGame: ({ seed: s, colonists, events, difficulty, tutorial: guide }) => {
    seed = s;
    if (guide) tutorial.startOnNextMap();
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
// Al abrir el juego, primero el menú principal (con la partida en pausa detrás), salvo si la página
// se acaba de recargar sola para coger una versión nueva: entonces se sigue jugando.
if (cameFromVersionReload()) {
  window.setTimeout(() => showToast('🔄 Versión nueva cargada: sigues donde estabas.', 4000), 500);
} else if (currentWorld()) mainMenu.open();
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
  primerosPasos: () => {
    tutorial.startOnNextMap();
    tutorial.mapReady(scene().world.map.seed);
  },
  // Para las capturas de muestra (scripts/vitrina.mjs): mover la cámara y empezar una batalla ya.
  mirar: (x: number, y: number, zoom = 2) => {
    const sc = scene();
    sc.cameras.main.setZoom(zoom);
    sc.focusTile(x, y);
  },
  mirarA: (que: 'saqueadores' | 'balsa', zoom = 2) => {
    const sc = scene();
    const w = sc.world;
    const pts = que === 'balsa' ? w.vehicles.filter((v) => v.def === 'balsa_saqueadores').map((v) => ({ x: v.x, y: v.y })) : w.others.filter((o) => o.role === 'saqueador').map((o) => o.tile);
    if (!pts.length) return false;
    sc.cameras.main.setZoom(zoom);
    sc.focusTile(Math.round(pts.reduce((a, p) => a + p.x, 0) / pts.length), Math.round(pts.reduce((a, p) => a + p.y, 0) / pts.length));
    return true;
  },
  // Para ver la luz y el tiempo: pone el reloj a una hora del mismo día y, si se pide, un suceso del tiempo.
  ambiente: (hora: number, suceso?: string) => {
    const w = scene().world;
    w.tick += Math.round(((((hora - w.hour) % 24) + 24) % 24) * TICKS_PER_HOUR);
    if (suceso === 'despejado') w.weather.length = 0;
    else if (suceso) w.weather.push({ id: suceso, until: w.tick + 24 * TICKS_PER_HOUR });
    return w.hour;
  },
  // Para ver las estaciones: salta al día pedido (a la misma hora).
  dia: (d: number) => {
    const w = scene().world;
    w.tick += Math.round((d - w.day) * 24 * TICKS_PER_HOUR);
    return w.day;
  },
  batalla: () => {
    const w = scene().world;
    const f = w.factions.find((k) => k.base && k.id !== 'piratas_oxido') ?? w.factions.find((k) => k.base);
    if (!f) return 'sin bases';
    const why = startExpedition(w, f.id, w.colonists.slice(0, 5).map((c) => c.id));
    if (why) return why;
    w.expedition!.arriveAt = w.tick;
    updateExpedition(w);
    return f.id;
  },
};

// --- Sonido y enfoque automático (menú) ------------------------------------------
{
  const soundBtn = $('sound-btn');
  const focusBtn = $('focus-btn');
  const gfxBtn = $('gfx-btn');
  const gfxLabel = () => {
    gfxBtn.innerHTML = `<span class="mi">🖼</span><span>Gráficos: ${graphicsQuality()}</span>`;
  };
  gfxLabel();
  gfxBtn.addEventListener('click', () => {
    setGraphicsQuality(nextGraphicsQuality());
    scene()?.applyGraphics();
    gfxLabel();
  });
  const soundLabel = () => {
    const v = scene()?.sfx.volume ?? 1;
    soundBtn.innerHTML = v >= 1 ? '<span class="mi">🔊</span><span>Sonido alto</span>' : v > 0 ? '<span class="mi">🔉</span><span>Sonido bajo</span>' : '<span class="mi">🔇</span><span>Sin sonido</span>';
  };
  const focusOn = () => {
    try {
      return localStorage.getItem('oxido-enfoque') !== 'no';
    } catch {
      return true;
    }
  };
  const focusLabel = () => {
    focusBtn.innerHTML = `<span class="mi">🎬</span><span>Enfoque: ${focusOn() ? 'sí' : 'no'}</span>`;
  };
  soundBtn.addEventListener('click', () => {
    const s = scene();
    if (!s) return;
    const steps = VOLUME_STEPS as readonly number[];
    const i = steps.indexOf(s.sfx.volume);
    s.sfx.setVolume(steps[(i + 1) % steps.length]);
    soundLabel();
  });
  focusBtn.addEventListener('click', () => {
    try {
      localStorage.setItem('oxido-enfoque', focusOn() ? 'no' : 'si');
    } catch {
      /* sin almacenamiento */
    }
    focusLabel();
  });
  game.events.once('map-ready', () => {
    soundLabel();
    focusLabel();
  });
  // Un clic suave en los botones de la interfaz.
  document.addEventListener('click', (ev) => {
    if ((ev.target as HTMLElement | null)?.closest?.('button')) scene()?.sfx.play('clic');
  });
}

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
      }
      s.select(c.id);
    });
    b.addEventListener('dblclick', () => scene().focus(c.id));
    roster.append(b);
  }
}
$('cp-draft').addEventListener('click', () => scene().toggleDraftSelected());

// Posturas del reclutado: tocar la activa la quita (vuelve a la normal).
for (const b of $('cp-stances').querySelectorAll<HTMLButtonElement>('button[data-stance]')) {
  b.addEventListener('click', () => {
    const sc = scene();
    const stance = b.dataset.stance as Stance;
    const sel = sc.world.colonists.filter((k) => sc.selectedIds().includes(k.id));
    if (stance === 'atacar' && sc.attackPick) {
      sc.cancelAttackPick();
      return;
    }
    const allHave = sel.length > 0 && sel.every((k) => k.stance === stance);
    sc.setStanceSelected(allHave ? null : stance);
  });
}

// Arma del colono: la mejor libre (sola), una concreta o ninguna.
const weaponSelect = $<HTMLSelectElement>('cp-weapon');
weaponSelect.append(
  new Option('La mejor libre', 'auto'),
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
const armorSelect = $<HTMLSelectElement>('cp-armor');
armorSelect.addEventListener('change', () => {
  const w = scene().world;
  const c = w.colonists.find((k) => k.id === weaponPawnId);
  const v = armorSelect.value;
  if (c && (v === 'auto' || v === 'ninguna')) w.setArmorChoice(c, v);
});
function renderArmor(c: Colonist): void {
  const pieces = [c.vest, c.helmet].filter((p) => p !== null);
  $('cp-armor-now').textContent = pieces.length
    ? `${pieces.map((p) => `${RESOURCE_ICONS[p]} ${RESOURCE_NAMES[p]}`).join(' · ')} (−${Math.round(armorProtection(pieces) * 100)} % de daño)`
    : '👕 Sin armadura';
  if (document.activeElement !== armorSelect) armorSelect.value = c.armorChoice;
}
function renderWeapon(c: Colonist): void {
  renderArmor(c);
  weaponPawnId = c.id;
  const def = c.weapon ? WEAPONS[c.weapon] : null;
  const ammo = (def?.ammo ? ` · ${RESOURCE_ICONS[def.ammo]} ${c.ammo}` : '') + (c.grenades ? ` · ${RESOURCE_ICONS.granadas} ${c.grenades}` : '');
  $('cp-weapon-now').textContent = c.weapon
    ? `${RESOURCE_ICONS[c.weapon]} ${RESOURCE_NAMES[c.weapon]} (×${String(def!.damage).replace('.', ',')}${def!.closeRange !== undefined ? ` a ${def!.closeRange} o menos, ×${String(def!.farDamage).replace('.', ',')} más lejos` : ''}, ${def!.speedLabel}${def!.reach > 1 ? `, alcance ${def!.reach}` : ''})${ammo}`
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
  const moodKey = reasons.map((r) => `${r.value}${r.text}`).join('|');
  const moodEl = $('cp-mood');
  if (moodEl.dataset.key === moodKey) return;
  moodEl.dataset.key = moodKey;
  moodEl.replaceChildren(
    ...(reasons.length
      ? reasons.map((r) => {
          const row = document.createElement('div');
          row.className = r.value > 0 ? 'log-bueno' : 'log-malo';
          row.textContent = `${r.value > 0 ? '▲' : '▼'} ${r.text}`;
          return row;
        })
      : [Object.assign(document.createElement('div'), { className: 'muted', textContent: 'Nada en especial.' })]),
  );
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
// Pestañas de la ficha: se recuerda la última elegida (en el navegador, si se puede).
type CpTab = 'estado' | 'equipo' | 'trabajos' | 'perfil';
const CP_TABS: CpTab[] = ['estado', 'equipo', 'trabajos', 'perfil'];
let cpTab: CpTab = 'estado';
try {
  const saved = localStorage.getItem('oxido.cpTab');
  if (saved && (CP_TABS as string[]).includes(saved)) cpTab = saved as CpTab;
} catch {
  /* sin almacenamiento: se empieza en Estado */
}
function setCpTab(tab: CpTab): void {
  cpTab = tab;
  for (const b of panel.querySelectorAll<HTMLButtonElement>('#cp-tabs button')) {
    const on = b.dataset.tab === tab;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
  }
  for (const page of panel.querySelectorAll<HTMLElement>('.cp-page')) page.hidden = page.dataset.page !== tab;
  $('cp-body').scrollTop = 0;
  try {
    localStorage.setItem('oxido.cpTab', tab);
  } catch {
    /* nada */
  }
}
for (const b of panel.querySelectorAll<HTMLButtonElement>('#cp-tabs button')) {
  b.addEventListener('click', () => {
    setCpTab(b.dataset.tab as CpTab);
    setCpFolded(false);
  });
}
setCpTab(cpTab);

// Recoger la ficha: solo queda la cabecera, qué hace y el botón de reclutar (para ver el mapa en el móvil).
function setCpFolded(on: boolean): void {
  panel.classList.toggle('folded', on);
  const fold = $('cp-fold');
  fold.textContent = on ? '▴' : '▾';
  fold.setAttribute('aria-expanded', String(!on));
  fold.setAttribute('aria-label', on ? 'Desplegar la ficha' : 'Recoger la ficha');
}
$('cp-fold').addEventListener('click', () => setCpFolded(!panel.classList.contains('folded')));
panel.querySelector('.cp-title')!.addEventListener('click', () => {
  if (panel.classList.contains('folded')) setCpFolded(false);
});
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
  // Cada vez que se abre, la ficha sale desplegada.
  if (panel.hidden) setCpFolded(false);
  panel.hidden = false;
  const draftBtn = $('cp-draft');
  const allDrafted = group.every((k) => k.drafted);
  draftBtn.textContent = allDrafted ? '🏳 Liberar (G)' : '🎖 Reclutar (G)';
  draftBtn.classList.toggle('active', allDrafted);
  const stances = $('cp-stances');
  stances.hidden = !allDrafted;
  for (const b of stances.querySelectorAll<HTMLButtonElement>('button[data-stance]')) {
    const st = b.dataset.stance as Stance;
    const picking = st === 'atacar' && scene().attackPick;
    b.classList.toggle('active', group.every((k) => k.stance === st));
    b.classList.toggle('picking', picking);
    if (st === 'atacar') b.textContent = picking ? '🎯 Toca un enemigo' : '🎯 Atacar a…';
  }
  const groupKey = group.map((k) => k.id).join(',');
  if (group.length > 1) {
    // Grupo: nombre de todos y qué hacen; sin habilidades.
    panel.classList.add('group');
    $('cp-activity').textContent = group.map((k) => `${k.name}: ${activityLabel(k).toLowerCase()}`).join(' · ');
    if (lastGroupKey === groupKey) return;
    lastGroupKey = groupKey;
    lastPanelId = null;
    $('cp-name').textContent = `👥 ${group.length} colonos`;
    $('cp-sub').textContent = `${groupSummary(group).replace(/^👥 /, '')} · ${window.matchMedia('(pointer: coarse)').matches ? 'toca el suelo' : 'clic derecho en el suelo'} para mandarlos juntos`;
    $('cp-traits').replaceChildren();
    $('cp-trait-desc').textContent = '';
    $('cp-skills').replaceChildren();
    $('cp-work').replaceChildren();
    lastPriorityKey = '';
    return;
  }
  panel.classList.remove('group');
  lastGroupKey = groupKey;
  $('cp-activity').textContent = activityLabel(c);
  $('cp-health').textContent = c.wounds.length || c.health < 0.999
    ? `❤ ${healthLabel(c)} (${Math.round(c.health * 100)} %)${c.wounds.length ? ` · heridas: ${c.wounds.map((w) => `${w.part}${w.bleeding ? ' 🩸' : ''}`).join(', ')}` : ''}${c.infection ? ` · ${infectionLabel(c)}` : ''}`
    : '';
  renderNeeds(c);
  renderWeapon(c);
  renderPriorities(c);
  if (lastPanelId === c.id) return; // el resto no cambia mientras siga seleccionado
  lastPanelId = c.id;
  $('cp-name').textContent = `${c.name} «${c.nickname}»`;
  $('cp-sub').textContent = `${c.age} años`;

  const traits = $('cp-traits');
  const traitDesc = $('cp-trait-desc');
  traitDesc.textContent = '';
  traits.replaceChildren(
    ...(c.traits.length
      ? c.traits.map((t) => {
          const el = document.createElement('button');
          el.type = 'button';
          el.className = 'trait';
          el.textContent = t.name;
          el.title = t.description;
          el.addEventListener('click', () => {
            const on = !el.classList.contains('active');
            for (const o of traits.querySelectorAll('.trait')) o.classList.remove('active');
            el.classList.toggle('active', on);
            traitDesc.textContent = on ? `${t.name}: ${t.description}` : '';
          });
          return el;
        })
      : [Object.assign(document.createElement('span'), { className: 'muted', textContent: 'Sin rasgos especiales.' })]),
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
      passion.textContent = c.passions[s] === 2 ? '🔥' : c.passions[s] === 1 ? '•' : '';
      passion.title = c.passions[s] === 2 ? 'Pasión' : c.passions[s] === 1 ? 'Interés' : '';
      row.append(name, num, bar, passion);
      return row;
    }),
  );
});

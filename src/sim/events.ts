// Sucesos (bloque 9 del catálogo): cada pocos días pasa algo. Los que duran (tormenta de polvo…)
// quedan en `World.weather` hasta que se acaban. Puro y determinista: sin Phaser ni DOM.
import { EVENT_FIRST_DAY, EVENT_GAP, EVENTS, EventDef, eventDef } from '../data/events';
import { RESOURCE_ICONS, ResourceId } from '../data/resources';
import { RESOURCE_VALUES } from '../data/values';
import { isPassable } from './map';
import { findPath, Point } from './pathfinding';
import { Rng } from './rng';
import { factionDef, RAIDER_FACTION } from '../data/factions';
import { seasonOf } from '../data/seasons';
import { lightningStrike, startWildfire } from './fire';
import { roofed } from './roofs';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import type { World } from './world';

/** Un suceso que dura: cuál y hasta qué tick. */
export interface ActiveEvent {
  id: string;
  until: number;
}

/** Azar propio de los sucesos (no toca el de la partida): de la semilla y del tick. */
function eventRng(w: World, salt: number): Rng {
  return new Rng(((w.map.seed ^ 0x7e57ab1e) + Math.floor(w.tick / TICKS_PER_HOUR) * 0x27d4eb2d + salt) >>> 0);
}

/** Tick del primer suceso de una partida nueva. */
export function firstEventTick(): number {
  return Math.round(EVENT_FIRST_DAY * TICKS_PER_DAY);
}

/** Lo activo de un tipo (o undefined). */
export function activeEvent(w: World, id: string): ActiveEvent | undefined {
  return w.weather.find((e) => e.id === id && w.tick < e.until);
}

/** Lo que dan ahora las placas solares (×1, o ×0 con una tormenta de polvo). */
export function solarFactor(w: World): number {
  let f = 1;
  for (const e of w.weather) if (w.tick < e.until) f *= eventDef(e.id)?.solar ?? 1;
  return f;
}

/** Por cuánto se multiplica ahora el alcance de los disparos (×0,5 con una tormenta de polvo). */
export function reachFactor(w: World): number {
  let f = 1;
  for (const e of w.weather) if (w.tick < e.until) f *= eventDef(e.id)?.reach ?? 1;
  return f;
}

/** Cada hora: se acaban los que duran y, si toca, llega otro. */
export function runEvents(w: World): void {
  for (const e of [...w.weather]) {
    if (w.tick >= e.until) {
      w.weather.splice(w.weather.indexOf(e), 1);
      w.addLog(`🌤 Se acaba: ${eventDef(e.id)?.name.toLowerCase() ?? e.id}.`, 'info');
    }
  }
  // Lluvia ácida: cada hora estropea lo plantado al aire libre y quema un poco a quien está fuera.
  const acid = w.weather.find((e) => w.tick < e.until && eventDef(e.id)?.cropYield !== undefined);
  if (acid) acidRainHour(w, eventDef(acid.id)!);
  // Tormenta eléctrica: cada hora puede caer un rayo.
  const storm = w.weather.find((e) => w.tick < e.until && eventDef(e.id)?.lightning);
  if (storm) lightningHour(w, eventDef(storm.id)!);
  if (w.plague) checkPlague(w);
  checkRefugees(w);
  if (w.tick < w.nextEvent) return;
  const rng = eventRng(w, 1);
  w.nextEvent = w.tick + rng.int(Math.round(EVENT_GAP[0] * TICKS_PER_DAY), Math.round(EVENT_GAP[1] * TICKS_PER_DAY));
  // Solo los que tocan por el día y la estación (la ola de frío, en otoño e invierno, y no al principio).
  const pool = EVENTS.filter((e) => eventAllowed(w, e));
  const total = pool.reduce((a, e) => a + e.weight, 0);
  let roll = rng.next() * total;
  const ev = pool.find((e) => (roll -= e.weight) < 0) ?? pool[0];
  if (!ev) return;
  // Si no puede pasar (p. ej. una avería sin máquinas), pasa el siguiente que pueda.
  const order = [ev, ...pool.filter((e) => e !== ev)];
  for (const e of order) if (startEvent(w, e.id)) break;
}

/** Empieza un suceso. false si no ha podido (p. ej., no hay sitio para el alijo). */
export function startEvent(w: World, id: string): boolean {
  const ev = eventDef(id);
  if (!ev) return false;
  // Un suceso: la partida vuelve a x1 (pedido por Mikel el 2026-10-21).
  w.slowDown = true;
  if (ev.id === 'alijo') return dropCache(w, ev);
  if (ev.id === 'incendio') return startWildfire(w, eventRng(w, 8));
  if (ev.repair) return breakMachine(w, ev);
  if (ev.sickShare !== undefined) return startPlague(w, ev);
  if (ev.stayChance !== undefined) return refugeeArrives(w, ev);
  if (ev.hours && !activeEvent(w, ev.id)) {
    w.weather.push({ id: ev.id, until: w.tick + Math.round(ev.hours * TICKS_PER_HOUR) });
    if (ev.cropYield !== undefined) {
      w.addLog(`☔ ¡Lluvia ácida! Durante ${ev.hours} horas estropea lo plantado al aire libre (−${Math.round((1 - ev.cropYield) * 100)} % de cosecha) y quema a quien no esté bajo techo.`, 'malo');
      acidRainHour(w, ev);
      return true;
    }
    if (ev.lightning) {
      w.addLog(`⛈ ¡Tormenta eléctrica! Durante ${ev.hours} horas caerán rayos que pueden prender fuego a árboles, cultivos y lo construido con madera.`, 'malo');
      lightningHour(w, ev);
      return true;
    }
    if (ev.coldWave) w.addLog(`🥶 ¡Ola de frío! Durante ${ev.hours} horas hace frío a todas horas y no crece nada al aire libre: abrigos, estufas encendidas y bajo techo.`, 'malo');
    else if (ev.id === 'tormenta_polvo') w.addLog(`🌪 ¡Tormenta de polvo! Durante un día las placas solares no producen y los disparos llegan a la mitad de lejos.`, 'malo');
    else w.addLog(`🌦 ${ev.name}.`, 'malo');
    return true;
  }
  return false;
}

/** Un alijo de recursos (de 150 a 400 chapas) en un sitio del mapa al que se llega andando. */
function dropCache(w: World, ev: EventDef): boolean {
  const home = w.colonyPoint();
  if (!home || !ev.value || !ev.pool?.length) return false;
  const rng = eventRng(w, 2);
  const m = w.map;
  let at: Point | null = null;
  for (let tries = 0; tries < 60 && !at; tries++) {
    const p = { x: rng.int(2, m.width - 3), y: rng.int(2, m.height - 3) };
    const d = Math.abs(p.x - home.x) + Math.abs(p.y - home.y);
    if (d < 15 || !isPassable(m, p.x, p.y) || w.items.at(p.x, p.y) || w.structures.at(p.x, p.y)) continue;
    if (findPath(m, home, p, 40000)) at = p;
  }
  if (!at) return false;
  const target = rng.int(ev.value[0], ev.value[1]);
  const got: Partial<Record<ResourceId, number>> = {};
  let value = 0;
  for (let k = 0; k < 6 && value < target; k++) {
    const r = ev.pool[rng.int(0, ev.pool.length - 1)];
    const n = Math.max(1, Math.round((target - value) / 2 / RESOURCE_VALUES[r]));
    got[r] = (got[r] ?? 0) + n;
    value += n * RESOURCE_VALUES[r];
  }
  w.items.dropAll(at.x, at.y, got);
  const list = (Object.entries(got) as [ResourceId, number][]).map(([r, n]) => `${n} ${RESOURCE_ICONS[r]}`).join(', ');
  w.addLog(`📦 Alguien ha visto un alijo abandonado: ${list}. Los colonos con «Transportar» lo traerán.`, 'bueno', 'visita', at);
  return true;
}

/** Una hora de lluvia ácida. */
function acidRainHour(w: World, ev: EventDef): void {
  for (const { x, y, plant } of w.farms.plantList()) {
    if (!plant.harm && !roofed(w, x, y)) plant.harm = ev.cropYield;
  }
  for (const c of w.colonists) {
    if (c.vehicle?.boarded || roofed(w, c.tile.x, c.tile.y)) continue;
    c.health = Math.max(Math.min(c.health, ev.harmFloor ?? 0.5), c.health - (ev.harmPerHour ?? 0));
  }
}

/** Avería: una máquina eléctrica (que gasta corriente) se para hasta que la arreglen (⚙️1). */
function breakMachine(w: World, ev: EventDef): boolean {
  const machines = w.structures.all().filter((s) => s.built && (s.def.power ?? 0) < 0 && !s.def.conduit && !s.repair && !s.demolish);
  if (!machines.length) return false;
  const rng = eventRng(w, 3);
  const s = machines[rng.int(0, machines.length - 1)];
  if (!w.structures.breakDown(s, ev.repair!, ev.repairWork ?? 300)) return false;
  const need = (Object.entries(ev.repair!) as [ResourceId, number][]).map(([r, n]) => `${RESOURCE_ICONS[r]}${n}`).join(' ');
  w.addLog(`🔧 Avería: ${s.def.name.toLowerCase()} se ha parado. Un colono con «Construir» la arreglará con ${need}.`, 'malo', undefined, { x: s.x, y: s.y });
  return true;
}

/** Plaga: en un huerto enferma una parte de las plantas; los que cultivan las arrancan. */
function startPlague(w: World, ev: EventDef): boolean {
  if (w.plague) return false;
  const rng = eventRng(w, 4);
  // Las plantas cerca de un espantapájaros no enferman.
  const guarded = scarecrowTiles(w);
  const exposed = (i: number) => !guarded.has(i) && !!w.farms.plantAt(i % w.map.width, Math.floor(i / w.map.width));
  const zones = w.farms.all().filter((z) => [...z.tiles].filter(exposed).length >= (ev.minPlants ?? 4));
  if (!zones.length) return false;
  const z = zones[rng.int(0, zones.length - 1)];
  const plants = [...z.tiles].filter(exposed).map((i) => w.farms.plantAt(i % w.map.width, Math.floor(i / w.map.width))).filter((p): p is NonNullable<typeof p> => !!p);
  const n = Math.max(1, Math.ceil(plants.length * (ev.sickShare ?? 0.25)));
  for (let k = 0; k < n; k++) {
    const left = plants.filter((p) => !p.sick);
    left[rng.int(0, left.length - 1)].sick = true;
  }
  w.farms.version++;
  w.plague = { zone: z.id, until: w.tick + Math.round((ev.hours ?? 24) * TICKS_PER_HOUR) };
  w.addLog(`🐛 ¡Plaga en ${z.name}! ${n} ${n === 1 ? 'planta enferma' : 'plantas enfermas'}: si los que cultivan no las arrancan en un día, el huerto perderá la mitad de sus plantas.`, 'malo', undefined, { x: [...z.tiles][0] % w.map.width, y: Math.floor([...z.tiles][0] / w.map.width) });
  return true;
}

/** Cada hora: si ya no quedan enfermas, se acaba; si se acaba el plazo, el huerto pierde la mitad. */
function checkPlague(w: World): void {
  const pl = w.plague!;
  const z = w.farms.get(pl.zone);
  const at = (i: number) => w.farms.plantAt(i % w.map.width, Math.floor(i / w.map.width));
  const sick = z ? [...z.tiles].filter((i) => at(i)?.sick) : [];
  if (!z || sick.length === 0) {
    w.plague = null;
    if (z) w.addLog(`🌱 Plaga controlada en ${z.name}: ya no quedan plantas enfermas.`, 'bueno');
    return;
  }
  if (w.tick < pl.until) return;
  const ev = eventDef('plaga');
  const rng = eventRng(w, 5);
  const guarded = scarecrowTiles(w);
  const alive = [...z.tiles].filter((i) => at(i) && !guarded.has(i));
  const lose = Math.ceil(alive.length * (ev?.loss ?? 0.5));
  // Se pierden primero las enfermas y luego, al azar, las demás.
  const healthy = alive.filter((i) => !at(i)!.sick);
  for (let k = healthy.length - 1; k > 0; k--) {
    const j = rng.int(0, k);
    [healthy[k], healthy[j]] = [healthy[j], healthy[k]];
  }
  for (const i of [...sick, ...healthy].slice(0, lose)) w.farms.uproot(i % w.map.width, Math.floor(i / w.map.width));
  for (const i of z.tiles) {
    const p = at(i);
    if (p) delete p.sick;
  }
  w.plague = null;
  w.addLog(`🐛 La plaga se ha extendido por ${z.name}: se pierden ${lose} plantas.`, 'malo');
}

/** Refugiado herido: alguien de una facción (no los saqueadores) pide que lo curéis. */
function refugeeArrives(w: World, ev: EventDef): boolean {
  if (w.offer) return false;
  const options = w.factions.filter((f) => f.id !== RAIDER_FACTION);
  if (!options.length) return false;
  const rng = eventRng(w, 6);
  const f = options[rng.int(0, options.length - 1)];
  const def = factionDef(f.id);
  const c = w.makePawn('colono');
  c.faction = f.id;
  c.health = ev.health ?? 0.35;
  c.wounds.push({ part: 'el costado', severity: 0.6, bleeding: true, treated: false });
  w.offer = { kind: 'refugiado', pawn: c, until: w.tick + Math.round((ev.waitHours ?? 12) * TICKS_PER_HOUR) };
  w.addLog(`🩹 ${c.name}, de ${def?.name ?? f.id}, llega herido y pide que lo curéis. Si se cura, se unirá a la colonia o volverá con los suyos (y ellos os lo agradecerán).`, 'info', 'visita');
  return true;
}

/** Los refugiados ya curados deciden: se quedan o vuelven con los suyos. Su facción os lo agradece. */
function checkRefugees(w: World): void {
  const ev = eventDef('refugiado');
  if (!ev) return;
  for (const c of [...w.colonists]) {
    if (!c.refugee || c.downed || c.health < (ev.healedAt ?? 0.9) || c.wounds.some((k) => k.bleeding)) continue;
    const faction = c.refugee;
    const def = factionDef(faction);
    const rng = eventRng(w, 7 + c.id);
    if (rng.chance(ev.stayChance ?? 0.5)) {
      delete c.refugee;
      w.addLog(`🙂 ${c.name} ya está curado y decide quedarse en la colonia.`, 'bueno');
    } else {
      w.leaveColony(c, faction);
      w.addLog(`👋 ${c.name} ya está curado y vuelve con ${def?.name ?? 'los suyos'}.`, 'info');
    }
    w.changeRelation(faction, ev.relation ?? 10, `curáis a ${c.name}`);
  }
}

/** Lee los sucesos de una partida guardada. */
export function restoreWeather(saved: unknown): ActiveEvent[] {
  if (!Array.isArray(saved)) return [];
  return saved
    .filter((e) => e && typeof e === 'object' && typeof e.id === 'string' && eventDef(e.id) && typeof e.until === 'number')
    .map((e) => ({ id: e.id as string, until: e.until as number }));
}

/** Casillas que guarda algún espantapájaros terminado (a su radio o menos). */
export function scarecrowTiles(w: World): Set<number> {
  const out = new Set<number>();
  for (const s of w.structures.all()) {
    const r = s.def.scarecrow?.radius;
    if (!r || !s.built) continue;
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const x = s.x + dx;
        const y = s.y + dy;
        if (dx * dx + dy * dy > r * r || x < 0 || y < 0 || x >= w.map.width || y >= w.map.height) continue;
        out.add(y * w.map.width + x);
      }
  }
  return out;
}

/** Una hora de tormenta eléctrica: entre los rayos que tocan en toda la tormenta, cae uno de vez en cuando. */
function lightningHour(w: World, ev: EventDef): void {
  const [lo, hi] = ev.lightning!;
  const rng = eventRng(w, 9);
  if (!rng.chance(Math.min(1, (lo + hi) / 2 / (ev.hours ?? 6)))) return;
  const at = lightningStrike(w, rng);
  if (at) w.addLog(`⚡ Cae un rayo y prende fuego.`, 'malo', undefined, at);
}

/** Si un suceso puede tocar hoy (por el día y la estación). */
export function eventAllowed(w: World, e: EventDef): boolean {
  if (e.fromDay !== undefined && w.day < e.fromDay) return false;
  if (e.seasons && !e.seasons.includes(seasonOf(w.day).id)) return false;
  return true;
}

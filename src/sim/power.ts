// Electricidad: los cables terminados forman redes; en cada red, los generadores producen, los
// consumidores gastan y las baterías guardan lo que sobra. Números aprobados por Mikel (2026-10-17).
import { inBounds, index, propAt, Prop } from './map';
import type { Structure, Structures } from './structures';

/** Una red eléctrica: lo que produce, lo que pide y lo que tiene guardado ahora. */
export interface PowerNet {
  id: number;
  /** Casillas de cable. */
  tiles: number[];
  producers: Structure[];
  consumers: Structure[];
  batteries: Structure[];
  /** Vatios que producen los generadores en marcha. */
  production: number;
  /** Vatios que piden los consumidores conectados. */
  demand: number;
  /** Vatios que reciben los encendidos. */
  supplied: number;
  /** Vatios-hora guardados y que caben en las baterías. */
  stored: number;
  capacity: number;
}

const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Lo que cambia con el tiempo: la hora (para las placas solares) y el viento de 0 a 1 (para los molinos). */
export interface PowerEnv {
  hour: number;
  wind: number;
  /** Por cuánto se multiplica lo que guarda cada batería (la investigación «Baterías mejoradas»: ×2). */
  batteryMultiplier?: number;
  /** Lo que dan las placas solares (0 con una tormenta de polvo; por defecto, 1). */
  solar?: number;
}

/** Vatios-hora que caben en una batería con el multiplicador de la investigación (0 si no es batería). */
export function batteryCapacity(s: Structure, multiplier = 1): number {
  return (s.def.battery ?? 0) * multiplier;
}

/** Las placas solares producen de 6:00 a 20:00 (las mismas horas en que no hace falta luz). */
export function isDaylight(hour: number): boolean {
  return hour >= 6 && hour < 20;
}

/**
 * Fuerza del viento de 0 a 1 tras `hours` horas de partida: sube y baja despacio a lo largo de
 * los días con rachas de unas horas. Sale de la semilla, sin azar, así que no hace falta guardarla.
 */
export function windStrength(hours: number, seed: number): number {
  const a = ((seed >>> 0) % 1000) / 1000 * Math.PI * 2;
  const b = ((seed >>> 10) % 1000) / 1000 * Math.PI * 2;
  const c = ((seed >>> 20) % 1000) / 1000 * Math.PI * 2;
  const tau = Math.PI * 2;
  const v = 0.5 + 0.28 * Math.sin((tau * hours) / 31 + a) + 0.17 * Math.sin((tau * hours) / 7.3 + b) + 0.08 * Math.sin((tau * hours) / 2.1 + c);
  return Math.max(0, Math.min(1, v));
}

/** Un molino necesita las 8 casillas de alrededor libres: sin construcciones (cables y suelos sí) ni objetos. */
export function isSheltered(st: Structures, s: Structure): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const x = s.x + dx;
      const y = s.y + dy;
      if (!inBounds(st.map, x, y)) continue;
      if (st.mainAt(x, y)) return true;
      if (propAt(st.map, x, y) !== Prop.None) return true;
    }
  }
  return false;
}

/** Vatios que da ahora un generador sin combustible según la hora y el viento. */
function naturalOutput(st: Structures, s: Structure, env: PowerEnv): number {
  const p = s.def.power ?? 0;
  if (s.def.source === 'solar') return isDaylight(env.hour) ? Math.round(p * (env.solar ?? 1)) : 0;
  if (s.def.source === 'wind') {
    s.sheltered = isSheltered(st, s);
    return s.sheltered ? 0 : Math.round(p * Math.max(0, Math.min(1, env.wind)));
  }
  return p;
}

/** Vatios de una construcción: positivo si produce, negativo si consume (un taller electrificado, su mejora). */
export function powerOf(s: Structure): number {
  // Calefactor o aire acondicionado: solo pide corriente mientras trabaja.
  if (s.def.climate && !s.climateOn) return 0;
  if (s.def.power) return s.def.power;
  return s.electric && s.def.electrify ? -s.def.electrify.power : 0;
}

/** Usa electricidad (produce, consume o guarda). */
export function isElectric(s: Structure): boolean {
  return powerOf(s) !== 0 || !!s.def.battery;
}

/**
 * Multiplicador de velocidad de un taller por la corriente: electrificado y con corriente, el doble;
 * si no, normal (un taller electrificado nunca se para por falta de corriente).
 */
export function stationSpeed(s: Structure): number {
  return s.electric && s.powered ? 2 : 1;
}

/** Necesita corriente para funcionar (recicladora, depuradora, lámpara…) y ahora no le llega. */
export function lacksPower(s: Structure): boolean {
  // Una máquina averiada está parada aunque le llegue corriente.
  // Un calefactor o aire acondicionado en reposo no pide corriente: no le falta.
  if (s.def.climate && !s.climateOn) return false;
  return (s.def.power ?? 0) < 0 && (!s.powered || !!s.repair);
}

/** Redes de cable terminado: cada casilla de cable → id de su red. */
function cableNets(st: Structures): { netOf: Map<number, number>; tiles: Map<number, number[]> } {
  const map = st.map;
  const netOf = new Map<number, number>();
  const tiles = new Map<number, number[]>();
  let next = 1;
  for (const s of st.all()) {
    if (!s.built || !s.def.conduit) continue;
    const start = index(map, s.x, s.y);
    if (netOf.has(start)) continue;
    const id = next++;
    const list: number[] = [];
    const queue = [start];
    netOf.set(start, id);
    for (let h = 0; h < queue.length; h++) {
      const i = queue[h];
      list.push(i);
      const x = i % map.width;
      const y = Math.floor(i / map.width);
      for (const [dx, dy] of SIDES) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(map, nx, ny)) continue;
        const j = index(map, nx, ny);
        if (netOf.has(j)) continue;
        const c = st.cableAt(nx, ny);
        if (!c?.built) continue;
        netOf.set(j, id);
        queue.push(j);
      }
    }
    tiles.set(id, list);
  }
  return { netOf, tiles };
}

/** Red a la que está conectada una máquina: un cable debajo o pegado a alguna de sus casillas. */
function netOfStructure(st: Structures, s: Structure, netOf: Map<number, number>): number | undefined {
  let best: number | undefined;
  for (const t of st.tilesOf(s)) {
    for (const [dx, dy] of [[0, 0], ...SIDES]) {
      const x = t.x + dx;
      const y = t.y + dy;
      if (!inBounds(st.map, x, y)) continue;
      const n = netOf.get(index(st.map, x, y));
      if (n !== undefined && (best === undefined || n < best)) best = n;
    }
  }
  return best;
}

/**
 * Hace funcionar la electricidad durante `hours` horas de juego: gasta combustible, reparte la
 * corriente, carga o descarga baterías y enciende o apaga a cada consumidor. Si no llega para
 * todos, se apaga primero lo último que se conectó (el de id más alto). Devuelve las redes.
 */
export function updatePower(st: Structures, hours: number, env: PowerEnv = { hour: 12, wind: 0.5 }): PowerNet[] {
  const { netOf, tiles } = cableNets(st);
  const mult = env.batteryMultiplier ?? 1;
  const nets = new Map<number, PowerNet>();
  for (const [id, list] of tiles) {
    nets.set(id, { id, tiles: list, producers: [], consumers: [], batteries: [], production: 0, demand: 0, supplied: 0, stored: 0, capacity: 0 });
  }
  for (const s of st.all()) {
    if (s.def.climate && !s.climateOn) s.powered = false;
    if (!isElectric(s)) continue;
    s.powered = false;
    s.output = 0;
    if (!s.built) continue;
    // El combustible que han traído pasa dentro del generador.
    const f = s.def.fuel;
    if (f && s.delivered[f.resource]) {
      s.fuel = (s.fuel ?? 0) + (s.delivered[f.resource] ?? 0);
      delete s.delivered[f.resource];
    }
    const id = netOfStructure(st, s, netOf);
    const net = id !== undefined ? nets.get(id) : undefined;
    if (s.def.battery) {
      s.stored = Math.min(batteryCapacity(s, mult), s.stored ?? 0);
      if (net) net.batteries.push(s);
      continue;
    }
    const p = powerOf(s);
    if (p > 0) {
      // Un generador de combustible solo produce si le queda; lo gasta aunque nadie use la corriente.
      // La placa solar de noche o el molino sin viento no producen.
      if (f) {
        if ((s.fuel ?? 0) <= 0) continue;
        s.fuel = Math.max(0, (s.fuel ?? 0) - hours / f.hoursPerUnit);
      }
      const out = f ? p : naturalOutput(st, s, env);
      if (out <= 0) continue;
      s.powered = true;
      s.output = out;
      if (net) {
        net.producers.push(s);
        net.production += out;
      }
    } else if (p < 0 && net) {
      net.consumers.push(s);
      net.demand += -p;
    }
  }
  for (const net of nets.values()) {
    for (const b of net.batteries) {
      net.stored += b.stored ?? 0;
      net.capacity += batteryCapacity(b, mult);
    }
    // Primero lo más antiguo: si falta corriente, se apaga lo último que se conectó.
    net.consumers.sort((a, b) => a.id - b.id);
    const fromBatteries = hours > 0 ? net.stored / hours : 0;
    let budget = net.production + fromBatteries;
    for (const c of net.consumers) {
      const need = -powerOf(c);
      if (need <= budget) {
        c.powered = true;
        budget -= need;
        net.supplied += need;
      }
    }
    // Lo que sobra carga las baterías; lo que falta sale de ellas.
    const balanceWh = (net.production - net.supplied) * hours;
    let change = balanceWh >= 0 ? Math.min(balanceWh, net.capacity - net.stored) : Math.max(balanceWh, -net.stored);
    net.stored += change;
    for (const b of net.batteries) {
      if (change === 0) break;
      const cap = batteryCapacity(b, mult);
      const now = b.stored ?? 0;
      const step = change > 0 ? Math.min(change, cap - now) : Math.max(change, -now);
      b.stored = now + step;
      change -= step;
    }
  }
  return [...nets.values()];
}

/**
 * Casillas de las puertas automáticas cerradas: mientras dura un raid, las que tienen corriente
 * no dejan pasar a los saqueadores (los colonos sí). Sin corriente se quedan como una puerta normal.
 */
export function shutDoorTiles(st: Structures, raid: boolean): Set<number> {
  const out = new Set<number>();
  if (!raid) return out;
  for (const s of st.all()) {
    if (s.def.autoDoor && s.built && s.powered) out.add(s.y * st.map.width + s.x);
  }
  return out;
}

/** Casillas iluminadas por lámparas encendidas. */
export function litTiles(st: Structures): Set<number> {
  const out = new Set<number>();
  for (const s of st.all()) {
    const r = s.def.light;
    if (!r || !s.built || !s.powered) continue;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r + 0.5) continue;
        const x = s.x + dx;
        const y = s.y + dy;
        if (inBounds(st.map, x, y)) out.add(index(st.map, x, y));
      }
    }
  }
  return out;
}

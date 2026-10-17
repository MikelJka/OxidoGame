// Electricidad: los cables terminados forman redes; en cada red, los generadores producen, los
// consumidores gastan y las baterías guardan lo que sobra. Números aprobados por Mikel (2026-10-17).
import { inBounds, index } from './map';
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

/** Usa electricidad (produce, consume o guarda). */
export function isElectric(s: Structure): boolean {
  return !!s.def.power || !!s.def.battery;
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
export function updatePower(st: Structures, hours: number): PowerNet[] {
  const { netOf, tiles } = cableNets(st);
  const nets = new Map<number, PowerNet>();
  for (const [id, list] of tiles) {
    nets.set(id, { id, tiles: list, producers: [], consumers: [], batteries: [], production: 0, demand: 0, supplied: 0, stored: 0, capacity: 0 });
  }
  for (const s of st.all()) {
    if (!isElectric(s)) continue;
    s.powered = false;
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
      s.stored = Math.min(s.def.battery, s.stored ?? 0);
      if (net) net.batteries.push(s);
      continue;
    }
    const p = s.def.power ?? 0;
    if (p > 0) {
      // Un generador de combustible solo produce si le queda; lo gasta aunque nadie use la corriente.
      if (f) {
        if ((s.fuel ?? 0) <= 0) continue;
        s.fuel = Math.max(0, (s.fuel ?? 0) - hours / f.hoursPerUnit);
      }
      s.powered = true;
      if (net) {
        net.producers.push(s);
        net.production += p;
      }
    } else if (p < 0 && net) {
      net.consumers.push(s);
      net.demand += -p;
    }
  }
  for (const net of nets.values()) {
    for (const b of net.batteries) {
      net.stored += b.stored ?? 0;
      net.capacity += b.def.battery ?? 0;
    }
    // Primero lo más antiguo: si falta corriente, se apaga lo último que se conectó.
    net.consumers.sort((a, b) => a.id - b.id);
    const fromBatteries = hours > 0 ? net.stored / hours : 0;
    let budget = net.production + fromBatteries;
    for (const c of net.consumers) {
      const need = -(c.def.power ?? 0);
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
      const cap = b.def.battery ?? 0;
      const now = b.stored ?? 0;
      const step = change > 0 ? Math.min(change, cap - now) : Math.max(change, -now);
      b.stored = now + step;
      change -= step;
    }
  }
  return [...nets.values()];
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

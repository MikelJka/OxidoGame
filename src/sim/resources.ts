// Recursos del mapa: qué se puede sacar de cada objeto y cuánto queda. Lógica pura y determinista.
import { RESOURCES, ResourceId } from '../data/resources';
import { GameMap, HarvestInfo, inBounds, index, Prop, PROP_INFO, reachableFrom, rollStock } from './map';
import { Rng } from './rng';

/** Cantidad de cada recurso. */
export type Stockpile = Record<ResourceId, number>;

export function emptyStockpile(): Stockpile {
  return Object.fromEntries(RESOURCES.map((r) => [r, 0])) as Stockpile;
}

/** Suma unas ganancias a un almacén (lo modifica y lo devuelve). */
export function addResources(target: Stockpile, gains: Partial<Stockpile>): Stockpile {
  for (const r of RESOURCES) target[r] += gains[r] ?? 0;
  return target;
}

/** Cómo se aprovecha el objeto de una casilla, o null si no da nada o ya está agotado. */
export function harvestAt(map: GameMap, x: number, y: number): HarvestInfo | null {
  if (!inBounds(map, x, y)) return null;
  const i = index(map, x, y);
  const h = PROP_INFO[map.props[i] as Prop].harvest;
  return h && map.stock[i] > 0 ? h : null;
}

/**
 * Termina de aprovechar el objeto de una casilla: devuelve lo obtenido y deja en su lugar
 * lo que indique su definición (un árbol deja un tocón, una roca grande deja piedras…).
 * null si no hay nada que aprovechar.
 */
export function harvestTile(map: GameMap, x: number, y: number, rng: Rng): Partial<Stockpile> | null {
  const h = harvestAt(map, x, y);
  if (!h) return null;
  const i = index(map, x, y);
  const gains: Partial<Stockpile> = { [h.resource]: map.stock[i] };
  if (h.bonus) {
    const extra = rng.int(h.bonus.amount[0], h.bonus.amount[1]);
    if (extra > 0) gains[h.bonus.resource] = (gains[h.bonus.resource] ?? 0) + extra;
  }
  if (h.find && rng.chance(h.find.chance)) {
    gains[h.find.resource] = (gains[h.find.resource] ?? 0) + rng.int(h.find.amount[0], h.find.amount[1]);
  }
  map.props[i] = h.leaves;
  map.stock[i] = rollStock(h.leaves, rng);
  return gains;
}

/**
 * Recursos que quedan en el mapa (sin contar los extra, que salen al azar).
 * Con `region` (1 = incluida) solo cuenta esas casillas, p. ej. las alcanzables desde el inicio.
 */
export function mapResources(map: GameMap, region?: Uint8Array): Stockpile {
  const total = emptyStockpile();
  for (let i = 0; i < map.props.length; i++) {
    if (region && !region[i]) continue;
    const h = PROP_INFO[map.props[i] as Prop].harvest;
    if (h) total[h.resource] += map.stock[i];
  }
  return total;
}


/**
 * Recursos al alcance de la colonia: los de las casillas a las que se llega a pie desde el inicio
 * y los de los objetos que bloquean el paso pero tienen al lado una casilla alcanzable.
 */
export function reachableResources(map: GameMap): Stockpile {
  const reach = reachableFrom(map, map.start.x, map.start.y);
  const near = new Uint8Array(reach.length);
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (inBounds(map, nx, ny) && reach[index(map, nx, ny)]) {
          near[index(map, x, y)] = 1;
          break;
        }
      }
    }
  }
  return mapResources(map, near);
}

// La naturaleza vuelve: los tocones rebrotan y junto a los árboles nacen matorrales y árboles nuevos.
// Para que la madera no se acabe. Determinista: usa el `Rng` de la partida.
import { GameMap, index, isWater, Prop, rollStock, Terrain } from './map';
import { Rng } from './rng';

/** Casillas al azar que se miran cada hora de juego. */
export const REGROW_SAMPLES = 60;
/** Probabilidad de que un tocón mirado vuelva a ser árbol. */
export const STUMP_REGROW_CHANCE = 0.35;
/** Probabilidad de que nazca algo en una casilla libre junto a un árbol. */
export const SPREAD_CHANCE = 0.25;

/**
 * Una hora de crecimiento. `isFree` dice si en una casilla puede nacer algo (sin construcción,
 * almacén, huerto ni montón). Devuelve las casillas cambiadas (para repintarlas).
 */
export function regrowNature(map: GameMap, rng: Rng, isFree: (x: number, y: number) => boolean): number[] {
  const changed: number[] = [];
  for (let k = 0; k < REGROW_SAMPLES; k++) {
    const x = rng.int(0, map.width - 1);
    const y = rng.int(0, map.height - 1);
    const i = index(map, x, y);
    const p = map.props[i] as Prop;
    if (p === Prop.Stump) {
      if (rng.chance(STUMP_REGROW_CHANCE) && isFree(x, y)) {
        map.props[i] = Prop.DeadTree;
        map.stock[i] = rollStock(Prop.DeadTree, rng);
        changed.push(i);
      }
      continue;
    }
    if (p !== Prop.None || map.cliff[i] || map.blocked[i]) continue;
    const t = map.terrain[i] as Terrain;
    if (isWater(t) || (t !== Terrain.Soil && t !== Terrain.Gravel)) continue;
    if (!nearTree(map, x, y) || !isFree(x, y) || !rng.chance(SPREAD_CHANCE)) continue;
    const grown = rng.chance(0.3) ? Prop.DeadTree : Prop.Bush;
    map.props[i] = grown;
    map.stock[i] = rollStock(grown, rng);
    changed.push(i);
  }
  return changed;
}

function nearTree(map: GameMap, x: number, y: number): boolean {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      const p = map.props[index(map, nx, ny)];
      if (p === Prop.DeadTree || p === Prop.Stump) return true;
    }
  }
  return false;
}

// Ayudas para los tests (no es un archivo de tests).
import { Prop, Terrain } from '../src/sim/map';
import { World } from '../src/sim/world';

/**
 * Partida en un mapa llano de 30 × 30, sin objetos ni provisiones, colonos quietos, con una
 * charca de agua limpia en (1, 1) para que no mueran de sed, y sin sucesos del narrador.
 */
export function flatWorld(colonists = 1, opts: { needs?: boolean; spoilage?: boolean } = {}): World {
  // Sin hambre ni sed salvo que el test vaya de eso (si no, en los tests largos morirían).
  const world = new World({ seed: 7, width: 30, height: 30, colonists, events: false, needs: opts.needs ?? false, spoilage: opts.spoilage ?? false });
  const map = world.map;
  map.terrain.fill(Terrain.Soil);
  map.props.fill(Prop.None);
  map.stock.fill(0);
  map.cliff.fill(0);
  map.slope.fill(0);
  map.level.fill(2);
  map.contaminated.fill(0);
  map.terrain[1 * map.width + 1] = Terrain.Water;
  for (const s of world.items.list()) world.items.take(s.x, s.y, s.amount);
  world.colonists.forEach((c, i) => {
    c.path = [];
    c.tile = { x: 5 + i, y: 5 };
    c.pos = { x: 5.5 + i, y: 5.5 };
    c.activity = 'idle';
    c.waitTicks = 0;
  });
  return world;
}


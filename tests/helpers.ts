// Ayudas para los tests (no es un archivo de tests).
import { Prop, Terrain } from '../src/sim/map';
import { World } from '../src/sim/world';

/** Partida en un mapa llano de 30 × 30, sin objetos ni provisiones, colonos quietos. */
export function flatWorld(colonists = 1): World {
  const world = new World({ seed: 7, width: 30, height: 30, colonists });
  const map = world.map;
  map.terrain.fill(Terrain.Soil);
  map.props.fill(Prop.None);
  map.stock.fill(0);
  map.cliff.fill(0);
  map.slope.fill(0);
  map.level.fill(2);
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


import { describe, expect, it } from 'vitest';
import { recipeDef } from '../src/data/recipes';
import { checkWorld } from '../src/sim/diagnostics';
import { flatWorld } from './helpers';

function buildNow(world: ReturnType<typeof flatWorld>, x: number, y: number, id: string) {
  if (!world.structures.place(x, y, id)) return null;
  const s = world.structures.at(x, y)!;
  for (const [r, n] of Object.entries(s.def.cost)) world.structures.deliver(s, r as never, n as number);
  world.completeStructure(s);
  return s;
}

describe('habitaciones', () => {
  it('un cuarto de muros con puerta es una habitación; con un hueco, no', () => {
    const world = flatWorld();
    // Cuarto de 5×5 por fuera (3×3 por dentro) con una puerta al norte.
    for (let y = 10; y <= 14; y++) for (let x = 10; x <= 14; x++) {
      if (x === 10 || x === 14 || y === 10 || y === 14) buildNow(world, x, y, x === 12 && y === 10 ? 'puerta_madera' : 'muro_piedra');
    }
    const room = world.rooms.at(12, 12)!;
    expect(room).not.toBeNull();
    expect(room.tiles.length).toBe(9);
    expect(room.doors).toBe(1);
    expect(world.rooms.at(5, 5)).toBeNull(); // fuera
    expect(world.rooms.at(12, 10)).toBeNull(); // la puerta no es habitación
    // Se derriba un muro: deja de ser habitación.
    world.demolishStructure(world.structures.at(14, 12)!);
    expect(world.rooms.at(12, 12)).toBeNull();
  });

  it('criterio de la fase 3: se diseña un refugio cerrado y los colonos lo construyen con recursos', () => {
    const world = flatWorld(3);
    world.items.drop(4, 20, 'madera', 200);
    world.structures.placeArea({ x0: 15, y0: 15, x1: 20, y1: 19 }, 'muro_madera', 'contorno');
    world.cancelBlueprint(17, 15);
    world.structures.place(17, 15, 'puerta_madera');
    for (let t = 0; t < 60000 && world.structures.blueprints().length > 0; t++) {
      world.step();
      if (t % 500 === 0) expect(checkWorld(world).filter((p) => !p.key.startsWith('trapped-'))).toEqual([]);
    }
    expect(world.structures.blueprints()).toEqual([]);
    expect(world.rooms.at(17, 17)?.tiles.length).toBe(4 * 3);
  });
});

describe('cantera, recicladora y hormigón', () => {
  it('la cantera saca piedra sin materiales y el horno hace hormigón', () => {
    const world = flatWorld(2);
    const cantera = buildNow(world, 12, 8, 'cantera')!;
    world.structures.setBill(cantera, { recipe: recipeDef('extraer_piedra')!, target: 12, paused: false });
    for (let t = 0; t < 20000 && world.inventory().piedra < 12; t++) world.step();
    expect(world.inventory().piedra).toBeGreaterThanOrEqual(12);
    const horno = buildNow(world, 16, 8, 'horno')!;
    world.items.drop(4, 12, 'chatarra', 10);
    world.structures.setBill(horno, { recipe: recipeDef('hacer_hormigon')!, target: 5, paused: false });
    for (let t = 0; t < 30000 && world.inventory().hormigon < 5; t++) world.step();
    expect(world.inventory().hormigon).toBe(5);
    expect(checkWorld(world)).toEqual([]);
  });
});

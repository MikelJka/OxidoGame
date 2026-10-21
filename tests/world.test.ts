import { describe, expect, it } from 'vitest';
import { findPath, isWalkable } from '../src/sim/pathfinding';
import { generateMap, Terrain } from '../src/sim/map';
import { TICKS_PER_SECOND, World } from '../src/sim/world';

function flatMap(width: number, height: number) {
  const map = generateMap({ width, height, seed: 1 });
  map.terrain.fill(Terrain.Soil);
  map.props.fill(0);
  map.cliff.fill(0);
  map.slope.fill(0);
  return map;
}

describe('findPath', () => {
  it('encuentra un camino recto en terreno libre', () => {
    const map = flatMap(20, 20);
    const path = findPath(map, { x: 2, y: 2 }, { x: 10, y: 2 });
    expect(path).not.toBeNull();
    expect(path!.length).toBe(8);
    expect(path![path!.length - 1]).toEqual({ x: 10, y: 2 });
  });

  it('rodea un muro de roca', () => {
    const map = flatMap(20, 20);
    for (let y = 0; y < 15; y++) map.terrain[y * 20 + 10] = Terrain.Rock;
    const path = findPath(map, { x: 5, y: 5 }, { x: 15, y: 5 })!;
    expect(path).not.toBeNull();
    for (const p of path) expect(isWalkable(map, p.x, p.y)).toBe(true);
    expect(path.some((p) => p.y >= 15)).toBe(true);
  });

  it('devuelve null si el destino está aislado', () => {
    const map = flatMap(20, 20);
    for (let x = 0; x < 20; x++) map.terrain[10 * 20 + x] = Terrain.Water;
    expect(findPath(map, { x: 5, y: 2 }, { x: 5, y: 15 })).toBeNull();
  });

  it('no corta esquinas en diagonal', () => {
    const map = flatMap(10, 10);
    map.terrain[1 * 10 + 2] = Terrain.Rock; // (2,1)
    map.terrain[2 * 10 + 1] = Terrain.Rock; // (1,2)
    const path = findPath(map, { x: 1, y: 1 }, { x: 2, y: 2 })!;
    // No puede dar el paso diagonal directo: tiene que rodear.
    expect(path.length).toBeGreaterThan(1);
  });

  it('prefiere terreno barato', () => {
    const map = flatMap(20, 5);
    // Franja de agua poco profunda (cara) en la fila 2, con desvío libre por la fila 0.
    for (let x = 3; x < 17; x++) map.terrain[2 * 20 + x] = Terrain.ShallowWater;
    const path = findPath(map, { x: 1, y: 2 }, { x: 18, y: 2 })!;
    const wet = path.filter((p) => map.terrain[p.y * 20 + p.x] === Terrain.ShallowWater).length;
    expect(wet).toBe(0);
  });
});

describe('World', () => {
  it('crea 3 colonos en terreno transitable', () => {
    const world = new World({ seed: 42 });
    expect(world.colonists).toHaveLength(3);
    for (const c of world.colonists) {
      expect(isWalkable(world.map, c.tile.x, c.tile.y)).toBe(true);
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.traits.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('es determinista con la misma semilla', () => {
    const a = new World({ seed: 9 });
    const b = new World({ seed: 9 });
    for (let i = 0; i < 2000; i++) {
      a.step();
      b.step();
    }
    expect(a.colonists.map((c) => c.pos)).toEqual(b.colonists.map((c) => c.pos));
  });

  it('los colonos deambulan solos y nunca pisan casillas intransitables', () => {
    const world = new World({ seed: 3 });
    const startPos = world.colonists.map((c) => ({ ...c.pos }));
    for (let i = 0; i < 3000; i++) {
      world.step();
      for (const c of world.colonists) expect(isWalkable(world.map, c.tile.x, c.tile.y)).toBe(true);
    }
    const moved = world.colonists.filter((c, i) => Math.hypot(c.pos.x - startPos[i].x, c.pos.y - startPos[i].y) > 1);
    expect(moved.length).toBeGreaterThan(0);
  });

  it('obedece una orden de movimiento', () => {
    const world = new World({ seed: 5 });
    const c = world.colonists[0];
    const target = { x: c.tile.x + 4, y: c.tile.y };
    // Busca una casilla transitable cercana como destino.
    let goal = target;
    for (let dx = 4; dx > 0; dx--) {
      if (isWalkable(world.map, c.tile.x + dx, c.tile.y)) {
        goal = { x: c.tile.x + dx, y: c.tile.y };
        break;
      }
    }
    expect(world.orderMove(c.id, goal)).toBe(true);
    expect(c.activity).toBe('moving');
    for (let i = 0; i < TICKS_PER_SECOND * 20 && c.path.length > 0; i++) world.step();
    expect(c.tile).toEqual(goal);
  });

  it('respeta las velocidades y la pausa', () => {
    const world = new World({ seed: 1 });
    world.speed = 0;
    expect(world.update(1000)).toBe(0);
    world.speed = 1;
    expect(world.update(1000)).toBe(TICKS_PER_SECOND);
    world.speed = 3;
    expect(world.update(500)).toBe(Math.min(60, TICKS_PER_SECOND * 1.5));
  });

  it('el reloj empieza el día 1 a las 7:00', () => {
    const world = new World({ seed: 1 });
    expect(world.clockLabel()).toBe('Día 1 🌸 · 07:00');
  });
});

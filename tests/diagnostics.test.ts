import { describe, expect, it } from 'vitest';
import { checkWorld, ProgressMark, STUCK_TICKS } from '../src/sim/diagnostics';
import { Terrain } from '../src/sim/map';
import { World } from '../src/sim/world';

function cleanWorld(): World {
  const world = new World({ seed: 7, width: 30, height: 30 });
  world.map.terrain.fill(Terrain.Soil);
  world.map.props.fill(0);
  world.map.cliff.fill(0);
  world.map.slope.fill(0);
  return world;
}

describe('checkWorld', () => {
  it('no encuentra problemas en una partida normal tras simular un rato', () => {
    for (const seed of [1, 2, 3, 42, 999]) {
      const world = new World({ seed });
      const progress = new Map<number, ProgressMark>();
      for (let i = 0; i < 3000; i++) {
        world.step();
        if (i % 100 === 0) expect(checkWorld(world, progress)).toEqual([]);
      }
    }
  });

  it('detecta una posición no numérica', () => {
    const world = cleanWorld();
    world.colonists[0].pos.x = NaN;
    const keys = checkWorld(world).map((p) => p.key);
    expect(keys).toContain(`pos-nan-${world.colonists[0].id}`);
  });

  it('detecta un colono fuera del mapa', () => {
    const world = cleanWorld();
    world.colonists[0].pos = { x: -5, y: 3 };
    expect(checkWorld(world).map((p) => p.key)).toContain(`pos-out-${world.colonists[0].id}`);
  });

  it('detecta un colono sobre agua o roca', () => {
    const world = cleanWorld();
    const c = world.colonists[0];
    world.map.terrain[c.tile.y * world.map.width + c.tile.x] = Terrain.Rock;
    expect(checkWorld(world).map((p) => p.key)).toContain(`blocked-${c.id}`);
  });

  it('detecta caminos con saltos', () => {
    const world = cleanWorld();
    const c = world.colonists[0];
    c.path = [{ x: c.tile.x + 5, y: c.tile.y }];
    expect(checkWorld(world).map((p) => p.key)).toContain(`path-gap-${c.id}`);
  });

  it('detecta un colono atascado con un camino pendiente', () => {
    const world = cleanWorld();
    const c = world.colonists[0];
    const progress = new Map<number, ProgressMark>();
    c.path = [{ x: c.tile.x + 1, y: c.tile.y }];
    expect(checkWorld(world, progress)).toEqual([]);
    world.tick += STUCK_TICKS;
    expect(checkWorld(world, progress).map((p) => p.key)).toContain(`stuck-${c.id}`);
  });
});

import { describe, expect, it } from 'vitest';
import { checkWorld } from '../src/sim/diagnostics';
import { index, isPassable, Terrain } from '../src/sim/map';
import { findPath } from '../src/sim/pathfinding';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { applyTerrainJob, terrainBlocker } from '../src/sim/terrain';
import { flatWorld } from './helpers';

function runUntil(world: ReturnType<typeof flatWorld>, done: () => boolean, maxTicks = 20000): number {
  for (let t = 0; t < maxTicks; t++) {
    if (done()) return t;
    world.step();
    // El aviso de «encerrado» es justo lo que se está arreglando: aquí no cuenta.
    if (t % 250 === 0) expect(checkWorld(world).filter((p) => !p.key.startsWith('trapped-') && !p.key.startsWith('incident-'))).toEqual([]);
  }
  return -1;
}

/** Encierra la casilla (5,5) en un pozo: alrededor, una meseta con acantilados. */
function trap(world: ReturnType<typeof flatWorld>): void {
  const m = world.map;
  for (let y = 2; y <= 8; y++) {
    for (let x = 2; x <= 8; x++) {
      const i = index(m, x, y);
      if (x === 5 && y === 5) continue;
      m.level[i] = 3;
      // El anillo que rodea el pozo es acantilado (borde alto de un desnivel).
      if (Math.abs(x - 5) <= 1 && Math.abs(y - 5) <= 1) m.cliff[i] = 1;
    }
  }
  // Y el borde exterior de la meseta, también acantilado.
  for (let y = 2; y <= 8; y++) for (let x = 2; x <= 8; x++) if (x === 2 || x === 8 || y === 2 || y === 8) m.cliff[index(m, x, y)] = 1;
}

describe('obras de terreno', () => {
  it('rebajar y elevar cambian el nivel y los desniveles nuevos son pendientes', () => {
    const world = flatWorld();
    const m = world.map;
    applyTerrainJob(m, 10, 10, 'elevar');
    expect(m.level[index(m, 10, 10)]).toBe(3);
    expect(m.slope[index(m, 10, 10)]).toBe(1);
    expect(isPassable(m, 10, 10)).toBe(true);
    applyTerrainJob(m, 10, 10, 'rebajar');
    expect(m.level[index(m, 10, 10)]).toBe(2);
    expect(m.slope[index(m, 10, 10)]).toBe(0);
    applyTerrainJob(m, 12, 10, 'rebajar');
    // La vecina queda más alta: pasa a ser pendiente.
    expect(m.slope[index(m, 11, 10)]).toBe(1);
  });

  it('no se hacen obras imposibles', () => {
    const world = flatWorld();
    const m = world.map;
    m.level.fill(1);
    expect(terrainBlocker(m, 3, 3, 'rebajar')).not.toBeNull();
    expect(terrainBlocker(m, 3, 3, 'rampa')).not.toBeNull();
    m.terrain[index(m, 4, 4)] = Terrain.Water;
    expect(terrainBlocker(m, 4, 4, 'elevar')).not.toBeNull();
    m.terrain[index(m, 6, 6)] = Terrain.Rock;
    expect(terrainBlocker(m, 6, 6, 'rebajar')).toBeNull(); // la roca se puede picar
    expect(terrainBlocker(m, 6, 6, 'elevar')).not.toBeNull();
    expect(terrainBlocker(m, 7, 7, 'elevar', true)).not.toBeNull(); // con construcción encima, no
  });

  it('un colono encerrado entre acantilados sale cuando otro hace una rampa', () => {
    const world = flatWorld(2);
    trap(world);
    const [inside, outside] = world.colonists;
    inside.tile = { x: 5, y: 5 };
    inside.pos = { x: 5.5, y: 5.5 };
    outside.tile = { x: 15, y: 5 };
    outside.pos = { x: 15.5, y: 5.5 };
    expect(findPath(world.map, inside.tile, { x: 15, y: 15 })).toBeNull();
    // Rampas en el anillo y en el borde exterior, hacia el este.
    world.terrain.add(6, 5, 'rampa');
    world.terrain.add(8, 5, 'rampa');
    runUntil(world, () => world.terrain.count === 0);
    expect(world.terrain.count).toBe(0);
    expect(findPath(world.map, inside.tile, { x: 15, y: 15 })).not.toBeNull();
  });

  it('los colonos rebajan una casilla y sale piedra', () => {
    const world = flatWorld();
    world.terrain.add(12, 12, 'rebajar');
    runUntil(world, () => world.terrain.count === 0);
    expect(world.map.level[index(world.map, 12, 12)]).toBe(1);
    expect(world.inventory().piedra).toBe(3);
    expect(world.takeChangedTiles().length).toBeGreaterThan(0);
  });

  it('las obras pendientes se guardan con la partida', () => {
    const world = flatWorld();
    world.terrain.add(12, 12, 'elevar');
    const loaded = loadWorld(JSON.stringify(serializeWorld(world)));
    expect(loaded.terrain.list()).toEqual([{ x: 12, y: 12, job: 'elevar' }]);
  });
});

describe('demoler', () => {
  it('un colono derriba lo marcado y se recupera la mitad del material', () => {
    const world = flatWorld();
    world.structures.place(12, 12, 'muro_piedra');
    const s = world.structures.at(12, 12)!;
    world.structures.deliver(s, 'piedra', 6);
    world.completeStructure(s);
    expect(isPassable(world.map, 12, 12)).toBe(false);
    expect(world.demolishArea({ x0: 10, y0: 10, x1: 14, y1: 14 })).toEqual({ planos: 0, demoler: 1 });
    runUntil(world, () => !world.structures.at(12, 12));
    expect(world.structures.at(12, 12)).toBeUndefined();
    expect(isPassable(world.map, 12, 12)).toBe(true);
    expect(world.inventory().piedra).toBe(3);
  });

  it('en un plano, demoler lo quita y devuelve lo ya llevado', () => {
    const world = flatWorld();
    world.structures.place(12, 12, 'muro_madera');
    world.structures.deliver(world.structures.at(12, 12)!, 'madera', 5);
    expect(world.demolishArea({ x0: 12, y0: 12, x1: 12, y1: 12 })).toEqual({ planos: 1, demoler: 0 });
    expect(world.inventory().madera).toBe(5);
  });
});

describe('reclutar y órdenes directas', () => {
  it('un reclutado no trabaja ni deambula, pero obedece', () => {
    const world = flatWorld();
    const c = world.colonists[0];
    world.terrain.add(12, 12, 'rebajar');
    world.setDrafted(c.id, true);
    for (let i = 0; i < 600; i++) world.step();
    expect(c.job).toBeNull();
    expect(c.tile).toEqual({ x: 5, y: 5 });
    expect(world.orderMove(c.id, { x: 8, y: 9 })).toBe(true);
    runUntil(world, () => c.tile.x === 8 && c.tile.y === 9, 2000);
    for (let i = 0; i < 300; i++) world.step();
    expect(c.tile).toEqual({ x: 8, y: 9 }); // se queda donde se le manda
    world.setDrafted(c.id, false);
    runUntil(world, () => world.terrain.count === 0);
    expect(world.terrain.count).toBe(0);
  });

  it('una orden directa hace ese trabajo ya, aunque no estuviera marcado', () => {
    const world = flatWorld();
    const c = world.colonists[0];
    world.map.props[index(world.map, 9, 9)] = 1; // árbol seco
    world.map.stock[index(world.map, 9, 9)] = 20;
    expect(world.hasWorkAt(9, 9)).toBe(true);
    world.setDrafted(c.id, true);
    expect(world.forceJob(c.id, 9, 9)).toBe(true);
    runUntil(world, () => world.inventory().madera > 0);
    expect(world.inventory().madera).toBe(20);
    expect(c.drafted).toBe(true);
    expect(world.forceJob(c.id, 20, 20)).toBe(false); // ahí no hay nada que hacer
  });
});

describe('aviso de colono encerrado', () => {
  it('las comprobaciones avisan si un colono no puede salir y dejan de avisar al abrirle paso', () => {
    const world = flatWorld();
    trap(world);
    const c = world.colonists[0];
    c.tile = { x: 5, y: 5 };
    c.pos = { x: 5.5, y: 5.5 };
    expect(checkWorld(world).some((p) => p.key.startsWith('trapped-'))).toBe(true);
    applyTerrainJob(world.map, 6, 5, 'rampa');
    applyTerrainJob(world.map, 8, 5, 'rampa');
    expect(checkWorld(world).some((p) => p.key.startsWith('trapped-'))).toBe(false);
  });
});

describe('zanjas', () => {
  it('una zanja se cruza muy despacio, no admite montones ni construcciones y se puede rellenar', () => {
    const world = flatWorld();
    const m = world.map;
    world.items.addAt(12, 12, 'madera', 10);
    world.terrain.add(12, 12, 'zanja');
    runUntil(world, () => world.terrain.count === 0);
    expect(m.trench[index(m, 12, 12)]).toBe(1);
    expect(isPassable(m, 12, 12)).toBe(true);
    expect(world.items.at(12, 12)).toBeUndefined();
    expect(world.inventory().madera).toBe(10);
    expect(world.structures.canPlace(12, 12)).toBe(false);
    world.terrain.add(12, 12, 'rellenar');
    runUntil(world, () => world.terrain.count === 0);
    expect(m.trench[index(m, 12, 12)]).toBe(0);
  });

  it('las zanjas se guardan con la partida', () => {
    const world = flatWorld();
    applyTerrainJob(world.map, 7, 7, 'zanja');
    const loaded = loadWorld(JSON.stringify(serializeWorld(world)));
    expect(loaded.map.trench[index(loaded.map, 7, 7)]).toBe(1);
  });
});

describe('estanterías', () => {
  it('en una estantería de un almacén cabe el triple', () => {
    const world = flatWorld();
    world.createStorageZone({ x0: 12, y0: 12, x1: 12, y1: 12 });
    world.structures.place(12, 12, 'estanteria_madera');
    const s = world.structures.at(12, 12)!;
    world.structures.deliver(s, 'madera', 12);
    world.completeStructure(s);
    expect(world.items.room(12, 12, 'madera')).toBe(75 * 3);
    world.items.drop(3, 20, 'madera', 200);
    const busy = () => world.items.list().some((st) => !world.zones.at(st.x, st.y)) || world.colonists.some((c) => c.job);
    for (let t = 0; t < 20000 && busy(); t++) world.step();
    expect(world.items.at(12, 12)!.amount).toBe(200);
    expect(checkWorld(world)).toEqual([]);
  });
});

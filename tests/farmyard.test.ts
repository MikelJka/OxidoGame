// Granja (pedido de Mikel del 2026-10-21): vallas, puertas de valla, postes con cuerda y establos.
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { buildingDef } from '../src/data/buildings';
import { feedPackAnimals, isNightHour, makeAnimal, tameAnimal, tethers, updateAnimal } from '../src/sim/animals';
import { findPath } from '../src/sim/pathfinding';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_DAY } from '../src/sim/time';
import type { World } from '../src/sim/world';

function build(w: World, x: number, y: number, id: string): void {
  expect(w.structures.place(x, y, id)).toBe(true);
  w.completeStructure(w.structures.at(x, y)!);
}

/** Corral de 3 × 3 por dentro (de 11 a 13) con la puerta de valla en (12, 10). */
function pen(w: World): void {
  for (let x = 10; x <= 14; x++)
    for (let y = 10; y <= 14; y++) {
      if (x > 10 && x < 14 && y > 10 && y < 14) continue;
      build(w, x, y, x === 12 && y === 10 ? 'puerta_valla' : 'valla_madera');
    }
}

function put(w: World, kind: Parameters<typeof makeAnimal>[1], x: number, y: number) {
  const a = makeAnimal(w, kind);
  a.tile = { x, y };
  a.pos = { x: x + 0.5, y: y + 0.5 };
  w.others.push(a);
  return a;
}

const noLeave = () => undefined;

describe('granja', () => {
  it('las cuatro piezas están en «Granja»', () => {
    for (const id of ['valla_madera', 'puerta_valla', 'poste_atar', 'establo']) expect(buildingDef(id)?.category).toBe('granja');
    expect(buildingDef('valla_madera')!.blocks).toBe(true);
    expect(buildingDef('puerta_valla')!.blocks).toBe(false);
  });

  it('un corral de vallas no es una habitación (no se le pone tejado)', () => {
    const w = flatWorld(1);
    pen(w);
    expect(w.rooms.at(12, 12)).toBeNull();
  });

  it('los animales no cruzan la puerta de valla, pero los colonos sí', () => {
    const w = flatWorld(1);
    w.map.start = { x: 25, y: 25 };
    pen(w);
    const goat = put(w, 'cabra_salvaje', 12, 12);
    goat.leaveAt = Infinity;
    const seen = new Set<string>();
    for (let t = 0; t < 6000; t++) {
      seen.add(`${goat.tile.x},${goat.tile.y}`);
      updateAnimal(w, goat, noLeave);
      w.tick++;
      expect(goat.tile.x >= 11 && goat.tile.x <= 13 && goat.tile.y >= 11 && goat.tile.y <= 13).toBe(true);
    }
    expect(seen.size).toBeGreaterThan(1);
    // Un colono entra por la puerta.
    const c = w.colonists[0];
    expect(findPath(w.map, c.tile, { x: 12, y: 12 })).not.toBeNull();
  });

  it('el poste ata a dos animales de carga, que no se alejan', () => {
    const w = flatWorld(1);
    w.map.start = { x: 5, y: 5 };
    build(w, 20, 20, 'poste_atar');
    const a = put(w, 'cabra_salvaje', 20, 21);
    const b = put(w, 'cabra_salvaje', 21, 20);
    const c = put(w, 'cabra_salvaje', 6, 6);
    for (const p of [a, b, c]) tameAnimal(w, p);
    const t = tethers(w);
    expect(t.get(a.id)?.x).toBe(20);
    expect(t.get(b.id)?.x).toBe(20);
    expect(t.has(c.id)).toBe(false);
    const moved = new Set<string>();
    for (let k = 0; k < 6000; k++) {
      updateAnimal(w, a, noLeave);
      w.tick++;
      moved.add(`${a.tile.x},${a.tile.y}`);
      expect(Math.abs(a.tile.x - 20) + Math.abs(a.tile.y - 20)).toBeLessThanOrEqual(2);
    }
    // Pasea, pero cerca.
    expect(moved.size).toBeGreaterThan(1);
  });

  it('con establo duermen dentro de noche y comen la mitad', () => {
    const w = flatWorld(1);
    w.map.start = { x: 5, y: 5 };
    build(w, 18, 18, 'establo');
    const a = put(w, 'vaca_dos_cabezas', 10, 10);
    tameAnimal(w, a);
    // De noche va al establo.
    while (!isNightHour(w.hour)) w.tick++;
    for (let k = 0; k < 1500 && isNightHour(w.hour); k++) {
      updateAnimal(w, a, noLeave);
      w.tick++;
    }
    const s = w.structures.at(18, 18)!;
    const tiles = w.structures.tilesOf(s);
    expect(tiles.some((t) => t.x === a.tile.x && t.y === a.tile.y)).toBe(true);
    // Come 1 en lugar de 2.
    w.items.drop(3, 3, 'patata', 10);
    a.fedAt = w.tick - TICKS_PER_DAY;
    feedPackAnimals(w);
    expect(w.items.at(3, 3)?.amount).toBe(9);
    // Se guarda.
    const back = loadWorld(serializeWorld(w));
    expect(back.structures.all().some((x) => x.def.id === 'establo')).toBe(true);
  });
});

describe('abono', () => {
  it('con «Agricultura mejorada», al sembrar se echa 1 de abono y la cosecha da un 25 % más', async () => {
    const { recipeDef } = await import('../src/data/recipes');
    const { FERTILIZER_BONUS } = await import('../src/sim/farming');
    const r = recipeDef('hacer_abono')!;
    expect(r.inputs).toEqual({ setas: 2, piedra: 1 });
    expect(r.outputs).toEqual({ abono: 3 });
    expect(r.research).toBe('agricultura');
    expect(FERTILIZER_BONUS).toBe(1.25);
    const w = flatWorld(1);
    w.farms.create({ x0: 10, y0: 10, x1: 11, y1: 10 });
    w.items.drop(3, 3, 'abono', 1);
    const sow = (x: number, y: number) => (w as unknown as { finishFarmWork(x: number, y: number, a: string): void }).finishFarmWork(x, y, 'sembrar');
    // Sin investigar, no se abona.
    sow(10, 10);
    expect(w.farms.plantAt(10, 10)!.fertilized).toBeUndefined();
    w.research.done.push('agricultura');
    sow(11, 10);
    expect(w.farms.plantAt(11, 10)!.fertilized).toBe(true);
    expect(w.items.at(3, 3)).toBeUndefined();
    // Se guarda.
    expect(loadWorld(serializeWorld(w)).farms.plantAt(11, 10)!.fertilized).toBe(true);
    // Cosecha: misma tirada, un 25 % más.
    w.farms.plantAt(10, 10)!.growth = 1;
    w.farms.plantAt(11, 10)!.growth = 1;
    const a = w.farms.harvest(10, 10, () => 8)!.amount;
    const b = w.farms.harvest(11, 10, () => 8)!.amount;
    expect(b).toBe(Math.round(a * 1.25));
  });
});

describe('espantapájaros, compostera, leche y huevos', () => {
  it('las plantas cerca de un espantapájaros no enferman con la plaga', async () => {
    const { startEvent, scarecrowTiles } = await import('../src/sim/events');
    const w = flatWorld(1);
    w.farms.create({ x0: 10, y0: 10, x1: 13, y1: 11 });
    for (let x = 10; x <= 13; x++) for (let y = 10; y <= 11; y++) w.farms.sow(x, y);
    build(w, 12, 13, 'espantapajaros');
    expect(scarecrowTiles(w).has(11 * w.map.width + 12)).toBe(true);
    // Todo el huerto está guardado: no hay plaga.
    expect(startEvent(w, 'plaga')).toBe(false);
    expect(w.farms.plantList().some((p) => p.plant.sick)).toBe(false);
  });

  it('la compostera deja 2 de abono al día y lo abonado crece un 25 % más deprisa', async () => {
    const { FERTILIZER_GROWTH } = await import('../src/sim/farming');
    const w = flatWorld(1);
    expect(buildingDef('compostera')!.research).toBe('agricultura');
    build(w, 15, 15, 'compostera');
    let got = 0;
    for (let k = 0; k < TICKS_PER_DAY; k++) {
      w.step();
      got = w.items.list().filter((s) => s.resource === 'abono').reduce((t, s) => t + s.amount, 0);
      if (got) break;
    }
    expect(got).toBe(2);
    expect(FERTILIZER_GROWTH).toBe(1.25);
    w.farms.create({ x0: 5, y0: 20, x1: 6, y1: 20 });
    w.farms.sow(5, 20);
    w.farms.sow(6, 20);
    w.farms.plantAt(6, 20)!.fertilized = true;
    w.farms.grow(1000, true, TICKS_PER_DAY);
    expect(w.farms.plantAt(6, 20)!.growth).toBeCloseTo(w.farms.plantAt(5, 20)!.growth * 1.25);
  });

  it('la vaca de dos cabezas da leche y la gallina, huevos, cada día que comen', async () => {
    const w = flatWorld(1);
    w.items.drop(3, 3, 'patata', 20);
    const cow = put(w, 'vaca_dos_cabezas', 10, 10);
    const hen = put(w, 'gallina_mutada', 14, 10);
    tameAnimal(w, cow);
    tameAnimal(w, hen);
    cow.fedAt = hen.fedAt = w.tick - TICKS_PER_DAY;
    feedPackAnimals(w);
    expect(w.items.at(10, 10)).toEqual(expect.objectContaining({ resource: 'leche', amount: 3 }));
    expect(w.items.at(14, 10)).toEqual(expect.objectContaining({ resource: 'huevos', amount: 2 }));
  });
});

describe('nevera y comida que se pone mala', () => {
  it('fuera de la nevera la carne se pone mala; en la nevera con corriente, no; con frío, tampoco', async () => {
    const { spoilHour, inFridge } = await import('../src/sim/spoilage');
    const d = buildingDef('nevera')!;
    expect(d.storage).toBe(6);
    expect(d.storageFor).toBe('comida');
    expect(d.power).toBe(-80);
    const w = flatWorld(1, { spoilage: true });
    build(w, 10, 10, 'nevera');
    const fridge = w.structures.at(10, 10)!;
    // Solo guarda comida, y mucha.
    expect(w.items.maxAt(10, 10, 'carne')).toBe(6 * 75);
    expect(w.items.maxAt(10, 10, 'madera')).toBe(0);
    w.items.drop(10, 10, 'carne', 100);
    w.items.drop(3, 3, 'carne', 60);
    w.tick = 12 * TICKS_PER_DAY; // verano
    // Sin corriente, se pone mala igual.
    expect(inFridge(w, 10, 10)).toBe(false);
    fridge.powered = true;
    expect(inFridge(w, 10, 10)).toBe(true);
    for (let h = 0; h < 24; h++) spoilHour(w);
    expect(w.items.at(10, 10)!.amount).toBe(100);
    const left = w.items.at(3, 3)!.amount;
    // −20 % al día (unos 11 de 60).
    expect(left).toBeLessThan(55);
    expect(left).toBeGreaterThan(40);
    // El maíz aguanta mucho más.
    w.items.drop(5, 5, 'maiz', 50);
    for (let h = 0; h < 24; h++) spoilHour(w);
    expect(w.items.at(5, 5)!.amount).toBeGreaterThanOrEqual(47);
    // En una ola de frío, nada.
    const { startEvent } = await import('../src/sim/events');
    startEvent(w, 'ola_frio');
    const before = w.items.at(3, 3)!.amount;
    for (let h = 0; h < 24; h++) spoilHour(w);
    expect(w.items.at(3, 3)!.amount).toBe(before);
  });
});

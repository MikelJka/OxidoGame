import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_HOUR } from '../src/sim/world';
import { buildingDef } from '../src/data/buildings';
import { checkWorld } from '../src/sim/diagnostics';

function buildNow(world: ReturnType<typeof flatWorld>, x: number, y: number, id: string, rot: 0 | 1 = 0) {
  expect(world.structures.place(x, y, id, rot)).toBe(true);
  const s = world.structures.at(x, y)!;
  for (const [r, n] of Object.entries(s.def.cost)) world.structures.deliver(s, r as never, n as number);
  world.completeStructure(s);
  return s;
}

describe('mover muebles', () => {
  it('se mueven camas, armarios, estanterías, armeros, lámparas y talleres; no muros ni máquinas', () => {
    for (const id of ['cama', 'cama_prision', 'armario', 'estanteria_madera', 'estanteria_metal', 'armero', 'lampara', 'cocina', 'horno', 'banco_trabajo']) {
      expect(buildingDef(id).movable, id).toBe(true);
    }
    for (const id of ['muro_madera', 'generador_lena', 'recicladora', 'puerta_madera', 'pozo', 'cantera']) {
      expect(buildingDef(id).movable, id).toBeFalsy();
    }
  });

  it('un colono desmonta la cama, la lleva y la monta en el sitio nuevo, sin gastar nada', () => {
    const world = flatWorld(1);
    const bed = buildNow(world, 10, 10, 'cama');
    const inv = { ...world.inventory() };
    expect(world.orderMoveStructure(bed.id, 20, 15, 1)).toBe(true);
    let lifted = false;
    for (let t = 0; t < TICKS_PER_HOUR * 6 && bed.moveTo; t++) {
      world.step();
      if (bed.lifted) lifted = true;
    }
    expect(lifted).toBe(true);
    expect(bed.moveTo).toBeUndefined();
    expect(world.structures.at(10, 10)).toBeUndefined();
    expect(world.structures.at(20, 15)).toBe(bed);
    expect(world.structures.at(20, 16)).toBe(bed); // girada: ocupa en vertical
    expect(bed.built).toBe(true);
    expect(world.inventory()).toEqual(inv);
  });

  it('un taller conserva su orden; uno electrificado no se mueve', () => {
    const world = flatWorld(1);
    const bench = buildNow(world, 8, 8, 'banco_trabajo');
    const cook = buildNow(world, 14, 8, 'cocina');
    cook.electric = true;
    expect(world.orderMoveStructure(cook.id, 14, 14, 0)).toBe(false);
    // Moverlo una casilla a la derecha (pisando su propio sitio) sí vale.
    expect(world.orderMoveStructure(bench.id, 9, 8, 0)).toBe(true);
    for (let t = 0; t < TICKS_PER_HOUR * 4 && bench.moveTo; t++) world.step();
    expect(world.structures.at(9, 8)).toBe(bench);
    expect(world.structures.at(10, 8)).toBe(bench);
    expect(world.structures.at(8, 8)).toBeUndefined();
  });

  it('no se puede llevar donde no cabe, y la orden se puede quitar', () => {
    const world = flatWorld(0);
    const bed = buildNow(world, 10, 10, 'cama');
    buildNow(world, 20, 20, 'muro_madera');
    expect(world.orderMoveStructure(bed.id, 19, 20, 0)).toBe(false); // pisaría el muro
    expect(world.orderMoveStructure(bed.id, 15, 15, 0)).toBe(true);
    expect(world.cancelMoveStructure(bed.id)).toBe(true);
    expect(bed.moveTo).toBeUndefined();
  });

  it('si el sitio nuevo se ocupa mientras lo lleva, vuelve a donde estaba', () => {
    const world = flatWorld(1);
    const bed = buildNow(world, 10, 10, 'cama');
    world.orderMoveStructure(bed.id, 22, 22, 0);
    for (let t = 0; t < TICKS_PER_HOUR * 4 && !bed.lifted; t++) world.step();
    expect(bed.lifted).toBe(true);
    buildNow(world, 22, 22, 'muro_madera');
    for (let t = 0; t < TICKS_PER_HOUR * 4 && bed.lifted; t++) world.step();
    expect(bed.lifted).toBeFalsy();
    expect(world.structures.at(10, 10)).toBe(bed);
    expect(bed.moveTo).toBeUndefined();
  });

  it('la orden de mover se guarda; si se guarda mientras la lleva, carga en su sitio de antes', () => {
    const world = flatWorld(1);
    const bed = buildNow(world, 10, 10, 'cama');
    world.orderMoveStructure(bed.id, 20, 20, 0);
    const a = loadWorld(JSON.parse(JSON.stringify(serializeWorld(world))));
    expect(a.structures.at(10, 10)?.moveTo).toEqual({ x: 20, y: 20, rot: 0 });
    for (let t = 0; t < TICKS_PER_HOUR * 4 && !bed.lifted; t++) world.step();
    expect(bed.lifted).toBe(true);
    const b = loadWorld(JSON.parse(JSON.stringify(serializeWorld(world))));
    const back = b.structures.at(10, 10)!;
    expect(back.def.id).toBe('cama');
    expect(back.moveTo).toEqual({ x: 20, y: 20, rot: 0 });
  });
  it('mientras lo lleva y lo monta, tiene reservado el sitio nuevo (#19)', () => {
    const world = flatWorld(2);
    const bed = buildNow(world, 10, 10, 'cama');
    world.orderMoveStructure(bed.id, 20, 15, 0);
    let checkedLifted = false;
    for (let t = 0; t < TICKS_PER_HOUR * 6 && bed.moveTo; t++) {
      world.step();
      const keys = checkWorld(world).map((p) => p.key);
      expect(keys.filter((k) => k.startsWith('job-unreserved') || k.startsWith('reservation-orphan'))).toEqual([]);
      if (bed.lifted) {
        const mover = world.colonists.find((c) => c.job?.move === 'montar');
        if (mover) {
          expect(world.reservations.holder(20, 15)).toBe(mover.id);
          checkedLifted = true;
        }
      }
    }
    expect(checkedLifted).toBe(true);
    expect(world.structures.at(20, 15)).toBe(bed);
  });
});

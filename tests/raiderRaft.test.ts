// Update del agua: saqueadores que llegan en balsa por el río (decidido por Mikel el 2026-10-21).
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { RAIDER_RAFT, RAIDER_VEHICLE, vehicleDef } from '../src/data/vehicles';
import { Terrain } from '../src/sim/map';
import { startRaid } from '../src/sim/people';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/sim/time';
import { fits, riders } from '../src/sim/vehicles';
import type { World } from '../src/sim/world';

/** Un río de agua normal en las columnas `x0`–`x0+2`, de borde a borde. */
function river(w: World, x0: number): void {
  const m = w.map;
  for (let y = 0; y < m.height; y++) for (let x = x0; x < x0 + 3; x++) m.terrain[y * m.width + x] = Terrain.Water;
}

/** Partida el día 15, con la colonia en (8, 15) y un río en las columnas `x0`–`x0+2`. */
function setup(x0 = 20): World {
  const w = flatWorld(1);
  river(w, x0);
  w.map.start = { x: 8, y: 15 };
  const [c] = w.colonists;
  c.tile = { x: 8, y: 15 };
  c.pos = { x: 8.5, y: 15.5 };
  w.tick = 14 * TICKS_PER_DAY;
  return w;
}

const rafts = (w: World) => w.vehicles.filter((v) => v.def === 'balsa_saqueadores');

describe('saqueadores en balsa', () => {
  it('los números decididos por Mikel', () => {
    const d = vehicleDef('balsa_saqueadores')!;
    expect(RAIDER_RAFT).toBe(d);
    expect(RAIDER_VEHICLE?.id).toBe('buggy_saqueador');
    expect(d.hostile).toBe(true);
    expect(d.water).toBe(true);
    expect(d.fromDay).toBe(15);
    expect(d.raidChance).toBe(0.5);
    expect(d.raft).toEqual({ nearRiver: 15, raidersPerRaft: 3, reboardRange: 8 });
  });

  it('1 balsa por cada 3 saqueadores, con 2 dentro, si el río pasa a 15 casillas o menos', () => {
    const w = setup();
    const raid = startRaid(w, 7, false, true);
    expect(rafts(w).length).toBe(2);
    const aboard = raid.filter((r) => r.vehicle?.boarded);
    expect(aboard.length).toBe(4);
    expect(aboard.every((r) => r.raider?.raft !== undefined)).toBe(true);
    for (const v of rafts(w)) {
      expect(riders(w, v).map((r) => r.vehicle!.seat).sort()).toEqual(['conductor', 'tirador']);
    }
    expect(w.log.some((l) => l.text.includes('por el río en 🛶 balsa'))).toBe(true);
  });

  it('con el río lejos de la colonia, nadie llega en balsa', () => {
    const w = setup(27);
    startRaid(w, 6, false, true);
    expect(rafts(w).length).toBe(0);
  });

  it('reman hasta la orilla más cercana a la colonia, desembarcan y la balsa se queda', () => {
    const w = setup();
    startRaid(w, 3, false, true);
    const [v] = rafts(w);
    expect(v).toBeDefined();
    let t = 0;
    for (; t < 2 * TICKS_PER_HOUR * 6 && riders(w, v).length > 0; t++) w.step();
    expect(riders(w, v).length).toBe(0);
    // En la orilla izquierda del río (la de la colonia), a la altura de la colonia.
    expect(v.x).toBe(20);
    expect(Math.abs(v.y + 1 - 15)).toBeLessThanOrEqual(2);
    expect(rafts(w).length).toBe(1);
  });

  it('un puente corta el río: la balsa se para antes; un puente levadizo bajado, no', () => {
    const w = setup();
    for (let x = 20; x < 23; x++) {
      expect(w.structures.place(x, 20, 'puente_madera')).toBe(true);
      w.completeStructure(w.structures.floorAt(x, 20)!);
    }
    const def = RAIDER_RAFT!;
    expect(fits(w, 20, 19, def)).toBe(false);
    startRaid(w, 3, false, true);
    const [v] = rafts(w);
    expect(v).toBeDefined();
    // Llega desde abajo (el borde más cercano) y no pasa del puente.
    for (let t = 0; t < 12 * TICKS_PER_HOUR && riders(w, v).length > 0; t++) {
      w.step();
      expect(v.y).toBeGreaterThan(20);
    }
    expect(riders(w, v).length).toBe(0);

    const w2 = setup();
    expect(w2.structures.place(19, 10, 'puente_levadizo')).toBe(true);
    w2.completeStructure(w2.structures.at(20, 10)!);
    expect(fits(w2, 20, 10, def)).toBe(true); // bajado, los saqueadores pasan por debajo
    expect(fits(w2, 20, 10, vehicleDef('balsa'))).toBe(false); // la de los colonos, no
  });

  it('al huir, vuelven a la balsa si la tienen a 8 casillas o menos y se van por el río', () => {
    const w = setup();
    const raid = startRaid(w, 3, false, true);
    const [v] = rafts(w);
    for (let t = 0; t < 12 * TICKS_PER_HOUR && riders(w, v).length > 0; t++) w.step();
    expect(riders(w, v).length).toBe(0);
    const crew = raid.filter((r) => r.raider?.raft === v.id);
    expect(crew.length).toBe(2);
    for (const r of raid) {
      r.raider!.fleeing = true;
      r.path = [];
    }
    let boarded = false;
    for (let t = 0; t < 12 * TICKS_PER_HOUR && rafts(w).length > 0; t++) {
      w.step();
      if (riders(w, v).length > 0) boarded = true;
    }
    expect(boarded).toBe(true);
    expect(rafts(w).length).toBe(0);
    expect(w.log.some((l) => l.text.includes('huye río abajo'))).toBe(true);
  });

  it('sin nadie que pueda volver, la balsa se rompe (🪵8)', () => {
    const w = setup();
    const raid = startRaid(w, 3, false, true);
    const [v] = rafts(w);
    for (let t = 0; t < 12 * TICKS_PER_HOUR && riders(w, v).length > 0; t++) w.step();
    for (const r of raid) if (r.raider?.raft === v.id) w.killPawn(r, 'heridas');
    w.step();
    expect(rafts(w).length).toBe(0);
    expect(w.inventory().madera).toBeGreaterThanOrEqual(8);
  });

  it('la balsa de cada saqueador se guarda', () => {
    const w = setup();
    const raid = startRaid(w, 3, false, true);
    const id = raid.find((r) => r.raider?.raft !== undefined)!.id;
    const back = loadWorld(serializeWorld(w));
    const again = back.others.find((o) => o.id === id)!;
    expect(again.raider?.raft).toBe(rafts(back)[0].id);
  });
});

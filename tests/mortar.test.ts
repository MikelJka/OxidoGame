import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { buildingDef } from '../src/data/buildings';
import { addResearch, chooseResearch } from '../src/sim/research';
import { mortarShots, mortarTarget, updateMortars } from '../src/sim/mortar';
import { updateGrenades } from '../src/sim/grenades';
import { updateTurrets } from '../src/sim/people';
import { loadWorld, serializeWorld } from '../src/sim/save';
import type { World } from '../src/sim/world';
import type { Colonist } from '../src/sim/colonist';

function raider(w: World, x: number, y: number): Colonist {
  const r = w.makePawn('saqueador');
  r.tile = { x, y };
  r.pos = { x: x + 0.5, y: y + 0.5 };
  r.raider = { fleeing: false, leaveAt: w.tick + 999999 };
  w.others.push(r);
  return r;
}

function place(c: Colonist, x: number, y: number): void {
  c.tile = { x, y };
  c.pos = { x: x + 0.5, y: y + 0.5 };
  c.path = [];
}

/** Mortero construido en (3, 15) con `ammo` de chatarra y un colono reclutado pegado a él. */
function setup(ammo = 20) {
  const w = flatWorld(1);
  expect(w.structures.place(3, 15, 'mortero')).toBe(true);
  const s = w.structures.mainAt(3, 15)!;
  w.completeStructure(s);
  s.fuel = ammo;
  const c = w.colonists[0];
  place(c, 4, 15);
  w.setDrafted(c.id, true);
  return { w, s, c };
}

/** Avanza el mortero y sus proyectiles `ticks` ticks. */
function run(w: World, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    w.tick++;
    updateTurrets(w); // lleva la cuenta del tiempo entre disparos
    updateMortars(w);
    updateGrenades(w);
  }
}

describe('mortero', () => {
  it('los números del catálogo: 🔗20 ⚙️4 🔩10, 1×1, con «Artillería»; 🔩2 por disparo, 6–20 casillas, falla un 40 %', () => {
    const d = buildingDef('mortero');
    expect(d.cost).toEqual({ metal: 20, componentes: 4, chatarra: 10 });
    expect(d.size).toBeUndefined();
    expect(d.research).toBe('artilleria');
    expect(d.mortar).toMatchObject({ minReach: 6, reach: 20, ammoPerShot: 2, missChance: 0.4, ammo: { resource: 'chatarra' } });
    const w = flatWorld(0);
    expect(w.canBuild('mortero')).toBe(false);
    w.research.done.push('torretas');
    chooseResearch(w.research, 'artilleria');
    addResearch(w.research, 1e9);
    expect(w.canBuild('mortero')).toBe(true);
  });

  it('manejado por un reclutado pegado a él, dispara al grupo a 6–20 casillas, gasta 🔩2 y hace daño', () => {
    const { w, s } = setup();
    const a = raider(w, 15, 15);
    const b = raider(w, 15, 16);
    expect(mortarTarget(w, s)).not.toBeNull();
    run(w, 1);
    expect(s.fuel).toBe(18);
    expect(w.grenades.length).toBe(1);
    expect(w.grenades[0].shell).toBe(true);
    // Varios disparos: alguno cae encima y les hace daño.
    run(w, 30 * 60);
    expect(a.health + b.health).toBeLessThan(2);
    expect(mortarShots(s)).toBeLessThan(10);
  });

  it('no dispara sin quien lo maneje, sin munición, demasiado cerca o con un colono junto al objetivo', () => {
    for (const k of ['sin reclutar', 'lejos del mortero', 'sin munición', 'cerca', 'colono al lado'] as const) {
      const { w, c } = setup(k === 'sin munición' ? 1 : 20);
      if (k === 'sin reclutar') w.setDrafted(c.id, false);
      if (k === 'lejos del mortero') place(c, 6, 15);
      const x = k === 'cerca' ? 7 : 15;
      raider(w, x, 15);
      if (k === 'colono al lado') {
        const helper = w.makePawn('colono');
        place(helper, 16, 15);
        w.colonists.push(helper);
      }
      run(w, 30);
      expect(w.grenades.length, k).toBe(0);
    }
  });

  it('los colonos le llevan chatarra del almacén hasta llenarlo', () => {
    const { w, s, c } = setup(0);
    w.setDrafted(c.id, false);
    w.items.drop(8, 8, 'chatarra', 30);
    for (let i = 0; i < 30 * 600 && (s.fuel ?? 0) < 10; i++) w.step();
    expect(s.fuel ?? 0).toBeGreaterThanOrEqual(10);
  });

  it('la munición y los proyectiles en el aire se guardan', () => {
    const { w, s } = setup(12);
    raider(w, 15, 15);
    run(w, 1);
    const back = loadWorld(serializeWorld(w));
    expect(back.structures.mainAt(s.x, s.y)!.fuel).toBe(10);
    expect(back.grenades[0]?.shell).toBe(true);
  });
});

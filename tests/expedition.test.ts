// Bases de las facciones, segunda parte: atacar una base con un mapa de batalla (elegido por Mikel el 2026-10-21).
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { finishBattle, retreat, startExpedition } from '../src/sim/expedition';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_HOUR } from '../src/sim/time';
import type { World } from '../src/sim/world';

function arrive(w: World): World {
  w.tick = w.expedition!.arriveAt - (w.expedition!.arriveAt % TICKS_PER_HOUR) + TICKS_PER_HOUR - 1;
  w.step();
  return w.pendingBattle!;
}

describe('expediciones', () => {
  it('los colonos salen, viajan y al llegar se abre el mapa de batalla con la base', () => {
    const w = flatWorld(3);
    w.map.start = { x: 15, y: 15 };
    const f = w.factions.find((k) => k.id === 'granjeros')!;
    const ids = w.colonists.slice(0, 2).map((c) => c.id);
    expect(startExpedition(w, 'granjeros', ids)).toBeNull();
    expect(w.colonists.length).toBe(1);
    expect(f.relation).toBe(-100); // atacarles los pone en guerra
    expect(startExpedition(w, 'chatarreros', [w.colonists[0].id])).toContain('Ya hay');
    // Se guarda de camino.
    const back = loadWorld(serializeWorld(w));
    expect(back.expedition?.members.length).toBe(2);
    const b = arrive(w);
    expect(b).toBeTruthy();
    expect(b.battle?.faction).toBe('granjeros');
    expect(b.colonists.map((c) => c.id).sort()).toEqual(ids.sort());
    expect(b.colonists.every((c) => c.drafted)).toBe(true);
    expect(b.others.filter((o) => o.role === 'saqueador').length).toBeGreaterThanOrEqual(2);
    expect(b.structures.all().some((s) => s.def.category === 'muro')).toBe(true);
    // Guardar durante la batalla guarda la colonia.
    expect(loadWorld(serializeWorld(b)).colonists.length).toBe(1);
  });

  it('al ganar, la facción desaparece, quedan sus ruinas y vuelven con el botín', () => {
    const w = flatWorld(2);
    w.map.start = { x: 15, y: 15 };
    startExpedition(w, 'granjeros', [w.colonists[0].id]);
    const b = arrive(w);
    for (const o of [...b.others]) if (o.role === 'saqueador') b.killPawn(o, 'heridas', true);
    for (let k = 0; k < 31; k++) b.step();
    expect(b.battle?.result).toBe('victoria');
    finishBattle(b);
    expect(w.factions.some((f) => f.id === 'granjeros')).toBe(false);
    expect(w.ruins.length).toBe(1);
    expect(w.expedition?.phase).toBe('vuelta');
    expect(Object.values(w.expedition!.loot).some((n) => (n ?? 0) > 0)).toBe(true);
    const before = Object.values(w.inventory()).reduce((a, n) => a + n, 0);
    w.tick = w.expedition!.arriveAt - (w.expedition!.arriveAt % TICKS_PER_HOUR) + TICKS_PER_HOUR - 1;
    w.step();
    expect(w.expedition).toBeNull();
    expect(w.colonists.length).toBe(2);
    expect(Object.values(w.inventory()).reduce((a, n) => a + n, 0)).toBeGreaterThan(before);
  });

  it('retirarse: vuelven sin botín y la facción sigue', () => {
    const w = flatWorld(1);
    w.map.start = { x: 15, y: 15 };
    startExpedition(w, 'chatarreros', [w.colonists[0].id]);
    const b = arrive(w);
    retreat(b);
    finishBattle(b);
    expect(w.factions.some((f) => f.id === 'chatarreros')).toBe(true);
    expect(w.expedition?.result).toBe('retirada');
    expect(w.expedition?.loot).toEqual({});
  });
});

describe('batalla en directo', () => {
  it('se puede pelear un rato sin errores y acaba', () => {
    const w = flatWorld(3);
    w.map.start = { x: 15, y: 15 };
    for (const c of w.colonists) {
      c.weapon = 'rifle';
      c.ammo = 60;
      c.skills.combate = 12;
    }
    startExpedition(w, 'granjeros', w.colonists.map((c) => c.id));
    const b = arrive(w);
    for (let t = 0; t < 20000 && !b.battle!.result; t++) b.step();
    expect(b.battle!.result).toBeDefined();
  });
});

describe('ocupar las ruinas', () => {
  it('unos colonos van a vivir a las ruinas: colonia nueva que comparte facciones y se guarda dentro de la principal', async () => {
    const { allColonies, startSettling } = await import('../src/sim/expedition');
    const w = flatWorld(3);
    w.map.start = { x: 15, y: 15 };
    startExpedition(w, 'granjeros', [w.colonists[0].id]);
    const b = arrive(w);
    for (const o of [...b.others]) if (o.role === 'saqueador') b.killPawn(o, 'heridas', true);
    for (let k = 0; k < 31; k++) b.step();
    finishBattle(b);
    w.tick = w.expedition!.arriveAt - (w.expedition!.arriveAt % TICKS_PER_HOUR) + TICKS_PER_HOUR - 1;
    w.step();
    expect(w.ruins.length).toBe(1);
    const ruin = w.ruins[0].name;
    expect(startSettling(w, ruin, w.colonists.map((c) => c.id))).toContain('quedarse');
    expect(startSettling(w, ruin, [w.colonists[0].id])).toBeNull();
    w.tick = w.expedition!.arriveAt - (w.expedition!.arriveAt % TICKS_PER_HOUR) + TICKS_PER_HOUR - 1;
    w.step();
    expect(w.outposts.length).toBe(1);
    expect(w.ruins.length).toBe(0);
    const o = w.outposts[0].world;
    expect(o.colonists.length).toBe(1);
    expect(o.factions).toBe(w.factions);
    expect(allColonies(o).length).toBe(2);
    for (let k = 0; k < 200; k++) o.step();
    // Guardar desde la colonia ocupada guarda la principal, con la ocupada dentro.
    const back = loadWorld(serializeWorld(o));
    expect(back.colonists.length).toBe(2);
    expect(back.outposts.length).toBe(1);
    expect(back.outposts[0].world.colonists.length).toBe(1);
    expect(back.outposts[0].world.factions).toBe(back.factions);
  });
});

describe('carga de las expediciones', () => {
  it('llevan lo que aguanten por peso, en el buggy más (y el viaje es más corto); lo que sobra vuelve', async () => {
    const { expeditionCapacity } = await import('../src/sim/expedition');
    const w = flatWorld(2);
    w.map.start = { x: 15, y: 15 };
    w.items.drop(6, 6, 'piedra', 50);
    w.items.drop(7, 6, 'comida', 20);
    const ids = [w.colonists[0].id];
    expect(expeditionCapacity(w, 1)).toBe(35);
    expect(startExpedition(w, 'granjeros', ids, { piedra: 50 })).toContain('Demasiada carga');
    const v = w.addVehicle('buggy', 20, 20);
    expect(expeditionCapacity(w, 1, [v.id])).toBe(335);
    expect(startExpedition(w, 'granjeros', ids, { piedra: 50, comida: 10 }, [v.id])).toBeNull();
    expect(w.vehicles.length).toBe(0);
    expect(w.inventory().piedra).toBe(0);
    expect(w.inventory().comida).toBe(10);
    const back = loadWorld(serializeWorld(w));
    expect(back.expedition?.supplies).toEqual({ piedra: 50, comida: 10 });
    expect(back.expedition?.vehicles?.length).toBe(1);
    const b = arrive(w);
    expect(b.vehicles.length).toBe(1);
    expect(b.inventory().piedra).toBe(50);
    retreat(b);
    finishBattle(b);
    expect(w.expedition?.loot.piedra).toBe(50);
    w.tick = w.expedition!.arriveAt - (w.expedition!.arriveAt % TICKS_PER_HOUR) + TICKS_PER_HOUR - 1;
    w.step();
    expect(w.vehicles.length).toBe(1);
    expect(w.inventory().piedra).toBe(50);
  });
});

describe('colonias a la vez', () => {
  it('el tiempo corre en todas las colonias a la vez', () => {
    const w = flatWorld(1);
    const o = flatWorld(1);
    o.outpostHome = w;
    w.outposts.push({ name: 'X', world: o });
    w.speed = 1;
    const t0 = o.tick;
    w.update(1000);
    expect(o.tick).toBe(t0 + 30);
    o.speed = 1;
    const m0 = w.tick;
    o.update(1000);
    expect(w.tick).toBe(m0 + 30);
  });
});

describe('ataques y sucesos: vuelta a x1 sin pararse', () => {
  it('un raid en cualquier colonia pone la partida a x1; durante una batalla, la colonia sigue', async () => {
    const { startRaid } = await import('../src/sim/people');
    const w = flatWorld(2);
    w.map.start = { x: 15, y: 15 };
    w.speed = 3;
    startRaid(w, 1, false, false);
    w.update(100);
    expect(w.speed).toBe(1);
    startExpedition(w, 'granjeros', [w.colonists[0].id]);
    const b = arrive(w);
    const t0 = w.tick;
    b.speed = 1;
    b.update(1000);
    expect(w.tick).toBe(t0 + 30);
  });
});

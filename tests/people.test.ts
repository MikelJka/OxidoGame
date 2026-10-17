import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { attack, dealBalance, makeDeal, makePrisoner, startRaid, startTrader, talkToPrisoner } from '../src/sim/people';
import { hurt, tickHealth } from '../src/sim/health';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/sim/world';
import type { Colonist } from '../src/sim/colonist';

function runTicks(w: ReturnType<typeof flatWorld>, n: number, until?: () => boolean): void {
  for (let i = 0; i < n; i++) {
    w.step();
    if (until?.()) return;
  }
}

/** Saqueador puesto a mano en una casilla. */
function raiderAt(w: ReturnType<typeof flatWorld>, x: number, y: number): Colonist {
  const r = w.makePawn('saqueador');
  r.tile = { x, y };
  r.pos = { x: x + 0.5, y: y + 0.5 };
  r.raider = { fleeing: false, leaveAt: w.tick + TICKS_PER_DAY };
  w.others.push(r);
  return r;
}

describe('salud', () => {
  it('sin comida ni agua, un colono acaba muriendo y la partida termina', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    c.needs.food = 0;
    c.needs.water = 0;
    runTicks(w, TICKS_PER_DAY * 2, () => w.gameOver !== null);
    expect(w.colonists.length).toBe(0);
    expect(w.gameOver).not.toBeNull();
    expect(w.graveyard[0].name).toBe(c.name);
  });

  it('un herido grave cae al suelo y se levanta al recuperarse', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    hurt(c, 0.9, 'el pecho');
    expect(c.downed).toBe(true);
    c.wounds.forEach((k) => (k.bleeding = false));
    for (let i = 0; i < 40 && c.downed; i++) tickHealth(c, TICKS_PER_DAY / 10, TICKS_PER_DAY, true);
    expect(c.downed).toBe(false);
  });
});

describe('raids', () => {
  it('llegan saqueadores por el borde', () => {
    const w = flatWorld(2);
    const raid = startRaid(w, 3);
    expect(raid.length).toBe(3);
    expect(w.others.filter((o) => o.role === 'saqueador').length).toBe(3);
    expect(w.log.some((l) => l.text.includes('Raid'))).toBe(true);
  });

  it('un colono reclutado pelea con el saqueador que tiene al lado hasta tumbarlo o hacerlo huir', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    c.skills.combate = 15;
    w.setDrafted(c.id, true);
    const r = raiderAt(w, 6, 5);
    r.skills.combate = 0;
    runTicks(w, TICKS_PER_HOUR, () => r.downed || !!r.raider?.fleeing || !w.others.includes(r));
    expect(r.health).toBeLessThan(1);
  });

  it('los golpes hieren y pueden tumbar', () => {
    const w = flatWorld(1);
    const a = w.colonists[0];
    const b = raiderAt(w, 6, 5);
    a.skills.combate = 20;
    for (let i = 0; i < 60 && !b.downed; i++) attack(w, a, b);
    expect(b.downed).toBe(true);
    expect(b.wounds.length).toBeGreaterThan(0);
  });
});

describe('prisioneros', () => {
  it('el carcelero captura a un saqueador caído', () => {
    const w = flatWorld(1);
    const r = raiderAt(w, 9, 5);
    hurt(r, 0.95, 'la pierna izquierda');
    expect(r.downed).toBe(true);
    runTicks(w, 2000, () => r.role === 'prisionero');
    expect(r.role).toBe('prisionero');
    expect(r.prisoner?.mode).toBe('retener');
  });

  it('el médico cura las heridas que sangran', () => {
    const w = flatWorld(2);
    const [, patient] = w.colonists;
    hurt(patient, 0.2, 'el brazo derecho');
    expect(patient.wounds.some((k) => k.bleeding)).toBe(true);
    runTicks(w, 2000, () => !patient.wounds.some((k) => k.bleeding));
    expect(patient.wounds.some((k) => k.bleeding)).toBe(false);
  });

  it('el capturado se lleva a una cama de prisionero si la hay', () => {
    const w = flatWorld(1);
    w.structures.place(12, 10, 'cama_prision');
    w.completeStructure(w.structures.at(12, 10)!);
    const r = raiderAt(w, 8, 5);
    hurt(r, 0.95, 'la cabeza');
    runTicks(w, 4000, () => r.role === 'prisionero' && r.carriedBy === undefined && r.tile.x === 12);
    expect(r.tile).toEqual({ x: 12, y: 10 });
  });

  it('a fuerza de charlas un prisionero se une a la colonia', () => {
    const w = flatWorld(1);
    const warden = w.colonists[0];
    warden.skills.social = 10;
    const p = raiderAt(w, 8, 8);
    makePrisoner(p, 0.3);
    p.prisoner!.mode = 'convencer';
    let joined = false;
    for (let i = 0; i < 30 && !joined; i++) {
      w.tick += 7 * TICKS_PER_HOUR;
      joined = talkToPrisoner(w, warden, p);
    }
    expect(joined).toBe(true);
    expect(w.colonists).toContain(p);
    expect(p.role).toBe('colono');
    expect(new Set(w.colonists.map((c) => c.id)).size).toBe(w.colonists.length);
  });

  it('el carcelero habla solo con los que hay que convencer', () => {
    const w = flatWorld(1);
    const p = raiderAt(w, 8, 8);
    makePrisoner(p, 0.8);
    p.needs.food = 1;
    p.needs.water = 1;
    runTicks(w, 600);
    expect(p.prisoner!.resistance).toBe(0.8);
    p.prisoner!.mode = 'convencer';
    runTicks(w, 1500, () => p.prisoner!.resistance < 0.8);
    expect(p.prisoner!.resistance).toBeLessThan(0.8);
  });

  it('un prisionero liberado se marcha del mapa', () => {
    const w = flatWorld(1);
    const p = raiderAt(w, 3, 3);
    makePrisoner(p, 0.5);
    p.prisoner!.mode = 'liberar';
    runTicks(w, 3000, () => !w.others.includes(p));
    expect(w.others).not.toContain(p);
  });
});

describe('comercio', () => {
  it('se compran recursos pagando con otros y no se acepta un mal trato', () => {
    const w = flatWorld(1);
    const t = startTrader(w)!;
    t.trader!.stock = { metal: 20 };
    w.items.drop(5, 6, 'madera', 50);
    expect(makeDeal(w, t, { buy: { metal: 10 }, sell: { madera: 1 }, slaves: [], sellPrisoners: [] })).not.toBeNull();
    const deal = { buy: { metal: 2 }, sell: { madera: 50 }, slaves: [], sellPrisoners: [] };
    expect(dealBalance(w, t, deal)).toBeGreaterThanOrEqual(0);
    expect(makeDeal(w, t, deal)).toBeNull();
    expect(w.inventory().metal).toBe(2);
    expect(w.inventory().madera).toBe(0);
    expect(t.trader!.stock.metal).toBe(18);
  });

  it('un esclavo comprado pasa a ser prisionero para convencer', () => {
    const w = flatWorld(1);
    const t = startTrader(w)!;
    const slave = w.makePawn('prisionero');
    t.trader!.slaves = [slave];
    w.items.drop(5, 6, 'componentes', 200);
    expect(makeDeal(w, t, { buy: {}, sell: { componentes: 200 }, slaves: [slave.id], sellPrisoners: [] })).toBeNull();
    expect(w.others).toContain(slave);
    expect(slave.prisoner?.mode).toBe('convencer');
  });
});

describe('supervivientes', () => {
  it('aceptar una oferta suma un colono', () => {
    const w = flatWorld(1);
    const c = w.makePawn('colono');
    w.offer = { kind: 'superviviente', pawn: c, until: w.tick + 100 };
    w.acceptOffer();
    expect(w.colonists.length).toBe(2);
    expect(w.offer).toBeNull();
  });
});

describe('guardar personas', () => {
  it('prisioneros, saqueadores, comerciantes, heridas y diario sobreviven a guardar y cargar', async () => {
    const { serializeWorld, loadWorld } = await import('../src/sim/save');
    const w = flatWorld(2);
    const r = raiderAt(w, 8, 8);
    hurt(r, 0.3, 'el pecho');
    const p = raiderAt(w, 9, 9);
    makePrisoner(p, 0.4);
    p.prisoner!.mode = 'convencer';
    const t = startTrader(w)!;
    t.trader!.slaves = [w.makePawn('prisionero')];
    hurt(w.colonists[0], 0.1, 'el brazo izquierdo');
    w.addLog('prueba', 'bueno');
    w.graveyard.push({ name: 'Ana', cause: 'sed', day: 2 });
    const back = loadWorld(JSON.parse(JSON.stringify(serializeWorld(w))));
    expect(back.others.map((o) => o.role).sort()).toEqual(['comerciante', 'prisionero', 'saqueador']);
    const p2 = back.others.find((o) => o.role === 'prisionero')!;
    expect(p2.prisoner).toEqual({ resistance: 0.4, mode: 'convencer', lastTalk: -1e9 });
    expect(back.others.find((o) => o.role === 'saqueador')!.wounds.length).toBe(1);
    expect(back.others.find((o) => o.role === 'comerciante')!.trader!.slaves.length).toBe(1);
    expect(back.colonists[0].wounds.length).toBe(1);
    expect(back.log.some((l) => l.text === 'prueba')).toBe(true);
    expect(back.graveyard).toEqual(w.graveyard);
    expect(back.schedule).toEqual(w.schedule);
    expect(back.nextPawnId).toBe(w.nextPawnId);
  });
});

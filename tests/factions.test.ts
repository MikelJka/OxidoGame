// Bloque 7 del catálogo, primera parte: las tres facciones y su relación con la colonia.
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { FACTIONS, RELATION } from '../src/data/factions';
import { createFactions, relationLevel } from '../src/sim/factions';
import { callAllies, callCaravan, demandTribute, radioProblem, makeDeal, makePrisoner, payTribute, refuseTribute, runStoryteller, sendAllies, startRaid, startTrader, tributeDemand } from '../src/sim/people';
import { TICKS_PER_HOUR } from '../src/sim/time';
import { TICKS_PER_DAY } from '../src/sim/time';
import { loadWorld, serializeWorld } from '../src/sim/save';
import type { World } from '../src/sim/world';

const rel = (w: World, id: string) => w.faction(id)!.relation;

describe('facciones', () => {
  it('tres facciones con su relación inicial y un asentamiento al azar (siempre el mismo con la misma semilla)', () => {
    expect(FACTIONS.map((f) => [f.id, f.start])).toEqual([['chatarreros', 0], ['granjeros', 0], ['piratas_oxido', -100]]);
    const a = createFactions(123);
    expect(a.map((f) => f.relation)).toEqual([0, 0, -100]);
    expect(createFactions(123)).toEqual(a);
    for (const f of a) expect(FACTIONS.find((d) => d.id === f.id)!.settlements).toContain(f.settlement);
    expect(RELATION).toMatchObject({ min: -100, max: 100, ally: 60, war: -50, giftValuePerPoint: 20, releasePrisoner: 15, tradeCaravan: 2, killOrHold: -10, refuseTribute: -20 });
    expect(relationLevel(-60)).toBe('hostil');
    expect(relationLevel(60)).toBe('aliado');
    expect(relationLevel(0)).toBe('neutral');
  });

  it('los saqueadores son de los Piratas del Óxido y las caravanas, de los Chatarreros', () => {
    const w = flatWorld(1);
    const raid = startRaid(w, 2, false, false);
    expect(raid.every((r) => r.faction === 'piratas_oxido')).toBe(true);
    const t = startTrader(w)!;
    expect(t.faction).toBe('chatarreros');
  });

  it('comerciar sube 2 (una vez por caravana) y lo que se da de más cuenta como regalo (1 cada 20 chapas)', () => {
    const w = flatWorld(1);
    w.items.drop(6, 6, 'madera', 75);
    const t = startTrader(w)!;
    t.trader!.stock = {};
    t.trader!.needs = [];
    t.trader!.surplus = [];
    expect(makeDeal(w, t, { sell: { madera: 10 }, buy: {}, sellPrisoners: [], slaves: [] })).toBeNull();
    expect(rel(w, 'chatarreros')).toBe(0 + 2);
    // Un regalo de 60 chapas: +3 (con el precio de la madera a su valor).
    w.market.mult = {};
    expect(makeDeal(w, t, { sell: { madera: 60 }, buy: {}, sellPrisoners: [], slaves: [] })).toBeNull();
    expect(rel(w, 'chatarreros')).toBe(2 + 3);
  });

  it('matar o retener a los suyos baja 10; liberar a un prisionero sube 15', () => {
    const w = flatWorld(1);
    // Con los Granjeros en guerra, sus saqueadores.
    w.changeRelation('granjeros', -50);
    const [a, b] = startRaid(w, 2, false, false, 'granjeros');
    w.killPawn(a, 'heridas');
    expect(rel(w, 'granjeros')).toBe(-60);
    // Los Piratas del Óxido no cambian nunca.
    const [p] = startRaid(w, 1, false, false);
    w.killPawn(p, 'heridas');
    expect(rel(w, 'piratas_oxido')).toBe(-100);
    makePrisoner(b, 0.5);
    b.prisoner!.mode = 'liberar';
    b.tile = { x: 0, y: 3 };
    b.pos = { x: 0.5, y: 3.5 };
    for (let t = 0; t < 10 && w.others.includes(b); t++) w.step();
    expect(w.others.includes(b)).toBe(false);
    expect(rel(w, 'granjeros')).toBe(-45);
  });

  it('la relación no pasa de −100 a 100', () => {
    const w = flatWorld(1);
    w.changeRelation('chatarreros', -500);
    expect(rel(w, 'chatarreros')).toBe(-100);
    w.changeRelation('piratas_oxido', 500);
    expect(rel(w, 'piratas_oxido')).toBe(-100);
    w.changeRelation('granjeros', 500, 'prueba');
    expect(rel(w, 'granjeros')).toBe(100);
    expect(w.log.some((l) => l.text.includes('Granjeros del valle') && l.text.includes('aliados'))).toBe(true);
  });

  it('se guardan; las partidas antiguas las sacan de la semilla', () => {
    const w = flatWorld(1);
    w.changeRelation('granjeros', 33);
    const [r] = startRaid(w, 1, false, false);
    const back = loadWorld(serializeWorld(w));
    expect(back.faction('granjeros')!.relation).toBe(33);
    expect(back.factions.map((f) => f.settlement)).toEqual(w.factions.map((f) => f.settlement));
    expect(back.others.find((o) => o.id === r.id)?.faction).toBe('piratas_oxido');
    const old = JSON.parse(JSON.stringify(serializeWorld(w)));
    delete old.factions;
    expect(loadWorld(old).factions.map((f) => [f.id, f.settlement, f.relation])).toEqual(createFactions(w.map.seed).map((f) => [f.id, f.settlement, f.relation]));
  });
});

describe('alianza', () => {
  it('con 60 o más, si os atacan mandan 2–4 combatientes, una vez cada 10 días', () => {
    const w = flatWorld(1);
    w.map.start = { x: 15, y: 15 };
    expect(sendAllies(w)).toEqual([]); // nadie es aliado todavía
    w.changeRelation('granjeros', 60);
    const help = sendAllies(w);
    expect(help.length).toBeGreaterThanOrEqual(2);
    expect(help.length).toBeLessThanOrEqual(4);
    expect(help.every((a) => a.role === 'aliado' && a.faction === 'granjeros')).toBe(true);
    expect(sendAllies(w)).toEqual([]); // hasta dentro de 10 días, no
    w.tick += 10 * TICKS_PER_DAY;
    expect(sendAllies(w).length).toBeGreaterThanOrEqual(2);
  });

  it('pelean con los saqueadores y, sin atacantes, se marchan', () => {
    const w = flatWorld(1);
    w.map.start = { x: 15, y: 15 };
    w.changeRelation('chatarreros', 60);
    w.colonists[0].tile = { x: 2, y: 2 };
    w.colonists[0].pos = { x: 2.5, y: 2.5 };
    const help = sendAllies(w);
    expect(help.length).toBeGreaterThan(0);
    const [foe] = startRaid(w, 1, false, false);
    let hurtByAlly = false;
    let t = 0;
    for (; t < 20000 && w.others.some((o) => o.role === 'aliado'); t++) {
      w.step();
      if (foe.health < 1) hurtByAlly = true;
      // Que el saqueador no llegue al colono: lo que le pase es cosa de los aliados.
      if (w.others.includes(foe) && !foe.raider?.fleeing) foe.path = [];
    }
    expect(t).toBeLessThan(20000);
    expect(hurtByAlly).toBe(true);
    // Al acabar el ataque se han ido todos.
    expect(w.others.some((o) => o.role === 'aliado')).toBe(false);
    // Se guardan bien (el papel «aliado» y cuándo ayudaron).
    const back = loadWorld(serializeWorld(w));
    expect(back.faction('chatarreros')!.helpAt).toBe(w.faction('chatarreros')!.helpAt);
  });
});

describe('guerra', () => {
  it('con −50 o menos, una facción que no es la de los saqueadores manda sus propios raids', () => {
    const w = flatWorld(1);
    w.map.start = { x: 15, y: 15 };
    w.schedule.nextRaid = Infinity;
    w.schedule.nextTrader = Infinity;
    w.schedule.nextWanderer = Infinity;
    // Los Piratas del Óxido (−60) ya son los de los raids normales: no traen raids de más.
    runStoryteller(w);
    expect(w.faction('piratas_oxido')!.warRaidAt).toBeUndefined();
    w.changeRelation('granjeros', -50);
    runStoryteller(w);
    const at = w.faction('granjeros')!.warRaidAt!;
    expect(at).toBe(w.tick + 2 * TICKS_PER_DAY);
    w.tick = at;
    runStoryteller(w);
    const raiders = w.others.filter((o) => o.role === 'saqueador');
    expect(raiders.length).toBeGreaterThan(0);
    expect(raiders.every((r) => r.faction === 'granjeros')).toBe(true);
    expect(w.log.some((l) => l.text.includes('Raid de Granjeros del valle'))).toBe(true);
    expect(w.faction('granjeros')!.warRaidAt!).toBeGreaterThan(w.tick);
    // Con la paz (más de −50), se acaba.
    w.changeRelation('granjeros', 20);
    w.tick += TICKS_PER_HOUR;
    runStoryteller(w);
    expect(w.faction('granjeros')!.warRaidAt).toBeUndefined();
  });
});

describe('tributo', () => {
  it('piden unas 200 chapas de lo que más vale; sin tanto, no piden', () => {
    const w = flatWorld(1);
    w.map.start = { x: 15, y: 15 };
    expect(tributeDemand(w)).toBeNull();
    expect(demandTribute(w)).toBe(false);
    w.items.drop(6, 6, 'componentes', 25); // 300 chapas
    w.items.drop(8, 8, 'madera', 50);
    const ask = tributeDemand(w)!;
    expect(ask.demand).toEqual({ componentes: 17 });
    expect(ask.value).toBeGreaterThanOrEqual(200);
  });

  it('pagar se lleva lo pedido y no hay raid', () => {
    const w = flatWorld(1);
    w.map.start = { x: 15, y: 15 };
    w.items.drop(6, 6, 'componentes', 25);
    expect(demandTribute(w)).toBe(true);
    expect(w.tribute).not.toBeNull();
    expect(payTribute(w)).toBe(true);
    expect(w.inventory().componentes).toBe(25 - 17);
    expect(w.tribute).toBeNull();
    expect(w.others.some((o) => o.role === 'saqueador')).toBe(false);
    expect(w.faction('piratas_oxido')!.relation).toBe(-100);
  });

  it('negarse (o no contestar a tiempo): llega su raid (su relación no cambia: siempre hostiles)', () => {
    const w = flatWorld(1);
    w.map.start = { x: 15, y: 15 };
    w.items.drop(6, 6, 'componentes', 25);
    demandTribute(w);
    // Se guarda mientras espera respuesta.
    const back = loadWorld(serializeWorld(w));
    expect(back.tribute?.demand).toEqual({ componentes: 17 });
    refuseTribute(w);
    expect(w.faction('piratas_oxido')!.relation).toBe(-100);
    expect(w.others.some((o) => o.role === 'saqueador' && o.faction === 'piratas_oxido')).toBe(true);
    // Sin contestar: al pasar el plazo, igual.
    back.schedule.nextRaid = Infinity;
    back.schedule.nextTrader = Infinity;
    back.schedule.nextWanderer = Infinity;
    back.tick = back.tribute!.until + 1;
    runStoryteller(back);
    expect(back.tribute).toBeNull();
    expect(back.faction('piratas_oxido')!.relation).toBe(-100);
    expect(back.others.some((o) => o.role === 'saqueador')).toBe(true);
  });
});

describe('radio', () => {
  function withRadio(): World {
    const w = flatWorld(1);
    w.map.start = { x: 15, y: 15 };
    w.schedule.nextTrader = Infinity;
    return w;
  }

  it('pide «Radio» investigada y una radio de llamada con corriente', () => {
    const w = withRadio();
    expect(radioProblem(w)).toContain('Radio');
    w.research.done.push('radio');
    expect(radioProblem(w)).toContain('radio de llamada');
    w.radioOn = () => true;
    expect(radioProblem(w)).toBeNull();
  });

  it('llamar a una caravana: llega en unas 4 h, como mucho una vez cada 3 días', () => {
    const w = withRadio();
    w.research.done.push('radio');
    w.radioOn = () => true;
    expect(callCaravan(w)).toBeNull();
    expect(w.schedule.nextTrader).toBe(w.tick + 4 * TICKS_PER_HOUR);
    expect(callCaravan(w)).toContain('hace poco');
    w.tick += 3 * TICKS_PER_DAY;
    w.schedule.nextTrader = Infinity;
    w.changeRelation('chatarreros', -30);
    expect(callCaravan(w)).toContain('no quieren comerciar');
  });

  it('pedir ayuda: solo durante un ataque y si alguien es aliado', () => {
    const w = withRadio();
    w.research.done.push('radio');
    w.radioOn = () => true;
    expect(callAllies(w)).toContain('cuando os atacan');
    startRaid(w, 1, false, false);
    expect(callAllies(w)).toContain('Nadie es aliado');
    w.changeRelation('granjeros', 70);
    expect(callAllies(w)).toBeNull();
    expect(w.others.some((o) => o.role === 'aliado')).toBe(true);
    expect(callAllies(w)).toContain('hace poco');
  });
});

describe('partidas antiguas', () => {
  it('los Hijos del Óxido pasan a ser los Piratas del Óxido', () => {
    const w = flatWorld(1);
    w.map.start = { x: 15, y: 15 };
    const [r] = startRaid(w, 1, false, false);
    const old = JSON.parse(JSON.stringify(serializeWorld(w)));
    for (const f of old.factions) if (f.id === 'piratas_oxido') { f.id = 'hijos_oxido'; f.relation = -60; }
    for (const o of old.others) if (o.faction === 'piratas_oxido') o.faction = 'hijos_oxido';
    const back = loadWorld(old);
    expect(back.faction('piratas_oxido')!.relation).toBe(-100);
    expect(back.others.find((o) => o.id === r.id)?.faction).toBe('piratas_oxido');
  });
});

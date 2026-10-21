// Bloque 7 del catálogo, primera parte: las tres facciones y su relación con la colonia.
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { FACTIONS, RELATION } from '../src/data/factions';
import { createFactions, relationLevel } from '../src/sim/factions';
import { makeDeal, makePrisoner, startRaid, startTrader } from '../src/sim/people';
import { loadWorld, serializeWorld } from '../src/sim/save';
import type { World } from '../src/sim/world';

const rel = (w: World, id: string) => w.faction(id)!.relation;

describe('facciones', () => {
  it('tres facciones con su relación inicial y un asentamiento al azar (siempre el mismo con la misma semilla)', () => {
    expect(FACTIONS.map((f) => [f.id, f.start])).toEqual([['chatarreros', 20], ['granjeros', 0], ['hijos_oxido', -60]]);
    const a = createFactions(123);
    expect(a.map((f) => f.relation)).toEqual([20, 0, -60]);
    expect(createFactions(123)).toEqual(a);
    for (const f of a) expect(FACTIONS.find((d) => d.id === f.id)!.settlements).toContain(f.settlement);
    expect(RELATION).toMatchObject({ min: -100, max: 100, ally: 60, war: -50, giftValuePerPoint: 20, releasePrisoner: 15, tradeCaravan: 2, killOrHold: -10, refuseTribute: -20 });
    expect(relationLevel(-60)).toBe('guerra');
    expect(relationLevel(60)).toBe('alianza');
    expect(relationLevel(0)).toBe('neutral');
  });

  it('los saqueadores son de los Hijos del Óxido y las caravanas, de los Chatarreros', () => {
    const w = flatWorld(1);
    const raid = startRaid(w, 2, false, false);
    expect(raid.every((r) => r.faction === 'hijos_oxido')).toBe(true);
    const t = startTrader(w)!;
    expect(t.faction).toBe('chatarreros');
  });

  it('comerciar sube 2 (una vez por caravana) y lo que se da de más cuenta como regalo (1 cada 20 chapas)', () => {
    const w = flatWorld(1);
    w.items.drop(6, 6, 'madera', 75);
    const t = startTrader(w)!;
    t.trader!.stock = {};
    expect(makeDeal(w, t, { sell: { madera: 10 }, buy: {}, sellPrisoners: [], slaves: [] })).toBeNull();
    expect(rel(w, 'chatarreros')).toBe(20 + 2);
    // Un regalo de 60 chapas: +3.
    expect(makeDeal(w, t, { sell: { madera: 60 }, buy: {}, sellPrisoners: [], slaves: [] })).toBeNull();
    expect(rel(w, 'chatarreros')).toBe(22 + 3);
  });

  it('matar o retener a los suyos baja 10; liberar a un prisionero sube 15', () => {
    const w = flatWorld(1);
    const [a, b] = startRaid(w, 2, false, false);
    w.killPawn(a, 'heridas');
    expect(rel(w, 'hijos_oxido')).toBe(-70);
    makePrisoner(b, 0.5);
    b.prisoner!.mode = 'liberar';
    b.tile = { x: 0, y: 3 };
    b.pos = { x: 0.5, y: 3.5 };
    for (let t = 0; t < 10 && w.others.includes(b); t++) w.step();
    expect(w.others.includes(b)).toBe(false);
    expect(rel(w, 'hijos_oxido')).toBe(-55);
  });

  it('la relación no pasa de −100 a 100', () => {
    const w = flatWorld(1);
    w.changeRelation('hijos_oxido', -500);
    expect(rel(w, 'hijos_oxido')).toBe(-100);
    w.changeRelation('granjeros', 500, 'prueba');
    expect(rel(w, 'granjeros')).toBe(100);
    expect(w.log.some((l) => l.text.includes('Granjeros del valle') && l.text.includes('alianza'))).toBe(true);
  });

  it('se guardan; las partidas antiguas las sacan de la semilla', () => {
    const w = flatWorld(1);
    w.changeRelation('granjeros', 33);
    const [r] = startRaid(w, 1, false, false);
    const back = loadWorld(serializeWorld(w));
    expect(back.faction('granjeros')!.relation).toBe(33);
    expect(back.factions.map((f) => f.settlement)).toEqual(w.factions.map((f) => f.settlement));
    expect(back.others.find((o) => o.id === r.id)?.faction).toBe('hijos_oxido');
    const old = JSON.parse(JSON.stringify(serializeWorld(w)));
    delete old.factions;
    expect(loadWorld(old).factions).toEqual(createFactions(w.map.seed));
  });
});

// Bases de las facciones, primera parte: el mapa del mundo y cómo crecen (elegido por Mikel el 2026-10-21).
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { baseLevel, WORLD_MAP } from '../src/data/worldmap';
import { colonyCell, enrichBase, growBases, travelDays } from '../src/sim/worldmap';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_DAY } from '../src/sim/time';

describe('mapa del mundo', () => {
  it('cada facción tiene su base, lejos de la colonia y sin pisarse', () => {
    const w = flatWorld(1);
    const home = colonyCell();
    const spots = new Set<string>();
    for (const f of w.factions) {
      const b = f.base!;
      expect(b).toBeDefined();
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x).toBeLessThan(WORLD_MAP.size[0]);
      expect(Math.abs(b.x - home.x) + Math.abs(b.y - home.y)).toBeGreaterThanOrEqual(WORLD_MAP.baseDistance[0]);
      expect(travelDays(b)).toBeGreaterThan(0);
      spots.add(`${b.x},${b.y}`);
    }
    expect(spots.size).toBe(w.factions.length);
  });

  it('crecen cada 5 días, y más si son ricas', () => {
    const w = flatWorld(1);
    const [poor, rich] = w.factions;
    poor.base!.wealth = 0;
    rich.base!.wealth = 0;
    enrichBase(w, rich.id, 1200);
    const p0 = poor.base!.population;
    const r0 = rich.base!.population;
    w.tick = 5 * TICKS_PER_DAY;
    growBases(w);
    const dp = poor.base!.population - p0;
    const dr = rich.base!.population - r0;
    expect(dp).toBeGreaterThanOrEqual(1);
    expect(dr).toBeGreaterThanOrEqual(3 + 1);
    // No vuelven a crecer hasta dentro de 5 días.
    growBases(w);
    expect(poor.base!.population - p0).toBe(dp);
    expect(baseLevel(30).id).toBe('fortaleza');
  });

  it('se guardan; las partidas de antes las ponen al cargar', () => {
    const w = flatWorld(1);
    w.factions[0].base!.population = 21;
    const back = loadWorld(serializeWorld(w));
    expect(back.factions[0].base).toEqual(w.factions[0].base);
    const old = JSON.parse(JSON.stringify(serializeWorld(w)));
    for (const f of old.factions) delete f.base;
    expect(loadWorld(old).factions.every((f) => !!f.base)).toBe(true);
  });
});

describe('facciones nuevas', () => {
  it('si quedan menos de 3, a los 3–6 días llega una nueva con su base', async () => {
    const { checkNewFaction } = await import('../src/sim/worldmap');
    const w = flatWorld(1);
    w.ruins.push({ faction: 'granjeros', name: 'X', x: 0, y: 0, day: 1 });
    w.factions.splice(w.factions.findIndex((f) => f.id === 'granjeros'), 1);
    checkNewFaction(w);
    expect(w.newFactionAt).not.toBeNull();
    w.tick = w.newFactionAt!;
    checkNewFaction(w);
    expect(w.factions.length).toBe(3);
    const nf = w.factions[2];
    expect(nf.id).not.toBe('granjeros');
    expect(nf.base).toBeDefined();
    // Se guarda (y la destruida no vuelve).
    const back = loadWorld(serializeWorld(w));
    expect(back.factions.map((f) => f.id)).toEqual(w.factions.map((f) => f.id));
  });
});

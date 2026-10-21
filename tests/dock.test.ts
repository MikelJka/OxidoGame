// Update del agua: el muelle y la pesca (decidido por Mikel el 2026-10-21).
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { buildingDef } from '../src/data/buildings';
import { SKILLS } from '../src/data/colonists';
import { recipeDef, recipesFor } from '../src/data/recipes';
import { RAW_FOOD, RESOURCE_ICONS } from '../src/data/resources';
import { checkWorld } from '../src/sim/diagnostics';
import { workSpeed } from '../src/sim/jobs';
import { isPassable, Terrain } from '../src/sim/map';
import { NUTRITION } from '../src/sim/needs';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/sim/time';
import type { World } from '../src/sim/world';

/** Un río en las columnas 10–12: poco profunda, agua y profunda. */
function river(w: World): void {
  const m = w.map;
  for (let y = 0; y < m.height; y++) {
    m.terrain[y * m.width + 10] = Terrain.ShallowWater;
    m.terrain[y * m.width + 11] = Terrain.Water;
    m.terrain[y * m.width + 12] = Terrain.DeepWater;
  }
}

function buildNow(w: World, x: number, y: number, id: string) {
  expect(w.structures.place(x, y, id)).toBe(true);
  const s = w.structures.at(x, y)!;
  w.completeStructure(s);
  return s;
}

describe('muelle y pesca', () => {
  it('los números decididos por Mikel', () => {
    const d = buildingDef('muelle');
    expect(d.cost).toEqual({ madera: 10 });
    expect(d.research).toBe('puentes');
    expect(d.workSkill).toBe('supervivencia');
    expect(d.blocks).toBe(false);
    expect(SKILLS).toContain('supervivencia');
    const fish = recipeDef('pescar')!;
    expect(recipesFor('muelle')).toEqual([fish]);
    expect(fish.inputs).toEqual({});
    expect(fish.outputs).toEqual({ pescado: 1 });
    const roast = recipeDef('pescado_asado')!;
    expect(roast.station).toBe('cocina');
    expect(roast.inputs).toEqual({ pescado: 4 });
    expect(roast.outputs).toEqual({ comida: 2 });
    expect(RESOURCE_ICONS.pescado).toBe('🐟');
    // Crudo alimenta poco (como las patatas) y sienta peor.
    expect(RAW_FOOD).toContain('pescado');
    expect(NUTRITION.pescado).toBe(NUTRITION.patata);
  });

  it('1 🐟 cada 2 h con Supervivencia 0 y cada hora con 20', () => {
    const w = flatWorld(1);
    const [c] = w.colonists;
    const fish = recipeDef('pescar')!;
    const range = buildingDef('muelle').skillSpeed!;
    c.skills.supervivencia = 0;
    expect(fish.work / workSpeed(c, 'fabricar', 'supervivencia', range)).toBeCloseTo(2 * TICKS_PER_HOUR);
    c.skills.supervivencia = 20;
    expect(fish.work / workSpeed(c, 'fabricar', 'supervivencia', range)).toBeCloseTo(TICKS_PER_HOUR);
  });

  it('va en agua poco profunda o normal, pegado a la orilla o a otro muelle', () => {
    const w = flatWorld(0);
    river(w);
    expect(w.structures.place(5, 5, 'muelle')).toBe(false); // en tierra, no
    expect(w.structures.place(11, 5, 'muelle')).toBe(false); // lejos de la orilla, no
    expect(w.structures.place(10, 5, 'muelle')).toBe(true); // junto a la orilla
    expect(w.structures.place(11, 5, 'muelle')).toBe(true); // junto a otro muelle (en plano)
    expect(w.structures.place(12, 5, 'muelle')).toBe(false); // en la profunda, no
    // Sobre una plataforma tampoco: el muelle es su propio suelo.
    expect(w.structures.place(10, 8, 'plataforma_madera')).toBe(true);
    expect(w.structures.place(10, 8, 'muelle')).toBe(false);
  });

  it('terminado se pisa, y encima no se construye', () => {
    const w = flatWorld(0);
    river(w);
    // En el agua normal (la poco profunda se vadea).
    for (let y = 0; y < w.map.height; y++) w.map.terrain[y * w.map.width + 10] = Terrain.Water;
    expect(isPassable(w.map, 10, 5)).toBe(false);
    buildNow(w, 10, 5, 'muelle');
    expect(isPassable(w.map, 10, 5)).toBe(true);
    expect(w.structures.place(10, 5, 'cama')).toBe(false);
    // Demolido, vuelve a ser agua.
    w.demolishStructure(w.structures.at(10, 5)!);
    expect(isPassable(w.map, 10, 5)).toBe(false);
  });

  it('con «pescar hasta tener N», un colono va al muelle y saca 🐟', () => {
    const w = flatWorld(1);
    river(w);
    const dock = buildNow(w, 10, 6, 'muelle');
    w.structures.setBill(dock, { recipe: recipeDef('pescar')!, target: 2, paused: false });
    w.colonists[0].skills.supervivencia = 20;
    let t = 0;
    for (; t < 6 * TICKS_PER_HOUR; t++) {
      if (w.inventory().pescado >= 2 && w.colonists.every((c) => !c.job)) break;
      w.step();
      if (t % 250 === 0) expect(checkWorld(w)).toEqual([]);
    }
    expect(t).toBeLessThan(6 * TICKS_PER_HOUR);
    expect(w.inventory().pescado).toBe(2);
  });

  it('el muelle y la Supervivencia se guardan; las partidas antiguas la sacan de Cultivo y Combate', () => {
    const w = flatWorld(1);
    river(w);
    buildNow(w, 10, 6, 'muelle');
    w.colonists[0].skills.supervivencia = 13;
    const back = loadWorld(serializeWorld(w));
    expect(back.structures.at(10, 6)?.def.id).toBe('muelle');
    expect(isPassable(back.map, 10, 6)).toBe(true);
    expect(back.colonists[0].skills.supervivencia).toBe(13);
    const old = JSON.parse(JSON.stringify(serializeWorld(w)));
    for (const c of old.colonists) {
      delete c.skills.supervivencia;
      c.skills.cultivo = 6;
      c.skills.combate = 11;
    }
    expect(loadWorld(JSON.stringify(old)).colonists[0].skills.supervivencia).toBe(9);
  });

  it('trampa de pesca (🪵6 🧵2): en el agua pegada a un muelle, deja 1 🐟 al día junto a él', () => {
    const w = flatWorld(0);
    river(w);
    const d = buildingDef('trampa_pesca');
    expect(d.cost).toEqual({ madera: 6, fibra: 2 });
    expect(d.research).toBe('puentes');
    expect(w.structures.place(11, 9, 'trampa_pesca')).toBe(false); // sin muelle al lado, no
    expect(w.structures.place(5, 9, 'trampa_pesca')).toBe(false); // en tierra, no
    buildNow(w, 10, 9, 'muelle');
    expect(w.structures.place(12, 9, 'trampa_pesca')).toBe(false); // ni lejos ni en la profunda
    const trap = buildNow(w, 11, 9, 'trampa_pesca');
    expect(trap.built).toBe(true);
    for (let t = 0; t < 3 * TICKS_PER_DAY; t++) w.step();
    expect(w.inventory().pescado).toBe(3);
    // Se guarda.
    const back = loadWorld(serializeWorld(w));
    expect(back.structures.at(11, 9)?.def.id).toBe('trampa_pesca');
  });
});

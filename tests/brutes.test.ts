// Mutantes (bloque 2 del catálogo, segunda parte): el bruto mutante, que rompe muros y puertas.
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { CREATURES } from '../src/data/creatures';
import { walkSpeedMultiplier } from '../src/sim/colonist';
import type { Colonist } from '../src/sim/colonist';
import { breakCost, makeCreature, packBrutes, smashStructure, startPack, updateOthers } from '../src/sim/people';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_DAY } from '../src/sim/time';

type W = ReturnType<typeof flatWorld>;

function beastAt(w: W, x: number, y: number, kind: 'perro_mutante' | 'bruto_mutante'): Colonist {
  const c = w.makePawn('saqueador');
  makeCreature(w, c, kind, 1);
  c.tile = { x, y };
  c.pos = { x: x + 0.5, y: y + 0.5 };
  w.others.push(c);
  return c;
}

/** Encierra al colono 0 en (12, 12) dentro de un cuadrado de muros de madera terminados. */
function walledIn(w: W): void {
  const c = w.colonists[0];
  c.tile = { x: 12, y: 12 };
  c.pos = { x: 12.5, y: 12.5 };
  for (let y = 10; y <= 14; y++) {
    for (let x = 10; x <= 14; x++) {
      if (x !== 10 && x !== 14 && y !== 10 && y !== 14) continue;
      expect(w.structures.place(x, y, 'muro_madera')).toBe(true);
      w.completeStructure(w.structures.mainAt(x, y)!);
    }
  }
}

const walls = (w: W) => w.structures.all().filter((s) => s.def.id === 'muro_madera').length;

function run(w: W, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    w.tick++;
    updateOthers(w);
  }
}

describe('bruto mutante', () => {
  it('tiene los números del catálogo', () => {
    const b = CREATURES.bruto_mutante;
    expect(b.fromDay).toBe(15);
    expect(b.walkSpeed).toBe(0.7);
    expect(b.health).toBe(3);
    expect(b.damage).toBe(3);
    expect(b.breaksWalls).toBe(true);
    expect(CREATURES.perro_mutante.breaksWalls).toBe(false);
    const w = flatWorld(1);
    const brute = beastAt(w, 3, 3, 'bruto_mutante');
    expect(walkSpeedMultiplier(brute)).toBeCloseTo(0.7);
    expect(brute.name).toBe('Bruto mutante 1');
  });

  it('desde el día 15 la manada trae 1 bruto por cada 3 perros; antes, ninguno', () => {
    const w = flatWorld(1);
    w.tick = 13 * TICKS_PER_DAY; // día 14
    expect(packBrutes(w, 6)).toBe(0);
    w.tick = 14 * TICKS_PER_DAY; // día 15
    expect(packBrutes(w, 6)).toBe(2);
    expect(packBrutes(w, 5)).toBe(1);
    expect(packBrutes(w, 2)).toBe(0);
    const pack = startPack(w, 6);
    expect(pack).toHaveLength(8);
    expect(pack.filter((c) => c.creature === 'bruto_mutante').map((c) => c.name)).toEqual(['Bruto mutante 1', 'Bruto mutante 2']);
    expect(pack.filter((c) => c.creature === 'perro_mutante')).toHaveLength(6);
    expect(w.raidGroups.at(-1)!.size).toBe(8);
    expect(w.log.some((l) => l.text.includes('6 perros mutantes y 2 brutos mutantes'))).toBe(true);
  });

  it('solo rompe muros, puertas y portones terminados que cortan el paso', () => {
    const w = flatWorld(1);
    expect(breakCost(w, 8, 8, 30)).toBe(Infinity); // suelo libre
    w.structures.place(8, 8, 'muro_madera');
    expect(breakCost(w, 8, 8, 30)).toBe(Infinity); // plano sin terminar
    w.completeStructure(w.structures.mainAt(8, 8)!);
    expect(breakCost(w, 8, 8, 30)).toBeLessThan(Infinity);
    expect(breakCost(w, 8, 8, 0)).toBe(Infinity); // quien no rompe muros
  });

  it('un muro de madera (150) cae en 5 golpes y no deja material', () => {
    const w = flatWorld(1);
    const brute = beastAt(w, 7, 8, 'bruto_mutante');
    w.structures.place(8, 8, 'muro_madera');
    const s = w.structures.mainAt(8, 8)!;
    w.completeStructure(s);
    for (let i = 0; i < 4; i++) smashStructure(w, brute, s);
    expect(w.structures.mainAt(8, 8)).toBe(s);
    expect(s.hp).toBe(30);
    smashStructure(w, brute, s);
    expect(w.structures.mainAt(8, 8)).toBeUndefined();
    expect(w.items.list()).toHaveLength(0);
    expect(w.log.some((l) => l.text.includes('ha roto el muro de madera'))).toBe(true);
  });

  it('se abre paso rompiendo muros hasta el colono encerrado', () => {
    const w = flatWorld(1);
    walledIn(w);
    expect(walls(w)).toBe(16);
    beastAt(w, 22, 12, 'bruto_mutante');
    run(w, 4000);
    expect(walls(w)).toBeLessThan(16);
    expect(w.log.some((l) => l.text.includes('Bruto mutante 1 está rompiendo el muro de madera'))).toBe(true);
    // Ha llegado hasta el colono y le ha pegado.
    expect(w.colonists[0].health).toBeLessThan(1);
  });

  it('el perro mutante no rompe muros', () => {
    const w = flatWorld(1);
    walledIn(w);
    beastAt(w, 22, 12, 'perro_mutante');
    run(w, 3000);
    expect(walls(w)).toBe(16);
    expect(w.colonists[0].health).toBe(1);
  });

  it('se guarda: el bruto y la vida que le queda al muro golpeado', () => {
    const w = flatWorld(1);
    const brute = beastAt(w, 7, 8, 'bruto_mutante');
    w.structures.place(8, 8, 'muro_madera');
    const s = w.structures.mainAt(8, 8)!;
    w.completeStructure(s);
    smashStructure(w, brute, s);
    const back = loadWorld(serializeWorld(w));
    expect(back.others.find((o) => o.creature === 'bruto_mutante')?.name).toBe('Bruto mutante 1');
    expect(back.structures.mainAt(8, 8)!.hp).toBe(120);
  });
});

// Bloque 1 del catálogo: heridas que se infectan y 💊 Medicina para tratarlas.
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { giveDose, hurt, tickInfection, treatWounds } from '../src/sim/health';
import { moodOf, needsWorkFactor } from '../src/sim/needs';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_DAY } from '../src/sim/world';
import { Rng } from '../src/sim/rng';
import { harvestTile } from '../src/sim/resources';
import { Prop } from '../src/sim/map';
import type { Colonist } from '../src/sim/colonist';

/** Rng que siempre saca el mismo número (para forzar o evitar la infección). */
function fixedRng(v: number): Rng {
  const r = new Rng(1);
  r.next = () => v;
  return r;
}

const HALF_DAY = TICKS_PER_DAY / 2;

function infect(c: Colonist): void {
  hurt(c, 0.3, 'el brazo izquierdo');
  tickInfection(c, HALF_DAY, TICKS_PER_DAY, fixedRng(0));
}

describe('infecciones', () => {
  it('una herida abierta 12 h se infecta según cómo se curó (20 %, 8 %, 2 %)', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    hurt(c, 0.3, 'el pecho');
    // Antes de 12 h, nada.
    expect(tickInfection(c, HALF_DAY - 1, TICKS_PER_DAY, fixedRng(0)).infected).toBeUndefined();
    // Sin curar: con 0,19 se infecta (menos del 20 %).
    expect(tickInfection(c, 1, TICKS_PER_DAY, fixedRng(0.19)).infected).toBe('el pecho');
    expect(c.infection?.part).toBe('el pecho');

    const b = w.makePawn('colono');
    hurt(b, 0.3, 'la cabeza');
    treatWounds(b);
    expect(tickInfection(b, HALF_DAY, TICKS_PER_DAY, fixedRng(0.1)).infected).toBeUndefined();
    const m = w.makePawn('colono');
    hurt(m, 0.3, 'la cabeza');
    treatWounds(m, true);
    expect(tickInfection(m, HALF_DAY, TICKS_PER_DAY, fixedRng(0.03)).infected).toBeUndefined();
    const m2 = w.makePawn('colono');
    hurt(m2, 0.3, 'la cabeza');
    treatWounds(m2, true);
    expect(tickInfection(m2, HALF_DAY, TICKS_PER_DAY, fixedRng(0.01)).infected).toBe('la cabeza');
    // Solo se mira una vez por herida.
    const b2 = w.makePawn('colono');
    hurt(b2, 0.3, 'la cabeza');
    tickInfection(b2, HALF_DAY, TICKS_PER_DAY, fixedRng(0.9));
    expect(tickInfection(b2, HALF_DAY, TICKS_PER_DAY, fixedRng(0)).infected).toBeUndefined();
  });

  it('quita ánimo y velocidad de trabajo', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    const mood = moodOf(c).mood;
    const work = needsWorkFactor(c);
    infect(c);
    expect(moodOf(c).mood).toBeCloseTo(mood - 0.15);
    expect(needsWorkFactor(c)).toBeCloseTo(work * 0.85);
  });

  it('sin tratar 4 días seguidos, muere; con una dosis al día durante 2 días, se cura', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    infect(c);
    expect(tickInfection(c, TICKS_PER_DAY, TICKS_PER_DAY, fixedRng(0.9)).worse).toBe(true);
    expect(tickInfection(c, TICKS_PER_DAY, TICKS_PER_DAY, fixedRng(0.9)).died).toBeFalsy();
    expect(tickInfection(c, TICKS_PER_DAY, TICKS_PER_DAY, fixedRng(0.9)).died).toBeFalsy();
    expect(tickInfection(c, TICKS_PER_DAY, TICKS_PER_DAY, fixedRng(0.9)).died).toBe(true);
    // Bien comido y bebido, a veces el cuerpo la vence solo (30 % al día).
    const r = w.makePawn('colono');
    infect(r);
    expect(tickInfection(r, TICKS_PER_DAY, TICKS_PER_DAY, fixedRng(0.1)).recovered).toBe(true);
    expect(r.infection).toBeUndefined();

    const b = w.makePawn('colono');
    infect(b);
    tickInfection(b, TICKS_PER_DAY, TICKS_PER_DAY, fixedRng(0.9));
    tickInfection(b, TICKS_PER_DAY, TICKS_PER_DAY, fixedRng(0.9));
    // Una dosis corta la racha; dos el mismo día no cuentan.
    expect(giveDose(b)).toBe(false);
    expect(giveDose(b)).toBe(false);
    expect(b.infection?.doses).toBe(1);
    tickInfection(b, TICKS_PER_DAY, TICKS_PER_DAY, fixedRng(0.9));
    expect(b.infection?.untreatedDays).toBe(0);
    expect(giveDose(b)).toBe(true);
    expect(b.infection).toBeUndefined();
  });

  it('curar con medicina cierra la herida el doble de rápido', () => {
    const w = flatWorld(2);
    const [a, b] = w.colonists;
    hurt(a, 0.2, 'el pecho');
    hurt(b, 0.2, 'el pecho');
    treatWounds(a);
    treatWounds(b, true);
    const sa = a.wounds[0].severity;
    for (let i = 0; i < 60; i++) w.step();
    const da = sa - (a.wounds[0]?.severity ?? 0);
    const db = sa - (b.wounds[0]?.severity ?? 0);
    expect(da).toBeGreaterThan(0);
    expect(db).toBeCloseTo(da * 2, 5);
  });

  it('el médico gasta 1 💊 en tratar la infección', () => {
    const w = flatWorld(2);
    const [doc, sick] = w.colonists;
    doc.skills.medicina = 20;
    sick.drafted = true;
    infect(sick);
    w.items.drop(8, 8, 'medicina', 3);
    for (let i = 0; i < 3000 && sick.infection?.doses !== 1; i++) w.step();
    expect(sick.infection?.doses).toBe(1);
    expect(w.items.totals().medicina).toBe(2);
    // Hoy ya la tomó: no vuelve a gastar.
    for (let i = 0; i < 600; i++) w.step();
    expect(w.items.totals().medicina).toBe(2);
  });

  it('la infección se guarda con la partida', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    infect(c);
    giveDose(c);
    const back = loadWorld(serializeWorld(w)).colonists[0];
    expect(back.infection).toEqual(c.infection);
    expect(back.wounds[0].infectRolled).toBe(true);
  });

  it('las heridas de partidas antiguas no se infectan', () => {
    const w = flatWorld(1);
    hurt(w.colonists[0], 0.3, 'el pecho');
    const save = JSON.parse(JSON.stringify(serializeWorld(w)));
    for (const s of save.colonists) for (const wd of s.wounds) { delete wd.age; delete wd.infectRolled; }
    const back = loadWorld(save).colonists[0];
    expect(tickInfection(back, TICKS_PER_DAY, TICKS_PER_DAY, fixedRng(0)).infected).toBeUndefined();
  });

  it('entre los escombros a veces sale 💊', () => {
    const w = flatWorld(1);
    const i = 3 * w.map.width + 3;
    w.map.props[i] = Prop.Rubble;
    w.map.stock[i] = 5;
    const got = harvestTile(w.map, 3, 3, fixedRng(0));
    expect(got?.medicina).toBeGreaterThanOrEqual(1);
    w.map.props[i] = Prop.Rubble;
    w.map.stock[i] = 5;
    expect(harvestTile(w.map, 3, 3, fixedRng(0.9))?.medicina).toBeUndefined();
  });
});

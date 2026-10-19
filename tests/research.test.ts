import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { RESEARCH, researchDef } from '../src/data/research';
import { addResearch, canResearch, newResearch, researchCost, researchFraction } from '../src/sim/research';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_HOUR } from '../src/sim/world';

function bench(w: ReturnType<typeof flatWorld>, x = 8, y = 8) {
  w.structures.place(x, y, 'banco_investigacion');
  const s = w.structures.at(x, y)!;
  w.completeStructure(s);
  return s;
}

describe('investigación', () => {
  it('el árbol pide lo de antes: sin Pólvora no hay Armas largas', () => {
    const r = newResearch();
    expect(canResearch(r, 'polvora')).toBe(true);
    expect(canResearch(r, 'armas_largas')).toBe(false);
    expect(canResearch(r, 'no_existe')).toBe(false);
    r.done.push('polvora');
    expect(canResearch(r, 'armas_largas')).toBe(true);
    expect(canResearch(r, 'polvora')).toBe(false);
    // El árbol completo (bloque 13, elegido por Mikel el 2026-10-19): 26 proyectos, 256 h.
    expect(RESEARCH.length).toBe(26);
    expect(RESEARCH.reduce((n, p) => n + p.hours, 0)).toBe(256);
    expect(researchDef('hidroponica')?.requires).toEqual(['agricultura']);
    expect(researchDef('motores')?.requires).toEqual(['navegacion', 'polvora']);
  });

  it('un proyecto se termina al llegar a su trabajo y queda hecho', () => {
    const r = newResearch();
    r.current = 'puentes';
    const cost = researchCost(researchDef('puentes')!);
    expect(addResearch(r, cost / 2)).toBeNull();
    expect(researchFraction(r, 'puentes')).toBeCloseTo(0.5);
    expect(addResearch(r, cost / 2)?.id).toBe('puentes');
    expect(r.done).toEqual(['puentes']);
    expect(r.current).toBeNull();
  });

  it('sin proyecto elegido nadie va al banco', () => {
    const w = flatWorld(1);
    bench(w);
    for (let i = 0; i < 300; i++) w.step();
    expect(w.colonists[0].job?.kind).not.toBe('investigar');
  });

  it('un colono con Investigación 10 termina «Puentes» (4 h) en unas 4 horas', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    c.skills.investigacion = 10;
    bench(w);
    expect(w.setResearch('armas_largas')).toBe(false);
    expect(w.setResearch('puentes')).toBe(true);
    let t = 0;
    for (; t < TICKS_PER_HOUR * 6 && !w.research.done.includes('puentes'); t++) w.step();
    expect(w.research.done).toContain('puentes');
    // Lo que tarda en llegar y la luz del día cuentan algo; no más de 5 h.
    expect(t).toBeGreaterThan(TICKS_PER_HOUR * 3.5);
    expect(t).toBeLessThan(TICKS_PER_HOUR * 5);
    expect(w.research.current).toBeNull();
    expect(w.log.some((l) => l.text.includes('Investigación terminada: Puentes'))).toBe(true);
    // Terminado, deja el banco.
    for (let i = 0; i < 60; i++) w.step();
    expect(c.job?.kind).not.toBe('investigar');
  });

  it('con el trabajo «Investigar» desactivado no investiga', () => {
    const w = flatWorld(1);
    w.colonists[0].priorities.investigar = 0;
    bench(w);
    w.setResearch('puentes');
    for (let i = 0; i < 600; i++) w.step();
    expect(w.research.progress.puentes ?? 0).toBe(0);
  });

  it('se guarda y se carga; las partidas antiguas empiezan sin nada investigado', () => {
    const w = flatWorld(1);
    w.research.done.push('polvora');
    w.research.progress.torretas = 123;
    w.setResearch('torretas');
    const back = loadWorld(JSON.stringify(serializeWorld(w)));
    expect(back.research.done).toEqual(['polvora']);
    expect(back.research.progress.torretas).toBe(123);
    expect(back.research.current).toBe('torretas');
    const old = serializeWorld(w) as unknown as Record<string, unknown>;
    delete old.research;
    const fresh = loadWorld(JSON.stringify(old));
    expect(fresh.research.done).toEqual([]);
    expect(fresh.research.current).toBeNull();
    // Lo que no respeta el árbol se descarta.
    const bad = serializeWorld(w) as unknown as Record<string, unknown>;
    bad.research = { current: 'artilleria', progress: { nada: 5 }, done: ['armas_largas'] };
    const b = loadWorld(JSON.stringify(bad));
    expect(b.research.done).toEqual([]);
    expect(b.research.current).toBeNull();
    expect(b.research.progress).toEqual({});
  });
});

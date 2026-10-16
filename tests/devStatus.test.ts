import { describe, expect, it } from 'vitest';
import roadmapMd from '../docs/ROADMAP.md?raw';
import progressMd from '../docs/PROGRESO.md?raw';
import feedbackMd from '../docs/FEEDBACK.md?raw';
import { buildStatus, nextSession, parsePendingFeedback, parseProgress, parseRoadmap, percent, plain } from '../src/ui/devStatus';

const ROADMAP = `# Roadmap

Intro.

## Fase 0 — Base

Terminado: se ve el **mapa**.

- [x] Proyecto
- [ ] Confirmar en \`móvil\`

## Fase 1 — Colonos

- [ ] Colonos
- [ ] Pathfinding

## Fase 5 — Sin tareas
`;

const PROGRESO = `# Progreso

## 2026-10-17 — Relieve

- Mesetas y **acantilados**.
- Qué probar: \`?seed=1\`.

## 2026-10-16 — Base

- Proyecto montado.
`;

const FEEDBACK = `# Feedback

## Pendiente

- [ ] **Vista 3D** (fecha): texto largo
  1. subpunto
- [ ] Panel de progreso

## Hecho

- [x] **Bugs**
`;

describe('estado del desarrollo', () => {
  it('lee fases, criterios y tareas del roadmap', () => {
    const phases = parseRoadmap(ROADMAP);
    expect(phases).toHaveLength(2);
    expect(phases[0].title).toBe('Fase 0 — Base');
    expect(phases[0].criterion).toBe('se ve el mapa.');
    expect(phases[0].tasks).toEqual([
      { text: 'Proyecto', done: true },
      { text: 'Confirmar en móvil', done: false },
    ]);
  });

  it('lee las últimas entradas del diario', () => {
    const entries = parseProgress(PROGRESO);
    expect(entries[0].title).toBe('2026-10-17 — Relieve');
    expect(entries[0].items).toEqual(['Mesetas y acantilados.', 'Qué probar: ?seed=1.']);
    expect(parseProgress(PROGRESO, 1)).toHaveLength(1);
  });

  it('lee el feedback pendiente de primer nivel', () => {
    expect(parsePendingFeedback(FEEDBACK)).toEqual(['Vista 3D', 'Panel de progreso']);
    expect(parsePendingFeedback('# nada')).toEqual([]);
  });

  it('calcula el total, la fase actual y lo siguiente (feedback primero)', () => {
    const s = buildStatus(ROADMAP, PROGRESO, FEEDBACK);
    expect(s.done).toBe(1);
    expect(s.total).toBe(4);
    // La fase 0 solo espera una confirmación: la fase en curso es la 1.
    expect(s.current).toBe(1);
    expect(s.awaitingConfirmation).toEqual(['Fase 0: Confirmar en móvil']);
    expect(s.nextTask).toBe('Vista 3D');
    const sinFeedback = buildStatus(ROADMAP, PROGRESO, '');
    expect(sinFeedback.nextTask).toBe('Colonos');
    expect(percent(1, 4)).toBe(25);
    expect(percent(0, 0)).toBe(0);
  });

  it('entiende los documentos reales del proyecto', () => {
    const s = buildStatus(roadmapMd, progressMd, feedbackMd);
    expect(s.phases.length).toBeGreaterThanOrEqual(6);
    expect(s.total).toBeGreaterThan(20);
    expect(s.done).toBeGreaterThan(0);
    expect(s.entries.length).toBeGreaterThan(0);
  });

  it('calcula la próxima sesión programada', () => {
    const at = (h: number, m: number) => {
      const d = new Date(2026, 9, 17, h, m);
      return d;
    };
    expect(nextSession(at(9, 0), [8, 12, 16, 20], 47).getHours()).toBe(12);
    expect(nextSession(at(8, 46), [8, 12, 16, 20], 47).getHours()).toBe(8);
    const late = nextSession(at(23, 0), [8, 12, 16, 20], 47);
    expect(late.getDate()).toBe(18);
    expect(late.getHours()).toBe(8);
  });

  it('quita el formato en línea', () => {
    expect(plain('**a** `b` ~~c~~ [d](http://x)')).toBe('a b c d');
  });
});

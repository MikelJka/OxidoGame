import { describe, expect, it } from 'vitest';
import { createColonist, groupSummary } from '../src/sim/colonist';
import { Rng } from '../src/sim/rng';

describe('resumen de un grupo (#16)', () => {
  const rng = new Rng(1);
  const make = (id: number, role: 'colono' | 'saqueador' | 'prisionero' | 'comerciante') => {
    const c = createColonist(id, { x: id, y: 0 }, rng);
    c.role = role;
    return c;
  };

  it('cuenta cada tipo, los caídos, los heridos y al líder', () => {
    const a = make(1, 'saqueador');
    const b = make(2, 'saqueador');
    const d = make(3, 'saqueador');
    b.downed = true;
    b.health = 0.2;
    d.health = 0.6;
    a.raider = { leader: true } as never;
    const t = make(4, 'comerciante');
    const text = groupSummary([a, b, d, t]);
    expect(text).toContain('3 saqueadores (1 en el suelo, 1 herido, con el líder ★)');
    expect(text).toContain('1 comerciante');
    expect(text).toContain('salud media 70 %');
  });

  it('un grupo de colonos sanos', () => {
    expect(groupSummary([make(5, 'colono'), make(6, 'colono')])).toBe('👥 2 colonos · ❤ salud media 100 %');
    expect(groupSummary([])).toBe('Nadie');
  });
});

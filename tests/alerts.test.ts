// Avisos en pantalla de raids, peleas, heridos y visitas (#17, #18).
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { attack, offerWanderer, startRaid, startTrader } from '../src/sim/people';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { COMBAT_ALERT_GAP, TICKS_PER_DAY } from '../src/sim/world';

function raiderNextTo(w: ReturnType<typeof flatWorld>) {
  const c = w.colonists[0];
  const r = w.makePawn('saqueador');
  r.tile = { x: c.tile.x + 1, y: c.tile.y };
  r.pos = { x: r.tile.x + 0.5, y: r.tile.y + 0.5 };
  r.raider = { fleeing: false, leaveAt: w.tick + TICKS_PER_DAY };
  w.others.push(r);
  return { c, r };
}

describe('avisos en pantalla', () => {
  it('un raid, una caravana y un superviviente dejan aviso en el diario, con sitio si lo hay', () => {
    const w = flatWorld(1);
    const raid = startRaid(w, 2);
    const raidLog = w.log.find((l) => l.alert === 'raid');
    expect(raidLog).toBeDefined();
    expect(raidLog!.at).toEqual(raid[0].tile);
    startTrader(w);
    expect(w.log.some((l) => l.alert === 'caravana' && l.at)).toBe(true);
    offerWanderer(w);
    expect(w.log[w.log.length - 1].alert).toBe('visita');
  });

  it('avisa de que un colono pelea, una sola vez por hora', () => {
    const w = flatWorld(1);
    const { c, r } = raiderNextTo(w);
    attack(w, c, r);
    attack(w, c, r);
    expect(w.log.filter((l) => l.alert === 'combate').length).toBe(1);
    expect(w.log.find((l) => l.alert === 'combate')!.text).toContain(c.name);
    w.tick += COMBAT_ALERT_GAP;
    attack(w, r, c);
    expect(w.log.filter((l) => l.alert === 'combate').length).toBe(2);
  });

  it('avisa de un colono herido y de uno caído', () => {
    const w = flatWorld(1);
    const { c, r } = raiderNextTo(w);
    r.skills.combate = 20;
    for (let i = 0; i < 400 && !c.downed; i++) attack(w, r, c);
    expect(c.downed).toBe(true);
    expect(w.log.some((l) => l.alert === 'herido')).toBe(true);
    const fall = w.log.find((l) => l.alert === 'caido');
    expect(fall?.text).toContain(c.name);
  });

  it('una pelea entre colonos no avisa', () => {
    const w = flatWorld(2);
    const [a, b] = w.colonists;
    attack(w, a, b);
    expect(w.log.some((l) => l.alert === 'combate')).toBe(false);
  });

  it('los avisos se guardan y se cargan; las partidas antiguas siguen leyéndose', () => {
    const w = flatWorld(1);
    startRaid(w, 1);
    const loaded = loadWorld(JSON.stringify(serializeWorld(w)));
    const l = loaded.log.find((e) => e.alert === 'raid');
    expect(l?.at).toBeDefined();
    const old = serializeWorld(w) as unknown as { log: Record<string, unknown>[] };
    old.log = [{ tick: 1, text: 'viejo', kind: 'info' }];
    const back = loadWorld(JSON.stringify(old));
    expect(back.log[0].alert).toBeUndefined();
    expect(back.log[0].at).toBeUndefined();
  });
});

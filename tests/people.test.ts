import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { buildingDef } from '../src/data/buildings';
import { Terrain } from '../src/sim/map';
import { attack, checkRaidMorale, dealBalance, makeDeal, makePrisoner, startRaid, startTrader, talkToPrisoner } from '../src/sim/people';
import { hurt, tickHealth } from '../src/sim/health';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/sim/world';
import type { Colonist } from '../src/sim/colonist';

function runTicks(w: ReturnType<typeof flatWorld>, n: number, until?: () => boolean): void {
  for (let i = 0; i < n; i++) {
    w.step();
    if (until?.()) return;
  }
}

/** Saqueador puesto a mano en una casilla. */
function prisonBed(w: ReturnType<typeof flatWorld>, x: number, y: number): void {
  w.structures.place(x, y, 'cama_prision');
  w.completeStructure(w.structures.at(x, y)!);
}

function raiderAt(w: ReturnType<typeof flatWorld>, x: number, y: number): Colonist {
  const r = w.makePawn('saqueador');
  r.tile = { x, y };
  r.pos = { x: x + 0.5, y: y + 0.5 };
  r.raider = { fleeing: false, leaveAt: w.tick + TICKS_PER_DAY };
  w.others.push(r);
  return r;
}

describe('salud', () => {
  it('sin comida ni agua, un colono acaba muriendo y la partida termina', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    c.needs.food = 0;
    c.needs.water = 0;
    runTicks(w, TICKS_PER_DAY * 2, () => w.gameOver !== null);
    expect(w.colonists.length).toBe(0);
    expect(w.gameOver).not.toBeNull();
    expect(w.graveyard[0].name).toBe(c.name);
  });

  it('un herido grave cae al suelo y se levanta al recuperarse', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    hurt(c, 0.9, 'el pecho');
    expect(c.downed).toBe(true);
    c.wounds.forEach((k) => (k.bleeding = false));
    for (let i = 0; i < 40 && c.downed; i++) tickHealth(c, TICKS_PER_DAY / 10, TICKS_PER_DAY, true);
    expect(c.downed).toBe(false);
  });
});

describe('raids', () => {
  it('llegan saqueadores por el borde', () => {
    const w = flatWorld(2);
    const raid = startRaid(w, 3);
    expect(raid.length).toBe(3);
    expect(w.others.filter((o) => o.role === 'saqueador').length).toBe(3);
    expect(w.log.some((l) => l.text.includes('Raid'))).toBe(true);
  });

  it('un colono reclutado pelea con el saqueador que tiene al lado hasta tumbarlo o hacerlo huir', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    c.skills.combate = 15;
    w.setDrafted(c.id, true);
    const r = raiderAt(w, 6, 5);
    r.skills.combate = 0;
    runTicks(w, TICKS_PER_HOUR, () => r.downed || !!r.raider?.fleeing || !w.others.includes(r));
    expect(r.health).toBeLessThan(1);
  });

  it('los golpes hieren y pueden tumbar', () => {
    const w = flatWorld(1);
    const a = w.colonists[0];
    const b = raiderAt(w, 6, 5);
    a.skills.combate = 20;
    for (let i = 0; i < 60 && !b.downed; i++) attack(w, a, b);
    expect(b.downed).toBe(true);
    expect(b.wounds.length).toBeGreaterThan(0);
  });
});

describe('moral de los raids', () => {
  it('el de más Combate es el líder ★', () => {
    const w = flatWorld(1);
    const raid = startRaid(w, 4);
    const best = Math.max(...raid.map((r) => r.skills.combate));
    const leaders = raid.filter((r) => r.raider?.leader);
    expect(leaders.length).toBe(1);
    expect(leaders[0].skills.combate).toBe(best);
    expect(w.raidGroups.length).toBe(1);
    expect(w.raidGroups[0].leaderId).toBe(leaders[0].id);
    expect(w.log.some((l) => l.text.includes('★'))).toBe(true);
  });

  it('si cae el líder, huyen todos', () => {
    const w = flatWorld(1);
    const raid = startRaid(w, 4);
    const leader = raid.find((r) => r.raider?.leader)!;
    checkRaidMorale(w);
    expect(raid.some((r) => r.raider!.fleeing)).toBe(false);
    hurt(leader, 0.95, 'el pecho');
    expect(leader.downed).toBe(true);
    checkRaidMorale(w);
    for (const r of raid) if (r !== leader) expect(r.raider!.fleeing).toBe(true);
    expect(w.log.some((l) => l.text.includes('líder del raid'))).toBe(true);
  });

  it('si cae la mitad del grupo, huyen todos; con menos, siguen', () => {
    const w = flatWorld(1);
    const raid = startRaid(w, 4);
    const rest = raid.filter((r) => !r.raider?.leader);
    hurt(rest[0], 0.95, 'el pecho');
    checkRaidMorale(w);
    expect(raid.some((r) => r.raider!.fleeing)).toBe(false);
    // El segundo caído es capturado (también cuenta como caído).
    makePrisoner(rest[1], 0.5);
    checkRaidMorale(w);
    expect(rest[2].raider!.fleeing).toBe(true);
    expect(raid.find((r) => r.raider?.leader)!.raider!.fleeing).toBe(true);
  });

  it('los que se escapan no cuentan como caídos', () => {
    const w = flatWorld(1);
    const raid = startRaid(w, 4);
    const rest = raid.filter((r) => !r.raider?.leader);
    // Dos se han ido del mapa por su cuenta.
    for (const r of rest.slice(0, 2)) {
      w.others.splice(w.others.indexOf(r), 1);
      w.raidGroups[0].escaped.push(r.id);
    }
    checkRaidMorale(w);
    expect(rest[2].raider!.fleeing).toBe(false);
  });

  it('el raid y su líder se guardan con la partida', () => {
    const w = flatWorld(1);
    const raid = startRaid(w, 3);
    const leader = raid.find((r) => r.raider?.leader)!;
    const w2 = loadWorld(serializeWorld(w));
    expect(w2.raidGroups).toEqual(w.raidGroups);
    const l2 = w2.others.find((o) => o.id === leader.id)!;
    expect(l2.raider?.leader).toBe(true);
    expect(l2.raider?.group).toBe(w.raidGroups[0].id);
  });

  it('cuando ya no queda nadie del raid, se olvida', () => {
    const w = flatWorld(1);
    const raid = startRaid(w, 2);
    for (const r of raid) makePrisoner(r, 0.5);
    checkRaidMorale(w);
    expect(w.raidGroups.length).toBe(0);
  });
});

describe('prisioneros', () => {
  it('el carcelero captura a un saqueador caído', () => {
    const w = flatWorld(1);
    prisonBed(w, 12, 10);
    const r = raiderAt(w, 9, 5);
    hurt(r, 0.95, 'la pierna izquierda');
    expect(r.downed).toBe(true);
    runTicks(w, 2000, () => r.role === 'prisionero');
    expect(r.role).toBe('prisionero');
    expect(r.prisoner?.mode).toBe('retener');
  });

  it('el médico cura las heridas que sangran', () => {
    const w = flatWorld(2);
    const [, patient] = w.colonists;
    hurt(patient, 0.2, 'el brazo derecho');
    expect(patient.wounds.some((k) => k.bleeding)).toBe(true);
    runTicks(w, 2000, () => !patient.wounds.some((k) => k.bleeding));
    expect(patient.wounds.some((k) => k.bleeding)).toBe(false);
  });

  it('el capturado se lleva a una cama de prisionero si la hay', () => {
    const w = flatWorld(1);
    prisonBed(w, 12, 10);
    const r = raiderAt(w, 8, 5);
    hurt(r, 0.95, 'la cabeza');
    runTicks(w, 4000, () => r.role === 'prisionero' && r.carriedBy === undefined && r.tile.x === 12);
    expect(r.tile).toEqual({ x: 12, y: 10 });
  });

  it('a fuerza de charlas un prisionero se une a la colonia', () => {
    const w = flatWorld(1);
    const warden = w.colonists[0];
    warden.skills.social = 10;
    const p = raiderAt(w, 8, 8);
    makePrisoner(p, 0.3);
    p.prisoner!.mode = 'convencer';
    let joined = false;
    for (let i = 0; i < 30 && !joined; i++) {
      w.tick += 7 * TICKS_PER_HOUR;
      joined = talkToPrisoner(w, warden, p);
    }
    expect(joined).toBe(true);
    expect(w.colonists).toContain(p);
    expect(p.role).toBe('colono');
    expect(new Set(w.colonists.map((c) => c.id)).size).toBe(w.colonists.length);
  });

  it('el carcelero habla solo con los que hay que convencer', () => {
    const w = flatWorld(1);
    const p = raiderAt(w, 8, 8);
    makePrisoner(p, 0.8);
    p.needs.food = 1;
    p.needs.water = 1;
    runTicks(w, 600);
    expect(p.prisoner!.resistance).toBe(0.8);
    p.prisoner!.mode = 'convencer';
    runTicks(w, 1500, () => p.prisoner!.resistance < 0.8);
    expect(p.prisoner!.resistance).toBeLessThan(0.8);
  });

  it('un prisionero liberado se marcha del mapa', () => {
    const w = flatWorld(1);
    const p = raiderAt(w, 3, 3);
    makePrisoner(p, 0.5);
    p.prisoner!.mode = 'liberar';
    runTicks(w, 3000, () => !w.others.includes(p));
    expect(w.others).not.toContain(p);
  });
});

describe('comercio', () => {
  it('se compran recursos pagando con otros y no se acepta un mal trato', () => {
    const w = flatWorld(1);
    const t = startTrader(w)!;
    t.trader!.stock = { metal: 20 };
    w.items.drop(5, 6, 'madera', 50);
    expect(makeDeal(w, t, { buy: { metal: 10 }, sell: { madera: 1 }, slaves: [], sellPrisoners: [] })).not.toBeNull();
    const deal = { buy: { metal: 2 }, sell: { madera: 50 }, slaves: [], sellPrisoners: [] };
    expect(dealBalance(w, t, deal)).toBeGreaterThanOrEqual(0);
    expect(makeDeal(w, t, deal)).toBeNull();
    expect(w.inventory().metal).toBe(2);
    expect(w.inventory().madera).toBe(0);
    expect(t.trader!.stock.metal).toBe(18);
  });

  it('un esclavo comprado pasa a ser prisionero para convencer', () => {
    const w = flatWorld(1);
    const t = startTrader(w)!;
    const slave = w.makePawn('prisionero');
    t.trader!.slaves = [slave];
    w.items.drop(5, 6, 'componentes', 200);
    expect(makeDeal(w, t, { buy: {}, sell: { componentes: 200 }, slaves: [slave.id], sellPrisoners: [] })).toBeNull();
    expect(w.others).toContain(slave);
    expect(slave.prisoner?.mode).toBe('convencer');
  });
});

describe('supervivientes', () => {
  it('aceptar una oferta suma un colono', () => {
    const w = flatWorld(1);
    const c = w.makePawn('colono');
    w.offer = { kind: 'superviviente', pawn: c, until: w.tick + 100 };
    w.acceptOffer();
    expect(w.colonists.length).toBe(2);
    expect(w.offer).toBeNull();
  });
});

describe('#12: el superviviente aceptado llega aunque se haya construido sobre el inicio', () => {
  const blockStart = (w: ReturnType<typeof flatWorld>) => {
    w.map.start = { x: 15, y: 15 };
    w.structures.restore(buildingDef('muro_madera'), 15, 15, true, {}, 1, 100);
  };

  it('entra por un borde y camina hacia la colonia', () => {
    const w = flatWorld(1);
    blockStart(w);
    expect(w.colonyPoint()).not.toEqual({ x: 15, y: 15 });
    const c = w.makePawn('colono');
    w.offer = { kind: 'superviviente', pawn: c, until: w.tick + 100 };
    w.acceptOffer();
    const { x, y } = c.tile;
    expect(x === 0 && y === 0).toBe(false);
    expect(x === 0 || y === 0 || x === 29 || y === 29).toBe(true);
    expect(c.path.length).toBeGreaterThan(0);
  });

  it('con la colonia cerrada sin entrada, aparece junto a un colono', () => {
    const w = flatWorld(1);
    // Anillo de muros alrededor del colono (5, 5) y del inicio.
    w.map.start = { x: 5, y: 6 };
    for (let x = 2; x <= 14; x++) for (let y = 2; y <= 14; y++) {
      if (x === 2 || x === 14 || y === 2 || y === 14) w.structures.restore(buildingDef('muro_madera'), x, y, true, {}, 1, 100);
    }
    const c = w.makePawn('colono');
    w.offer = { kind: 'superviviente', pawn: c, until: w.tick + 100 };
    w.acceptOffer();
    expect(Math.max(Math.abs(c.tile.x - 5), Math.abs(c.tile.y - 5))).toBeLessThanOrEqual(2);
  });

  it('las partidas con un colono atascado en (0, 0) lo traen a la colonia al cargar', async () => {
    const { serializeWorld, loadWorld } = await import('../src/sim/save');
    const w = flatWorld(1);
    w.map.terrain[0] = Terrain.DeepWater;
    const c = w.makePawn('colono');
    w.colonists.push(c); // como lo dejaba el fallo: en la esquina
    const back = loadWorld(serializeWorld(w));
    const k = back.colonists.find((o) => o.id === c.id)!;
    expect(k.tile.x === 0 && k.tile.y === 0).toBe(false);
    expect(Math.max(Math.abs(k.tile.x - 5), Math.abs(k.tile.y - 5))).toBeLessThanOrEqual(2);
  });
});

describe('guardar personas', () => {
  it('prisioneros, saqueadores, comerciantes, heridas y diario sobreviven a guardar y cargar', async () => {
    const { serializeWorld, loadWorld } = await import('../src/sim/save');
    const w = flatWorld(2);
    const r = raiderAt(w, 8, 8);
    hurt(r, 0.3, 'el pecho');
    const p = raiderAt(w, 9, 9);
    makePrisoner(p, 0.4);
    p.prisoner!.mode = 'convencer';
    const t = startTrader(w)!;
    t.trader!.slaves = [w.makePawn('prisionero')];
    hurt(w.colonists[0], 0.1, 'el brazo izquierdo');
    w.addLog('prueba', 'bueno');
    w.graveyard.push({ name: 'Ana', cause: 'sed', day: 2 });
    const back = loadWorld(JSON.parse(JSON.stringify(serializeWorld(w))));
    expect(back.others.map((o) => o.role).sort()).toEqual(['comerciante', 'prisionero', 'saqueador']);
    const p2 = back.others.find((o) => o.role === 'prisionero')!;
    expect(p2.prisoner).toEqual({ resistance: 0.4, mode: 'convencer', lastTalk: -1e9 });
    expect(back.others.find((o) => o.role === 'saqueador')!.wounds.length).toBe(1);
    expect(back.others.find((o) => o.role === 'comerciante')!.trader!.slaves.length).toBe(1);
    expect(back.colonists[0].wounds.length).toBe(1);
    expect(back.log.some((l) => l.text === 'prueba')).toBe(true);
    expect(back.graveyard).toEqual(w.graveyard);
    expect(back.schedule).toEqual(w.schedule);
    expect(back.nextPawnId).toBe(w.nextPawnId);
  });
});

// Bloque 9 del catálogo, primera parte: los sucesos, con la tormenta de polvo y el alijo.
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { EVENT_FIRST_DAY, EVENT_GAP, eventDef } from '../src/data/events';
import { activeEvent, reachFactor, runEvents, solarFactor, startEvent } from '../src/sim/events';
import { reachOf } from '../src/sim/people';
import { lacksPower } from '../src/sim/power';
import { cropDef } from '../src/data/crops';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/sim/time';

describe('sucesos', () => {
  it('tormenta de polvo: un día sin placas solares y con los disparos a la mitad de lejos', () => {
    const w = flatWorld(1);
    const d = eventDef('tormenta_polvo')!;
    expect(d.hours).toBe(24);
    const [c] = w.colonists;
    c.weapon = 'rifle';
    c.weaponChoice = 'rifle';
    c.ammo = 10;
    const before = reachOf(c, w);
    expect(startEvent(w, 'tormenta_polvo')).toBe(true);
    expect(solarFactor(w)).toBe(0);
    expect(reachFactor(w)).toBe(0.5);
    expect(reachOf(c, w)).toBe(Math.floor(before / 2));
    expect(w.clockLabel()).toContain('🌪');
    // Se guarda.
    expect(activeEvent(loadWorld(serializeWorld(w)), 'tormenta_polvo')).toBeDefined();
    w.tick += 24 * TICKS_PER_HOUR;
    w.nextEvent = Infinity;
    runEvents(w);
    expect(activeEvent(w, 'tormenta_polvo')).toBeUndefined();
    expect(solarFactor(w)).toBe(1);
    expect(reachOf(c, w)).toBe(before);
  });

  it('alijo: aparecen recursos por valor de 150 a 400 chapas lejos de la colonia', () => {
    const w = flatWorld(1);
    w.map.start = { x: 3, y: 3 };
    const before = w.items.list().length;
    expect(startEvent(w, 'alijo')).toBe(true);
    expect(w.items.list().length).toBeGreaterThan(before);
    expect(w.log.some((l) => l.text.includes('alijo'))).toBe(true);
  });

  it('cada 2–4 días pasa algo, desde el día 3', () => {
    expect(EVENT_FIRST_DAY).toBe(3);
    expect(EVENT_GAP).toEqual([2, 4]);
    const w = flatWorld(1);
    w.map.start = { x: 3, y: 3 };
    w.nextEvent = w.tick;
    const logs = w.log.length;
    runEvents(w);
    expect(w.nextEvent).toBeGreaterThanOrEqual(w.tick + 2 * TICKS_PER_DAY);
    expect(w.nextEvent).toBeLessThanOrEqual(w.tick + 4 * TICKS_PER_DAY);
    expect(w.log.length).toBeGreaterThan(logs);
  });
});

describe('avería y lluvia ácida', () => {
  it('avería: una máquina eléctrica se para hasta que un colono la arregla con ⚙️1', () => {
    const w = flatWorld(1);
    w.map.start = { x: 3, y: 3 };
    w.items.drop(6, 6, 'componentes', 3);
    expect(w.structures.place(12, 12, 'radio')).toBe(true);
    const radio = w.structures.at(12, 12)!;
    w.completeStructure(radio);
    radio.powered = true;
    expect(startEvent(w, 'averia')).toBe(true);
    expect(radio.repair).toBeDefined();
    expect(w.structures.needs(radio)).toEqual({ componentes: 1 });
    expect(lacksPower(radio)).toBe(true);
    // Se guarda averiada.
    expect(loadWorld(serializeWorld(w)).structures.at(12, 12)?.repair).toBeDefined();
    let t = 0;
    for (; t < 20000 && radio.repair; t++) w.step();
    expect(radio.repair).toBeUndefined();
    expect(w.inventory().componentes).toBe(2);
  });

  it('lluvia ácida: 6 h; lo plantado al aire libre da un 30 % menos y quema a quien está fuera', () => {
    const w = flatWorld(1);
    const d = eventDef('lluvia_acida')!;
    expect(d.hours).toBe(6);
    expect(d.cropYield).toBe(0.7);
    const farm = w.farms.create({ x0: 10, y0: 10, x1: 11, y1: 10 }, cropDef('patata')!)!;
    expect(farm).toBeTruthy();
    w.farms.sow(10, 10);
    const [c] = w.colonists;
    c.health = 1;
    expect(startEvent(w, 'lluvia_acida')).toBe(true);
    expect(w.farms.plantAt(10, 10)?.harm).toBe(0.7);
    expect(c.health).toBeLessThan(1);
    expect(c.health).toBeGreaterThanOrEqual(0.5);
    const p = w.farms.plantAt(10, 10)!;
    p.growth = 1;
    const got = w.farms.harvest(10, 10, () => 10)!;
    expect(got.amount).toBeLessThan(10);
  });
});

describe('plaga', () => {
  function farmWorld() {
    const w = flatWorld(1);
    w.farms.create({ x0: 10, y0: 10, x1: 13, y1: 11 }, cropDef('patata')!);
    for (let x = 10; x <= 13; x++) for (let y = 10; y <= 11; y++) w.farms.sow(x, y);
    return w;
  }
  const count = (w: ReturnType<typeof flatWorld>) => w.farms.plantList().length;
  const sick = (w: ReturnType<typeof flatWorld>) => w.farms.plantList().filter((p) => p.plant.sick).length;

  it('enferma una cuarta parte del huerto; si los que cultivan las arrancan a tiempo, se acaba', () => {
    const w = farmWorld();
    expect(startEvent(w, 'plaga')).toBe(true);
    expect(sick(w)).toBe(2);
    expect(w.plague).not.toBeNull();
    // Se guarda.
    const back = loadWorld(serializeWorld(w));
    expect(back.plague).toEqual(w.plague);
    expect(back.farms.plantList().filter((p) => p.plant.sick).length).toBe(2);
    for (let t = 0; t < 6000 && sick(w) > 0; t++) w.step();
    expect(sick(w)).toBe(0);
    w.nextEvent = Infinity;
    runEvents(w);
    expect(w.plague).toBeNull();
    expect(count(w)).toBe(6);
  });

  it('si no se arrancan en un día, el huerto pierde la mitad', () => {
    const w = farmWorld();
    w.colonists[0].priorities.cultivar = 0;
    startEvent(w, 'plaga');
    w.tick = w.plague!.until;
    w.nextEvent = Infinity;
    runEvents(w);
    expect(w.plague).toBeNull();
    expect(count(w)).toBe(4);
    expect(sick(w)).toBe(0);
  });
});

describe('refugiado herido', () => {
  it('pide ayuda; acogido y curado, se queda o vuelve con los suyos, y su facción sube 10', () => {
    const w = flatWorld(1);
    w.map.start = { x: 3, y: 3 };
    expect(startEvent(w, 'refugiado')).toBe(true);
    expect(w.offer?.kind).toBe('refugiado');
    const c = w.offer!.pawn;
    const faction = c.faction!;
    expect(faction).not.toBe('piratas_oxido');
    expect(loadWorld(serializeWorld(w)).offer?.kind).toBe('refugiado');
    const before = w.faction(faction)!.relation;
    w.acceptOffer();
    expect(w.colonists).toContain(c);
    expect(c.refugee).toBe(faction);
    // Curado.
    c.wounds = [];
    c.health = 1;
    w.nextEvent = Infinity;
    runEvents(w);
    expect(c.refugee).toBeUndefined();
    expect(w.faction(faction)!.relation).toBe(before + 10);
    expect(w.colonists.includes(c) || w.others.includes(c)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { BUILDINGS, buildingDef } from '../src/data/buildings';
import { RECIPES, recipeDef, recipesFor, validateRecipe } from '../src/data/recipes';
import { checkWorld } from '../src/sim/diagnostics';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { flatWorld } from './helpers';

function runUntil(world: ReturnType<typeof flatWorld>, done: () => boolean, maxTicks = 30000): number {
  for (let t = 0; t < maxTicks; t++) {
    if (done()) return t;
    world.step();
    if (t % 250 === 0) expect(checkWorld(world)).toEqual([]);
  }
  return -1;
}

/** Levanta una construcción al momento (con su material) para las pruebas. */
function buildNow(world: ReturnType<typeof flatWorld>, x: number, y: number, id: string) {
  world.structures.place(x, y, id);
  const s = world.structures.at(x, y)!;
  for (const [r, n] of Object.entries(s.def.cost)) world.structures.deliver(s, r as never, n as number);
  world.completeStructure(s);
  return s;
}

describe('talleres y metal', () => {
  it('las recetas son válidas y cada taller tiene alguna; hay construcciones de metal', () => {
    expect(RECIPES.length).toBeGreaterThanOrEqual(2);
    // El banco de investigación no fabrica: investiga.
    for (const st of BUILDINGS.filter((b) => b.category === 'taller' && b.id !== 'banco_investigacion')) expect(recipesFor(st.id).length).toBeGreaterThan(0);
    expect(recipeDef('fundir_chatarra')!.outputs.metal).toBeGreaterThan(0);
    for (const cat of ['muro', 'torre', 'puerta', 'porton']) {
      expect(BUILDINGS.some((b) => b.category === cat && b.cost.metal)).toBe(true);
    }
    expect(buildingDef('muro_metal').hp).toBeGreaterThan(buildingDef('muro_piedra').hp);
    expect(() => validateRecipe({ id: 'x', name: 'X', station: 'muro_madera', inputs: { chatarra: 1 }, outputs: { metal: 1 }, work: 1 })).toThrow();
  });

  it('con una orden, los colonos llevan chatarra al horno y funden metal hasta el objetivo', () => {
    const world = flatWorld(2);
    world.items.drop(4, 12, 'chatarra', 75);
    const horno = buildNow(world, 12, 8, 'horno');
    world.structures.setBill(horno, { recipe: recipeDef('fundir_chatarra')!, target: 10, paused: false });
    const t = runUntil(world, () => world.inventory().metal >= 10 && world.colonists.every((c) => !c.job));
    expect(t).toBeGreaterThan(0);
    expect(world.inventory().metal).toBe(10);
    // Se para al llegar al objetivo: no sigue gastando chatarra.
    for (let i = 0; i < 2000; i++) world.step();
    expect(world.inventory().metal).toBe(10);
    expect(world.inventory().chatarra + (horno.delivered.chatarra ?? 0)).toBe(55);
  });

  it('en pausa o sin orden, el taller no hace nada', () => {
    const world = flatWorld();
    world.items.drop(4, 12, 'chatarra', 40);
    const horno = buildNow(world, 12, 8, 'horno');
    world.structures.setBill(horno, { recipe: recipeDef('fundir_chatarra')!, target: 10, paused: true });
    for (let i = 0; i < 3000; i++) world.step();
    expect(world.inventory().metal).toBe(0);
  });

  it('demoler un taller devuelve lo que tenía dentro', () => {
    const world = flatWorld();
    const horno = buildNow(world, 12, 8, 'horno');
    world.structures.setBill(horno, { recipe: recipeDef('fundir_chatarra')!, target: 10, paused: false });
    world.structures.deliver(horno, 'chatarra', 7);
    world.demolishStructure(horno);
    expect(world.inventory().chatarra).toBe(7 + Math.floor(10 * 0.5));
  });

  it('la orden y lo que hay dentro del taller se guardan con la partida', () => {
    const world = flatWorld();
    const horno = buildNow(world, 12, 8, 'horno');
    world.structures.setBill(horno, { recipe: recipeDef('fundir_chatarra')!, target: 25, paused: false });
    world.structures.deliver(horno, 'chatarra', 4);
    const loaded = loadWorld(JSON.stringify(serializeWorld(world)));
    const h = loaded.structures.at(12, 8)!;
    expect(h.bill?.recipe.id).toBe('fundir_chatarra');
    expect(h.bill?.target).toBe(25);
    expect(h.delivered.chatarra).toBe(4);
  });

  it('«fabricar N» hace solo esas unidades aunque ya haya de sobra, y luego para', () => {
    const world = flatWorld(2);
    world.items.drop(4, 12, 'chatarra', 60);
    world.items.drop(5, 12, 'metal', 30);
    const horno = buildNow(world, 12, 8, 'horno');
    const per = recipeDef('fundir_chatarra')!.outputs.metal!;
    world.structures.setBill(horno, { recipe: recipeDef('fundir_chatarra')!, target: 0, paused: false, mode: 'count' });
    world.structures.setBillTarget(horno, per * 2);
    const t = runUntil(world, () => horno.bill!.target === 0 && world.colonists.every((c) => !c.job));
    expect(t).toBeGreaterThan(0);
    expect(world.inventory().metal).toBe(30 + per * 2);
    // Terminada: ni fabrica más ni pide más chatarra.
    for (let i = 0; i < 2000; i++) world.step();
    expect(world.inventory().metal).toBe(30 + per * 2);
    expect(horno.delivered.chatarra ?? 0).toBe(0);
    expect(world.structures.needsAny(horno)).toBe(false);
  });

  it('el número de la orden va de 1 en 1, no baja de 0 y se guarda con su modo', () => {
    const world = flatWorld();
    const horno = buildNow(world, 12, 8, 'horno');
    world.structures.setBill(horno, { recipe: recipeDef('fundir_chatarra')!, target: 20, paused: false });
    world.structures.setBillTarget(horno, 1);
    expect(horno.bill!.target).toBe(1);
    world.structures.setBillTarget(horno, -3);
    expect(horno.bill!.target).toBe(0);
    world.structures.setBillTarget(horno, 7);
    world.structures.setBillMode(horno, 'count');
    world.structures.toggleBillPause(horno);
    const h = loadWorld(JSON.stringify(serializeWorld(world))).structures.at(12, 8)!;
    expect(h.bill).toMatchObject({ target: 7, mode: 'count', paused: true });
    // Las órdenes de partidas antiguas (sin modo) son «hasta tener».
    const old = serializeWorld(world);
    const st = old.structures.find((x) => x.bill)!;
    delete st.bill!.mode;
    expect(loadWorld(JSON.stringify(old)).structures.at(12, 8)!.bill!.mode).toBe('until');
  });
});

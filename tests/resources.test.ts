import { describe, expect, it } from 'vitest';
import { RESOURCES } from '../src/data/resources';
import { describeTile, generateMap, isPassable, Prop, PROP_INFO } from '../src/sim/map';
import { addResources, emptyStockpile, harvestAt, harvestTile, mapResources, reachableResources } from '../src/sim/resources';
import { Rng } from '../src/sim/rng';

/** Primera casilla del mapa con un objeto dado. */
function findProp(map: ReturnType<typeof generateMap>, prop: Prop): { x: number; y: number } {
  const i = map.props.indexOf(prop);
  if (i < 0) throw new Error(`no hay ${PROP_INFO[prop].name}`);
  return { x: i % map.width, y: Math.floor(i / map.width) };
}

describe('recursos del mapa', () => {
  it('cada objeto aprovechable tiene recursos dentro de su rango y el resto ninguno', () => {
    const map = generateMap({ width: 100, height: 100, seed: 11 });
    for (let i = 0; i < map.props.length; i++) {
      const h = PROP_INFO[map.props[i] as Prop].harvest;
      if (h) {
        expect(map.stock[i]).toBeGreaterThanOrEqual(h.amount[0]);
        expect(map.stock[i]).toBeLessThanOrEqual(h.amount[1]);
      } else {
        expect(map.stock[i]).toBe(0);
      }
    }
  });

  it('es determinista con la misma semilla', () => {
    const a = generateMap({ width: 60, height: 60, seed: 5 });
    const b = generateMap({ width: 60, height: 60, seed: 5 });
    expect(Array.from(a.stock)).toEqual(Array.from(b.stock));
  });

  it('desde el inicio se alcanzan madera, piedra y chatarra en todas las semillas', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const map = generateMap({ width: 100, height: 100, seed });
      const total = reachableResources(map);
      expect(total.madera, `madera, semilla ${seed}`).toBeGreaterThan(200);
      expect(total.piedra, `piedra, semilla ${seed}`).toBeGreaterThan(200);
      expect(total.chatarra, `chatarra, semilla ${seed}`).toBeGreaterThan(100);
    }
  });

  it('talar un árbol da madera y deja un tocón que se puede pisar', () => {
    const map = generateMap({ width: 100, height: 100, seed: 3 });
    const { x, y } = findProp(map, Prop.DeadTree);
    const i = y * map.width + x;
    const wood = map.stock[i];
    expect(harvestAt(map, x, y)?.job).toBe('talar');
    const gains = harvestTile(map, x, y, new Rng(1));
    expect(gains).toEqual({ madera: wood });
    expect(map.props[i]).toBe(Prop.Stump);
    expect(map.stock[i]).toBeGreaterThan(0);
    // El tocón también da algo de madera y luego la casilla queda libre.
    harvestTile(map, x, y, new Rng(1));
    expect(map.props[i]).toBe(Prop.None);
    expect(map.stock[i]).toBe(0);
    expect(harvestAt(map, x, y)).toBeNull();
    expect(harvestTile(map, x, y, new Rng(1))).toBeNull();
  });

  it('desguazar un coche da chatarra y algún componente, y libera el paso', () => {
    const map = generateMap({ width: 100, height: 100, seed: 4 });
    const { x, y } = findProp(map, Prop.CarWreck);
    expect(isPassable(map, x, y)).toBe(false);
    const gains = harvestTile(map, x, y, new Rng(9))!;
    expect(gains.chatarra).toBeGreaterThanOrEqual(30);
    expect(gains.componentes ?? 0).toBeGreaterThanOrEqual(1);
    expect(map.props[y * map.width + x]).toBe(Prop.None);
  });

  it('la información de casilla dice cuánto recurso queda', () => {
    const map = generateMap({ width: 100, height: 100, seed: 3 });
    const { x, y } = findProp(map, Prop.Boulder);
    expect(describeTile(map, x, y)).toContain(`piedra ${map.stock[y * map.width + x]}`);
  });

  it('lo alcanzable es parte del total del mapa', () => {
    const map = generateMap({ width: 100, height: 100, seed: 7 });
    const all = mapResources(map);
    const near = reachableResources(map);
    for (const r of RESOURCES) expect(near[r]).toBeLessThanOrEqual(all[r]);
  });

  it('suma recursos en el almacén', () => {
    const s = emptyStockpile();
    expect(Object.keys(s).sort()).toEqual([...RESOURCES].sort());
    addResources(s, { madera: 5 });
    addResources(s, { madera: 2, chatarra: 1 });
    expect(s).toEqual({ ...emptyStockpile(), madera: 7, chatarra: 1 });
  });
});

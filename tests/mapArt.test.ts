import { describe, expect, it } from 'vitest';
import { paintGround, PropRasterizer, TILE } from '../src/render/mapArt';
import { TILE_H, TOP_MARGIN } from '../src/render/projection';
import { generateMap, Prop } from '../src/sim/map';

/** Rasterizador falso (sin lienzo): un bloque de color según el objeto y su azar. */
const fakeRaster: PropRasterizer = (p, rng) => {
  const width = TILE;
  const height = TILE + 16;
  const data = new Uint8ClampedArray(width * height * 4);
  const shift = rng.int(0, 3);
  for (let y = 10 + shift; y < height; y++) {
    for (let x = 2; x < width - 2; x++) {
      const o = (y * width + x) * 4;
      data[o] = p * 17;
      data[o + 1] = 200 - p * 9;
      data[o + 2] = 40 + shift * 30;
      data[o + 3] = 255;
    }
  }
  return { data, width, height, anchorY: 16 };
};

describe('pintado del mapa', () => {
  it('repintar una columna tras talar deja la imagen igual que pintarla entera', () => {
    const map = generateMap({ width: 40, height: 40, seed: 3 });
    const size = map.width * TILE * (map.height * TILE_H + TOP_MARGIN) * 4;
    const img = { data: new Uint8ClampedArray(size) };
    paintGround(map, img, fakeRaster);
    // Se tala el primer árbol y se repinta solo su columna.
    const i = map.props.indexOf(Prop.DeadTree);
    expect(i).toBeGreaterThanOrEqual(0);
    map.props[i] = Prop.Stump;
    paintGround(map, img, fakeRaster, i % map.width);
    const full = { data: new Uint8ClampedArray(size) };
    paintGround(map, full, fakeRaster);
    let firstDiff = -1;
    for (let k = 0; k < size && firstDiff < 0; k++) if (img.data[k] !== full.data[k]) firstDiff = k;
    expect(firstDiff).toBe(-1);
  });
});

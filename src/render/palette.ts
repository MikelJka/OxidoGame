import { Terrain } from '../sim/map';

/** Colores base de cada terreno (estilo pixel art apagado, postapocalíptico). */
export const TERRAIN_COLORS: Record<Terrain, [number, number, number]> = {
  [Terrain.DeepWater]: [30, 52, 70],
  [Terrain.Water]: [46, 84, 102],
  [Terrain.ShallowWater]: [78, 118, 124],
  [Terrain.Sand]: [170, 150, 110],
  [Terrain.Wasteland]: [120, 104, 78],
  [Terrain.DeadForest]: [70, 64, 48],
  [Terrain.Hills]: [132, 118, 96],
  [Terrain.Rock]: [88, 84, 80],
  [Terrain.Ruins]: [100, 96, 104],
  [Terrain.Irradiated]: [110, 128, 60],
  [Terrain.Spring]: [90, 170, 190],
};

/** Tinte que se suma al agua contaminada. */
export const CONTAMINATION_TINT: [number, number, number] = [40, 30, -20];

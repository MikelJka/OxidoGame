// Comida que se pone mala (pedido de Mikel del 2026-10-21): cada hora, los montones de comida pierden
// una parte (la carne y el pescado, deprisa; el maíz, casi nada) salvo los que están en una nevera con
// corriente, y nada cuando hace frío. Puro y determinista: sin Phaser ni DOM.
import { SPOIL_PER_DAY } from '../data/spoilage';
import { lacksPower } from './power';
import { coldNow } from './seasons';
import type { World } from './world';

/** Está en una nevera terminada que tiene corriente. */
export function inFridge(w: World, x: number, y: number): boolean {
  const s = w.structures.at(x, y);
  return !!s && s.built && !!s.def.fridge && !lacksPower(s);
}

/** Una hora: lo que se echa a perder. Devuelve cuánto se ha perdido. */
export function spoilHour(w: World): number {
  if (coldNow(w)) return 0;
  let lost = 0;
  for (const st of w.items.list()) {
    const rate = SPOIL_PER_DAY[st.resource];
    if (!rate || inFridge(w, st.x, st.y)) continue;
    // Lo que toca perder esta hora; lo que no llega a una unidad, a suertes.
    const due = (st.amount * rate) / 24;
    const n = Math.floor(due) + (w.rng.chance(due - Math.floor(due)) ? 1 : 0);
    if (n <= 0) continue;
    const got = w.items.take(st.x, st.y, n);
    if (got) lost += got.amount;
  }
  w.spoiled += lost;
  return lost;
}

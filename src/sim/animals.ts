// Animales y caza (bloque 10 del catálogo): ciervos mutados, jabalíes y ratas gigantes van por el
// mapa. Marcados con 🎯 Cazar, los colonos con «Cazar» van a por ellos con su arma y dejan 🥩 carne
// y 🟫 cuero. El jabalí herido ataca; la rata gigante roba comida de los almacenes sin muros.
// Puro y determinista: sin Phaser ni DOM.
import { ANIMALS, CREATURES, CreatureId } from '../data/creatures';
import { FOOD_RESOURCES } from '../data/resources';
import type { Colonist } from './colonist';
import { findPath } from './pathfinding';
import { isPassable } from './map';
import { Rng } from './rng';
import { TICKS_PER_DAY } from './time';
import type { World } from './world';

/** Animales que hay ahora en el mapa. */
export function animalsOnMap(w: World): Colonist[] {
  return w.others.filter((o) => o.role === 'animal');
}

/** Cada día: llegan 1–3 animales por los bordes, sin pasar de 8. */
export function spawnAnimals(w: World): Colonist[] {
  const out: Colonist[] = [];
  const rng = new Rng(((w.map.seed ^ 0x0a17a15) + w.day * 0x9e3779b1) >>> 0);
  const room = ANIMALS.max - animalsOnMap(w).length;
  const n = Math.min(room, rng.int(ANIMALS.perDay[0], ANIMALS.perDay[1]));
  const kinds = Object.entries(ANIMALS.weights) as [CreatureId, number][];
  const total = kinds.reduce((a, [, k]) => a + k, 0);
  for (let i = 0; i < n; i++) {
    let roll = rng.next() * total;
    const kind = (kinds.find(([, k]) => (roll -= k) < 0) ?? kinds[0])[0];
    const a = makeAnimal(w, kind);
    if (!w.placeAtEdge(a)) continue;
    w.others.push(a);
    out.push(a);
  }
  return out;
}

/** Un animal nuevo (sin colocar). */
export function makeAnimal(w: World, kind: CreatureId): Colonist {
  const a = w.makePawn('animal');
  const def = CREATURES[kind];
  a.creature = kind;
  a.name = def.name;
  a.nickname = '';
  a.traits = [];
  a.weapon = null;
  a.weaponChoice = 'ninguna';
  a.ammo = 0;
  a.vest = null;
  a.helmet = null;
  a.skills.combate = 4;
  a.leaveAt = w.tick + ANIMALS.stayDays * TICKS_PER_DAY;
  return a;
}

/** Un paso de un animal: pasea, la rata va a por comida sin muros, y al cabo de unos días se van. */
export function updateAnimal(w: World, a: Colonist, goAway: (w: World, o: Colonist, why: string) => void): void {
  const def = a.creature ? CREATURES[a.creature] : undefined;
  if (!def) return;
  if (w.tick > (a.leaveAt ?? Infinity)) {
    goAway(w, a, '');
    return;
  }
  if (a.path.length) {
    w.moveAlongPath(a);
    return;
  }
  // La rata gigante: si está sobre comida que no está en una habitación, se lleva un poco y se va.
  if (def.stealsFood) {
    const st = w.items.at(a.tile.x, a.tile.y);
    if (st && FOOD_RESOURCES.includes(st.resource) && !w.rooms.at(a.tile.x, a.tile.y)) {
      const got = w.items.take(a.tile.x, a.tile.y, ANIMALS.ratSteals);
      if (got) w.addLog(`🐀 Una rata gigante se come ${got.amount} de ${got.resource} del almacén. Los muros la mantienen fuera.`, 'malo', undefined, a.tile);
      a.leaveAt = w.tick;
      return;
    }
    if ((w.tick + a.id) % 300 === 0) {
      const food = w.items.list().find((s) => FOOD_RESOURCES.includes(s.resource) && !w.rooms.at(s.x, s.y));
      const path = food ? findPath(w.map, a.tile, { x: food.x, y: food.y }, 8000) : null;
      if (path) {
        a.path = path;
        return;
      }
    }
  }
  // Pasea un poco de vez en cuando.
  if ((w.tick + a.id * 7) % 120 !== 0) return;
  const rng = new Rng(((w.map.seed ^ a.id * 0x45d9f3b) + Math.floor(w.tick / 120)) >>> 0);
  for (let tries = 0; tries < 6; tries++) {
    const x = a.tile.x + rng.int(-5, 5);
    const y = a.tile.y + rng.int(-5, 5);
    if (!isPassable(w.map, x, y)) continue;
    const path = findPath(w.map, a.tile, { x, y }, 400);
    if (path) {
      a.path = path;
      return;
    }
  }
}

/** Marca o desmarca un animal para cazarlo. Devuelve si queda marcado. */
export function toggleHunt(a: Colonist): boolean {
  if (a.role !== 'animal' && !(a.creature && CREATURES[a.creature].animal)) return false;
  a.huntMarked = !a.huntMarked;
  return a.huntMarked;
}

/** El jabalí herido se vuelve contra los colonos (pasa a atacar como un enemigo). */
export function enrage(w: World, a: Colonist): void {
  const def = a.creature ? CREATURES[a.creature] : undefined;
  if (a.role !== 'animal' || !def?.fightsBack || a.downed) return;
  a.role = 'saqueador';
  a.raider = { fleeing: false, leaveAt: w.tick + TICKS_PER_DAY / 2 };
  a.path = [];
  w.addLog(`${def.emoji} ¡${def.name} herido ataca!`, 'malo', 'combate', a.tile);
}

/** Lo que deja un animal al morir: carne y cuero. */
export function animalDrops(w: World, a: Colonist): void {
  const def = a.creature ? CREATURES[a.creature] : undefined;
  if (!def?.animal) return;
  const meat = def.meat ? w.rng.int(def.meat[0], def.meat[1]) : 0;
  const leather = def.leather ? w.rng.int(def.leather[0], def.leather[1]) : 0;
  w.items.dropAll(a.tile.x, a.tile.y, { carne: meat, cuero: leather });
  w.addLog(`${def.emoji} ${def.name} cazad${def.female ? 'a' : 'o'}: deja 🥩${meat} y 🟫${leather}.`, 'bueno', undefined, a.tile);
}

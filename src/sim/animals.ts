// Animales y caza (bloque 10 del catálogo): ciervos mutados, jabalíes y ratas gigantes van por el
// mapa. Marcados con 🎯 Cazar, los colonos con «Cazar» van a por ellos con su arma y dejan 🥩 carne
// y 🟫 cuero. El jabalí herido ataca; la rata gigante roba comida de los almacenes sin muros.
// Puro y determinista: sin Phaser ni DOM.
import { animalCargo, ANIMALS, CREATURES, CreatureId, TAMING, tameChance } from '../data/creatures';
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
  // De carga: no se va; pasea cerca de la colonia, de su poste o de su establo (y de noche duerme en él).
  const tie = a.tamed ? tetherOf(w, a) : undefined;
  if (a.tamed) {
    if (a.path.length) {
      w.moveAlongPath(a);
      return;
    }
    if (tie?.sleep && isNightHour(w.hour)) {
      if ((a.tile.x !== tie.sleep.x || a.tile.y !== tie.sleep.y) && (w.tick + a.id) % 30 === 0) {
        const path = findPath(w.map, a.tile, tie.sleep, 8000, w.structures.gateTiles());
        if (path) a.path = path;
      }
      return;
    }
    const home = tie ?? w.colonyPoint();
    const leash = tie?.leash ?? TAMING.leash;
    if (home && Math.abs(home.x - a.tile.x) + Math.abs(home.y - a.tile.y) > leash && (w.tick + a.id) % 60 === 0) {
      const path = findPath(w.map, a.tile, home, 8000, w.structures.gateTiles());
      if (path) a.path = tie ? path : path.slice(0, Math.max(1, path.length - 3));
      return;
    }
  } else if (w.tick > (a.leaveAt ?? Infinity)) {
    goAway(w, a, '');
    return;
  }
  if (a.path.length) {
    w.moveAlongPath(a);
    return;
  }
  // La rata gigante: si está sobre comida que no está en una habitación, se lleva un poco y se va.
  if (def.stealsFood && !a.tamed) {
    const st = w.items.at(a.tile.x, a.tile.y);
    if (st && FOOD_RESOURCES.includes(st.resource) && !w.rooms.at(a.tile.x, a.tile.y)) {
      const got = w.items.take(a.tile.x, a.tile.y, ANIMALS.ratSteals);
      if (got) w.addLog(`🐀 Una rata gigante se come ${got.amount} de ${got.resource} del almacén. Los muros la mantienen fuera.`, 'malo', undefined, a.tile);
      a.leaveAt = w.tick;
      return;
    }
    if ((w.tick + a.id) % 300 === 0) {
      const food = w.items.list().find((s) => FOOD_RESOURCES.includes(s.resource) && !w.rooms.at(s.x, s.y));
      const path = food ? findPath(w.map, a.tile, { x: food.x, y: food.y }, 8000, w.structures.gateTiles()) : null;
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
    if (tie && Math.abs(tie.x - x) + Math.abs(tie.y - y) > tie.leash) continue;
    const path = findPath(w.map, a.tile, { x, y }, 400, w.structures.gateTiles());
    if (path) {
      a.path = path;
      return;
    }
  }
}

/** Marca o desmarca un animal para cazarlo. Devuelve si queda marcado. */
export function toggleHunt(a: Colonist): boolean {
  if (a.tamed || (a.role !== 'animal' && !(a.creature && CREATURES[a.creature].animal))) return false;
  a.huntMarked = !a.huntMarked;
  if (a.huntMarked) a.tameMarked = false;
  return a.huntMarked;
}

/**
 * Al tocar un animal: sin marca → 🎯 cazar → 🤝 domar (si se puede) → sin marca. Devuelve la marca
 * que queda. Los de carga no se marcan.
 */
export function cycleAnimalMark(a: Colonist): 'cazar' | 'domar' | null {
  if (a.tamed || a.role !== 'animal') return null;
  const tamable = !!(a.creature && CREATURES[a.creature].tamable);
  if (!a.huntMarked && !a.tameMarked) {
    a.huntMarked = true;
    return 'cazar';
  }
  if (a.huntMarked && tamable) {
    a.huntMarked = false;
    a.tameMarked = true;
    return 'domar';
  }
  a.huntMarked = false;
  a.tameMarked = false;
  return null;
}

/** Saca comida de los montones de la colonia (lo que haya). true si había bastante. */
export function takeFood(w: World, n: number): boolean {
  const stacks = w.items.list().filter((s) => FOOD_RESOURCES.includes(s.resource));
  if (stacks.reduce((t, s) => t + s.amount, 0) < n) return false;
  let left = n;
  for (const s of stacks) {
    if (left <= 0) break;
    const got = w.items.take(s.x, s.y, left);
    if (got) left -= got.amount;
  }
  return true;
}

/** Un intento de domarlo (se gasta comida). true si se ha domado. */
export function tryTame(w: World, c: Colonist, a: Colonist): boolean {
  const def = a.creature ? CREATURES[a.creature] : undefined;
  if (!def?.tamable || a.tamed) return false;
  if (!takeFood(w, TAMING.foodPerTry)) {
    w.addLog(`🤝 ${c.name} no tiene comida para domar a ${def.name.toLowerCase()}.`, 'info');
    return false;
  }
  const chance = Math.min(TAMING.maxChance, tameChance(a.creature) + c.skills.supervivencia * TAMING.chancePerSkill);
  if (w.rng.chance(chance)) {
    tameAnimal(w, a);
    w.addLog(`🤝 ${c.name} doma ${def.female ? 'una' : 'un'} ${def.name.toLowerCase()}: ya es animal de carga de la colonia (+${animalCargo(a.creature)} kg en las expediciones).`, 'bueno', undefined, a.tile);
    return true;
  }
  if (def.fightsBack && w.rng.chance(TAMING.enrageOnFail)) enrage(w, a);
  return false;
}

/** Pasa a ser animal de carga de la colonia. */
export function tameAnimal(w: World, a: Colonist): void {
  a.role = 'animal';
  a.tamed = true;
  a.tameMarked = false;
  a.huntMarked = false;
  a.leaveAt = undefined;
  a.fedAt = w.tick;
  a.raider = undefined;
}

/** Animales de carga de la colonia. */
export function packAnimals(w: World): Colonist[] {
  return w.others.filter((o) => o.tamed && !o.downed);
}

/** Cada día comen; sin comida en 2 días, se escapan. */
export function feedPackAnimals(w: World): void {
  for (const a of packAnimals(w)) {
    if (w.tick - (a.fedAt ?? 0) < TICKS_PER_DAY) continue;
    const stable = tetherOf(w, a)?.stable;
    if (takeFood(w, Math.ceil(TAMING.foodPerDay * (stable ?? 1)))) {
      a.fedAt = w.tick;
      // Bien comido, da lo suyo cada día (la vaca leche, la gallina huevos).
      const made = a.creature ? CREATURES[a.creature].tame?.produces : undefined;
      if (made) w.items.drop(a.tile.x, a.tile.y, made.resource, made.amount);
      continue;
    }
    if (w.tick - (a.fedAt ?? 0) > TAMING.hungryDays * TICKS_PER_DAY) {
      a.tamed = false;
      a.leaveAt = w.tick;
      const def = a.creature ? CREATURES[a.creature] : undefined;
      w.addLog(`🫏 Sin comida, ${def ? `${def.female ? 'la' : 'el'} ${def.name.toLowerCase()}` : 'un animal'} de carga se escapa.`, 'malo', undefined, a.tile);
    }
  }
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
  w.items.dropAll(a.tile.x, a.tile.y, leather ? { carne: meat, cuero: leather } : { carne: meat });
  w.addLog(`${def.emoji} ${def.name} cazad${def.female ? 'a' : 'o'}: deja 🥩${meat}${leather ? ` y 🟫${leather}` : ''}.`, 'bueno', undefined, a.tile);
}

/** De noche (de 20:00 a 6:00) los animales con establo duermen en él. */
export function isNightHour(hour: number): boolean {
  return hour >= 20 || hour < 6;
}

/** Adónde está atado un animal de carga: un sitio, cuánto se puede alejar y, con establo, dónde duerme. */
export interface Tether {
  x: number;
  y: number;
  leash: number;
  /** Casilla del establo donde duerme. */
  sleep?: { x: number; y: number };
  /** Parte de la comida de cada día que gasta (con establo, menos). */
  stable?: number;
}

const tetherCache = new WeakMap<World, { key: string; map: Map<number, Tether> }>();

/**
 * Reparto de los animales de carga (de menor a mayor id): primero en los establos (4 cada uno),
 * luego en los postes con cuerda (2 cada uno). Los que no caben pasean cerca de la colonia.
 */
export function tethers(w: World): Map<number, Tether> {
  const animals = packAnimals(w).sort((p, q) => p.id - q.id);
  const key = `${w.structures.version}|${animals.map((p) => p.id).join(',')}`;
  const cached = tetherCache.get(w);
  if (cached?.key === key) return cached.map;
  const map = new Map<number, Tether>();
  const built = w.structures.all().filter((s) => s.built).sort((p, q) => p.id - q.id);
  const slots: Tether[] = [];
  for (const s of built) {
    if (!s.def.stable) continue;
    const tiles = w.structures.tilesOf(s);
    for (let k = 0; k < s.def.stable.animals; k++) {
      const t = tiles[k % tiles.length];
      slots.push({ x: t.x, y: t.y, leash: TAMING.leash, sleep: { x: t.x, y: t.y }, stable: s.def.stable.foodMult });
    }
  }
  for (const s of built) {
    if (!s.def.tiePost) continue;
    for (let k = 0; k < s.def.tiePost.animals; k++) slots.push({ x: s.x, y: s.y, leash: s.def.tiePost.leash });
  }
  animals.forEach((p, k) => {
    if (slots[k]) map.set(p.id, slots[k]);
  });
  tetherCache.set(w, { key, map });
  return map;
}

export function tetherOf(w: World, a: Colonist): Tether | undefined {
  return a.tamed ? tethers(w).get(a.id) : undefined;
}

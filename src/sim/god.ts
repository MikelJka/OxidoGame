// Modo Dios: atajos para probar la partida (aparecer cosas, terminar obras, curar, saltar el
// tiempo). No son reglas del juego: solo se usan desde el panel 🪄 del modo Dios.
import type { ResourceId } from '../data/resources';
import type { Colonist, PawnRole } from './colonist';
import { hurt } from './health';
import { inBounds, Prop } from './map';
import { makePrisoner, startTrader } from './people';
import { TICKS_PER_DAY } from './time';
import type { World } from './world';

/** Deja recursos en una casilla (si no caben, alrededor). */
export function godDrop(w: World, x: number, y: number, r: ResourceId, amount: number): void {
  if (!inBounds(w.map, x, y)) return;
  w.items.drop(x, y, r, amount);
}

/** Hace aparecer a una persona en una casilla. */
export function godSpawn(w: World, role: PawnRole, x: number, y: number): Colonist | null {
  if (!inBounds(w.map, x, y)) return null;
  const place = (c: Colonist) => {
    c.tile = { x, y };
    c.pos = { x: x + 0.5, y: y + 0.5 };
    c.path = [];
  };
  if (role === 'comerciante') {
    const t = startTrader(w);
    if (t) place(t);
    return t;
  }
  const c = w.makePawn(role);
  place(c);
  if (role === 'colono') {
    w.colonists.push(c);
    w.addLog(`🪄 Aparece ${c.name} «${c.nickname}» (modo Dios).`, 'info');
    return c;
  }
  if (role === 'saqueador') c.raider = { fleeing: false, leaveAt: w.tick + TICKS_PER_DAY };
  if (role === 'prisionero') makePrisoner(c, 0.6);
  w.others.push(c);
  w.addLog(`🪄 Aparece ${c.name} (${role}, modo Dios).`, 'info');
  return c;
}

/** Termina al momento todos los planos, demoliciones y obras de terreno. */
export function godFinishWork(w: World): number {
  let n = 0;
  for (const s of w.structures.all()) {
    if (s.built && s.demolish) {
      w.demolishStructure(s);
      n++;
    }
  }
  for (const s of w.structures.blueprints()) {
    w.completeStructure(s);
    n++;
  }
  for (const s of w.structures.upgrades()) {
    w.structures.finishElectrify(s);
    n++;
  }
  for (const o of w.terrain.list()) {
    w.finishTerrainWork(o.x, o.y, o.job);
    n++;
  }
  for (const c of w.colonists) if (c.job) w.dropJob(c);
  return n;
}

/** Cura a todos y les llena la comida, el agua y el descanso. */
export function godHealAll(w: World): void {
  for (const c of w.pawns()) {
    c.health = 1;
    delete c.infection;
    c.wounds = [];
    c.downed = false;
    c.needs.food = 1;
    c.needs.water = 1;
    c.needs.rest = 1;
  }
}

/** Todos los cultivos, listos para cosechar. */
export function godGrowAll(w: World): void {
  for (const { plant } of w.farms.plantList()) plant.growth = 1;
  w.farms.version++;
}

/** Persona más cercana a una casilla (a 1 casilla como mucho). */
export function pawnNear(w: World, x: number, y: number): Colonist | undefined {
  let best: Colonist | undefined;
  let bestD = 1.6;
  for (const c of w.pawns()) {
    const d = Math.hypot(c.pos.x - (x + 0.5), c.pos.y - (y + 0.5));
    if (d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return best;
}

export function godKill(w: World, c: Colonist): void {
  w.killPawn(c, 'modo Dios');
}

/** Herida grave: cae al suelo. */
export function godWound(c: Colonist): void {
  hurt(c, Math.max(0.3, c.health - 0.1), 'el pecho');
}

/** Quita el árbol, la roca o los restos de una casilla. */
export function godClear(w: World, x: number, y: number): boolean {
  if (!inBounds(w.map, x, y)) return false;
  if (w.map.props[y * w.map.width + x] === Prop.None) return false;
  w.setProp(x, y, Prop.None);
  return true;
}

/** Avanza el tiempo de golpe (`ticks` pasos de simulación). */
export function godSkip(w: World, ticks: number): void {
  for (let i = 0; i < ticks && !w.gameOver; i++) w.step();
}

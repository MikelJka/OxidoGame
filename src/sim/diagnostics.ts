import { MAX_STACK } from '../data/resources';
import { inBounds } from './map';
import { canDesignate } from './designations';
import { isWalkable } from './pathfinding';
import type { World } from './world';

/** Un problema de estado detectado durante la partida (posible bug). */
export interface Problem {
  /** Clave estable para no repetir el mismo aviso una y otra vez. */
  key: string;
  message: string;
}

/** Ticks seguidos con una orden activa sin avanzar ni una casilla antes de avisar. */
export const STUCK_TICKS = 30 * 20;

/**
 * Comprueba invariantes de la simulación. No modifica el mundo.
 * `progress` guarda entre llamadas cuánto lleva cada colono sin avanzar.
 */
export function checkWorld(world: World, progress = new Map<number, ProgressMark>()): Problem[] {
  const problems: Problem[] = [];
  const { map } = world;

  if (!Number.isFinite(world.tick) || world.tick < 0) {
    problems.push({ key: 'tick', message: `Reloj de simulación inválido (tick ${world.tick})` });
  }

  for (const c of world.colonists) {
    const who = `${c.name} (#${c.id})`;
    const { x, y } = c.pos;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      problems.push({ key: `pos-nan-${c.id}`, message: `${who} tiene una posición no numérica (${x}, ${y})` });
      continue;
    }
    if (!inBounds(map, Math.floor(x), Math.floor(y))) {
      problems.push({ key: `pos-out-${c.id}`, message: `${who} está fuera del mapa en (${x.toFixed(2)}, ${y.toFixed(2)})` });
      continue;
    }
    if (Math.abs(x - (c.tile.x + 0.5)) > 1.01 || Math.abs(y - (c.tile.y + 0.5)) > 1.01) {
      problems.push({
        key: `tile-mismatch-${c.id}`,
        message: `${who}: su casilla (${c.tile.x}, ${c.tile.y}) no coincide con su posición (${x.toFixed(2)}, ${y.toFixed(2)})`,
      });
    }
    if (!isWalkable(map, c.tile.x, c.tile.y)) {
      problems.push({ key: `blocked-${c.id}`, message: `${who} está sobre una casilla no transitable (${c.tile.x}, ${c.tile.y})` });
    }

    let prev = c.tile;
    for (const step of c.path) {
      if (Math.max(Math.abs(step.x - prev.x), Math.abs(step.y - prev.y)) !== 1) {
        problems.push({ key: `path-gap-${c.id}`, message: `${who} tiene un camino con saltos entre (${prev.x}, ${prev.y}) y (${step.x}, ${step.y})` });
        break;
      }
      if (!isWalkable(map, step.x, step.y)) {
        problems.push({ key: `path-blocked-${c.id}`, message: `${who} tiene un camino que pasa por (${step.x}, ${step.y}), que no es transitable` });
        break;
      }
      prev = step;
    }

    // Atasco: tiene camino pendiente pero no cambia de casilla en mucho tiempo.
    const mark = progress.get(c.id);
    const tileKey = c.tile.x * 100_000 + c.tile.y;
    if (c.path.length === 0 || !mark || mark.tileKey !== tileKey) {
      progress.set(c.id, { tileKey, since: world.tick });
    } else if (world.tick - mark.since >= STUCK_TICKS) {
      problems.push({ key: `stuck-${c.id}`, message: `${who} lleva ${world.tick - mark.since} ticks atascado en (${c.tile.x}, ${c.tile.y}) con un camino pendiente` });
    }
  }

  // Montones en el suelo: siempre en casillas que los admiten y sin pasarse del máximo.
  for (const s of world.items.list()) {
    if (!world.items.canHold(s.x, s.y)) {
      problems.push({ key: `item-bad-tile-${s.x}-${s.y}`, message: `Hay un montón de ${s.resource} en (${s.x}, ${s.y}), una casilla que no lo admite` });
    }
    if (s.amount <= 0 || s.amount > MAX_STACK[s.resource]) {
      problems.push({ key: `item-amount-${s.x}-${s.y}`, message: `El montón de ${s.resource} en (${s.x}, ${s.y}) tiene ${s.amount} unidades` });
    }
  }
  // Trabajos y reservas: cada trabajo en curso tiene su reserva y cada reserva, su colono.
  for (const c of world.colonists) {
    if (c.job && world.reservations.holder(c.job.x, c.job.y) !== c.id) {
      problems.push({ key: `job-unreserved-${c.id}`, message: `${c.name} (#${c.id}) trabaja en (${c.job.x}, ${c.job.y}) sin tenerlo reservado` });
    }
  }
  for (const r of world.reservations.list()) {
    const c = world.colonists.find((k) => k.id === r.colonistId);
    if (!c || !c.job || c.job.x !== r.x || c.job.y !== r.y) {
      problems.push({ key: `reservation-orphan-${r.x}-${r.y}`, message: `La casilla (${r.x}, ${r.y}) está reservada por #${r.colonistId}, que no la está trabajando` });
    }
  }

  // Designaciones: solo sobre objetos que se aprovechan con ese trabajo.
  for (const d of world.designations.list()) {
    if (!canDesignate(map, d.x, d.y, d.job)) {
      problems.push({ key: `designation-${d.x}-${d.y}`, message: `La casilla (${d.x}, ${d.y}) está designada para ${d.job} pero no tiene nada que aprovechar así` });
    }
  }
  return problems;
}

export interface ProgressMark {
  tileKey: number;
  since: number;
}

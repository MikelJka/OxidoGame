import {
  FIRST_NAMES, HAIR_COLORS, NICKNAMES, SHIRT_COLORS, SKILLS, SKIN_COLORS, Skill, TRAITS, TRAIT_CONFLICTS, TraitDef,
} from '../data/colonists';
import { HARVEST_JOB_NAMES, HARVEST_JOB_VERBS, HarvestJob } from '../data/resources';
import { Point } from './pathfinding';
import { Rng } from './rng';

export type ColonistActivity = 'idle' | 'wandering' | 'moving' | 'toJob' | 'working';

/** Prioridad de un trabajo para un colono: 0 = no lo hace, 1 = el primero … 4 = el último. */
export type WorkPriority = 0 | 1 | 2 | 3 | 4;
export const DEFAULT_PRIORITY: WorkPriority = 3;

/** Trabajo que tiene asignado un colono. */
export interface ColonistJob {
  kind: HarvestJob;
  /** Casilla del objeto que se aprovecha. */
  x: number;
  y: number;
  /** Casilla desde la que trabaja (la misma o una de al lado si el objeto bloquea el paso). */
  stand: Point;
  /** Ticks de trabajo acumulados (ya multiplicados por la velocidad del colono). */
  progress: number;
  /** Trabajo total que hace falta. */
  work: number;
}

export interface Colonist {
  id: number;
  name: string;
  nickname: string;
  age: number;
  skills: Record<Skill, number>;
  /** Pasión por habilidad: 0 ninguna, 1 interés, 2 pasión. */
  passions: Record<Skill, 0 | 1 | 2>;
  traits: TraitDef[];
  look: { shirt: number; skin: number; hair: number };
  /** Posición continua en casillas (el centro de una casilla es x + 0.5). */
  pos: { x: number; y: number };
  /** Casilla actual. */
  tile: Point;
  path: Point[];
  activity: ColonistActivity;
  /** Ticks que quedan esperando antes de decidir otra cosa. */
  waitTicks: number;
  /** Dirección a la que mira, para el sprite. */
  facing: 1 | -1;
  /** Prioridad de cada trabajo. */
  priorities: Record<HarvestJob, WorkPriority>;
  /** Trabajo en curso, si tiene. */
  job: ColonistJob | null;
}

export function createColonist(id: number, at: Point, rng: Rng): Colonist {
  const skills = {} as Record<Skill, number>;
  const passions = {} as Record<Skill, 0 | 1 | 2>;
  for (const s of SKILLS) {
    // Distribución sesgada hacia valores bajos, con alguna especialidad.
    const base = Math.floor(rng.next() * rng.next() * 12);
    skills[s] = Math.min(20, base + (rng.chance(0.15) ? rng.int(4, 8) : 0));
    passions[s] = skills[s] >= 8 && rng.chance(0.5) ? 2 : rng.chance(0.2) ? 1 : 0;
  }
  return {
    id,
    name: pick(FIRST_NAMES, rng),
    nickname: pick(NICKNAMES, rng),
    age: rng.int(17, 62),
    skills,
    passions,
    traits: pickTraits(rng),
    look: { shirt: pick(SHIRT_COLORS, rng), skin: pick(SKIN_COLORS, rng), hair: pick(HAIR_COLORS, rng) },
    pos: { x: at.x + 0.5, y: at.y + 0.5 },
    tile: { x: at.x, y: at.y },
    path: [],
    activity: 'idle',
    waitTicks: rng.int(10, 60),
    facing: 1,
    priorities: { talar: DEFAULT_PRIORITY, minar: DEFAULT_PRIORITY, saquear: DEFAULT_PRIORITY },
    job: null,
  };
}

export function walkSpeedMultiplier(c: Colonist): number {
  return c.traits.reduce((m, t) => m * (t.walkSpeed ?? 1), 1);
}

export function activityLabel(c: Colonist): string {
  switch (c.activity) {
    case 'moving': return 'Yendo a una orden';
    case 'toJob': return c.job ? `Yendo a ${HARVEST_JOB_NAMES[c.job.kind].toLowerCase()}` : 'Yendo a trabajar';
    case 'working': return c.job ? `${HARVEST_JOB_VERBS[c.job.kind]} (${Math.floor((c.job.progress / c.job.work) * 100)} %)` : 'Trabajando';
    case 'wandering': return 'Deambulando';
    default: return 'Descansando';
  }
}

function pick<T>(list: readonly T[], rng: Rng): T {
  return list[Math.floor(rng.next() * list.length)];
}

function pickTraits(rng: Rng): TraitDef[] {
  const count = rng.int(1, 2);
  const chosen: TraitDef[] = [];
  for (let tries = 0; chosen.length < count && tries < 50; tries++) {
    const t = pick(TRAITS, rng);
    if (chosen.includes(t)) continue;
    const conflict = chosen.some((c) =>
      TRAIT_CONFLICTS.some(([a, b]) => (a === c.id && b === t.id) || (b === c.id && a === t.id)),
    );
    if (!conflict) chosen.push(t);
  }
  return chosen;
}

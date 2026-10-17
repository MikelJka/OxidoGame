import type { WeaponId } from '../data/weapons';
import { ArmorId, armorWalk } from '../data/armor';
import {
  FIRST_NAMES, HAIR_COLORS, NICKNAMES, SHIRT_COLORS, SKILLS, SKIN_COLORS, Skill, TRAITS, TRAIT_CONFLICTS, TraitDef,
} from '../data/colonists';
import { ResourceId } from '../data/resources';
import { WORK_NAMES, WORK_TYPES, WORK_VERBS, WorkType } from '../data/work';
import { Point } from './pathfinding';
import type { TerrainJob } from './terrain';
import { defaultNeeds, Needs } from './needs';
import type { Wound } from './health';
import { Rng } from './rng';

export type ColonistActivity = 'idle' | 'wandering' | 'moving' | 'toJob' | 'working' | 'toNeed' | 'eating' | 'sleeping';

/** Lo que hace por sí mismo para cubrir una necesidad: comer (en un montón de comida) o dormir. */
export interface NeedTask {
  type: 'comer' | 'dormir' | 'beber';
  /** Casilla del montón de comida, de la cama (o donde duerme en el suelo) o desde donde bebe. */
  x: number;
  y: number;
  /** Duerme en una cama. */
  bed: boolean;
  /** Ticks que lleva comiendo o bebiendo. */
  progress: number;
  /** Bebe agua contaminada. */
  dirty?: boolean;
}

/** Prioridad de un trabajo para un colono: 0 = no lo hace, 1 = el primero … 4 = el último. */
export type WorkPriority = 0 | 1 | 2 | 3 | 4;
export const DEFAULT_PRIORITY: WorkPriority = 3;

/** Trabajo que tiene asignado un colono. */
export interface ColonistJob {
  kind: WorkType;
  /** Casilla principal: el objeto que se aprovecha, el montón que se recoge o el plano que se construye. */
  x: number;
  y: number;
  /** Casilla desde la que trabaja (la misma o una de al lado si el objeto bloquea el paso). */
  stand: Point;
  /** Ticks de trabajo acumulados (ya multiplicados por la velocidad del colono). */
  progress: number;
  /** Trabajo total que hace falta. */
  work: number;
  /** Transporte: qué se lleva, cuánto y adónde. */
  haul?: HaulInfo;
  /** Cultivo: sembrar una casilla vacía o cosechar una planta madura. */
  farm?: 'sembrar' | 'cosechar';
  /** Obra de terreno que se hace. */
  terrain?: TerrainJob;
  /** Demoler la construcción de la casilla. */
  demolish?: boolean;
  /** Construcción a la que va el trabajo (construir, demoler, fabricar). */
  sid?: number;
  /** Persona a la que va el trabajo (curar, capturar, alimentar, convencer). */
  pid?: number;
  /** Qué hace el carcelero. */
  warden?: 'capturar' | 'alimentar' | 'convencer';
  /** Capturar: ya lo lleva a cuestas hacia una cama de prisionero. */
  escorting?: boolean;
}

export interface HaulInfo {
  resource: ResourceId;
  /** Unidades que se quieren llevar. */
  amount: number;
  /** Casilla del montón que se recoge. */
  from: Point;
  /** Casilla de destino (un almacén o un plano). */
  to: Point;
  /** Lleva los materiales a un plano en vez de a un almacén. */
  toBlueprint: boolean;
  /** Ya ha recogido la carga. */
  picked: boolean;
}

/** Lo que lleva encima un colono. */
export interface Carried {
  resource: ResourceId;
  amount: number;
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
  priorities: Record<WorkType, WorkPriority>;
  /** Trabajo en curso, si tiene. */
  job: ColonistJob | null;
  /** Carga que lleva encima. */
  carrying: Carried | null;
  /** Reclutado: no trabaja ni deambula; solo obedece órdenes directas. */
  drafted: boolean;
  /** Comida, descanso y dónde durmió. */
  needs: Needs;
  /** Comiendo o durmiendo (o yendo a ello). */
  need: NeedTask | null;
  /** Salud de 0 (muerto) a 1. */
  health: number;
  /** Heridas abiertas. */
  wounds: Wound[];
  /** En el suelo, sin poder moverse (salud muy baja). */
  downed: boolean;
  /** Quién es: de la colonia, saqueador, prisionero o comerciante. */
  role: PawnRole;
  /** Prisionero: resistencia a unirse y qué hacer con él. */
  prisoner?: PrisonerInfo;
  /** Saqueador: si huye. */
  raider?: { fleeing: boolean; leaveAt: number };
  /** Comerciante: lo que vende, a quién vende y cuándo se va. */
  trader?: TraderInfo;
  /** Ticks hasta poder volver a golpear. */
  attackCooldown?: number;
  /** Lo lleva a cuestas un colono (id): se mueve con él. */
  carriedBy?: number;
  /** Arma que lleva (null = puños). */
  weapon: WeaponId | null;
  /** Qué arma quiere: la mejor libre («auto»), ninguna, o una concreta (se elige en la ficha). */
  weaponChoice: WeaponChoice;
  /** Munición que lleva encima (flechas). */
  ammo: number;
  /** Chaleco y casco puestos. */
  vest: ArmorId | null;
  helmet: ArmorId | null;
  /** Armadura: la mejor libre («auto») o ninguna. */
  armorChoice: 'auto' | 'ninguna';
  /** Va a recoger un arma, munición o armadura del suelo o del almacén. */
  gearTask?: { x: number; y: number; resource: ResourceId };
}

export type WeaponChoice = 'auto' | 'ninguna' | WeaponId;

export interface TraderInfo {
  stock: Partial<Record<ResourceId, number>>;
  /** Personas en venta (esclavos). */
  slaves: Colonist[];
  /** Tick en que se marcha. */
  leaveAt: number;
  leaving: boolean;
}

export type PawnRole = 'colono' | 'saqueador' | 'prisionero' | 'comerciante';

export interface PrisonerInfo {
  /** 0–1: cuánto le falta para dejarse convencer. */
  resistance: number;
  /** Qué hacer con él: tenerlo retenido, intentar convencerlo o soltarlo. */
  mode: 'retener' | 'convencer' | 'liberar';
  /** Tick de la última charla (los carceleros no le hablan más de una vez cada pocas horas). */
  lastTalk: number;
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
    priorities: Object.fromEntries(WORK_TYPES.map((w) => [w, DEFAULT_PRIORITY])) as Record<WorkType, WorkPriority>,
    job: null,
    carrying: null,
    drafted: false,
    needs: defaultNeeds(),
    need: null,
    health: 1,
    wounds: [],
    downed: false,
    role: 'colono',
    weapon: null,
    weaponChoice: 'auto',
    ammo: 0,
    vest: null,
    helmet: null,
    armorChoice: 'auto',
  };
}

export function walkSpeedMultiplier(c: Colonist): number {
  return c.traits.reduce((m, t) => m * (t.walkSpeed ?? 1), 1) * armorWalk([c.vest, c.helmet]);
}

export function activityLabel(c: Colonist): string {
  if (c.downed) return 'En el suelo, malherido';
  if (c.need) {
    if (c.activity === 'eating') return c.need.type === 'beber' ? 'Bebiendo' : 'Comiendo';
    if (c.activity === 'sleeping') return c.need.bed ? 'Durmiendo en la cama' : 'Durmiendo en el suelo';
    return c.need.type === 'comer' ? 'Yendo a comer' : c.need.type === 'beber' ? 'Yendo a beber' : 'Yendo a dormir';
  }
  if (c.drafted && !c.job) return c.path.length > 0 ? 'Reclutado · yendo' : 'Reclutado · esperando órdenes';
  switch (c.activity) {
    case 'moving': return 'Yendo a una orden';
    case 'toJob':
      if (!c.job) return 'Yendo a trabajar';
      if (c.job.escorting) return 'Llevando al prisionero a su cama';
      if (c.job.haul) return c.job.haul.picked ? (c.job.haul.toBlueprint ? 'Llevando material a un plano' : 'Llevando al almacén') : 'Yendo a recoger';
      return `Yendo a ${WORK_NAMES[c.job.kind].toLowerCase()}`;
    case 'working': {
      if (!c.job) return 'Trabajando';
      const WARDEN = { capturar: 'Capturando', alimentar: 'Dando de comer al prisionero', convencer: 'Hablando con el prisionero' } as const;
      const verb = c.job.farm === 'sembrar' ? 'Sembrando' : c.job.farm === 'cosechar' ? 'Cosechando' : c.job.warden ? WARDEN[c.job.warden] : WORK_VERBS[c.job.kind];
      return `${verb} (${Math.floor((c.job.progress / c.job.work) * 100)} %)`;
    }
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

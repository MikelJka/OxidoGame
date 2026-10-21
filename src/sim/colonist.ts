import type { WeaponId } from '../data/weapons';
import { ArmorId, armorWalk } from '../data/armor';
import { CREATURE_IDS, CREATURES, CreatureId } from '../data/creatures';
import {
  FIRST_NAMES, HAIR_COLORS, NICKNAMES, SHIRT_COLORS, SKILLS, SKIN_COLORS, Skill, TRAITS, TRAIT_CONFLICTS, TraitDef,
} from '../data/colonists';
import { ResourceId } from '../data/resources';
import { WORK_NAMES, WORK_TYPES, WORK_VERBS, WorkType } from '../data/work';
import { Point } from './pathfinding';
import type { TerrainJob } from './terrain';
import { defaultNeeds, Needs } from './needs';
import type { Infection, Wound } from './health';
import type { Corpse } from './corpses';
import { Rng } from './rng';

export type ColonistActivity = 'idle' | 'wandering' | 'moving' | 'toJob' | 'working' | 'toNeed' | 'eating' | 'sleeping';

/** Lo que hace por sí mismo para cubrir una necesidad: comer (en un montón de comida), dormir o reposar herido. */
export interface NeedTask {
  type: 'comer' | 'dormir' | 'beber' | 'reposar';
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
  farm?: 'sembrar' | 'cosechar' | 'arrancar';
  /** Obra de terreno que se hace. */
  terrain?: TerrainJob;
  /** Demoler la construcción de la casilla. */
  demolish?: boolean;
  /** Electrificar el taller (mejora). */
  upgrade?: boolean;
  /** Arreglar una máquina averiada. */
  repair?: boolean;
  /** Apagar el fuego de la casilla (x, y). */
  fire?: boolean;
  /** Poner el tejado en la casilla (x, y). */
  roof?: boolean;
  /** Domar al animal `pid` (no cazarlo). */
  tame?: boolean;
  /** Mover un mueble: primero se desmonta; luego se lleva y se monta en el destino. */
  move?: 'desmontar' | 'montar';
  /** Construcción a la que va el trabajo (construir, demoler, fabricar). */
  sid?: number;
  /** Persona a la que va el trabajo (curar, capturar, alimentar, convencer). */
  pid?: number;
  /** Qué hace el carcelero. */
  warden?: 'capturar' | 'alimentar' | 'convencer' | 'rematar';
  /** Capturar: ya lo lleva a cuestas hacia una cama de prisionero. */
  escorting?: boolean;
  /** Llevar un cadáver a la hoguera (`sid`): cuál y, una vez recogido, el cadáver que lleva a cuestas. */
  corpse?: { id: number; body?: Corpse };
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
  /** Otros planos cercanos (en orden) a los que lleva el resto de la carga (#20). */
  extra?: { sid: number; x: number; y: number }[];
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
  /** Infección de una herida, si tiene (se trata con 💊). */
  infection?: Infection;
  /** En el suelo, sin poder moverse (salud muy baja). */
  downed: boolean;
  /** Malherido tras un combate: guarda cama hasta recuperarse (se levanta a comer y beber). */
  resting?: boolean;
  /** Quién es: de la colonia, saqueador, prisionero o comerciante. */
  role: PawnRole;
  /** Prisionero: resistencia a unirse y qué hacer con él. */
  prisoner?: PrisonerInfo;
  /** Saqueador: si huye, cuándo se va y de qué raid es (y si es su líder ★). */
  raider?: RaiderInfo;
  /** Criatura (perro mutante…): hostil como un saqueador, pero no se la captura y al caer muere. */
  creature?: CreatureId;
  /** Comerciante: lo que vende, a quién vende y cuándo se va. */
  trader?: TraderInfo;
  /** Facción a la que pertenece (id de `factions.json`): saqueadores y caravanas. */
  faction?: string;
  /** Refugiado acogido (suceso): facción de la que viene; al curarse decide si se queda. */
  refugee?: string;
  /** Ticks hasta poder volver a golpear. */
  attackCooldown?: number;
  /** Lo lleva a cuestas un colono (id): se mueve con él. */
  carriedBy?: number;
  /** Arma que lleva (null = puños). */
  weapon: WeaponId | null;
  /** Qué arma quiere: la mejor libre («auto»), ninguna, o una concreta (se elige en la ficha). */
  weaponChoice: WeaponChoice;
  /** Munición que lleva encima (la de su arma: flechas o balas). */
  ammo: number;
  /** Granadas caseras que lleva encima, aparte de su arma (como mucho 2). */
  grenades?: number;
  /** Tick desde el que puede volver a lanzar una granada. */
  grenadeReadyAt?: number;
  /** Chaleco y casco puestos. */
  vest: ArmorId | null;
  helmet: ArmorId | null;
  /** Lleva abrigo (bloque 11): de noche en invierno no pasa frío. */
  coat?: boolean;
  /** Animal marcado para cazarlo (⚒ → 🎯 Cazar). */
  huntMarked?: boolean;
  /** Animal marcado para domarlo, y si ya es de la colonia (de carga). */
  tameMarked?: boolean;
  tamed?: boolean;
  /** Animal de carga: tick de la última vez que comió. */
  fedAt?: number;
  /** Animal: tick en que se va del mapa (o la rata que ya ha robado). */
  leaveAt?: number;
  /** Armadura: la mejor libre («auto») o ninguna. */
  armorChoice: 'auto' | 'ninguna';
  /** Va a recoger un arma, munición o armadura del suelo o del almacén. */
  gearTask?: { x: number; y: number; resource: ResourceId };
  /** En pánico hasta ese tick: corre a refugiarse y no obedece ni trabaja. */
  panic?: { until: number };
  /** Aturdido hasta ese tick (trampa eléctrica): no se mueve ni ataca. */
  stunnedUntil?: number;
  /** Sitio en un vehículo: conductor o tirador (`boarded`: ya va dentro; si no, va hacia él). */
  vehicle?: { id: number; seat: 'conductor' | 'tirador'; boarded: boolean };
  /** Postura de combate del reclutado (sin ella, va a por los enemigos cercanos). */
  stance?: Stance;
  /** Con la postura «atacar»: id del saqueador al que va. */
  attackTarget?: number;
}

/**
 * Posturas del reclutado (aprobadas por Mikel el 2026-10-17): «mantener» no se mueve solo y
 * dispara a lo que tenga a tiro; «atacar» va solo a por un enemigo; «retirarse» vuelve a la cama
 * o habitación más cercana sin pelear.
 */
export type Stance = 'mantener' | 'atacar' | 'retirarse';
export const STANCES: readonly Stance[] = ['mantener', 'atacar', 'retirarse'];

export interface RaiderInfo {
  fleeing: boolean;
  leaveAt: number;
  /** Id del grupo del raid (el de `World.raidGroups`); sin él, va por libre. */
  group?: number;
  /** Líder del raid (el de más Combate), marcado con ★. */
  leader?: boolean;
  /** En el suelo: el jugador ha mandado rematarlo en vez de capturarlo (#22). */
  finish?: boolean;
  /** Llegó en esta balsa (id del vehículo): al huir vuelve a ella si la tiene cerca. */
  raft?: number;
  /** No encontró camino hasta su objetivo: no lo vuelve a buscar antes de este tic (no se guarda). */
  noPathUntil?: number;
}

/** Un raid en marcha: cuántos llegaron, quién lo dirige y quién se ha escapado ya. */
export interface RaidGroup {
  id: number;
  size: number;
  leaderId: number;
  /** Ids de los que se han ido del mapa (huidos: no cuentan como caídos). */
  escaped: number[];
  /** Ya ha cundido el pánico y huyen todos. */
  routed: boolean;
}

export type WeaponChoice = 'auto' | 'ninguna' | WeaponId;

export interface TraderInfo {
  stock: Partial<Record<ResourceId, number>>;
  /** Personas en venta (esclavos). */
  slaves: Colonist[];
  /** Tick en que se marcha. */
  leaveAt: number;
  leaving: boolean;
  /** Mulas de carga que vende (caravanas de los Granjeros y los Nómadas). */
  mules?: number;
  /** Ya se ha hecho algún trato con esta caravana (sube la relación una vez). */
  traded?: boolean;
  /** Lo que necesita (lo paga a +50 %) y lo que le sobra (a −30 %), según su facción. */
  needs?: ResourceId[];
  surplus?: ResourceId[];
}

/** «aliado»: combatiente que manda una facción aliada para ayudar en un ataque. */
export type PawnRole = 'colono' | 'saqueador' | 'prisionero' | 'comerciante' | 'aliado' | 'animal';

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
  const beast = c.creature ? CREATURES[c.creature].walkSpeed : 1;
  return c.traits.reduce((m, t) => m * (t.walkSpeed ?? 1), 1) * armorWalk([c.vest, c.helmet]) * beast;
}

export function activityLabel(c: Colonist): string {
  if (c.vehicle && !c.downed) {
    const seat = c.vehicle.seat === 'conductor' ? 'conductor' : 'tirador';
    return c.vehicle.boarded ? `🚙 En el vehículo, de ${seat}` : `🚙 Yendo al vehículo (${seat})`;
  }
  if (c.downed) return c.carriedBy !== undefined ? 'Malherido, le llevan a una cama' : c.activity === 'sleeping' ? 'Malherido, recuperándose en la cama' : 'En el suelo, malherido';
  if (c.panic) return c.path.length > 0 ? '😱 En pánico, huyendo a refugiarse' : '😱 En pánico, escondido';
  if (c.need) {
    if (c.activity === 'eating') return c.need.type === 'beber' ? 'Bebiendo' : 'Comiendo';
    if (c.need.type === 'reposar') {
      if (c.activity === 'sleeping') return c.need.bed ? 'Herido, reposando en la cama' : 'Herido, reposando en el suelo';
      return 'Herido, yendo a la cama a reposar';
    }
    if (c.activity === 'sleeping') return c.need.bed ? 'Durmiendo en la cama' : 'Durmiendo en el suelo';
    return c.need.type === 'comer' ? 'Yendo a comer' : c.need.type === 'beber' ? 'Yendo a beber' : 'Yendo a dormir';
  }
  if (c.drafted && !c.job) {
    if (c.stance === 'mantener') return c.path.length > 0 ? 'Reclutado · yendo a su puesto' : 'Reclutado · manteniendo la posición';
    if (c.stance === 'atacar') return 'Reclutado · atacando a un enemigo';
    if (c.stance === 'retirarse') return c.path.length > 0 ? 'Reclutado · retirándose' : 'Reclutado · retirado, sin pelear';
    return c.path.length > 0 ? 'Reclutado · yendo' : 'Reclutado · esperando órdenes';
  }
  switch (c.activity) {
    case 'moving': return 'Yendo a una orden';
    case 'toJob':
      if (!c.job) return 'Yendo a trabajar';
      if (c.job.corpse) return c.job.corpse.body ? 'Llevando un cadáver a la hoguera' : 'Yendo a por un cadáver';
      if (c.job.escorting) return c.job.kind === 'curar' ? 'Llevando al herido a una cama' : 'Llevando al prisionero a su cama';
      if (c.job.haul) return c.job.haul.picked ? (c.job.haul.toBlueprint ? 'Llevando material a un plano' : 'Llevando al almacén') : 'Yendo a recoger';
      return `Yendo a ${WORK_NAMES[c.job.kind].toLowerCase()}`;
    case 'working': {
      if (!c.job) return 'Trabajando';
      const WARDEN = { capturar: 'Capturando', rematar: 'Rematando al saqueador', alimentar: 'Dando de comer al prisionero', convencer: 'Hablando con el prisionero' } as const;
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

const ROLE_PLURAL: Record<PawnRole, [string, string]> = {
  colono: ['colono', 'colonos'],
  saqueador: ['saqueador', 'saqueadores'],
  prisionero: ['prisionero', 'prisioneros'],
  comerciante: ['comerciante', 'comerciantes'],
  aliado: ['aliado', 'aliados'],
  animal: ['animal', 'animales'],
};

/**
 * Resumen de un grupo de personas (lo que se ve al elegir varias de golpe): cuántas hay de cada
 * tipo, cuántas están caídas o heridas, la salud media y, de los saqueadores, si va el líder.
 */
export function groupSummary(pawns: readonly Colonist[]): string {
  if (pawns.length === 0) return 'Nadie';
  const parts: string[] = [];
  // Primero las personas por papel; luego las criaturas (perros mutantes…), por especie.
  const groups: [Colonist[], string, string, PawnRole | null][] = (Object.keys(ROLE_PLURAL) as PawnRole[]).map((role) => [
    pawns.filter((c) => c.role === role && !c.creature), ...ROLE_PLURAL[role], role,
  ]);
  for (const id of CREATURE_IDS) groups.push([pawns.filter((c) => c.creature === id), CREATURES[id].name.toLowerCase(), CREATURES[id].plural, null]);
  for (const [of, one, many, role] of groups) {
    if (of.length === 0) continue;
    const downed = of.filter((c) => c.downed).length;
    const hurt = of.filter((c) => !c.downed && (c.wounds.length > 0 || c.health < 0.999)).length;
    const extra: string[] = [];
    if (downed) extra.push(`${downed} en el suelo`);
    if (hurt) extra.push(`${hurt} ${hurt === 1 ? 'herido' : 'heridos'}`);
    if (role === 'saqueador' && of.some((c) => c.raider?.leader)) extra.push('con el líder ★');
    parts.push(`${of.length} ${of.length === 1 ? one : many}${extra.length ? ` (${extra.join(', ')})` : ''}`);
  }
  const avg = pawns.reduce((s, c) => s + c.health, 0) / pawns.length;
  return `👥 ${parts.join(' · ')} · ❤ salud media ${Math.round(avg * 100)} %`;
}

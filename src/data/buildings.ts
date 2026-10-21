/** Definiciones de construcciones. Los datos están en `buildings.json`; aquí, sus tipos y la validación. */
import raw from './buildings.json';
import { RESOURCES, ResourceId } from './resources';
import { SKILLS, type Skill } from './colonists';
import { vehicleDef } from './vehicles';

export type BuildingCategory = 'muro' | 'puerta' | 'porton' | 'torre' | 'suelo' | 'defensa' | 'mueble' | 'taller' | 'agua' | 'electricidad' | 'vehiculo' | 'granja';

export const BUILDING_CATEGORY_NAMES: Record<BuildingCategory, string> = {
  muro: 'Muros',
  puerta: 'Puertas',
  porton: 'Portones',
  torre: 'Torres de vigía',
  suelo: 'Suelos',
  defensa: 'Defensas',
  mueble: 'Muebles',
  taller: 'Talleres',
  agua: 'Agua',
  electricidad: 'Electricidad',
  vehiculo: 'Vehículos',
  granja: 'Granja',
};

export interface BuildingDef {
  id: string;
  name: string;
  category: BuildingCategory;
  /** Materiales que hay que llevar al plano. */
  cost: Partial<Record<ResourceId, number>>;
  /** Ticks de trabajo de un colono normal. */
  work: number;
  /** Resistencia (para los ataques, más adelante). */
  hp: number;
  /** Impide el paso una vez construido. */
  blocks: boolean;
  /** Coste de paso si no bloquea: 1,3 puerta, 0,8 suelo (más rápido), 2 barricada… */
  moveCost?: number;
  /** Altura en «pisos» de muro: 1 muro normal, 2 muro alto, 3 torre. */
  height: number;
  /** Casillas que ocupa [ancho, alto] sin girar (por defecto 1×1). */
  size?: [number, number];
  /** Hay que ponerla junto al agua (depuradora). */
  nearWater?: boolean;
  /** Estantería: cuántos montones normales caben en su casilla. */
  storage?: number;
  /** Solo guarda esto (armero: armas y munición; nevera: comida). */
  storageFor?: 'armas' | 'comida';
  /** Nevera (pedido de Mikel del 2026-10-21): con corriente, la comida guardada en ella no se pone mala. */
  fridge?: boolean;
  /**
   * Climatización eléctrica (calefactor o aire acondicionado): lleva la habitación hacia la
   * temperatura que se elija, subiéndola (`calor`) o bajándola (`frio`) hasta `degrees` °C como mucho
   * en una habitación mediana. Solo gasta corriente mientras trabaja.
   */
  climate?: { mode: 'calor' | 'frio'; degrees: number };
  /** Cable eléctrico: va en su propia capa, debajo de suelos, muros y máquinas. */
  conduit?: boolean;
  /** Vatios: positivo si produce, negativo si consume. */
  power?: number;
  /** Fuente natural: «solar» solo produce de día; «wind» según el viento y si no tiene nada alrededor. */
  source?: 'solar' | 'wind';
  /** Batería: vatios-hora que guarda. */
  battery?: number;
  /** Combustible que gasta para producir: qué, cuántas horas dura cada unidad y cuántas caben. */
  fuel?: { resource: ResourceId; hoursPerUnit: number; capacity: number };
  /**
   * Taller que se puede electrificar (mejora): lo que cuesta, los vatios que gasta y el trabajo que
   * lleva. Electrificado y con corriente trabaja el doble de rápido; sin ella, a velocidad normal.
   */
  electrify?: { cost: Partial<Record<ResourceId, number>>; power: number; work: number };
  /** Puerta automática: con corriente se cierra a los saqueadores mientras dura un raid. */
  autoDoor?: boolean;
  /** Se puede llevar a otro sitio con «✋ Mover» (muebles y talleres sin electrificar). */
  movable?: boolean;
  /**
   * Torreta: dispara sola a los enemigos mientras le llega corriente, sin gastar munición.
   * Daño (× el de los puños), ritmo (× el tiempo entre disparos) y alcance en casillas.
   */
  turret?: { damage: number; cooldown: number; reach: number };
  /**
   * Mortero: lo maneja un colono reclutado pegado a él. Tira a un enemigo a `minReach`–`reach`
   * casillas (por encima de los muros); cada disparo gasta `ammoPerShot` del depósito (`ammo`, que los
   * colonos rellenan como el combustible), falla con `missChance` cayendo hasta `missSpread` casillas
   * al lado, y estalla como una granada (3×3). Un disparo cada `cooldownSeconds`; el proyectil tarda
   * `flightTicks` en caer.
   */
  mortar?: {
    minReach: number;
    reach: number;
    ammo: { resource: ResourceId; capacity: number };
    ammoPerShot: number;
    missChance: number;
    missSpread: number;
    cooldownSeconds: number;
    flightTicks: number;
  };
  /** Lámpara: casillas que ilumina alrededor. */
  light?: number;
  /** Casillas de vista desde lo alto (torres; servirá para ver venir a los enemigos). */
  sight?: number;
  /** Vehículo: al terminarlo deja de ser una construcción y pasa a ser este vehículo (de `vehicles.json`). */
  vehicle?: string;
  /** Taller cuyo trabajo acelera otra habilidad que la de fabricar (mesa de boticario: Medicina). */
  workSkill?: Skill;
  /**
   * Investigación que hay que terminar para poder poner planos nuevos (id de `research.json`).
   * Lo ya construido o planeado en partidas empezadas se queda.
   */
  research?: string;
  /** Segunda investigación que también hace falta (la mina casera: «Trampas» y «Pólvora»). */
  researchAlso?: string;
  /** Al demolerla se recupera todo el material, no la mitad (sacos de arena). */
  fullRefund?: boolean;
  /**
   * Muro con aspilleras: se dispara a través de él desde los dos lados y quien está pegado
   * tiene esta cobertura (0,75) en vez de la total de un muro.
   */
  loophole?: number;
  /** Daño (salud, 0-1) a cada enemigo que entra en la casilla (alambre de espino); a los colonos, no. */
  stepDamage?: number;
  /**
   * Mina: estalla cuando un enemigo entra en la casilla (los colonos saben dónde está) y se gasta.
   * Daño (× el de los puños) a cada enemigo a `radius` casillas o menos (1 = el 3×3).
   */
  mine?: { damage: number; radius: number };
  /**
   * Trampa eléctrica: con corriente, aturde estos segundos a cada enemigo que entra en la casilla
   * (no se mueve ni ataca). No se gasta. A los colonos, nada (saben dónde está).
   */
  stunSeconds?: number;
  /**
   * Hoguera: mientras le queda combustible está encendida (lo gasta aunque no queme nada) y un colono
   * con «Transportar» le lleva cada cadáver de criatura para quemarlo. Sin combustible, apagada.
   */
  burnsCorpses?: boolean;
  /**
   * Estufa (bloque 11, aprobado por Mikel): en invierno, de noche, con leña dentro calienta la
   * habitación con tejado en la que está (gasta su combustible solo entonces).
   */
  heater?: boolean;
  /** Puntos de belleza que da a la habitación con tejado en la que está (bloque 12); los muebles sin esto, 2. */
  beauty?: number;
  /**
   * Kit (elegido por Mikel el 2026-10-21): se desmonta como objeto (`kit_<id>`) que se guarda en el
   * almacén y se lleva a otro sitio; montarlo pide solo ese kit y la mitad del trabajo.
   */
  kit?: boolean;
  /** Para los ratos libres (bloque 12): la mesa de juego (la hoguera encendida también vale). */
  recreation?: boolean;
  /**
   * Ánimo de estar cerca de noche (hoguera, elegido por Mikel el 2026-10-20): a quien está despierto
   * a `radius` casillas o menos mientras arde le suma `mood`, que le dura `hours` horas tras alejarse.
   */
  cheer?: { radius: number; mood: number; hours: number };
  /**
   * Puente (update del agua, elegido por Mikel el 2026-10-18): un suelo que solo va sobre el agua
   * (cualquiera) y deja cruzarla andando. En el agua profunda cuesta `deepCostMultiplier` veces más.
   */
  bridge?: { deepCostMultiplier: number };
  /**
   * Puente levadizo (update del agua, elegido por Mikel el 2026-10-18): bajado se cruza andando como un
   * puente; alzado no deja pasar a nadie. Con corriente se alza solo al empezar un raid y baja al
   * acabar; con el botón se alza o se baja a mano.
   */
  drawbridge?: boolean;
  /**
   * Plataforma (update del agua, opción B elegida por Mikel el 2026-10-18): un suelo sobre el agua
   * que se pisa y encima del que se construye como sobre tierra (menos huertos). La de madera va en
   * agua poco profunda o normal; con `deepWater`, también en la profunda.
   */
  platform?: { deepWater: boolean };
  /**
   * Va en un río (molino de agua, elegido por Mikel el 2026-10-18): todas sus casillas sobre agua
   * poco profunda o normal, sin suelo, puente ni objeto (en la profunda, no; la corriente es de los ríos).
   */
  onWater?: boolean;
  /**
   * Muelle (update del agua, elegido por Mikel el 2026-10-21): casilla de madera que se pisa, en agua
   * poco profunda o normal, pegada a la orilla o a otro muelle. Encima no se construye (para eso están
   * las plataformas); es un puesto al que se le encarga «pescar hasta tener N 🐟».
   */
  dock?: boolean;
  /**
   * Velocidad de trabajo del puesto según su habilidad (`workSkill`): [con 0, con 20], sin la escala
   * normal de ×0,6 a ×1,6. El muelle: de ×1 a ×2 (1 🐟 cada 2 h con Supervivencia 0, cada hora con 20).
   */
  skillSpeed?: [number, number];
  /**
   * Trampa de pesca (update del agua, aprobada por Mikel el 2026-10-18): va en el agua poco profunda o
   * normal pegada a un muelle y cada día, a esta hora, deja `perDay` 🐟 en el muelle de al lado.
   */
  fishTrap?: { perDay: number; hour: number };
  /**
   * Granja (pedido de Mikel del 2026-10-21): valla. No cuenta como pared de una habitación (no se le
   * pone tejado) y, con `gate`, es la puerta de valla: los colonos pasan y los animales no.
   */
  fence?: boolean;
  gate?: boolean;
  /** Poste con cuerda: ata hasta `animals` animales de carga, que no se alejan más de `leash` casillas. */
  tiePost?: { animals: number; leash: number };
  /**
   * Establo: hasta `animals` animales de carga duermen dentro de noche y comen `foodMult` de lo normal
   * (tienen forraje y no pasan frío).
   */
  stable?: { animals: number; foodMult: number };
  /**
   * Bandeja hidropónica (bloque 5 del catálogo, aprobado): cultiva sola uno de `crops` (ids de
   * `crops.json`) bajo techo y con corriente, `speed` veces más rápido que un huerto, sin fertilidad.
   */
  hydroponics?: { speed: number; crops: string[] };
  /** Explota si el fuego la destruye (generador de leña, destilería). */
  explodes?: boolean;
  /** Espantapájaros (pedido de Mikel del 2026-10-21): las plantas a `radius` casillas o menos no enferman con las plagas. */
  scarecrow?: { radius: number };
  /** Compostera (pedido de Mikel del 2026-10-21): cada día, a esa hora, deja `perDay` 🟤 abono a su lado (de los restos de la colonia). */
  compost?: { perDay: number; hour: number };
  /** Colores del dibujo: cara de arriba, frente y sombra. */
  colors: { top: string; face: string; dark: string };
}

/** Comprueba una definición leída del JSON. Lanza un error con el motivo si no vale. */
export function validateBuilding(d: unknown): BuildingDef {
  const b = d as BuildingDef;
  const fail = (why: string) => {
    throw new Error(`Construcción «${b?.id ?? '?'}» no válida: ${why}`);
  };
  if (!b || typeof b.id !== 'string' || !b.id) fail('falta id');
  if (typeof b.name !== 'string' || !b.name) fail('falta nombre');
  if (!(b.category in BUILDING_CATEGORY_NAMES)) fail(`categoría desconocida ${b.category}`);
  if (!b.cost || Object.keys(b.cost).length === 0) fail('sin coste');
  for (const [r, n] of Object.entries(b.cost)) {
    if (!RESOURCES.includes(r as ResourceId)) fail(`recurso desconocido ${r}`);
    if (!Number.isInteger(n) || (n as number) <= 0) fail(`cantidad de ${r} no válida`);
  }
  if (!(b.work > 0) || !(b.hp > 0)) fail('trabajo o resistencia no válidos');
  if (typeof b.blocks !== 'boolean') fail('falta «blocks»');
  if (b.height === undefined) b.height = 1;
  if (!Number.isInteger(b.height) || b.height < 0 || b.height > 4) fail('altura no válida');
  if (b.size !== undefined && (!Array.isArray(b.size) || b.size.length !== 2 || !b.size.every((n) => Number.isInteger(n) && n >= 1 && n <= 4))) fail('tamaño no válido');
  if (b.moveCost !== undefined && !(b.moveCost >= 0.5 && b.moveCost <= 5)) fail('coste de paso no válido');
  if (b.category === 'torre' && b.blocks) fail('una torre se tiene que poder subir (no bloquea)');
  if (b.source !== undefined && (!['solar', 'wind'].includes(b.source) || !((b.power ?? 0) > 0))) fail('fuente de energía no válida');
  if (b.electrify !== undefined) {
    const e = b.electrify;
    if (b.category !== 'taller' || b.power !== undefined) fail('solo se electrifica un taller sin corriente propia');
    if (!e.cost || Object.keys(e.cost).length === 0 || Object.entries(e.cost).some(([r, n]) => !RESOURCES.includes(r as ResourceId) || !Number.isInteger(n) || (n as number) <= 0)) fail('coste de electrificar no válido');
    if (!(e.power > 0) || !(e.work > 0)) fail('electrificar: vatios o trabajo no válidos');
  }
  if (b.autoDoor && (b.category !== 'puerta' || !((b.power ?? 0) < 0))) fail('una puerta automática es una puerta que gasta corriente');
  if (b.turret !== undefined) {
    const t = b.turret;
    if (b.category !== 'defensa' || !((b.power ?? 0) < 0)) fail('una torreta es una defensa que gasta corriente');
    if (!(t.damage > 0) || !(t.cooldown > 0) || !Number.isInteger(t.reach) || t.reach < 2 || t.reach > 20) fail('torreta: daño, ritmo o alcance no válidos');
  }
  if (b.movable !== undefined && (typeof b.movable !== 'boolean' || !['mueble', 'taller', 'electricidad'].includes(b.category))) fail('solo se mueven muebles, talleres y lámparas');
  if ((b.category === 'vehiculo') !== (b.vehicle !== undefined) || (b.vehicle !== undefined && !vehicleDef(b.vehicle))) fail('un vehículo necesita su definición en vehicles.json');
  if (b.workSkill !== undefined && (b.category !== 'taller' || !SKILLS.includes(b.workSkill))) fail(`habilidad de taller desconocida ${b.workSkill}`);
  if (b.research !== undefined && (typeof b.research !== 'string' || !b.research)) fail('investigación no válida');
  if (b.researchAlso !== undefined && (typeof b.researchAlso !== 'string' || !b.researchAlso || !b.research || b.researchAlso === b.research)) fail('segunda investigación no válida');
  if (b.mine !== undefined && (b.blocks || b.stepDamage !== undefined || !(b.mine.damage > 0) || !Number.isInteger(b.mine.radius) || b.mine.radius < 0 || b.mine.radius > 3)) fail('mina no válida');
  if (b.stunSeconds !== undefined && (b.blocks || b.mine !== undefined || !((b.power ?? 0) < 0) || !(b.stunSeconds > 0 && b.stunSeconds <= 30))) fail('trampa eléctrica no válida');
  if (b.fullRefund !== undefined && typeof b.fullRefund !== 'boolean') fail('«fullRefund» no válido');
  if (b.dock !== undefined && (b.dock !== true || b.category !== 'taller' || b.blocks || b.onWater || b.platform || b.bridge || (b.size && (b.size[0] !== 1 || b.size[1] !== 1)))) fail('muelle no válido: un puesto 1×1 que se pisa');
  if (b.fishTrap !== undefined && (b.category !== 'mueble' || b.blocks || b.movable || b.onWater || b.dock || !Number.isInteger(b.fishTrap.perDay) || b.fishTrap.perDay < 1 || !Number.isInteger(b.fishTrap.hour) || b.fishTrap.hour < 0 || b.fishTrap.hour > 23)) fail('trampa de pesca no válida');
  if (b.skillSpeed !== undefined && (!b.workSkill || !Array.isArray(b.skillSpeed) || b.skillSpeed.length !== 2 || !b.skillSpeed.every((n) => n > 0 && n <= 5))) fail('«skillSpeed» no válido');
  if (b.loophole !== undefined && (b.category !== 'muro' || typeof b.loophole !== 'number' || !(b.loophole > 0 && b.loophole < 1))) fail('«loophole» no válido');
  if (b.stepDamage !== undefined && (b.blocks || !(b.stepDamage > 0 && b.stepDamage <= 0.5))) fail('«stepDamage» no válido');
  if (b.burnsCorpses !== undefined && (b.burnsCorpses !== true || !b.fuel || b.power !== undefined)) fail('una hoguera necesita combustible y no da corriente');
  if (b.mortar !== undefined) {
    const m = b.mortar;
    if (b.category !== 'defensa' || b.fuel !== undefined || b.turret !== undefined) fail('un mortero es una defensa sin combustible ni torreta');
    if (!Number.isInteger(m.minReach) || !Number.isInteger(m.reach) || m.minReach < 1 || m.reach <= m.minReach || m.reach > 40) fail('mortero: alcance no válido');
    if (!RESOURCES.includes(m.ammo?.resource) || !Number.isInteger(m.ammoPerShot) || m.ammoPerShot < 1 || !Number.isInteger(m.ammo.capacity) || m.ammo.capacity < m.ammoPerShot) fail('mortero: munición no válida');
    if (!(m.missChance >= 0 && m.missChance < 1) || !Number.isInteger(m.missSpread) || m.missSpread < 1 || !(m.cooldownSeconds > 0) || !Number.isInteger(m.flightTicks) || m.flightTicks < 1) fail('mortero: números no válidos');
  }
  if (b.cheer !== undefined && (!b.burnsCorpses || !Number.isInteger(b.cheer.radius) || b.cheer.radius < 1 || b.cheer.radius > 10 || !(b.cheer.mood > 0 && b.cheer.mood <= 0.3) || !(b.cheer.hours > 0))) fail('«cheer» no válido');
  if (b.bridge !== undefined && (b.category !== 'suelo' || b.blocks || !(b.bridge.deepCostMultiplier >= 1 && b.bridge.deepCostMultiplier <= 5))) fail('puente no válido');
  if (b.platform !== undefined && (b.category !== 'suelo' || b.blocks || b.bridge !== undefined || typeof b.platform.deepWater !== 'boolean')) fail('plataforma no válida');
  if (b.drawbridge !== undefined && (b.drawbridge !== true || b.category !== 'defensa' || b.blocks || b.height !== 0 || !((b.power ?? 0) < 0) || b.bridge !== undefined || b.onWater !== undefined)) fail('puente levadizo no válido');
  if (b.onWater !== undefined && (b.onWater !== true || b.category === 'suelo' || b.nearWater)) fail('«onWater» no válido');
  if (b.climate && (!['calor', 'frio'].includes(b.climate.mode) || !(b.climate.degrees > 0) || !((b.power ?? 0) < 0))) fail('la climatización sube o baja grados y gasta corriente');
  if (b.fridge && (!b.storage || b.storageFor !== 'comida' || !((b.power ?? 0) < 0))) fail('una nevera guarda comida y gasta corriente');
  if (b.scarecrow && (b.blocks || !Number.isInteger(b.scarecrow.radius) || b.scarecrow.radius < 1 || b.scarecrow.radius > 15)) fail('espantapájaros no válido');
  if (b.compost && (!Number.isInteger(b.compost.perDay) || b.compost.perDay < 1 || !Number.isInteger(b.compost.hour) || b.compost.hour < 0 || b.compost.hour > 23)) fail('compostera no válida');
  if (b.hydroponics && (!((b.power ?? 0) < 0) || !(b.hydroponics.speed > 0) || !Array.isArray(b.hydroponics.crops) || !b.hydroponics.crops.length)) fail('bandeja hidropónica no válida');
  if ((b.fence || b.gate || b.tiePost || b.stable) && b.category !== 'granja') fail('vallas, postes y establos van en «Granja»');
  if (b.gate && (!b.fence || b.blocks)) fail('una puerta de valla es una valla que se pisa');
  if (b.fence && !b.gate && !b.blocks) fail('una valla no se pisa');
  if (b.tiePost && (b.blocks || !Number.isInteger(b.tiePost.animals) || b.tiePost.animals < 1 || !Number.isInteger(b.tiePost.leash) || b.tiePost.leash < 1)) fail('poste no válido');
  if (b.stable && (b.blocks || !Number.isInteger(b.stable.animals) || b.stable.animals < 1 || !(b.stable.foodMult > 0 && b.stable.foodMult <= 1))) fail('establo no válido');
  if (!b.colors?.top || !b.colors.face || !b.colors.dark) fail('faltan colores');
  return b;
}

export const BUILDINGS: readonly BuildingDef[] = (raw as unknown[]).map(validateBuilding);

/** Ánimo de la hoguera encendida de noche (de su definición en `buildings.json`). */
export const BONFIRE_CHEER = BUILDINGS.find((b) => b.cheer)?.cheer ?? { radius: 0, mood: 0, hours: 0 };

/**
 * Depósito interior que los colonos rellenan desde el almacén: el combustible de un generador o una
 * hoguera, o la munición de un mortero. Lo que hay dentro va en `Structure.fuel`.
 */
export function depositOf(def: BuildingDef): { resource: ResourceId; capacity: number } | undefined {
  return def.fuel ?? def.mortar?.ammo;
}

const BY_ID = new Map(BUILDINGS.map((b) => [b.id, b]));

export function buildingDef(id: string): BuildingDef {
  const d = BY_ID.get(id);
  if (!d) throw new Error(`Construcción desconocida: ${id}`);
  return d;
}

/** Recurso del kit de una construcción (o undefined si no se desmonta en kit). */
export function kitOf(def: BuildingDef): ResourceId | undefined {
  const id = `kit_${def.id}`;
  return def.kit && RESOURCES.includes(id as ResourceId) ? (id as ResourceId) : undefined;
}

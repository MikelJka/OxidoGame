// Atacar la base de una facción (bases, segunda parte; elegido por Mikel el 2026-10-21, opción
// 1C): se manda a unos colonos de expedición; tras los días de viaje se carga un mapa de batalla
// con la base (muros, torres, defensores y su botín) y se pelea en directo. Al acabar vuelven a
// casa con lo que hayan ganado. Si cae la base, la facción desaparece y quedan sus ruinas.
// Puro y determinista: sin Phaser ni DOM.
import { factionDef } from '../data/factions';
import { baseLevel } from '../data/worldmap';
import { RAIDER_AMMO, ammoFor, raiderWeaponPool } from '../data/weapons';
import { RESOURCES, ResourceId } from '../data/resources';
import type { Colonist } from './colonist';
import { isPassable, Prop, Terrain } from './map';
import { Rng } from './rng';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { travelDays } from './worldmap';
import { World } from './world';

/** Una expedición en marcha: de ida, peleando o de vuelta. */
export interface Expedition {
  faction: string;
  members: Colonist[];
  phase: 'ida' | 'batalla' | 'vuelta';
  /** Tick (del mapa de la colonia) en que llegan a la base o vuelven a casa. */
  arriveAt: number;
  /** Lo que traen de vuelta. */
  loot: Partial<Record<ResourceId, number>>;
  /** Cómo acabó la batalla (de vuelta). */
  result?: BattleResult;
}

export type BattleResult = 'victoria' | 'derrota' | 'retirada';

/** Lo que sabe un mapa de batalla: de qué colonia es, contra quién y cómo va. */
export interface BattleInfo {
  home: World;
  faction: string;
  /** Rectángulo de la base [x0, y0, x1, y1]. */
  base: [number, number, number, number];
  result?: BattleResult;
}

/** Ruinas de una base destruida (para ocuparla más adelante). */
export interface Ruin {
  faction: string;
  name: string;
  x: number;
  y: number;
  day: number;
}

/** Tamaño del mapa de batalla. */
const BATTLE_SIZE = { width: 64, height: 44 };
/** Defensores como mucho (aunque la base tenga más gente). */
const MAX_DEFENDERS = 18;

/** Saca a unos colonos de la colonia y los manda a atacar la base de una facción. Devuelve el motivo si no se puede. */
export function startExpedition(w: World, factionId: string, ids: number[]): string | null {
  if (w.expedition) return 'Ya hay una expedición fuera.';
  const f = w.faction(factionId);
  if (!f?.base) return 'Esa facción no tiene base.';
  const members = w.colonists.filter((c) => ids.includes(c.id) && !c.downed);
  if (!members.length) return 'Elige al menos a un colono que pueda andar.';
  for (const c of members) w.removeFromColony(c);
  const days = travelDays(f.base);
  w.expedition = { faction: factionId, members, phase: 'ida', arriveAt: w.tick + Math.round(days * TICKS_PER_DAY), loot: {} };
  // Atacarles los pone en guerra con vosotros.
  w.changeRelation(factionId, -100, 'les atacáis');
  const def = factionDef(factionId);
  w.addLog(`⚔️ ${members.map((c) => c.name).join(', ')} ${members.length === 1 ? 'sale' : 'salen'} hacia ${f.settlement}, la base de ${def?.name ?? factionId}: ${String(days).replace('.', ',')} días de viaje.`, 'info');
  return null;
}

/** Cada hora en la colonia: la expedición llega a la base (empieza la batalla) o vuelve a casa. */
export function updateExpedition(w: World): void {
  const e = w.expedition;
  if (!e || w.tick < e.arriveAt) return;
  if (e.phase === 'ida') {
    const f = w.faction(e.faction);
    if (!f?.base) {
      // La base ya no existe: se vuelven.
      e.phase = 'vuelta';
      e.arriveAt = w.tick + TICKS_PER_DAY;
      return;
    }
    e.phase = 'batalla';
    w.pendingBattle = createBattle(w, e);
    w.addLog(`⚔️ La expedición llega a ${f.settlement}. ¡Empieza la batalla!`, 'malo', 'raid');
    return;
  }
  if (e.phase === 'vuelta') {
    w.expedition = null;
    for (const c of e.members) {
      w.colonists.push(c);
      if (!w.placeNearColony(c)) {
        const p = w.colonyPoint() ?? { x: 0, y: 0 };
        c.tile = { ...p };
        c.pos = { x: p.x + 0.5, y: p.y + 0.5 };
      }
    }
    const home = w.colonyPoint();
    if (home) w.items.dropAll(home.x, home.y, e.loot);
    const got = (Object.entries(e.loot) as [ResourceId, number][]).filter(([, n]) => n > 0).map(([r, n]) => `${n} de ${r}`).join(', ');
    w.addLog(`🏠 Vuelve la expedición: ${e.members.map((c) => c.name).join(', ') || 'nadie'}${got ? `, con ${got}` : ''}.`, e.result === 'victoria' ? 'bueno' : 'info');
  }
}

/** El mapa de batalla: la base de la facción a la derecha y los colonos entrando por la izquierda. */
export function createBattle(home: World, e: Expedition): World {
  const f = home.faction(e.faction)!;
  const base = f.base!;
  const seed = ((home.map.seed ^ 0x0ba771e5) + base.x * 131 + base.y * 977 + home.day) >>> 0;
  const b = new World({ seed, width: BATTLE_SIZE.width, height: BATTLE_SIZE.height, colonists: 0, events: false, needs: false });
  b.nextPawnId = home.nextPawnId + 1000;
  b.tick = home.tick;
  const m = b.map;
  const rng = new Rng(seed);
  // Terreno llano y sin agua en el centro (para que se pueda pelear).
  const level = baseLevel(base.population);
  const [bw, bh] = level.id === 'fortaleza' ? [17, 13] : level.id === 'pueblo' ? [13, 11] : [9, 9];
  const x0 = m.width - bw - 6;
  const y0 = Math.floor((m.height - bh) / 2);
  const x1 = x0 + bw - 1;
  const y1 = y0 + bh - 1;
  for (let y = 0; y < m.height; y++) {
    for (let x = 0; x < m.width; x++) {
      const i = y * m.width + x;
      const t = m.terrain[i] as Terrain;
      if (t <= Terrain.ShallowWater || t === Terrain.Rock || x >= x0 - 3 || x < 6) m.terrain[i] = Terrain.Soil;
      if (x >= x0 - 3 || x < 6 || m.props[i] === Prop.RuinWall || m.props[i] === Prop.Boulder) m.props[i] = Prop.None;
      m.cliff[i] = 0;
      m.slope[i] = 0;
      m.level[i] = 2;
    }
  }
  m.start = { x: 2, y: Math.floor(m.height / 2) };
  for (const s of b.items.list()) b.items.take(s.x, s.y, s.amount);
  // Muros (de madera en una aldea, de piedra en un pueblo y de hormigón en una fortaleza) con la entrada hacia la izquierda.
  const wall = level.id === 'fortaleza' ? 'muro_hormigon' : level.id === 'pueblo' ? 'muro_piedra' : 'muro_madera';
  const gate = Math.floor((y0 + y1) / 2);
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      if (x !== x0 && x !== x1 && y !== y0 && y !== y1) continue;
      if (x === x0 && Math.abs(y - gate) <= 1) continue;
      if (b.structures.place(x, y, wall)) b.completeStructure(b.structures.at(x, y)!);
    }
  }
  // Torres de vigía por dentro, según sus defensas.
  const tower = level.id === 'aldea' ? 'torre_madera' : 'torre_piedra';
  const corners = [[x0 + 1, y0 + 1], [x0 + 1, y1 - 1], [x1 - 1, y0 + 1], [x1 - 1, y1 - 1], [x0 + 2, gate - 3], [x0 + 2, gate + 3]];
  for (const [tx, ty] of corners.slice(0, Math.min(corners.length, Math.floor(base.defenses / 2)))) {
    if (b.structures.place(tx, ty, tower)) b.completeStructure(b.structures.at(tx, ty)!);
  }
  // Su botín: la mitad de su riqueza en recursos, en el centro de la base.
  const pool: ResourceId[] = ['madera', 'piedra', 'chatarra', 'componentes', 'metal', 'comida', 'medicina', 'balas'];
  let value = Math.max(60, Math.round(base.wealth / 2) + base.population * 15);
  for (let k = 0; k < 6 && value > 0; k++) {
    const r = pool[rng.int(0, pool.length - 1)];
    const n = Math.max(1, Math.round(value / 3 / Math.max(1, rVal(r))));
    b.items.dropAll(Math.floor((x0 + x1) / 2), gate, { [r]: n });
    value -= n * rVal(r);
  }
  // Defensores, armados según el día, dentro de la base.
  const n = Math.max(2, Math.min(MAX_DEFENDERS, base.population));
  const weapons = raiderWeaponPool(home.day);
  const group = b.nextPawnId;
  const defenders: Colonist[] = [];
  for (let k = 0; k < n; k++) {
    const d = b.makePawn('saqueador');
    d.faction = e.faction;
    d.raider = { fleeing: false, leaveAt: Number.MAX_SAFE_INTEGER, group };
    d.skills.combate = Math.max(d.skills.combate, rng.int(3, 10));
    d.weapon = weapons[rng.int(0, weapons.length - 1)];
    d.ammo = ammoFor(d.weapon) ? RAIDER_AMMO : 0;
    for (let tries = 0; tries < 40; tries++) {
      const x = rng.int(x0 + 1, x1 - 1);
      const y = rng.int(y0 + 1, y1 - 1);
      if (!isPassable(m, x, y)) continue;
      d.tile = { x, y };
      d.pos = { x: x + 0.5, y: y + 0.5 };
      break;
    }
    defenders.push(d);
    b.others.push(d);
  }
  const leader = defenders.reduce((a, c) => (c.skills.combate > a.skills.combate ? c : a));
  leader.raider!.leader = true;
  b.raidGroups.push({ id: group, size: defenders.length, leaderId: leader.id, escaped: [], routed: false });
  // Los colonos entran por la izquierda, reclutados.
  e.members.forEach((c, k) => {
    const y = Math.max(1, Math.min(m.height - 2, m.start.y - Math.floor(e.members.length / 2) + k));
    c.tile = { x: 2, y };
    c.pos = { x: 2.5, y: y + 0.5 };
    c.path = [];
    c.job = null;
    c.drafted = true;
    b.colonists.push(c);
  });
  b.battle = { home, faction: e.faction, base: [x0, y0, x1, y1] };
  b.addLog(`⚔️ Batalla en ${f.settlement}: ${defenders.length} defensores tras sus muros. Vuestros colonos están reclutados: tocad a un enemigo para atacarle, o 🏳 Retirarse para volver.`, 'malo', 'raid');
  return b;
}

const rVal = (r: ResourceId) => ({ madera: 1, piedra: 1, chatarra: 2, componentes: 12, metal: 4, comida: 5, medicina: 20, balas: 1.2 } as Partial<Record<ResourceId, number>>)[r] ?? 1;

/** Cada segundo en el mapa de batalla: ¿se ha acabado? */
export function checkBattle(b: World): void {
  const info = b.battle;
  if (!info || info.result) return;
  const foes = b.others.some((o) => o.role === 'saqueador' && o.faction === info.faction && !o.downed && !o.raider?.fleeing);
  const ours = b.colonists.some((c) => !c.downed);
  if (!foes) info.result = 'victoria';
  else if (!ours) info.result = 'derrota';
}

/** Se retiran de la batalla (con los heridos a cuestas). */
export function retreat(b: World): void {
  if (b.battle && !b.battle.result) b.battle.result = 'retirada';
}

/**
 * Acaba la batalla: los colonos vuelven a la colonia (días de viaje) con su botín si han ganado;
 * si cae la base, la facción desaparece y quedan sus ruinas.
 */
export function finishBattle(b: World): World {
  const info = b.battle!;
  const home = info.home;
  const e = home.expedition;
  const f = home.faction(info.faction);
  const def = factionDef(info.faction);
  const result = info.result ?? 'retirada';
  for (const g of b.graveyard) {
    home.graveyard.push({ ...g });
    home.addLog(`💀 ${g.name} ha muerto en la batalla (${g.cause}).`, 'malo', 'muerte');
  }
  const members = [...b.colonists];
  for (const c of members) {
    c.drafted = false;
    c.job = null;
    c.path = [];
    c.need = null;
    delete c.vehicle;
    c.activity = 'idle';
  }
  const loot: Partial<Record<ResourceId, number>> = {};
  if (result === 'victoria') {
    // Se llevan lo que había en la base.
    const [x0, y0, x1, y1] = info.base;
    for (const s of b.items.list()) {
      if (s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1) continue;
      loot[s.resource] = (loot[s.resource] ?? 0) + s.amount;
    }
    if (f?.base) home.ruins.push({ faction: f.id, name: f.settlement, x: f.base.x, y: f.base.y, day: home.day });
    home.factions.splice(home.factions.findIndex((k) => k.id === info.faction), 1);
    home.addLog(`🏚 ¡Victoria! ${f?.settlement ?? 'La base'} ha caído: ${def?.name ?? info.faction} ya no existen. Quedan sus ruinas en el mapa del mundo.`, 'bueno');
  } else {
    home.addLog(result === 'derrota' ? `☠ Derrota en ${f?.settlement ?? 'la base'}: los vuestros vuelven a casa malheridos.` : `🏳 La expedición se retira de ${f?.settlement ?? 'la base'} y vuelve a casa.`, 'malo');
  }
  const days = f?.base ? travelDays(f.base) : 1;
  home.expedition = { faction: info.faction, members, phase: 'vuelta', arriveAt: home.tick + Math.round(days * TICKS_PER_DAY), loot, result };
  home.pendingBattle = null;
  if (e) e.members = members;
  return home;
}

/** Recursos válidos (para leer una partida guardada). */
export function cleanLoot(o: unknown): Partial<Record<ResourceId, number>> {
  const out: Partial<Record<ResourceId, number>> = {};
  if (!o || typeof o !== 'object') return out;
  for (const [r, n] of Object.entries(o)) if (RESOURCES.includes(r as ResourceId) && typeof n === 'number' && n > 0) out[r as ResourceId] = Math.floor(n);
  return out;
}

/** Horas que faltan para que llegue la expedición (a la base o a casa). */
export function expeditionHours(w: World): number {
  return w.expedition ? Math.max(0, Math.ceil((w.expedition.arriveAt - w.tick) / TICKS_PER_HOUR)) : 0;
}

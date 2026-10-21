// Comercio por barco (pedido por Mikel el 2026-10-21): un barco de la colonia con su tripulación lleva
// mercancía por el río a la base de una facción que no está en guerra, la vende allí a precio de
// mercado y vuelve con lo que se le ha pedido. Puro y determinista: sin Phaser ni DOM.
import data from '../data/boattrade.json';
import { factionDef } from '../data/factions';
import { MARKET } from '../data/market';
import { RESOURCES, ResourceId } from '../data/resources';
import { RESOURCE_VALUES } from '../data/values';
import { vehicleDef } from '../data/vehicles';
import { loadWeight, WEIGHTS } from '../data/weights';
import type { Colonist } from './colonist';
import { parkVehicle } from './expedition';
import { relationLevel } from './factions';
import { marketMult, marketTrade } from './market';
import { TRADER_MARGIN } from './people';
import { Rng } from './rng';
import { TICKS_PER_DAY } from './time';
import type { Vehicle } from './vehicles';
import { enrichBase, travelDays } from './worldmap';
import type { World } from './world';

export const BOAT_TRADE = data as {
  travelFactor: number; minDays: number; needPremium: number; surplusDiscount: number; relation: number; pirateChance: number; pirateLoss: number;
};

export interface BoatTrip {
  id: number;
  faction: string;
  vehicle: Vehicle;
  crew: Colonist[];
  phase: 'ida' | 'vuelta';
  arriveAt: number;
  /** Lo que llevan a vender. */
  goods: Partial<Record<ResourceId, number>>;
  /** Lo que quieren traer a cambio. */
  want: ResourceId;
  /** Lo que traen de vuelta. */
  back: Partial<Record<ResourceId, number>>;
}

/** Barcos de la colonia que pueden comerciar (de los colonos, con carga). */
export function tradeBoats(w: World): Vehicle[] {
  return w.vehicles.filter((v) => {
    const d = vehicleDef(v.def);
    return !!d?.water && !d.hostile && (d.cargo ?? 0) > 0;
  });
}

function pool(factionId: string): { needs: ResourceId[]; surplus: ResourceId[] } {
  return MARKET.caravans?.[factionId] ?? { needs: [], surplus: [] };
}

/** Lo que pagan en esa base por una unidad. */
export function boatSellPrice(w: World, factionId: string, r: ResourceId): number {
  return RESOURCE_VALUES[r] * marketMult(w.market, r) * (pool(factionId).needs.includes(r) ? 1 + BOAT_TRADE.needPremium : 1);
}

/** Lo que cuesta allí una unidad. */
export function boatBuyPrice(w: World, factionId: string, r: ResourceId): number {
  return RESOURCE_VALUES[r] * marketMult(w.market, r) * TRADER_MARGIN * (pool(factionId).surplus.includes(r) ? 1 - BOAT_TRADE.surplusDiscount : 1);
}

/** Lo que vende esa facción (lo que le sobra primero). */
export function boatWares(factionId: string): ResourceId[] {
  const s = pool(factionId).surplus;
  const rest = RESOURCES.filter((r) => !s.includes(r) && !r.startsWith('kit_'));
  return [...s, ...rest];
}

/** Días de viaje por el río hasta esa base. */
export function boatDays(w: World, factionId: string): number {
  const b = w.faction(factionId)?.base;
  if (!b) return 0;
  return Math.max(BOAT_TRADE.minDays, Math.round(travelDays(b) * BOAT_TRADE.travelFactor * 2) / 2);
}

/** Manda un barco a comerciar. Devuelve el motivo si no se puede. */
export function startBoatTrip(w: World, vehicleId: number, crewIds: number[], factionId: string, goods: Partial<Record<ResourceId, number>>, want: ResourceId): string | null {
  const f = w.faction(factionId);
  if (!f?.base) return 'Esa facción no tiene base.';
  if (factionDef(factionId)?.fixed || relationLevel(f.relation) === 'hostil') return 'Con los que están en guerra con vosotros no se comercia.';
  const boat = tradeBoats(w).find((v) => v.id === vehicleId);
  if (!boat) return 'Elegid un barco.';
  const crew = w.colonists.filter((c) => crewIds.includes(c.id) && !c.downed);
  if (!crew.length) return 'Alguien tiene que llevar el barco.';
  if (crew.length >= w.colonists.length) return 'Alguien tiene que quedarse en la colonia.';
  const cargo = vehicleDef(boat.def)!.cargo ?? 0;
  const kg = loadWeight(goods);
  if (kg <= 0) return 'Cargad algo para vender.';
  if (kg > cargo) return `Demasiada carga: ${kg} de ${cargo} kg.`;
  const inv = w.inventory();
  for (const [r, n] of Object.entries(goods) as [ResourceId, number][]) if ((n ?? 0) > inv[r]) return `No hay tanto de ${r}.`;
  for (const c of crew) w.removeFromColony(c);
  for (const c of w.pawns()) if (c.vehicle?.id === boat.id) w.leaveVehicle(c);
  w.vehicles.splice(w.vehicles.indexOf(boat), 1);
  boat.path = [];
  const load: Partial<Record<ResourceId, number>> = {};
  for (const [r, n] of Object.entries(goods) as [ResourceId, number][]) {
    if (!(n > 0)) continue;
    takeAll(w, r, n);
    load[r] = n;
  }
  const days = boatDays(w, factionId);
  w.boatTrips.push({ id: w.nextBoatTripId++, faction: factionId, vehicle: boat, crew, phase: 'ida', arriveAt: w.tick + Math.round(days * TICKS_PER_DAY), goods: load, want, back: {} });
  const name = vehicleDef(boat.def)!.name.toLowerCase();
  w.addLog(`⛵ ${crew.map((c) => c.name).join(', ')} ${crew.length === 1 ? 'sale' : 'salen'} en la ${name} hacia ${f.settlement} a comerciar: ${String(days).replace('.', ',')} días río abajo.`, 'info');
  return null;
}

function takeAll(w: World, r: ResourceId, n: number): void {
  let left = n;
  for (const s of w.items.list()) {
    if (left <= 0) break;
    if (s.resource !== r) continue;
    const got = w.items.take(s.x, s.y, left);
    if (got) left -= got.amount;
  }
}

/** Cada hora: los barcos llegan a la base (venden y compran) o vuelven a casa. */
export function updateBoatTrips(w: World): void {
  for (const t of [...w.boatTrips]) {
    if (w.tick < t.arriveAt) continue;
    const f = w.faction(t.faction);
    const where = f?.settlement ?? factionDef(t.faction)?.name ?? t.faction;
    if (t.phase === 'ida') {
      if (!f?.base) {
        // La base ya no está: vuelven con lo que llevaban.
        t.back = { ...t.goods };
      } else {
        let value = 0;
        for (const [r, n] of Object.entries(t.goods) as [ResourceId, number][]) {
          value += n * boatSellPrice(w, t.faction, r);
          marketTrade(w.market, r, n);
        }
        const price = boatBuyPrice(w, t.faction, t.want);
        const cargo = vehicleDef(t.vehicle.def)?.cargo ?? 0;
        const n = Math.max(0, Math.min(Math.floor(value / price), Math.floor(cargo / (WEIGHTS[t.want] ?? 1))));
        t.back = n > 0 ? { [t.want]: n } : {};
        if (n > 0) marketTrade(w.market, t.want, -n);
        enrichBase(w, t.faction, value);
        w.changeRelation(t.faction, BOAT_TRADE.relation, 'comercio por barco');
        w.addLog(`⛵ La ${vehicleDef(t.vehicle.def)?.name.toLowerCase()} llega a ${where}: vende por ${Math.round(value)} chapas y compra ${n} de ${t.want}. Vuelve a casa.`, 'bueno');
      }
      t.phase = 'vuelta';
      t.arriveAt = w.tick + Math.round(boatDays(w, t.faction) * TICKS_PER_DAY || TICKS_PER_DAY / 2);
      // Piratas del Óxido en el río (con su propio azar).
      const rng = new Rng(((w.map.seed ^ 0x5b0a7) + t.id * 0x9e3779b1 + w.day) >>> 0);
      if (rng.chance(BOAT_TRADE.pirateChance)) {
        const lost: string[] = [];
        for (const [r, n] of Object.entries(t.back) as [ResourceId, number][]) {
          const k = Math.ceil(n * BOAT_TRADE.pirateLoss);
          t.back[r] = n - k;
          lost.push(`${k} de ${r}`);
        }
        for (const c of t.crew) c.health = Math.max(0.3, c.health - 0.2);
        w.addLog(`🏴‍☠️ Los Piratas del Óxido asaltan el barco en el río${lost.length ? ` y se llevan ${lost.join(', ')}` : ''}. La tripulación vuelve herida.`, 'malo');
      }
      continue;
    }
    // Vuelta: la carga, el barco y la tripulación, a casa.
    w.boatTrips.splice(w.boatTrips.indexOf(t), 1);
    const home = w.colonyPoint();
    if (home) w.items.dropAll(home.x, home.y, t.back);
    parkVehicle(w, t.vehicle);
    for (const c of t.crew) {
      w.colonists.push(c);
      if (!w.placeNearColony(c)) {
        const p = home ?? { x: 0, y: 0 };
        c.tile = { ...p };
        c.pos = { x: p.x + 0.5, y: p.y + 0.5 };
      }
    }
    const got = (Object.entries(t.back) as [ResourceId, number][]).filter(([, n]) => n > 0).map(([r, n]) => `${n} de ${r}`).join(', ');
    w.addLog(`⛵ Vuelve el barco de ${where}${got ? ` con ${got}` : ''}.`, 'bueno');
  }
}

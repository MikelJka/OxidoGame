// Puente levadizo (update del agua, elegido por Mikel el 2026-10-18): 4×2 sobre el agua. Bajado se
// cruza andando; alzado no pasa nadie. Con corriente se alza solo al empezar un raid y baja al
// acabar; con el botón se alza o se baja a mano (con o sin corriente).
import type { Structure } from './structures';
import type { World } from './world';

/** Hay alguien (persona o vehículo) encima del puente: así no se alza. */
export function drawbridgeOccupied(w: World, s: Structure): boolean {
  const tiles = w.structures.tilesOf(s);
  const on = (x: number, y: number) => tiles.some((t) => t.x === x && t.y === y);
  return w.pawns().some((p) => on(p.tile.x, p.tile.y)) || tiles.some((t) => !!w.vehicleAt(t.x, t.y));
}

/** Aplica lo que se quiere: bajar, siempre; alzar, en cuanto no queda nadie encima. */
function apply(w: World, s: Structure): void {
  if (!s.wantUp) {
    w.structures.setRaised(s, false);
    return;
  }
  if (s.raised || drawbridgeOccupied(w, s)) return;
  w.structures.setRaised(s, true);
}

/** El botón: si está alzado (o a punto) lo baja; si no, lo alza. Cuenta como decisión del raid de ahora. */
export function toggleDrawbridge(w: World, s: Structure): boolean {
  if (!s.def.drawbridge || !s.built) return false;
  s.wantUp = !s.wantUp;
  s.autoRaised = false;
  s.raidHandled = true;
  apply(w, s);
  return true;
}

/**
 * Cada segundo: al empezar un raid, los que tienen corriente se alzan solos; al acabar, bajan los
 * que se alzaron solos. Un alzado pendiente se termina en cuanto el puente queda libre.
 */
export function updateDrawbridges(w: World, raid: boolean): void {
  let rose = 0;
  let fell = 0;
  for (const s of w.structures.all()) {
    if (!s.def.drawbridge || !s.built) continue;
    const before = !!s.raised;
    if (raid && !s.raidHandled && s.powered) {
      s.raidHandled = true;
      if (!s.wantUp) {
        s.wantUp = true;
        s.autoRaised = true;
      }
    } else if (!raid) {
      s.raidHandled = false;
      if (s.autoRaised) {
        s.wantUp = false;
        s.autoRaised = false;
      }
    }
    apply(w, s);
    if (!before && s.raised) rose++;
    else if (before && !s.raised) fell++;
  }
  if (rose && raid) w.addLog('🌉 El puente levadizo se alza: nadie cruza por ahí.', 'bueno');
  if (fell && !raid) w.addLog('🌉 El puente levadizo baja: ya se puede cruzar.', 'info');
}

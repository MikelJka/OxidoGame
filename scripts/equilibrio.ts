// Equilibrio con partidas simuladas (elegido por Mikel el 2026-10-21): juega sin pantalla partidas
// enteras con un «jugador» sencillo (pone almacén, huertos, camas, cocina, banco, investigación,
// muros y acepta a los supervivientes) y apunta cada día cómo va la colonia.
// Uso: bun scripts/equilibrio.ts <semilla> <dificultad> <días>  → una línea JSON con el resumen.
import { World } from '../src/sim/world';
import { RESEARCH } from '../src/data/research';
import { FOOD_RESOURCES } from '../src/data/resources';
import { cropDef } from '../src/data/crops';
import { recipeDef } from '../src/data/recipes';
import { isResearched } from '../src/sim/research';
import { moodOf } from '../src/sim/needs';
import { TICKS_PER_DAY } from '../src/sim/time';
import type { DifficultyLevel } from '../src/sim/storyteller';

const seed = Number(process.argv[2] ?? 1);
const level = (process.argv[3] ?? 'normal') as DifficultyLevel;
const days = Number(process.argv[4] ?? 30);

const w = new World({ seed, difficulty: { level } });
const s = { ...w.map.start! };
const plan = (x: number, y: number, id: string, rot: 0 | 1 = 0) => w.structures.place(s.x + x, s.y + y, id, rot);
/** Como un jugador: si no cabe donde quería, lo pone en el sitio libre más cercano. */
const planNear = (x: number, y: number, id: string): boolean => {
  for (let r = 0; r <= 12; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (plan(x + dx, y + dy, id)) return true;
      }
  return false;
};
const zone = (x0: number, y0: number, x1: number, y1: number) => w.zones.create({ x0: s.x + x0, y0: s.y + y0, x1: s.x + x1, y1: s.y + y1 });
const farm = (x0: number, y0: number, x1: number, y1: number, crop: string) => {
  const z = w.createGrowZone({ x0: s.x + x0, y0: s.y + y0, x1: s.x + x1, y1: s.y + y1 });
  if (z) w.farms.setCrop(z.id, cropDef(crop)!);
  return z;
};

// Día 1: lo básico.
zone(-3, -3, 2, 0);
farm(-10, 3, -3, 8, 'patata');
farm(4, 3, 9, 7, 'maiz');
for (let k = 0; k < 3; k++) planNear(-8 + k * 3, -6, 'cama');
planNear(4, -3, 'cocina');
planNear(4, -6, 'banco_trabajo');
planNear(8, -6, 'banco_investigacion');
planNear(0, 4, 'hoguera');
// Unas armas sencillas en el banco (palos y cuchillos), como haría un jugador.
const bench = () => w.structures.all().find((x) => x.def.id === 'banco_trabajo' && x.built);
const kitchen = () => w.structures.all().find((x) => x.def.id === 'cocina' && x.built);
// Recoger alrededor: talar, saquear chatarra y minar piedra en un cuadrado grande.
const area = { x0: s.x - 30, y0: s.y - 30, x1: s.x + 30, y1: s.y + 30 };
w.designations.designateArea(area, 'saquear');
w.designations.designateArea(area, 'talar');
const order = ['polvora', 'medicina_campo', 'agricultura', 'sastreria', 'puentes', 'fortificacion', 'calefaccion', 'armas_largas', 'torretas'];
let built2 = false;

let tDay = Date.now();
let stepMs = 0;
const daily: { day: number; alive: number; food: number; mood: number; wealth: number }[] = [];
const deaths: string[] = [];
let raids = 0;
const seen = new WeakSet<object>();
const events: string[] = [];
for (let d = 0; d < days; d++) {
  for (let t = 0; t < TICKS_PER_DAY; t++) {
    const ts = performance.now();
    w.step();
    stepMs += performance.now() - ts;
    if (process.env.TIEMPO && performance.now() - ts > 50) console.error(`  paso lento ${Math.round(performance.now() - ts)} ms ${w.clockLabel()} fuego ${w.fires.size} barcos ${w.boatTrips.length} actividades ${w.colonists.map((c) => c.activity + ':' + (c.job?.kind ?? '')).join(',')} otros ${w.others.map((o) => o.role + ':' + (o.creature ?? o.weapon)).join(',')} vehículos ${w.vehicles.map((v) => v.def).join(',')}`);
    if (w.offer) w.acceptOffer();
    // Como un jugador: ante un ataque, todos reclutados; al acabar, a trabajar.
    if (t % 60 === 0) {
      const foes = w.others.some((o) => o.role === 'saqueador' && !o.downed && !o.raider?.fleeing);
      for (const c of w.colonists) {
        if (c.downed) continue;
        if (c.drafted !== foes) {
          w.setDrafted(c.id, foes);
          // Todos juntos en la colonia, para pelear en grupo.
          if (foes && process.env.TRAZA) console.log(w.clockLabel(), 'raid', w.others.filter((o) => o.role === 'saqueador').map((o) => `${o.weapon} c${o.skills.combate}`).join(','), '| colonos', w.colonists.map((k) => `${k.name} ${k.weapon} c${k.skills.combate} h${k.health.toFixed(2)} d${Math.abs(k.tile.x - s.x) + Math.abs(k.tile.y - s.y)}`).join(', '));
          if (foes) w.orderMove(c.id, { x: s.x + (c.id % 3) - 1, y: s.y + 1 + (c.id % 2) });
        }
      }
    }
    if (!w.research.current) for (const id of [...order, ...RESEARCH.map((r) => r.id)]) if (w.setResearch(id)) break;
    if (w.colonists.length === 0) break;
  }
  for (const l of w.log) {
    if (seen.has(l)) continue;
    seen.add(l);
    if (l.text.startsWith('💀')) deaths.push(`día ${w.day}: ${l.text.replace(/^💀 /, '')}`);
    if (l.alert === 'raid') { raids++; events.push(`día ${w.day}: ${l.text}`); }
    if (/se marcha|abandona|se va de la colonia|secuestr/i.test(l.text) && l.kind === 'malo') events.push(`día ${w.day}: ${l.text}`);
  }
  // En cuanto hay banco: armas para todos (cuchillos y lanzas); en la cocina, guiso.
  // Cada día decide qué hace el banco: armas para todos (las mejores que pueda) y luego munición.
  const b = bench();
  if (b) {
    const inv = w.inventory();
    const guns = isResearched(w.research, 'armas_largas') ? 'fabricar_escopeta' : isResearched(w.research, 'polvora') ? 'fabricar_pistola' : null;
    const armed = (['pistola', 'escopeta', 'rifle'] as const).reduce((a, r) => a + inv[r], 0) + w.colonists.filter((c) => c.weapon && ['pistola', 'escopeta', 'rifle'].includes(c.weapon)).length;
    const melee = inv.lanza + inv.cuchillo + w.colonists.filter((c) => c.weapon === 'lanza' || c.weapon === 'cuchillo').length;
    let want: string;
    if (guns && armed < w.colonists.length) want = guns;
    else if (guns && inv.balas + w.colonists.reduce((a, c) => a + c.ammo, 0) < 20 * w.colonists.length) want = 'fabricar_balas';
    else if (melee < w.colonists.length) want = 'fabricar_lanza';
    else want = 'fabricar_lanza';
    if (b.bill?.recipe.id !== want) w.structures.setBill(b, { recipe: recipeDef(want)!, target: want === 'fabricar_balas' ? 30 * w.colonists.length : w.colonists.length + 1, paused: false });
  }
  const k = kitchen();
  if (k && !k.bill) w.structures.setBill(k, { recipe: recipeDef('guiso_patatas')!, target: 20, paused: false });
  // Día 6: muros alrededor y más camas.
  if (!built2 && w.day >= 6) {
    built2 = true;
    for (let x = -12; x <= 12; x++) for (const y of [-10, 11]) plan(x, y, x === 0 ? 'puerta_madera' : 'muro_madera');
    for (let y = -9; y <= 10; y++) for (const x of [-12, 12]) plan(x, y, y === 0 ? 'puerta_madera' : 'muro_madera');
    for (let k = 3; k < 6; k++) planNear(-8 + (k - 3) * 3, -8, 'cama');
  }
  if (process.env.TIEMPO) console.error(`día ${w.day} · ${Date.now() - tDay} ms (step ${Math.round(stepMs)}) · colonos ${w.colonists.length} · otros ${w.others.length} · montones ${w.items.list().length} · fuego ${w.fires.size}`);
  tDay = Date.now();
  stepMs = 0;
  if (process.env.TRAZA) console.log('   estructuras', w.structures.all().filter((x) => ['banco_investigacion', 'banco_trabajo', 'cocina'].includes(x.def.id)).map((x) => `${x.def.id}:${x.built ? 'ok' : JSON.stringify(x.delivered)}`).join(' '), 'inv', JSON.stringify({ ch: w.inventory().chatarra, co: w.inventory().componentes, ma: w.inventory().madera }), 'investigando', w.research.current);
  if (process.env.TRAZA) console.log(w.clockLabel(), w.colonists.map((k) => `${k.name} h${k.health.toFixed(2)} f${k.needs.food.toFixed(2)} w${k.needs.water.toFixed(2)} r${k.needs.rest.toFixed(2)} heridas${k.wounds.length} ${k.activity}`).join(' | '));
  const inv = w.inventory();
  const food = FOOD_RESOURCES.reduce((a, r) => a + inv[r], 0);
  const mood = w.colonists.length ? w.colonists.reduce((a, c) => a + moodOf(c, w.tick).mood, 0) / w.colonists.length : 0;
  daily.push({ day: w.day, alive: w.colonists.length, food, mood: Math.round(mood * 100) / 100, wealth: Math.round(Object.values(inv).reduce((a, n) => a + n, 0)) });
  if (w.colonists.length === 0) break;
}
console.log(JSON.stringify({ seed, level, days: w.day, alive: w.colonists.length, raids, research: w.research.done.length, deaths, events, daily }));

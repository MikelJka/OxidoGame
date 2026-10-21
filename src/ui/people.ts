// Gente: diario de la colonia, prisioneros, comercio con caravanas, supervivientes que piden
// unirse y fin de partida. Solo interfaz: las reglas están en src/sim/people.ts.
import { animalCargo, CREATURES, TAMING, tameDifficulty } from '../data/creatures';
import { cycleAnimalMark, packAnimals, tetherOf } from '../sim/animals';
import type { World } from '../sim/world';
import type { Colonist } from '../sim/colonist';
import { buyPrice, callAllies, callCaravan, dealBalance, nextCaravanNeeds, sellPrice, makeDeal, payTribute, radioProblem, refuseTribute, slaveValue, TRADER_MARGIN, TradeDeal } from '../sim/people';
import { healthLabel } from '../sim/health';
import { RESOURCES, RESOURCE_ICONS, RESOURCE_NAMES } from '../data/resources';
import { RESOURCE_VALUES } from '../data/values';
import { SKILLS, SKILL_NAMES } from '../data/colonists';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../sim/time';
import { START_HOUR } from '../sim/world';
import { mountAlerts } from './alerts';
import { RESEARCH, RESEARCH_BENCH, researchDef } from '../data/research';
import { BUILDINGS, buildingDef } from '../data/buildings';
import { RECIPES } from '../data/recipes';
import { canResearch, isResearched, researchFraction, unlockedBy } from '../sim/research';
import { factionDef, RADIO, RELATION, TRADER_FACTION } from '../data/factions';
import { CROPS } from '../data/crops';
import { MARKET } from '../data/market';
import { marketTrend } from '../sim/market';
import { relationLevel, RELATION_LEVEL_NAMES } from '../sim/factions';
import { baseLevel, WORLD_MAP } from '../data/worldmap';
import { colonyCell, travelDays } from '../sim/worldmap';
import { allColonies, expeditionCapacity, expeditionHours, expeditionVehicles, startExpedition, startSettling } from '../sim/expedition';
import { CARRY_PER_COLONIST, loadWeight, weightOf } from '../data/weights';
import { vehicleDef } from '../data/vehicles';
import type { ResourceId } from '../data/resources';
import { boatBuyPrice, boatDays, boatSellPrice, boatWares, startBoatTrip, tradeBoats } from '../sim/boatTrade';

export interface PeopleUI {
  /** Abre la pestaña de una persona tocada en el mapa (prisionero o comerciante). */
  openFor(c: Colonist): void;
}

interface Options {
  getWorld: () => World | null;
  toast: (text: string, ms?: number) => void;
  /** Empieza un mapa nuevo (sin preguntar: la partida ya ha terminado). */
  newGame: () => void;
  focus: (x: number, y: number) => void;
  /** Pasa a ver otra colonia (las ruinas ocupadas o la principal). */
  switchTo?: (w: World) => void;
}

type Tab = 'diario' | 'prisioneros' | 'comercio' | 'investigacion' | 'facciones';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};
const button = (text: string, onClick: () => void, title?: string): HTMLButtonElement => {
  const b = el('button', undefined, text);
  b.type = 'button';
  if (title) b.title = title;
  b.addEventListener('click', onClick);
  return b;
};
const pct = (v: number) => `${Math.round(v * 100)} %`;
const bar = (v: number, color: string): HTMLElement => {
  const b = el('div', 'bar');
  const f = el('span');
  f.style.width = `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;
  f.style.background = color;
  b.append(f);
  return b;
};
/** Las tres habilidades más altas. */
const topSkills = (c: Colonist) =>
  [...SKILLS].sort((a, b) => c.skills[b] - c.skills[a]).slice(0, 3).map((s) => `${SKILL_NAMES[s]} ${c.skills[s]}`).join(' · ');

export function mountPeople(opts: Options): PeopleUI {
  const btn = document.getElementById('people-btn') as HTMLButtonElement;
  const panel = document.getElementById('people-panel')!;
  const tabs = document.getElementById('pp-tabs')!;
  const body = document.getElementById('pp-body')!;
  const foot = document.getElementById('pp-foot')!;
  const sub = document.getElementById('pp-sub')!;
  const offer = document.getElementById('offer-panel')!;
  const over = document.getElementById('gameover')!;
  let tab: Tab = 'diario';
  /** Diario: todo, o solo lo bueno y lo malo. */
  let logFilter: 'todo' | 'importante' = 'todo';
  let lastKey = '';
  let deal: TradeDeal = { buy: {}, sell: {}, slaves: [], sellPrisoners: [] };
  let dealTrader = -1;
  let seenLog: World['log'][number] | null = null;
  let seenWorld: World | null = null;
  let offerKey = '';
  let overShown = false;

  function setOpen(open: boolean): void {
    panel.hidden = !open;
    if (open) {
      // Una sola hoja a la vez: se cierran el menú ☰ y el aviso de 🐞.
      for (const id of ['menu', 'report']) {
        const other = document.getElementById(id);
        if (other) other.hidden = true;
      }
    }
    lastKey = '';
    render();
  }
  btn.addEventListener('click', () => setOpen(Boolean(panel.hidden)));
  document.getElementById('pp-close')!.addEventListener('click', () => setOpen(false));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) setOpen(false);
  });
  // El botón 📜 se ve encendido mientras la hoja está abierta (la cierre quien la cierre).
  new MutationObserver(() => btn.classList.toggle('active', !panel.hidden)).observe(panel, { attributes: true, attributeFilter: ['hidden'] });

  function setTab(t: Tab): void {
    tab = t;
    lastKey = '';
    body.scrollTop = 0;
    render();
  }
  const rerender = () => {
    lastKey = '';
    render();
  };
  const empty = (icon: string, text: string): HTMLElement => {
    const e = el('div', 'pp-empty');
    e.append(el('span', 'mi', icon), document.createTextNode(text));
    return e;
  };

  // --- Diario ----------------------------------------------------------------------
  function renderLog(w: World): HTMLElement[] {
    const out: HTMLElement[] = [];
    const filter = el('div', 'pp-filter');
    const FILTERS: [typeof logFilter, string][] = [['todo', 'Todo'], ['importante', '❗ Solo lo importante']];
    for (const [f, label] of FILTERS) {
      const b = button(label, () => {
        logFilter = f;
        rerender();
      });
      if (f === logFilter) b.classList.add('active');
      filter.append(b);
    }
    out.push(filter);
    const entries = [...w.log].reverse().filter((l) => logFilter === 'todo' || l.kind !== 'info' || l.alert).slice(0, 120);
    if (entries.length === 0) {
      out.push(empty('📜', logFilter === 'todo' ? 'Aún no ha pasado nada digno de contar.' : 'Nada importante por ahora: aquí salen los raids, las heridas, las muertes y las buenas noticias.'));
    }
    let day = -1;
    for (const l of entries) {
      const t = l.tick + START_HOUR * TICKS_PER_HOUR;
      const d = Math.floor(t / TICKS_PER_DAY) + 1;
      if (d !== day) {
        day = d;
        out.push(el('div', 'pp-day', d === w.day ? `Hoy · día ${d}` : `Día ${d}`));
      }
      const mins = Math.floor(((t % TICKS_PER_DAY) / TICKS_PER_HOUR) * 60);
      const hh = String(Math.floor(mins / 60)).padStart(2, '0');
      const mm = String(mins % 60).padStart(2, '0');
      const row = el('div', `log-row log-${l.kind}`);
      row.append(el('span', 'log-time', `${hh}:${mm}`), el('span', 'log-text', l.text));
      const at = l.at;
      if (at) {
        const go = button('📍', () => opts.focus(at.x, at.y), 'Ir adonde pasó');
        go.className = 'log-go';
        row.append(go);
      }
      out.push(row);
    }
    if (w.graveyard.length) {
      const grave = el('details', 'pp-grave');
      grave.append(el('summary', undefined, `🪦 Cementerio (${w.graveyard.length})`));
      for (const g of w.graveyard) grave.append(el('div', 'log-row', `${g.name} · día ${g.day} · ${g.cause}`));
      out.push(grave);
    }
    return out;
  }

  // --- Investigación -----------------------------------------------------------------
  function renderResearch(w: World): HTMLElement[] {
    const r = w.research;
    const out: HTMLElement[] = [];
    const bench = buildingDef(RESEARCH_BENCH);
    if (!w.structures.all().some((s) => s.built && s.def.id === RESEARCH_BENCH)) {
      out.push(el('p', 'pp-hint', `💡 Construye un ${bench.name.toLowerCase()} (🏗 → Talleres): sin él no se investiga.`));
    } else if (!w.colonists.some((c) => c.priorities.investigar > 0)) {
      out.push(el('p', 'warn', '⚠️ Nadie tiene el trabajo Investigar: actívalo en las prioridades de algún colono.'));
    }
    const cur = r.current ? researchDef(r.current) : undefined;
    out.push(el('p', 'muted', cur
      ? `En marcha: ${cur.name} (${pct(researchFraction(r, cur.id))}). Avanza mientras alguien investiga en el banco; va más rápido con buena Investigación.`
      : 'Elige un proyecto. Lo que ya se podía construir sigue libre: no hace falta investigarlo.'));
    for (const p of RESEARCH) {
      const done = isResearched(r, p.id);
      const on = r.current === p.id;
      const open = canResearch(r, p.id);
      const card = el('div', 'pp-card');
      const head = el('div', 'pp-head');
      head.append(el('strong', undefined, `${done ? '✅' : on ? '🔬' : open ? '📘' : '🔒'} ${p.name}`), el('span', 'muted', done ? 'Hecho' : `${p.hours} h`));
      card.append(head, el('div', 'muted', `Desbloquea: ${p.unlocks}`));
      // Del árbol completo, lo que aún no está en el juego llega en otra actualización.
      const effect = p.batteryMultiplier !== undefined || p.woundHealTime !== undefined || p.infectionChance !== undefined || p.machineParts !== undefined || p.floodsTrenches || p.id === RADIO.research;
      if (!effect && !unlockedBy(BUILDINGS, p.id).length && !unlockedBy(RECIPES, p.id).length && !unlockedBy(CROPS, p.id).length) card.append(el('div', 'pp-hint', '🕒 Todavía no desbloquea nada: llegará en una próxima actualización.'));
      if (!done) {
        const f = researchFraction(r, p.id);
        if (f > 0) {
          const row = el('div', 'need');
          row.append(el('span', undefined, 'Hecho'), bar(f, '#9ab0e0'), el('span', 'num', String(Math.floor(f * 100))));
          card.append(row);
        }
        if (open) {
          const b = button(on ? '⏸ Parar' : '🔬 Investigar', () => {
            w.setResearch(on ? null : p.id);
            rerender();
          }, on ? 'Dejar de investigarlo (lo hecho se guarda)' : 'Investigar este proyecto');
          if (on) b.classList.add('active');
          card.append(b);
        } else {
          const need = p.requires.filter((q) => !isResearched(r, q)).map((q) => researchDef(q)?.name ?? q);
          card.append(el('div', 'pp-hint', `Antes hace falta: ${need.join(', ')}`));
        }
      }
      out.push(card);
    }
    return out;
  }

  // --- Facciones ---------------------------------------------------------------------
  /** Colonos elegidos para atacar una base (mientras se eligen). */
  let tradePick: { faction: string; boat: number | null; crew: number[]; goods: Partial<Record<ResourceId, number>>; want: ResourceId } | null = null;
  let attackPick: { faction: string; ids: number[]; load?: Partial<Record<ResourceId, number>>; vehicles?: number[]; animals?: number[] } | null = null;
  function renderFactions(w: World): HTMLElement[] {
    const out: HTMLElement[] = [];
    out.push(el('p', 'muted', `La relación va de ${RELATION.min} a ${RELATION.max}: con ${RELATION.war} o menos son hostiles (y os mandan sus raids), con ${RELATION.ally} o más, aliados. Sube al comerciar con sus caravanas (+${RELATION.tradeCaravan}), al darles de más en un trato (+1 cada ${RELATION.giftValuePerPoint} chapas), al curar a sus heridos y al liberar a sus prisioneros (+${RELATION.releasePrisoner}); baja al matar o retener a los suyos (${RELATION.killOrHold}). Los Piratas del Óxido son siempre hostiles.`));
    // Mapa del mundo: la colonia en el centro y la base de cada facción.
    out.push(drawWorldMap(w));
    if (w.expedition) {
      const e = w.expedition;
      const def = factionDef(e.faction);
      const where = w.faction(e.faction)?.settlement ?? def?.name ?? e.faction;
      out.push(el('p', 'pp-hint', e.phase === 'ida' ? `⚔️ Expedición de camino a ${where} (${e.members.map((c) => c.name).join(', ')}): llega en ${expeditionHours(w)} h.` : e.phase === 'vuelta' ? `🏠 La expedición vuelve de ${where}: llega en ${expeditionHours(w)} h.` : `⚔️ Batalla en ${where}.`));
    }
    for (const t of w.boatTrips) {
      const where = w.faction(t.faction)?.settlement ?? factionDef(t.faction)?.name ?? t.faction;
      const h = Math.max(0, Math.ceil((t.arriveAt - w.tick) / TICKS_PER_HOUR));
      out.push(el('p', 'pp-hint', t.phase === 'ida' ? `⛵ ${vehicleDef(t.vehicle.def)?.name} de camino a ${where} (${t.crew.map((c) => c.name).join(', ')}): llega en ${h} h.` : `⛵ ${vehicleDef(t.vehicle.def)?.name} vuelve de ${where}: llega en ${h} h.`));
    }
    // Vuestras colonias (la principal y las ruinas ocupadas): se ve y avanza solo la que está abierta.
    const colonies = allColonies(w);
    if (colonies.length > 1 && !w.battle) {
      const box = el('div', 'pp-card');
      box.append(el('strong', undefined, '🏠 Vuestras colonias'), el('div', 'muted', 'El tiempo corre en todas a la vez; tocad una para ir a verla.'));
      const row = el('div', 'pp-modes');
      for (const c of colonies) {
        const here = c.world === w;
        const b = button(`${here ? '📍 ' : ''}${c.name} · ${c.world.colonists.length} 👤`, () => {
          if (!here) opts.switchTo?.(c.world);
        }, here ? 'Estáis aquí' : `Ir a ${c.name}`);
        if (here) b.classList.add('active');
        row.append(b);
      }
      box.append(row);
      out.push(box);
    }
    // Ruinas de las bases destruidas: se pueden ocupar (mandar a vivir allí a unos colonos).
    for (const r of w.ruins) {
      const card = el('div', 'pp-card');
      card.append(el('strong', undefined, `🏚 Ruinas de ${r.name}`), el('div', 'muted', `Cayó el día ${r.day}. Se pueden ocupar: los que vayan harán allí una colonia nueva.`));
      if (!w.expedition && !w.battle) {
        if (attackPick?.faction === `ruina:${r.name}`) {
          const pick = el('div', 'pp-modes');
          for (const c of w.colonists.filter((k) => !k.downed)) {
            const on = attackPick.ids.includes(c.id);
            const btn = button(`${on ? '☑' : '☐'} ${c.name}`, () => {
              attackPick!.ids = on ? attackPick!.ids.filter((i) => i !== c.id) : [...attackPick!.ids, c.id];
              rerender();
            });
            if (on) btn.classList.add('active');
            pick.append(btn);
          }
          const go = el('div', 'zp-row');
          go.append(
            button(`🏚 Enviar (${attackPick.ids.length})`, () => {
              const why = startSettling(w, r.name, attackPick!.ids);
              opts.toast(why ?? `🏚 Salen hacia ${r.name}`, why ? 3000 : 2500);
              if (!why) attackPick = null;
              rerender();
            }),
            button('✖', () => {
              attackPick = null;
              rerender();
            }, 'Cancelar'),
          );
          card.append(el('div', 'pp-hint', '¿Quién va a vivir allí? (alguien tiene que quedarse aquí)'), pick, go);
        } else {
          card.append(button('🏚 Ocupar', () => {
            attackPick = { faction: `ruina:${r.name}`, ids: [] };
            rerender();
          }, 'Mandar colonos a vivir en las ruinas'));
        }
      }
      out.push(card);
    }
    // Radio: llamar a una caravana o pedir ayuda a los aliados.
    const radio = el('div', 'pp-card');
    radio.append(el('strong', undefined, '📻 Radio'));
    const problem = radioProblem(w);
    if (problem) radio.append(el('div', 'pp-hint', problem));
    else {
      const row = el('div', 'zp-row');
      const trader = factionDef(TRADER_FACTION);
      row.append(
        button(`🐫 Llamar a una caravana`, () => {
          const why = callCaravan(w);
          opts.toast(why ?? `📻 ${trader?.name ?? 'La caravana'} vienen de camino`, why ? 3000 : 2000);
          rerender();
        }, `Llega en unas ${RADIO.caravanHours} h; como mucho una vez cada ${RADIO.caravanEveryDays} días`),
        button('🤝 Pedir ayuda', () => {
          const why = callAllies(w);
          opts.toast(why ?? '🤝 Vuestros aliados vienen a ayudaros', why ? 3000 : 2000);
          rerender();
        }, `Solo durante un ataque y con una facción aliada (${RELATION.ally} o más)`),
      );
      radio.append(el('div', 'muted', `Una caravana llega en unas ${RADIO.caravanHours} h (como mucho una vez cada ${RADIO.caravanEveryDays} días). La ayuda, solo durante un ataque y si alguien es aliado.`), row);
    }
    out.push(radio);
    for (const f of w.factions) {
      const def = factionDef(f.id);
      if (!def) continue;
      const level = relationLevel(f.relation);
      const card = el('div', 'pp-card');
      const head = el('div', 'pp-head');
      head.append(el('strong', undefined, `${def.icon} ${def.name}`), el('span', 'muted', def.fixed ? 'Siempre hostiles' : `${RELATION_LEVEL_NAMES[level]} · ${f.relation > 0 ? '+' : ''}${f.relation}`));
      const row = el('div', 'need');
      const color = level === 'hostil' ? '#c05040' : level === 'neutral' ? '#b0a070' : '#6aa060';
      row.append(el('span', undefined, 'Relación'), bar((f.relation - RELATION.min) / (RELATION.max - RELATION.min), color), el('span', 'num', String(f.relation)));
      const b = f.base;
      const baseText = b ? `${def.icon} ${f.settlement} · ${baseLevel(b.population).name.toLowerCase()} de ${b.population} habitantes · defensas ${b.defenses} · a ${String(travelDays(b)).replace('.', ',')} días de viaje` : `Asentamiento: ${f.settlement}`;
      card.append(head, el('div', 'muted', baseText), el('div', undefined, def.description), row);
      // Atacar su base: elegir quién va y mandarlos (bases, segunda parte).
      if (b && !w.expedition && !w.battle) {
        if (attackPick?.faction === f.id) {
          const pick = el('div', 'pp-modes');
          for (const c of w.colonists.filter((k) => !k.downed)) {
            const on = attackPick.ids.includes(c.id);
            const btn = button(`${on ? '☑' : '☐'} ${c.name}`, () => {
              attackPick!.ids = on ? attackPick!.ids.filter((i) => i !== c.id) : [...attackPick!.ids, c.id];
              rerender();
            }, `Combate ${c.skills.combate}`);
            if (on) btn.classList.add('active');
            pick.append(btn);
          }
          const go = el('div', 'zp-row');
          go.append(
            button(`⚔️ Enviar (${attackPick.ids.length})`, () => {
              const why = startExpedition(w, f.id, attackPick!.ids, attackPick!.load ?? {}, attackPick!.vehicles ?? [], attackPick!.animals ?? []);
              opts.toast(why ?? `⚔️ La expedición sale hacia ${f.settlement}`, why ? 3000 : 2500);
              if (!why) attackPick = null;
              rerender();
            }, 'Salen ahora; tras los días de viaje empieza la batalla en su base'),
            button('✖', () => {
              attackPick = null;
              rerender();
            }, 'Cancelar'),
          );
          // Lo que llevan (por peso) y los vehículos.
          const ap = attackPick;
          ap.load ??= {};
          ap.vehicles ??= [];
          ap.animals ??= [];
          const cap = expeditionCapacity(w, ap.ids.length, ap.vehicles, ap.animals);
          const kg = loadWeight(ap.load);
          const cargo = el('div', 'trade-table');
          const inv = w.inventory();
          for (const r of RESOURCES) {
            if (inv[r] <= 0) continue;
            const n = ap.load[r] ?? 0;
            const step = inv[r] >= 50 ? 10 : inv[r] >= 10 ? 5 : 1;
            const row = el('div', 'trade-row');
            const qty = el('span', 'trade-qty');
            const set = (v: number) => {
              ap.load![r] = Math.max(0, Math.min(inv[r], v));
              if (!ap.load![r]) delete ap.load![r];
              rerender();
            };
            const minus = button('−', () => set(n - step), `Quitar ${step}`);
            const plus = button('+', () => set(n + step), `Añadir ${step}`);
            minus.disabled = n <= 0;
            plus.disabled = n >= inv[r];
            qty.append(minus, el('span', 'num', String(n)), plus);
            row.append(el('span', 'trade-name', `${RESOURCE_ICONS[r]} ${RESOURCE_NAMES[r]} · ${weightOf(r)} kg · tenéis ${inv[r]}`), qty);
            cargo.append(row);
          }
          const vrow = el('div', 'pp-modes');
          for (const v of expeditionVehicles(w)) {
            const on = ap.vehicles.includes(v.id);
            const d = vehicleDef(v.def)!;
            const btn = button(`${on ? '☑' : '☐'} ${d.name} (+${d.cargo} kg${d.travel ? ', viaje más corto' : ''})`, () => {
              ap.vehicles = on ? ap.vehicles!.filter((i) => i !== v.id) : [...ap.vehicles!, v.id];
              rerender();
            });
            if (on) btn.classList.add('active');
            vrow.append(btn);
          }
          for (const a of packAnimals(w)) {
            const on = ap.animals.includes(a.id);
            const btn = button(`${on ? '☑' : '☐'} ${CREATURES[a.creature!].emoji} ${a.name} (+${animalCargo(a.creature)} kg)`, () => {
              ap.animals = on ? ap.animals!.filter((i) => i !== a.id) : [...ap.animals!, a.id];
              rerender();
            });
            if (on) btn.classList.add('active');
            vrow.append(btn);
          }
          card.append(
            el('div', 'pp-hint', `¿Quién va? Llegan en ${String(travelDays(b)).replace('.', ',')} días; allí se pelea en directo. Atacarles os pone en guerra con ellos.`), pick,
            el('div', kg > cap ? 'warn' : 'pp-hint', `🎒 Carga: ${kg} de ${cap} kg (cada colono lleva ${CARRY_PER_COLONIST} kg; los vehículos, más).`),
            ...(vrow.childElementCount ? [vrow] : []), cargo, go,
          );
        } else {
          card.append(button('⚔️ Atacar su base', () => {
            attackPick = { faction: f.id, ids: [] };
            rerender();
          }, 'Elegir colonos y mandarlos a atacar'));
        }
      }
      // Comercio por barco: llevar mercancía por el río y volver con lo que se pida.
      const boats = tradeBoats(w);
      if (b && !def.fixed && level !== 'hostil' && !w.battle && boats.length) {
        if (tradePick?.faction === f.id) {
          const tp = tradePick;
          const brow = el('div', 'pp-modes');
          for (const v of boats) {
            const d = vehicleDef(v.def)!;
            const on = tp.boat === v.id;
            const btn = button(`${on ? '◉' : '○'} ${d.name} (${d.cargo} kg)`, () => {
              tp.boat = v.id;
              rerender();
            });
            if (on) btn.classList.add('active');
            brow.append(btn);
          }
          const crow = el('div', 'pp-modes');
          for (const c of w.colonists.filter((k) => !k.downed)) {
            const on = tp.crew.includes(c.id);
            const btn = button(`${on ? '☑' : '☐'} ${c.name}`, () => {
              tp.crew = on ? tp.crew.filter((i) => i !== c.id) : [...tp.crew, c.id];
              rerender();
            });
            if (on) btn.classList.add('active');
            crow.append(btn);
          }
          const cap = tp.boat !== null ? vehicleDef(boats.find((v) => v.id === tp.boat)?.def ?? '')?.cargo ?? 0 : 0;
          const kg = loadWeight(tp.goods);
          const inv = w.inventory();
          const table = el('div', 'trade-table');
          let value = 0;
          for (const r of RESOURCES) {
            if (inv[r] <= 0 || r.startsWith('kit_')) continue;
            const n = tp.goods[r] ?? 0;
            const price = boatSellPrice(w, f.id, r);
            value += n * price;
            const step = inv[r] >= 50 ? 10 : inv[r] >= 10 ? 5 : 1;
            const row = el('div', 'trade-row');
            const qty = el('span', 'trade-qty');
            const set = (x: number) => {
              tp.goods[r] = Math.max(0, Math.min(inv[r], x));
              if (!tp.goods[r]) delete tp.goods[r];
              rerender();
            };
            const minus = button('−', () => set(n - step), `Quitar ${step}`);
            const plus = button('+', () => set(n + step), `Añadir ${step}`);
            minus.disabled = n <= 0;
            plus.disabled = n >= inv[r];
            qty.append(minus, el('span', 'num', String(n)), plus);
            row.append(el('span', 'trade-name', `${RESOURCE_ICONS[r]} ${RESOURCE_NAMES[r]} · pagan ${price.toFixed(1)} · ${weightOf(r)} kg · tenéis ${inv[r]}`), qty);
            table.append(row);
          }
          const wants = el('div', 'pp-modes');
          for (const r of boatWares(f.id).slice(0, 8)) {
            const on = tp.want === r;
            const btn = button(`${on ? '◉' : '○'} ${RESOURCE_ICONS[r]} ${RESOURCE_NAMES[r]} (${boatBuyPrice(w, f.id, r).toFixed(1)})`, () => {
              tp.want = r;
              rerender();
            });
            if (on) btn.classList.add('active');
            wants.append(btn);
          }
          const bring = Math.floor(value / boatBuyPrice(w, f.id, tp.want));
          const go = el('div', 'zp-row');
          go.append(
            button(`⛵ Zarpar`, () => {
              const why = tp.boat === null ? 'Elegid un barco.' : startBoatTrip(w, tp.boat, tp.crew, f.id, tp.goods, tp.want);
              opts.toast(why ?? `⛵ El barco sale hacia ${f.settlement}`, why ? 3000 : 2500);
              if (!why) tradePick = null;
              rerender();
            }, 'Salen ahora; venden allí y vuelven con lo pedido'),
            button('✖', () => {
              tradePick = null;
              rerender();
            }, 'Cancelar'),
          );
          card.append(
            el('div', 'pp-hint', `⛵ Por el río: ${String(boatDays(w, f.id)).replace('.', ',')} días de ida y otros tantos de vuelta. Pagan más por lo que necesitan. En el río hay piratas.`),
            el('div', 'pp-hint', 'Barco:'), brow, el('div', 'pp-hint', 'Tripulación (alguien tiene que quedarse):'), crow,
            el('div', kg > cap ? 'warn' : 'pp-hint', `Carga: ${kg} de ${cap} kg · valor ${Math.round(value)} chapas`), table,
            el('div', 'pp-hint', `Traer a cambio (unos ${bring}):`), wants, go,
          );
        } else {
          card.append(button('⛵ Comerciar por barco', () => {
            tradePick = { faction: f.id, boat: boats[0].id, crew: [], goods: {}, want: boatWares(f.id)[0] };
            rerender();
          }, 'Llevar mercancía por el río a su base'));
        }
      }
      out.push(card);
    }
    return out;
  }

  /** Dibuja el mapa del mundo (cuadrícula pequeña) con la colonia y las bases. */
  function drawWorldMap(w: World): HTMLElement {
    const [cols, rows] = WORLD_MAP.size;
    const cell = 14;
    const canvas = document.createElement('canvas');
    canvas.width = cols * cell;
    canvas.height = rows * cell;
    canvas.className = 'world-map';
    canvas.style.width = '100%';
    canvas.style.maxWidth = `${cols * cell}px`;
    canvas.style.imageRendering = 'pixelated';
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#3a3226';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Terreno de fondo (solo dibujo): manchas según la semilla.
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const n = Math.sin(x * 1.7 + w.map.seed * 0.001) * Math.cos(y * 2.3 + w.map.seed * 0.002);
          ctx.fillStyle = n > 0.55 ? '#4a5a3a' : n < -0.6 ? '#2a3a4a' : (x + y) % 2 ? '#3e3528' : '#423829';
          ctx.fillRect(x * cell, y * cell, cell, cell);
        }
      }
      const home = colonyCell();
      ctx.font = `${cell - 2}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const f of w.factions) {
        if (!f.base) continue;
        ctx.strokeStyle = 'rgba(240,220,180,0.25)';
        ctx.beginPath();
        ctx.moveTo((home.x + 0.5) * cell, (home.y + 0.5) * cell);
        ctx.lineTo((f.base.x + 0.5) * cell, (f.base.y + 0.5) * cell);
        ctx.stroke();
        ctx.fillText(factionDef(f.id)?.icon ?? '?', (f.base.x + 0.5) * cell, (f.base.y + 0.5) * cell);
      }
      ctx.fillText('🏠', (home.x + 0.5) * cell, (home.y + 0.5) * cell);
    }
    const box = el('div', 'pp-card');
    box.append(el('strong', undefined, '🗺 Mapa del mundo'), canvas, el('div', 'muted', '🏠 vuestra colonia. Las bases crecen cada pocos días, y más deprisa cuanto más ricas son (comercio, tributos y raids que les salen bien).'));
    return box;
  }

  // --- Prisioneros -------------------------------------------------------------------
  function renderPrisoners(w: World): HTMLElement[] {
    const list = w.others.filter((o) => o.role === 'prisionero');
    const out: HTMLElement[] = [];
    const wardens = w.colonists.filter((c) => c.priorities.carcelero > 0);
    if (list.length === 0) {
      out.push(empty('⛓', 'No hay prisioneros. Los saqueadores que caen heridos se capturan si hay una cama de prisionero libre (lo hace quien tenga la tarea Carcelero); también se compran esclavos a las caravanas.'));
      return out;
    }
    if (wardens.length === 0) out.push(el('p', 'warn', '⚠️ Nadie tiene la tarea Carcelero: nadie les dará de comer ni hablará con ellos.'));
    if (!w.structures.all().some((s) => s.built && s.def.id === 'cama_prision')) {
      out.push(el('p', 'pp-hint', '💡 Construye una cama de prisionero (🏗 → Muebles): sin una libre no se puede capturar a nadie.'));
    }
    for (const p of list) {
      const info = p.prisoner!;
      const card = el('div', 'pp-card');
      const head = el('div', 'pp-head');
      head.append(el('strong', undefined, `${p.name} «${p.nickname}»`), el('span', 'muted', `${p.age} años`));
      head.append(button('📍', () => opts.focus(p.tile.x, p.tile.y), 'Centrar la vista en él'));
      card.append(head);
      card.append(el('div', 'muted', `${healthLabel(p)} · salud ${pct(p.health)} · ${topSkills(p)}`));
      const rows: [string, number, string][] = [
        ['Comida', p.needs.food, '#c8a040'],
        ['Agua', p.needs.water, '#5aa0c8'],
        ['Resistencia', info.resistance, '#c86a5a'],
      ];
      for (const [name, v, color] of rows) {
        const r = el('div', 'need');
        r.append(el('span', undefined, name), bar(v, color), el('span', 'num', String(Math.round(v * 100))));
        card.append(r);
      }
      const modes = el('div', 'pp-modes');
      const MODES: [typeof info.mode, string, string, string][] = [
        ['retener', '🔒', 'Retener', 'Se queda preso; el carcelero le da de comer'],
        ['convencer', '🗣', 'Convencer', 'El carcelero habla con él cada pocas horas para que se una (mejor con Trato alto y bien alimentado)'],
        ['liberar', '🕊', 'Liberar', 'Lo soltáis y se marcha'],
      ];
      for (const [m, icon, label, title] of MODES) {
        const b = button('', () => {
          info.mode = m;
          rerender();
        }, title);
        b.append(el('span', 'mi', icon), el('span', undefined, label));
        if (info.mode === m) b.classList.add('active');
        modes.append(b);
      }
      card.append(modes);
      const what = MODES.find(([m]) => m === info.mode);
      if (what) card.append(el('div', 'pp-hint', what[3]));
      if (info.mode === 'convencer') {
        const next = info.lastTalk + 6 * TICKS_PER_HOUR - w.tick;
        card.append(el('div', 'pp-hint', next > 0 ? `Próxima charla en ${Math.ceil(next / TICKS_PER_HOUR)} h` : 'Esperando a que el carcelero hable con él'));
      }
      out.push(card);
    }
    return out;
  }

  // --- Comercio --------------------------------------------------------------------
  /** Pinta el comercio en el cuerpo y deja en el pie el saldo y «Cerrar trato». */
  function renderTrade(w: World): HTMLElement[] {
    const trader = w.others.find((o) => o.role === 'comerciante' && o.trader && !o.trader.leaving);
    if (!trader) {
      const out = [empty('🐫', 'No hay ninguna caravana. Pasan de vez en cuando; cuando llegue una, tócala en el mapa o vuelve aquí.')];
      // Con «Rutas comerciales» se sabe antes qué necesitará la próxima.
      const next = isResearched(w.research, MARKET.trendResearch) ? nextCaravanNeeds(w) : null;
      if (next) out.push(el('p', 'pp-hint', `🗺 La próxima caravana (${factionDef(next.faction)?.name ?? next.faction}, hacia el día ${next.day}) necesitará: ${next.needs.map((r) => `${RESOURCE_ICONS[r]} ${RESOURCE_NAMES[r].toLowerCase()}`).join(', ')}.`));
      return out;
    }
    if (dealTrader !== trader.id) {
      dealTrader = trader.id;
      deal = { buy: {}, sell: {}, slaves: [], sellPrisoners: [] };
    }
    const t = trader.trader!;
    const inv = w.inventory();
    const out: HTMLElement[] = [];
    const hours = Math.max(0, Math.ceil((t.leaveAt - w.tick) / TICKS_PER_HOUR));
    out.push(el('p', 'pp-hint', `Caravana de ${trader.name} · se va en ${hours} h. Cobra un ${Math.round((TRADER_MARGIN - 1) * 100)} % más de lo que paga. Elige con − y + qué compras y qué vendes; el saldo sale abajo.`));
    const trends = isResearched(w.research, MARKET.trendResearch);
    const wants = (list: typeof t.needs) => (list ?? []).map((r) => `${RESOURCE_ICONS[r]} ${RESOURCE_NAMES[r].toLowerCase()}`).join(', ');
    if (t.needs?.length) out.push(el('p', 'muted', `💰 Necesita (paga un ${Math.round(MARKET.needPremium * 100)} % más): ${wants(t.needs)}.${t.surplus?.length ? ` 📦 Le sobra (un ${Math.round(MARKET.surplusDiscount * 100)} % menos): ${wants(t.surplus)}.` : ''}`));
    out.push(el('p', 'muted', trends ? 'Los precios cambian con lo que se vende y se compra; ▲ sube y ▼ baja desde ayer.' : 'Los precios cambian con lo que se vende y se compra. Con «Rutas comerciales» se ve si suben o bajan.'));
    const table = el('div', 'trade-table');
    for (const r of RESOURCES) {
      const has = t.stock[r] ?? 0;
      if (has <= 0 && inv[r] <= 0) continue;
      const step = RESOURCE_VALUES[r] >= 4 ? 1 : 5;
      const row = el('div', 'trade-row');
      if (deal.buy[r] || deal.sell[r]) row.classList.add('on');
      // Lo que necesita la caravana (+50 %) o le sobra (−30 %), y la tendencia del precio con «Rutas comerciales».
      const tags = (t.needs?.includes(r) ? ' · 💰 lo necesita' : '') + (t.surplus?.includes(r) ? ' · 📦 le sobra' : '');
      const tr = trends ? marketTrend(w.market, r) : 0;
      row.append(el('span', 'trade-name', `${RESOURCE_ICONS[r]} ${RESOURCE_NAMES[r]}${tr > 0 ? ' ▲' : tr < 0 ? ' ▼' : ''}${tags}`));
      const qty = (side: 'buy' | 'sell', max: number) => {
        const box = el('span', 'trade-qty');
        const n = deal[side][r] ?? 0;
        const set = (v: number) => {
          deal[side][r] = Math.max(0, Math.min(max, v));
          if (!deal[side][r]) delete deal[side][r];
          rerender();
        };
        const minus = button('−', () => set(n - step), `Quitar ${step}`);
        const plus = button('+', () => set(n + step), `Añadir ${step}`);
        minus.disabled = n <= 0;
        plus.disabled = n >= max;
        box.append(minus, el('span', 'num', String(n)), plus);
        return box;
      };
      const sides = el('div', 'trade-sides');
      const buyCell = el('span', 'trade-side');
      const price = (v: number) => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1).replace('.', ','));
      buyCell.append(el('strong', undefined, 'Comprar'), el('span', 'muted', `él tiene ${has} · ${price(buyPrice(w, trader, r))} c/u`), qty('buy', has));
      const sellCell = el('span', 'trade-side');
      sellCell.append(el('strong', undefined, 'Vender'), el('span', 'muted', `tenéis ${inv[r]} · ${price(sellPrice(w, trader, r))} c/u`), qty('sell', inv[r]));
      sides.append(buyCell, sellCell);
      row.append(sides);
      table.append(row);
    }
    out.push(table);
    // Mulas de carga (caravanas de los Granjeros y los Nómadas).
    if ((t.mules ?? 0) > 0) {
      out.push(el('div', 'menu-sec', '🫏 Mulas de carga'));
      const row = el('div', 'trade-row');
      const n = deal.mules ?? 0;
      const qty = el('span', 'trade-qty');
      const set = (v: number) => {
        deal.mules = Math.max(0, Math.min(t.mules ?? 0, v));
        rerender();
      };
      const minus = button('−', () => set(n - 1), 'Quitar una');
      const plus = button('+', () => set(n + 1), 'Añadir una');
      minus.disabled = n <= 0;
      plus.disabled = n >= (t.mules ?? 0);
      qty.append(minus, el('span', 'num', String(n)), plus);
      row.append(el('span', 'trade-name', `🫏 Mula · tiene ${t.mules} · ${Math.round(TAMING.mulePrice * TRADER_MARGIN)} c/u · lleva +${TAMING.cargo} kg y come cada día`), qty);
      if (n) row.classList.add('on');
      out.push(row);
    }
    if (t.slaves.length) {
      out.push(el('div', 'menu-sec', '⛓ Esclavos en venta'));
      out.push(el('p', 'pp-hint', 'Pasan a ser prisioneros; luego hay que convencerlos para que se unan.'));
      for (const s of t.slaves) {
        const on = deal.slaves.includes(s.id);
        const b = button(`${on ? '☑' : '☐'} ${s.name}, ${s.age} años · ${topSkills(s)} · ${Math.round(slaveValue(s) * TRADER_MARGIN)}`, () => {
          deal.slaves = on ? deal.slaves.filter((i) => i !== s.id) : [...deal.slaves, s.id];
          rerender();
        });
        b.classList.add('trade-person');
        if (on) b.classList.add('active');
        out.push(b);
      }
    }
    const prisoners = w.others.filter((o) => o.role === 'prisionero');
    if (prisoners.length) {
      out.push(el('div', 'menu-sec', 'Vender prisioneros'));
      for (const p of prisoners) {
        const on = deal.sellPrisoners.includes(p.id);
        const b = button(`${on ? '☑' : '☐'} ${p.name} · ${Math.round(slaveValue(p) * 0.6)}`, () => {
          deal.sellPrisoners = on ? deal.sellPrisoners.filter((i) => i !== p.id) : [...deal.sellPrisoners, p.id];
          rerender();
        });
        b.classList.add('trade-person');
        if (on) b.classList.add('active');
        out.push(b);
      }
    }
    // Pie fijo: el saldo y el botón siempre a la vista, aunque la lista sea larga.
    const balance = dealBalance(w, trader, deal);
    const none = !Object.keys(deal.buy).length && !Object.keys(deal.sell).length && !deal.slaves.length && !deal.sellPrisoners.length && !deal.mules;
    const info = el('div', none ? 'trade-balance' : balance >= 0 ? 'trade-balance ok' : 'trade-balance bad',
      none ? 'Elige qué comprar o vender' : `Saldo ${balance >= 0 ? '+' : ''}${Math.round(balance)} · ${balance >= 0 ? 'acepta' : 'no le compensa'}`);
    const clear = button('↺', () => {
      deal = { buy: {}, sell: {}, slaves: [], sellPrisoners: [] };
      rerender();
    }, 'Vaciar el trato');
    clear.disabled = none;
    const go = button('🤝 Cerrar trato', () => {
      const why = makeDeal(w, trader, deal);
      if (why) {
        opts.toast(`🐫 ${why}`, 2500);
        return;
      }
      opts.toast('🤝 Trato hecho: lo comprado está en el suelo junto a la caravana', 3000);
      deal = { buy: {}, sell: {}, slaves: [], sellPrisoners: [] };
      rerender();
    });
    go.disabled = none || balance < 0;
    foot.replaceChildren(info, clear, go);
    foot.hidden = false;
    return out;
  }

  // --- Pintado ---------------------------------------------------------------------
  function render(): void {
    const w = opts.getWorld();
    if (!w || panel.hidden) return;
    const prisoners = w.others.filter((o) => o.role === 'prisionero');
    const trader = w.others.some((o) => o.role === 'comerciante' && !o.trader?.leaving);
    // Se repinta solo si cambia algo que se ve (para no perder toques a medias).
    const key = [
      tab, logFilter, w.research.current, w.log.length, w.log[w.log.length - 1]?.tick, trader, w.colonists.length, w.day,
      prisoners.map((p) => `${p.id}:${p.prisoner!.mode}:${Math.round(p.prisoner!.resistance * 100)}:${Math.round(p.needs.food * 20)}:${Math.round(p.needs.water * 20)}:${Math.round(p.health * 20)}`).join(','),
      tab === 'comercio' ? `${JSON.stringify(w.inventory())}:${Math.floor(w.tick / TICKS_PER_HOUR)}` : '',
      tab === 'facciones' ? `${allColonies(w).map((c) => c.world.colonists.length).join('/')}:${JSON.stringify(attackPick)}:${w.expedition?.phase ?? ''}:${expeditionHours(w)}:${w.ruins.length}:${w.colonists.length}:${w.factions.map((f) => `${f.relation}:${f.calledAt ?? ''}:${f.helpAt ?? ''}:${f.base?.population ?? ''}:${f.base?.defenses ?? ''}`).join(',')}:${radioProblem(w) ?? ''}` : '',
      tab === 'investigacion' ? `${w.research.current}:${w.research.done.join(',')}:${w.research.current ? Math.floor(researchFraction(w.research, w.research.current) * 100) : ''}:${w.structures.stations().length}:${w.colonists.map((c) => c.priorities.investigar).join('')}` : '',
    ].join('|');
    if (key === lastKey) return;
    lastKey = key;
    sub.textContent = `Día ${w.day} · ${w.colonists.length} ${w.colonists.length === 1 ? 'colono' : 'colonos'}`;
    const TABS: [Tab, string, string, number | string][] = [
      ['diario', '📜', 'Diario', ''],
      ['prisioneros', '⛓', 'Prisioneros', prisoners.length || ''],
      ['comercio', '🐫', 'Comercio', trader ? '!' : ''],
      ['investigacion', '🔬', 'Investigación', w.research.current ? '' : w.structures.stations().some((s) => s.def.id === RESEARCH_BENCH) ? '!' : ''],
      ['facciones', '🏳', 'Facciones', ''],
    ];
    tabs.replaceChildren(...TABS.map(([t, icon, label, badge]) => {
      const b = button('', () => setTab(t), label);
      b.append(el('span', 'tab-icon', icon), el('span', 'tab-label', label));
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(t === tab));
      if (badge !== '') b.append(el('span', 'badge', String(badge)));
      if (t === tab) b.classList.add('active');
      return b;
    }));
    foot.hidden = true;
    body.replaceChildren(...(tab === 'diario' ? renderLog(w) : tab === 'prisioneros' ? renderPrisoners(w) : tab === 'investigacion' ? renderResearch(w) : tab === 'facciones' ? renderFactions(w) : renderTrade(w)));
  }

  // --- Superviviente que pide unirse ---------------------------------------------------
  function renderOffer(w: World): void {
    // El tributo de una facción va antes que el superviviente que pide unirse.
    const t = w.tribute;
    if (t) {
      const tkey = `tributo:${t.until}`;
      if (tkey === offerKey) return;
      offerKey = tkey;
      offer.hidden = false;
      const def = factionDef(t.faction);
      const list = (Object.entries(t.demand) as [keyof typeof RESOURCE_ICONS, number][]).map(([r, n]) => `${n} ${RESOURCE_ICONS[r]} ${RESOURCE_NAMES[r].toLowerCase()}`).join(', ');
      const row = el('div', 'zp-row');
      row.append(
        button('💰 Pagar', () => {
          if (payTribute(w)) opts.toast('💰 Tributo pagado: esta vez no atacan');
          else opts.toast('No tenéis todo lo que piden', 2500);
        }),
        button('✖ Negarse', () => {
          refuseTribute(w);
          opts.toast(`⚔️ Os negáis: ${def?.name ?? 'ellos'} atacan`);
        }),
      );
      offer.replaceChildren(
        el('div', 'offer-title', `${def?.icon ?? '☠'} ${def?.name ?? t.faction} piden tributo`),
        el('div', undefined, list),
        el('div', 'muted', `Unas ${t.value} chapas. Si pagáis, no atacan esta vez; si os negáis (o no contestáis en unas horas), llega su raid y la relación baja ${-RELATION.refuseTribute}.`),
        row,
      );
      return;
    }
    const o = w.offer;
    const key = o ? `${o.pawn.id}` : '';
    if (key === offerKey) return;
    offerKey = key;
    offer.hidden = !o;
    if (!o) return;
    const c = o.pawn;
    offer.replaceChildren(
      el('div', 'offer-title', o.kind === 'refugiado' ? '🩹 Un refugiado herido pide ayuda' : '🚶 Alguien pide unirse'),
      el('div', undefined, `${c.name} «${c.nickname}», ${c.age} años`),
      el('div', 'muted', topSkills(c)),
      el('div', 'muted', c.traits.map((t) => t.name).join(' · ') || 'Sin rasgos destacables'),
      (() => {
        const row = el('div', 'zp-row');
        row.append(
          button('✔ Aceptar', () => {
            w.acceptOffer();
            opts.toast(`🙂 ${c.name} se une a la colonia`);
          }),
          button('✖ Rechazar', () => w.rejectOffer()),
        );
        return row;
      })(),
    );
  }

  // --- Fin de la partida ---------------------------------------------------------------
  function renderGameOver(w: World): void {
    if (!w.gameOver) {
      over.hidden = true;
      overShown = false;
      return;
    }
    if (overShown) return;
    overShown = true;
    w.speed = 0;
    over.hidden = false;
    over.replaceChildren(
      el('div', 'offer-title', '☠ La colonia ha caído'),
      el('div', undefined, `Día ${w.gameOver.day}: no queda nadie en pie.`),
      ...w.graveyard.slice(-8).map((g) => el('div', 'muted', `🪦 ${g.name} · día ${g.day} · ${g.cause}`)),
      button('Empezar un mapa nuevo', () => opts.newGame()),
    );
  }

  // --- Avisos del diario --------------------------------------------------------------
  // Los avisos (raids, peleas, heridos, visitas…) se apilan arriba y se quedan unos segundos;
  // lo demás importante sale como antes, en el aviso corto del centro.
  const alerts = mountAlerts({
    focus: (x, y) => opts.focus(x, y),
    openLog: () => {
      tab = 'diario';
      body.scrollTop = 0;
      setOpen(true);
    },
  });
  function announce(w: World): void {
    if (seenWorld !== w) {
      // Partida nueva o cargada: lo antiguo no se anuncia.
      seenWorld = w;
      seenLog = w.log[w.log.length - 1] ?? null;
      alerts.clear();
      return;
    }
    const last = w.log[w.log.length - 1];
    if (!last || last === seenLog) return;
    // Si lo último visto ya salió del diario (guarda 200), se sigue desde su hora.
    const seen = seenLog;
    const idx = seen ? w.log.lastIndexOf(seen) : -1;
    const from = !seen ? 0 : idx >= 0 ? idx + 1 : w.log.findIndex((l) => l.tick > seen.tick);
    seenLog = last;
    const fresh = from < 0 ? [] : w.log.slice(from);
    for (const l of fresh) if (l.alert) alerts.push(l);
    const rest = fresh.filter((l) => !l.alert);
    const important = rest.filter((l) => l.kind !== 'info');
    const shown = important[important.length - 1] ?? (fresh.some((l) => l.alert) ? undefined : rest[rest.length - 1]);
    if (shown) opts.toast(shown.text, shown.kind === 'malo' ? 4500 : 3000);
    btn.classList.toggle('alert', fresh.some((l) => l.kind === 'malo'));
  }

  window.setInterval(() => {
    const w = opts.getWorld();
    if (!w) return;
    announce(w);
    renderOffer(w);
    renderGameOver(w);
    render();
  }, 400);
  btn.addEventListener('click', () => btn.classList.remove('alert'));

  return {
    openFor(c: Colonist): void {
      // Un animal: al tocarlo se marca (o desmarca) para cazarlo.
      if (c.creature && CREATURES[c.creature].animal && c.role === 'animal') {
        const d = CREATURES[c.creature];
        if (c.tamed) {
          opts.toast(`${d.emoji} ${c.name} de carga · ${healthLabel(c).toLowerCase()} · lleva +${animalCargo(c.creature)} kg en las expediciones y come cada día${tetherNote(opts.getWorld(), c)}`, 3000);
          return;
        }
        const mark = cycleAnimalMark(c);
        opts.toast(`${d.emoji} ${c.name} · ${mark === 'cazar' ? `🎯 a cazar: irá quien tenga «Cazar»${d.tamable ? ' (tócalo otra vez para domarlo)' : ''}` : mark === 'domar' ? `🤝 a domar (${tameDifficulty(c.creature)}, carga ${animalCargo(c.creature)} kg): irá quien tenga «Cazar», con comida (mejor con Supervivencia)` : 'sin marca'}`, 3000);
        return;
      }
      if (c.creature) {
        opts.toast(`${CREATURES[c.creature].emoji} ${c.name} · ${healthLabel(c).toLowerCase()}${c.raider?.fleeing ? ' · huye' : ''}`, 2500);
        return;
      }
      if (c.role === 'saqueador') {
        opts.toast(`⚔️ ${c.name} (saqueador${c.raider?.leader ? ', líder del raid ★' : ''}) · ${healthLabel(c).toLowerCase()} · combate ${c.skills.combate}${c.downed ? (c.raider?.finish ? ' · un carcelero lo rematará' : ' · un carcelero lo capturará') : ''}`, 2500);
        return;
      }
      if (c.role === 'aliado') {
        const f = c.faction ? factionDef(c.faction) : undefined;
        opts.toast(`🤝 ${c.name} (aliado${f ? `, de ${f.name}` : ''}) · ${healthLabel(c).toLowerCase()} · combate ${c.skills.combate}`, 2500);
        return;
      }
      tab = c.role === 'comerciante' ? 'comercio' : c.role === 'prisionero' ? 'prisioneros' : 'diario';
      body.scrollTop = 0;
      setOpen(true);
    },
  };
}

/** Dónde está atado un animal de carga, para el aviso al tocarlo. */
function tetherNote(w: World | null, c: Colonist): string {
  const t = w ? tetherOf(w, c) : undefined;
  if (!t) return ' · suelto (con un poste con cuerda o un establo en «Granja» no se aleja)';
  return t.sleep ? ' · duerme en el establo y come la mitad' : ' · atado a un poste';
}

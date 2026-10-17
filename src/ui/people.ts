// Gente: diario de la colonia, prisioneros, comercio con caravanas, supervivientes que piden
// unirse y fin de partida. Solo interfaz: las reglas están en src/sim/people.ts.
import type { World } from '../sim/world';
import type { Colonist } from '../sim/colonist';
import { dealBalance, makeDeal, slaveValue, TRADER_MARGIN, TradeDeal } from '../sim/people';
import { healthLabel } from '../sim/health';
import { RESOURCES, RESOURCE_ICONS, RESOURCE_NAMES } from '../data/resources';
import { RESOURCE_VALUES } from '../data/values';
import { SKILLS, SKILL_NAMES } from '../data/colonists';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../sim/time';

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
}

type Tab = 'diario' | 'prisioneros' | 'comercio';

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
  const offer = document.getElementById('offer-panel')!;
  const over = document.getElementById('gameover')!;
  let tab: Tab = 'diario';
  let lastKey = '';
  let deal: TradeDeal = { buy: {}, sell: {}, slaves: [], sellPrisoners: [] };
  let dealTrader = -1;
  let seenLog: World['log'][number] | null = null;
  let seenWorld: World | null = null;
  let offerKey = '';
  let overShown = false;

  btn.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    lastKey = '';
    render();
  });
  document.getElementById('pp-close')!.addEventListener('click', () => (panel.hidden = true));

  function setTab(t: Tab): void {
    tab = t;
    lastKey = '';
    render();
  }

  // --- Diario ----------------------------------------------------------------------
  function renderLog(w: World): HTMLElement[] {
    if (w.log.length === 0) return [el('p', 'muted', 'Aún no ha pasado nada digno de contar.')];
    const out: HTMLElement[] = [];
    for (const l of [...w.log].reverse().slice(0, 80)) {
      const row = el('div', `log-row log-${l.kind}`);
      const day = Math.floor(l.tick / TICKS_PER_DAY) + 1;
      row.append(el('span', 'muted', `D${day} `), document.createTextNode(l.text));
      out.push(row);
    }
    if (w.graveyard.length) {
      out.push(el('div', 'zp-label', '🪦 Cementerio'));
      for (const g of w.graveyard) out.push(el('div', 'log-row', `${g.name} · día ${g.day} · ${g.cause}`));
    }
    return out;
  }

  // --- Prisioneros -------------------------------------------------------------------
  function renderPrisoners(w: World): HTMLElement[] {
    const list = w.others.filter((o) => o.role === 'prisionero');
    const out: HTMLElement[] = [];
    const wardens = w.colonists.filter((c) => c.priorities.carcelero > 0);
    if (list.length === 0) {
      out.push(el('p', 'muted', 'No hay prisioneros. Los saqueadores que caen heridos se pueden capturar (lo hace quien tenga la tarea Carcelero); también se compran esclavos a las caravanas.'));
      return out;
    }
    if (wardens.length === 0) out.push(el('p', 'warn', '⚠️ Nadie tiene la tarea Carcelero: nadie les dará de comer ni hablará con ellos.'));
    if (!w.structures.all().some((s) => s.built && s.def.id === 'cama_prision')) {
      out.push(el('p', 'muted', 'Consejo: construye una cama de prisionero (🏗 → Muebles); los capturados se llevan allí.'));
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
      const modes = el('div', 'zp-row');
      const MODES: [typeof info.mode, string, string][] = [
        ['retener', '🔒 Retener', 'Se queda preso; el carcelero le da de comer'],
        ['convencer', '🗣 Convencer', 'El carcelero habla con él cada pocas horas para que se una (mejor con Trato alto y bien alimentado)'],
        ['liberar', '🕊 Liberar', 'Lo soltáis y se marcha'],
      ];
      for (const [m, label, title] of MODES) {
        const b = button(label, () => {
          info.mode = m;
          lastKey = '';
          render();
        }, title);
        if (info.mode === m) b.classList.add('active');
        modes.append(b);
      }
      card.append(modes);
      if (info.mode === 'convencer') {
        const next = info.lastTalk + 6 * TICKS_PER_HOUR - w.tick;
        card.append(el('div', 'muted', next > 0 ? `Próxima charla en ${Math.ceil(next / TICKS_PER_HOUR)} h` : 'Esperando a que el carcelero hable con él'));
      }
      out.push(card);
    }
    return out;
  }

  // --- Comercio --------------------------------------------------------------------
  function renderTrade(w: World): HTMLElement[] {
    const trader = w.others.find((o) => o.role === 'comerciante' && o.trader && !o.trader.leaving);
    if (!trader) return [el('p', 'muted', 'No hay ninguna caravana. Pasan de vez en cuando; cuando llegue una, tócala en el mapa o vuelve aquí.')];
    if (dealTrader !== trader.id) {
      dealTrader = trader.id;
      deal = { buy: {}, sell: {}, slaves: [], sellPrisoners: [] };
    }
    const t = trader.trader!;
    const inv = w.inventory();
    const out: HTMLElement[] = [];
    const hours = Math.max(0, Math.ceil((t.leaveAt - w.tick) / TICKS_PER_HOUR));
    out.push(el('div', 'muted', `Caravana de ${trader.name} · se va en ${hours} h · cobra un ${Math.round((TRADER_MARGIN - 1) * 100)} % más de lo que paga`));
    const table = el('div', 'trade-table');
    for (const r of RESOURCES) {
      const has = t.stock[r] ?? 0;
      if (has <= 0 && inv[r] <= 0) continue;
      const step = RESOURCE_VALUES[r] >= 4 ? 1 : 5;
      const row = el('div', 'trade-row');
      row.append(el('span', 'trade-name', `${RESOURCE_ICONS[r]} ${RESOURCE_NAMES[r]}`));
      const qty = (side: 'buy' | 'sell', max: number) => {
        const box = el('span', 'trade-qty');
        const n = deal[side][r] ?? 0;
        const set = (v: number) => {
          deal[side][r] = Math.max(0, Math.min(max, v));
          if (!deal[side][r]) delete deal[side][r];
          lastKey = '';
          render();
        };
        box.append(button('−', () => set(n - step)), el('span', 'num', String(n)), button('+', () => set(n + step)));
        return box;
      };
      const buyCell = el('span', 'trade-side');
      buyCell.append(el('span', 'muted', `él ${has} · ${(RESOURCE_VALUES[r] * TRADER_MARGIN).toFixed(1)}`), qty('buy', has));
      const sellCell = el('span', 'trade-side');
      sellCell.append(el('span', 'muted', `tenéis ${inv[r]} · ${RESOURCE_VALUES[r]}`), qty('sell', inv[r]));
      row.append(buyCell, sellCell);
      table.append(row);
    }
    const legend = el('div', 'trade-row trade-legend');
    legend.append(el('span'), el('span', 'muted', 'Comprar (precio)'), el('span', 'muted', 'Vender (precio)'));
    out.push(legend, table);
    if (t.slaves.length) {
      out.push(el('div', 'zp-label', '⛓ Esclavos en venta (pasan a ser prisioneros para convencer)'));
      for (const s of t.slaves) {
        const on = deal.slaves.includes(s.id);
        const b = button(`${on ? '☑' : '☐'} ${s.name}, ${s.age} años · ${topSkills(s)} · ${Math.round(slaveValue(s) * TRADER_MARGIN)}`, () => {
          deal.slaves = on ? deal.slaves.filter((i) => i !== s.id) : [...deal.slaves, s.id];
          lastKey = '';
          render();
        });
        b.className = 'trade-person';
        out.push(b);
      }
    }
    const prisoners = w.others.filter((o) => o.role === 'prisionero');
    if (prisoners.length) {
      out.push(el('div', 'zp-label', 'Vender prisioneros'));
      for (const p of prisoners) {
        const on = deal.sellPrisoners.includes(p.id);
        const b = button(`${on ? '☑' : '☐'} ${p.name} · ${Math.round(slaveValue(p) * 0.6)}`, () => {
          deal.sellPrisoners = on ? deal.sellPrisoners.filter((i) => i !== p.id) : [...deal.sellPrisoners, p.id];
          lastKey = '';
          render();
        });
        b.className = 'trade-person';
        out.push(b);
      }
    }
    const balance = dealBalance(w, trader, deal);
    const empty = !Object.keys(deal.buy).length && !Object.keys(deal.sell).length && !deal.slaves.length && !deal.sellPrisoners.length;
    out.push(el('div', balance >= 0 ? 'trade-balance ok' : 'trade-balance bad', `Saldo: ${balance >= 0 ? '+' : ''}${Math.round(balance)} ${balance >= 0 ? '(acepta)' : '(no le compensa)'}`));
    const go = button('🤝 Cerrar trato', () => {
      const why = makeDeal(w, trader, deal);
      if (why) {
        opts.toast(`🐫 ${why}`, 2500);
        return;
      }
      opts.toast('🤝 Trato hecho: lo comprado está en el suelo junto a la caravana', 3000);
      deal = { buy: {}, sell: {}, slaves: [], sellPrisoners: [] };
      lastKey = '';
      render();
    });
    go.disabled = empty || balance < 0;
    out.push(go);
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
      tab, w.log.length, w.log[w.log.length - 1]?.tick, trader,
      prisoners.map((p) => `${p.id}:${p.prisoner!.mode}:${Math.round(p.prisoner!.resistance * 100)}:${Math.round(p.needs.food * 20)}:${Math.round(p.needs.water * 20)}:${Math.round(p.health * 20)}`).join(','),
      tab === 'comercio' ? `${JSON.stringify(w.inventory())}:${Math.floor(w.tick / TICKS_PER_HOUR)}` : '',
    ].join('|');
    if (key === lastKey) return;
    lastKey = key;
    const TABS: [Tab, string][] = [
      ['diario', '📜 Diario'],
      ['prisioneros', `⛓ Prisioneros${prisoners.length ? ` (${prisoners.length})` : ''}`],
      ['comercio', `🐫 Comercio${trader ? ' •' : ''}`],
    ];
    tabs.replaceChildren(...TABS.map(([t, label]) => {
      const b = button(label, () => setTab(t));
      if (t === tab) b.classList.add('active');
      return b;
    }));
    body.replaceChildren(...(tab === 'diario' ? renderLog(w) : tab === 'prisioneros' ? renderPrisoners(w) : renderTrade(w)));
  }

  // --- Superviviente que pide unirse ---------------------------------------------------
  function renderOffer(w: World): void {
    const o = w.offer;
    const key = o ? `${o.pawn.id}` : '';
    if (key === offerKey) return;
    offerKey = key;
    offer.hidden = !o;
    if (!o) return;
    const c = o.pawn;
    offer.replaceChildren(
      el('div', 'offer-title', '🚶 Alguien pide unirse'),
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
  function announce(w: World): void {
    if (seenWorld !== w) {
      // Partida nueva o cargada: lo antiguo no se anuncia.
      seenWorld = w;
      seenLog = w.log[w.log.length - 1] ?? null;
      return;
    }
    const last = w.log[w.log.length - 1];
    if (!last || last === seenLog) return;
    const from = seenLog ? w.log.indexOf(seenLog) + 1 : 0;
    seenLog = last;
    const fresh = w.log.slice(Math.max(0, from));
    const important = fresh.filter((l) => l.kind !== 'info' || /Raid|caravana|pide unirse/.test(l.text));
    const shown = important[important.length - 1] ?? fresh[fresh.length - 1];
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
      if (c.role === 'saqueador') {
        opts.toast(`⚔️ ${c.name} (saqueador) · ${healthLabel(c).toLowerCase()} · combate ${c.skills.combate}${c.downed ? ' · un carcelero lo capturará' : ''}`, 2500);
        return;
      }
      panel.hidden = false;
      setTab(c.role === 'comerciante' ? 'comercio' : c.role === 'prisionero' ? 'prisioneros' : 'diario');
    },
  };
}

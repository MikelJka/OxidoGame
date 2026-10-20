// Panel 🪄 del modo Dios: herramientas para probar la partida. Las acciones están en src/sim/god.ts.
import type { World } from '../sim/world';
import type { Colonist, PawnRole } from '../sim/colonist';
import {
  godClear, godDrop, godFinishWork, godGrowAll, godHealAll, godKill, godSkip, godSpawn, godWound, pawnNear,
} from '../sim/god';
import { offerWanderer, startMachines, startPack, startRaid, startTrader } from '../sim/people';
import { RESOURCES, RESOURCE_ICONS, RESOURCE_NAMES, ResourceId } from '../data/resources';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../sim/time';

type Tool =
  | { kind: 'recurso' }
  | { kind: 'persona'; role: PawnRole }
  | { kind: 'matar' }
  | { kind: 'herir' }
  | { kind: 'despejar' };

interface Options {
  getWorld: () => World | null;
  /** Instala (o quita) lo que pasa al tocar el mapa. */
  setTap: (fn: ((tile: { x: number; y: number }, hit: Colonist | undefined) => boolean) | null) => void;
  toast: (text: string, ms?: number) => void;
}

export interface GodPanel {
  setEnabled(on: boolean): void;
}

export function mountGodMode(opts: Options): GodPanel {
  const btn = document.getElementById('god-btn') as HTMLButtonElement;
  const panel = document.getElementById('god-panel')!;
  const tools = document.getElementById('gp-tools')!;
  const actions = document.getElementById('gp-actions')!;
  const resSel = document.getElementById('gp-resource') as HTMLSelectElement;
  const amount = document.getElementById('gp-amount') as HTMLSelectElement;
  const hint = document.getElementById('gp-hint')!;
  let tool: Tool | null = null;

  for (const r of RESOURCES) {
    const o = document.createElement('option');
    o.value = r;
    o.textContent = `${RESOURCE_ICONS[r]} ${RESOURCE_NAMES[r]}`;
    resSel.append(o);
  }

  const TOOLS: [string, Tool, string][] = [
    ['📦 Recurso', { kind: 'recurso' }, 'Toca el suelo para dejar el recurso elegido'],
    ['🧑 Colono', { kind: 'persona', role: 'colono' }, 'Toca el suelo: aparece un colono'],
    ['⚔️ Saqueador', { kind: 'persona', role: 'saqueador' }, 'Toca el suelo: aparece un saqueador hostil'],
    ['⛓ Prisionero', { kind: 'persona', role: 'prisionero' }, 'Toca el suelo: aparece un prisionero'],
    ['🐫 Comerciante', { kind: 'persona', role: 'comerciante' }, 'Toca el suelo: llega una caravana ahí'],
    ['🩸 Herir', { kind: 'herir' }, 'Toca a alguien: cae herido'],
    ['💀 Matar', { kind: 'matar' }, 'Toca a alguien: muere'],
    ['🧹 Despejar', { kind: 'despejar' }, 'Toca un árbol, roca o restos: desaparece'],
  ];

  const same = (a: Tool | null, b: Tool) => !!a && a.kind === b.kind && (a.kind !== 'persona' || (b.kind === 'persona' && a.role === b.role));

  function renderTools(): void {
    tools.replaceChildren(
      ...TOOLS.map(([label, t, help]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.title = help;
        b.classList.toggle('active', same(tool, t));
        b.addEventListener('click', () => setTool(same(tool, t) ? null : t, help));
        return b;
      }),
    );
  }

  function setTool(t: Tool | null, help = ''): void {
    tool = t;
    hint.textContent = t ? `${help}. Toca otra vez la herramienta para dejarla.` : 'Elige una herramienta y toca el mapa, o usa los atajos.';
    opts.setTap(t ? apply : null);
    btn.classList.toggle('active', !!t);
    renderTools();
    // En el móvil el panel tapa el mapa: se recoge y el 🪄 (resaltado) lo vuelve a abrir.
    if (t && window.innerWidth < 700) {
      panel.hidden = true;
      opts.toast(`🪄 ${help}. Toca 🪄 para volver al panel.`, 2500);
    }
  }

  function apply(tile: { x: number; y: number }, hit: Colonist | undefined): boolean {
    const w = opts.getWorld();
    if (!w || !tool) return false;
    switch (tool.kind) {
      case 'recurso': {
        const r = resSel.value as ResourceId;
        godDrop(w, tile.x, tile.y, r, Number(amount.value));
        opts.toast(`🪄 +${amount.value} ${RESOURCE_NAMES[r].toLowerCase()}`);
        return true;
      }
      case 'persona': {
        const c = godSpawn(w, tool.role, tile.x, tile.y);
        opts.toast(c ? `🪄 Aparece ${c.name}` : '🪄 No se ha podido');
        return true;
      }
      case 'herir':
      case 'matar': {
        const c = hit ?? pawnNear(w, tile.x, tile.y);
        if (!c) {
          opts.toast('🪄 Ahí no hay nadie');
          return true;
        }
        if (tool.kind === 'matar') godKill(w, c);
        else godWound(c);
        return true;
      }
      case 'despejar':
        if (!godClear(w, tile.x, tile.y)) opts.toast('🪄 No hay nada que quitar');
        return true;
    }
  }

  const ACTIONS: [string, string, (w: World) => string | void][] = [
    ['⚔️ Raid', 'Llega un raid de 3 saqueadores', (w) => void startRaid(w, 3)],
    ['🚙 Raid en buggy', 'Llega un raid de 4 saqueadores, dos en su buggy', (w) => void startRaid(w, 4, true)],
    ['🐕 Manada', 'Llega una manada de 5 perros mutantes', (w) => void startPack(w, 5, 0)],
    ['👹 Manada con brutos', 'Llega una manada de 6 perros y 2 brutos mutantes, que rompen muros y puertas', (w) => void startPack(w, 6, 2)],
    ['🕷️ Máquinas', 'Llega un ataque de máquinas: 2 arañas de chatarra, blindadas y que rompen muros, y 3 drones de vigilancia, que vuelan y disparan', (w) => void startMachines(w, 2, 3)],
    ['🐫 Caravana', 'Llega una caravana', (w) => void startTrader(w)],
    ['🚶 Superviviente', 'Alguien pide unirse', (w) => {
      if (w.offer) return 'Ya hay alguien esperando respuesta';
      offerWanderer(w);
    }],
    ['🏗 Terminar obras', 'Todos los planos, demoliciones y obras de terreno, hechos al momento', (w) => `${godFinishWork(w)} obras terminadas`],
    ['❤ Curar y saciar', 'Todos sanos, comidos, bebidos y descansados', (w) => {
      godHealAll(w);
      return 'Todos como nuevos';
    }],
    ['🌾 Madurar', 'Todos los cultivos listos para cosechar', (w) => {
      godGrowAll(w);
      return 'Cultivos maduros';
    }],
    ['⏩ +1 h', 'Avanza una hora', (w) => godSkip(w, TICKS_PER_HOUR)],
    ['⏩ +6 h', 'Avanza seis horas (tarda un momento)', (w) => godSkip(w, TICKS_PER_HOUR * 6)],
    ['⏩ +1 día', 'Avanza un día (tarda unos segundos)', (w) => godSkip(w, TICKS_PER_DAY)],
    ['🎲 Sucesos', 'Activar o quitar raids, caravanas y supervivientes', (w) => {
      w.eventsEnabled = !w.eventsEnabled;
      return w.eventsEnabled ? 'Sucesos activados' : 'Sucesos desactivados';
    }],
    ['🍞 Necesidades', 'Activar o quitar hambre, sed y sueño', (w) => {
      w.needsEnabled = !w.needsEnabled;
      return w.needsEnabled ? 'Necesidades activadas' : 'Necesidades desactivadas (no pasan hambre, sed ni sueño)';
    }],
  ];
  actions.replaceChildren(
    ...ACTIONS.map(([label, title, run]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.title = title;
      b.addEventListener('click', () => {
        const w = opts.getWorld();
        if (!w) return;
        const msg = run(w);
        opts.toast(`🪄 ${msg ?? title}`);
      });
      return b;
    }),
  );

  btn.addEventListener('click', () => {
    // Con una herramienta en uso y el panel recogido, el 🪄 solo vuelve a abrirlo.
    if (panel.hidden) {
      panel.hidden = false;
      return;
    }
    panel.hidden = true;
    setTool(null);
  });
  document.getElementById('gp-close')!.addEventListener('click', () => {
    panel.hidden = true;
    setTool(null);
  });
  setTool(null);

  return {
    setEnabled(on: boolean): void {
      btn.hidden = !on;
      if (!on) {
        panel.hidden = true;
        setTool(null);
      }
    },
  };
}

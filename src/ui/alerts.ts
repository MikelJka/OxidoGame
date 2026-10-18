// Avisos en pantalla (#17, #18): raids, peleas, heridos, caídos, muertes, pánico, visitas y
// caravanas. Se apilan arriba, se quedan unos segundos (los graves, más) y al tocarlos la cámara
// va adonde ha pasado. Solo interfaz: qué es un aviso lo decide la simulación (LogEntry.alert).
import type { AlertKind, LogEntry } from '../sim/world';

/** Segundos que se queda cada aviso en pantalla. */
const STAY_SECONDS: Record<AlertKind, number> = {
  raid: 20,
  caido: 20,
  muerte: 20,
  combate: 12,
  herido: 12,
  panico: 12,
  visita: 12,
  caravana: 12,
};
/** Como mucho, estos avisos a la vez (se quitan los más viejos). */
const MAX_SHOWN = 4;

export interface AlertStack {
  push(entry: LogEntry): void;
  clear(): void;
}

export function mountAlerts(opts: { focus: (x: number, y: number) => void; openLog: () => void }): AlertStack {
  const box = document.createElement('div');
  box.id = 'alerts';
  box.setAttribute('aria-live', 'polite');
  document.body.append(box);

  function remove(card: HTMLElement): void {
    window.clearTimeout(Number(card.dataset.timer));
    card.remove();
  }

  return {
    push(entry: LogEntry): void {
      if (!entry.alert) return;
      const card = document.createElement('div');
      card.className = `alert-card panel alert-${entry.kind} alert-k-${entry.alert}`;
      card.setAttribute('role', 'button');
      card.title = entry.at ? 'Toca para ir allí' : 'Toca para abrir el diario';
      const text = document.createElement('span');
      text.className = 'alert-text';
      text.textContent = entry.text + (entry.at ? ' 📍' : '');
      const close = document.createElement('button');
      close.type = 'button';
      close.textContent = '✕';
      close.title = 'Quitar el aviso';
      close.setAttribute('aria-label', 'Quitar el aviso');
      close.addEventListener('click', (ev) => {
        ev.stopPropagation();
        remove(card);
      });
      card.append(text, close);
      card.addEventListener('click', () => {
        if (entry.at) opts.focus(entry.at.x, entry.at.y);
        else opts.openLog();
        remove(card);
      });
      card.dataset.timer = String(window.setTimeout(() => card.remove(), STAY_SECONDS[entry.alert] * 1000));
      box.append(card);
      while (box.children.length > MAX_SHOWN) remove(box.firstElementChild as HTMLElement);
    },
    clear(): void {
      for (const c of [...box.children]) remove(c as HTMLElement);
    },
  };
}

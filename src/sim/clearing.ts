// Despejar zonas (#14): al marcar un almacén o un huerto, lo que haya dentro que se pueda talar,
// picar o saquear (árboles, rocas, chatarra…) queda marcado para quitarlo. Cuando la casilla
// queda libre, pasa a formar parte de la zona.
import { GameMap, inBounds, index } from './map';
import { harvestAt } from './resources';
import type { Designations, TileRect } from './designations';

export type ClearZoneKind = 'almacen' | 'huerto';

/** Casilla por despejar: para qué zona es y qué objeto había al marcarla (para saber si el jugador quitó la orden). */
export interface ClearMark {
  kind: ClearZoneKind;
  zone: number;
  prop: number;
}

export class ZoneClearing {
  private marks = new Map<number, ClearMark>();

  constructor(readonly map: GameMap) {}

  get count(): number {
    return this.marks.size;
  }

  /** Casillas que faltan por despejar de una zona. */
  countFor(kind: ClearZoneKind, zone: number): number {
    let n = 0;
    for (const m of this.marks.values()) if (m.kind === kind && m.zone === zone) n++;
    return n;
  }

  at(x: number, y: number): ClearMark | undefined {
    return inBounds(this.map, x, y) ? this.marks.get(index(this.map, x, y)) : undefined;
  }

  /**
   * Marca para despejar lo que haya en el rectángulo y deja la orden de talar, picar o saquear.
   * `skip` deja fuera casillas (de otra zona, con una construcción…). Devuelve cuántas casillas.
   */
  markArea(r: TileRect, kind: ClearZoneKind, zone: number, d: Designations, skip: (x: number, y: number) => boolean): number {
    const xa = Math.max(0, Math.min(r.x0, r.x1));
    const xb = Math.min(this.map.width - 1, Math.max(r.x0, r.x1));
    const ya = Math.max(0, Math.min(r.y0, r.y1));
    const yb = Math.min(this.map.height - 1, Math.max(r.y0, r.y1));
    let n = 0;
    for (let y = ya; y <= yb; y++) {
      for (let x = xa; x <= xb; x++) {
        const h = harvestAt(this.map, x, y);
        if (!h || skip(x, y)) continue;
        const i = index(this.map, x, y);
        d.add(x, y, h.job);
        this.marks.set(i, { kind, zone, prop: this.map.props[i] });
        n++;
      }
    }
    return n;
  }

  /** Quita las marcas del rectángulo (al quitar zonas). */
  removeArea(r: TileRect): number {
    let n = 0;
    for (const i of [...this.marks.keys()]) {
      const x = i % this.map.width;
      const y = Math.floor(i / this.map.width);
      if (x >= Math.min(r.x0, r.x1) && x <= Math.max(r.x0, r.x1) && y >= Math.min(r.y0, r.y1) && y <= Math.max(r.y0, r.y1)) {
        this.marks.delete(i);
        n++;
      }
    }
    return n;
  }

  /**
   * Revisa las casillas marcadas:
   * - si la zona ya no existe, o el jugador quitó la orden (sigue el mismo objeto sin orden), se olvida;
   * - si queda otro objeto (un tocón tras el árbol, piedras tras la roca), se marca de nuevo;
   * - si ya está libre, se llama a `join` para sumarla a su zona y se olvida.
   */
  update(d: Designations, exists: (kind: ClearZoneKind, zone: number) => boolean, join: (x: number, y: number, m: ClearMark) => void): void {
    for (const [i, m] of [...this.marks]) {
      const x = i % this.map.width;
      const y = Math.floor(i / this.map.width);
      if (!exists(m.kind, m.zone)) {
        this.marks.delete(i);
        continue;
      }
      const h = harvestAt(this.map, x, y);
      if (h) {
        if (d.at(x, y) === h.job) continue;
        if (this.map.props[i] === m.prop) {
          this.marks.delete(i); // el jugador ha quitado la orden
          continue;
        }
        d.add(x, y, h.job);
        m.prop = this.map.props[i];
        continue;
      }
      this.marks.delete(i);
      join(x, y, m);
    }
  }

  list(): { i: number; kind: ClearZoneKind; zone: number; prop: number }[] {
    return [...this.marks].map(([i, m]) => ({ i, ...m }));
  }

  restore(i: number, m: ClearMark): void {
    if (i < 0 || i >= this.map.width * this.map.height) return;
    this.marks.set(i, { ...m });
  }
}

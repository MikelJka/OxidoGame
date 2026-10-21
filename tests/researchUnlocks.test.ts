import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { BUILDINGS, buildingDef } from '../src/data/buildings';
import { researchDef } from '../src/data/research';
import { unlockedBy, researchCost } from '../src/sim/research';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_HOUR } from '../src/sim/world';

const rect = (x: number, y: number) => ({ x0: x, y0: y, x1: x, y1: y });

describe('la investigación desbloquea construcciones', () => {
  it('la torreta ligera pide «Torretas» y la pesada «Artillería»', () => {
    expect(buildingDef('torreta_ligera').research).toBe('torretas');
    expect(buildingDef('torreta_pesada').research).toBe('artilleria');
    expect(unlockedBy(BUILDINGS, 'torretas').map((b) => b.id)).toEqual(['torreta_ligera']);
    // Lo demás se sigue construyendo sin investigar.
    expect(BUILDINGS.filter((b) => b.research).map((b) => b.id).sort()).toEqual(['alambre_espino', 'balsa', 'bandeja_hidroponica', 'barcaza', 'compostera', 'estufa', 'lancha_armada', 'lancha_blindada', 'mesa_boticario', 'mina_casera', 'molino_agua', 'mortero', 'muelle', 'muro_aspilleras_metal', 'muro_aspilleras_piedra', 'plataforma_madera', 'plataforma_metal', 'puente_levadizo', 'puente_madera', 'puente_metal', 'torreta_ligera', 'torreta_pesada', 'torreta_rotativa', 'trampa_electrica', 'trampa_pesca']);
  });

  it('sin investigar no se ponen planos de torreta; investigada, sí', () => {
    const w = flatWorld(1);
    expect(w.canBuild('torreta_ligera')).toBe(false);
    expect(w.placeBuildArea(rect(10, 10), 'torreta_ligera', 'relleno')).toBe(0);
    expect(w.structures.at(10, 10)).toBeUndefined();
    // Un muro no pide nada.
    expect(w.placeBuildArea(rect(5, 5), 'muro_madera', 'relleno')).toBe(1);

    w.research.done.push('polvora', 'torretas');
    expect(w.canBuild('torreta_ligera')).toBe(true);
    expect(w.canBuild('torreta_pesada')).toBe(false);
    expect(w.placeBuildArea(rect(10, 10), 'torreta_ligera', 'relleno')).toBe(1);

    w.research.done.push('artilleria');
    expect(w.placeBuildArea(rect(14, 14), 'torreta_pesada', 'relleno')).toBe(1);
  });

  it('al terminar «Torretas» el diario dice que ya se puede construir la torreta ligera', () => {
    const w = flatWorld(1);
    w.colonists[0].skills.investigacion = 10;
    w.structures.place(8, 8, 'banco_investigacion');
    w.completeStructure(w.structures.at(8, 8)!);
    w.research.done.push('polvora');
    expect(w.setResearch('torretas')).toBe(true);
    // Casi terminado: falta un rato.
    w.research.progress.torretas = researchCost(researchDef('torretas')!) * 0.98;
    for (let t = 0; t < TICKS_PER_HOUR * 3 && !w.research.done.includes('torretas'); t++) w.step();
    expect(w.research.done).toContain('torretas');
    expect(w.log.some((l) => l.text.includes('Ya se puede construir: Torreta ligera'))).toBe(true);
    expect(w.canBuild('torreta_ligera')).toBe(true);
  });

  it('en una partida empezada las torretas ya construidas se quedan', () => {
    const w = flatWorld(1);
    w.structures.place(10, 10, 'torreta_ligera');
    w.completeStructure(w.structures.at(10, 10)!);
    const back = loadWorld(serializeWorld(w));
    const t = back.structures.at(10, 10);
    expect(t?.def.id).toBe('torreta_ligera');
    expect(t?.built).toBe(true);
    // Pero no se pueden poner más hasta investigarlas.
    expect(back.canBuild('torreta_ligera')).toBe(false);
  });
});

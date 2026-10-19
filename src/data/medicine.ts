/**
 * Infecciones y medicinas (bloque 1 del catálogo, aprobado por Mikel el 2026-10-18).
 * Los números están en `medicine.json`:
 * - checkHours: horas que tiene que seguir abierta una herida para poder infectarse.
 * - chanceUntreated / chanceTreated / chanceMedicine: probabilidad de infectarse sin curar,
 *   curada sin medicina y curada con medicina.
 * - moodPenalty / workFactor: ánimo que quita y velocidad de trabajo del infectado.
 * - dosesToCure: dosis de 💊 (una al día) para curarse; deadlyDays: días seguidos sin tratar hasta morir.
 * - medicineHealFactor: curar con medicina cierra la herida este tanto más rápido que sin ella.
 * - find: 💊 al saquear escombros (probabilidad y unidades) y lo que traen las caravanas.
 */
import data from './medicine.json';

export const INFECTION: Readonly<typeof data.infection> = data.infection;

/** 💊 en las ruinas (al saquear escombros) y en las caravanas: [mínimo, máximo]. */
export const RUBBLE_MEDICINE = { chance: data.find.rubbleChance, amount: [data.find.rubbleAmount[0], data.find.rubbleAmount[1]] as const };
export const MEDICINE_STOCK = [data.find.caravanStock[0], data.find.caravanStock[1]] as const;

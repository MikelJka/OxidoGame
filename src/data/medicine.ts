/**
 * Infecciones y medicinas (bloque 1 del catálogo, aprobado por Mikel el 2026-10-18).
 * Los números están en `medicine.json`:
 * - checkHours: horas que tiene que seguir abierta una herida para poder infectarse.
 * - chanceUntreated / chanceTreated / chanceMedicine: probabilidad de infectarse sin curar,
 *   curada sin medicina y curada con medicina.
 * - moodPenalty / workFactor: ánimo que quita y velocidad de trabajo del infectado.
 * - dosesToCure: dosis de 💊 (una al día) para curarse; deadlyDays: días seguidos sin tratar hasta morir.
 * - medicineHealFactor: curar con medicina cierra la herida este tanto más rápido que sin ella.
 * - chanceSelf / chanceSelfMedicine: probabilidad de infectarse si se curó él mismo (sin y con 💊).
 * - selfCare.healFactor: curarse uno mismo cierra las heridas a esta velocidad respecto a que le cure otro.
 * - bedRest: el herido en pie se acuesta por debajo de startBelow de salud y se queda hasta untilHealth.
 * - find: 💊 al saquear escombros (probabilidad y unidades) y lo que traen las caravanas.
 */
import data from './medicine.json';

export const INFECTION: Readonly<typeof data.infection> = data.infection;

/** 💊 en las ruinas (al saquear escombros) y en las caravanas: [mínimo, máximo]. */
export const RUBBLE_MEDICINE = { chance: data.find.rubbleChance, amount: [data.find.rubbleAmount[0], data.find.rubbleAmount[1]] as const };
export const MEDICINE_STOCK = [data.find.caravanStock[0], data.find.caravanStock[1]] as const;

/** Curarse uno mismo: las heridas se cierran a esta velocidad respecto a que le cure otro. */
export const SELF_CARE_HEAL: number = data.selfCare.healFactor;
/** Trabajo de curarse uno mismo (el mismo que si le cura otro). */
export const SELF_CARE_WORK: number = data.selfCare.work;

/** El herido en pie tras el combate se acuesta por debajo de `startBelow` y se queda hasta `untilHealth`. */
export const BED_REST = { startBelow: data.bedRest.startBelow, untilHealth: data.bedRest.untilHealth } as const;

/** Id de la cama de hospital: el herido va antes a ella que a una cama normal. */
export const HOSPITAL_BED_ID = 'cama_hospital';
/** Tumbado en una cama de hospital, las heridas se cierran `healFactor` veces más deprisa y se infectan × `infectionFactor`. */
export const HOSPITAL_BED = { healFactor: data.hospitalBed.healFactor, infectionFactor: data.hospitalBed.infectionFactor } as const;

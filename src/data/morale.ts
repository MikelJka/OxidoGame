/**
 * Ánimo por lo que pasa en la colonia. Los números están en `morale.json`:
 * - finish: rematar a un saqueador en el suelo (#22, elegido por Mikel el 2026-10-19):
 *   killer / witness (ánimo que quita a quien remata y a quien lo ve; a los «duros», nada),
 *   hours (cuánto dura) y witnessRadius (casillas a las que se ve).
 */
import data from './morale.json';

export const FINISH_MOOD: Readonly<Omit<typeof data.finish, '_'>> = data.finish;

// Guardado de la partida en el navegador (localStorage) y en archivo.
// La partida guardada sobrevive a las versiones nuevas del juego: ver `src/sim/save.ts`.
import { serializeWorld } from '../sim/save';
import type { World } from '../sim/world';

const SAVE_KEY = 'oxido.partida';
/** Copia de la anterior, por si la última se estropea al guardar. */
const BACKUP_KEY = 'oxido.partida.anterior';

export function gameVersion(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  return env.VITE_COMMIT ? env.VITE_COMMIT.slice(0, 7) : 'local';
}

/** Partida guardada en el navegador (texto JSON), o null si no hay o no se puede leer. */
export function readStoredSave(): string | null {
  try {
    return localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
}

/** Copia de seguridad (la penúltima partida guardada). */
export function readBackupSave(): string | null {
  try {
    return localStorage.getItem(BACKUP_KEY);
  } catch {
    return null;
  }
}

/** Guarda la partida en el navegador. Devuelve un mensaje de error o null si ha ido bien. */
export function storeWorld(world: World): string | null {
  let text: string;
  try {
    text = JSON.stringify(serializeWorld(world, gameVersion()));
  } catch (err) {
    return `No se pudo preparar la partida: ${err instanceof Error ? err.message : String(err)}`;
  }
  try {
    const prev = localStorage.getItem(SAVE_KEY);
    if (prev) localStorage.setItem(BACKUP_KEY, prev);
  } catch {
    // Sin sitio para la copia: se sigue con la principal.
    try {
      localStorage.removeItem(BACKUP_KEY);
    } catch {
      // nada
    }
  }
  try {
    localStorage.setItem(SAVE_KEY, text);
    return null;
  } catch (err) {
    return `El navegador no deja guardar (${err instanceof Error ? err.name : 'error'}). Exporta la partida a un archivo.`;
  }
}

export function clearStoredSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // nada
  }
}

/** Descarga la partida como archivo .json. */
export function downloadWorld(world: World): void {
  const text = JSON.stringify(serializeWorld(world, gameVersion()));
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  a.href = URL.createObjectURL(blob);
  a.download = `oxido-dia${world.day}-${stamp}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/** Pide al jugador un archivo de partida y devuelve su texto. */
export function pickSaveFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      file.text().then(resolve, () => resolve(null));
    });
    input.click();
  });
}

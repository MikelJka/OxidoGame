// Partida en la nube: para seguir la misma partida en varios dispositivos.
// Primera versión con una cuenta de GitHub: la partida se guarda en un gist privado del jugador.
// Todo pasa por la interfaz `CloudStore`, así que más adelante se puede cambiar por Firebase u
// otro servicio sin tocar el resto del juego.

/** Lo que se guarda junto a la partida para decidir cuál es la más reciente. */
export interface CloudMeta {
  /** Hora de guardado (ms desde 1970). */
  savedAt: number;
  /** Dispositivo que la subió (p. ej. «Android · Chrome»). */
  device: string;
  /** Resumen para el jugador (p. ej. «Día 4 · 13:20 · 3 colonos»). */
  label: string;
  /** Cómo va guardado el texto de la partida. */
  encoding: 'json' | 'gzip-base64';
}

export interface CloudSave {
  meta: CloudMeta;
  /** Texto JSON de la partida (ya descomprimido). */
  text: string;
}

/** Un sitio donde guardar la partida con una cuenta. */
export interface CloudStore {
  readonly provider: string;
  /** Nombre de la cuenta, si ya se ha comprobado. */
  readonly account: string | null;
  /** Comprueba la cuenta (y la recuerda). Lanza un error con el motivo si no vale. */
  signIn(): Promise<string>;
  /** Solo los datos de la última partida subida (null si no hay ninguna). */
  peek(): Promise<CloudMeta | null>;
  load(): Promise<CloudSave | null>;
  save(text: string, meta: Omit<CloudMeta, 'encoding'>): Promise<void>;
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

const API = 'https://api.github.com';
export const GIST_DESCRIPTION = 'Óxido — partida en la nube (no borrar)';
const SAVE_FILE = 'oxido-partida.txt';
const META_FILE = 'oxido-meta.json';

/** Página para crear un token de GitHub con solo el permiso «gist». */
export const GITHUB_TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=%C3%93xido%20-%20partida%20en%20la%20nube';

interface GistFile {
  content?: string;
  truncated?: boolean;
  raw_url?: string;
}
interface Gist {
  id: string;
  description: string | null;
  files: Record<string, GistFile>;
}

/** Partida guardada en un gist privado de GitHub, con un token personal (permiso «gist»). */
export class GitHubGistStore implements CloudStore {
  readonly provider = 'GitHub';
  account: string | null = null;
  private gistId: string | null;

  constructor(
    private readonly token: string,
    private readonly fetchFn: Fetch = (u, i) => fetch(u, i),
    gistId: string | null = null,
  ) {
    this.gistId = gistId;
  }

  /** Id del gist donde va la partida (para recordarlo y no buscarlo cada vez). */
  get gist(): string | null {
    return this.gistId;
  }

  private async api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await this.fetchFn(API + path, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
    if (res.status === 401) throw new Error('GitHub no acepta el token (¿caducado o mal copiado?)');
    if (res.status === 403 || res.status === 404) {
      throw new Error(path.startsWith('/gists') ? 'El token no tiene permiso «gist»' : `GitHub ha respondido ${res.status}`);
    }
    if (!res.ok) throw new Error(`GitHub ha respondido ${res.status}`);
    return (await res.json()) as T;
  }

  async signIn(): Promise<string> {
    const me = await this.api<{ login: string }>('/user');
    this.account = me.login;
    await this.findGist(); // comprueba también el permiso «gist»
    return me.login;
  }

  /** Busca el gist de la partida entre los del jugador (null si todavía no hay). */
  private async findGist(): Promise<Gist | null> {
    if (this.gistId) {
      try {
        return await this.api<Gist>(`/gists/${this.gistId}`);
      } catch {
        this.gistId = null; // borrado: se busca o se crea otro
      }
    }
    for (let page = 1; page <= 5; page++) {
      const list = await this.api<Gist[]>(`/gists?per_page=100&page=${page}`);
      const g = list.find((x) => x.description === GIST_DESCRIPTION && x.files[META_FILE]);
      if (g) {
        this.gistId = g.id;
        return this.api<Gist>(`/gists/${g.id}`);
      }
      if (list.length < 100) break;
    }
    return null;
  }

  private async fileText(f: GistFile | undefined): Promise<string | null> {
    if (!f) return null;
    if (!f.truncated && typeof f.content === 'string') return f.content;
    if (!f.raw_url) return null;
    // Más de 1 MB: la API lo corta y hay que pedir el archivo entero.
    // El enlace del archivo de un gist secreto ya es privado: no lleva la cabecera (evita el preflight).
    const res = await this.fetchFn(f.raw_url);
    if (!res.ok) throw new Error(`No se pudo descargar la partida (${res.status})`);
    return res.text();
  }

  async peek(): Promise<CloudMeta | null> {
    const g = await this.findGist();
    const text = await this.fileText(g?.files[META_FILE]);
    return text ? parseMeta(text) : null;
  }

  async load(): Promise<CloudSave | null> {
    const g = await this.findGist();
    if (!g) return null;
    const metaText = await this.fileText(g.files[META_FILE]);
    const meta = metaText ? parseMeta(metaText) : null;
    const body = await this.fileText(g.files[SAVE_FILE]);
    if (!meta || body === null) return null;
    return { meta, text: meta.encoding === 'gzip-base64' ? await gunzipBase64(body) : body };
  }

  async save(text: string, info: Omit<CloudMeta, 'encoding'>): Promise<void> {
    const packed = await gzipBase64(text);
    const meta: CloudMeta = { ...info, encoding: packed ? 'gzip-base64' : 'json' };
    const files = {
      [SAVE_FILE]: { content: packed ?? text },
      [META_FILE]: { content: JSON.stringify(meta) },
    };
    const body = JSON.stringify({ files });
    if (this.gistId) {
      try {
        await this.api(`/gists/${this.gistId}`, { method: 'PATCH', body });
        return;
      } catch {
        this.gistId = null; // borrado: se busca otro o se crea
      }
    }
    await this.findGist();
    if (this.gistId) {
      await this.api(`/gists/${this.gistId}`, { method: 'PATCH', body });
    } else {
      const g = await this.api<Gist>('/gists', { method: 'POST', body: JSON.stringify({ description: GIST_DESCRIPTION, public: false, files }) });
      this.gistId = g.id;
    }
  }
}

export function parseMeta(text: string): CloudMeta | null {
  try {
    const m = JSON.parse(text) as Partial<CloudMeta>;
    if (typeof m.savedAt !== 'number') return null;
    return {
      savedAt: m.savedAt,
      device: typeof m.device === 'string' ? m.device : '¿?',
      label: typeof m.label === 'string' ? m.label : '',
      encoding: m.encoding === 'gzip-base64' ? 'gzip-base64' : 'json',
    };
  } catch {
    return null;
  }
}

/** Hora de guardado (ms) de una partida guardada, leída de su cabecera; 0 si no se sabe. */
export function savedAtOf(saveText: string | null): number {
  if (!saveText) return 0;
  const m = /"savedAt"\s*:\s*"([^"]+)"/.exec(saveText.slice(0, 400));
  const t = m ? Date.parse(m[1]) : NaN;
  return Number.isFinite(t) ? t : 0;
}

/** Nombre corto del dispositivo para saber desde dónde se subió. */
export function deviceName(ua: string): string {
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iPhone/iPad' : /Windows/i.test(ua) ? 'Windows' : /Mac OS X/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux' : 'Otro';
  const br = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
  return `${os} · ${br}`;
}

// --- Compresión (la partida ocupa ~0,5 MB en JSON y unas diez veces menos comprimida) ----

async function gzipBase64(text: string): Promise<string | null> {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  } catch {
    return null;
  }
}

async function gunzipBase64(b64: string): Promise<string> {
  if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador no puede leer la partida comprimida; actualízalo');
  const bin = atob(b64.trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

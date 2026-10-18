// Sincronización automática de la partida con la nube (sección «☁ Nube» del menú ☰).
// Sube la partida cada 2 minutos y al salir; al abrir el juego o volver a la pestaña, si otro
// dispositivo ha subido una más nueva, ofrece seguir con ella.
import { CloudMeta, deviceName, GitHubGistStore, savedAtOf } from './cloudSave';

const TOKEN_KEY = 'oxido.nube.github';
const GIST_KEY = 'oxido.nube.gist';
/** Hora de guardado de la última versión de la nube que este dispositivo conoce (subida o bajada). */
const SYNCED_KEY = 'oxido.nube.sincronizada';
const UPLOAD_MS = 2 * 60_000;

interface Options {
  /** Guarda la partida en el navegador y devuelve su texto (null si no hay partida). */
  saveLocal: () => string | null;
  /** Resumen de la partida en curso para el jugador. */
  label: () => string;
  /** Carga el texto de una partida. */
  loadText: (text: string) => void;
  toast: (msg: string, ms?: number) => void;
  onError: (msg: string) => void;
}

const get = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const set = (k: string, v: string | null): void => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    // nada
  }
};

function ago(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `hace ${s} s`;
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86400)} días`;
}

export function mountCloudSync(opts: Options): void {
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const out = $('cloud-out');
  const inn = $('cloud-in');
  const status = $('cloud-status');
  const tokenInput = $<HTMLInputElement>('cloud-token');
  const signinBtn = $<HTMLButtonElement>('cloud-signin');

  let store: GitHubGistStore | null = null;
  let ready = false; // ya se ha comprobado si hay una partida más nueva en la nube
  let busy = false;
  let lastUploadedAt = 0;
  let lastError: string | null = null;
  const synced = () => Number(get(SYNCED_KEY)) || 0;
  const setSynced = (t: number) => set(SYNCED_KEY, String(t));

  function render(): void {
    out.hidden = !!store?.account;
    inn.hidden = !store?.account;
    if (lastError) status.textContent = `⚠️ ${lastError}`;
    else if (!store) status.textContent = 'Sin cuenta: la partida solo está en este dispositivo.';
    else if (!store.account) status.textContent = 'Conectando con GitHub…';
    else status.textContent = `☁ Conectado como ${store.account}${lastUploadedAt ? ` · subida ${ago(lastUploadedAt)}` : synced() ? ` · al día (${ago(synced())})` : ''}`;
  }

  function fail(err: unknown): void {
    lastError = err instanceof Error ? err.message : String(err);
    opts.onError(`Nube: ${lastError}`);
    render();
  }

  async function connect(token: string, announce: boolean): Promise<void> {
    const s = new GitHubGistStore(token, undefined, get(GIST_KEY));
    store = s;
    lastError = null;
    render();
    try {
      await s.signIn();
    } catch (err) {
      store = null;
      fail(err);
      return;
    }
    set(TOKEN_KEY, token);
    if (s.gist) set(GIST_KEY, s.gist);
    if (announce) opts.toast(`☁ Conectado como ${s.account}`);
    render();
    await check(true);
    await upload(false); // si la nube estaba vacía (o se ha elegido la de aquí), se sube ya
  }

  /** Mira si otro dispositivo ha subido una partida más nueva y, si es así, ofrece seguir con ella. */
  async function check(interactive: boolean): Promise<CloudMeta | null> {
    if (!store?.account || busy) return null;
    busy = true;
    try {
      const meta = await store.peek();
      if (store.gist) set(GIST_KEY, store.gist);
      const known = synced();
      if (meta && meta.savedAt > known) {
        // Otro dispositivo (o este, antes de conectarse) ha subido una partida que no tenemos.
        if (!interactive || document.visibilityState !== 'visible') return meta; // ya se preguntará
        const first = known === 0;
        const ok = window.confirm(
          `☁ Hay una partida en la nube${first ? '' : ' más reciente'}:\n${meta.label || 'partida'}\nguardada ${ago(meta.savedAt)} desde ${meta.device}.\n\n` +
            '¿Seguir con ella?\n(Si cancelas, se sigue con la de este dispositivo y se sube encima.)',
        );
        if (ok) {
          const save = await store.load();
          if (save) {
            setSynced(save.meta.savedAt);
            ready = true;
            busy = false;
            opts.loadText(save.text);
            opts.toast('☁ Partida de la nube cargada');
            render();
            return null;
          }
        }
        setSynced(meta.savedAt);
      }
      ready = true;
      lastError = null;
      return null;
    } catch (err) {
      fail(err);
      return null;
    } finally {
      busy = false;
      render();
    }
  }

  /** Sube la partida si ha cambiado y nadie ha subido otra más nueva desde otro dispositivo. */
  async function upload(force: boolean): Promise<void> {
    if (!store?.account) return;
    if (!ready || busy) return;
    const text = opts.saveLocal();
    if (!text) return;
    const savedAt = savedAtOf(text) || Date.now();
    if (!force && savedAt <= lastUploadedAt) return;
    busy = true;
    try {
      // Antes de subir, que no haya una partida de otro dispositivo que se perdería.
      const meta = await store.peek();
      if (meta && meta.savedAt > synced()) {
        busy = false;
        await check(true);
        return;
      }
      await store.save(text, { savedAt, device: deviceName(navigator.userAgent), label: opts.label() });
      if (store.gist) set(GIST_KEY, store.gist);
      setSynced(savedAt);
      lastUploadedAt = savedAt;
      lastError = null;
      if (force) opts.toast('☁ Partida subida a la nube');
    } catch (err) {
      fail(err);
    } finally {
      busy = false;
      render();
    }
  }

  signinBtn.addEventListener('click', () => {
    const token = tokenInput.value.trim();
    if (!token) {
      tokenInput.focus();
      return;
    }
    tokenInput.value = '';
    void connect(token, true);
  });
  tokenInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') signinBtn.click();
  });
  $('cloud-up').addEventListener('click', () => void upload(true));
  $('cloud-down').addEventListener('click', async () => {
    if (!store?.account || busy) return;
    busy = true;
    try {
      const save = await store.load();
      if (!save) {
        opts.toast('☁ Todavía no hay ninguna partida en la nube');
        return;
      }
      if (!window.confirm(`¿Cargar la partida de la nube?\n${save.meta.label}\nguardada ${ago(save.meta.savedAt)} desde ${save.meta.device}.\nSe pierde lo jugado aquí desde la última subida.`)) return;
      setSynced(save.meta.savedAt);
      opts.loadText(save.text);
      opts.toast('☁ Partida de la nube cargada');
    } catch (err) {
      fail(err);
    } finally {
      busy = false;
      render();
    }
  });
  $('cloud-signout').addEventListener('click', () => {
    if (!window.confirm('¿Salir de la cuenta en este dispositivo? La partida de la nube no se borra.')) return;
    store = null;
    ready = false;
    lastUploadedAt = 0;
    lastError = null;
    set(TOKEN_KEY, null);
    set(GIST_KEY, null);
    set(SYNCED_KEY, null);
    render();
  });

  window.setInterval(() => void upload(false), UPLOAD_MS);
  window.setInterval(render, 10_000);
  document.addEventListener('visibilitychange', () => {
    // Al salir se sube; al volver, se mira si otro dispositivo ha jugado mientras tanto.
    if (document.visibilityState === 'hidden') void upload(false);
    else void check(true);
  });

  const saved = get(TOKEN_KEY);
  if (saved) void connect(saved, false);
  render();
}

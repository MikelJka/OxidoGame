import { describe, expect, it } from 'vitest';
import { deviceName, GIST_DESCRIPTION, GitHubGistStore, savedAtOf } from '../src/ui/cloudSave';

/** GitHub de mentira: un usuario, sus gists y la cuenta de peticiones. */
function fakeGitHub(token = 'ok') {
  const gists = new Map<string, { id: string; description: string; files: Record<string, { content: string }> }>();
  const calls: string[] = [];
  let next = 1;
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const fetchFn = async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    const path = url.replace('https://api.github.com', '');
    calls.push(`${method} ${path}`);
    const auth = (init.headers as Record<string, string>)?.Authorization;
    if (auth !== `Bearer ${token}`) return json({ message: 'Bad credentials' }, 401);
    if (path === '/user') return json({ login: 'mikel' });
    if (method === 'GET' && path.startsWith('/gists?')) return json([...gists.values()]);
    if (method === 'POST' && path === '/gists') {
      const body = JSON.parse(String(init.body));
      const g = { id: `g${next++}`, description: body.description, files: body.files };
      gists.set(g.id, g);
      return json(g, 201);
    }
    const m = /^\/gists\/(\w+)$/.exec(path);
    if (m) {
      const g = gists.get(m[1]);
      if (!g) return json({ message: 'Not Found' }, 404);
      if (method === 'PATCH') Object.assign(g.files, JSON.parse(String(init.body)).files);
      return json(g);
    }
    return json({}, 404);
  };
  return { fetchFn, gists, calls };
}

const SAVE = JSON.stringify({ format: 'oxido-partida', version: 9, savedAt: '2026-10-18T10:00:00.000Z', map: 'x'.repeat(5000) });

describe('partida en la nube (GitHub)', () => {
  it('entra, sube la partida a un gist privado y otro dispositivo la recupera', async () => {
    const gh = fakeGitHub();
    const a = new GitHubGistStore('ok', gh.fetchFn);
    expect(await a.signIn()).toBe('mikel');
    expect(await a.peek()).toBeNull();
    await a.save(SAVE, { savedAt: 1000, device: 'Windows · Chrome', label: 'Día 2 · 3 colonos' });
    expect(gh.gists.size).toBe(1);
    const g = [...gh.gists.values()][0];
    expect(g.description).toBe(GIST_DESCRIPTION);
    expect(gh.calls).toContain('POST /gists');

    // Otro dispositivo, sin saber el id del gist: lo encuentra por la descripción.
    const b = new GitHubGistStore('ok', gh.fetchFn);
    await b.signIn();
    const meta = await b.peek();
    expect(meta).toMatchObject({ savedAt: 1000, device: 'Windows · Chrome', label: 'Día 2 · 3 colonos' });
    const got = await b.load();
    expect(got?.text).toBe(SAVE);

    // Las siguientes subidas actualizan el mismo gist.
    await b.save(SAVE.replace('10:00', '11:00'), { savedAt: 2000, device: 'Android · Chrome', label: 'Día 3' });
    expect(gh.gists.size).toBe(1);
    expect((await a.peek())?.savedAt).toBe(2000);
    expect((await a.load())?.text).toContain('11:00');
  });

  it('comprime la partida (ocupa mucho menos que el JSON)', async () => {
    const gh = fakeGitHub();
    const s = new GitHubGistStore('ok', gh.fetchFn);
    await s.save(SAVE, { savedAt: 1, device: 'x', label: '' });
    const files = [...gh.gists.values()][0].files;
    const meta = JSON.parse(files['oxido-meta.json'].content);
    if (meta.encoding === 'gzip-base64') expect(files['oxido-partida.txt'].content.length).toBeLessThan(SAVE.length / 3);
    else expect(files['oxido-partida.txt'].content).toBe(SAVE);
  });

  it('un token malo da un error claro', async () => {
    const gh = fakeGitHub();
    const s = new GitHubGistStore('malo', gh.fetchFn);
    await expect(s.signIn()).rejects.toThrow(/token/);
    expect(s.account).toBeNull();
  });

  it('si borran el gist, se crea otro al subir', async () => {
    const gh = fakeGitHub();
    const s = new GitHubGistStore('ok', gh.fetchFn, 'g99');
    await s.save(SAVE, { savedAt: 1, device: 'x', label: '' });
    expect(s.gist).toBe('g1');
  });
});

describe('cuándo ofrecer la partida de la nube', () => {
  it('lee la hora de guardado de la cabecera de la partida', () => {
    expect(savedAtOf(SAVE)).toBe(Date.parse('2026-10-18T10:00:00.000Z'));
    expect(savedAtOf(null)).toBe(0);
    expect(savedAtOf('{}')).toBe(0);
  });

  it('pone nombre al dispositivo', () => {
    expect(deviceName('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36')).toBe('Android · Chrome');
    expect(deviceName('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1')).toBe('iPhone/iPad · Safari');
    expect(deviceName('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129.0 Safari/537.36 Edg/129.0')).toBe('Windows · Edge');
  });
});

// Prueba de humo en un navegador de verdad (Chromium sin pantalla): abre el juego publicado en
// local, comprueba que no hay errores en 2D ni en 3D (en PC y en móvil) y guarda capturas en smoke/.
// Uso (tras `npm run build`): node scripts/smoke.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 4173;
const URL = `http://localhost:${PORT}/OxidoGame/?nueva&seed=12345`;
mkdirSync('smoke', { recursive: true });

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'inherit' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(URL);
      if (res.ok) return;
    } catch {
      // aún no
    }
    await sleep(500);
  }
  throw new Error('El servidor de vista previa no arrancó');
}

const problems = [];
try {
  await waitForServer();
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const devices = [
    { name: 'pc', viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false },
    { name: 'movil', viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true },
  ];
  for (const d of devices) {
    const context = await browser.newContext({ viewport: d.viewport, isMobile: d.isMobile, hasTouch: d.hasTouch });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console: ${m.text()}`);
    });
    await page.goto(URL);
    await sleep(5000);
    await page.screenshot({ path: `smoke/${d.name}-2d.png` });
    // Elegir un colono y abrir los menús de órdenes y de construcción.
    await page.click('#roster button[data-id]');
    await sleep(500);
    await page.screenshot({ path: `smoke/${d.name}-2d-colono.png` });
    await page.click('#build-btn');
    await sleep(300);
    await page.screenshot({ path: `smoke/${d.name}-2d-construir.png` });
    await page.click('#build-btn');
    // Vista 3D.
    await page.click('#menu-btn');
    await page.click('#view3d-btn');
    await sleep(5000);
    await page.screenshot({ path: `smoke/${d.name}-3d.png` });
    if (!d.isMobile) {
      // Pivotar con el botón central.
      await page.mouse.move(640, 400);
      await page.mouse.down({ button: 'middle' });
      await page.mouse.move(820, 330, { steps: 10 });
      await page.mouse.up({ button: 'middle' });
      await page.mouse.wheel(0, -600);
      await sleep(1000);
      await page.screenshot({ path: `smoke/${d.name}-3d-girada.png` });
      // Un clic en el suelo con el colono elegido (orden de ir).
      await page.mouse.click(600, 450);
      await sleep(1500);
      await page.screenshot({ path: `smoke/${d.name}-3d-orden.png` });
    }
    await page.click('#menu-btn');
    await page.click('#view3d-btn');
    await sleep(1500);
    await page.screenshot({ path: `smoke/${d.name}-vuelta-2d.png` });
    // Errores que el propio juego ha registrado (botón 🐞).
    const flagged = await page.$('#report-btn .badge.error');
    if (flagged) errors.push(`el juego registró errores (🐞): ${(await flagged.textContent())?.trim()}`);
    for (const e of errors) problems.push(`[${d.name}] ${e}`);
    await context.close();
  }
  await browser.close();
} catch (err) {
  problems.push(`la prueba no pudo terminar: ${err instanceof Error ? err.stack : String(err)}`);
} finally {
  server.kill();
}

if (problems.length) {
  console.error('❌ Prueba de humo con errores:\n' + problems.join('\n'));
  process.exit(1);
}
console.log('✅ Prueba de humo sin errores');

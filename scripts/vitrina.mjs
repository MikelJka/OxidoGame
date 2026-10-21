// Capturas de muestra para Mikel: una colonia avanzada, sus animales, el mapa del mundo con las
// bases de las facciones, una batalla en la base de una facción y un raid que llega en balsa.
// Las partidas salen de scripts/vitrina/*.json (hechas con la simulación). Uso (tras `npm run build`):
// node scripts/vitrina.mjs — deja las capturas en smoke/vitrina-*.png.
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 4174;
const URL = `http://localhost:${PORT}/OxidoGame/`;
mkdirSync('smoke', { recursive: true });
const saves = {
  colonia: readFileSync('scripts/vitrina/colonia.json', 'utf8'),
  balsa: readFileSync('scripts/vitrina/balsa.json', 'utf8'),
};
const points = JSON.parse(readFileSync('scripts/vitrina/puntos.json', 'utf8'));
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'inherit' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(URL)).ok) return;
    } catch {
      // aún no
    }
    await sleep(500);
  }
  throw new Error('El servidor de vista previa no arrancó');
}

async function open(browser, d, save) {
  const context = await browser.newContext({ viewport: d.viewport, isMobile: d.isMobile, hasTouch: d.hasTouch });
  await context.addInitScript((text) => {
    if (!sessionStorage.getItem('vitrina')) {
      localStorage.clear();
      localStorage.setItem('oxido.partida', text);
      sessionStorage.setItem('vitrina', '1');
    }
  }, save);
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log(`[${d.name}] pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.text().startsWith('[error del juego')) console.log(`[${d.name}] console.error: ${m.text().slice(0, 300)}`);
  });
  await page.goto(URL);
  await sleep(5000);
  await page.click('#mm-continue');
  await sleep(1500);
  // Pausa, para que no cambie nada entre captura y captura, y sin avisos encima.
  await page.click('#speeds button[data-speed="0"]').catch(() => {});
  await page.evaluate(() => document.querySelectorAll('#alerts .alert-card').forEach((e) => e.remove()));
  await page.addStyleTag({ content: '#offer-panel{display:none!important}' });
  return { context, page };
}

const shot = async (page, name) => {
  await sleep(900);
  await page.evaluate(() => document.querySelectorAll('#alerts .alert-card').forEach((e) => e.remove()));
  await page.screenshot({ path: `smoke/vitrina-${name}.png` });
};

try {
  await waitForServer();
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const devices = [
    { name: 'pc', viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false },
    { name: 'movil', viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true },
  ];
  for (const d of devices) {
    try {
      const { context, page } = await open(browser, d, saves.colonia);
      const c = points.colonia;
      await page.evaluate(([x, y]) => window.oxidoPrueba.mirar(x, y, 1.6), [c.x, c.y]);
      await shot(page, `${d.name}-colonia`);
      await page.evaluate(([x, y]) => window.oxidoPrueba.mirar(x - 3, y - 5, 3), [c.x, c.y]);
      await shot(page, `${d.name}-colonia-cerca`);
      // La misma colonia al anochecer, de noche (luces y hogueras) y con tormenta.
      await page.evaluate(([x, y]) => window.oxidoPrueba.mirar(x, y, 2.2), [c.x, c.y]);
      await page.evaluate(() => window.oxidoPrueba.ambiente(19.5));
      await shot(page, `${d.name}-atardecer`);
      await page.evaluate(() => window.oxidoPrueba.ambiente(23));
      await shot(page, `${d.name}-noche`);
      await page.evaluate(() => window.oxidoPrueba.ambiente(13, 'tormenta_electrica'));
      await shot(page, `${d.name}-tormenta`);
      await page.evaluate(() => window.oxidoPrueba.ambiente(11, 'despejado'));
      // Las estaciones: otoño (hojas ocres) e invierno (nieve en el suelo y encima de todo).
      await page.evaluate(([x, y]) => window.oxidoPrueba.mirar(x + 8, y, 1.8), [c.x, c.y]);
      await page.evaluate(() => window.oxidoPrueba.dia(24));
      await shot(page, `${d.name}-otono`);
      await page.evaluate(() => window.oxidoPrueba.dia(34));
      await shot(page, `${d.name}-invierno`);
      await page.evaluate(() => window.oxidoPrueba.dia(17));
      const k = points.corral;
      await page.evaluate(([x, y]) => window.oxidoPrueba.mirar(x, y, 3), [k.x, k.y]);
      await shot(page, `${d.name}-animales`);
      await page.click('#people-btn');
      await sleep(600);
      await page.click('#pp-tabs button:nth-child(5)');
      await shot(page, `${d.name}-mapa-mundo`);
      await page.click('#pp-close');
      console.log(`[${d.name}] batalla:`, await page.evaluate(() => window.oxidoPrueba.batalla()));
      // La batalla empieza en el siguiente tic del reloj: hay que quitar la pausa un momento.
      await page.click('#speeds button[data-speed="1"]').catch(() => {});
      await sleep(4000);
      await page.click('#speeds button[data-speed="0"]').catch(() => {});
      await page.evaluate(() => window.oxidoPrueba.mirarA('saqueadores', 1.4));
      await shot(page, `${d.name}-base-faccion`);
      await context.close();
    } catch (e) {
      console.log(`[${d.name}] colonia: ${e.message}`);
    }
    try {
      const { context, page } = await open(browser, d, saves.balsa);
      await page.evaluate(() => window.oxidoPrueba.mirarA('balsa', 2.2));
      await shot(page, `${d.name}-balsa`);
      await page.evaluate(() => window.oxidoPrueba.mirarA('balsa', 1.2));
      await shot(page, `${d.name}-balsa-lejos`);
      await context.close();
    } catch (e) {
      console.log(`[${d.name}] balsa: ${e.message}`);
    }
  }
  await browser.close();
} finally {
  server.kill();
}

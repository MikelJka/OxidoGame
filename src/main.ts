import Phaser from 'phaser';
import { WorldScene } from './render/WorldScene';
import { seedFromString } from './sim/rng';
import './style.css';

function initialSeed(): number {
  const param = new URLSearchParams(window.location.search).get('seed');
  if (param) return /^\d+$/.test(param) ? Number(param) >>> 0 : seedFromString(param);
  return Math.floor(Math.random() * 1_000_000);
}

let seed = initialSeed();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  pixelArt: true,
  backgroundColor: '#141210',
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  input: { activePointers: 3 },
  scene: [],
});

game.scene.add('world', WorldScene, true, { seed });

const seedLabel = document.getElementById('seed');
const tileLabel = document.getElementById('tile');
const newMapButton = document.getElementById('new-map');

function updateSeedLabel(): void {
  if (seedLabel) seedLabel.textContent = `Semilla ${seed}`;
  const url = new URL(window.location.href);
  url.searchParams.set('seed', String(seed));
  window.history.replaceState(null, '', url);
}

game.events.on('map-ready', updateSeedLabel);
game.events.on('tile-info', (text: string) => {
  if (tileLabel) tileLabel.textContent = text;
});

newMapButton?.addEventListener('click', () => {
  seed = Math.floor(Math.random() * 1_000_000);
  if (tileLabel) tileLabel.textContent = 'Toca el mapa para ver el terreno';
  game.scene.getScene('world').scene.restart({ seed });
});

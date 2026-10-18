// Vista 3D (en pruebas) con Three.js: el mismo mundo que la vista 2D, con cámara orbital libre.
// Solo dibuja y traduce el ratón y los dedos a casillas; las reglas siguen en `src/sim/` y las
// órdenes pasan por los métodos de `WorldScene` (tapAt, designBegin…), igual que en 2D.
import * as THREE from 'three';
import { Prop, Terrain, isWater, index } from '../sim/map';
import type { World } from '../sim/world';
import type { Colonist } from '../sim/colonist';
import type { WorldScene } from '../render/WorldScene';
import { DESIGN_COLORS } from '../render/WorldScene';
import { drawProp, PROP_HEADROOM } from '../render/mapArt';
import { colonistLookKey, COLONIST_SIZE, CROP_SIZE, ITEM_H, ITEM_W, paintColonist, paintCrop, paintItem } from '../render/spriteArt';
import { plantStage } from '../sim/farming';
import { footprintTiles } from '../sim/structures';
import { BuildingDef, buildingDef } from '../data/buildings';
import { Rng } from '../sim/rng';
import { cameraPosition, clampOrbit, northLabel3d, OrbitState, panOrbit } from './camera3d';
import { buildTerrainGeometry, paintBankTexture, paintGroundTexture } from './terrain3d';
import { paintSurface } from './structTex3d';
import { drawBuilding } from '../render/buildArt';

/** Altura de un nivel de terreno (en casillas). */
const LEVEL_H = 0.5;
/** Grosor del suelo por debajo del nivel 0. */
const BASE_H = 0.3;
/** Altura de un «piso» de muro. */
const WALL_H = 0.9;
/** Variantes de dibujo por tipo de objeto del mapa. */
const PROP_VARIANTS = 3;

function inBounds3(world: World, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < world.map.width && y < world.map.height;
}

/** Altura de la cara de arriba de una casilla. */
export function tileTopY(world: World, x: number, y: number): number {
  const m = world.map;
  const i = index(m, x, y);
  if (isWater(m.terrain[i] as Terrain)) return BASE_H - 0.1;
  return BASE_H + m.level[i] * LEVEL_H - (m.trench[i] ? 0.25 : 0);
}

function hash(x: number, y: number): number {
  let h = Math.imul(x ^ 0x27d4eb2d, 0x165667b1) ^ Math.imul(y ^ 0x85ebca6b, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

function pixelTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = false;
  return t;
}

function canvas(w: number, h: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext('2d')! };
}


export class View3D {
  private renderer: THREE.WebGLRenderer;
  private scene3 = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.1, 600);
  private sun = new THREE.DirectionalLight(0xffffff, 1.6);
  private ambient = new THREE.HemisphereLight(0xcfd8e0, 0x4a3a28, 1.1);
  private orbit: OrbitState = { tx: 70, tz: 70, yaw: 0, pitch: 0.75, dist: 34 };
  private running = false;
  private world: World | null = null;
  private terrain?: THREE.Mesh;
  private terrainSides?: THREE.Mesh;
  private water?: THREE.Mesh;
  private groundTex?: THREE.CanvasTexture;
  private topMat?: THREE.MeshLambertMaterial;
  private sideMat?: THREE.MeshLambertMaterial;
  private waterMat?: THREE.MeshPhongMaterial;
  private surfaceTex = new Map<string, THREE.CanvasTexture>();
  private terrainKey = '';
  private propGroup = new THREE.Group();
  private propKey = '';
  private propMeshes: { mesh: THREE.InstancedMesh; pos: THREE.Vector3[] }[] = [];
  private propTextures = new Map<string, THREE.CanvasTexture>();
  private lastYaw = NaN;
  private structGroup = new THREE.Group();
  private structVersion = -1;
  private itemGroup = new THREE.Group();
  private itemsVersion = -1;
  private plantGroup = new THREE.Group();
  private ghostGroup = new THREE.Group();
  private plantsVersion = -1;
  private overlay?: THREE.InstancedMesh;
  private overlayKey = '';
  private colonistSprites = new Map<number, THREE.Sprite>();
  private carrySprites = new Map<number, THREE.Sprite>();
  private ring = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.42, 24), new THREE.MeshBasicMaterial({ color: 0xd96c2c, side: THREE.DoubleSide }));
  private extraRings: THREE.Mesh[] = [];
  private flags: THREE.Mesh[] = [];
  private flagGeo = new THREE.ConeGeometry(0.12, 0.25, 4);
  private flagMat = new THREE.MeshBasicMaterial({ color: 0xd96c2c });
  /** Barras de progreso y de salud (fondo y relleno), reutilizadas de un fotograma a otro. */
  private bars: THREE.Sprite[] = [];
  private barsUsed = 0;
  private textureCache = new Map<string, THREE.CanvasTexture>();
  private raycaster = new THREE.Raycaster();
  // Entrada.
  private pointers = new Map<number, { x: number; y: number; button: number }>();
  private down?: { x: number; y: number; button: number; time: number; moved: boolean; design: boolean };
  private pinch?: { dist: number; angle: number; mid: { x: number; y: number }; orbit: OrbitState };
  private keys = new Set<string>();
  private onResize = () => this.resize();
  private onKeyDown = (e: KeyboardEvent) => this.keyDown(e);
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());

  /** Se llama si el navegador quita el contexto gráfico (móviles con poca memoria): se vuelve a la 2D. */
  onContextLost: (() => void) | null = null;

  constructor(private readonly container: HTMLElement, private readonly getScene: () => WorldScene) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    // En pantallas pequeñas (móviles) se dibuja a menos resolución: gasta menos memoria gráfica.
    const smallScreen = Math.min(window.innerWidth, window.innerHeight) < 700;
    this.renderer.setPixelRatio(Math.min(smallScreen ? 1.5 : 2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Tonos más naturales y sombras del sol.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const el: HTMLCanvasElement = this.renderer.domElement;
    el.id = 'view3d';
    el.style.touchAction = 'none';
    el.addEventListener('contextmenu', (e: Event) => e.preventDefault());
    el.addEventListener('pointerdown', (e: PointerEvent) => this.pointerDown(e));
    el.addEventListener('pointermove', (e: PointerEvent) => this.pointerMove(e));
    el.addEventListener('pointerup', (e: PointerEvent) => this.pointerUp(e));
    el.addEventListener('pointercancel', (e: PointerEvent) => this.pointerUp(e, true));
    el.addEventListener('wheel', (e: WheelEvent) => this.wheel(e), { passive: false });
    el.addEventListener('webglcontextlost', (e: Event) => {
      e.preventDefault();
      this.onContextLost?.();
    });
    this.sun.position.set(-40, 80, -30);
    this.sun.castShadow = true;
    const small = Math.min(window.innerWidth, window.innerHeight) < 700;
    this.sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.03;
    this.scene3.fog = new THREE.Fog(0x8a9aa8, 60, 160);
    this.scene3.add(this.sun.target);
    this.scene3.add(this.sun, this.ambient, this.propGroup, this.structGroup, this.itemGroup, this.plantGroup, this.ghostGroup);
    this.ring.rotation.x = -Math.PI / 2;
    this.scene3.add(this.ring);
  }

  get active(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.container.append(this.renderer.domElement);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.resize();
    const s = this.getScene();
    if (s?.world) this.lookAt(s.world.map.start.x + 0.5, s.world.map.start.y + 0.5);
    requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    this.renderer.domElement.remove();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.keys.clear();
  }

  /** Centra la cámara en un punto del mapa (en casillas). */
  lookAt(x: number, z: number): void {
    this.orbit = { ...this.orbit, tx: x, tz: z };
  }

  /** Gira la vista (radianes) — botones ⟲ ⟳. */
  rotateBy(d: number): void {
    this.orbit = { ...this.orbit, yaw: this.orbit.yaw + d };
  }

  /** Cambia la inclinación (radianes) — botón ∠. */
  tiltBy(d: number): void {
    this.orbit = { ...this.orbit, pitch: this.orbit.pitch + d };
  }

  /** Punto cardinal que queda arriba. */
  compass(): string {
    return northLabel3d(this.orbit.yaw);
  }

  private resize(): void {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private frame = (): void => {
    if (!this.running) return;
    requestAnimationFrame(this.frame);
    const scene = this.getScene();
    if (!scene || !scene.world) return;
    if (scene.world !== this.world) this.rebuild(scene.world);
    this.applyKeys();
    this.sync(scene);
    const w = this.world!;
    this.orbit = clampOrbit(this.orbit, w.map.width, w.map.height);
    const ty = tileTopY(w, Math.min(w.map.width - 1, Math.floor(this.orbit.tx)), Math.min(w.map.height - 1, Math.floor(this.orbit.tz)));
    const p = cameraPosition(this.orbit, ty);
    this.camera.position.set(p.x, p.y, p.z);
    this.camera.lookAt(this.orbit.tx, ty, this.orbit.tz);
    this.renderer.render(this.scene3, this.camera);
  };

  // --- Construcción de la escena -------------------------------------------------

  private rebuild(world: World): void {
    this.world = world;
    this.terrainKey = '';
    this.propKey = '';
    this.structVersion = -1;
    this.itemsVersion = -1;
    this.plantsVersion = -1;
    this.overlayKey = '';
    for (const s of this.colonistSprites.values()) this.scene3.remove(s);
    for (const s of this.carrySprites.values()) this.scene3.remove(s);
    this.colonistSprites.clear();
    this.carrySprites.clear();
    this.lookAt(world.map.start.x + 0.5, world.map.start.y + 0.5);
  }

  private sync(scene: WorldScene): void {
    const w = scene.world;
    const tKey = `${w.terrainVersion}:${w.propsVersion}`;
    if (`${w.terrainVersion}` !== this.terrainKey) {
      this.terrainKey = `${w.terrainVersion}`;
      this.buildTerrain(w);
    }
    if (tKey !== this.propKey) {
      this.propKey = tKey;
      this.buildProps(w);
    }
    if (this.orbit.yaw !== this.lastYaw) {
      this.lastYaw = this.orbit.yaw;
      this.faceProps();
    }
    if (w.structures.version !== this.structVersion) {
      this.structVersion = w.structures.version;
      this.buildStructures(w);
    }
    if (w.items.version !== this.itemsVersion) {
      this.itemsVersion = w.items.version;
      this.buildItems(w);
    }
    if (w.farms.version !== this.plantsVersion) {
      this.plantsVersion = w.farms.version;
      this.buildPlants(w);
    }
    this.buildOverlay(scene);
    this.syncColonists(scene);
    this.syncBars(w);
    this.syncLight(w);
  }

  private buildTerrain(w: World): void {
    const m = w.map;
    for (const mesh of [this.terrain, this.terrainSides, this.water]) {
      if (!mesh) continue;
      this.scene3.remove(mesh);
      mesh.geometry.dispose();
    }
    const geo = buildTerrainGeometry(m, (x, y) => tileTopY(w, x, y), BASE_H - 0.02);
    // La textura del suelo se pinta una vez por cambio de relieve (lleva las zanjas).
    this.groundTex?.dispose();
    const tex = pixelTexture(paintGroundTexture(m));
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.groundTex = tex;
    if (!this.topMat) {
      this.topMat = new THREE.MeshLambertMaterial({ map: tex });
      const bank = pixelTexture(paintBankTexture());
      bank.wrapS = bank.wrapT = THREE.RepeatWrapping;
      this.sideMat = new THREE.MeshLambertMaterial({ map: bank, vertexColors: true });
      this.waterMat = new THREE.MeshPhongMaterial({ color: 0x3f7590, transparent: true, opacity: 0.5, shininess: 90, specular: 0x8fb0c0, depthWrite: false });
    } else {
      this.topMat.map = tex;
      this.topMat.needsUpdate = true;
    }
    this.terrain = new THREE.Mesh(geo.tops, this.topMat);
    this.terrainSides = new THREE.Mesh(geo.sides, this.sideMat);
    this.water = new THREE.Mesh(geo.water, this.waterMat);
    this.terrain.receiveShadow = true;
    this.terrainSides.receiveShadow = true;
    this.terrainSides.castShadow = true;
    this.water.renderOrder = 1;
    this.scene3.add(this.terrain, this.terrainSides, this.water);
  }

  private propTexture(p: Prop, variant: number): THREE.CanvasTexture {
    const key = `${p}-${variant}`;
    let t = this.propTextures.get(key);
    if (!t) {
      const { c, ctx } = canvas(16, 16 + PROP_HEADROOM);
      drawProp(ctx, p, 0, PROP_HEADROOM, new Rng(variant * 7919 + p * 31));
      t = pixelTexture(c);
      this.propTextures.set(key, t);
    }
    return t;
  }

  /** Árboles, rocas y demás: carteles de pie (miran siempre a la cámara al girar). */
  private buildProps(w: World): void {
    for (const pm of this.propMeshes) {
      this.propGroup.remove(pm.mesh);
      pm.mesh.dispose();
    }
    this.propMeshes = [];
    const m = w.map;
    const groups = new Map<string, { p: Prop; variant: number; pos: THREE.Vector3[] }>();
    for (let y = 0; y < m.height; y++) {
      for (let x = 0; x < m.width; x++) {
        const p = m.props[y * m.width + x] as Prop;
        if (p === Prop.None) continue;
        const variant = Math.floor(hash(x + 911, y + 37) * PROP_VARIANTS);
        const key = `${p}-${variant}`;
        let g = groups.get(key);
        if (!g) groups.set(key, (g = { p, variant, pos: [] }));
        g.pos.push(new THREE.Vector3(x + 0.5, tileTopY(w, x, y), y + 0.5));
      }
    }
    const geo = new THREE.PlaneGeometry(1, 2);
    geo.translate(0, 1, 0);
    // Normales hacia arriba: se iluminan como el suelo de al lado (si no, a contraluz salen negros).
    const nor = geo.getAttribute('normal') as THREE.BufferAttribute;
    for (let i = 0; i < nor.count; i++) nor.setXYZ(i, 0, 1, 0);
    nor.needsUpdate = true;
    for (const g of groups.values()) {
      const mat = new THREE.MeshLambertMaterial({ map: this.propTexture(g.p, g.variant), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
      const mesh = new THREE.InstancedMesh(geo, mat, g.pos.length);
      mesh.castShadow = true;
      this.propGroup.add(mesh);
      this.propMeshes.push({ mesh, pos: g.pos });
    }
    this.lastYaw = NaN; // hay que orientarlos
  }

  private faceProps(): void {
    const mat = new THREE.Matrix4();
    const rot = new THREE.Matrix4().makeRotationY(this.orbit.yaw);
    for (const { mesh, pos } of this.propMeshes) {
      pos.forEach((p, i) => {
        mat.copy(rot).setPosition(p);
        mesh.setMatrixAt(i, mat);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }

  private clearGroup(g: THREE.Group): void {
    for (const child of [...g.children]) {
      g.remove(child);
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    }
  }

  private buildStructures(w: World): void {
    this.clearGroup(this.structGroup);
    for (const s of w.structures.all()) {
      for (const mesh of this.structureMeshes(w, s.def, w.structures.tilesOf(s), s.built ? (s.demolish ? 'demoler' : 'hecho') : 'plano', s.rot)) {
        this.structGroup.add(mesh);
      }
    }
  }

  /** Bloques de una construcción. `look`: terminada, plano (azulado), a demoler (rojiza) o fantasma (blanco). */
  private structureMeshes(w: World, def: BuildingDef, tiles: { x: number; y: number }[], look: 'hecho' | 'plano' | 'demoler' | 'fantasma' | 'no-cabe', rot: 0 | 1 = 0): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    const s = { def, x: tiles[0].x, y: tiles[0].y };
    {
      const xs = tiles.map((t) => t.x);
      const ys = tiles.map((t) => t.y);
      const x0 = Math.min(...xs);
      const y0 = Math.min(...ys);
      const sw = Math.max(...xs) - x0 + 1;
      const sh = Math.max(...ys) - y0 + 1;
      const base = tileTopY(w, s.x, s.y);
      const cat = s.def.category;
      const flat = s.def.height === 0;
      let height = flat ? 0.06 : s.def.height * WALL_H;
      let inset = 0;
      if (cat === 'defensa' && !flat) height = 0.5;
      if (cat === 'mueble' && !s.def.storage) height = 0.35;
      if (cat === 'taller') height = 0.8;
      if (cat === 'puerta' || cat === 'porton') inset = 0.3;
      if (cat === 'torre') inset = 0.12;
      if (cat === 'electricidad') {
        if (s.def.conduit) inset = 0.4;
        else if (s.def.light) {
          inset = 0.38;
          height = 0.9;
        } else if (s.def.source === 'solar') height = 0.25;
        else if (s.def.source === 'wind') inset = 0.35;
        else height = 0.7;
      }
      const ghost = look === 'fantasma' || look === 'no-cabe';
      const ghostColor = look === 'no-cabe' ? 0xff6a5a : 0xffffff;
      const face = new THREE.Color(ghost ? ghostColor : s.def.colors.face);
      const top = new THREE.Color(ghost ? ghostColor : s.def.colors.top);
      let mats: THREE.Material[];
      if (ghost || look === 'plano') {
        mats = [face, face, top, face, face, face].map((c) =>
          new THREE.MeshLambertMaterial({
            color: c,
            transparent: true,
            opacity: ghost ? 0.6 : 0.45,
            depthWrite: !ghost,
            emissive: new THREE.Color(look === 'plano' ? 0x1a3a6a : 0x999999),
          }),
        );
      } else {
        // Terminada: con la textura de su material (tablones, sillares, chapa…).
        const emissive = new THREE.Color(look === 'demoler' ? 0x601010 : 0);
        const sideMat = new THREE.MeshLambertMaterial({ map: this.surface(s.def, true), emissive });
        const topMap = cat === 'mueble' && !s.def.storage ? this.furnitureTop(s.def, sw, sh) : this.surface(s.def, false);
        const topMat = new THREE.MeshLambertMaterial({ map: topMap, emissive });
        mats = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];
      }
      // Puertas y portones, más finos en el sentido del paso.
      // Una puerta de una casilla girada se cruza de este a oeste en vez de norte a sur.
      const along = sw === sh ? rot === 0 : sw > sh;
      const gx = along ? sw : sw - inset * 2;
      const gz = along ? sh - inset * 2 : sh;
      const bx = cat === 'torre' ? sw - inset * 2 : gx;
      const bz = cat === 'torre' ? sh - inset * 2 : gz;
      const geo = new THREE.BoxGeometry(bx, height, bz);
      // La textura se repite una vez por casilla (salvo la cara de arriba de camas y similares).
      tileUVs(geo, bx, height, bz, cat === 'mueble' && !s.def.storage);
      const mesh = new THREE.Mesh(geo, mats);
      mesh.castShadow = !ghost && look !== 'plano' && height > 0.1;
      mesh.receiveShadow = !ghost;
      mesh.position.set(x0 + sw / 2, base + height / 2, y0 + sh / 2);
      out.push(mesh);
      if (cat === 'torre') {
        // Plataforma con barandilla.
        const platGeo = new THREE.BoxGeometry(sw + 0.1, 0.1, sh + 0.1);
        tileUVs(platGeo, sw + 0.1, 0.1, sh + 0.1, false);
        const plat = new THREE.Mesh(platGeo, ghost || look === 'plano'
          ? new THREE.MeshLambertMaterial({ color: top, transparent: true, opacity: ghost ? 0.55 : 0.45 })
          : new THREE.MeshLambertMaterial({ map: this.surface(s.def, false) }));
        plat.castShadow = !ghost;
        plat.position.set(x0 + sw / 2, base + height + 0.05, y0 + sh / 2);
        out.push(plat);
      }
    }
    return out;
  }

  /** Textura (que se repite) del material de una construcción. */
  private surface(def: BuildingDef, side: boolean): THREE.CanvasTexture {
    const key = `${def.id}-${side ? 'lado' : 'arriba'}`;
    let t = this.surfaceTex.get(key);
    if (!t) {
      t = pixelTexture(paintSurface(def, side));
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      this.surfaceTex.set(key, t);
    }
    return t;
  }

  /** Cara de arriba de una cama o un mueble: su dibujo de la vista 2D, entero. */
  private furnitureTop(def: BuildingDef, sw: number, sh: number): THREE.CanvasTexture {
    const key = `${def.id}-mueble-${sw}x${sh}`;
    let t = this.surfaceTex.get(key);
    if (!t) {
      const { c, ctx } = canvas(16 * sw, 16 * sh);
      drawBuilding(ctx, { ...def, height: 0 }, 16 * sw, 16 * sh, 0);
      t = pixelTexture(c);
      this.surfaceTex.set(key, t);
    }
    return t;
  }

  private itemTexture(r: string): THREE.CanvasTexture {
    const key = `item-${r}`;
    let t = this.textureCache.get(key);
    if (!t) {
      const { c, ctx } = canvas(ITEM_W, ITEM_H);
      paintItem(ctx, r as never);
      t = pixelTexture(c);
      this.textureCache.set(key, t);
    }
    return t;
  }

  private buildItems(w: World): void {
    this.clearGroup(this.itemGroup);
    for (const s of w.items.list()) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.itemTexture(s.resource), alphaTest: 0.5 }));
      sprite.center.set(0.5, 0);
      sprite.scale.set(0.7, 0.58, 1);
      sprite.position.set(s.x + 0.5, tileTopY(w, s.x, s.y), s.y + 0.5);
      this.itemGroup.add(sprite);
    }
  }

  private buildPlants(w: World): void {
    this.clearGroup(this.plantGroup);
    for (const { x, y, plant } of w.farms.plantList()) {
      const stage = plantStage(plant);
      const key = `crop-${plant.crop.id}-${stage}`;
      let t = this.textureCache.get(key);
      if (!t) {
        const { c, ctx } = canvas(CROP_SIZE, CROP_SIZE);
        paintCrop(ctx, plant.crop, stage);
        t = pixelTexture(c);
        this.textureCache.set(key, t);
      }
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, alphaTest: 0.5 }));
      sprite.center.set(0.5, 0.1);
      sprite.scale.set(0.9, 0.9, 1);
      sprite.position.set(x + 0.5, tileTopY(w, x, y), y + 0.5);
      this.plantGroup.add(sprite);
    }
  }

  /** Marcas planas sobre el suelo: almacenes, huertos, órdenes, obras y lo que se está arrastrando. */
  private buildOverlay(scene: WorldScene): void {
    const w = scene.world;
    const rect = scene.currentDesignRect();
    const key = [
      w.zones.version, w.farms.zoneVersion, w.designations.version, w.terrain.version, w.terrainVersion,
      rect ? `${rect.x0},${rect.y0},${rect.x1},${rect.y1},${scene.designMode},${scene.buildRot}` : '-',
    ].join(':');
    if (key === this.overlayKey) return;
    this.overlayKey = key;
    const marks: { x: number; y: number; color: number; alpha: number }[] = [];
    for (const z of w.zones.all()) for (const i of z.tiles) marks.push({ x: i % w.map.width, y: Math.floor(i / w.map.width), color: 0xd8c27a, alpha: 0.35 });
    for (const f of w.farms.all()) for (const i of f.tiles) marks.push({ x: i % w.map.width, y: Math.floor(i / w.map.width), color: 0x6a4a24, alpha: 0.6 });
    for (const d of w.designations.list()) marks.push({ x: d.x, y: d.y, color: DESIGN_COLORS[d.job], alpha: 0.7 });
    for (const o of w.terrain.list()) marks.push({ x: o.x, y: o.y, color: DESIGN_COLORS[o.job], alpha: 0.7 });
    if (rect && scene.designMode) {
      const mode = scene.designMode;
      if (mode === 'construir' && (buildingDef(scene.buildDefId).size ?? [1, 1]).reduce((a, b) => a * b, 1) > 1) {
        const def = buildingDef(scene.buildDefId);
        const ok = w.structures.canPlaceDef(def, rect.x0, rect.y0, scene.buildRot);
        for (const t of footprintTiles(def, rect.x0, rect.y0, scene.buildRot)) marks.push({ x: t.x, y: t.y, color: ok ? 0x8fc060 : 0xd9534f, alpha: 0.7 });
      } else {
        const xa = Math.max(0, Math.min(rect.x0, rect.x1));
        const xb = Math.min(w.map.width - 1, Math.max(rect.x0, rect.x1));
        const ya = Math.max(0, Math.min(rect.y0, rect.y1));
        const yb = Math.min(w.map.height - 1, Math.max(rect.y0, rect.y1));
        for (let y = ya; y <= yb; y++) {
          for (let x = xa; x <= xb; x++) {
            const edge = x === xa || x === xb || y === ya || y === yb;
            if (scene.designHitAt(x, y, edge)) marks.push({ x, y, color: DESIGN_COLORS[mode], alpha: 0.8 });
            else if (edge) marks.push({ x, y, color: 0xf0d7b0, alpha: 0.35 });
          }
        }
      }
    }
    // Fantasmas en blanco de lo que se va a construir.
    this.clearGroup(this.ghostGroup);
    if (rect && scene.designMode === 'construir') {
      const def = buildingDef(scene.buildDefId);
      for (const { tiles, ok } of scene.ghostGroups(rect)) {
        for (const mesh of this.structureMeshes(w, def, tiles, ok ? 'fantasma' : 'no-cabe', scene.buildRot)) this.ghostGroup.add(mesh);
      }
    }
    if (this.overlay) {
      this.scene3.remove(this.overlay);
      this.overlay.dispose();
      (this.overlay.material as THREE.Material).dispose();
      this.overlay = undefined;
    }
    if (marks.length === 0) return;
    const geo = new THREE.PlaneGeometry(0.94, 0.94);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }), marks.length);
    const mat = new THREE.Matrix4();
    const color = new THREE.Color();
    marks.forEach((k, i) => {
      mat.makeTranslation(k.x + 0.5, tileTopY(w, k.x, k.y) + 0.02, k.y + 0.5);
      mesh.setMatrixAt(i, mat);
      mesh.setColorAt(i, color.setHex(k.color).multiplyScalar(0.6 + k.alpha * 0.4));
    });
    mesh.renderOrder = 2;
    this.overlay = mesh;
    this.scene3.add(mesh);
  }

  private colonistTexture(c: Colonist): THREE.CanvasTexture {
    const key = `colonist-${colonistLookKey(c)}`;
    let t = this.textureCache.get(key);
    if (!t) {
      const { c: cv, ctx } = canvas(COLONIST_SIZE, COLONIST_SIZE);
      paintColonist(ctx, c);
      t = pixelTexture(cv);
      this.textureCache.set(key, t);
    }
    return t;
  }

  private syncColonists(scene: WorldScene): void {
    const w = scene.world;
    const pawns = w.pawns();
    const alive = new Set(pawns.map((c) => c.id));
    for (const [id, s] of this.colonistSprites) {
      if (!alive.has(id)) {
        this.scene3.remove(s);
        this.colonistSprites.delete(id);
        const carry = this.carrySprites.get(id);
        if (carry) this.scene3.remove(carry);
        this.carrySprites.delete(id);
      }
    }
    const selected = new Set(scene.selectedIds());
    for (const r of this.extraRings) this.scene3.remove(r);
    for (const f of this.flags) this.scene3.remove(f);
    this.extraRings = [];
    this.flags = [];
    this.ring.visible = false;
    for (const c of pawns) {
      let s = this.colonistSprites.get(c.id);
      if (!s) {
        s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.colonistTexture(c), alphaTest: 0.5 }));
        s.center.set(0.5, 0.1);
        s.scale.set(1, 1, 1);
        this.scene3.add(s);
        this.colonistSprites.set(c.id, s);
      }
      const tx = Math.max(0, Math.min(w.map.width - 1, c.tile.x));
      const ty = Math.max(0, Math.min(w.map.height - 1, c.tile.y));
      let y = tileTopY(w, tx, ty);
      const st = w.structures.at(tx, ty);
      if (st && st.built && st.def.category === 'torre') y += st.def.height * WALL_H + 0.1;
      const t = performance.now();
      const bob = c.activity === 'working' && w.speed > 0 ? Math.max(0, Math.sin(t / 70 + c.id)) * 0.08 : 0;
      const mat = s.material as THREE.SpriteMaterial;
      const tex = this.colonistTexture(c);
      if (mat.map !== tex) {
        mat.map = tex;
        mat.needsUpdate = true;
      }
      const carried = c.carriedBy !== undefined;
      s.position.set(c.pos.x, y + bob + (carried ? 0.55 : 0), c.pos.y);
      mat.rotation = c.activity === 'sleeping' || c.downed || carried ? Math.PI / 2 : 0;
      // Lo que lleva encima.
      let carry = this.carrySprites.get(c.id);
      if (c.carrying) {
        if (!carry) {
          carry = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.itemTexture(c.carrying.resource), alphaTest: 0.5 }));
          carry.scale.set(0.5, 0.42, 1);
          this.scene3.add(carry);
          this.carrySprites.set(c.id, carry);
        }
        (carry.material as THREE.SpriteMaterial).map = this.itemTexture(c.carrying.resource);
        carry.visible = true;
        carry.position.set(c.pos.x, y + 1.05, c.pos.y);
      } else if (carry) carry.visible = false;
      if (selected.has(c.id)) {
        const r = c.id === scene.selectedId ? this.ring : this.ring.clone();
        r.visible = true;
        r.position.set(c.pos.x, y + 0.03, c.pos.y);
        if (r !== this.ring) {
          this.extraRings.push(r);
          this.scene3.add(r);
        }
      }
      if (c.drafted) {
        const flag = new THREE.Mesh(this.flagGeo, this.flagMat);
        flag.position.set(c.pos.x, y + 1.25, c.pos.y);
        flag.rotation.x = Math.PI;
        this.flags.push(flag);
        this.scene3.add(flag);
      }
    }
  }

  /** Un sprite de barra libre (se crean al vuelo y se reutilizan). */
  private barSprite(color: number, order: number): THREE.Sprite {
    let s = this.bars[this.barsUsed];
    if (!s) {
      s = new THREE.Sprite(new THREE.SpriteMaterial({ color, depthTest: false, depthWrite: false, fog: false }));
      this.bars.push(s);
      this.scene3.add(s);
    }
    this.barsUsed++;
    (s.material as THREE.SpriteMaterial).color.setHex(color);
    s.renderOrder = order;
    s.visible = true;
    return s;
  }

  /**
   * Barra con fondo oscuro, siempre de cara a la cámara y por encima de todo. El relleno se
   * ancla en el borde izquierdo del fondo: con un ancho f·W, el centro 1/(2f) lo deja ahí.
   */
  private addBar(x: number, y: number, z: number, width: number, frac: number, color: number): void {
    const h = 0.11;
    const bg = this.barSprite(0x1a1410, 20);
    bg.center.set(0.5, 0.5);
    bg.scale.set(width + 0.06, h + 0.05, 1);
    bg.position.set(x, y, z);
    const f = Math.max(0.04, Math.min(1, frac));
    const fg = this.barSprite(color, 21);
    fg.center.set(1 / (2 * f), 0.5);
    fg.scale.set(width * f, h, 1);
    fg.position.set(x, y, z);
  }

  /** Lo mismo que en 2D: progreso de cada trabajo en marcha y salud de quien está herido. */
  private syncBars(w: World): void {
    this.barsUsed = 0;
    for (const c of w.colonists) {
      const j = c.job;
      if (!j || c.activity !== 'working' || !inBounds3(w, j.x, j.y)) continue;
      const st = w.structures.at(j.x, j.y);
      const above = st ? st.def.height * WALL_H : 0;
      const y = tileTopY(w, j.x, j.y) + Math.max(1.3, above + 0.4);
      this.addBar(j.x + 0.5, y, j.y + 0.5, 0.85, j.progress / j.work, DESIGN_COLORS[j.kind]);
    }
    for (const k of w.pawns()) {
      if (k.health >= 0.999 || k.carriedBy !== undefined) continue;
      const tx = Math.max(0, Math.min(w.map.width - 1, k.tile.x));
      const ty = Math.max(0, Math.min(w.map.height - 1, k.tile.y));
      let y = tileTopY(w, tx, ty);
      const st = w.structures.at(tx, ty);
      if (st && st.built && st.def.category === 'torre') y += st.def.height * WALL_H + 0.1;
      const color = k.health > 0.5 ? 0x7fae5a : k.health > 0.25 ? 0xd9a22b : 0xc8442c;
      this.addBar(k.pos.x, y + (k.downed ? 0.7 : 1.5), k.pos.y, 0.6, k.health, color);
    }
    for (let i = this.barsUsed; i < this.bars.length; i++) this.bars[i].visible = false;
  }

  /** Luz según la hora: mediodía claro, noche azulada y oscura. */
  private syncLight(w: World): void {
    const h = w.hour;
    const day = Math.max(0, Math.sin(((h - 6) / 14) * Math.PI)); // 6:00–20:00
    // De noche se ve menos, pero se sigue jugando: luz de luna azulada.
    this.sun.intensity = 0.35 + day * 1.9;
    this.sun.color.set(day > 0.25 ? 0xfff1dc : day > 0 ? 0xffb070 : 0x9fb4e0);
    this.ambient.intensity = 0.75 + day * 0.55;
    const sky = new THREE.Color().lerpColors(new THREE.Color(0x1c2434), new THREE.Color(0x9fb0bc), day);
    this.scene3.background = sky;
    const fog = this.scene3.fog as THREE.Fog;
    fog.color.copy(sky);
    fog.near = this.orbit.dist * 1.6;
    fog.far = this.orbit.dist * 4.5 + 40;
    // El sol (o la luna) sigue a la cámara para que las sombras cubran lo que se ve.
    const a = day > 0 ? ((h - 6) / 14) * Math.PI : 0.6;
    const tx = this.orbit.tx;
    const tz = this.orbit.tz;
    this.sun.position.set(tx + Math.cos(a) * 60, 45 + day * 50, tz - 35);
    this.sun.target.position.set(tx, 0, tz);
    const r = Math.min(60, this.orbit.dist * 1.3 + 8);
    const cam = this.sun.shadow.camera;
    if (cam.right !== r) {
      cam.left = -r;
      cam.right = r;
      cam.top = r;
      cam.bottom = -r;
      cam.near = 1;
      cam.far = 250;
      cam.updateProjectionMatrix();
    }
  }

  // --- Entrada -------------------------------------------------------------------

  /** Casilla real bajo un punto de la pantalla, o null. */
  private pickTile(sx: number, sy: number): { x: number; y: number } | null {
    if (!this.terrain || !this.world) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((sx - rect.left) / rect.width) * 2 - 1, -((sy - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObjects([this.terrain, ...(this.terrainSides ? [this.terrainSides] : [])], false)[0];
    if (!hit) return null;
    // Un poco hacia dentro de la cara tocada: la casilla dueña de esa cara.
    const n = hit.face?.normal ?? new THREE.Vector3(0, 1, 0);
    const x = Math.floor(hit.point.x - n.x * 0.01);
    const y = Math.floor(hit.point.z - n.z * 0.01);
    const m = this.world.map;
    if (x < 0 || y < 0 || x >= m.width || y >= m.height) return null;
    return { x, y };
  }

  private pickColonist(sx: number, sy: number): Colonist | undefined {
    if (!this.world) return undefined;
    const rect = this.renderer.domElement.getBoundingClientRect();
    let best: Colonist | undefined;
    let bestD = 28;
    for (const c of this.world.pawns()) {
      const s = this.colonistSprites.get(c.id);
      if (!s) continue;
      const p = s.position.clone().add(new THREE.Vector3(0, 0.45, 0)).project(this.camera);
      const px = rect.left + ((p.x + 1) / 2) * rect.width;
      const py = rect.top + ((1 - p.y) / 2) * rect.height;
      const d = Math.hypot(px - sx, py - sy);
      if (d < bestD) {
        best = c;
        bestD = d;
      }
    }
    return best;
  }

  /** Casillas por píxel en el punto mirado (para que el arrastre siga al dedo). */
  private unitsPerPixel(): number {
    const h = this.renderer.domElement.clientHeight || window.innerHeight;
    return (2 * this.orbit.dist * Math.tan((this.camera.fov * Math.PI) / 360)) / h;
  }

  private pointerDown(e: PointerEvent): void {
    this.renderer.domElement.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button });
    const scene = this.getScene();
    if (this.pointers.size === 2) {
      // Dos dedos: zoom, giro, inclinación y desplazamiento. Se anula el arrastre de órdenes.
      if (this.down?.design) scene.designFinish(false);
      this.down = undefined;
      this.startPinch();
      return;
    }
    const design = !!scene.designMode && e.button === 0;
    this.down = { x: e.clientX, y: e.clientY, button: e.button, time: performance.now(), moved: false, design };
    if (design) scene.designBegin(this.pickTile(e.clientX, e.clientY));
  }

  private startPinch(): void {
    const [a, b] = [...this.pointers.values()];
    this.pinch = {
      dist: Math.hypot(b.x - a.x, b.y - a.y),
      angle: Math.atan2(b.y - a.y, b.x - a.x),
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      orbit: { ...this.orbit },
    };
  }

  private pointerMove(e: PointerEvent): void {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) {
      // Sin pulsar: información de la casilla bajo el ratón.
      if (e.pointerType === 'mouse') {
        const t = this.pickTile(e.clientX, e.clientY);
        const scene = this.getScene();
        if (t) scene.reportTileAt(t);
        if (scene.designMode) scene.setDesignHover(t);
      }
      return;
    }
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: prev.button });
    if (this.pointers.size >= 2 && this.pinch) {
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const p0 = this.pinch;
      let o: OrbitState = { ...p0.orbit, dist: p0.orbit.dist * (p0.dist / Math.max(10, dist)), yaw: p0.orbit.yaw + (angle - p0.angle) };
      // Subir o bajar los dos dedos a la vez inclina la vista.
      o.pitch = p0.orbit.pitch + ((p0.mid.y - mid.y) / window.innerHeight) * 2;
      const u = this.unitsPerPixel();
      o = panOrbit(o, (mid.x - p0.mid.x) * u, 0);
      this.orbit = o;
      return;
    }
    const d = this.down;
    if (!d) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) d.moved = true;
    if (d.design) {
      this.getScene().designUpdate(this.pickTile(e.clientX, e.clientY));
      return;
    }
    if (d.button === 1 || (d.button === 0 && e.altKey)) {
      // Botón central (o Alt + arrastrar): pivotar la vista a cualquier ángulo e inclinación.
      this.orbit = { ...this.orbit, yaw: this.orbit.yaw - dx * 0.008, pitch: this.orbit.pitch + dy * 0.006 };
      return;
    }
    // Botón izquierdo o derecho, o un dedo: mover la cámara.
    const u = this.unitsPerPixel();
    this.orbit = panOrbit(this.orbit, dx * u, dy * u);
  }

  private pointerUp(e: PointerEvent, cancelled = false): void {
    const wasPinch = this.pointers.size >= 2;
    this.pointers.delete(e.pointerId);
    if (wasPinch) {
      this.pinch = undefined;
      return;
    }
    const d = this.down;
    this.down = undefined;
    if (!d) return;
    const scene = this.getScene();
    if (d.design) {
      scene.designFinish(!cancelled, e.pointerType !== 'mouse');
      return;
    }
    if (cancelled || d.moved || d.button === 1) return;
    scene.tapAt(this.pickColonist(e.clientX, e.clientY), this.pickTile(e.clientX, e.clientY), {
      right: d.button === 2,
      additive: e.shiftKey || e.ctrlKey || e.metaKey,
    });
  }

  private wheel(e: WheelEvent): void {
    e.preventDefault();
    this.orbit = { ...this.orbit, dist: this.orbit.dist * (e.deltaY > 0 ? 1.12 : 0.89) };
  }

  private keyDown(e: KeyboardEvent): void {
    const el = document.activeElement;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
    const k = e.key.toLowerCase();
    this.keys.add(k);
    if (k === 'q') this.rotateBy(Math.PI / 8);
    if (k === 'e') this.rotateBy(-Math.PI / 8);
    // Al construir, R gira lo que se va a poner (lo hace main.ts).
    if (k === 'r' && this.getScene().designMode !== 'construir') this.tiltBy(0.12);
    if (k === 'f') this.tiltBy(-0.12);
  }

  private applyKeys(): void {
    const step = this.orbit.dist * 0.012;
    let dx = 0;
    let dy = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) dx += step;
    if (this.keys.has('d') || this.keys.has('arrowright')) dx -= step;
    if (this.keys.has('w') || this.keys.has('arrowup')) dy += step;
    if (this.keys.has('s') || this.keys.has('arrowdown')) dy -= step;
    if (dx || dy) this.orbit = panOrbit(this.orbit, dx, dy);
  }
}

/**
 * Coordenadas de textura de una caja medidas en casillas, para que una textura que se repite
 * salga a escala (un tablón por casilla, no estirado). `wholeTop`: la cara de arriba entera.
 */
function tileUVs(geo: THREE.BoxGeometry, sx: number, sy: number, sz: number, wholeTop: boolean): void {
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  // Orden de caras de BoxGeometry: +x, −x, +y, −y, +z, −z (4 vértices cada una).
  const size: [number, number][] = [[sz, sy], [sz, sy], [sx, sz], [sx, sz], [sx, sy], [sx, sy]];
  for (let f = 0; f < 6; f++) {
    if (f === 2 && wholeTop) continue;
    const [u, v] = size[f];
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v);
    }
  }
  uv.needsUpdate = true;
}

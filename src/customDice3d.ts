import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { detectSoftwareWebGL, disposeSceneObject } from './pieces3d';

export type DiceMaterialStyleId =
  | 'marble_gold'
  | 'neon_cyber'
  | 'crystal_ice'
  | 'obsidian_ember'
  | 'wood_medieval';

export type DiceSymbolStyleId = 'classic_dots' | 'runic_numbers' | 'olympian_glyphs';
export type DiceEffectId = 'none' | 'gold_rim' | 'glow_aura';
export type DiceFaceNumber = 1 | 2 | 3 | 4 | 5 | 6;
export type DiceFaceMode = 'dots' | 'number' | 'roman' | 'rune' | 'symbol' | 'char';

export interface DiceFaceSpec {
  mode: DiceFaceMode;
  customGlyph?: string;
  bgColor?: string;
  pipColor?: string;
}

export type DiceFaceStylesMap = Partial<Record<DiceFaceNumber, DiceFaceSpec>>;

export interface CustomDiceConfig {
  id: string;
  nome: string;
  bodyColor: string;
  pipColor: string;
  edgeColor: string;
  materialStyle: DiceMaterialStyleId;
  symbolStyle: DiceSymbolStyleId;
  visualEffect: DiceEffectId;
  faceStyles?: DiceFaceStylesMap;
  premiumUnlockedRequired?: string;
  criadoEm: number;
}

export const DICE_PRESET_CATALOG: CustomDiceConfig[] = [
  {
    id: 'dice_olimpo_classico',
    nome: 'Ouro do Olimpo (Clássico)',
    bodyColor: '#f59e0b',
    pipColor: '#0f172a',
    edgeColor: '#fef08a',
    materialStyle: 'marble_gold',
    symbolStyle: 'classic_dots',
    visualEffect: 'gold_rim',
    criadoEm: 1
  },
  {
    id: 'dice_neon_cyber',
    nome: 'Matriz Neon Ciano',
    bodyColor: '#0f172a',
    pipColor: '#22d3ee',
    edgeColor: '#06b6d4',
    materialStyle: 'neon_cyber',
    symbolStyle: 'runic_numbers',
    visualEffect: 'glow_aura',
    criadoEm: 2
  },
  {
    id: 'dice_obsidiana_tartaro',
    nome: 'Brasa do Tártaro',
    bodyColor: '#1c1917',
    pipColor: '#f97316',
    edgeColor: '#dc2626',
    materialStyle: 'obsidian_ember',
    symbolStyle: 'olympian_glyphs',
    visualEffect: 'glow_aura',
    criadoEm: 3
  },
  {
    id: 'dice_cristal_olimpico',
    nome: 'Cristal Glacial',
    bodyColor: '#0284c7',
    pipColor: '#f8fafc',
    edgeColor: '#bae6fd',
    materialStyle: 'crystal_ice',
    symbolStyle: 'classic_dots',
    visualEffect: 'gold_rim',
    criadoEm: 4
  },
  {
    id: 'dice_madeira_medieval',
    nome: 'Carvalho Real',
    bodyColor: '#78350f',
    pipColor: '#fef3c7',
    edgeColor: '#d97706',
    materialStyle: 'wood_medieval',
    symbolStyle: 'runic_numbers',
    visualEffect: 'none',
    criadoEm: 5
  }
];

const PIP_LAYOUTS: Record<number, Array<[number, number]>> = {
  1: [[0.5, 0.5]],
  2: [
    [0.25, 0.25],
    [0.75, 0.75]
  ],
  3: [
    [0.25, 0.25],
    [0.5, 0.5],
    [0.75, 0.75]
  ],
  4: [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.25, 0.75],
    [0.75, 0.75]
  ],
  5: [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.5, 0.5],
    [0.25, 0.75],
    [0.75, 0.75]
  ],
  6: [
    [0.25, 0.22],
    [0.75, 0.22],
    [0.25, 0.5],
    [0.75, 0.5],
    [0.25, 0.78],
    [0.75, 0.78]
  ]
};

const OLYMPIAN_GLYPHS: Record<number, string> = {
  1: '⚡',
  2: '🔱',
  3: '🦉',
  4: '🏛️',
  5: '🛡️',
  6: '👑'
};

const RUNIC_GLYPHS: Record<number, string> = {
  1: 'ᚠ',
  2: 'ᚢ',
  3: 'ᚦ',
  4: 'ᚨ',
  5: 'ᚱ',
  6: 'ᛟ'
};

const ROMAN_GLYPHS: Record<number, string> = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
  5: 'V',
  6: 'VI'
};

export function sanitizeDiceGlyph(raw: unknown): string {
  const cleaned = String(raw ?? '')
    .replace(/[<>"'`\\/\n\r\t]/g, '')
    .trim();
  if (!cleaned) return '';
  return Array.from(cleaned).slice(0, 2).join('');
}

export function resolveDiceFaceRenderSpec(
  cfg: Partial<CustomDiceConfig> | null | undefined,
  faceValue: DiceFaceNumber
): {
  mode: DiceFaceMode;
  text: string;
  bgColor: string;
  pipColor: string;
  edgeColor: string;
} {
  const bodyColor = cfg?.bodyColor || '#f59e0b';
  const defaultPip = cfg?.pipColor || '#0f172a';
  const edgeColor = cfg?.edgeColor || '#fef08a';
  const fallbackMode: DiceFaceMode =
    cfg?.symbolStyle === 'runic_numbers'
      ? 'roman'
      : cfg?.symbolStyle === 'olympian_glyphs'
      ? 'symbol'
      : 'dots';

  const override = cfg?.faceStyles?.[faceValue];
  const mode: DiceFaceMode = override?.mode || fallbackMode;
  const bgColor =
    override?.bgColor && /^#[0-9a-f]{6}$/i.test(override.bgColor) ? override.bgColor : bodyColor;
  const pipColor =
    override?.pipColor && /^#[0-9a-f]{6}$/i.test(override.pipColor) ? override.pipColor : defaultPip;

  const customGlyph = sanitizeDiceGlyph(override?.customGlyph);
  let text = String(faceValue);
  if (mode === 'number') text = String(faceValue);
  else if (mode === 'roman') text = ROMAN_GLYPHS[faceValue] || String(faceValue);
  else if (mode === 'rune') text = RUNIC_GLYPHS[faceValue] || String(faceValue);
  else if (mode === 'symbol') text = customGlyph || OLYMPIAN_GLYPHS[faceValue] || String(faceValue);
  else if (mode === 'char') text = customGlyph || String(faceValue);

  return { mode, text, bgColor, pipColor, edgeColor };
}

function createDiceFaceTexture(
  faceValue: DiceFaceNumber,
  cfg: CustomDiceConfig,
  maxAnisotropy = 4
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const spec = resolveDiceFaceRenderSpec(cfg, faceValue);
  ctx.fillStyle = spec.bgColor;
  ctx.fillRect(0, 0, size, size);

  // Subtle surface grain by material
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 40; i++) {
    ctx.fillRect((i * 47) % size, (i * 83) % size, 12, 2);
  }

  // Rim frame
  ctx.strokeStyle = spec.edgeColor;
  ctx.lineWidth = cfg.visualEffect === 'gold_rim' || cfg.visualEffect === 'glow_aura' ? 14 : 6;
  ctx.strokeRect(10, 10, size - 20, size - 20);

  // Face symbols (purely visual — never biases RNG)
  ctx.fillStyle = spec.pipColor;
  if (spec.mode === 'dots') {
    const pts = PIP_LAYOUTS[faceValue] || PIP_LAYOUTS[1];
    for (const [nx, ny] of pts) {
      ctx.beginPath();
      ctx.arc(nx * size, ny * size, 22, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.font = spec.mode === 'roman' ? 'bold 96px serif' : 'bold 104px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(spec.text, size / 2, size / 2 + 4);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.max(1, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

export function buildCustomDiceMesh(
  cfg: CustomDiceConfig,
  maxAnisotropy = 4
): THREE.Group {
  const group = new THREE.Group();
  const isMetallic = cfg.materialStyle === 'marble_gold';
  const isCrystal = cfg.materialStyle === 'crystal_ice';
  const isEmissive = cfg.materialStyle === 'neon_cyber' || cfg.visualEffect === 'glow_aura';

  const materials: THREE.MeshStandardMaterial[] = [];
  // Order of BoxGeometry faces: +X(2), -X(4), +Y(5), -Y(6), +Z(1), -Z(3)
  const faceOrder: DiceFaceNumber[] = [2, 4, 5, 6, 1, 3];
  for (const val of faceOrder) {
    const tex = createDiceFaceTexture(val, cfg, maxAnisotropy);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: isCrystal ? 0.16 : isMetallic ? 0.25 : cfg.materialStyle === 'wood_medieval' ? 0.78 : 0.42,
      metalness: isMetallic ? 0.55 : isCrystal ? 0.2 : 0.12,
      emissive: isEmissive ? new THREE.Color(cfg.pipColor || '#22d3ee') : new THREE.Color(0x000000),
      emissiveIntensity: isEmissive ? 0.18 : 0
    });
    materials.push(mat);
  }

  const cube = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.15, 1.15), materials);
  cube.position.y = 0.65;
  cube.castShadow = true;
  group.add(cube);

  // Ornamental gold/neon frame corners (3-part composite hero)
  if (cfg.visualEffect === 'gold_rim' || cfg.visualEffect === 'glow_aura') {
    const trimMat = new THREE.MeshStandardMaterial({
      color: cfg.edgeColor || '#fbbf24',
      roughness: 0.22,
      metalness: 0.88,
      emissive: cfg.visualEffect === 'glow_aura' ? new THREE.Color(cfg.edgeColor || '#22d3ee') : new THREE.Color(0x000000),
      emissiveIntensity: cfg.visualEffect === 'glow_aura' ? 0.4 : 0
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.03, 10, 36), trimMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.06;
    group.add(ring);
  }

  return group;
}

// IndexedDB persistence for user-created Dice Presets
const DICE_DB_NAME = 'LegadoImortaisDiceDB';
const DICE_DB_VERSION = 1;
const DICE_STORE = 'dados_3d';

function openDiceDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponível.'));
      return;
    }
    const req = indexedDB.open(DICE_DB_NAME, DICE_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DICE_STORE)) {
        db.createObjectStore(DICE_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Erro ao abrir banco de dados 3D.'));
  });
}

export const CustomDiceStorage = {
  async listar(): Promise<CustomDiceConfig[]> {
    const db = await openDiceDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DICE_STORE, 'readonly');
      const req = tx.objectStore(DICE_STORE).getAll();
      req.onsuccess = () => resolve((req.result || []) as CustomDiceConfig[]);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  },
  async salvar(cfg: CustomDiceConfig): Promise<void> {
    const clean: CustomDiceConfig = {
      ...cfg,
      id: String(cfg.id || `dice_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 48),
      nome: String(cfg.nome || 'Dado Personalizado').replace(/[<>"'`]/g, '').trim().substring(0, 30) || 'Dado 3D',
      criadoEm: Number(cfg.criadoEm) || Date.now()
    };
    const db = await openDiceDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DICE_STORE, 'readwrite');
      tx.objectStore(DICE_STORE).put(clean);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  },
  async remover(id: string): Promise<void> {
    const db = await openDiceDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DICE_STORE, 'readwrite');
      tx.objectStore(DICE_STORE).delete(id);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  }
};

export interface DicePreviewController {
  setDiceConfig: (cfg: CustomDiceConfig) => void;
  rollShowcase: () => void;
  dispose: () => void;
}

export function mountDiceWorkshopPreview(
  container: HTMLElement,
  initialCfg: CustomDiceConfig
): DicePreviewController {
  container.innerHTML = '';
  const width = Math.max(container.clientWidth || 260, 220);
  const height = Math.max(container.clientHeight || 220, 200);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  const isSoftGl = detectSoftwareWebGL(renderer);

  renderer.setPixelRatio(isSoftGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x090f1e);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;

  scene.add(new THREE.HemisphereLight(0xf8fafc, 0x0f172a, 0.95));
  const dir = new THREE.DirectionalLight(0xfffbeb, 2.2);
  dir.position.set(3, 5, 4);
  scene.add(dir);

  const camera = new THREE.PerspectiveCamera(40, width / height, 0.2, 20);
  camera.position.set(1.8, 1.9, 2.3);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.6, 0);
  controls.enableDamping = !isSoftGl;
  controls.autoRotate = !isSoftGl;
  controls.autoRotateSpeed = 2.2;
  controls.update();

  let diceGroup = buildCustomDiceMesh(initialCfg, renderer.capabilities.getMaxAnisotropy());
  scene.add(diceGroup);

  let spinBoostUntil = 0;
  let disposed = false;
  let rafId = 0;
  let lastDraw = 0;

  const tick = (now: number) => {
    if (disposed) return;
    rafId = requestAnimationFrame(tick);
    if (isSoftGl && now - lastDraw < 90) return;
    lastDraw = now;
    if (now < spinBoostUntil) {
      diceGroup.rotation.x += 0.16;
      diceGroup.rotation.y += 0.21;
    }
    controls.update();
    renderer.render(scene, camera);
  };
  rafId = requestAnimationFrame(tick);

  return {
    setDiceConfig(cfg: CustomDiceConfig) {
      if (disposed) return;
      scene.remove(diceGroup);
      disposeSceneObject(diceGroup);
      diceGroup = buildCustomDiceMesh(cfg, renderer.capabilities.getMaxAnisotropy());
      scene.add(diceGroup);
      renderer.render(scene, camera);
    },
    rollShowcase() {
      spinBoostUntil = performance.now() + 850;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(rafId);
      controls.dispose();
      disposeSceneObject(diceGroup);
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    }
  };
}

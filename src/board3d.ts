import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  CustomPieceRecord,
  PresetPieceId,
  buildPieceGroupFromRecord,
  buildPresetPieceModel,
  disposeSceneObject,
  detectSoftwareWebGL,
  isWebGLAvailable
} from './pieces3d';
import {
  RigAnimationMode,
  DEFAULT_CHARACTER_CONFIG,
  buildCharacterPieceModel,
  updateCharacterRigAnimation
} from './characterBuilder3d';

export interface BoardPlayerDescriptor {
  id: number;
  nome: string;
  deusId: string;
  pos: number;
  falido?: boolean;
  peca3d?: CustomPieceRecord | null;
}

export interface BoardBuildingDescriptor {
  tileId: number;
  nivel: number; // 0=none, 1..3=Templo, 4=Santuário Supremo
  donoId: number | null;
  corHex?: string;
}

export type CinematicMode = 'full' | 'simple' | 'off';

export type CinematicVfxKind = 'buy' | 'upgrade' | 'rent' | 'oracle' | 'prison' | 'victory';

export interface CinematicEventOptions {
  playerId?: number;
  tileIndex?: number;
  tileIdx?: number;
  kind?: CinematicVfxKind;
  colorHex?: string;
  durationMs?: number;
  reactionMode?: RigAnimationMode;
  onStart?: () => void;
  onEnd?: () => void;
}

const TILE_PCT_COORDS: ReadonlyArray<{ top: number; left: number }> = [
  { top: 10, left: 10 },
  { top: 10, left: 36 },
  { top: 10, left: 63 },
  { top: 10, left: 90 },
  { top: 36, left: 90 },
  { top: 63, left: 90 },
  { top: 90, left: 90 },
  { top: 90, left: 63 },
  { top: 90, left: 36 },
  { top: 90, left: 10 },
  { top: 63, left: 10 },
  { top: 36, left: 10 }
];

export function computeFlexibleGridDims(totalTiles: number): { cols: number; rows: number } {
  const n = Math.max(8, Math.min(24, Math.round(totalTiles || 12)));
  if (n <= 8) return { cols: 3, rows: 3 };
  if (n <= 10) return { cols: 4, rows: 3 };
  if (n <= 12) return { cols: 4, rows: 4 };
  if (n <= 14) return { cols: 5, rows: 4 };
  if (n <= 16) return { cols: 5, rows: 5 };
  if (n <= 18) return { cols: 6, rows: 5 };
  if (n <= 20) return { cols: 6, rows: 6 };
  if (n <= 22) return { cols: 7, rows: 6 };
  return { cols: 7, rows: 7 };
}

export function computePerimeterPctCoords(gridSideOrCols = 4, rowsOpt?: number): Array<{ top: number; left: number }> {
  const cols = Math.max(3, Math.min(7, Math.round(gridSideOrCols || 4)));
  const rows = Math.max(3, Math.min(7, Math.round(rowsOpt || cols)));
  const xCenters: number[] = [];
  const yCenters: number[] = [];
  for (let c = 0; c < cols; c++) xCenters.push(Number((((c + 0.5) / cols) * 100).toFixed(2)));
  for (let r = 0; r < rows; r++) yCenters.push(Number((((r + 0.5) / rows) * 100).toFixed(2)));

  const coords: Array<{ top: number; left: number }> = [];
  for (let c = 0; c < cols; c++) coords.push({ top: yCenters[0], left: xCenters[c] });
  for (let r = 1; r < rows - 1; r++) coords.push({ top: yCenters[r], left: xCenters[cols - 1] });
  for (let c = cols - 1; c >= 0; c--) coords.push({ top: yCenters[rows - 1], left: xCenters[c] });
  for (let r = rows - 2; r >= 1; r--) coords.push({ top: yCenters[r], left: xCenters[0] });
  return coords;
}

export function computeFlexiblePerimeterPctCoords(totalTiles = 12): Array<{ top: number; left: number }> {
  const safeTotal = Math.max(8, Math.min(24, Math.round(totalTiles || 12)));
  if (safeTotal === 12) return TILE_PCT_COORDS.map((p) => ({ ...p }));
  const { cols, rows } = computeFlexibleGridDims(safeTotal);
  const perimCount = 2 * cols + 2 * (rows - 2);
  if (perimCount === safeTotal) {
    return computePerimeterPctCoords(cols, rows);
  }
  const marginX = 10;
  const marginY = 10;
  const spanX = 80;
  const spanY = 80;
  const coords: Array<{ top: number; left: number }> = [];
  for (let i = 0; i < safeTotal; i++) {
    const u = (i / safeTotal) * 4;
    let left = marginX;
    let top = marginY;
    if (u < 1) {
      left = marginX + u * spanX;
      top = marginY;
    } else if (u < 2) {
      left = marginX + spanX;
      top = marginY + (u - 1) * spanY;
    } else if (u < 3) {
      left = marginX + (1 - (u - 2)) * spanX;
      top = marginY + spanY;
    } else {
      left = marginX;
      top = marginY + (1 - (u - 3)) * spanY;
    }
    coords.push({ top: Number(top.toFixed(2)), left: Number(left.toFixed(2)) });
  }
  return coords;
}

const PLAYER_TILE_OFFSETS: ReadonlyArray<[number, number]> = [
  [-0.22, -0.18],
  [0.22, -0.18],
  [-0.22, 0.18],
  [0.22, 0.18]
];

const BOARD_WORLD_SPAN = 6.8;

export function computeTileWorldPosition(
  tileIndex: number,
  playerId: number,
  out = new THREE.Vector3(),
  totalTiles = 12
): THREE.Vector3 {
  const safeTotal = Math.max(8, Math.min(24, Math.round(totalTiles || 12)));
  const pctList = computeFlexiblePerimeterPctCoords(safeTotal);
  const safeTile = ((Math.floor(tileIndex) % safeTotal) + safeTotal) % safeTotal;
  const pct = pctList[safeTile] || pctList[0];
  const offsetIdx = Math.max(0, Math.min(3, (playerId || 1) - 1));
  const [ox, oz] = PLAYER_TILE_OFFSETS[offsetIdx];
  const scaleOffset = safeTotal >= 20 ? 0.68 : safeTotal >= 15 ? 0.82 : 1.0;

  const x = (pct.left / 100 - 0.5) * BOARD_WORLD_SPAN + ox * scaleOffset;
  const z = (pct.top / 100 - 0.5) * BOARD_WORLD_SPAN + oz * scaleOffset;
  return out.set(x, 0, z);
}

export function normalizeAngleRad(a: number): number {
  let res = a;
  while (res > Math.PI) res -= Math.PI * 2;
  while (res < -Math.PI) res += Math.PI * 2;
  return res;
}

export function computeFacingYaw(fromPos: THREE.Vector3, toPos: THREE.Vector3): number {
  const dx = toPos.x - fromPos.x;
  const dz = toPos.z - fromPos.z;
  if (Math.hypot(dx, dz) < 0.001) return 0;
  return Math.atan2(dx, dz);
}

interface ActorState {
  playerId: number;
  signature: string;
  pivot: THREE.Group;
  model: THREE.Group;
  currentPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  currentYaw: number;
  targetYaw: number;
  animMode: RigAnimationMode;
  reactionMode: RigAnimationMode;
  reactionUntil: number;
  celebrateUntil: number;
  walkUntil: number;
  falido: boolean;
}

interface BuildingState {
  tileId: number;
  nivel: number;
  ownerColor: string;
  group: THREE.Group;
  haloMesh?: THREE.Object3D;
  riseProgress: number;
}

const OWNER_HEX_PALETTE: Record<number, string> = {
  1: '#ef4444',
  2: '#3b82f6',
  3: '#10b981',
  4: '#a855f7'
};

function computeBuildingWorldPosition(
  tileIndex: number,
  out = new THREE.Vector3(),
  totalTiles = 12
): THREE.Vector3 {
  const safeTotal = Math.max(8, Math.min(24, Math.round(totalTiles || 12)));
  const pctList = computeFlexiblePerimeterPctCoords(safeTotal);
  const safeTile = ((Math.floor(tileIndex) % safeTotal) + safeTotal) % safeTotal;
  const pct = pctList[safeTile] || pctList[0];
  const tx = (pct.left / 100 - 0.5) * BOARD_WORLD_SPAN;
  const tz = (pct.top / 100 - 0.5) * BOARD_WORLD_SPAN;
  // Pull slightly inward toward the center plaza so temples frame the tile without blocking pawns
  const len = Math.hypot(tx, tz) || 1;
  const pull = safeTotal >= 20 ? 0.34 : safeTotal >= 15 ? 0.38 : 0.42;
  return out.set(tx - (tx / len) * pull, 0, tz - (tz / len) * pull);
}

function buildTempleOrSanctuaryMesh(
  nivel: number,
  ownerColorHex: string
): { group: THREE.Group; haloMesh?: THREE.Object3D } {
  const group = new THREE.Group();
  const isSanctuary = nivel >= 4;
  const marbleMat = new THREE.MeshStandardMaterial({
    color: isSanctuary ? 0xfef3c7 : 0xf1f5f9,
    roughness: 0.35,
    metalness: 0.15
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(ownerColorHex || '#f59e0b'),
    roughness: 0.28,
    metalness: 0.72
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    roughness: 0.22,
    metalness: 0.85,
    emissive: new THREE.Color(isSanctuary ? 0xd97706 : 0x451a03),
    emissiveIntensity: isSanctuary ? 0.42 : 0.16
  });

  if (isSanctuary) {
    // Nível 4: Santuário Supremo (Rotunda de acrópole, colunata circular, obelisco cristalino e halo celestial)
    const base1 = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.08, 12), marbleMat);
    base1.position.y = 0.04;
    const base2 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.07, 12), trimMat);
    base2.position.y = 0.115;
    group.add(base1, base2);

    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 0.36, 8), marbleMat);
      col.position.set(Math.cos(ang) * 0.24, 0.33, Math.sin(ang) * 0.24);
      col.castShadow = true;
      group.add(col);
    }

    const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.08, 12), goldMat);
    dome.position.y = 0.54;
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.34, 6), goldMat);
    spire.position.y = 0.75;
    group.add(dome, spire);

    const haloMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: new THREE.Color(0xfbbf24),
      emissiveIntensity: 0.65,
      roughness: 0.15,
      metalness: 0.9
    });
    const haloMesh = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.025, 8, 24), haloMat);
    haloMesh.position.y = 0.88;
    haloMesh.rotation.x = Math.PI * 0.36;
    group.add(haloMesh);
    return { group, haloMesh };
  }

  // Níveis 1..3: Templos progressivos (zero casas/hotéis)
  const bayWidth = nivel === 1 ? 0.32 : nivel === 2 ? 0.44 : 0.56;
  const bayDepth = nivel === 1 ? 0.26 : nivel === 2 ? 0.32 : 0.36;
  const colCount = nivel === 1 ? 2 : nivel === 2 ? 4 : 6;
  const height = nivel === 1 ? 0.26 : nivel === 2 ? 0.32 : 0.4;

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(bayWidth + 0.08, 0.07, bayDepth + 0.08), marbleMat);
  plinth.position.y = 0.035;
  plinth.castShadow = true;
  group.add(plinth);

  const trimBand = new THREE.Mesh(new THREE.BoxGeometry(bayWidth + 0.04, 0.03, bayDepth + 0.04), trimMat);
  trimBand.position.y = 0.085;
  group.add(trimBand);

  const colsPerRow = Math.max(2, Math.round(colCount / 2));
  for (let r = -1; r <= 1; r += 2) {
    for (let c = 0; c < colsPerRow; c++) {
      const fx = colsPerRow === 1 ? 0 : -bayWidth * 0.38 + (c / (colsPerRow - 1)) * (bayWidth * 0.76);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.03, height, 8), marbleMat);
      col.position.set(fx, 0.1 + height * 0.5, r * bayDepth * 0.36);
      col.castShadow = true;
      group.add(col);
    }
  }

  // Pediment roof
  const roofBase = new THREE.Mesh(new THREE.BoxGeometry(bayWidth + 0.05, 0.04, bayDepth + 0.05), trimMat);
  roofBase.position.y = 0.1 + height + 0.02;
  const pediment = new THREE.Mesh(new THREE.ConeGeometry(Math.max(bayWidth, bayDepth) * 0.58, 0.14, 4), goldMat);
  pediment.position.y = 0.1 + height + 0.11;
  pediment.rotation.y = Math.PI / 4;
  pediment.castShadow = true;
  group.add(roofBase, pediment);

  return { group };
}

function buildSignature(p: BoardPlayerDescriptor): string {
  if (p.peca3d) {
    return `${p.peca3d.id}_${p.peca3d.estiloVisual || 'stylized3d'}_${JSON.stringify(p.peca3d.coresPorRegiao || {})}_${p.peca3d.escala || 1}_${JSON.stringify(p.peca3d.characterConfig || {})}`;
  }
  return `deus_${p.deusId || 'zeus'}`;
}

async function buildActorModelForPlayer(
  p: BoardPlayerDescriptor,
  lowDetail: boolean
): Promise<THREE.Group> {
  if (p.peca3d) {
    return buildPieceGroupFromRecord({
      ...p.peca3d,
      detalheReduzido: p.peca3d.detalheReduzido ?? lowDetail
    });
  }

  // Stylized mythological avatar matching player's selected God even when Classic is active
  const deus = (p.deusId || 'zeus').toLowerCase();
  if (deus === 'atena') {
    return buildPresetPieceModel('owl', '#10b981', lowDetail, 'stylized3d');
  }
  if (deus === 'poseidon') {
    return buildCharacterPieceModel(
      {
        ...DEFAULT_CHARACTER_CONFIG,
        estiloVisual: 'stylized3d',
        cabelo: 'longo_fluido',
        roupa: 'tunica_olimpica',
        armadura: 'ouro_celestial',
        acessorio: 'lanca_olimpica',
        coresPorRegiao: {
          roupa: '#0e7490',
          armadura: '#38bdf8',
          peitoral: '#0284c7',
          detalhes: '#fbbf24',
          acessorios: '#22d3ee',
          pele: '#eab68c',
          cabelo: '#0f172a',
          calcado: '#0369a1'
        }
      },
      lowDetail
    );
  }
  if (deus === 'hades') {
    return buildPresetPieceModel('wolf' as PresetPieceId, '#9333ea', lowDetail, 'stylized3d');
  }
  // Zeus default champion
  return buildCharacterPieceModel(
    {
      ...DEFAULT_CHARACTER_CONFIG,
      estiloVisual: 'stylized3d',
      cabelo: 'topete_real',
      roupa: 'capa_real',
      armadura: 'ouro_celestial',
      acessorio: 'coroa_louros',
      coresPorRegiao: {
        roupa: '#b45309',
        armadura: '#fbbf24',
        peitoral: '#f59e0b',
        asas: '#dc2626',
        detalhes: '#fef08a',
        acessorios: '#fde047',
        pele: '#eab68c',
        cabelo: '#f8fafc',
        calcado: '#78350f'
      }
    },
    lowDetail
  );
}

export interface Board3DStageController {
  syncPlayers: (players: BoardPlayerDescriptor[], totalTiles?: number) => Promise<void>;
  syncBuildings: (buildings: BoardBuildingDescriptor[], totalTiles?: number) => void;
  setTotalTiles: (totalTiles: number) => void;
  stepPlayer: (playerId: number, fromTile: number, toTile: number) => void;
  teleportPlayer: (playerId: number, tile: number) => void;
  celebrateArrival: (playerId: number, durationMs?: number) => void;
  playActorReaction: (playerId: number, mode: RigAnimationMode, durationMs?: number) => void;
  setCinematicMode: (mode: CinematicMode) => void;
  getCinematicMode: () => CinematicMode;
  playCinematicEvent: (opts: CinematicEventOptions) => Promise<void>;
  skipActiveCinematic: () => void;
  setLowDetail: (enabled: boolean) => void;
  resize: () => void;
  isActive: () => boolean;
  dispose: () => void;
}

export function mountBoard3DStage(
  boardEl: HTMLElement,
  initialLowDetail = false
): Board3DStageController | null {
  if (typeof document === 'undefined' || !isWebGLAvailable()) {
    return null;
  }

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: !initialLowDetail });
  } catch {
    return null;
  }

  const isSoftGl = detectSoftwareWebGL(renderer);
  const lowMode = initialLowDetail || isSoftGl;
  let currentLowDetail = lowMode;

  const canvas = renderer.domElement;
  canvas.id = 'board-3d-stage-canvas';
  canvas.className = 'absolute inset-0 w-full h-full pointer-events-none z-25 rounded-2xl';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '25';
  boardEl.appendChild(canvas);

  const w = Math.max(boardEl.clientWidth || 400, 280);
  const h = Math.max(boardEl.clientHeight || 400, 280);

  renderer.setPixelRatio(lowMode ? 1 : Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(w, h, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = !lowMode;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;

  const hemi = new THREE.HemisphereLight(0xf8fafc, 0x0f172a, 0.95);
  scene.add(hemi);

  const dirLight = new THREE.DirectionalLight(0xfffbeb, 2.2);
  dirLight.position.set(4.5, 9.5, 5.0);
  if (!lowMode) {
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
  }
  scene.add(dirLight);

  // Transparent shadow catcher plane at y=0
  const shadowFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.ShadowMaterial({ opacity: 0.34 })
  );
  shadowFloor.rotation.x = -Math.PI / 2;
  shadowFloor.receiveShadow = true;
  scene.add(shadowFloor);

  const disableFrustumCulling = (root: THREE.Object3D) => {
    root.traverse((obj) => {
      obj.frustumCulled = false;
    });
  };

  const baseCamPos = new THREE.Vector3(0, 9.4, 4.65);
  const baseLookAt = new THREE.Vector3(0, 0.2, 0.15);

  const aspect = Math.max(0.55, w / h);
  const initialFov = aspect < 0.98 ? Math.min(62, 42 / aspect) : 42;
  const camera = new THREE.PerspectiveCamera(initialFov, w / h, 0.2, 80);
  camera.position.copy(baseCamPos);
  camera.lookAt(baseLookAt);

  const activeCamPos = baseCamPos.clone();
  const activeLookAt = baseLookAt.clone();
  const actors = new Map<number, ActorState>();
  const buildings = new Map<number, BuildingState>();
  interface ActiveVfxEffect {
    group: THREE.Group;
    ring: THREE.Mesh;
    beacon: THREE.Mesh;
    sparks: Array<{ mesh: THREE.Mesh; vx: number; vy: number; vz: number }>;
    startedAt: number;
    durationMs: number;
  }
  const activeVfxList: ActiveVfxEffect[] = [];

  let totalTilesCount = 12;
  let cinematicMode: CinematicMode = 'full';
  let activeCinematicResolve: (() => void) | null = null;
  let activeCinematicTimer: ReturnType<typeof setTimeout> | null = null;
  let cinematicFocusUntil = 0;
  const cinematicTargetPos = new THREE.Vector3();
  const cinematicTargetLook = new THREE.Vector3();
  let disposed = false;
  let contextLost = false;
  let rafId = 0;
  let prevNow = performance.now();
  const startClock = prevNow;
  let lastSoftDraw = 0;

  const clearAllVfx = () => {
    while (activeVfxList.length > 0) {
      const fx = activeVfxList.pop()!;
      scene.remove(fx.group);
      disposeSceneObject(fx.group);
    }
  };

  const spawnCinematicVfx = (worldPos: THREE.Vector3, kind: CinematicVfxKind = 'upgrade', customHex?: string) => {
    const colorMap: Record<CinematicVfxKind, string> = {
      buy: '#10b981',
      upgrade: '#f59e0b',
      rent: '#ef4444',
      oracle: '#06b6d4',
      prison: '#dc2626',
      victory: '#fbbf24'
    };
    const hex = customHex || colorMap[kind] || '#fbbf24';
    const fxGroup = new THREE.Group();
    fxGroup.position.set(worldPos.x, 0.04, worldPos.z);

    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(hex),
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.28, 28), ringMat);
    ring.rotation.x = -Math.PI / 2;
    fxGroup.add(ring);

    const beaconMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(hex),
      transparent: true,
      opacity: 0.48
    });
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.34, 2.2, 16, 1, true), beaconMat);
    beacon.position.y = 1.1;
    fxGroup.add(beacon);

    const sparks: Array<{ mesh: THREE.Mesh; vx: number; vy: number; vz: number }> = [];
    const sparkCount = currentLowDetail ? 6 : 12;
    for (let i = 0; i < sparkCount; i++) {
      const ang = (i / sparkCount) * Math.PI * 2;
      const spd = 0.7 + (i % 3) * 0.35;
      const sMesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.055, 0),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(hex), transparent: true, opacity: 0.95 })
      );
      sMesh.position.set(0, 0.25, 0);
      fxGroup.add(sMesh);
      sparks.push({
        mesh: sMesh,
        vx: Math.cos(ang) * spd,
        vy: 1.1 + (i % 2) * 0.45,
        vz: Math.sin(ang) * spd
      });
    }

    disableFrustumCulling(fxGroup);
    scene.add(fxGroup);
    activeVfxList.push({
      group: fxGroup,
      ring,
      beacon,
      sparks,
      startedAt: performance.now(),
      durationMs: 1100
    });
  };

  const clearPendingCinematic = () => {
    if (activeCinematicTimer) {
      clearTimeout(activeCinematicTimer);
      activeCinematicTimer = null;
    }
    cinematicFocusUntil = 0;
    clearAllVfx();
    if (activeCinematicResolve) {
      const fn = activeCinematicResolve;
      activeCinematicResolve = null;
      fn();
    }
  };

  const resize = () => {
    if (disposed || contextLost) return;
    const nw = Math.max(boardEl.clientWidth || 400, 260);
    const nh = Math.max(boardEl.clientHeight || 400, 260);
    const ratio = Math.max(0.55, nw / nh);
    camera.fov = ratio < 0.98 ? Math.min(62, 42 / ratio) : 42;
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh, false);
  };

  const ro = new ResizeObserver(() => resize());
  ro.observe(boardEl);

  const onLost = (e: Event) => {
    e.preventDefault();
    contextLost = true;
  };
  const onRestored = () => {
    contextLost = false;
    resize();
  };
  canvas.addEventListener('webglcontextlost', onLost, false);
  canvas.addEventListener('webglcontextrestored', onRestored, false);

  const tick = (now: number) => {
    if (disposed) return;
    rafId = requestAnimationFrame(tick);
    if (contextLost) return;
    if (isSoftGl && now - lastSoftDraw < 34) return;
    lastSoftDraw = now;

    const dt = Math.min(0.08, Math.max(0.001, (now - prevNow) * 0.001));
    prevNow = now;
    const elapsedSec = (now - startClock) * 0.001;

    let movingActor: ActorState | null = null;
    for (const actor of actors.values()) {
      actor.pivot.visible = !actor.falido;
      if (actor.falido) continue;

      // Position interpolation inside tile perimeter
      actor.currentPos.x = THREE.MathUtils.damp(actor.currentPos.x, actor.targetPos.x, 12.5, dt);
      actor.currentPos.z = THREE.MathUtils.damp(actor.currentPos.z, actor.targetPos.z, 12.5, dt);
      actor.pivot.position.set(actor.currentPos.x, 0, actor.currentPos.z);

      // Smooth shortest-angle corner turn
      const diff = normalizeAngleRad(actor.targetYaw - actor.currentYaw);
      actor.currentYaw = normalizeAngleRad(actor.currentYaw + diff * Math.min(1, dt * 14));
      actor.pivot.rotation.y = actor.currentYaw;

      const distRem = Math.hypot(
        actor.targetPos.x - actor.currentPos.x,
        actor.targetPos.z - actor.currentPos.z
      );
      let mode: RigAnimationMode = 'idle';
      if (now < actor.walkUntil || distRem > 0.06) {
        mode = 'caminhar';
        movingActor = actor;
      } else if (now < actor.reactionUntil) {
        mode = actor.reactionMode;
      } else if (now < actor.celebrateUntil) {
        mode = 'comemorar';
      }

      actor.animMode = mode;
      updateCharacterRigAnimation(actor.model, elapsedSec + actor.playerId * 0.4, mode, 1.0);
    }

    for (const b of buildings.values()) {
      if (b.riseProgress < 1) {
        b.riseProgress = Math.min(1, b.riseProgress + dt * 3.8);
        const eased = 1 - Math.pow(1 - b.riseProgress, 3);
        b.group.scale.y = Math.max(0.05, eased);
      }
      if (b.haloMesh) {
        b.haloMesh.rotation.z = elapsedSec * 1.4;
      }
    }

    for (let i = activeVfxList.length - 1; i >= 0; i--) {
      const fx = activeVfxList[i];
      const tNorm = (now - fx.startedAt) / fx.durationMs;
      if (tNorm >= 1) {
        scene.remove(fx.group);
        disposeSceneObject(fx.group);
        activeVfxList.splice(i, 1);
        continue;
      }
      const easeOut = 1 - Math.pow(1 - tNorm, 2);
      const ringScale = 1 + easeOut * 3.2;
      fx.ring.scale.set(ringScale, ringScale, 1);
      (fx.ring.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - tNorm) * 0.9);
      fx.beacon.scale.set(1 + tNorm * 0.35, 1 + tNorm * 0.25, 1 + tNorm * 0.35);
      (fx.beacon.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - tNorm) * 0.48);
      for (const s of fx.sparks) {
        s.mesh.position.x = s.vx * easeOut * 0.85;
        s.mesh.position.z = s.vz * easeOut * 0.85;
        s.mesh.position.y = 0.22 + s.vy * tNorm - 0.95 * tNorm * tNorm;
        s.mesh.rotation.y += dt * 7;
        (s.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - tNorm);
      }
    }

    // Dynamic optional camera framing (full | simple | off)
    if (cinematicMode === 'off') {
      activeCamPos.copy(baseCamPos);
      activeLookAt.copy(baseLookAt);
    } else if (now < cinematicFocusUntil) {
      activeCamPos.x = THREE.MathUtils.damp(activeCamPos.x, cinematicTargetPos.x, 6.2, dt);
      activeCamPos.y = THREE.MathUtils.damp(activeCamPos.y, cinematicTargetPos.y, 6.2, dt);
      activeCamPos.z = THREE.MathUtils.damp(activeCamPos.z, cinematicTargetPos.z, 6.2, dt);
      activeLookAt.x = THREE.MathUtils.damp(activeLookAt.x, cinematicTargetLook.x, 7.5, dt);
      activeLookAt.y = THREE.MathUtils.damp(activeLookAt.y, cinematicTargetLook.y, 7.5, dt);
      activeLookAt.z = THREE.MathUtils.damp(activeLookAt.z, cinematicTargetLook.z, 7.5, dt);
    } else if (cinematicMode === 'full' && movingActor) {
      const followPos = new THREE.Vector3(
        movingActor.currentPos.x * 0.36,
        8.35,
        movingActor.currentPos.z * 0.36 + 4.45
      );
      const followLook = new THREE.Vector3(
        movingActor.currentPos.x * 0.48,
        0.35,
        movingActor.currentPos.z * 0.48
      );
      activeCamPos.x = THREE.MathUtils.damp(activeCamPos.x, followPos.x, 4.8, dt);
      activeCamPos.y = THREE.MathUtils.damp(activeCamPos.y, followPos.y, 4.8, dt);
      activeCamPos.z = THREE.MathUtils.damp(activeCamPos.z, followPos.z, 4.8, dt);
      activeLookAt.x = THREE.MathUtils.damp(activeLookAt.x, followLook.x, 5.4, dt);
      activeLookAt.y = THREE.MathUtils.damp(activeLookAt.y, followLook.y, 5.4, dt);
      activeLookAt.z = THREE.MathUtils.damp(activeLookAt.z, followLook.z, 5.4, dt);
    } else {
      activeCamPos.x = THREE.MathUtils.damp(activeCamPos.x, baseCamPos.x, 5.5, dt);
      activeCamPos.y = THREE.MathUtils.damp(activeCamPos.y, baseCamPos.y, 5.5, dt);
      activeCamPos.z = THREE.MathUtils.damp(activeCamPos.z, baseCamPos.z, 5.5, dt);
      activeLookAt.x = THREE.MathUtils.damp(activeLookAt.x, baseLookAt.x, 6.2, dt);
      activeLookAt.y = THREE.MathUtils.damp(activeLookAt.y, baseLookAt.y, 6.2, dt);
      activeLookAt.z = THREE.MathUtils.damp(activeLookAt.z, baseLookAt.z, 6.2, dt);
    }

    camera.position.copy(activeCamPos);
    camera.lookAt(activeLookAt);
    renderer.render(scene, camera);
  };
  rafId = requestAnimationFrame(tick);

  let syncQueue: Promise<void> = Promise.resolve();

  return {
    syncPlayers(players: BoardPlayerDescriptor[], totalTiles?: number): Promise<void> {
      const runSync = async () => {
        if (disposed) return;
        if (typeof totalTiles === 'number' && totalTiles >= 8 && totalTiles <= 24) {
          totalTilesCount = Math.round(totalTiles);
        }
        const incomingIds = new Set(players.map((p) => p.id));

        for (const [id, existing] of actors.entries()) {
          if (!incomingIds.has(id)) {
            scene.remove(existing.pivot);
            disposeSceneObject(existing.pivot);
            actors.delete(id);
          }
        }

        const pieceScale = totalTilesCount >= 20 ? 0.42 : totalTilesCount >= 15 ? 0.49 : 0.56;

        for (const p of players) {
          const sig = `${buildSignature(p)}_${totalTilesCount}`;
          const existing = actors.get(p.id);
          const dest = computeTileWorldPosition(p.pos, p.id, new THREE.Vector3(), totalTilesCount);
          if (!Number.isFinite(dest.x) || !Number.isFinite(dest.z)) continue;

          if (existing && existing.signature === sig) {
            existing.falido = !!p.falido;
            const movedDist = Math.hypot(dest.x - existing.targetPos.x, dest.z - existing.targetPos.z);
            if (movedDist > 0.05) {
              existing.targetYaw = computeFacingYaw(existing.currentPos, dest);
              existing.walkUntil = Math.max(existing.walkUntil, performance.now() + 340);
            }
            existing.targetPos.copy(dest);
            continue;
          }

          // Pre-build new model BEFORE removing existing pivot so there is never an invisible frame
          const model = await buildActorModelForPlayer(p, currentLowDetail);
          if (disposed) {
            disposeSceneObject(model);
            return;
          }
          model.scale.multiplyScalar(pieceScale);

          const pivot = new THREE.Group();
          pivot.name = `board_actor_p${p.id}`;

          const nextTilePos = computeTileWorldPosition((p.pos + 1) % totalTilesCount, p.id, new THREE.Vector3(), totalTilesCount);
          const initYaw = computeFacingYaw(dest, nextTilePos);
          const startPos = existing ? existing.currentPos.clone() : dest.clone();
          const startYaw = existing ? existing.currentYaw : initYaw;
          const keepWalkUntil = existing ? existing.walkUntil : 0;

          if (existing) {
            scene.remove(existing.pivot);
            disposeSceneObject(existing.pivot);
            actors.delete(p.id);
          }

          pivot.position.set(startPos.x, 0, startPos.z);
          pivot.rotation.y = startYaw;
          pivot.visible = !p.falido;
          pivot.add(model);
          disableFrustumCulling(pivot);
          scene.add(pivot);

          actors.set(p.id, {
            playerId: p.id,
            signature: sig,
            pivot,
            model,
            currentPos: startPos,
            targetPos: dest.clone(),
            currentYaw: startYaw,
            targetYaw: existing ? computeFacingYaw(startPos, dest) : initYaw,
            animMode: 'idle',
            reactionMode: 'idle',
            reactionUntil: 0,
            celebrateUntil: 0,
            walkUntil: keepWalkUntil,
            falido: !!p.falido
          });
        }
      };

      syncQueue = syncQueue.then(runSync, runSync);
      return syncQueue;
    },

    syncBuildings(descriptors: BoardBuildingDescriptor[], totalTiles?: number) {
      if (disposed) return;
      if (typeof totalTiles === 'number' && totalTiles >= 8 && totalTiles <= 24) {
        totalTilesCount = Math.round(totalTiles);
      }
      const activeIds = new Set<number>();
      for (const rawDesc of descriptors) {
        const d = rawDesc as any;
        const tileId = typeof d?.tileId === 'number' ? d.tileId : typeof d?.id === 'number' ? d.id : -1;
        const donoId = typeof d?.donoId === 'number' ? d.donoId : typeof d?.ownerId === 'number' ? d.ownerId : null;
        const nivel = Number(d?.nivel) || 0;
        if (tileId < 0 || nivel <= 0 || !donoId) continue;

        activeIds.add(tileId);
        const ownerHex = d.corHex || OWNER_HEX_PALETTE[donoId] || '#f59e0b';
        const existing = buildings.get(tileId);
        if (existing && existing.nivel === nivel && existing.ownerColor === ownerHex) {
          continue;
        }
        if (existing) {
          scene.remove(existing.group);
          disposeSceneObject(existing.group);
          buildings.delete(tileId);
        }
        const { group, haloMesh } = buildTempleOrSanctuaryMesh(nivel, ownerHex);
        const worldPos = computeBuildingWorldPosition(tileId, new THREE.Vector3(), totalTilesCount);
        const gridScale = totalTilesCount >= 20 ? 0.76 : totalTilesCount >= 15 ? 0.88 : 1.0;
        group.position.copy(worldPos);
        group.scale.set(gridScale, 0.05, gridScale);
        disableFrustumCulling(group);
        scene.add(group);
        buildings.set(tileId, {
          tileId,
          nivel,
          ownerColor: ownerHex,
          group,
          haloMesh,
          riseProgress: 0.05
        });
      }
      for (const [tileId, existing] of buildings.entries()) {
        if (!activeIds.has(tileId)) {
          scene.remove(existing.group);
          disposeSceneObject(existing.group);
          buildings.delete(tileId);
        }
      }
    },

    setTotalTiles(totalTiles: number) {
      if (typeof totalTiles === 'number' && totalTiles >= 8 && totalTiles <= 24) {
        totalTilesCount = Math.round(totalTiles);
      }
    },

    stepPlayer(playerId: number, fromTile: number, toTile: number) {
      const actor = actors.get(playerId);
      if (!actor) return;
      const startVec = computeTileWorldPosition(fromTile, playerId, new THREE.Vector3(), totalTilesCount);
      const destVec = computeTileWorldPosition(toTile, playerId, new THREE.Vector3(), totalTilesCount);
      actor.targetYaw = computeFacingYaw(startVec, destVec);
      actor.targetPos.copy(destVec);
      actor.walkUntil = performance.now() + 340;
    },

    teleportPlayer(playerId: number, tile: number) {
      const actor = actors.get(playerId);
      if (!actor) return;
      const dest = computeTileWorldPosition(tile, playerId, new THREE.Vector3(), totalTilesCount);
      const next = computeTileWorldPosition((tile + 1) % totalTilesCount, playerId, new THREE.Vector3(), totalTilesCount);
      actor.currentPos.copy(dest);
      actor.targetPos.copy(dest);
      actor.currentYaw = computeFacingYaw(dest, next);
      actor.targetYaw = actor.currentYaw;
      actor.walkUntil = 0;
      actor.pivot.position.copy(dest);
    },

    celebrateArrival(playerId: number, durationMs = 700) {
      const actor = actors.get(playerId);
      if (!actor) return;
      actor.walkUntil = 0;
      actor.celebrateUntil = performance.now() + durationMs;
    },

    playActorReaction(playerId: number, mode: RigAnimationMode, durationMs = 1100) {
      const actor = actors.get(playerId);
      if (!actor) return;
      actor.walkUntil = 0;
      actor.reactionMode = mode;
      actor.reactionUntil = performance.now() + Math.max(250, durationMs);
    },

    setCinematicMode(mode: CinematicMode) {
      cinematicMode = mode;
      if (mode === 'off') {
        clearPendingCinematic();
        activeCamPos.copy(baseCamPos);
        activeLookAt.copy(baseLookAt);
      }
    },

    getCinematicMode() {
      return cinematicMode;
    },

    playCinematicEvent(opts: CinematicEventOptions): Promise<void> {
      clearPendingCinematic();
      const resolvedTileIndex =
        typeof opts.tileIndex === 'number'
          ? opts.tileIndex
          : typeof opts.tileIdx === 'number'
          ? opts.tileIdx
          : undefined;
      const duration = Math.min(
        2200,
        Math.max(350, Number(opts.durationMs) || (cinematicMode === 'simple' ? 550 : 1150))
      );

      if (opts.playerId && opts.reactionMode) {
        const actor = actors.get(opts.playerId);
        if (actor) {
          actor.walkUntil = 0;
          actor.reactionMode = opts.reactionMode;
          actor.reactionUntil = performance.now() + duration;
        }
      }

      if (cinematicMode === 'off' || disposed || contextLost) {
        return Promise.resolve();
      }

      let vfxPos: THREE.Vector3 | null = null;
      if (typeof resolvedTileIndex === 'number') {
        const focus = computeBuildingWorldPosition(resolvedTileIndex, new THREE.Vector3(), totalTilesCount);
        vfxPos = focus;
        cinematicTargetLook.set(focus.x, 0.35, focus.z);
        if (cinematicMode === 'simple') {
          cinematicTargetPos.set(focus.x * 0.35, 8.2, focus.z * 0.35 + 4.2);
        } else {
          cinematicTargetPos.set(focus.x * 0.65, 5.65, focus.z * 0.65 + 3.45);
        }
      } else if (opts.playerId && actors.has(opts.playerId)) {
        const a = actors.get(opts.playerId)!;
        vfxPos = a.currentPos.clone();
        cinematicTargetLook.set(a.currentPos.x, 0.45, a.currentPos.z);
        cinematicTargetPos.set(a.currentPos.x * 0.65, 5.8, a.currentPos.z * 0.65 + 3.5);
      } else {
        cinematicTargetLook.copy(baseLookAt);
        cinematicTargetPos.copy(baseCamPos);
      }

      if (vfxPos && opts.kind) {
        spawnCinematicVfx(vfxPos, opts.kind, opts.colorHex);
      }

      cinematicFocusUntil = performance.now() + duration;
      if (opts.onStart) opts.onStart();

      return new Promise((resolve) => {
        activeCinematicResolve = () => {
          if (opts.onEnd) opts.onEnd();
          resolve();
        };
        activeCinematicTimer = setTimeout(() => {
          clearPendingCinematic();
        }, duration);
      });
    },

    skipActiveCinematic() {
      clearPendingCinematic();
      activeCamPos.copy(baseCamPos);
      activeLookAt.copy(baseLookAt);
    },

    setLowDetail(enabled: boolean) {
      currentLowDetail = enabled || isSoftGl;
      renderer.setPixelRatio(currentLowDetail ? 1 : Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.shadowMap.enabled = !currentLowDetail;
    },

    resize,

    isActive() {
      return !disposed && !contextLost;
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      clearPendingCinematic();
      cancelAnimationFrame(rafId);
      ro.disconnect();
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      for (const actor of actors.values()) {
        scene.remove(actor.pivot);
        disposeSceneObject(actor.pivot);
      }
      actors.clear();
      for (const b of buildings.values()) {
        scene.remove(b.group);
        disposeSceneObject(b.group);
      }
      buildings.clear();
      disposeSceneObject(shadowFloor);
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (canvas.parentElement === boardEl) {
        boardEl.removeChild(canvas);
      }
    }
  };
}

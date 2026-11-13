import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  VisualStyleId,
  RegionKey,
  RegionColorMap,
  VISUAL_STYLE_CATALOG,
  REGION_LABELS_PT,
  DEFAULT_REGION_COLORS,
  tagMeshRegion,
  partitionAndTagRegions,
  applyVisualStyleAndRegionColors,
  getPresetDefaultRegionColors
} from './styles3d';
import {
  CharacterConfig,
  RigAnimationMode,
  CHARACTER_CREATOR_OPTIONS,
  DEFAULT_CHARACTER_CONFIG,
  buildCharacterPieceModel,
  updateCharacterRigAnimation,
  analyzePhotoReferencePalette
} from './characterBuilder3d';
import {
  mountBoard3DStage,
  computeTileWorldPosition,
  computeFacingYaw,
  normalizeAngleRad
} from './board3d';
import {
  PLANNED_MANIFEST_SAMPLE,
  compareSemver,
  evaluateUpdateAvailability
} from './versionManifest';

export type PieceKind = 'preset' | 'glb' | 'character' | 'photo-totem';
export type PresetPieceId = 'spartan' | 'owl' | 'lion' | 'wolf' | 'pegasus' | 'dragon';

export interface CustomPieceRecord {
  id: string;
  nome: string;
  categoria: string;
  tipo: PieceKind;
  presetId?: PresetPieceId;
  corHex: string;
  estiloVisual?: VisualStyleId;
  coresPorRegiao?: RegionColorMap;
  characterConfig?: CharacterConfig;
  escala: number;
  detalheReduzido?: boolean;
  glbBase64?: string;
  gltfText?: string;
  photoDataUrl?: string;
  thumbDataUrl?: string;
  criadoEm: number;
}

export interface PresetCatalogItem {
  id: PresetPieceId;
  nome: string;
  categoria: string;
  descricao: string;
  corPadrao: string;
  icone: string;
}

export interface ValidationResult {
  ok: boolean;
  erro?: string;
  formato?: 'glb' | 'gltf';
  aviso?: string;
}

export const PRESET_CATALOG: PresetCatalogItem[] = [
  {
    id: 'spartan',
    nome: 'Guerreiro Espartano',
    categoria: 'Herói',
    descricao: 'Elmo coríntio emplumado, escudo hoplon com borda, lança e manto articulado.',
    corPadrao: '#d97706',
    icone: '⚔️'
  },
  {
    id: 'owl',
    nome: 'Coruja de Atena',
    categoria: 'Criatura Sábia',
    descricao: 'Asas abertas em penas duplas, armadura peitoral e olhos luminosos.',
    corPadrao: '#0ea5e9',
    icone: '🦉'
  },
  {
    id: 'lion',
    nome: 'Leão de Nemeia',
    categoria: 'Fera Lendária',
    descricao: 'Juba radiante em camadas, peitoral real e garras sobre pedestal olímpico.',
    corPadrao: '#f59e0b',
    icone: '🦁'
  },
  {
    id: 'wolf',
    nome: 'Lobo do Tártaro',
    categoria: 'Guardião Sombrio',
    descricao: 'Armadura de obsidiana em placas, presas prateadas e olhar rubi.',
    corPadrao: '#dc2626',
    icone: '🐺'
  },
  {
    id: 'pegasus',
    nome: 'Pégaso Dourado',
    categoria: 'Corcel Alado',
    descricao: 'Corcel celestial com asas articuladas em penas e crina dourada.',
    corPadrao: '#eab308',
    icone: '🐎'
  },
  {
    id: 'dragon',
    nome: 'Dragão de Delfos',
    categoria: 'Serpente Mítica',
    descricao: 'Crista dorsal segmentada, chifres duplos, asas abertas e cauda esculpida.',
    corPadrao: '#10b981',
    icone: '🐉'
  }
];

const MAX_3D_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_MODEL_TRIANGLES = 120_000;
const DB_NAME = 'LegadoImortaisPecas3DDB';
const DB_VERSION = 1;
const STORE_NAME = 'pecas';

// Reusable scratch objects (zero per-frame allocations)
const _scratchBox = new THREE.Box3();
const _scratchSize = new THREE.Vector3();
const _scratchCenter = new THREE.Vector3();

export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return Boolean(gl);
  } catch {
    return false;
  }
}

export function detectSoftwareWebGL(renderer: THREE.WebGLRenderer): boolean {
  try {
    const gl = renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg) {
      const ren = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '');
      if (/SwiftShader|llvmpipe|Software|Basic Render Driver/i.test(ren)) {
        return true;
      }
    }
  } catch {
    // Fallback gracefully
  }
  return false;
}

export function disposeSceneObject(root: THREE.Object3D | null | undefined): void {
  if (!root) return;
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry && !mesh.userData?.sharesGeometry) {
      mesh.geometry.dispose();
    }
    const mat = mesh.material;
    if (mat) {
      const list = Array.isArray(mat) ? mat : [mat];
      for (const m of list) {
        const std = m as unknown as Record<string, unknown>;
        for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']) {
          const tex = std[key];
          if (tex && typeof (tex as THREE.Texture).dispose === 'function') {
            (tex as THREE.Texture).dispose();
          }
        }
        m.dispose();
      }
    }
  });
}

function groundAndNormalizeGroup(group: THREE.Group, targetHeight = 1.85): void {
  group.updateMatrixWorld(true);
  _scratchBox.setFromObject(group);
  if (_scratchBox.isEmpty()) return;

  _scratchBox.getSize(_scratchSize);
  const maxDim = Math.max(_scratchSize.y, _scratchSize.x * 0.85, _scratchSize.z * 0.85, 0.001);
  const scaleFactor = targetHeight / maxDim;

  group.scale.multiplyScalar(scaleFactor);
  group.updateMatrixWorld(true);

  _scratchBox.setFromObject(group);
  _scratchBox.getCenter(_scratchCenter);
  group.position.x -= _scratchCenter.x;
  group.position.z -= _scratchCenter.z;
  group.position.y -= _scratchBox.min.y;
  group.updateMatrixWorld(true);
}

function enableShadows(group: THREE.Object3D): void {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && !mesh.userData?.isOutlineMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
}

function createPedestalGroup(accentHex: string, segs: number): THREE.Group {
  const baseGroup = new THREE.Group();
  baseGroup.name = 'pedestal_olimpico';

  const marbleMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.78,
    metalness: 0.05
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(accentHex),
    roughness: 0.25,
    metalness: 0.85
  });

  const step1 = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.62, 0.14, segs), marbleMat);
  step1.position.y = 0.07;
  tagMeshRegion(step1, 'detalhes', 'stone');
  baseGroup.add(step1);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.53, 0.032, Math.max(8, Math.floor(segs / 2)), segs), trimMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.15;
  tagMeshRegion(ring, 'detalhes', 'metal');
  baseGroup.add(ring);

  const step2 = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.52, 0.12, segs), marbleMat);
  step2.position.y = 0.20;
  tagMeshRegion(step2, 'detalhes', 'stone');
  baseGroup.add(step2);

  return baseGroup;
}

export function buildPresetPieceModel(
  presetId: PresetPieceId,
  corHex = '#d97706',
  lowDetail = false,
  estiloVisual: VisualStyleId = 'stylized3d',
  coresPorRegiao?: RegionColorMap
): THREE.Group {
  const segs = lowDetail ? 12 : 24;
  const root = new THREE.Group();
  root.name = `peca_preset_${presetId}`;

  const defaultColors = getPresetDefaultRegionColors(presetId, corHex);
  const mergedColors: RegionColorMap = { ...defaultColors, ...(coresPorRegiao || {}) };

  const pedestal = createPedestalGroup(mergedColors.detalhes || corHex, segs);
  root.add(pedestal);

  const mk = (hex: string, r = 0.4, m = 0.5) =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: r, metalness: m });

  const armaduraMat = mk(mergedColors.armadura || corHex, 0.28, 0.85);
  const peitoralMat = mk(mergedColors.peitoral || '#94a3b8', 0.34, 0.72);
  const barrigaMat = mk(mergedColors.barriga || '#e2e8f0', 0.62, 0.12);
  const asasMat = mk(mergedColors.asas || '#dc2626', 0.68, 0.08);
  const detalhesMat = mk(mergedColors.detalhes || '#fbbf24', 0.25, 0.85);
  const acessoriosMat = mk(mergedColors.acessorios || '#38bdf8', 0.2, 0.65);

  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = 0.26;
  root.add(bodyPivot);

  let headPivot: THREE.Group | undefined;
  let leftWingPivot: THREE.Group | undefined;
  let rightWingPivot: THREE.Group | undefined;
  let leftLegPivot: THREE.Group | undefined;
  let rightLegPivot: THREE.Group | undefined;
  let leftArmPivot: THREE.Group | undefined;
  let rightArmPivot: THREE.Group | undefined;

  if (presetId === 'spartan') {
    const legL = new THREE.Group();
    legL.position.set(-0.14, 0.34, 0);
    const shinL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.36, segs), armaduraMat);
    shinL.position.y = -0.18;
    tagMeshRegion(shinL, 'armadura', 'metal');
    legL.add(shinL);
    leftLegPivot = legL;

    const legR = new THREE.Group();
    legR.position.set(0.14, 0.34, 0);
    const shinR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.36, segs), armaduraMat);
    shinR.position.y = -0.18;
    tagMeshRegion(shinR, 'armadura', 'metal');
    legR.add(shinR);
    rightLegPivot = legR;
    bodyPivot.add(legL, legR);

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.18, 0.52, segs), peitoralMat);
    torso.position.set(0, 0.64, 0);
    tagMeshRegion(torso, 'peitoral', 'metal');
    bodyPivot.add(torso);

    const abdomen = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.21, 0.2, segs), barrigaMat);
    abdomen.position.set(0, 0.42, 0.02);
    tagMeshRegion(abdomen, 'barriga', 'leather');
    bodyPivot.add(abdomen);

    const cape = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.66, 0.05), asasMat);
    cape.position.set(0, 0.56, -0.22);
    cape.rotation.x = 0.16;
    tagMeshRegion(cape, 'asas', 'fabric');
    bodyPivot.add(cape);

    headPivot = new THREE.Group();
    headPivot.position.set(0, 1.04, 0);
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.19, segs, segs), armaduraMat);
    tagMeshRegion(helm, 'armadura', 'metal');
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.14), acessoriosMat);
    visor.position.set(0, -0.02, 0.12);
    tagMeshRegion(visor, 'acessorios', 'metal');
    const plume = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.048, 8, segs, Math.PI * 1.1), asasMat);
    plume.rotation.y = Math.PI / 2;
    plume.rotation.z = -0.2;
    plume.position.set(0, 0.09, -0.02);
    tagMeshRegion(plume, 'asas', 'feather');
    headPivot.add(helm, visor, plume);
    bodyPivot.add(headPivot);

    leftArmPivot = new THREE.Group();
    leftArmPivot.position.set(-0.28, 0.78, 0);
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.05, segs), detalhesMat);
    shield.rotation.z = Math.PI / 2;
    shield.position.set(-0.04, -0.1, 0.08);
    tagMeshRegion(shield, 'detalhes', 'metal');
    const shieldBoss = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), acessoriosMat);
    shieldBoss.position.set(-0.08, -0.1, 0.08);
    tagMeshRegion(shieldBoss, 'acessorios', 'gem');
    leftArmPivot.add(shield, shieldBoss);
    bodyPivot.add(leftArmPivot);

    rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(0.30, 0.78, 0.04);
    const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 1.48, 10), acessoriosMat);
    spear.position.set(0.02, -0.05, 0);
    tagMeshRegion(spear, 'acessorios', 'wood');
    const spearTip = new THREE.Mesh(new THREE.ConeGeometry(0.058, 0.20, 8), detalhesMat);
    spearTip.position.set(0.02, 0.76, 0);
    tagMeshRegion(spearTip, 'detalhes', 'metal');
    rightArmPivot.add(spear, spearTip);
    bodyPivot.add(rightArmPivot);
  } else if (presetId === 'owl') {
    for (const side of [-0.14, 0.14]) {
      const talon = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.064, 0.22, 10), detalhesMat);
      talon.position.set(side, 0.12, 0.04);
      tagMeshRegion(talon, 'detalhes', 'metal');
      bodyPivot.add(talon);
    }

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.30, segs, segs), peitoralMat);
    body.scale.set(0.95, 1.32, 0.85);
    body.position.set(0, 0.52, 0);
    tagMeshRegion(body, 'peitoral', 'feather');
    bodyPivot.add(body);

    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.22, segs, segs), barrigaMat);
    chest.scale.set(0.9, 1.05, 0.42);
    chest.position.set(0, 0.50, 0.18);
    tagMeshRegion(chest, 'barriga', 'feather');
    bodyPivot.add(chest);

    for (const dir of [-1, 1] as const) {
      const wPivot = new THREE.Group();
      wPivot.position.set(dir * 0.26, 0.62, -0.04);
      const wingPrimary = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.52, 0.07), asasMat);
      wingPrimary.position.set(dir * 0.18, -0.04, 0);
      wingPrimary.rotation.z = dir * -0.45;
      wingPrimary.rotation.y = dir * -0.25;
      tagMeshRegion(wingPrimary, 'asas', 'feather');
      const wingTrim = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.20, 0.08), armaduraMat);
      wingTrim.position.set(dir * 0.22, 0.16, 0.02);
      wingTrim.rotation.z = dir * -0.45;
      tagMeshRegion(wingTrim, 'armadura', 'metal');
      wPivot.add(wingPrimary, wingTrim);
      bodyPivot.add(wPivot);
      if (dir === -1) leftWingPivot = wPivot;
      else rightWingPivot = wPivot;
    }

    headPivot = new THREE.Group();
    headPivot.position.set(0, 0.98, 0.03);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, segs, segs), peitoralMat);
    tagMeshRegion(head, 'peitoral', 'feather');
    const crownBand = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.03, 8, segs), armaduraMat);
    crownBand.rotation.x = Math.PI / 2 - 0.15;
    crownBand.position.y = 0.09;
    tagMeshRegion(crownBand, 'armadura', 'metal');
    headPivot.add(head, crownBand);

    for (const dir of [-1, 1]) {
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.19, 8), detalhesMat);
      tuft.position.set(dir * 0.15, 0.20, 0);
      tuft.rotation.z = dir * -0.35;
      tagMeshRegion(tuft, 'detalhes', 'feather');
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 10), acessoriosMat);
      eye.position.set(dir * 0.09, 0.03, 0.20);
      tagMeshRegion(eye, 'acessorios', 'gem');
      headPivot.add(tuft, eye);
    }
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.14, 8), detalhesMat);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, -0.04, 0.24);
    tagMeshRegion(beak, 'detalhes', 'metal');
    headPivot.add(beak);
    bodyPivot.add(headPivot);
  } else if (presetId === 'lion') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.62, segs), peitoralMat);
    body.rotation.x = Math.PI / 2;
    body.position.set(0, 0.36, -0.04);
    tagMeshRegion(body, 'peitoral', 'leather');
    bodyPivot.add(body);

    const belly = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.17, 0.48, segs), barrigaMat);
    belly.rotation.x = Math.PI / 2;
    belly.position.set(0, 0.29, -0.02);
    tagMeshRegion(belly, 'barriga', 'leather');
    bodyPivot.add(belly);

    const legCoords = [[-0.16, 0.18], [0.16, 0.18], [-0.15, -0.22], [0.15, -0.22]];
    legCoords.forEach(([lx, lz], idx) => {
      const lPiv = new THREE.Group();
      lPiv.position.set(lx, 0.30, lz);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.32, 12), peitoralMat);
      leg.position.y = -0.14;
      tagMeshRegion(leg, 'peitoral', 'leather');
      lPiv.add(leg);
      bodyPivot.add(lPiv);
      if (idx === 0) leftLegPivot = lPiv;
      if (idx === 1) rightLegPivot = lPiv;
    });

    headPivot = new THREE.Group();
    headPivot.position.set(0, 0.68, 0.24);
    const mane = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.10, 10, segs), armaduraMat);
    tagMeshRegion(mane, 'armadura', 'hair');
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.20, segs, segs), detalhesMat);
    head.position.z = 0.08;
    tagMeshRegion(head, 'detalhes', 'metal');
    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.14), barrigaMat);
    muzzle.position.set(0, -0.05, 0.22);
    tagMeshRegion(muzzle, 'barriga', 'leather');
    const crownGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), acessoriosMat);
    crownGem.position.set(0, 0.24, 0.08);
    tagMeshRegion(crownGem, 'acessorios', 'gem');
    headPivot.add(mane, head, muzzle, crownGem);
    bodyPivot.add(headPivot);

    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.46, 8), peitoralMat);
    tail.rotation.x = -0.8;
    tail.position.set(0, 0.50, -0.44);
    tagMeshRegion(tail, 'peitoral', 'hair');
    bodyPivot.add(tail);
  } else if (presetId === 'wolf') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.18, 0.68, segs), peitoralMat);
    body.rotation.x = Math.PI / 2;
    body.position.set(0, 0.36, -0.02);
    tagMeshRegion(body, 'peitoral', 'leather');
    bodyPivot.add(body);

    const belly = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.14, 0.50, segs), barrigaMat);
    belly.rotation.x = Math.PI / 2;
    belly.position.set(0, 0.29, -0.01);
    tagMeshRegion(belly, 'barriga', 'leather');
    bodyPivot.add(belly);

    for (const [lx, lz] of [[-0.14, 0.20], [0.14, 0.20], [-0.14, -0.24], [0.14, -0.24]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.36, 10), armaduraMat);
      leg.position.set(lx, 0.18, lz);
      tagMeshRegion(leg, 'armadura', 'metal');
      bodyPivot.add(leg);
    }

    const chestArmor = new THREE.Mesh(new THREE.SphereGeometry(0.23, segs, segs), armaduraMat);
    chestArmor.position.set(0, 0.50, 0.20);
    tagMeshRegion(chestArmor, 'armadura', 'metal');
    bodyPivot.add(chestArmor);

    headPivot = new THREE.Group();
    headPivot.position.set(0, 0.72, 0.32);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, segs, segs), peitoralMat);
    tagMeshRegion(head, 'peitoral', 'hair');
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.26, 8), peitoralMat);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, -0.04, 0.18);
    tagMeshRegion(snout, 'peitoral', 'hair');
    headPivot.add(head, snout);
    for (const dir of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 6), detalhesMat);
      ear.position.set(dir * 0.11, 0.18, -0.04);
      tagMeshRegion(ear, 'detalhes', 'metal');
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 8), acessoriosMat);
      eye.position.set(dir * 0.08, 0.04, 0.13);
      tagMeshRegion(eye, 'acessorios', 'gem');
      headPivot.add(ear, eye);
    }
    bodyPivot.add(headPivot);

    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.42, 10), armaduraMat);
    tail.rotation.x = -0.95;
    tail.position.set(0, 0.50, -0.44);
    tagMeshRegion(tail, 'armadura', 'hair');
    bodyPivot.add(tail);
  } else if (presetId === 'pegasus') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.21, 0.66, segs), peitoralMat);
    body.rotation.x = Math.PI / 2;
    body.position.set(0, 0.40, -0.02);
    tagMeshRegion(body, 'peitoral', 'leather');
    bodyPivot.add(body);

    const saddle = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.22, segs), armaduraMat);
    saddle.rotation.x = Math.PI / 2;
    saddle.position.set(0, 0.42, -0.02);
    tagMeshRegion(saddle, 'armadura', 'metal');
    bodyPivot.add(saddle);

    for (const [lx, lz] of [[-0.14, 0.20], [0.14, 0.20], [-0.14, -0.22], [0.14, -0.22]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.04, 0.38, 10), barrigaMat);
      leg.position.set(lx, 0.20, lz);
      tagMeshRegion(leg, 'barriga', 'leather');
      bodyPivot.add(leg);
    }

    headPivot = new THREE.Group();
    headPivot.position.set(0, 0.68, 0.26);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.15, 0.44, 12), peitoralMat);
    neck.rotation.x = 0.42;
    tagMeshRegion(neck, 'peitoral', 'leather');
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.30), peitoralMat);
    head.rotation.x = 0.35;
    head.position.set(0, 0.21, 0.14);
    tagMeshRegion(head, 'peitoral', 'leather');
    const crest = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.24, 8), detalhesMat);
    crest.rotation.x = 0.35;
    crest.position.set(0, 0.35, 0.14);
    tagMeshRegion(crest, 'detalhes', 'metal');
    headPivot.add(neck, head, crest);
    bodyPivot.add(headPivot);

    for (const dir of [-1, 1] as const) {
      const wPivot = new THREE.Group();
      wPivot.position.set(dir * 0.22, 0.60, 0.02);
      const wingMain = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.28, 0.06), asasMat);
      wingMain.position.set(dir * 0.20, 0.10, 0);
      wingMain.rotation.z = dir * 0.52;
      wingMain.rotation.y = dir * -0.22;
      tagMeshRegion(wingMain, 'asas', 'feather');
      const wingTip = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.18, 0.05), acessoriosMat);
      wingTip.position.set(dir * 0.44, 0.28, -0.06);
      wingTip.rotation.z = dir * 0.72;
      tagMeshRegion(wingTip, 'acessorios', 'metal');
      wPivot.add(wingMain, wingTip);
      bodyPivot.add(wPivot);
      if (dir === -1) leftWingPivot = wPivot;
      else rightWingPivot = wPivot;
    }
  } else {
    // Dragão de Delfos
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.64, segs), peitoralMat);
    body.position.set(0, 0.38, 0);
    tagMeshRegion(body, 'peitoral', 'leather');
    bodyPivot.add(body);

    const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.20, 0.56, segs), barrigaMat);
    chest.position.set(0, 0.38, 0.10);
    tagMeshRegion(chest, 'barriga', 'metal');
    bodyPivot.add(chest);

    headPivot = new THREE.Group();
    headPivot.position.set(0, 0.80, 0.08);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.42, 12), peitoralMat);
    neck.rotation.x = 0.25;
    tagMeshRegion(neck, 'peitoral', 'leather');
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.34), armaduraMat);
    head.position.set(0, 0.22, 0.12);
    tagMeshRegion(head, 'armadura', 'metal');
    headPivot.add(neck, head);

    for (const dir of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.25, 8), detalhesMat);
      horn.rotation.x = -0.45;
      horn.rotation.z = dir * -0.25;
      horn.position.set(dir * 0.10, 0.36, 0.0);
      tagMeshRegion(horn, 'detalhes', 'metal');
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), acessoriosMat);
      eye.position.set(dir * 0.08, 0.24, 0.27);
      tagMeshRegion(eye, 'acessorios', 'gem');
      headPivot.add(horn, eye);
    }
    bodyPivot.add(headPivot);

    for (const dir of [-1, 1] as const) {
      const wPivot = new THREE.Group();
      wPivot.position.set(dir * 0.20, 0.68, -0.10);
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.38, 0.05), asasMat);
      wing.position.set(dir * 0.26, 0.04, 0);
      wing.rotation.z = dir * 0.45;
      wing.rotation.y = dir * -0.3;
      tagMeshRegion(wing, 'asas', 'leather');
      wPivot.add(wing);
      bodyPivot.add(wPivot);
      if (dir === -1) leftWingPivot = wPivot;
      else rightWingPivot = wPivot;
    }

    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.64, 10), peitoralMat);
    tail.rotation.x = -1.15;
    tail.position.set(0, 0.20, -0.34);
    tagMeshRegion(tail, 'peitoral', 'leather');
    bodyPivot.add(tail);
  }

  groundAndNormalizeGroup(root, 1.85);
  applyVisualStyleAndRegionColors(root, estiloVisual, mergedColors, lowDetail);
  enableShadows(root);

  root.userData.rig = {
    pelvis: bodyPivot,
    torso: bodyPivot,
    head: headPivot,
    leftWing: leftWingPivot,
    rightWing: rightWingPivot,
    leftLeg: leftLegPivot,
    rightLeg: rightLegPivot,
    leftArm: leftArmPivot,
    rightArm: rightArmPivot,
    baseY: bodyPivot.position.y
  };

  return root;
}

export async function createPhotoTotemModel(
  photoDataUrl: string,
  corHex = '#f59e0b',
  lowDetail = false,
  estiloVisual: VisualStyleId = 'stylized3d',
  coresPorRegiao?: RegionColorMap
): Promise<THREE.Group> {
  const segs = lowDetail ? 14 : 28;
  const root = new THREE.Group();
  root.name = 'totem_fotografico_3d';

  const mergedColors: RegionColorMap = {
    armadura: corHex,
    detalhes: corHex,
    barriga: '#f1f5f9',
    ...(coresPorRegiao || {})
  };

  const pedestal = createPedestalGroup(mergedColors.detalhes || corHex, segs);
  root.add(pedestal);

  const goldMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(mergedColors.armadura || corHex), roughness: 0.24, metalness: 0.88 });
  const marbleMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(mergedColors.barriga || '#f1f5f9'), roughness: 0.72, metalness: 0.06 });

  for (const dir of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.85, 12), marbleMat);
    pillar.position.set(dir * 0.42, 0.68, 0);
    tagMeshRegion(pillar, 'barriga', 'stone');
    root.add(pillar);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), goldMat);
    cap.position.set(dir * 0.42, 1.12, 0);
    tagMeshRegion(cap, 'armadura', 'metal');
    root.add(cap);
  }

  const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.40, 0.065, 12, segs), goldMat);
  bezel.position.set(0, 0.86, 0);
  tagMeshRegion(bezel, 'armadura', 'metal');
  root.add(bezel);

  const backing = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.06, segs), goldMat);
  backing.rotation.x = Math.PI / 2;
  backing.position.set(0, 0.86, 0);
  tagMeshRegion(backing, 'armadura', 'metal');
  root.add(backing);

  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.24, 6), goldMat);
  crown.position.set(0, 1.38, 0);
  tagMeshRegion(crown, 'acessorios', 'metal');
  root.add(crown);

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Falha ao decodificar imagem do retrato.'));
    image.src = photoDataUrl;
  });

  const tex = new THREE.Texture(img);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;

  const photoMat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.38,
    metalness: 0.08
  });

  const frontDisc = new THREE.Mesh(new THREE.CircleGeometry(0.36, segs), photoMat);
  frontDisc.position.set(0, 0.86, 0.036);
  frontDisc.userData = { skipStyleOverride: true, noOutline: true, regionKey: 'detalhes', materialRole: 'gem' };
  root.add(frontDisc);

  const backDisc = new THREE.Mesh(new THREE.CircleGeometry(0.36, segs), photoMat);
  backDisc.rotation.y = Math.PI;
  backDisc.position.set(0, 0.86, -0.036);
  backDisc.userData = { skipStyleOverride: true, noOutline: true, regionKey: 'detalhes', materialRole: 'gem' };
  root.add(backDisc);

  groundAndNormalizeGroup(root, 1.85);
  applyVisualStyleAndRegionColors(root, estiloVisual, mergedColors, lowDetail);
  enableShadows(root);
  return root;
}

export function validarArquivo3D(
  fileName: string,
  byteLength: number,
  buffer: ArrayBuffer
): ValidationResult {
  const lower = String(fileName || '').toLowerCase().trim();
  const isGlb = lower.endsWith('.glb');
  const isGltf = lower.endsWith('.gltf');
  const isImage = /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(lower);

  if (isImage) {
    return {
      ok: false,
      erro: 'Imagens PNG/JPG/WebP não são modelos 3D. Use a aba "🧑 Criador 3D" para usar sua foto como referência, ou envie um arquivo .glb / .gltf.'
    };
  }

  if (!isGlb && !isGltf) {
    return { ok: false, erro: 'Formato não suportado. Envie apenas arquivos 3D .glb ou .gltf.' };
  }
  if (!byteLength || byteLength <= 0) {
    return { ok: false, erro: 'Arquivo vazio ou corrompido.' };
  }
  if (byteLength > MAX_3D_FILE_BYTES) {
    return { ok: false, erro: 'Arquivo excede o limite seguro de 5 MB para web e Android.' };
  }

  if (isGlb) {
    if (buffer.byteLength < 20) {
      return { ok: false, erro: 'Cabeçalho GLB inválido (arquivo muito curto).' };
    }
    const view = new DataView(buffer);
    const magic = view.getUint32(0, true);
    const version = view.getUint32(4, true);
    const declaredLen = view.getUint32(8, true);
    if (magic !== 0x46546c67) {
      return { ok: false, erro: 'Assinatura binária GLB inválida (esperado "glTF").' };
    }
    if (version !== 2) {
      return { ok: false, erro: `Versão GLB ${version} não suportada (utilize glTF 2.0).` };
    }
    if (declaredLen > buffer.byteLength) {
      return { ok: false, erro: 'Arquivo GLB truncado (tamanho declarado maior que o arquivo).' };
    }
    return { ok: true, formato: 'glb' };
  }

  // .gltf JSON validation
  try {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
    const json = JSON.parse(text) as {
      asset?: { version?: string };
      buffers?: Array<{ uri?: string }>;
      images?: Array<{ uri?: string }>;
    };
    if (!json || typeof json !== 'object' || !json.asset || !String(json.asset.version || '').startsWith('2')) {
      return { ok: false, erro: 'Arquivo .gltf inválido ou versão diferente de glTF 2.0.' };
    }
    const checkUris = [...(json.buffers || []), ...(json.images || [])];
    for (const item of checkUris) {
      if (!item?.uri) continue;
      const u = String(item.uri).trim();
      if (/^(javascript|vbscript):/i.test(u)) {
        return { ok: false, erro: 'URI insegura bloqueada dentro do arquivo .gltf.' };
      }
      if (!u.startsWith('data:')) {
        return {
          ok: false,
          erro: 'Este .gltf referencia arquivos externos (.bin/.png separados). Exporte como .glb único para funcionar localmente.'
        };
      }
    }
    return { ok: true, formato: 'gltf' };
  } catch {
    return { ok: false, erro: 'JSON do arquivo .gltf inválido ou malformado.' };
  }
}

function countSceneTriangles(root: THREE.Object3D): { meshes: number; triangles: number } {
  let meshes = 0;
  let triangles = 0;
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry && !mesh.userData?.isOutlineMesh) {
      meshes++;
      const geom = mesh.geometry;
      if (geom.index) {
        triangles += geom.index.count / 3;
      } else if (geom.attributes?.position) {
        triangles += geom.attributes.position.count / 3;
      }
    }
  });
  return { meshes, triangles: Math.round(triangles) };
}

export async function loadValidatedGltfOrGlb(
  bufferOrText: ArrayBuffer | string,
  estiloVisual: VisualStyleId = 'stylized3d',
  coresPorRegiao?: RegionColorMap,
  lowDetail = false
): Promise<THREE.Group> {
  const loader = new GLTFLoader();
  const gltf = await loader.parseAsync(bufferOrText, '');
  const sceneGroup = new THREE.Group();
  sceneGroup.name = 'modelo_importado_3d';
  sceneGroup.add(gltf.scene);

  const stats = countSceneTriangles(sceneGroup);
  if (stats.meshes === 0) {
    disposeSceneObject(sceneGroup);
    throw new Error('O modelo não contém nenhuma malha 3D visível.');
  }
  if (stats.triangles > MAX_MODEL_TRIANGLES) {
    disposeSceneObject(sceneGroup);
    throw new Error(`Modelo muito pesado (${stats.triangles.toLocaleString()} triângulos; máximo permitido: ${MAX_MODEL_TRIANGLES.toLocaleString()}).`);
  }

  groundAndNormalizeGroup(sceneGroup, 1.85);
  partitionAndTagRegions(sceneGroup);
  applyVisualStyleAndRegionColors(sceneGroup, estiloVisual, coresPorRegiao || {}, lowDetail);
  enableShadows(sceneGroup);
  return sceneGroup;
}

export async function buildPieceGroupFromRecord(rec: CustomPieceRecord): Promise<THREE.Group> {
  const style: VisualStyleId = rec.estiloVisual || 'stylized3d';
  const lowDetail = !!rec.detalheReduzido;
  let group: THREE.Group;

  if (rec.tipo === 'glb') {
    if (rec.glbBase64) {
      const bin = base64ToArrayBuffer(rec.glbBase64);
      group = await loadValidatedGltfOrGlb(bin, style, rec.coresPorRegiao, lowDetail);
    } else if (rec.gltfText) {
      group = await loadValidatedGltfOrGlb(rec.gltfText, style, rec.coresPorRegiao, lowDetail);
    } else {
      group = buildPresetPieceModel('spartan', rec.corHex || '#d97706', lowDetail, style, rec.coresPorRegiao);
    }
  } else if (rec.tipo === 'character') {
    group = buildCharacterPieceModel(
      {
        ...DEFAULT_CHARACTER_CONFIG,
        ...(rec.characterConfig || {}),
        estiloVisual: style,
        coresPorRegiao: {
          ...DEFAULT_REGION_COLORS,
          ...(rec.characterConfig?.coresPorRegiao || {}),
          ...(rec.coresPorRegiao || {})
        }
      },
      lowDetail
    );
  } else if (rec.tipo === 'photo-totem' && rec.photoDataUrl) {
    group = await createPhotoTotemModel(rec.photoDataUrl, rec.corHex || '#f59e0b', lowDetail, style, rec.coresPorRegiao);
  } else {
    group = buildPresetPieceModel(
      rec.presetId || 'spartan',
      rec.corHex || '#d97706',
      lowDetail,
      style,
      rec.coresPorRegiao
    );
  }

  const userScale = Math.max(0.75, Math.min(1.3, Number(rec.escala) || 1));
  group.scale.multiplyScalar(userScale);
  return group;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function cropPhotoToSquareDataUrl(file: File, maxPx = 512): Promise<string> {
  const mimeOk = /^image\/(png|jpeg|jpg|webp)$/i.test(file.type || '');
  const extOk = /\.(png|jpe?g|webp)$/i.test(file.name || '');
  if (!mimeOk && !extOk) {
    throw new Error('Envie uma imagem PNG, JPG ou WebP válida.');
  }
  if (file.size > 4 * 1024 * 1024) {
    throw new Error('A foto deve ter no máximo 4 MB.');
  }
  const objUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Não foi possível ler a imagem selecionada.'));
      i.src = objUrl;
    });
    const side = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);
    if (!side || side <= 0) {
      throw new Error('A imagem selecionada não possui dimensões válidas.');
    }
    const sx = Math.max(0, Math.floor(((img.naturalWidth || img.width) - side) / 2));
    const sy = Math.max(0, Math.floor(((img.naturalHeight || img.height) - side) / 2));

    const canvas = document.createElement('canvas');
    canvas.width = maxPx;
    canvas.height = maxPx;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Contexto 2D indisponível para recorte.');
    ctx.drawImage(img, sx, sy, side, side, 0, 0, maxPx, maxPx);
    return canvas.toDataURL('image/jpeg', 0.88);
  } finally {
    URL.revokeObjectURL(objUrl);
  }
}

function renderFallback2DThumbnailDataUrl(rec: CustomPieceRecord): string {
  try {
    const size = 240;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const color = rec.corHex || rec.coresPorRegiao?.armadura || '#f59e0b';
    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.44, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = color;
    ctx.stroke();

    const icon = rec.tipo === 'character'
      ? '🧑'
      : rec.tipo === 'photo-totem'
        ? '🖼️'
        : rec.tipo === 'glb'
          ? '📦'
          : (PRESET_CATALOG.find(x => x.id === rec.presetId)?.icone || '🎭');

    ctx.font = 'bold 92px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(icon, size / 2, size / 2 + 4);
    return canvas.toDataURL('image/png');
  } catch {
    return '';
  }
}

export async function renderPieceThumbnailDataUrl(rec: CustomPieceRecord): Promise<string> {
  const size = 240;
  let renderer: THREE.WebGLRenderer | null = null;
  let pmrem: THREE.PMREMGenerator | null = null;
  let envTex: THREE.Texture | null = null;
  let model: THREE.Group | null = null;

  try {
    if (!isWebGLAvailable()) {
      return renderFallback2DThumbnailDataUrl(rec);
    }
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(size, size, false);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    const scene = new THREE.Scene();
    pmrem = new THREE.PMREMGenerator(renderer);
    envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    const hemi = new THREE.HemisphereLight(0xf8fafc, 0x1e293b, 0.9);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfffbeb, 2.2);
    key.position.set(2.5, 4.5, 3.2);
    scene.add(key);

    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 30);
    camera.position.set(1.6, 1.55, 2.85);
    camera.lookAt(0, 0.9, 0);

    model = await buildPieceGroupFromRecord(rec);
    model.rotation.y = 0.32;
    scene.add(model);

    renderer.render(scene, camera);
    return canvas.toDataURL('image/png');
  } catch {
    return renderFallback2DThumbnailDataUrl(rec);
  } finally {
    if (model) disposeSceneObject(model);
    if (envTex) envTex.dispose();
    if (pmrem) pmrem.dispose();
    if (renderer) renderer.dispose();
  }
}

// IndexedDB Personal Library
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponível neste navegador.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Erro ao abrir IndexedDB de peças 3D.'));
  });
}

export const Pecas3DStorage = {
  async listar(): Promise<CustomPieceRecord[]> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result || []) as CustomPieceRecord[];
        items.sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
        resolve(items);
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  },

  async salvar(peca: CustomPieceRecord): Promise<void> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(peca);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error || new Error('Erro ao salvar peça 3D no IndexedDB.'));
      };
    });
  },

  async obterPorId(id: string): Promise<CustomPieceRecord | null> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => resolve((req.result as CustomPieceRecord) || null);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  },

  async remover(id: string): Promise<void> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
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

export interface WorkshopViewerController {
  setPiece: (rec: CustomPieceRecord) => Promise<RegionKey[]>;
  setAnimationMode: (mode: RigAnimationMode) => void;
  setAutoRotate: (enabled: boolean) => void;
  setLowDetail: (enabled: boolean) => void;
  resetCamera: () => void;
  resize: () => void;
  captureThumbnail: () => string;
  dispose: () => void;
}

export function mountWorkshopViewer(
  container: HTMLElement,
  initialLowDetail = false
): WorkshopViewerController {
  container.innerHTML = '';
  const width = Math.max(container.clientWidth || 340, 260);
  const height = Math.max(container.clientHeight || 280, 240);

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch (err) {
    throw new Error(
      `WebGL indisponível neste dispositivo ou WebView (${err instanceof Error ? err.message : 'erro ao iniciar GPU'}).`
    );
  }

  const isSoftGl = detectSoftwareWebGL(renderer);
  const lowMode = initialLowDetail || isSoftGl;

  renderer.setPixelRatio(lowMode ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = !lowMode;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.touchAction = 'none';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1222);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;

  const hemi = new THREE.HemisphereLight(0xf8fafc, 0x0f172a, 0.9);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xfffbeb, 2.3);
  keyLight.position.set(3.2, 5.2, 3.6);
  if (!lowMode) {
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 15;
  }
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.9);
  rimLight.position.set(-3.0, 2.5, -2.5);
  scene.add(rimLight);

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x162036,
    roughness: 0.7,
    metalness: 0.25
  });
  const floorDisc = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, 0.08, 36), floorMat);
  floorDisc.position.y = -0.04;
  floorDisc.receiveShadow = true;
  scene.add(floorDisc);

  const floorRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.15, 0.02, 8, 48),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.85 })
  );
  floorRing.rotation.x = Math.PI / 2;
  floorRing.position.y = 0.0;
  scene.add(floorRing);

  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 40);
  camera.position.set(0, 1.65, 3.55);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.92, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 2.0;
  controls.maxDistance = 6.2;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1.6;
  controls.update();

  let currentPiece: THREE.Group | null = null;
  let currentLowDetail = lowMode;
  let currentAnimMode: RigAnimationMode = 'idle';
  let disposed = false;
  let contextLost = false;
  let rafId = 0;
  let lastSoftDraw = 0;
  const startTime = performance.now();

  const resize = () => {
    if (disposed || contextLost) return;
    const nw = Math.max(container.clientWidth || 340, 240);
    const nh = Math.max(container.clientHeight || 280, 220);
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh, false);
    renderer.render(scene, camera);
  };

  const onContextLost = (e: Event) => {
    e.preventDefault();
    contextLost = true;
  };
  const onContextRestored = () => {
    contextLost = false;
    resize();
  };
  renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);
  renderer.domElement.addEventListener('webglcontextrestored', onContextRestored, false);

  const resizeObserver = new ResizeObserver(() => {
    resize();
  });
  resizeObserver.observe(container);
  requestAnimationFrame(() => resize());

  const tick = (now: number) => {
    if (disposed) return;
    rafId = requestAnimationFrame(tick);
    if (contextLost) return;
    if (isSoftGl && now - lastSoftDraw < 33) return;
    lastSoftDraw = now;
    const elapsedSec = (now - startTime) * 0.001;
    if (currentPiece) {
      updateCharacterRigAnimation(currentPiece, elapsedSec, currentAnimMode);
    }
    controls.update();
    renderer.render(scene, camera);
  };
  rafId = requestAnimationFrame(tick);

  return {
    async setPiece(rec: CustomPieceRecord): Promise<RegionKey[]> {
      if (disposed) return [];
      const nextGroup = await buildPieceGroupFromRecord({
        ...rec,
        detalheReduzido: rec.detalheReduzido ?? currentLowDetail
      });
      if (disposed) {
        disposeSceneObject(nextGroup);
        return [];
      }
      if (currentPiece) {
        scene.remove(currentPiece);
        disposeSceneObject(currentPiece);
      }
      currentPiece = nextGroup;
      currentAnimMode = rec.characterConfig?.animacao || 'idle';
      scene.add(currentPiece);
      if (!contextLost) renderer.render(scene, camera);
      return partitionAndTagRegions(currentPiece);
    },

    setAnimationMode(mode: RigAnimationMode) {
      currentAnimMode = mode;
    },

    setAutoRotate(enabled: boolean) {
      controls.autoRotate = enabled;
    },

    setLowDetail(enabled: boolean) {
      currentLowDetail = enabled || isSoftGl;
      renderer.setPixelRatio(currentLowDetail ? 1 : Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = !currentLowDetail;
      if (!contextLost) renderer.render(scene, camera);
    },

    resetCamera() {
      camera.position.set(0, 1.65, 3.55);
      controls.target.set(0, 0.92, 0);
      controls.update();
    },

    resize,

    captureThumbnail(): string {
      if (!contextLost) renderer.render(scene, camera);
      return renderer.domElement.toDataURL('image/png');
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      controls.dispose();
      if (currentPiece) {
        scene.remove(currentPiece);
        disposeSceneObject(currentPiece);
        currentPiece = null;
      }
      disposeSceneObject(floorDisc);
      disposeSceneObject(floorRing);
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    }
  };
}

// Export global API for index.html inline game engine
declare global {
  interface Window {
    Legado3D?: unknown;
  }
}

window.Legado3D = {
  PRESET_CATALOG,
  VISUAL_STYLE_CATALOG,
  REGION_LABELS_PT,
  DEFAULT_REGION_COLORS,
  CHARACTER_CREATOR_OPTIONS,
  DEFAULT_CHARACTER_CONFIG,
  isWebGLAvailable,
  disposeSceneObject,
  validarArquivo3D,
  loadValidatedGltfOrGlb,
  buildPresetPieceModel,
  buildCharacterPieceModel,
  createPhotoTotemModel,
  buildPieceGroupFromRecord,
  renderPieceThumbnailDataUrl,
  cropPhotoToSquareDataUrl,
  analyzePhotoReferencePalette,
  applyVisualStyleAndRegionColors,
  getPresetDefaultRegionColors,
  partitionAndTagRegions,
  updateCharacterRigAnimation,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  Pecas3DStorage,
  mountWorkshopViewer,
  mountBoard3DStage,
  computeTileWorldPosition,
  computeFacingYaw,
  normalizeAngleRad,
  PLANNED_MANIFEST_SAMPLE,
  compareSemver,
  evaluateUpdateAvailability
};

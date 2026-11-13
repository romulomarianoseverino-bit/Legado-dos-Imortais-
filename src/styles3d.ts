import * as THREE from 'three';

export type VisualStyleId = 'stylized3d' | 'cartoon' | 'anime';

export type RegionKey =
  | 'asas'
  | 'peitoral'
  | 'barriga'
  | 'armadura'
  | 'detalhes'
  | 'acessorios'
  | 'cabelo'
  | 'roupa'
  | 'calcado'
  | 'pele';

export type RegionColorMap = Partial<Record<RegionKey, string>>;

export type MaterialRole =
  | 'metal'
  | 'fabric'
  | 'leather'
  | 'wood'
  | 'stone'
  | 'skin'
  | 'feather'
  | 'gem'
  | 'hair'
  | 'eye';

export interface VisualStyleMeta {
  id: VisualStyleId;
  nome: string;
  icone: string;
  descricao: string;
}

export const VISUAL_STYLE_CATALOG: VisualStyleMeta[] = [
  {
    id: 'stylized3d',
    nome: '3D Estilizado',
    icone: '🎨',
    descricao: 'Realismo estilizado moderno com metais, tecidos, couro, luz suave e sombras.'
  },
  {
    id: 'cartoon',
    nome: 'Cartoon',
    icone: '🎬',
    descricao: 'Proporções expressivas, cores vibrantes, sombreamento suave e contornos marcantes.'
  },
  {
    id: 'anime',
    nome: 'Anime',
    icone: '⛩️',
    descricao: 'Cel-shading em dois tons nítidos, olhos expressivos, cabelo em camadas e traço fino.'
  }
];

export const REGION_LABELS_PT: Record<RegionKey, string> = {
  pele: 'Pele',
  cabelo: 'Cabelo',
  roupa: 'Roupa / Túnica',
  armadura: 'Armadura / Elmo',
  peitoral: 'Peitoral',
  barriga: 'Barriga / Centro',
  asas: 'Asas / Capa',
  calcado: 'Calçado / Botas',
  detalhes: 'Detalhes / Ornamentos',
  acessorios: 'Acessórios / Armas'
};

export const DEFAULT_REGION_COLORS: Record<RegionKey, string> = {
  pele: '#eab68c',
  cabelo: '#292524',
  roupa: '#1d4ed8',
  armadura: '#d97706',
  peitoral: '#b45309',
  barriga: '#f3e8d2',
  asas: '#e2e8f0',
  calcado: '#5c3a21',
  detalhes: '#fbbf24',
  acessorios: '#38bdf8'
};

let cachedToon3Band: THREE.DataTexture | null = null;
let cachedToon2Band: THREE.DataTexture | null = null;
const proceduralBumpCache = new Map<string, THREE.CanvasTexture>();

export function getToonGradient(bands: 2 | 3): THREE.DataTexture {
  if (bands === 2 && cachedToon2Band) return cachedToon2Band;
  if (bands === 3 && cachedToon3Band) return cachedToon3Band;

  const size = bands;
  const data = new Uint8Array(size * 4);
  const values = bands === 2 ? [115, 255] : [92, 178, 255];
  for (let i = 0; i < size; i++) {
    const v = values[i];
    data[i * 4 + 0] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }

  const tex = new THREE.DataTexture(data, size, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;

  if (bands === 2) cachedToon2Band = tex;
  else cachedToon3Band = tex;
  return tex;
}

function getProceduralDetailTexture(kind: 'weave' | 'leather' | 'metal' | 'feather'): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const existing = proceduralBumpCache.get(kind);
  if (existing) return existing;

  try {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);

    if (kind === 'weave') {
      for (let y = 0; y < size; y += 4) {
        for (let x = 0; x < size; x += 4) {
          const alt = ((x + y) / 4) % 2 === 0;
          ctx.fillStyle = alt ? '#9c9c9c' : '#686868';
          ctx.fillRect(x, y, 3, 3);
        }
      }
    } else if (kind === 'leather') {
      for (let i = 0; i < 180; i++) {
        const px = (i * 37) % size;
        const py = (i * 53) % size;
        ctx.fillStyle = i % 2 === 0 ? '#989898' : '#666666';
        ctx.fillRect(px, py, 2, 2);
      }
    } else if (kind === 'metal') {
      for (let y = 0; y < size; y += 2) {
        const lum = 118 + ((y * 13) % 28);
        ctx.fillStyle = `rgb(${lum},${lum},${lum})`;
        ctx.fillRect(0, y, size, 1);
      }
    } else if (kind === 'feather') {
      for (let y = 0; y < size; y += 6) {
        ctx.strokeStyle = '#a4a4a4';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y + 6);
        ctx.stroke();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    tex.needsUpdate = true;
    proceduralBumpCache.set(kind, tex);
    return tex;
  } catch {
    return null;
  }
}

export function tagMeshRegion(
  obj: THREE.Object3D,
  regionKey: RegionKey,
  role: MaterialRole = 'armor' as MaterialRole
): void {
  const safeRole: MaterialRole =
    role === ('armor' as unknown as MaterialRole) ? 'metal' : role;

  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData?.isOutlineMesh) return;
    if (!mesh.userData.regionKey) {
      mesh.userData.regionKey = regionKey;
    }
    if (!mesh.userData.materialRole) {
      mesh.userData.materialRole = safeRole;
    }
    if (!mesh.userData.originalColorHex && mesh.material) {
      const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      const colorProp = (mat as THREE.MeshStandardMaterial)?.color;
      if (colorProp) {
        mesh.userData.originalColorHex = '#' + colorProp.getHexString();
      }
    }
  });
}

function adjustHexForStyle(hex: string, style: VisualStyleId, role: MaterialRole): THREE.Color {
  const c = new THREE.Color(hex || '#d97706');
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);

  if (style === 'cartoon') {
    c.setHSL(
      hsl.h,
      Math.min(1, hsl.s * 1.24 + (role === 'skin' ? 0.04 : 0.1)),
      Math.min(0.84, Math.max(0.24, hsl.l * 1.08 + 0.03))
    );
  } else if (style === 'anime') {
    c.setHSL(
      hsl.h,
      role === 'skin' ? Math.min(0.55, hsl.s * 0.9) : Math.min(0.95, hsl.s * 1.12),
      role === 'skin' ? Math.max(0.72, hsl.l * 1.06) : Math.min(0.82, Math.max(0.2, hsl.l * 1.02))
    );
  }
  return c;
}

export function createStyledMaterial(
  style: VisualStyleId,
  role: MaterialRole,
  hexColor: string,
  options?: {
    preserveMap?: THREE.Texture | null;
    preserveEmissive?: THREE.Color;
    preserveEmissiveIntensity?: number;
  }
): THREE.Material {
  if (role === 'eye') {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(hexColor),
      map: options?.preserveMap || null
    });
  }

  const styledColor = adjustHexForStyle(hexColor, style, role);

  if (style === 'cartoon' || style === 'anime') {
    const grad = getToonGradient(style === 'anime' ? 2 : 3);
    const mat = new THREE.MeshToonMaterial({
      color: options?.preserveMap ? new THREE.Color(0xffffff) : styledColor,
      gradientMap: grad,
      map: options?.preserveMap || null
    });
    if (role === 'gem') {
      mat.emissive = new THREE.Color(hexColor).multiplyScalar(0.35);
      mat.emissiveIntensity = 0.65;
    } else if (options?.preserveEmissive) {
      mat.emissive = options.preserveEmissive.clone();
      mat.emissiveIntensity = options.preserveEmissiveIntensity ?? 0.3;
    }
    return mat;
  }

  // Stylized 3D PBR
  let roughness = 0.55;
  let metalness = 0.12;
  let bumpTex: THREE.CanvasTexture | null = null;
  let bumpScale = 0.015;

  switch (role) {
    case 'metal':
      roughness = 0.24;
      metalness = 0.86;
      bumpTex = getProceduralDetailTexture('metal');
      bumpScale = 0.008;
      break;
    case 'gem':
      roughness = 0.14;
      metalness = 0.22;
      break;
    case 'leather':
      roughness = 0.68;
      metalness = 0.08;
      bumpTex = getProceduralDetailTexture('leather');
      bumpScale = 0.018;
      break;
    case 'fabric':
      roughness = 0.82;
      metalness = 0.04;
      bumpTex = getProceduralDetailTexture('weave');
      bumpScale = 0.014;
      break;
    case 'feather':
      roughness = 0.62;
      metalness = 0.06;
      bumpTex = getProceduralDetailTexture('feather');
      bumpScale = 0.016;
      break;
    case 'wood':
      roughness = 0.72;
      metalness = 0.05;
      bumpTex = getProceduralDetailTexture('metal');
      bumpScale = 0.012;
      break;
    case 'stone':
      roughness = 0.76;
      metalness = 0.06;
      bumpTex = getProceduralDetailTexture('leather');
      bumpScale = 0.02;
      break;
    case 'hair':
      roughness = 0.54;
      metalness = 0.12;
      break;
    case 'skin':
      roughness = 0.58;
      metalness = 0.02;
      break;
  }

  const mat = new THREE.MeshStandardMaterial({
    color: options?.preserveMap ? new THREE.Color(0xffffff) : styledColor,
    roughness,
    metalness,
    map: options?.preserveMap || null,
    bumpMap: options?.preserveMap ? null : bumpTex,
    bumpScale: options?.preserveMap ? 0 : bumpScale
  });

  if (role === 'gem') {
    mat.emissive = new THREE.Color(hexColor).multiplyScalar(0.32);
    mat.emissiveIntensity = 0.6;
  } else if (options?.preserveEmissive) {
    mat.emissive = options.preserveEmissive.clone();
    mat.emissiveIntensity = options.preserveEmissiveIntensity ?? 0.35;
  }
  return mat;
}

function inferRegionFromNameAndBounds(
  mesh: THREE.Mesh,
  boxCenter: THREE.Vector3,
  rootBox: THREE.Box3
): { regionKey: RegionKey; role: MaterialRole } {
  const n = (mesh.name || '').toLowerCase();
  const relY = rootBox.max.y > rootBox.min.y
    ? (boxCenter.y - rootBox.min.y) / (rootBox.max.y - rootBox.min.y)
    : 0.5;
  const halfW = Math.max(0.15, (rootBox.max.x - rootBox.min.x) * 0.5);
  const relX = Math.abs(boxCenter.x) / halfW;

  if (/wing|asa|cape|cloak|manto|feather|pena/.test(n)) {
    return { regionKey: 'asas', role: 'feather' };
  }
  if (/hair|cabelo|mane|juba|fur/.test(n)) {
    return { regionKey: 'cabelo', role: 'hair' };
  }
  if (/skin|pele|face|head|cabeca|hand|mao/.test(n)) {
    return { regionKey: 'pele', role: 'skin' };
  }
  if (/boot|shoe|foot|sandal|calcado|bota|greva/.test(n)) {
    return { regionKey: 'calcado', role: 'leather' };
  }
  if (/belly|barriga|abdomen|waist|cinto/.test(n)) {
    return { regionKey: 'barriga', role: 'fabric' };
  }
  if (/chest|torso|peito|peitoral|body/.test(n)) {
    return { regionKey: 'peitoral', role: 'metal' };
  }
  if (/sword|spear|shield|weapon|arma|crown|coroa|staff|acc|acessorio|crest|orb|gem/.test(n)) {
    return { regionKey: 'acessorios', role: 'gem' };
  }
  if (/armor|armadura|helm|elmo|shield|pauldron|ombreira/.test(n)) {
    return { regionKey: 'armadura', role: 'metal' };
  }
  if (/cloth|tunic|robe|skirt|roupa|tunica/.test(n)) {
    return { regionKey: 'roupa', role: 'fabric' };
  }

  // Spatial heuristic fallback for imported GLB/GLTF without descriptive names
  if (relX > 0.45 && relY > 0.35 && relY < 0.85) {
    return { regionKey: 'asas', role: 'fabric' };
  }
  if (relY > 0.72) {
    return { regionKey: 'armadura', role: 'metal' };
  }
  if (relY > 0.48) {
    return { regionKey: 'peitoral', role: 'metal' };
  }
  if (relY > 0.25) {
    return { regionKey: 'barriga', role: 'fabric' };
  }
  if (relY <= 0.14) {
    return { regionKey: 'detalhes', role: 'stone' };
  }
  return { regionKey: 'acessorios', role: 'metal' };
}

export function partitionAndTagRegions(root: THREE.Object3D): RegionKey[] {
  const rootBox = new THREE.Box3().setFromObject(root);
  const meshBox = new THREE.Box3();
  const center = new THREE.Vector3();
  const found = new Set<RegionKey>();

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData?.isOutlineMesh) return;

    // Clone shared materials per mesh so changing one region NEVER bleeds into another
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((m) => m.clone());
      } else if (!mesh.userData.__materialCloned) {
        mesh.material = mesh.material.clone();
        mesh.userData.__materialCloned = true;
      }
    }

    const mat0 = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const matColor = (mat0 as THREE.MeshStandardMaterial)?.color;
    if (!mesh.userData.originalColorHex && matColor) {
      mesh.userData.originalColorHex = '#' + matColor.getHexString();
    }

    if (!mesh.userData.regionKey) {
      meshBox.setFromObject(mesh);
      meshBox.getCenter(center);
      const inferred = inferRegionFromNameAndBounds(mesh, center, rootBox);
      mesh.userData.regionKey = inferred.regionKey;
      mesh.userData.materialRole = mesh.userData.materialRole || inferred.role;
    } else if (!mesh.userData.materialRole) {
      mesh.userData.materialRole = 'metal';
    }

    if (mesh.userData.materialRole !== 'eye') {
      found.add(mesh.userData.regionKey as RegionKey);
    }
  });

  return Array.from(found);
}

function removeOutlineMeshes(root: THREE.Object3D): void {
  const toRemove: THREE.Mesh[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && mesh.userData?.isOutlineMesh) {
      toRemove.push(mesh);
    }
  });
  for (const m of toRemove) {
    if (m.parent) m.parent.remove(m);
    if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose());
    else m.material?.dispose();
  }
}

export function applyVisualStyleAndRegionColors(
  root: THREE.Object3D,
  style: VisualStyleId = 'stylized3d',
  regionColors: RegionColorMap = {},
  lowDetail = false
): RegionKey[] {
  removeOutlineMeshes(root);
  const availableRegions = partitionAndTagRegions(root);

  const outlineColorHex = style === 'anime' ? 0x111827 : 0x090d16;
  const outlineScale = style === 'cartoon' ? 1.048 : 1.028;

  const targetMeshes: THREE.Mesh[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && !mesh.userData?.isOutlineMesh) {
      targetMeshes.push(mesh);
    }
  });

  for (const mesh of targetMeshes) {
    const regionKey = (mesh.userData.regionKey || 'detalhes') as RegionKey;
    const role = (mesh.userData.materialRole || 'metal') as MaterialRole;

    if (mesh.userData.skipStyleOverride) {
      continue;
    }

    const oldMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const oldStd = oldMat as THREE.MeshStandardMaterial;
    const preserveMap = oldStd?.map || null;
    const baseOriginalHex = mesh.userData.originalColorHex || '#d97706';
    const overrideHex = regionColors[regionKey];
    const targetHex = overrideHex || baseOriginalHex;

    // For meshes with embedded photo texture, keep photo legible when no solid color override is forced
    const keepTexture = preserveMap && !mesh.userData.allowColorTintOverMap ? preserveMap : null;

    const newMat = createStyledMaterial(style, role, targetHex, {
      preserveMap: keepTexture,
      preserveEmissive:
        oldStd?.emissive && oldStd.emissive.getHex() !== 0 ? oldStd.emissive : undefined,
      preserveEmissiveIntensity: oldStd?.emissiveIntensity
    });

    // If user tinted an imported textured mesh, tint gently via color multiplication
    if (keepTexture && overrideHex && 'color' in newMat) {
      (newMat as THREE.MeshStandardMaterial).color.set(overrideHex);
    }

    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((m) => m.dispose());
    } else if (mesh.material) {
      mesh.material.dispose();
    }
    mesh.material = newMat;
    mesh.userData.__materialCloned = true;

    // Add BackSide ink outline in Cartoon and Anime modes (skip tiny details/eyes/outlines)
    if (
      (style === 'cartoon' || style === 'anime') &&
      role !== 'eye' &&
      !lowDetail &&
      !mesh.userData.noOutline &&
      mesh.geometry
    ) {
      const outlineMat = new THREE.MeshBasicMaterial({
        color: outlineColorHex,
        side: THREE.BackSide
      });
      const outline = new THREE.Mesh(mesh.geometry, outlineMat);
      outline.name = `${mesh.name || 'part'}_outline`;
      outline.scale.setScalar(outlineScale);
      outline.userData.isOutlineMesh = true;
      outline.userData.sharesGeometry = true;
      outline.castShadow = false;
      outline.receiveShadow = false;
      mesh.add(outline);
    }
  }

  return availableRegions;
}

export function getPresetDefaultRegionColors(
  presetId: string,
  primaryHex: string
): RegionColorMap {
  const accent = new THREE.Color(primaryHex || '#d97706');
  const hsl = { h: 0, s: 0, l: 0 };
  accent.getHSL(hsl);
  const compHex = '#' + new THREE.Color().setHSL((hsl.h + 0.08) % 1, Math.min(1, hsl.s * 0.9), Math.min(0.8, hsl.l + 0.14)).getHexString();

  switch (presetId) {
    case 'owl':
      return {
        asas: primaryHex,
        peitoral: '#e2e8f0',
        barriga: '#cbd5e1',
        armadura: '#fbbf24',
        detalhes: '#f59e0b',
        acessorios: '#38bdf8'
      };
    case 'lion':
      return {
        armadura: '#b45309',
        peitoral: primaryHex,
        barriga: '#fde68a',
        detalhes: '#fbbf24',
        acessorios: compHex
      };
    case 'wolf':
      return {
        armadura: '#334155',
        peitoral: primaryHex,
        barriga: '#cbd5e1',
        detalhes: '#60a5fa',
        acessorios: '#38bdf8'
      };
    case 'pegasus':
      return {
        asas: '#f8fafc',
        peitoral: primaryHex,
        barriga: '#e0f2fe',
        armadura: '#fbbf24',
        detalhes: '#38bdf8',
        acessorios: '#fde047'
      };
    case 'dragon':
      return {
        asas: '#1e293b',
        peitoral: primaryHex,
        barriga: '#fca5a5',
        armadura: '#475569',
        detalhes: '#f97316',
        acessorios: '#facc15'
      };
    case 'spartan':
    default:
      return {
        armadura: primaryHex,
        peitoral: '#94a3b8',
        barriga: '#7c2d12',
        asas: '#dc2626',
        detalhes: '#fbbf24',
        acessorios: '#cbd5e1'
      };
  }
}

import * as THREE from 'three';
import {
  VisualStyleId,
  RegionColorMap,
  DEFAULT_REGION_COLORS,
  tagMeshRegion,
  applyVisualStyleAndRegionColors
} from './styles3d';

export type SilhouetteId = 'heroico' | 'agil' | 'guardiao';
export type HairStyleId =
  | 'curto_espetado'
  | 'longo_fluido'
  | 'trancas_guerreira'
  | 'topete_real'
  | 'elmo_aberto';
export type OutfitStyleId =
  | 'tunica_olimpica'
  | 'capa_real'
  | 'kimono_lendario'
  | 'armadura_leve';
export type ArmorStyleId =
  | 'bronze_espartano'
  | 'ouro_celestial'
  | 'obsidiana'
  | 'sem_armadura';
export type FootwearStyleId = 'grevas_aladas' | 'botas_couro' | 'sandalias_divinas';
export type AccessoryStyleId =
  | 'nenhum'
  | 'coroa_louros'
  | 'asas_divinas'
  | 'lanca_olimpica'
  | 'escudo_egide'
  | 'cachecol_ventos';
export type ExpressionId = 'confiante' | 'serio' | 'feliz' | 'batalha';
export type RigAnimationMode = 'idle' | 'caminhar' | 'comemorar';

export interface CharacterConfig {
  estiloVisual: VisualStyleId;
  silhueta: SilhouetteId;
  cabelo: HairStyleId;
  roupa: OutfitStyleId;
  armadura: ArmorStyleId;
  calcado: FootwearStyleId;
  acessorio: AccessoryStyleId;
  expressao: ExpressionId;
  animacao: RigAnimationMode;
  coresPorRegiao: RegionColorMap;
  photoRefDataUrl?: string;
  aplicarEmblemaFoto?: boolean;
}

export const DEFAULT_CHARACTER_CONFIG: CharacterConfig = {
  estiloVisual: 'stylized3d',
  silhueta: 'heroico',
  cabelo: 'curto_espetado',
  roupa: 'tunica_olimpica',
  armadura: 'bronze_espartano',
  calcado: 'grevas_aladas',
  acessorio: 'lanca_olimpica',
  expressao: 'confiante',
  animacao: 'idle',
  coresPorRegiao: { ...DEFAULT_REGION_COLORS },
  aplicarEmblemaFoto: false
};

export interface ArticulatedRig {
  pelvis?: THREE.Object3D;
  torso?: THREE.Object3D;
  head?: THREE.Object3D;
  leftArm?: THREE.Object3D;
  rightArm?: THREE.Object3D;
  leftLeg?: THREE.Object3D;
  rightLeg?: THREE.Object3D;
  leftWing?: THREE.Object3D;
  rightWing?: THREE.Object3D;
  cape?: THREE.Object3D;
  baseY: number;
}

export const CHARACTER_CREATOR_OPTIONS = {
  silhuetas: [
    { id: 'heroico' as SilhouetteId, nome: 'Heroico' },
    { id: 'agil' as SilhouetteId, nome: 'Ágil' },
    { id: 'guardiao' as SilhouetteId, nome: 'Guardião' }
  ],
  cabelos: [
    { id: 'curto_espetado' as HairStyleId, nome: 'Espetado Lendário' },
    { id: 'longo_fluido' as HairStyleId, nome: 'Longo Fluido' },
    { id: 'trancas_guerreira' as HairStyleId, nome: 'Tranças Reais' },
    { id: 'topete_real' as HairStyleId, nome: 'Topete Imperial' },
    { id: 'elmo_aberto' as HairStyleId, nome: 'Elmo Crista Aberta' }
  ],
  roupas: [
    { id: 'tunica_olimpica' as OutfitStyleId, nome: 'Túnica Olímpica' },
    { id: 'capa_real' as OutfitStyleId, nome: 'Manto & Capa Real' },
    { id: 'kimono_lendario' as OutfitStyleId, nome: 'Túnica Oriental (Haori)' },
    { id: 'armadura_leve' as OutfitStyleId, nome: 'Brigandina Tática' }
  ],
  armaduras: [
    { id: 'bronze_espartano' as ArmorStyleId, nome: 'Peitoral Espartano' },
    { id: 'ouro_celestial' as ArmorStyleId, nome: 'Ombreiras Celestiais' },
    { id: 'obsidiana' as ArmorStyleId, nome: 'Placa Obsidiana' },
    { id: 'sem_armadura' as ArmorStyleId, nome: 'Sem Armadura' }
  ],
  calcados: [
    { id: 'grevas_aladas' as FootwearStyleId, nome: 'Grevas Aladas' },
    { id: 'botas_couro' as FootwearStyleId, nome: 'Botas de Couro' },
    { id: 'sandalias_divinas' as FootwearStyleId, nome: 'Sandálias Olímpicas' }
  ],
  acessorios: [
    { id: 'lanca_olimpica' as AccessoryStyleId, nome: 'Lança Olímpica' },
    { id: 'escudo_egide' as AccessoryStyleId, nome: 'Escudo Égide' },
    { id: 'asas_divinas' as AccessoryStyleId, nome: 'Asas Divinas' },
    { id: 'coroa_louros' as AccessoryStyleId, nome: 'Coroa de Louros' },
    { id: 'cachecol_ventos' as AccessoryStyleId, nome: 'Cachecol dos Ventos' },
    { id: 'nenhum' as AccessoryStyleId, nome: 'Nenhum' }
  ],
  expressoes: [
    { id: 'confiante' as ExpressionId, nome: 'Confiante' },
    { id: 'serio' as ExpressionId, nome: 'Sério / Focado' },
    { id: 'feliz' as ExpressionId, nome: 'Feliz /Radiante' },
    { id: 'batalha' as ExpressionId, nome: 'Grito de Batalha' }
  ]
};

function makeMat(hex: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: 0.55, metalness: 0.15 });
}

function buildFaceFeatures(
  headGroup: THREE.Group,
  style: VisualStyleId,
  expression: ExpressionId,
  headRadius: number,
  hairColorHex: string
): void {
  const zFace = headRadius * 0.92;
  const eyeMatWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const irisHex = style === 'anime' ? '#2563eb' : style === 'cartoon' ? '#0f172a' : '#1e3a5f';
  const irisMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(irisHex) });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x090d16 });
  const browMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(hairColorHex || '#1e293b') });

  for (const dir of [-1, 1]) {
    const eyeGroup = new THREE.Group();
    const eyeX = dir * headRadius * (style === 'anime' ? 0.36 : 0.34);
    const eyeY = style === 'anime' ? -headRadius * 0.04 : headRadius * 0.04;
    eyeGroup.position.set(eyeX, eyeY, zFace);

    if (style === 'anime') {
      // Multi-layered crisp anime eye (sclera + tall iris + dark pupil + specular highlights + upper lash)
      const sclera = new THREE.Mesh(new THREE.BoxGeometry(headRadius * 0.3, headRadius * 0.32, 0.02), eyeMatWhite);
      sclera.userData = { regionKey: 'detalhes', materialRole: 'eye', skipStyleOverride: true, noOutline: true };
      eyeGroup.add(sclera);

      const iris = new THREE.Mesh(new THREE.BoxGeometry(headRadius * 0.19, headRadius * 0.25, 0.025), irisMat);
      iris.position.set(-dir * 0.008, -0.004, 0.005);
      iris.userData = { regionKey: 'detalhes', materialRole: 'eye', skipStyleOverride: true, noOutline: true };
      eyeGroup.add(iris);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(headRadius * 0.055, 8, 8), pupilMat);
      pupil.position.set(-dir * 0.008, -0.004, 0.015);
      pupil.userData = { regionKey: 'detalhes', materialRole: 'eye', skipStyleOverride: true, noOutline: true };
      eyeGroup.add(pupil);

      const catchLight = new THREE.Mesh(new THREE.SphereGeometry(headRadius * 0.036, 6, 6), eyeMatWhite);
      catchLight.position.set(dir * 0.022, 0.026, 0.022);
      catchLight.userData = { regionKey: 'detalhes', materialRole: 'eye', skipStyleOverride: true, noOutline: true };
      eyeGroup.add(catchLight);

      const lash = new THREE.Mesh(new THREE.BoxGeometry(headRadius * 0.33, 0.024, 0.028), browMat);
      lash.position.set(0, headRadius * 0.16, 0.01);
      lash.rotation.z = dir * (expression === 'batalha' ? -0.18 : 0.06);
      lash.userData = { regionKey: 'cabelo', materialRole: 'eye', skipStyleOverride: true, noOutline: true };
      eyeGroup.add(lash);
    } else if (style === 'cartoon') {
      // Big expressive cartoon ovals + shiny pupil
      const sclera = new THREE.Mesh(new THREE.SphereGeometry(headRadius * 0.17, 10, 10), eyeMatWhite);
      sclera.scale.set(0.95, 1.25, 0.45);
      sclera.userData = { regionKey: 'detalhes', materialRole: 'eye', skipStyleOverride: true, noOutline: true };
      eyeGroup.add(sclera);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(headRadius * 0.085, 8, 8), pupilMat);
      pupil.scale.set(0.9, 1.15, 0.5);
      pupil.position.set(-dir * 0.006, 0, headRadius * 0.055);
      pupil.userData = { regionKey: 'detalhes', materialRole: 'eye', skipStyleOverride: true, noOutline: true };
      eyeGroup.add(pupil);

      const shine = new THREE.Mesh(new THREE.SphereGeometry(headRadius * 0.032, 6, 6), eyeMatWhite);
      shine.position.set(dir * 0.014, 0.022, headRadius * 0.085);
      shine.userData = { regionKey: 'detalhes', materialRole: 'eye', skipStyleOverride: true, noOutline: true };
      eyeGroup.add(shine);
    } else {
      // Stylized 3D realistic sculpted almond eye
      const sclera = new THREE.Mesh(new THREE.SphereGeometry(headRadius * 0.125, 10, 10), eyeMatWhite);
      sclera.scale.set(1.25, 0.85, 0.55);
      sclera.userData = { regionKey: 'detalhes', materialRole: 'eye', skipStyleOverride: true, noOutline: true };
      eyeGroup.add(sclera);

      const iris = new THREE.Mesh(new THREE.SphereGeometry(headRadius * 0.075, 8, 8), irisMat);
      iris.scale.set(1, 1, 0.5);
      iris.position.set(0, 0, headRadius * 0.05);
      iris.userData = { regionKey: 'detalhes', materialRole: 'eye', skipStyleOverride: true, noOutline: true };
      eyeGroup.add(iris);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(headRadius * 0.04, 6, 6), pupilMat);
      pupil.position.set(0, 0, headRadius * 0.068);
      pupil.userData = { regionKey: 'detalhes', materialRole: 'eye', skipStyleOverride: true, noOutline: true };
      eyeGroup.add(pupil);
    }

    // Eyebrows driven by expression
    const brow = new THREE.Mesh(
      new THREE.BoxGeometry(headRadius * 0.28, style === 'cartoon' ? 0.032 : 0.02, 0.028),
      browMat
    );
    const browTilt =
      expression === 'batalha' ? -0.34 : expression === 'serio' ? -0.2 : expression === 'feliz' ? 0.14 : -0.05;
    brow.position.set(eyeX, headRadius * (style === 'cartoon' ? 0.30 : 0.23), zFace + 0.015);
    brow.rotation.z = dir * browTilt;
    brow.userData = { regionKey: 'cabelo', materialRole: 'eye', skipStyleOverride: true, noOutline: true };
    headGroup.add(brow);
    headGroup.add(eyeGroup);
  }

  // Stylized / Cartoon Nose
  if (style !== 'anime') {
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(headRadius * (style === 'cartoon' ? 0.12 : 0.08), headRadius * 0.18, 6),
      makeMat('#d89e76')
    );
    nose.rotation.x = Math.PI * 0.38;
    nose.position.set(0, -headRadius * 0.1, zFace + 0.045);
    tagMeshRegion(nose, 'pele', 'skin');
    nose.userData.noOutline = true;
    headGroup.add(nose);
  }

  // Expression Mouth
  const mouthColor = expression === 'batalha' ? 0x7f1d1d : expression === 'feliz' ? 0xf87171 : 0x991b1b;
  const mouthMat = new THREE.MeshBasicMaterial({ color: mouthColor });
  if (expression === 'batalha') {
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(headRadius * 0.34, headRadius * 0.18, 0.03), mouthMat);
    mouth.position.set(0, -headRadius * 0.42, zFace + 0.01);
    mouth.userData = { regionKey: 'detalhes', materialRole: 'eye', skipStyleOverride: true, noOutline: true };
    headGroup.add(mouth);
  } else if (expression === 'feliz' || expression === 'confiante') {
    const mouth = new THREE.Mesh(
      new THREE.TorusGeometry(headRadius * (expression === 'feliz' ? 0.17 : 0.13), 0.016, 6, 12, Math.PI),
      mouthMat
    );
    mouth.rotation.z = Math.PI;
    mouth.position.set(0, -headRadius * 0.36, zFace + 0.015);
    mouth.userData = { regionKey: 'detalhes', materialRole: 'eye', skipStyleOverride: true, noOutline: true };
    headGroup.add(mouth);
  } else {
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(headRadius * 0.24, 0.02, 0.02), mouthMat);
    mouth.position.set(0, -headRadius * 0.40, zFace + 0.015);
    mouth.userData = { regionKey: 'detalhes', materialRole: 'eye', skipStyleOverride: true, noOutline: true };
    headGroup.add(mouth);
  }
}

function buildHair(
  headGroup: THREE.Group,
  cabelo: HairStyleId,
  style: VisualStyleId,
  headRadius: number,
  hairHex: string,
  armaduraHex: string,
  segs: number
): void {
  const hairGroup = new THREE.Group();
  const hairMat = makeMat(hairHex);
  const armorMat = makeMat(armaduraHex);

  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(headRadius * 1.07, segs, segs, 0, Math.PI * 2, 0, Math.PI * 0.58),
    hairMat
  );
  cap.position.y = headRadius * 0.04;
  hairGroup.add(cap);

  if (cabelo === 'curto_espetado') {
    const spikeCount = style === 'anime' ? 11 : 7;
    for (let i = 0; i < spikeCount; i++) {
      const angle = (i / spikeCount) * Math.PI * 2;
      const len = style === 'anime' ? headRadius * 0.85 : headRadius * 0.56;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(headRadius * 0.22, len, 5), hairMat);
      spike.position.set(
        Math.cos(angle) * headRadius * 0.62,
        headRadius * 0.72 + (i % 2) * 0.03,
        Math.sin(angle) * headRadius * 0.62
      );
      spike.rotation.z = -Math.cos(angle) * 0.65;
      spike.rotation.x = Math.sin(angle) * 0.65;
      hairGroup.add(spike);
    }
    if (style === 'anime') {
      // Layered front bangs
      for (const bx of [-0.11, 0, 0.11]) {
        const bang = new THREE.Mesh(new THREE.ConeGeometry(headRadius * 0.14, headRadius * 0.55, 4), hairMat);
        bang.rotation.x = Math.PI - 0.22;
        bang.position.set(bx, headRadius * 0.52, headRadius * 0.92);
        hairGroup.add(bang);
      }
    }
  } else if (cabelo === 'longo_fluido') {
    const backFlow = new THREE.Mesh(
      new THREE.CylinderGeometry(headRadius * 0.95, headRadius * 1.12, headRadius * 2.1, segs),
      hairMat
    );
    backFlow.scale.set(1.0, 1.0, 0.55);
    backFlow.position.set(0, -headRadius * 0.65, -headRadius * 0.55);
    hairGroup.add(backFlow);

    for (const dir of [-1, 1]) {
      const sideLock = new THREE.Mesh(
        new THREE.ConeGeometry(headRadius * 0.2, headRadius * 1.35, 6),
        hairMat
      );
      sideLock.rotation.x = Math.PI;
      sideLock.position.set(dir * headRadius * 0.88, -headRadius * 0.28, headRadius * 0.35);
      hairGroup.add(sideLock);
    }
  } else if (cabelo === 'trancas_guerreira') {
    for (const dir of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const orb = new THREE.Mesh(new THREE.SphereGeometry(headRadius * 0.22, 10, 8), hairMat);
        orb.position.set(dir * headRadius * 0.92, headRadius * (0.05 - k * 0.36), -headRadius * 0.22);
        hairGroup.add(orb);
      }
    }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(headRadius * 0.28, headRadius * 1.4, 8), hairMat);
    tail.rotation.x = Math.PI + 0.18;
    tail.position.set(0, -headRadius * 0.42, -headRadius * 0.92);
    hairGroup.add(tail);
  } else if (cabelo === 'topete_real') {
    const pompadour = new THREE.Mesh(
      new THREE.BoxGeometry(headRadius * 0.85, headRadius * 0.55, headRadius * 1.1),
      hairMat
    );
    pompadour.position.set(0, headRadius * 0.88, headRadius * 0.25);
    pompadour.rotation.x = -0.2;
    hairGroup.add(pompadour);
  } else if (cabelo === 'elmo_aberto') {
    const helm = new THREE.Mesh(
      new THREE.SphereGeometry(headRadius * 1.12, segs, segs, 0, Math.PI * 2, 0, Math.PI * 0.54),
      armorMat
    );
    helm.position.y = headRadius * 0.08;
    tagMeshRegion(helm, 'armadura', 'metal');
    hairGroup.add(helm);

    const crest = new THREE.Mesh(
      new THREE.TorusGeometry(headRadius * 1.18, headRadius * 0.16, 8, segs, Math.PI * 0.85),
      makeMat('#dc2626')
    );
    crest.rotation.y = Math.PI / 2;
    crest.position.set(0, headRadius * 0.22, -headRadius * 0.12);
    tagMeshRegion(crest, 'asas', 'feather');
    hairGroup.add(crest);
  }

  // Only tag hair meshes that weren't explicitly tagged as armadura/asas
  hairGroup.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh && !m.userData.regionKey) {
      m.userData.regionKey = 'cabelo';
      m.userData.materialRole = 'hair';
    }
  });
  headGroup.add(hairGroup);
}

export function buildCharacterPieceModel(
  rawConfig: Partial<CharacterConfig> = {},
  lowDetail = false
): THREE.Group {
  const cfg: CharacterConfig = {
    ...DEFAULT_CHARACTER_CONFIG,
    ...rawConfig,
    coresPorRegiao: {
      ...DEFAULT_REGION_COLORS,
      ...(rawConfig.coresPorRegiao || {})
    }
  };

  const style = cfg.estiloVisual || 'stylized3d';
  const cores = cfg.coresPorRegiao;
  const segs = lowDetail ? 12 : 22;

  const root = new THREE.Group();
  root.name = `personagem_${style}`;

  // Style-specific anatomical proportions (distinct geometry, never just a shader!)
  const isCartoon = style === 'cartoon';
  const isAnime = style === 'anime';
  const headScale = isCartoon ? 1.32 : isAnime ? 1.1 : 0.94;
  const widthFactor =
    cfg.silhueta === 'guardiao' ? 1.2 : cfg.silhueta === 'agil' ? 0.88 : 1.02;
  const legHeight = isCartoon ? 0.56 : isAnime ? 0.72 : 0.68;
  const torsoHeight = isCartoon ? 0.52 : isAnime ? 0.6 : 0.62;
  const torsoRadiusTop = (isCartoon ? 0.27 : isAnime ? 0.22 : 0.26) * widthFactor;
  const torsoRadiusBot = (isCartoon ? 0.23 : isAnime ? 0.16 : 0.19) * widthFactor;

  // 1. Subtle Mythological Pedestal Base
  const baseDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.48, 0.09, segs),
    makeMat(cores.detalhes || '#fbbf24')
  );
  baseDisc.position.y = 0.045;
  tagMeshRegion(baseDisc, 'detalhes', 'stone');
  root.add(baseDisc);

  const ringBase = new THREE.Mesh(
    new THREE.TorusGeometry(0.43, 0.022, 8, segs),
    makeMat(cores.armadura || '#d97706')
  );
  ringBase.rotation.x = Math.PI / 2;
  ringBase.position.y = 0.09;
  tagMeshRegion(ringBase, 'detalhes', 'metal');
  root.add(ringBase);

  // 2. Pelvis Pivot
  const pelvis = new THREE.Group();
  pelvis.position.y = 0.09 + legHeight;
  root.add(pelvis);

  const waistMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(torsoRadiusBot * 0.96, torsoRadiusBot * 1.02, 0.16, segs),
    makeMat(cores.barriga || '#f3e8d2')
  );
  waistMesh.position.y = 0.05;
  tagMeshRegion(waistMesh, 'barriga', 'fabric');
  pelvis.add(waistMesh);

  const beltMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(torsoRadiusBot * 1.08, torsoRadiusBot * 1.08, 0.06, segs),
    makeMat(cores.detalhes || '#fbbf24')
  );
  beltMesh.position.y = 0.06;
  tagMeshRegion(beltMesh, 'detalhes', 'metal');
  pelvis.add(beltMesh);

  // Legs + Footwear
  const makeLeg = (dir: -1 | 1): THREE.Group => {
    const legPivot = new THREE.Group();
    legPivot.position.set(dir * torsoRadiusBot * 0.56, 0, 0);

    const thigh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.082 * widthFactor, 0.068 * widthFactor, legHeight * 0.56, segs),
      makeMat(cores.pele || '#eab68c')
    );
    thigh.position.y = -legHeight * 0.28;
    tagMeshRegion(thigh, 'pele', 'skin');
    legPivot.add(thigh);

    const shinHeight = legHeight * 0.44;
    const bootColor = cores.calcado || '#5c3a21';
    const greaveRole = cfg.calcado === 'grevas_aladas' ? 'metal' : 'leather';
    const shin = new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.075 * widthFactor,
        cfg.calcado === 'botas_couro' ? 0.088 : 0.068,
        shinHeight,
        segs
      ),
      makeMat(bootColor)
    );
    shin.position.y = -legHeight * 0.76;
    tagMeshRegion(shin, 'calcado', greaveRole);
    legPivot.add(shin);

    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(
        isCartoon ? 0.16 : 0.13,
        isCartoon ? 0.11 : 0.09,
        isCartoon ? 0.24 : 0.21
      ),
      makeMat(bootColor)
    );
    foot.position.set(0, -legHeight + 0.045, 0.045);
    tagMeshRegion(foot, 'calcado', greaveRole);
    legPivot.add(foot);

    if (cfg.calcado === 'grevas_aladas') {
      const ankleWing = new THREE.Mesh(
        new THREE.ConeGeometry(0.045, 0.14, 5),
        makeMat(cores.detalhes || '#fbbf24')
      );
      ankleWing.rotation.x = -Math.PI * 0.35;
      ankleWing.position.set(dir * 0.08, -legHeight + 0.12, -0.05);
      tagMeshRegion(ankleWing, 'detalhes', 'metal');
      legPivot.add(ankleWing);
    }
    return legPivot;
  };

  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);
  pelvis.add(leftLeg, rightLeg);

  // 3. Torso Pivot (Outfit + Armor + Breastplate)
  const torso = new THREE.Group();
  torso.position.y = 0.1;
  pelvis.add(torso);

  const chestMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(torsoRadiusTop, torsoRadiusBot, torsoHeight, segs),
    makeMat(cores.roupa || '#1d4ed8')
  );
  chestMesh.position.y = torsoHeight * 0.5;
  tagMeshRegion(chestMesh, 'roupa', 'fabric');
  torso.add(chestMesh);

  // Outfit Silhouette Detail
  if (cfg.roupa === 'tunica_olimpica' || cfg.roupa === 'kimono_lendario') {
    const skirt = new THREE.Mesh(
      new THREE.CylinderGeometry(torsoRadiusBot * 1.05, torsoRadiusBot * 1.38, 0.28, segs),
      makeMat(cores.roupa || '#1d4ed8')
    );
    skirt.position.y = -0.1;
    tagMeshRegion(skirt, 'roupa', 'fabric');
    torso.add(skirt);
  }
  if (cfg.roupa === 'kimono_lendario') {
    // Haori wide collar / sash
    for (const dir of [-1, 1]) {
      const lapel = new THREE.Mesh(
        new THREE.BoxGeometry(0.075, torsoHeight * 0.85, 0.04),
        makeMat(cores.detalhes || '#fbbf24')
      );
      lapel.position.set(dir * 0.065, torsoHeight * 0.52, torsoRadiusTop * 0.82);
      lapel.rotation.z = dir * 0.18;
      tagMeshRegion(lapel, 'detalhes', 'fabric');
      torso.add(lapel);
    }
  }

  // Armor Breastplate & Shoulder Pauldrons
  if (cfg.armadura !== 'sem_armadura') {
    const breastplate = new THREE.Mesh(
      new THREE.CylinderGeometry(torsoRadiusTop * 1.06, torsoRadiusBot * 1.04, torsoHeight * 0.72, segs),
      makeMat(cores.peitoral || '#b45309')
    );
    breastplate.position.y = torsoHeight * 0.56;
    tagMeshRegion(breastplate, 'peitoral', 'metal');
    torso.add(breastplate);

    for (const dir of [-1, 1]) {
      const pauldronSize = cfg.armadura === 'ouro_celestial' ? 0.16 : 0.13;
      const pauldron = new THREE.Mesh(
        new THREE.SphereGeometry(pauldronSize * widthFactor, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.65),
        makeMat(cores.armadura || '#d97706')
      );
      pauldron.position.set(dir * (torsoRadiusTop + 0.06), torsoHeight * 0.86, 0);
      pauldron.rotation.z = -dir * 0.35;
      tagMeshRegion(pauldron, 'armadura', 'metal');
      torso.add(pauldron);
    }
  }

  // Optional Photo Reference Crest Emblem on Breastplate (when user attaches a photo reference)
  if (cfg.photoRefDataUrl && cfg.aplicarEmblemaFoto && typeof document !== 'undefined') {
    try {
      const img = new Image();
      img.src = cfg.photoRefDataUrl;
      const crestTex = new THREE.Texture(img);
      crestTex.colorSpace = THREE.SRGBColorSpace;
      img.onload = () => {
        crestTex.needsUpdate = true;
      };
      if (img.complete) crestTex.needsUpdate = true;
      const badgeMat = new THREE.MeshStandardMaterial({
        map: crestTex,
        roughness: 0.35,
        metalness: 0.12
      });
      const badgeDisc = new THREE.Mesh(new THREE.CircleGeometry(0.105, 18), badgeMat);
      badgeDisc.position.set(0, torsoHeight * 0.62, torsoRadiusTop * 1.07);
      badgeDisc.userData = {
        regionKey: 'detalhes',
        materialRole: 'gem',
        skipStyleOverride: true,
        noOutline: true
      };
      torso.add(badgeDisc);
    } catch {
      // Ignore badge load issue gracefully
    }
  }

  // Cape on capa_real
  let capePivot: THREE.Group | undefined;
  if (cfg.roupa === 'capa_real') {
    capePivot = new THREE.Group();
    capePivot.position.set(0, torsoHeight * 0.88, -torsoRadiusTop * 0.82);
    const capeMesh = new THREE.Mesh(
      new THREE.BoxGeometry(torsoRadiusTop * 2.1, torsoHeight * 1.45, 0.035),
      makeMat(cores.asas || '#dc2626')
    );
    capeMesh.position.set(0, -torsoHeight * 0.72, -0.05);
    capeMesh.rotation.x = 0.14;
    tagMeshRegion(capeMesh, 'asas', 'fabric');
    capePivot.add(capeMesh);
    torso.add(capePivot);
  }

  // 4. Arms + Held Accessories
  const armLength = torsoHeight * 0.82;
  const makeArm = (dir: -1 | 1): THREE.Group => {
    const armPivot = new THREE.Group();
    armPivot.position.set(dir * (torsoRadiusTop + 0.075), torsoHeight * 0.82, 0);

    const upperArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.058, armLength * 0.55, 10),
      makeMat(cores.pele || '#eab68c')
    );
    upperArm.position.y = -armLength * 0.27;
    tagMeshRegion(upperArm, 'pele', 'skin');
    armPivot.add(upperArm);

    const bracer = new THREE.Mesh(
      new THREE.CylinderGeometry(0.062, 0.056, armLength * 0.42, 10),
      makeMat(cores.armadura || '#d97706')
    );
    bracer.position.y = -armLength * 0.7;
    tagMeshRegion(bracer, 'armadura', 'metal');
    armPivot.add(bracer);

    const hand = new THREE.Mesh(
      new THREE.SphereGeometry(isCartoon ? 0.076 : 0.06, 10, 8),
      makeMat(cores.pele || '#eab68c')
    );
    hand.position.y = -armLength * 0.94;
    tagMeshRegion(hand, 'pele', 'skin');
    armPivot.add(hand);

    return armPivot;
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);
  torso.add(leftArm, rightArm);

  // Accessories (Spear, Shield, Wings, Crown, Scarf)
  let leftWing: THREE.Group | undefined;
  let rightWing: THREE.Group | undefined;

  if (cfg.acessorio === 'lanca_olimpica') {
    const spearGroup = new THREE.Group();
    spearGroup.position.set(0, -armLength * 0.85, 0.04);
    spearGroup.rotation.x = Math.PI * 0.36;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.42, 8), makeMat('#78350f'));
    tagMeshRegion(shaft, 'acessorios', 'wood');
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.24, 6), makeMat(cores.acessorios || '#38bdf8'));
    tip.position.y = 0.78;
    tagMeshRegion(tip, 'acessorios', 'gem');
    spearGroup.add(shaft, tip);
    rightArm.add(spearGroup);
  } else if (cfg.acessorio === 'escudo_egide') {
    const shield = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.05, segs),
      makeMat(cores.acessorios || '#38bdf8')
    );
    shield.rotation.z = Math.PI / 2;
    shield.position.set(-0.08, -armLength * 0.6, 0.08);
    tagMeshRegion(shield, 'acessorios', 'metal');
    leftArm.add(shield);
  } else if (cfg.acessorio === 'asas_divinas') {
    for (const dir of [-1, 1] as const) {
      const wPivot = new THREE.Group();
      wPivot.position.set(dir * 0.12, torsoHeight * 0.72, -torsoRadiusTop * 0.75);
      for (let f = 0; f < 3; f++) {
        const feather = new THREE.Mesh(
          new THREE.BoxGeometry(0.56 - f * 0.09, 0.14, 0.03),
          makeMat(cores.asas || '#e2e8f0')
        );
        feather.position.set(dir * (0.28 + (2 - f) * 0.03), 0.16 - f * 0.14, -0.05);
        feather.rotation.z = dir * (0.28 - f * 0.12);
        tagMeshRegion(feather, 'asas', 'feather');
        wPivot.add(feather);
      }
      torso.add(wPivot);
      if (dir === -1) leftWing = wPivot;
      else rightWing = wPivot;
    }
  } else if (cfg.acessorio === 'cachecol_ventos') {
    const neckScarf = new THREE.Mesh(
      new THREE.TorusGeometry(torsoRadiusTop * 0.65, 0.065, 8, segs),
      makeMat(cores.acessorios || '#38bdf8')
    );
    neckScarf.rotation.x = Math.PI / 2;
    neckScarf.position.y = torsoHeight + 0.03;
    tagMeshRegion(neckScarf, 'acessorios', 'fabric');
    torso.add(neckScarf);

    const tailScarf = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.56, 0.035),
      makeMat(cores.acessorios || '#38bdf8')
    );
    tailScarf.position.set(0.1, torsoHeight * 0.72, -torsoRadiusTop * 0.95);
    tailScarf.rotation.x = 0.25;
    tagMeshRegion(tailScarf, 'acessorios', 'fabric');
    torso.add(tailScarf);
  }

  // 5. Head Pivot + Style Face + Hair + Crown
  const headRadius = 0.21 * headScale;
  const head = new THREE.Group();
  head.position.set(0, torsoHeight + 0.06 + headRadius * 0.92, 0);
  torso.add(head);

  const headGeo = isAnime
    ? new THREE.SphereGeometry(headRadius, segs, segs)
    : new THREE.SphereGeometry(headRadius, segs, segs);
  const headMesh = new THREE.Mesh(headGeo, makeMat(cores.pele || '#eab68c'));
  if (isAnime) headMesh.scale.set(0.95, 1.04, 0.92);
  else if (isCartoon) headMesh.scale.set(1.06, 0.98, 1.0);
  tagMeshRegion(headMesh, 'pele', 'skin');
  head.add(headMesh);

  buildFaceFeatures(head, style, cfg.expressao, headRadius, cores.cabelo || '#292524');
  buildHair(
    head,
    cfg.cabelo,
    style,
    headRadius,
    cores.cabelo || '#292524',
    cores.armadura || '#d97706',
    segs
  );

  if (cfg.acessorio === 'coroa_louros') {
    const laurel = new THREE.Mesh(
      new THREE.TorusGeometry(headRadius * 1.05, 0.028, 6, segs),
      makeMat(cores.acessorios || '#fbbf24')
    );
    laurel.rotation.x = Math.PI / 2 - 0.18;
    laurel.position.y = headRadius * 0.42;
    tagMeshRegion(laurel, 'acessorios', 'metal');
    head.add(laurel);
  }

  // Normalize total height to board scale (1.88 units above pedestal y=0)
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const targetH = 1.88;
  const maxDim = Math.max(size.y, 0.001);
  const s = targetH / maxDim;
  root.scale.setScalar(s);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  const center2 = new THREE.Vector3();
  box2.getCenter(center2);
  root.position.set(-center2.x, -box2.min.y, -center2.z);

  root.userData.rig = {
    pelvis,
    torso,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    leftWing,
    rightWing,
    cape: capePivot,
    baseY: pelvis.position.y
  } satisfies ArticulatedRig;

  applyVisualStyleAndRegionColors(root, style, cores, lowDetail);
  root.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (m.isMesh && !m.userData.isOutlineMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return root;
}

export function updateCharacterRigAnimation(
  root: THREE.Object3D | null,
  elapsedSec: number,
  mode: RigAnimationMode = 'idle',
  strideScale = 1
): void {
  if (!root) return;
  const rig = root.userData?.rig as ArticulatedRig | undefined;

  // Modelos importados sem esqueleto permanecem apoiados no tabuleiro.
  // Evita saltos e inclinações globais que davam a impressão de sair da superfície.
  if (!rig) {
    root.position.y = 0;
    root.rotation.z = 0;
    if (mode === 'caminhar') {
      root.rotation.x = Math.sin(elapsedSec * 7.2) * 0.012;
    } else {
      root.rotation.x = 0;
    }
    return;
  }

  const baseY = rig.baseY || 0.7;

  if (mode === 'caminhar') {
    const freq = 7.2 * strideScale;
    const swing = Math.sin(elapsedSec * freq);

    if (rig.pelvis) {
      rig.pelvis.position.y = baseY;
      rig.pelvis.rotation.z = swing * 0.012;
    }
    if (rig.torso) {
      rig.torso.rotation.y = -swing * 0.045;
      rig.torso.rotation.x = 0.025;
    }
    // Passos curtos e alternados, com o quadril sempre na altura de repouso.
    if (rig.leftLeg) rig.leftLeg.rotation.x = swing * 0.34;
    if (rig.rightLeg) rig.rightLeg.rotation.x = -swing * 0.34;
    if (rig.leftArm) rig.leftArm.rotation.x = -swing * 0.24;
    if (rig.rightArm) rig.rightArm.rotation.x = swing * 0.24;
    if (rig.head) {
      rig.head.rotation.y = swing * 0.05;
      rig.head.rotation.x = -0.04;
    }
    if (rig.cape) rig.cape.rotation.x = 0.12 + Math.abs(swing) * 0.035;
    if (rig.leftWing) rig.leftWing.rotation.y = 0.2 + Math.sin(elapsedSec * 10) * 0.18;
    if (rig.rightWing) rig.rightWing.rotation.y = -0.2 - Math.sin(elapsedSec * 10) * 0.18;
    root.position.y = 0;
    return;
  }

  if (mode === 'comemorar') {
    const gesture = Math.sin(elapsedSec * 5.2);
    if (rig.pelvis) {
      rig.pelvis.position.y = baseY;
      rig.pelvis.rotation.z = 0;
    }
    if (rig.torso) {
      rig.torso.rotation.y = Math.sin(elapsedSec * 3.4) * 0.18;
      rig.torso.rotation.x = -0.06;
    }
    if (rig.leftLeg) rig.leftLeg.rotation.x = -0.08;
    if (rig.rightLeg) rig.rightLeg.rotation.x = 0.08;
    if (rig.leftArm) rig.leftArm.rotation.x = -1.55 + gesture * 0.12;
    if (rig.rightArm) rig.rightArm.rotation.x = -1.65 - gesture * 0.12;
    if (rig.head) rig.head.rotation.x = -0.1;
    if (rig.leftWing) rig.leftWing.rotation.y = 0.35 + Math.sin(elapsedSec * 8) * 0.28;
    if (rig.rightWing) rig.rightWing.rotation.y = -0.35 - Math.sin(elapsedSec * 8) * 0.28;
    return;
  }

  // Idle breathing & subtle heroic sway
  const breath = Math.sin(elapsedSec * 2.2);
  if (rig.pelvis) {
    rig.pelvis.position.y = baseY + breath * 0.015;
    rig.pelvis.rotation.z = 0;
  }
  if (rig.torso) {
    rig.torso.rotation.y = Math.sin(elapsedSec * 1.1) * 0.04;
    rig.torso.rotation.x = breath * 0.02;
  }
  if (rig.leftLeg) rig.leftLeg.rotation.x = 0;
  if (rig.rightLeg) rig.rightLeg.rotation.x = 0;
  if (rig.leftArm) rig.leftArm.rotation.x = breath * 0.05;
  if (rig.rightArm) rig.rightArm.rotation.x = -breath * 0.05;
  if (rig.head) {
    rig.head.rotation.y = Math.sin(elapsedSec * 0.9) * 0.08;
    rig.head.rotation.x = breath * 0.03;
  }
  if (rig.cape) rig.cape.rotation.x = 0.08 + breath * 0.04;
  if (rig.leftWing) rig.leftWing.rotation.y = 0.12 + breath * 0.1;
  if (rig.rightWing) rig.rightWing.rotation.y = -0.12 - breath * 0.1;
}

export interface PhotoPaletteSuggestion {
  pele: string;
  cabelo: string;
  roupa: string;
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * Amostragem local de paleta cromática a partir de imagem 2D (apenas referência visual local,
 * sem reconstrução biométrica ou chamadas externas).
 */
export async function analyzePhotoReferencePalette(
  photoDataUrl: string
): Promise<PhotoPaletteSuggestion> {
  const fallback: PhotoPaletteSuggestion = {
    pele: '#eab68c',
    cabelo: '#292524',
    roupa: '#1d4ed8'
  };
  if (typeof document === 'undefined' || !photoDataUrl) return fallback;

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Falha ao ler imagem de referência.'));
      i.src = photoDataUrl;
    });

    const size = 24;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return fallback;
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;

    const avgBand = (yStart: number, yEnd: number, xStart: number, xEnd: number) => {
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;
      for (let y = yStart; y < yEnd; y++) {
        for (let x = xStart; x < xEnd; x++) {
          const idx = (y * size + x) * 4;
          if (data[idx + 3] < 40) continue;
          r += data[idx];
          g += data[idx + 1];
          b += data[idx + 2];
          count++;
        }
      }
      if (!count) return null;
      return rgbToHex(r / count, g / count, b / count);
    };

    const cabelo = avgBand(1, 7, 5, 19) || fallback.cabelo;
    const pele = avgBand(8, 15, 7, 17) || fallback.pele;
    const roupa = avgBand(16, 23, 4, 20) || fallback.roupa;
    return { pele, cabelo, roupa };
  } catch {
    return fallback;
  }
}

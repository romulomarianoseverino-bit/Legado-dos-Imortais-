import * as THREE from 'three';
import {
  VisualStyleId,
  RegionColorMap,
  ClothingPatternId,
  CLOTHING_PATTERN_CATALOG,
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
  | 'elmo_aberto'
  | 'curto_ondulado'
  | 'curto_cacheado'
  | 'bob_mecha'
  | 'careca';
export type FacialHairId =
  | 'nenhuma'
  | 'barba_por_fazer'
  | 'barba_curta'
  | 'cavanhaque'
  | 'barba_cheia'
  | 'bigode';
export type FaceShapeId = 'oval' | 'quadrado' | 'angular' | 'suave' | 'redondo';
export type OutfitStyleId =
  | 'tunica_olimpica'
  | 'capa_real'
  | 'kimono_lendario'
  | 'armadura_leve'
  | 'camiseta_casual'
  | 'jaqueta_moderna';
export type PantsStyleId = 'calca_reta' | 'calca_tatica' | 'saiote_guerreiro' | 'grevas_armadura';
export type ArmorStyleId = 'bronze_espartano' | 'ouro_celestial' | 'obsidiana' | 'sem_armadura';
export type FootwearStyleId = 'grevas_aladas' | 'botas_couro' | 'sandalias_divinas' | 'tenis_casuais';
export type NeckAccessoryId = 'nenhum' | 'gargantilha' | 'gargantilha_couro' | 'medalhao' | 'cachecol';
export type AccessoryStyleId =
  | 'nenhum'
  | 'coroa_louros'
  | 'asas_divinas'
  | 'lanca_olimpica'
  | 'escudo_egide'
  | 'cachecol_ventos';
export type ExpressionId = 'confiante' | 'serio' | 'feliz' | 'batalha';
export type RigAnimationMode =
  | 'idle'
  | 'caminhar'
  | 'comemorar'
  | 'surpresa'
  | 'frustracao'
  | 'vitoria'
  | 'derrota';

export interface ArmorSlotsConfig {
  crown?: boolean;
  choker?: boolean;
  pauldrons?: boolean;
  bracers?: boolean;
}

export interface CharacterConfig {
  estiloVisual: VisualStyleId;
  silhueta: SilhouetteId;
  rosto?: FaceShapeId;
  cabelo: HairStyleId;
  mechaAtiva?: boolean;
  barba?: FacialHairId;
  roupa: OutfitStyleId;
  calca?: PantsStyleId;
  armadura: ArmorStyleId;
  calcado: FootwearStyleId;
  colar?: NeckAccessoryId;
  acessorio: AccessoryStyleId;
  expressao: ExpressionId;
  animacao: RigAnimationMode;
  alturaEscala?: number; // 0.88..1.14
  larguraTorso?: number; // 0.85..1.20
  larguraMandibula?: number; // 0.82..1.22
  escalaOlhos?: number; // 0.82..1.25
  inclinacaoSobrancelha?: number; // -0.25..0.25
  tamanhoNariz?: number; // 0.80..1.30
  larguraBoca?: number; // 0.80..1.25
  padraoRoupa?: ClothingPatternId;
  padraoCalca?: ClothingPatternId;
  slotsArmadura?: ArmorSlotsConfig;
  coresPorRegiao: RegionColorMap;
  photoRefDataUrl?: string;
}

export interface OutfitPresetRecord {
  id: string;
  nome: string;
  roupa: OutfitStyleId;
  calca: PantsStyleId;
  armadura: ArmorStyleId;
  calcado: FootwearStyleId;
  colar: NeckAccessoryId;
  acessorio: AccessoryStyleId;
  padraoRoupa: ClothingPatternId;
  padraoCalca: ClothingPatternId;
  slotsArmadura: ArmorSlotsConfig;
  coresPorRegiao: Partial<RegionColorMap>;
  criadoEm: number;
}

export const DEFAULT_CHARACTER_CONFIG: CharacterConfig = {
  estiloVisual: 'stylized3d',
  silhueta: 'heroico',
  rosto: 'oval',
  cabelo: 'curto_espetado',
  mechaAtiva: false,
  barba: 'nenhuma',
  roupa: 'tunica_olimpica',
  calca: 'calca_reta',
  armadura: 'bronze_espartano',
  calcado: 'grevas_aladas',
  colar: 'nenhum',
  acessorio: 'lanca_olimpica',
  expressao: 'confiante',
  animacao: 'idle',
  alturaEscala: 1.0,
  larguraTorso: 1.0,
  larguraMandibula: 1.0,
  escalaOlhos: 1.0,
  inclinacaoSobrancelha: 0,
  tamanhoNariz: 1.0,
  larguraBoca: 1.0,
  padraoRoupa: 'solid',
  padraoCalca: 'solid',
  slotsArmadura: { crown: false, choker: false, pauldrons: true, bracers: true },
  coresPorRegiao: { ...DEFAULT_REGION_COLORS }
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
  wheelPivots?: THREE.Object3D[];
  baseY: number;
}

export const CHARACTER_CREATOR_OPTIONS = {
  silhuetas: [
    { id: 'heroico' as SilhouetteId, nome: 'Heroico' },
    { id: 'agil' as SilhouetteId, nome: 'Ágil' },
    { id: 'guardiao' as SilhouetteId, nome: 'Guardião' }
  ],
  rostos: [
    { id: 'oval' as FaceShapeId, nome: 'Oval Equilibrado' },
    { id: 'quadrado' as FaceShapeId, nome: 'Mandíbula Forte' },
    { id: 'angular' as FaceShapeId, nome: 'Angular Esculpido' },
    { id: 'suave' as FaceShapeId, nome: 'Suave / Delicado' },
    { id: 'redondo' as FaceShapeId, nome: 'Cheio / Jovem' }
  ],
  cabelos: [
    { id: 'curto_espetado' as HairStyleId, nome: 'Espetado Lendário' },
    { id: 'curto_ondulado' as HairStyleId, nome: 'Curto Ondulado' },
    { id: 'curto_cacheado' as HairStyleId, nome: 'Curto Cacheado' },
    { id: 'bob_mecha' as HairStyleId, nome: 'Bob Assimétrico (c/ Mecha)' },
    { id: 'longo_fluido' as HairStyleId, nome: 'Longo Fluido' },
    { id: 'trancas_guerreira' as HairStyleId, nome: 'Tranças Reais' },
    { id: 'topete_real' as HairStyleId, nome: 'Topete Imperial' },
    { id: 'elmo_aberto' as HairStyleId, nome: 'Elmo Crista Aberta' },
    { id: 'careca' as HairStyleId, nome: 'Raspado / Sem Cabelo' }
  ],
  barbas: [
    { id: 'nenhuma' as FacialHairId, nome: 'Sem Barba' },
    { id: 'barba_por_fazer' as FacialHairId, nome: 'Barba por Fazer' },
    { id: 'barba_curta' as FacialHairId, nome: 'Barba Curta Aparada' },
    { id: 'cavanhaque' as FacialHairId, nome: 'Cavanhaque' },
    { id: 'barba_cheia' as FacialHairId, nome: 'Barba Completa' },
    { id: 'bigode' as FacialHairId, nome: 'Bigode Clássico' }
  ],
  roupas: [
    { id: 'tunica_olimpica' as OutfitStyleId, nome: 'Túnica Olímpica' },
    { id: 'capa_real' as OutfitStyleId, nome: 'Manto & Capa Real' },
    { id: 'kimono_lendario' as OutfitStyleId, nome: 'Túnica Oriental (Haori)' },
    { id: 'armadura_leve' as OutfitStyleId, nome: 'Brigandina Tática' },
    { id: 'camiseta_casual' as OutfitStyleId, nome: 'Camiseta Casual' },
    { id: 'jaqueta_moderna' as OutfitStyleId, nome: 'Jaqueta Urbana' }
  ],
  calcas: [
    { id: 'calca_reta' as PantsStyleId, nome: 'Calça Alfaiataria' },
    { id: 'calca_tatica' as PantsStyleId, nome: 'Calça Cargo / Tática' },
    { id: 'saiote_guerreiro' as PantsStyleId, nome: 'Saiote Guerreiro' },
    { id: 'grevas_armadura' as PantsStyleId, nome: 'Perneira Blindada' }
  ],
  armaduras: [
    { id: 'bronze_espartano' as ArmorStyleId, nome: 'Peitoral Espartano' },
    { id: 'ouro_celestial' as ArmorStyleId, nome: 'Ombreiras Celestiais' },
    { id: 'obsidiana' as ArmorStyleId, nome: 'Placa Obsidiana' },
    { id: 'sem_armadura' as ArmorStyleId, nome: 'Sem Armadura (Casual)' }
  ],
  calcados: [
    { id: 'grevas_aladas' as FootwearStyleId, nome: 'Grevas Aladas' },
    { id: 'botas_couro' as FootwearStyleId, nome: 'Botas de Couro' },
    { id: 'sandalias_divinas' as FootwearStyleId, nome: 'Sandálias Olímpicas' },
    { id: 'tenis_casuais' as FootwearStyleId, nome: 'Tênis Casuais' }
  ],
  colares: [
    { id: 'nenhum' as NeckAccessoryId, nome: 'Sem Colar' },
    { id: 'gargantilha' as NeckAccessoryId, nome: 'Gargantilha / Choker' },
    { id: 'gargantilha_couro' as NeckAccessoryId, nome: 'Coleira Metálica' },
    { id: 'medalhao' as NeckAccessoryId, nome: 'Medalhão Solar' },
    { id: 'cachecol' as NeckAccessoryId, nome: 'Cachecol Envolvente' }
  ],
  acessorios: [
    { id: 'lanca_olimpica' as AccessoryStyleId, nome: 'Lança Olímpica' },
    { id: 'escudo_egide' as AccessoryStyleId, nome: 'Escudo Égide' },
    { id: 'asas_divinas' as AccessoryStyleId, nome: 'Asas Divinas' },
    { id: 'coroa_louros' as AccessoryStyleId, nome: 'Coroa de Louros' },
    { id: 'cachecol_ventos' as AccessoryStyleId, nome: 'Manto dos Ventos' },
    { id: 'nenhum' as AccessoryStyleId, nome: 'Nenhum' }
  ],
  expressoes: [
    { id: 'confiante' as ExpressionId, nome: 'Confiante' },
    { id: 'serio' as ExpressionId, nome: 'Sério / Focado' },
    { id: 'feliz' as ExpressionId, nome: 'Feliz / Radiante' },
    { id: 'batalha' as ExpressionId, nome: 'Grito de Batalha' }
  ],
  padroesTecido: CLOTHING_PATTERN_CATALOG
};

function makeMat(hex: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: 0.55, metalness: 0.15 });
}

function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function buildFaceFeatures(
  headGroup: THREE.Group,
  cfg: CharacterConfig,
  headRadius: number,
  hairColorHex: string
): void {
  const style = cfg.estiloVisual || 'stylized3d';
  const expression = cfg.expressao || 'confiante';
  const eyeScale = clampNum(cfg.escalaOlhos, 0.82, 1.25, 1.0);
  const browOffset = clampNum(cfg.inclinacaoSobrancelha, -0.25, 0.25, 0);
  const noseScale = clampNum(cfg.tamanhoNariz, 0.8, 1.3, 1.0);
  const mouthScale = clampNum(cfg.larguraBoca, 0.8, 1.25, 1.0);

  const zFace = headRadius * 0.91;
  const eyeMatWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const irisHex = style === 'anime' ? '#2563eb' : style === 'cartoon' ? '#0f172a' : '#3b2f2f';
  const irisMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(irisHex) });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x090d16 });
  const browMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(hairColorHex || '#1e293b') });

  for (const dir of [-1, 1] as const) {
    // Ears (realistic sculpted side ears)
    const ear = new THREE.Mesh(
      new THREE.SphereGeometry(headRadius * 0.17, 10, 8),
      makeMat(cfg.coresPorRegiao.pele || '#eab68c')
    );
    ear.scale.set(0.45, 0.95, 0.65);
    ear.position.set(dir * headRadius * 0.96, -headRadius * 0.03, -headRadius * 0.06);
    tagMeshRegion(ear, 'pele', 'skin');
    ear.userData.noOutline = true;
    headGroup.add(ear);

    const eyeGroup = new THREE.Group();
    const eyeX = dir * headRadius * (style === 'anime' ? 0.36 : 0.34);
    const eyeY = style === 'anime' ? -headRadius * 0.02 : headRadius * 0.05;
    eyeGroup.position.set(eyeX, eyeY, zFace);
    eyeGroup.scale.setScalar(eyeScale);

    if (style === 'anime') {
      const sclera = new THREE.Mesh(new THREE.BoxGeometry(headRadius * 0.29, headRadius * 0.31, 0.02), eyeMatWhite);
      sclera.userData = { regionKey: 'detalhes', materialRole: 'eye', skipStyleOverride: true, noOutline: true };
      eyeGroup.add(sclera);

      const iris = new THREE.Mesh(new THREE.BoxGeometry(headRadius * 0.18, headRadius * 0.24, 0.025), irisMat);
      iris.position.set(-dir * 0.008, -0.004, 0.005);
      iris.userData = { regionKey: 'detalhes', materialRole: 'eye', skipStyleOverride: true, noOutline: true };
      eyeGroup.add(iris);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(headRadius * 0.052, 8, 8), pupilMat);
      pupil.position.set(-dir * 0.008, -0.004, 0.015);
      pupil.userData = { regionKey: 'detalhes', materialRole: 'eye', skipStyleOverride: true, noOutline: true };
      eyeGroup.add(pupil);

      const catchLight = new THREE.Mesh(new THREE.SphereGeometry(headRadius * 0.034, 6, 6), eyeMatWhite);
      catchLight.position.set(dir * 0.022, 0.024, 0.022);
      catchLight.userData = { regionKey: 'detalhes', materialRole: 'eye', skipStyleOverride: true, noOutline: true };
      eyeGroup.add(catchLight);

      const lash = new THREE.Mesh(new THREE.BoxGeometry(headRadius * 0.33, 0.022, 0.028), browMat);
      lash.position.set(0, headRadius * 0.15, 0.01);
      lash.rotation.z = dir * (expression === 'batalha' ? -0.18 : 0.06);
      lash.userData = { regionKey: 'cabelo', materialRole: 'eye', skipStyleOverride: true, noOutline: true };
      eyeGroup.add(lash);
    } else if (style === 'cartoon') {
      const sclera = new THREE.Mesh(new THREE.SphereGeometry(headRadius * 0.165, 10, 10), eyeMatWhite);
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
      // Sculpted realistic almond eye + upper eyelid arc + iris + catchlight
      const sclera = new THREE.Mesh(new THREE.SphereGeometry(headRadius * 0.125, 12, 10), eyeMatWhite);
      sclera.scale.set(1.28, 0.78, 0.55);
      sclera.userData = { regionKey: 'detalhes', materialRole: 'eye', skipStyleOverride: true, noOutline: true };
      eyeGroup.add(sclera);

      const iris = new THREE.Mesh(new THREE.SphereGeometry(headRadius * 0.072, 10, 10), irisMat);
      iris.scale.set(1, 1, 0.5);
      iris.position.set(0, 0, headRadius * 0.048);
      iris.userData = { regionKey: 'detalhes', materialRole: 'eye', skipStyleOverride: true, noOutline: true };
      eyeGroup.add(iris);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(headRadius * 0.036, 8, 8), pupilMat);
      pupil.position.set(0, 0, headRadius * 0.068);
      pupil.userData = { regionKey: 'detalhes', materialRole: 'eye', skipStyleOverride: true, noOutline: true };
      eyeGroup.add(pupil);

      const lid = new THREE.Mesh(
        new THREE.TorusGeometry(headRadius * 0.12, 0.009, 6, 12, Math.PI),
        browMat
      );
      lid.position.set(0, headRadius * 0.02, headRadius * 0.05);
      lid.userData = { regionKey: 'cabelo', materialRole: 'eye', skipStyleOverride: true, noOutline: true };
      eyeGroup.add(lid);
    }

    const brow = new THREE.Mesh(
      new THREE.BoxGeometry(headRadius * 0.28, style === 'cartoon' ? 0.03 : 0.02, 0.026),
      browMat
    );
    const baseTilt =
      expression === 'batalha' ? -0.34 : expression === 'serio' ? -0.18 : expression === 'feliz' ? 0.12 : -0.04;
    brow.position.set(eyeX, headRadius * (style === 'cartoon' ? 0.30 : 0.24), zFace + 0.016);
    brow.rotation.z = dir * (baseTilt + browOffset);
    brow.userData = { regionKey: 'cabelo', materialRole: 'eye', skipStyleOverride: true, noOutline: true };
    headGroup.add(brow);
    headGroup.add(eyeGroup);
  }

  // Sculpted Nose (bridge + tip)
  if (style !== 'anime') {
    const noseBridge = new THREE.Mesh(
      new THREE.CylinderGeometry(headRadius * 0.045 * noseScale, headRadius * 0.072 * noseScale, headRadius * 0.22 * noseScale, 8),
      makeMat(cfg.coresPorRegiao.pele || '#eab68c')
    );
    noseBridge.rotation.x = -0.22;
    noseBridge.position.set(0, -headRadius * 0.08, zFace + 0.022);
    tagMeshRegion(noseBridge, 'pele', 'skin');
    noseBridge.userData.noOutline = true;
    headGroup.add(noseBridge);

    const noseTip = new THREE.Mesh(
      new THREE.SphereGeometry(headRadius * 0.08 * noseScale, 10, 8),
      makeMat(cfg.coresPorRegiao.pele || '#eab68c')
    );
    noseTip.scale.set(1.15, 0.85, 0.9);
    noseTip.position.set(0, -headRadius * 0.17, zFace + 0.055);
    tagMeshRegion(noseTip, 'pele', 'skin');
    noseTip.userData.noOutline = true;
    headGroup.add(noseTip);
  }

  // Contoured Mouth & Lips
  const lipColor = expression === 'batalha' ? 0x7f1d1d : expression === 'feliz' ? 0xe17070 : 0xb45353;
  const mouthMat = new THREE.MeshStandardMaterial({ color: lipColor, roughness: 0.45, metalness: 0.05 });
  if (expression === 'batalha') {
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(headRadius * 0.34 * mouthScale, headRadius * 0.17, 0.03), mouthMat);
    mouth.position.set(0, -headRadius * 0.42, zFace + 0.01);
    mouth.userData = { regionKey: 'detalhes', materialRole: 'eye', skipStyleOverride: true, noOutline: true };
    headGroup.add(mouth);
  } else if (expression === 'feliz' || expression === 'confiante') {
    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(headRadius * (expression === 'feliz' ? 0.17 : 0.13) * mouthScale, 0.017, 8, 14, Math.PI),
      mouthMat
    );
    smile.rotation.z = Math.PI;
    smile.position.set(0, -headRadius * 0.37, zFace + 0.016);
    smile.userData = { regionKey: 'detalhes', materialRole: 'eye', skipStyleOverride: true, noOutline: true };
    headGroup.add(smile);
  } else {
    const lips = new THREE.Mesh(new THREE.BoxGeometry(headRadius * 0.26 * mouthScale, 0.025, 0.025), mouthMat);
    lips.position.set(0, -headRadius * 0.41, zFace + 0.016);
    lips.userData = { regionKey: 'detalhes', materialRole: 'eye', skipStyleOverride: true, noOutline: true };
    headGroup.add(lips);
  }

  // Facial hair (beard / stubble / goatee / mustache)
  const barba = cfg.barba || 'nenhuma';
  if (barba !== 'nenhuma') {
    const beardMat = makeMat(hairColorHex);
    const beardGrp = new THREE.Group();

    if (barba === 'bigode' || barba === 'cavanhaque' || barba === 'barba_curta' || barba === 'barba_cheia') {
      const stache = new THREE.Mesh(
        new THREE.BoxGeometry(headRadius * 0.38, 0.026, 0.045),
        beardMat
      );
      stache.position.set(0, -headRadius * 0.31, zFace + 0.02);
      beardGrp.add(stache);
    }

    if (barba === 'cavanhaque' || barba === 'barba_curta' || barba === 'barba_cheia') {
      const chin = new THREE.Mesh(
        new THREE.SphereGeometry(headRadius * (barba === 'barba_cheia' ? 0.42 : 0.25), 10, 8),
        beardMat
      );
      chin.scale.set(barba === 'barba_cheia' ? 1.45 : 0.9, barba === 'barba_cheia' ? 1.2 : 0.85, 0.72);
      chin.position.set(0, -headRadius * (barba === 'barba_cheia' ? 0.62 : 0.56), headRadius * 0.42);
      beardGrp.add(chin);
    }

    if (barba === 'barba_curta' || barba === 'barba_por_fazer' || barba === 'barba_cheia') {
      const jawWrap = new THREE.Mesh(
        new THREE.CylinderGeometry(
          headRadius * 0.88,
          headRadius * 0.72,
          headRadius * (barba === 'barba_cheia' ? 0.72 : 0.46),
          14,
          1,
          false,
          -Math.PI * 0.45,
          Math.PI * 0.9
        ),
        beardMat
      );
      jawWrap.position.set(0, -headRadius * 0.45, headRadius * 0.05);
      if (barba === 'barba_por_fazer') jawWrap.scale.set(0.99, 0.8, 0.99);
      beardGrp.add(jawWrap);
    }

    beardGrp.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh) {
        tagMeshRegion(m, 'cabelo', 'hair');
        m.userData.noOutline = true;
      }
    });
    headGroup.add(beardGrp);
  }
}

function buildHair(
  headGroup: THREE.Group,
  cfg: CharacterConfig,
  headRadius: number,
  segs: number
): void {
  const cabelo = cfg.cabelo || 'curto_espetado';
  const style = cfg.estiloVisual || 'stylized3d';
  const hairHex = cfg.coresPorRegiao.cabelo || '#292524';
  const mechaHex = cfg.coresPorRegiao.mecha || '#f472b6';
  const armaduraHex = cfg.coresPorRegiao.armadura || '#d97706';

  const hairGroup = new THREE.Group();
  const hairMat = makeMat(hairHex);
  const mechaMat = makeMat(mechaHex);
  const armorMat = makeMat(armaduraHex);

  if (cabelo === 'careca') {
    if (cfg.mechaAtiva) {
      const browBand = new THREE.Mesh(new THREE.TorusGeometry(headRadius * 1.01, 0.02, 6, segs), mechaMat);
      browBand.rotation.x = Math.PI / 2;
      browBand.position.y = headRadius * 0.42;
      tagMeshRegion(browBand, 'mecha', 'fabric');
      hairGroup.add(browBand);
    }
    headGroup.add(hairGroup);
    return;
  }

  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(headRadius * 1.06, segs, segs, 0, Math.PI * 2, 0, Math.PI * 0.56),
    hairMat
  );
  cap.position.y = headRadius * 0.06;
  hairGroup.add(cap);

  if (cabelo === 'curto_espetado') {
    const spikeCount = style === 'anime' ? 11 : 7;
    for (let i = 0; i < spikeCount; i++) {
      const angle = (i / spikeCount) * Math.PI * 2;
      const len = style === 'anime' ? headRadius * 0.85 : headRadius * 0.54;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(headRadius * 0.21, len, 5), hairMat);
      spike.position.set(
        Math.cos(angle) * headRadius * 0.6,
        headRadius * 0.7 + (i % 2) * 0.03,
        Math.sin(angle) * headRadius * 0.6
      );
      spike.rotation.z = -Math.cos(angle) * 0.65;
      spike.rotation.x = Math.sin(angle) * 0.65;
      hairGroup.add(spike);
    }
  } else if (cabelo === 'curto_ondulado' || cabelo === 'curto_cacheado') {
    const waveCount = cabelo === 'curto_cacheado' ? 16 : 10;
    for (let i = 0; i < waveCount; i++) {
      const a = (i / waveCount) * Math.PI * 2;
      const r = cabelo === 'curto_cacheado' ? headRadius * 0.22 : headRadius * 0.26;
      const tuft = new THREE.Mesh(new THREE.SphereGeometry(r, 9, 8), hairMat);
      tuft.scale.set(1.1, cabelo === 'curto_cacheado' ? 1.0 : 0.72, 1.05);
      tuft.position.set(
        Math.cos(a) * headRadius * 0.72,
        headRadius * (0.48 + (i % 3) * 0.12),
        Math.sin(a) * headRadius * 0.68
      );
      hairGroup.add(tuft);
    }
    const frontWave = new THREE.Mesh(
      new THREE.TorusGeometry(headRadius * 0.32, headRadius * 0.12, 8, 12, Math.PI),
      hairMat
    );
    frontWave.position.set(-headRadius * 0.05, headRadius * 0.52, headRadius * 0.86);
    frontWave.rotation.z = 0.28;
    hairGroup.add(frontWave);
  } else if (cabelo === 'bob_mecha') {
    // Stylized shoulder/chin-length asymmetrical bob (matches Image 2!)
    const backBob = new THREE.Mesh(
      new THREE.CylinderGeometry(headRadius * 1.05, headRadius * 1.18, headRadius * 1.48, segs, 1, false, Math.PI * 0.35, Math.PI * 1.3),
      hairMat
    );
    backBob.position.set(0, -headRadius * 0.26, -headRadius * 0.12);
    hairGroup.add(backBob);

    for (const dir of [-1, 1] as const) {
      const sidePanel = new THREE.Mesh(
        new THREE.BoxGeometry(headRadius * 0.32, headRadius * 1.38, headRadius * 0.78),
        hairMat
      );
      sidePanel.position.set(dir * headRadius * 0.92, -headRadius * 0.22, headRadius * 0.08);
      sidePanel.rotation.z = dir * 0.08;
      hairGroup.add(sidePanel);
    }

    // Contrasting front highlight strand ("mecha")
    const mechaMatToUse = cfg.mechaAtiva === false ? hairMat : mechaMat;
    const mechaRegion: 'mecha' | 'cabelo' = cfg.mechaAtiva === false ? 'cabelo' : 'mecha';
    const bangSweep = new THREE.Mesh(
      new THREE.ConeGeometry(headRadius * 0.24, headRadius * 1.28, 7),
      mechaMatToUse
    );
    bangSweep.position.set(-headRadius * 0.44, headRadius * 0.04, headRadius * 0.82);
    bangSweep.rotation.x = Math.PI - 0.12;
    bangSweep.rotation.z = -0.32;
    tagMeshRegion(bangSweep, mechaRegion, 'hair');
    hairGroup.add(bangSweep);
  } else if (cabelo === 'longo_fluido') {
    const backFlow = new THREE.Mesh(
      new THREE.CylinderGeometry(headRadius * 0.95, headRadius * 1.12, headRadius * 2.1, segs),
      hairMat
    );
    backFlow.scale.set(1.0, 1.0, 0.55);
    backFlow.position.set(0, -headRadius * 0.65, -headRadius * 0.55);
    hairGroup.add(backFlow);

    for (const dir of [-1, 1]) {
      const sideLock = new THREE.Mesh(new THREE.ConeGeometry(headRadius * 0.2, headRadius * 1.35, 6), hairMat);
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

  // Optional highlight strand on other hairstyles when explicitly toggled
  if (cfg.mechaAtiva && cabelo !== 'bob_mecha' && cabelo !== 'elmo_aberto') {
    const strand = new THREE.Mesh(new THREE.ConeGeometry(headRadius * 0.16, headRadius * 0.85, 6), mechaMat);
    strand.position.set(-headRadius * 0.45, headRadius * 0.35, headRadius * 0.84);
    strand.rotation.x = Math.PI - 0.18;
    strand.rotation.z = -0.22;
    tagMeshRegion(strand, 'mecha', 'hair');
    hairGroup.add(strand);
  }

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
    slotsArmadura: {
      ...DEFAULT_CHARACTER_CONFIG.slotsArmadura,
      ...(rawConfig.slotsArmadura || {})
    },
    coresPorRegiao: {
      ...DEFAULT_REGION_COLORS,
      ...(rawConfig.coresPorRegiao || {})
    }
  };

  const style = cfg.estiloVisual || 'stylized3d';
  const cores = cfg.coresPorRegiao;
  const segs = lowDetail ? 12 : 22;
  const slotsArmor = cfg.slotsArmadura || {};

  const root = new THREE.Group();
  root.name = `personagem_${style}`;

  const isCartoon = style === 'cartoon';
  const isAnime = style === 'anime';
  const heightMult = clampNum(cfg.alturaEscala, 0.88, 1.14, 1.0);
  const torsoMult = clampNum(cfg.larguraTorso, 0.85, 1.2, 1.0);
  const jawMult = clampNum(cfg.larguraMandibula, 0.82, 1.22, 1.0);

  const headScale = isCartoon ? 1.32 : isAnime ? 1.1 : 0.94;
  const widthFactor =
    (cfg.silhueta === 'guardiao' ? 1.2 : cfg.silhueta === 'agil' ? 0.88 : 1.02) * torsoMult;
  const legHeight = (isCartoon ? 0.56 : isAnime ? 0.72 : 0.68) * heightMult;
  const torsoHeight = (isCartoon ? 0.52 : isAnime ? 0.6 : 0.62) * heightMult;
  const torsoRadiusTop = (isCartoon ? 0.27 : isAnime ? 0.22 : 0.26) * widthFactor;
  const torsoRadiusBot = (isCartoon ? 0.23 : isAnime ? 0.16 : 0.19) * widthFactor;

  // 1. Mythological Pedestal Base
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

  // 2. Pelvis Pivot & Trousers/Pants
  const pelvis = new THREE.Group();
  pelvis.position.y = 0.09 + legHeight;
  root.add(pelvis);

  const pantsColor = cores.calca || '#334155';
  const pantsStyle = cfg.calca || 'calca_reta';
  const waistMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(torsoRadiusBot * 0.98, torsoRadiusBot * 1.05, 0.17, segs),
    makeMat(pantsColor)
  );
  waistMesh.position.y = 0.04;
  tagMeshRegion(waistMesh, 'calca', 'fabric');
  pelvis.add(waistMesh);

  const beltMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(torsoRadiusBot * 1.08, torsoRadiusBot * 1.08, 0.055, segs),
    makeMat(cores.detalhes || '#fbbf24')
  );
  beltMesh.position.y = 0.065;
  tagMeshRegion(beltMesh, 'detalhes', 'metal');
  pelvis.add(beltMesh);

  if (pantsStyle === 'saiote_guerreiro') {
    const kilt = new THREE.Mesh(
      new THREE.CylinderGeometry(torsoRadiusBot * 1.06, torsoRadiusBot * 1.38, 0.28, segs),
      makeMat(pantsColor)
    );
    kilt.position.y = -0.1;
    tagMeshRegion(kilt, 'calca', 'leather');
    pelvis.add(kilt);
  }

  // Legs + Footwear
  const makeLeg = (dir: -1 | 1): THREE.Group => {
    const legPivot = new THREE.Group();
    legPivot.position.set(dir * torsoRadiusBot * 0.56, 0, 0);

    const isTrousers = pantsStyle === 'calca_reta' || pantsStyle === 'calca_tatica' || pantsStyle === 'grevas_armadura';
    const thighRadiusTop = isTrousers ? 0.098 * widthFactor : 0.082 * widthFactor;
    const thighRadiusBot = pantsStyle === 'calca_tatica' ? 0.086 * widthFactor : isTrousers ? 0.078 * widthFactor : 0.068 * widthFactor;

    const thigh = new THREE.Mesh(
      new THREE.CylinderGeometry(thighRadiusTop, thighRadiusBot, legHeight * 0.58, segs),
      makeMat(isTrousers ? pantsColor : (cores.pele || '#eab68c'))
    );
    thigh.position.y = -legHeight * 0.28;
    tagMeshRegion(
      thigh,
      isTrousers ? 'calca' : 'pele',
      pantsStyle === 'grevas_armadura' ? 'metal' : isTrousers ? 'fabric' : 'skin'
    );
    legPivot.add(thigh);

    const shinHeight = legHeight * 0.44;
    const bootColor = cores.calcado || '#5c3a21';
    const isSneakers = cfg.calcado === 'tenis_casuais';
    const greaveRole = cfg.calcado === 'grevas_aladas' ? 'metal' : isSneakers ? 'fabric' : 'leather';

    if (isSneakers || pantsStyle === 'calca_reta' || pantsStyle === 'calca_tatica') {
      const lowerPant = new THREE.Mesh(
        new THREE.CylinderGeometry(thighRadiusBot * 0.96, 0.068 * widthFactor, shinHeight * 0.72, segs),
        makeMat(pantsColor)
      );
      lowerPant.position.y = -legHeight * 0.7;
      tagMeshRegion(lowerPant, 'calca', 'fabric');
      legPivot.add(lowerPant);
    }

    const shin = new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.075 * widthFactor,
        cfg.calcado === 'botas_couro' ? 0.088 : 0.068,
        isSneakers ? shinHeight * 0.28 : shinHeight,
        segs
      ),
      makeMat(bootColor)
    );
    shin.position.y = isSneakers ? -legHeight * 0.88 : -legHeight * 0.76;
    tagMeshRegion(shin, 'calcado', greaveRole);
    legPivot.add(shin);

    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(
        isCartoon ? 0.16 : 0.13,
        isSneakers ? 0.08 : isCartoon ? 0.11 : 0.09,
        isCartoon ? 0.24 : 0.22
      ),
      makeMat(bootColor)
    );
    foot.position.set(0, -legHeight + 0.045, 0.045);
    tagMeshRegion(foot, 'calcado', greaveRole);
    legPivot.add(foot);

    if (isSneakers) {
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.136, 0.025, 0.226), makeMat('#f8fafc'));
      sole.position.set(0, -legHeight + 0.015, 0.045);
      tagMeshRegion(sole, 'detalhes', 'fabric');
      legPivot.add(sole);
    } else if (cfg.calcado === 'grevas_aladas') {
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
  } else if (cfg.roupa === 'camiseta_casual') {
    const crewCollar = new THREE.Mesh(
      new THREE.TorusGeometry(torsoRadiusTop * 0.45, 0.025, 8, segs),
      makeMat(cores.barriga || '#f3e8d2')
    );
    crewCollar.rotation.x = Math.PI / 2;
    crewCollar.position.y = torsoHeight + 0.01;
    tagMeshRegion(crewCollar, 'barriga', 'fabric');
    torso.add(crewCollar);
  } else if (cfg.roupa === 'jaqueta_moderna') {
    const jacketZip = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, torsoHeight * 0.94, torsoRadiusTop * 0.28),
      makeMat(cores.detalhes || '#fbbf24')
    );
    jacketZip.position.set(0, torsoHeight * 0.5, torsoRadiusTop * 0.86);
    tagMeshRegion(jacketZip, 'detalhes', 'metal');
    torso.add(jacketZip);
  }

  // Modular Armor Breastplate & Shoulder Pauldrons
  if (cfg.armadura !== 'sem_armadura') {
    const breastplate = new THREE.Mesh(
      new THREE.CylinderGeometry(torsoRadiusTop * 1.06, torsoRadiusBot * 1.04, torsoHeight * 0.72, segs),
      makeMat(cores.peitoral || '#b45309')
    );
    breastplate.position.y = torsoHeight * 0.56;
    tagMeshRegion(breastplate, 'peitoral', 'metal');
    torso.add(breastplate);

    if (slotsArmor.pauldrons !== false) {
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
  }

  // Neck Jewelry / Choker Slot
  const colar = cfg.colar && cfg.colar !== 'nenhum' ? cfg.colar : slotsArmor.choker ? 'gargantilha' : 'nenhum';
  if (colar !== 'nenhum') {
    const chokerColor = colar === 'gargantilha' ? '#e2e8f0' : (cores.acessorios || '#d97706');
    const choker = new THREE.Mesh(
      new THREE.TorusGeometry(torsoRadiusTop * 0.48, colar === 'cachecol' ? 0.055 : 0.022, 8, segs),
      makeMat(chokerColor)
    );
    choker.rotation.x = Math.PI / 2;
    choker.position.y = torsoHeight + 0.04;
    tagMeshRegion(choker, 'acessorios', colar === 'cachecol' ? 'fabric' : 'metal');
    torso.add(choker);

    if (colar === 'medalhao') {
      const pendant = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), makeMat(cores.detalhes || '#fbbf24'));
      pendant.position.set(0, torsoHeight * 0.82, torsoRadiusTop * 0.94);
      tagMeshRegion(pendant, 'detalhes', 'metal');
      torso.add(pendant);
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

  // 4. Arms + Sleeves + Bracers
  const armLength = torsoHeight * 0.82;
  const hasShortSleeves = cfg.roupa === 'camiseta_casual';
  const hasLongSleeves = cfg.roupa === 'jaqueta_moderna' || cfg.roupa === 'kimono_lendario';

  const makeArm = (dir: -1 | 1): THREE.Group => {
    const armPivot = new THREE.Group();
    armPivot.position.set(dir * (torsoRadiusTop + 0.075), torsoHeight * 0.82, 0);

    if (hasShortSleeves || hasLongSleeves) {
      const sleeveLen = hasLongSleeves ? armLength * 0.86 : armLength * 0.34;
      const sleeve = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.068, sleeveLen, 10),
        makeMat(cores.roupa || '#1d4ed8')
      );
      sleeve.position.y = -sleeveLen * 0.5;
      tagMeshRegion(sleeve, 'roupa', 'fabric');
      armPivot.add(sleeve);
    }

    const upperArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.066, 0.056, armLength * 0.55, 10),
      makeMat(cores.pele || '#eab68c')
    );
    upperArm.position.y = -armLength * 0.27;
    tagMeshRegion(upperArm, 'pele', 'skin');
    armPivot.add(upperArm);

    const showBracers = cfg.armadura !== 'sem_armadura' && slotsArmor.bracers !== false;
    const forearm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.054, armLength * 0.42, 10),
      makeMat(showBracers ? (cores.armadura || '#d97706') : (cores.pele || '#eab68c'))
    );
    forearm.position.y = -armLength * 0.7;
    tagMeshRegion(forearm, showBracers ? 'armadura' : 'pele', showBracers ? 'metal' : 'skin');
    armPivot.add(forearm);

    const hand = new THREE.Mesh(
      new THREE.SphereGeometry(isCartoon ? 0.076 : 0.058, 10, 8),
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

  // 5. Head Pivot + Neck + Face Shape + Hair + Crown
  const neckMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.068, 0.078, 0.12, segs),
    makeMat(cores.pele || '#eab68c')
  );
  neckMesh.position.y = torsoHeight + 0.04;
  tagMeshRegion(neckMesh, 'pele', 'skin');
  torso.add(neckMesh);

  const headRadius = 0.21 * headScale;
  const head = new THREE.Group();
  head.position.set(0, torsoHeight + 0.06 + headRadius * 0.92, 0);
  torso.add(head);

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(headRadius, segs, segs), makeMat(cores.pele || '#eab68c'));
  const rosto = cfg.rosto || 'oval';
  let hx = 1.0 * jawMult;
  let hy = 1.04;
  let hz = 0.96;
  if (rosto === 'quadrado') {
    hx *= 1.08;
    hy = 0.98;
  } else if (rosto === 'angular') {
    hx *= 0.92;
    hy = 1.08;
  } else if (rosto === 'suave') {
    hx *= 0.95;
    hy = 1.02;
  } else if (rosto === 'redondo') {
    hx *= 1.08;
    hy = 0.96;
    hz = 1.02;
  }
  if (isAnime) {
    hx *= 0.95;
    hy *= 1.02;
  } else if (isCartoon) {
    hx *= 1.05;
  }
  headMesh.scale.set(hx, hy, hz);
  tagMeshRegion(headMesh, 'pele', 'skin');
  head.add(headMesh);

  buildFaceFeatures(head, cfg, headRadius, cores.cabelo || '#292524');
  buildHair(head, cfg, headRadius, segs);

  if (cfg.acessorio === 'coroa_louros' || slotsArmor.crown) {
    const laurel = new THREE.Mesh(
      new THREE.TorusGeometry(headRadius * 1.05, 0.03, 6, segs),
      makeMat(cores.acessorios || '#fbbf24')
    );
    laurel.rotation.x = Math.PI / 2 - 0.18;
    laurel.position.y = headRadius * 0.42;
    tagMeshRegion(laurel, 'armadura', 'metal');
    head.add(laurel);

    if (slotsArmor.crown) {
      const crest = new THREE.Mesh(
        new THREE.ConeGeometry(headRadius * 0.25, headRadius * 0.42, 4),
        makeMat(cores.armadura || '#94a3b8')
      );
      crest.position.set(0, headRadius * 0.65, headRadius * 0.86);
      tagMeshRegion(crest, 'armadura', 'metal');
      head.add(crest);
    }
  }

  // Normalize base height around 1.88 * heightMult
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const targetH = 1.88 * heightMult;
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

  applyVisualStyleAndRegionColors(root, style, cores, lowDetail, {
    roupa: cfg.padraoRoupa || 'solid',
    calca: cfg.padraoCalca || 'solid'
  });
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

  if (!rig) {
    if (mode === 'caminhar') {
      root.position.y = Math.abs(Math.sin(elapsedSec * 9.5)) * 0.14;
      root.rotation.z = Math.sin(elapsedSec * 9.5) * 0.06;
    } else if (mode === 'comemorar' || mode === 'vitoria') {
      root.position.y = Math.abs(Math.sin(elapsedSec * 7.8)) * 0.32;
      root.rotation.z = Math.sin(elapsedSec * 4.5) * 0.05;
    } else if (mode === 'surpresa') {
      root.position.y = Math.abs(Math.sin(elapsedSec * 12)) * 0.22;
      root.rotation.z = Math.sin(elapsedSec * 14) * 0.09;
    } else if (mode === 'frustracao' || mode === 'derrota') {
      root.position.y = mode === 'derrota' ? -0.14 : Math.sin(elapsedSec * 6) * 0.02;
      root.rotation.z = Math.sin(elapsedSec * 5) * 0.08;
    } else {
      root.position.y = Math.sin(elapsedSec * 2.2) * 0.03;
      root.rotation.z = 0;
    }
    return;
  }

  const baseY = rig.baseY || 0.7;

  if (mode === 'caminhar') {
    const freq = 9.2 * strideScale;
    const swing = Math.sin(elapsedSec * freq);
    const bounce = Math.abs(Math.cos(elapsedSec * freq));

    if (rig.pelvis) {
      rig.pelvis.position.y = baseY + bounce * 0.065;
      rig.pelvis.rotation.z = swing * 0.04;
      rig.pelvis.rotation.x = 0;
    }
    if (rig.torso) {
      rig.torso.rotation.y = -swing * 0.14;
      rig.torso.rotation.x = 0.08;
    }
    if (rig.leftLeg) rig.leftLeg.rotation.x = swing * 0.62;
    if (rig.rightLeg) rig.rightLeg.rotation.x = -swing * 0.62;
    if (rig.leftArm) {
      rig.leftArm.rotation.x = -swing * 0.56;
      rig.leftArm.rotation.z = 0;
    }
    if (rig.rightArm) {
      rig.rightArm.rotation.x = swing * 0.56;
      rig.rightArm.rotation.z = 0;
    }
    if (rig.head) {
      rig.head.rotation.y = swing * 0.05;
      rig.head.rotation.x = -0.04;
    }
    if (rig.cape) rig.cape.rotation.x = 0.25 + bounce * 0.18;
    if (rig.leftWing) rig.leftWing.rotation.y = 0.2 + Math.sin(elapsedSec * 10) * 0.18;
    if (rig.rightWing) rig.rightWing.rotation.y = -0.2 - Math.sin(elapsedSec * 10) * 0.18;
    if (rig.wheelPivots && rig.wheelPivots.length > 0) {
      for (const w of rig.wheelPivots) {
        w.rotation.x = elapsedSec * 12 * strideScale;
      }
      if (rig.pelvis) {
        rig.pelvis.position.y = baseY + Math.abs(Math.sin(elapsedSec * 18)) * 0.018;
        rig.pelvis.rotation.z = Math.sin(elapsedSec * 7) * 0.015;
      }
    }
    root.position.y = 0;
    return;
  }

  if (mode === 'comemorar' || mode === 'vitoria') {
    const isVictory = mode === 'vitoria';
    const hop = Math.abs(Math.sin(elapsedSec * (isVictory ? 7.4 : 6.8)));
    if (rig.pelvis) {
      rig.pelvis.position.y = baseY + hop * (isVictory ? 0.22 : 0.16);
      rig.pelvis.rotation.z = 0;
      rig.pelvis.rotation.x = 0;
    }
    if (rig.torso) {
      rig.torso.rotation.y = Math.sin(elapsedSec * 3.8) * (isVictory ? 0.26 : 0.18);
      rig.torso.rotation.x = -0.08;
    }
    if (rig.leftLeg) rig.leftLeg.rotation.x = -hop * 0.28;
    if (rig.rightLeg) rig.rightLeg.rotation.x = hop * 0.2;
    if (rig.leftArm) {
      rig.leftArm.rotation.x = -2.45 + Math.sin(elapsedSec * 8) * 0.22;
      rig.leftArm.rotation.z = -0.24;
    }
    if (rig.rightArm) {
      rig.rightArm.rotation.x = -2.6 - Math.sin(elapsedSec * 8) * 0.22;
      rig.rightArm.rotation.z = 0.24;
    }
    if (rig.head) {
      rig.head.rotation.x = -0.14;
      rig.head.rotation.y = Math.sin(elapsedSec * 2.8) * 0.12;
    }
    if (rig.leftWing) rig.leftWing.rotation.y = 0.42 + Math.sin(elapsedSec * 9) * 0.3;
    if (rig.rightWing) rig.rightWing.rotation.y = -0.42 - Math.sin(elapsedSec * 9) * 0.3;
    return;
  }

  if (mode === 'surpresa') {
    const jolt = Math.abs(Math.sin(elapsedSec * 10));
    if (rig.pelvis) {
      rig.pelvis.position.y = baseY + jolt * 0.14;
      rig.pelvis.rotation.z = 0;
      rig.pelvis.rotation.x = -0.08;
    }
    if (rig.torso) {
      rig.torso.rotation.x = -0.16;
      rig.torso.rotation.y = Math.sin(elapsedSec * 9) * 0.1;
    }
    if (rig.leftLeg) rig.leftLeg.rotation.x = -0.22;
    if (rig.rightLeg) rig.rightLeg.rotation.x = -0.22;
    if (rig.leftArm) {
      rig.leftArm.rotation.x = -1.75 + Math.sin(elapsedSec * 11) * 0.18;
      rig.leftArm.rotation.z = -0.55;
    }
    if (rig.rightArm) {
      rig.rightArm.rotation.x = -1.75 - Math.sin(elapsedSec * 11) * 0.18;
      rig.rightArm.rotation.z = 0.55;
    }
    if (rig.head) {
      rig.head.rotation.x = -0.22;
      rig.head.rotation.y = Math.sin(elapsedSec * 12) * 0.16;
    }
    return;
  }

  if (mode === 'frustracao' || mode === 'derrota') {
    const isDefeat = mode === 'derrota';
    const slump = isDefeat ? 0.35 : 0.14;
    const shake = Math.sin(elapsedSec * (isDefeat ? 3.2 : 8.2));
    if (rig.pelvis) {
      rig.pelvis.position.y = baseY - (isDefeat ? 0.16 : 0.04);
      rig.pelvis.rotation.z = 0;
      rig.pelvis.rotation.x = slump * 0.4;
    }
    if (rig.torso) {
      rig.torso.rotation.x = slump;
      rig.torso.rotation.y = shake * 0.08;
    }
    if (rig.leftLeg) rig.leftLeg.rotation.x = isDefeat ? -0.35 : 0.06;
    if (rig.rightLeg) rig.rightLeg.rotation.x = isDefeat ? -0.35 : -0.06;
    if (rig.leftArm) {
      rig.leftArm.rotation.x = isDefeat ? 0.25 : -0.2 + shake * 0.12;
      rig.leftArm.rotation.z = -0.12;
    }
    if (rig.rightArm) {
      rig.rightArm.rotation.x = isDefeat ? 0.25 : -0.2 - shake * 0.12;
      rig.rightArm.rotation.z = 0.12;
    }
    if (rig.head) {
      rig.head.rotation.x = isDefeat ? 0.42 : 0.22;
      rig.head.rotation.y = shake * (isDefeat ? 0.12 : 0.28);
    }
    return;
  }

  const breath = Math.sin(elapsedSec * 2.2);
  if (rig.pelvis) {
    rig.pelvis.position.y = baseY + breath * 0.015;
    rig.pelvis.rotation.z = 0;
    rig.pelvis.rotation.x = 0;
  }
  if (rig.torso) {
    rig.torso.rotation.y = Math.sin(elapsedSec * 1.1) * 0.04;
    rig.torso.rotation.x = breath * 0.02;
  }
  if (rig.leftLeg) rig.leftLeg.rotation.x = 0;
  if (rig.rightLeg) rig.rightLeg.rotation.x = 0;
  if (rig.leftArm) {
    rig.leftArm.rotation.x = breath * 0.05;
    rig.leftArm.rotation.z = 0;
  }
  if (rig.rightArm) {
    rig.rightArm.rotation.x = -breath * 0.05;
    rig.rightArm.rotation.z = 0;
  }
  if (rig.head) {
    rig.head.rotation.y = Math.sin(elapsedSec * 0.9) * 0.08;
    rig.head.rotation.x = breath * 0.03;
  }
  if (rig.cape) rig.cape.rotation.x = 0.08 + breath * 0.04;
  if (rig.leftWing) rig.leftWing.rotation.y = 0.12 + breath * 0.1;
  if (rig.rightWing) rig.rightWing.rotation.y = -0.12 - breath * 0.1;
  if (rig.wheelPivots && rig.wheelPivots.length > 0) {
    for (const w of rig.wheelPivots) {
      w.rotation.x = 0;
    }
  }
}

export interface PhotoPaletteSuggestion {
  pele: string;
  cabelo: string;
  mecha: string;
  roupa: string;
  calca: string;
  armadura: string;
  calcado: string;
  acessorios: string;
  humorSugestao: 'confiante' | 'serio' | 'feliz';
  hairHint: HairStyleId;
  facialHairHint: FacialHairId;
  outfitHint: OutfitStyleId;
  topPatternHint: ClothingPatternId;
  pantsPatternHint: ClothingPatternId;
  visibleParts: {
    hair: boolean;
    face: boolean;
    beard: boolean;
    torso: boolean;
    legs: boolean;
    shoes: boolean;
  };
  confidence: 'baixa' | 'media' | 'alta';
  source: 'local-heuristic';
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
 * Analisa localmente a foto por bandas (cabelo, rosto, torso, pernas, calçado)
 * para preencher atributos iniciais caso o endpoint multimodal Gemini não esteja disponível.
 * Jamais cola a imagem no peito do modelo 3D.
 */
export async function analyzePhotoReferencePalette(
  photoDataUrl: string
): Promise<PhotoPaletteSuggestion> {
  const fallback: PhotoPaletteSuggestion = {
    pele: '#eab68c',
    cabelo: '#292524',
    mecha: '#f472b6',
    roupa: '#1d4ed8',
    calca: '#334155',
    armadura: '#d97706',
    calcado: '#78350f',
    acessorios: '#38bdf8',
    humorSugestao: 'confiante',
    hairHint: 'curto_ondulado',
    facialHairHint: 'nenhuma',
    outfitHint: 'camiseta_casual',
    topPatternHint: 'solid',
    pantsPatternHint: 'solid',
    visibleParts: {
      hair: true,
      face: true,
      beard: false,
      torso: true,
      legs: false,
      shoes: false
    },
    confidence: 'baixa',
    source: 'local-heuristic'
  };
  if (typeof document === 'undefined' || !photoDataUrl) return fallback;

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Falha ao ler imagem de referência.'));
      i.src = photoDataUrl;
    });

    const size = 32;
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
      let variance = 0;
      const lums: number[] = [];
      for (let y = yStart; y < yEnd; y++) {
        for (let x = xStart; x < xEnd; x++) {
          const idx = (y * size + x) * 4;
          if (data[idx + 3] < 40) continue;
          const pr = data[idx];
          const pg = data[idx + 1];
          const pb = data[idx + 2];
          r += pr;
          g += pg;
          b += pb;
          lums.push(0.299 * pr + 0.587 * pg + 0.114 * pb);
          count++;
        }
      }
      if (!count) return null;
      const meanLum = lums.reduce((a, c) => a + c, 0) / count;
      variance = lums.reduce((a, c) => a + (c - meanLum) ** 2, 0) / count;
      return {
        r: r / count,
        g: g / count,
        b: b / count,
        luma: meanLum,
        variance,
        hex: rgbToHex(r / count, g / count, b / count)
      };
    };

    const hairSample = avgBand(1, 8, 8, 24);
    const skinSample = avgBand(8, 14, 10, 22);
    const outfitSample = avgBand(15, 22, 8, 24);
    const legsSample = avgBand(22, 28, 9, 23);
    const shoeSample = avgBand(28, 32, 9, 23);
    const sideAccent = avgBand(10, 20, 2, 7) || avgBand(10, 20, 25, 30);

    const hasDistinctLegs =
      Boolean(legsSample && outfitSample) &&
      Math.abs((legsSample?.luma || 0) - (outfitSample?.luma || 0)) > 12;
    const isClosePortrait = !hasDistinctLegs && (skinSample?.variance || 0) < 900;

    const humorSugestao: 'confiante' | 'serio' | 'feliz' =
      (outfitSample?.luma || 128) > 155 ? 'feliz' : (outfitSample?.luma || 128) < 85 ? 'serio' : 'confiante';

    return {
      pele: skinSample?.hex || fallback.pele,
      cabelo: hairSample?.hex || fallback.cabelo,
      mecha: sideAccent?.hex || fallback.mecha,
      roupa: outfitSample?.hex || fallback.roupa,
      calca: legsSample?.hex || fallback.calca,
      armadura: sideAccent?.hex || fallback.armadura,
      calcado: shoeSample?.hex || fallback.calcado,
      acessorios: sideAccent
        ? rgbToHex(
            Math.min(255, sideAccent.r * 1.15),
            Math.min(255, sideAccent.g * 1.15),
            Math.min(255, sideAccent.b * 1.15)
          )
        : fallback.acessorios,
      humorSugestao,
      hairHint: isClosePortrait ? 'curto_cacheado' : 'curto_ondulado',
      facialHairHint: 'nenhuma',
      outfitHint: 'camiseta_casual',
      topPatternHint: (outfitSample?.variance || 0) > 650 ? 'striped' : 'solid',
      pantsPatternHint: (legsSample?.variance || 0) > 480 ? 'plaid' : 'solid',
      visibleParts: {
        hair: true,
        face: true,
        beard: false,
        torso: !isClosePortrait,
        legs: hasDistinctLegs,
        shoes: hasDistinctLegs && Boolean(shoeSample)
      },
      confidence: hasDistinctLegs ? 'media' : 'baixa',
      source: 'local-heuristic'
    };
  } catch {
    return fallback;
  }
}

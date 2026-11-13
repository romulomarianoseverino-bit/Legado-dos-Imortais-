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
  out = new THREE.Vector3()
): THREE.Vector3 {
  const safeTile = ((Math.floor(tileIndex) % 12) + 12) % 12;
  const pct = TILE_PCT_COORDS[safeTile] || TILE_PCT_COORDS[0];
  const offsetIdx = Math.max(0, Math.min(3, (playerId || 1) - 1));
  const [ox, oz] = PLAYER_TILE_OFFSETS[offsetIdx];

  const x = (pct.left / 100 - 0.5) * BOARD_WORLD_SPAN + ox;
  const z = (pct.top / 100 - 0.5) * BOARD_WORLD_SPAN + oz;
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
  celebrateUntil: number;
  walkUntil: number;
  falido: boolean;
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
  syncPlayers: (players: BoardPlayerDescriptor[]) => Promise<void>;
  stepPlayer: (playerId: number, fromTile: number, toTile: number) => void;
  teleportPlayer: (playerId: number, tile: number) => void;
  celebrateArrival: (playerId: number, durationMs?: number) => void;
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

  // Tabletop perspective overview camera aligned with CSS .board-3d grid
  // Câmera fixa: acompanhar o peão com a câmera fazia o tabuleiro parecer
  // deslizar sob o personagem, enfraquecendo a sensação de caminhar sobre as casas.
  const baseCamPos = new THREE.Vector3(0, 9.4, 4.65);
  const baseLookAt = new THREE.Vector3(0, 0.2, 0.15);

  const camera = new THREE.PerspectiveCamera(42, w / h, 0.5, 45);
  camera.position.copy(baseCamPos);
  camera.lookAt(baseLookAt);

  const actors = new Map<number, ActorState>();
  let activeWalkerId: number | null = null;
  let disposed = false;
  let contextLost = false;
  let rafId = 0;
  let prevNow = performance.now();
  const startClock = prevNow;
  let lastSoftDraw = 0;

  const resize = () => {
    if (disposed || contextLost) return;
    const nw = Math.max(boardEl.clientWidth || 400, 260);
    const nh = Math.max(boardEl.clientHeight || 400, 260);
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

    let someoneWalking = false;

    for (const actor of actors.values()) {
      actor.pivot.visible = !actor.falido;
      if (actor.falido) continue;

      // Position interpolation
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
        someoneWalking = true;

      } else if (now < actor.celebrateUntil) {
        mode = 'comemorar';
      }

      actor.animMode = mode;
      updateCharacterRigAnimation(actor.model, elapsedSec + actor.playerId * 0.4, mode, 1.0);
    }

    if (!someoneWalking) activeWalkerId = null;

    // Mantém o enquadramento estável durante o percurso; somente o peão se move.
    camera.position.copy(baseCamPos);
    camera.lookAt(baseLookAt);
    renderer.render(scene, camera);
  };
  rafId = requestAnimationFrame(tick);

  return {
    async syncPlayers(players: BoardPlayerDescriptor[]): Promise<void> {
      if (disposed) return;
      const incomingIds = new Set(players.map((p) => p.id));

      for (const [id, existing] of actors.entries()) {
        if (!incomingIds.has(id)) {
          scene.remove(existing.pivot);
          disposeSceneObject(existing.pivot);
          actors.delete(id);
        }
      }

      for (const p of players) {
        const sig = buildSignature(p);
        const existing = actors.get(p.id);
        const dest = computeTileWorldPosition(p.pos, p.id);

        if (existing && existing.signature === sig) {
          existing.falido = !!p.falido;
          existing.targetPos.copy(dest);
          continue;
        }

        if (existing) {
          scene.remove(existing.pivot);
          disposeSceneObject(existing.pivot);
          actors.delete(p.id);
        }

        const model = await buildActorModelForPlayer(p, currentLowDetail);
        if (disposed) {
          disposeSceneObject(model);
          return;
        }
        // Scale piece cleanly for compact tabletop clarity
        model.scale.multiplyScalar(0.56);

        const pivot = new THREE.Group();
        pivot.name = `board_actor_p${p.id}`;
        pivot.position.copy(dest);
        pivot.visible = !p.falido;
        pivot.add(model);
        scene.add(pivot);

        // Face forward clockwise direction at initial tile
        const nextTilePos = computeTileWorldPosition((p.pos + 1) % 12, p.id);
        const initYaw = computeFacingYaw(dest, nextTilePos);
        pivot.rotation.y = initYaw;

        actors.set(p.id, {
          playerId: p.id,
          signature: sig,
          pivot,
          model,
          currentPos: dest.clone(),
          targetPos: dest.clone(),
          currentYaw: initYaw,
          targetYaw: initYaw,
          animMode: 'idle',
          celebrateUntil: 0,
          walkUntil: 0,
          falido: !!p.falido
        });
      }
    },

    stepPlayer(playerId: number, fromTile: number, toTile: number) {
      const actor = actors.get(playerId);
      if (!actor) return;
      const startVec = computeTileWorldPosition(fromTile, playerId);
      const destVec = computeTileWorldPosition(toTile, playerId);
      actor.targetYaw = computeFacingYaw(startVec, destVec);
      actor.targetPos.copy(destVec);
      actor.walkUntil = performance.now() + 340;
      activeWalkerId = playerId;
    },

    teleportPlayer(playerId: number, tile: number) {
      const actor = actors.get(playerId);
      if (!actor) return;
      const dest = computeTileWorldPosition(tile, playerId);
      const next = computeTileWorldPosition((tile + 1) % 12, playerId);
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
      cancelAnimationFrame(rafId);
      ro.disconnect();
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      for (const actor of actors.values()) {
        scene.remove(actor.pivot);
        disposeSceneObject(actor.pivot);
      }
      actors.clear();
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

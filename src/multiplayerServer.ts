import express from 'express';
import http from 'http';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import {
  applyClassStartingBalance,
  applyClassPropertyBuyCost,
  applyClassUpgradeCost,
  applyClassRentBonus,
  applyClassPassStartBonus,
  applyClassBailCost
} from './classes';

export type GodId = 'zeus' | 'poseidon' | 'hades' | 'atena';

export interface OnlinePlayerState {
  id: number; // 1..4
  nome: string;
  deus: { id: GodId; nome: string; icon: string; cor: string; passiva: string };
  classeId: string;
  saldo: number;
  usouDescontoPrimeiraCompra: boolean;
  pos: number;
  preso: boolean;
  turnosPreso: number;
  falido: boolean;
  imunidadeTaxa: boolean;
  isAi: boolean;
  connected: boolean;
  peca3d: any | null;
}

export interface OnlineTileState {
  id: number;
  nome: string;
  descricao?: string;
  tipo: 'inicio' | 'propriedade' | 'bencao' | 'prisao';
  icon: string;
  grupo?: string;
  imagemDataUrl?: string;
  valor: number;
  aluguel: number;
  temploCusto: number;
  temploAluguel: number;
  santuarioCusto: number;
  aluguelNiveis: [number, number, number, number, number];
  dono: number | null;
  nivel: number;
}

export type TurnPhase =
  | 'waiting'
  | 'coin_toss'
  | 'awaiting_roll'
  | 'awaiting_buy'
  | 'awaiting_upgrade'
  | 'awaiting_rent_ack'
  | 'awaiting_oracle_ack'
  | 'finished';

export interface PendingRentDetails {
  casaId: number;
  casaNome: string;
  casaIcon: string;
  grupo: string;
  payerId: number;
  payerNome: string;
  ownerId: number;
  ownerNome: string;
  nivel: number;
  aluguelBase: number;
  possuiConjuntoGrupo: boolean;
  bonusGrupoPct: number;
  bonusClasseValor: number;
  totalTaxa: number;
  pagoEfetivo: number;
}

export interface PendingOracleDetails {
  titulo: string;
  desc: string;
  deltaSaldo: number;
  teleporteCasa: number | null;
  concedeuImunidade: boolean;
}

export interface OnlineRoom {
  code: string;
  nome: string;
  isPrivate: boolean;
  maxPlayers: number;
  competitiveSymmetric: boolean;
  hostPlayerId: number;
  status: 'waiting' | 'playing' | 'finished';
  phase: TurnPhase;
  turnoAtual: number;
  turnsPlayed: number;
  createdAt: number;
  updatedAt: number;
  customBoardMeta: any | null;
  tiles: OnlineTileState[];
  players: OnlinePlayerState[];
  playerTokens: Map<number, string>; // playerId -> sessionToken
  pendingRent: PendingRentDetails | null;
  pendingOracle: PendingOracleDetails | null;
  lastDiceResult: number | null;
  winnerId: number | null;
  history: string[];
}

const GODS_MAP: Record<GodId, { id: GodId; nome: string; icon: string; cor: string; passiva: string }> = {
  zeus: { id: 'zeus', nome: 'Zeus', icon: '⚡', cor: 'text-amber-400', passiva: 'Raio (+15% saldo inicial)' },
  poseidon: { id: 'poseidon', nome: 'Poseidon', icon: '🔱', cor: 'text-cyan-400', passiva: 'Mare (+10% aluguel Atlântida)' },
  hades: { id: 'hades', nome: 'Hades', icon: '💀', cor: 'text-purple-400', passiva: 'Submundo (Fiança reduzida)' },
  atena: { id: 'atena', nome: 'Atena', icon: '🦉', cor: 'text-emerald-400', passiva: 'Estratégia (Imunidade 1ª taxa)' }
};

function createClassicTiles(): OnlineTileState[] {
  return [
    { id: 0, nome: 'Portões do Olimpo', tipo: 'inicio', icon: '🏛️', valor: 0, aluguel: 0, temploCusto: 0, temploAluguel: 0, santuarioCusto: 0, aluguelNiveis: [0, 0, 0, 0, 0], dono: null, nivel: 0 },
    { id: 1, nome: 'Labirinto de Creta', tipo: 'propriedade', icon: '🐂', grupo: 'Terras Antigas', valor: 600, aluguel: 70, temploCusto: 350, temploAluguel: 160, santuarioCusto: 900, aluguelNiveis: [70, 160, 280, 420, 650], dono: null, nivel: 0 },
    { id: 2, nome: 'Floresta de Ártemis', tipo: 'propriedade', icon: '🏹', grupo: 'Terras Antigas', valor: 800, aluguel: 95, temploCusto: 450, temploAluguel: 210, santuarioCusto: 1100, aluguelNiveis: [95, 210, 370, 540, 850], dono: null, nivel: 0 },
    { id: 3, nome: 'Submundo de Hades', tipo: 'propriedade', icon: '💀', grupo: 'Mares & Sombras', valor: 1200, aluguel: 150, temploCusto: 650, temploAluguel: 330, santuarioCusto: 1600, aluguelNiveis: [150, 330, 560, 820, 1250], dono: null, nivel: 0 },
    { id: 4, nome: 'Oráculo de Delfos', tipo: 'bencao', icon: '🔮', valor: 0, aluguel: 0, temploCusto: 0, temploAluguel: 0, santuarioCusto: 0, aluguelNiveis: [0, 0, 0, 0, 0], dono: null, nivel: 0 },
    { id: 5, nome: 'Atlântida', tipo: 'propriedade', icon: '🔱', grupo: 'Mares & Sombras', valor: 1500, aluguel: 195, temploCusto: 800, temploAluguel: 420, santuarioCusto: 2000, aluguelNiveis: [195, 420, 710, 1040, 1580], dono: null, nivel: 0 },
    { id: 6, nome: 'Tártaro', tipo: 'prisao', icon: '🔥', valor: 0, aluguel: 0, temploCusto: 0, temploAluguel: 0, santuarioCusto: 0, aluguelNiveis: [0, 0, 0, 0, 0], dono: null, nivel: 0 },
    { id: 7, nome: 'Templo de Apolo', tipo: 'propriedade', icon: '☀️', grupo: 'Campos Sagrados', valor: 1800, aluguel: 240, temploCusto: 950, temploAluguel: 510, santuarioCusto: 2400, aluguelNiveis: [240, 510, 860, 1260, 1900], dono: null, nivel: 0 },
    { id: 8, nome: 'Campos Elísios', tipo: 'propriedade', icon: '🌾', grupo: 'Campos Sagrados', valor: 2200, aluguel: 300, temploCusto: 1150, temploAluguel: 640, santuarioCusto: 2800, aluguelNiveis: [300, 640, 1080, 1560, 2350], dono: null, nivel: 0 },
    { id: 9, nome: 'Oráculo de Delfos', tipo: 'bencao', icon: '👁️', valor: 0, aluguel: 0, temploCusto: 0, temploAluguel: 0, santuarioCusto: 0, aluguelNiveis: [0, 0, 0, 0, 0], dono: null, nivel: 0 },
    { id: 10, nome: 'Ilha de Rhodes', tipo: 'propriedade', icon: '⛵', grupo: 'Panteão Supremo', valor: 2800, aluguel: 400, temploCusto: 1450, temploAluguel: 840, santuarioCusto: 3500, aluguelNiveis: [400, 840, 1400, 2020, 3050], dono: null, nivel: 0 },
    { id: 11, nome: 'Monte Olimpo', tipo: 'propriedade', icon: '⛰️', grupo: 'Panteão Supremo', valor: 3500, aluguel: 520, temploCusto: 1800, temploAluguel: 1080, santuarioCusto: 4500, aluguelNiveis: [520, 1080, 1780, 2560, 3900], dono: null, nivel: 0 }
  ];
}

function sanitizeCustomTiles(boardCfg: any): { tiles: OnlineTileState[]; meta: any | null } {
  if (!boardCfg || !Array.isArray(boardCfg.casas)) {
    return { tiles: createClassicTiles(), meta: null };
  }
  const len = boardCfg.casas.length;
  if (len < 8 || len > 24) {
    return { tiles: createClassicTiles(), meta: null };
  }
  const cleanTiles: OnlineTileState[] = boardCfg.casas.map((c: any, idx: number) => {
    const tipo =
      idx === 0
        ? 'inicio'
        : c?.tipo === 'propriedade' || c?.tipo === 'bencao' || c?.tipo === 'prisao'
          ? c.tipo
          : 'propriedade';
    const valor = tipo === 'propriedade' ? Math.max(400, Math.min(5000, Math.round(Number(c?.valor) || 800))) : 0;
    const baseAluguel = tipo === 'propriedade' ? Math.max(40, Math.round(Number(c?.aluguel) || valor * 0.13)) : 0;
    const temploCusto = tipo === 'propriedade' ? Math.max(200, Math.round(Number(c?.temploCusto) || valor * 0.55)) : 0;
    const temploAluguel = tipo === 'propriedade' ? Math.max(80, Math.round(Number(c?.temploAluguel) || baseAluguel * 2.2)) : 0;
    const santuarioCusto = tipo === 'propriedade' ? Math.max(400, Math.round(Number(c?.santuarioCusto) || valor * 1.35)) : 0;
    const aluguelNiveis: [number, number, number, number, number] =
      Array.isArray(c?.aluguelNiveis) && c.aluguelNiveis.length === 5
        ? [
            Number(c.aluguelNiveis[0]) || baseAluguel,
            Number(c.aluguelNiveis[1]) || temploAluguel,
            Number(c.aluguelNiveis[2]) || Math.round(temploAluguel * 1.75),
            Number(c.aluguelNiveis[3]) || Math.round(temploAluguel * 2.55),
            Number(c.aluguelNiveis[4]) || Math.round(temploAluguel * 3.85)
          ]
        : [
            baseAluguel,
            temploAluguel,
            Math.round(temploAluguel * 1.75),
            Math.round(temploAluguel * 2.55),
            Math.round(temploAluguel * 3.85)
          ];
    const safeImg =
      typeof c?.imagemDataUrl === 'string' &&
      c.imagemDataUrl.length <= 48 * 1024 &&
      /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(c.imagemDataUrl)
        ? c.imagemDataUrl
        : undefined;

    return {
      id: idx,
      nome: String(c?.nome || `Casa ${idx}`).trim().substring(0, 24),
      descricao: c?.descricao ? String(c.descricao).trim().substring(0, 80) : undefined,
      tipo,
      icon: String(c?.icon || (tipo === 'inicio' ? '🏛️' : tipo === 'prisao' ? '🔥' : tipo === 'bencao' ? '🔮' : '🏛️')).substring(0, 6),
      grupo: tipo === 'propriedade' ? String(c?.grupo || `Região ${Math.floor(idx / 3) + 1}`).trim().substring(0, 24) : undefined,
      imagemDataUrl: safeImg,
      valor,
      aluguel: baseAluguel,
      temploCusto,
      temploAluguel,
      santuarioCusto,
      aluguelNiveis,
      dono: null,
      nivel: 0
    };
  });

  const propCount = cleanTiles.filter((t) => t.tipo === 'propriedade').length;
  if (propCount < 5) {
    return { tiles: createClassicTiles(), meta: null };
  }

  const cols = len <= 8 ? 3 : len <= 12 ? 4 : len <= 16 ? 5 : len <= 20 ? 6 : 7;
  const rows = len <= 10 ? (len === 10 ? 4 : 3) : len <= 14 ? (len === 14 ? 5 : 4) : len <= 18 ? (len === 18 ? 6 : 5) : len <= 22 ? (len === 22 ? 7 : 6) : 7;
  const gridSide = Math.max(cols, rows);

  return {
    tiles: cleanTiles,
    meta: {
      id: String(boardCfg.id || 'custom_online').substring(0, 48),
      nome: String(boardCfg.nome || 'Arena Personalizada').substring(0, 36),
      tema: String(boardCfg.tema || 'mitologico').substring(0, 24),
      customThemeName: boardCfg.customThemeName ? String(boardCfg.customThemeName).trim().substring(0, 28) : undefined,
      gridSide,
      cols,
      rows,
      tileCount: len,
      espacamento: boardCfg.espacamento || 'padrao',
      bordaArredondada: boardCfg.bordaArredondada !== false,
      corPrimaria: String(boardCfg.corPrimaria || '#d97706').substring(0, 16),
      corSecundaria: String(boardCfg.corSecundaria || '#1e293b').substring(0, 16),
      corFundo: String(boardCfg.corFundo || '#020617').substring(0, 16),
      corDestaque: String(boardCfg.corDestaque || '#fbbf24').substring(0, 16),
      decoracao3d: boardCfg.decoracao3d || 'pilares',
      casas: cleanTiles
    }
  };
}

function getRentByLevel(tile: OnlineTileState, nivel: number): number {
  const n = Math.max(0, Math.min(4, Math.floor(nivel)));
  return tile.aluguelNiveis[n] || tile.aluguel || 0;
}

function getUpgradeCost(tile: OnlineTileState, nivelAtual: number): number {
  const n = Math.max(0, Math.min(3, Math.floor(nivelAtual)));
  if (n === 0) return tile.temploCusto;
  if (n === 1) return Math.floor(tile.temploCusto * 1.5);
  if (n === 2) return tile.temploCusto * 2;
  return tile.santuarioCusto;
}

function checkGroupMonopoly(tiles: OnlineTileState[], tile: OnlineTileState, ownerId: number): boolean {
  if (!tile.grupo) return false;
  const groupTiles = tiles.filter((t) => t.tipo === 'propriedade' && t.grupo === tile.grupo);
  if (groupTiles.length < 2) return false;
  return groupTiles.every((t) => t.dono === ownerId);
}

function sanitizeNick(raw: unknown, fallback = 'Guerreiro'): string {
  const s = String(raw || '').replace(/[<>&"']/g, '').trim().substring(0, 20);
  return s.length >= 2 ? s : fallback;
}

function pickGodObj(godIdRaw: unknown, indexFallback: number) {
  const key = String(godIdRaw || '').toLowerCase() as GodId;
  if (GODS_MAP[key]) return { ...GODS_MAP[key] };
  const keys: GodId[] = ['zeus', 'poseidon', 'hades', 'atena'];
  return { ...GODS_MAP[keys[indexFallback % keys.length]] };
}

function computeStartingBalance(godId: GodId, classeId: string, symmetric: boolean): number {
  let base = 5000;
  if (godId === 'zeus') base = Math.floor(base * 1.15);
  return applyClassStartingBalance(base, classeId, symmetric);
}

export interface MultiplayerContext {
  router: express.Router;
  attachWebSocketServer: (server: http.Server) => void;
  getRoomCount: () => number;
}

interface AuthedSocketMeta {
  roomCode: string;
  playerId: number;
}

export function createMultiplayerServer(): MultiplayerContext {
  const router = express.Router();
  const rooms = new Map<string, OnlineRoom>();
  const socketMeta = new WeakMap<WebSocket, AuthedSocketMeta>();
  const roomSockets = new Map<string, Set<WebSocket>>();

  // Clean up stale rooms older than 6 hours every 15 minutes
  setInterval(() => {
    const cutoff = Date.now() - 6 * 60 * 60 * 1000;
    for (const [code, room] of rooms.entries()) {
      if (room.updatedAt < cutoff) {
        rooms.delete(code);
        roomSockets.delete(code);
      }
    }
  }, 15 * 60 * 1000);

  function buildRoomSnapshot(room: OnlineRoom) {
    return {
      code: room.code,
      nome: room.nome,
      isPrivate: room.isPrivate,
      maxPlayers: room.maxPlayers,
      competitiveSymmetric: room.competitiveSymmetric,
      hostPlayerId: room.hostPlayerId,
      status: room.status,
      phase: room.phase,
      turnoAtual: room.turnoAtual,
      turnsPlayed: room.turnsPlayed,
      customBoardMeta: room.customBoardMeta,
      tiles: room.tiles.map((t) => ({ ...t })),
      players: room.players.map((p) => ({ ...p })),
      pendingRent: room.pendingRent,
      pendingOracle: room.pendingOracle,
      lastDiceResult: room.lastDiceResult,
      winnerId: room.winnerId,
      history: room.history.slice(0, 30)
    };
  }

  function pushHistory(room: OnlineRoom, msg: string) {
    room.history.unshift(msg);
    if (room.history.length > 60) room.history.length = 60;
  }

  function broadcastRoom(room: OnlineRoom, extraEvent?: Record<string, any>) {
    room.updatedAt = Date.now();
    const conns = roomSockets.get(room.code);
    if (!conns || conns.size === 0) return;

    const payload = JSON.stringify({
      type: 'STATE_SYNC',
      snapshot: buildRoomSnapshot(room),
      event: extraEvent || null
    });

    for (const ws of conns) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  function advanceTurnServer(room: OnlineRoom) {
    if (room.status === 'finished' || room.phase === 'finished') return;
    room.pendingRent = null;
    room.pendingOracle = null;

    const total = room.players.length;
    let attempts = 0;
    do {
      room.turnoAtual = (room.turnoAtual + 1) % total;
      attempts++;
    } while (room.players[room.turnoAtual]?.falido && attempts < total);

    const alive = room.players.filter((p) => !p.falido);
    if (alive.length <= 1) {
      room.status = 'finished';
      room.phase = 'finished';
      room.winnerId = alive[0]?.id || room.players[0]?.id || null;
      if (alive[0]) {
        pushHistory(room, `🏆 ${alive[0].nome} venceu a batalha dos Imortais!`);
      }
      return;
    }

    room.phase = 'awaiting_roll';
  }

  function checkBankruptcyServer(room: OnlineRoom, targetPlayer: OnlinePlayerState): boolean {
    if (targetPlayer.saldo > 0) return false;
    targetPlayer.falido = true;
    targetPlayer.saldo = 0;
    room.tiles.forEach((t) => {
      if (t.dono === targetPlayer.id) {
        t.dono = null;
        t.nivel = 0;
      }
    });
    pushHistory(room, `💀 ${targetPlayer.nome} foi à falência e perdeu suas terras!`);

    const alive = room.players.filter((p) => !p.falido);
    if (alive.length <= 1) {
      room.status = 'finished';
      room.phase = 'finished';
      room.winnerId = alive[0]?.id || null;
      if (alive[0]) {
        pushHistory(room, `🏆 ${alive[0].nome} é o grande Campeão do Legado dos Imortais!`);
      }
      return true;
    }
    return false;
  }

  function resolveLandingServer(room: OnlineRoom, player: OnlinePlayerState): Record<string, any> | undefined {
    const tile = room.tiles[player.pos];
    if (!tile) {
      advanceTurnServer(room);
      return undefined;
    }

    pushHistory(room, `📍 ${player.nome} caiu em ${tile.nome}.`);

    if (tile.tipo === 'propriedade') {
      if (tile.dono === null) {
        room.phase = 'awaiting_buy';
        return { kind: 'LAND_UNOWNED', playerId: player.id, tileId: tile.id };
      }
      if (tile.dono === player.id) {
        if ((tile.nivel || 0) < 4) {
          room.phase = 'awaiting_upgrade';
          return { kind: 'LAND_OWN', playerId: player.id, tileId: tile.id };
        }
        pushHistory(room, `⚡ ${tile.nome} já possui Santuário Supremo.`);
        advanceTurnServer(room);
        return { kind: 'TURN_END', playerId: player.id };
      }

      const owner = room.players.find((p) => p.id === tile.dono && !p.falido);
      if (!owner) {
        advanceTurnServer(room);
        return undefined;
      }

      if (player.imunidadeTaxa) {
        player.imunidadeTaxa = false;
        pushHistory(room, `🦉 ${player.nome} usou a Estratégia de Atena e evitou pagar aluguel!`);
        advanceTurnServer(room);
        return { kind: 'IMMUNITY_USED', playerId: player.id, tileId: tile.id };
      }

      const baseRent = getRentByLevel(tile, tile.nivel || 0);
      const hasGroup = checkGroupMonopoly(room.tiles, tile, owner.id);
      const afterGroup = hasGroup ? Math.round(baseRent * 1.25) : baseRent;
      const afterClass = applyClassRentBonus(afterGroup, tile.nivel || 0, owner.classeId, room.competitiveSymmetric);
      const poseidonAtlantic =
        owner.deus.id === 'poseidon' && tile.nome.toLowerCase().includes('atlântida')
          ? Math.round(afterClass * 1.1)
          : afterClass;
      const totalTaxa = Math.max(0, poseidonAtlantic);
      const pagoEfetivo = Math.max(0, Math.min(player.saldo, totalTaxa));

      player.saldo -= totalTaxa;
      owner.saldo += pagoEfetivo;

      room.pendingRent = {
        casaId: tile.id,
        casaNome: tile.nome,
        casaIcon: tile.icon || '🏛️',
        grupo: tile.grupo || 'Domínio Olímpico',
        payerId: player.id,
        payerNome: player.nome,
        ownerId: owner.id,
        ownerNome: owner.nome,
        nivel: tile.nivel || 0,
        aluguelBase: baseRent,
        possuiConjuntoGrupo: hasGroup,
        bonusGrupoPct: hasGroup ? 25 : 0,
        bonusClasseValor: Math.max(0, totalTaxa - afterGroup),
        totalTaxa,
        pagoEfetivo
      };

      pushHistory(room, `💸 ${player.nome} pagou $${pagoEfetivo} de aluguel a ${owner.nome}.`);
      const gameEnded = checkBankruptcyServer(room, player);
      if (gameEnded) {
        return { kind: 'MATCH_FINISHED', winnerId: room.winnerId };
      }
      if (player.falido) {
        advanceTurnServer(room);
        return { kind: 'PLAYER_BANKRUPT', playerId: player.id };
      }

      room.phase = 'awaiting_rent_ack';
      return { kind: 'LAND_RENT', rent: room.pendingRent };
    }

    if (tile.tipo === 'bencao') {
      const bonusOraculo = !room.competitiveSymmetric && player.classeId === 'oraculo' ? 80 : 0;
      const penEstrategista = !room.competitiveSymmetric && player.classeId === 'estrategista' ? 25 : 0;
      const rollOracle = crypto.randomInt(0, 5);
      let pending: PendingOracleDetails;

      if (rollOracle === 0) {
        const gain = 400 + bonusOraculo;
        player.saldo += gain;
        pending = {
          titulo: 'Bênção de Hermes ⚡',
          desc: `Os mensageiros divinos concederam velocidade e tesouro. Você recebe +$ ${gain}!`,
          deltaSaldo: gain,
          teleporteCasa: null,
          concedeuImunidade: false
        };
      } else if (rollOracle === 1) {
        const loss = 250 + penEstrategista;
        player.saldo -= loss;
        pending = {
          titulo: 'Fúria de Ares ⚔️',
          desc: `Uma batalha nas fronteiras custou recursos sagrados. Pague $ ${loss} aos templos.`,
          deltaSaldo: -loss,
          teleporteCasa: null,
          concedeuImunidade: false
        };
      } else if (rollOracle === 2) {
        player.imunidadeTaxa = true;
        pending = {
          titulo: 'Sabedoria de Atena 🦉',
          desc: 'A deusa da estratégia lhe concede imunidade ao próximo aluguel!',
          deltaSaldo: 0,
          teleporteCasa: null,
          concedeuImunidade: true
        };
      } else if (rollOracle === 3) {
        const gain = 300 + bonusOraculo;
        player.saldo += gain;
        pending = {
          titulo: 'Tributo ao Olimpo 🏛️',
          desc: `Cada jogador no reino envia oferendas para homenagear sua glória. Receba +$ ${gain}!`,
          deltaSaldo: gain,
          teleporteCasa: null,
          concedeuImunidade: false
        };
      } else {
        const novaPos = (player.pos + 2) % room.tiles.length;
        player.pos = novaPos;
        pending = {
          titulo: 'Mar Tempestuoso de Poseidon 🌊',
          desc: 'Uma onda colossal empurra seu peão 2 casas adiante!',
          deltaSaldo: 0,
          teleporteCasa: novaPos,
          concedeuImunidade: false
        };
      }

      pushHistory(room, `🔮 Oráculo de Delfos: ${pending.titulo} (${player.nome})`);
      const gameEnded = checkBankruptcyServer(room, player);
      if (gameEnded) {
        return { kind: 'MATCH_FINISHED', winnerId: room.winnerId };
      }
      if (player.falido) {
        advanceTurnServer(room);
        return { kind: 'PLAYER_BANKRUPT', playerId: player.id };
      }

      room.pendingOracle = pending;
      room.phase = 'awaiting_oracle_ack';
      return { kind: 'LAND_ORACLE', oracle: pending, playerId: player.id };
    }

    if (tile.tipo === 'prisao') {
      const prisonIdx = room.tiles.findIndex((t) => t.tipo === 'prisao');
      if (prisonIdx >= 0) player.pos = prisonIdx;
      player.preso = true;
      player.turnosPreso = 0;
      pushHistory(room, `🔥 ${player.nome} foi enviado ao Tártaro!`);
      advanceTurnServer(room);
      return { kind: 'SENT_TO_PRISON', playerId: player.id, prisonIdx: player.pos };
    }

    advanceTurnServer(room);
    return undefined;
  }

  // -------------------- REST ENDPOINTS --------------------
  router.get('/rooms', (_req, res) => {
    const publicList = Array.from(rooms.values())
      .filter((r) => !r.isPrivate && r.status === 'waiting')
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 40)
      .map((r) => ({
        code: r.code,
        nome: r.nome,
        hostName: r.players[0]?.nome || 'Anfitrião',
        playerCount: r.players.length,
        maxPlayers: r.maxPlayers,
        competitiveSymmetric: r.competitiveSymmetric,
        boardName: r.customBoardMeta?.nome || 'Olimpo Clássico (4x4)'
      }));
    return res.json({ success: true, rooms: publicList });
  });

  router.get('/rooms/:code', (req, res) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return res.status(404).json({ error: 'Sala não encontrada.' });
    return res.json({ success: true, snapshot: buildRoomSnapshot(room) });
  });

  router.post('/rooms', (req, res) => {
    try {
      const { nome, isPrivate, maxPlayers, competitiveSymmetric, playerName, godId, classeId, peca3d, customBoard } =
        req.body || {};
      const limitPlayers = Math.max(2, Math.min(4, Number(maxPlayers) || 2));
      const symmetric = Boolean(competitiveSymmetric);
      const god = pickGodObj(godId, 0);
      const cls = typeof classeId === 'string' && classeId ? classeId : 'classico_equilibrado';
      const nick = sanitizeNick(playerName, 'Anfitrião');
      const roomName = String(nome || `Sala de ${nick}`).replace(/[<>&"']/g, '').trim().substring(0, 32) || `Sala de ${nick}`;

      let code = '';
      for (let i = 0; i < 8; i++) {
        const candidate = `OLIMPO-${crypto.randomInt(1000, 9999)}`;
        if (!rooms.has(candidate)) {
          code = candidate;
          break;
        }
      }
      if (!code) code = `OLIMPO-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

      const { tiles, meta } = sanitizeCustomTiles(customBoard);
      const token = crypto.randomBytes(24).toString('hex');

      const hostPlayer: OnlinePlayerState = {
        id: 1,
        nome: nick,
        deus: god,
        classeId: cls,
        saldo: computeStartingBalance(god.id, cls, symmetric),
        usouDescontoPrimeiraCompra: false,
        pos: 0,
        preso: false,
        turnosPreso: 0,
        falido: false,
        imunidadeTaxa: god.id === 'atena',
        isAi: false,
        connected: false,
        peca3d: peca3d || null
      };

      const room: OnlineRoom = {
        code,
        nome: roomName,
        isPrivate: Boolean(isPrivate),
        maxPlayers: limitPlayers,
        competitiveSymmetric: symmetric,
        hostPlayerId: 1,
        status: 'waiting',
        phase: 'waiting',
        turnoAtual: 0,
        turnsPlayed: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        customBoardMeta: meta,
        tiles,
        players: [hostPlayer],
        playerTokens: new Map([[1, token]]),
        pendingRent: null,
        pendingOracle: null,
        lastDiceResult: null,
        winnerId: null,
        history: [`🏰 Sala ${code} criada por ${nick}.`]
      };

      rooms.set(code, room);
      return res.json({
        success: true,
        roomCode: code,
        playerId: 1,
        sessionToken: token,
        snapshot: buildRoomSnapshot(room)
      });
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || 'Erro ao criar sala online.' });
    }
  });

  router.post('/rooms/:code/join', (req, res) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return res.status(404).json({ error: 'Sala não encontrada ou expirada.' });
    if (room.status !== 'waiting') {
      return res.status(409).json({ error: 'Esta partida já começou.' });
    }
    if (room.players.length >= room.maxPlayers) {
      return res.status(409).json({ error: 'Esta sala já atingiu o limite máximo de jogadores.' });
    }

    const { playerName, godId, classeId, peca3d } = req.body || {};
    const newId = room.players.length + 1;
    const god = pickGodObj(godId, newId - 1);
    const cls = typeof classeId === 'string' && classeId ? classeId : 'classico_equilibrado';
    const nick = sanitizeNick(playerName, `Guerreiro ${newId}`);
    const token = crypto.randomBytes(24).toString('hex');

    const newPlayer: OnlinePlayerState = {
      id: newId,
      nome: nick,
      deus: god,
      classeId: cls,
      saldo: computeStartingBalance(god.id, cls, room.competitiveSymmetric),
      usouDescontoPrimeiraCompra: false,
      pos: 0,
      preso: false,
      turnosPreso: 0,
      falido: false,
      imunidadeTaxa: god.id === 'atena',
      isAi: false,
      connected: false,
      peca3d: peca3d || null
    };

    room.players.push(newPlayer);
    room.playerTokens.set(newId, token);
    pushHistory(room, `⚔️ ${nick} entrou na sala.`);
    broadcastRoom(room, { kind: 'PLAYER_JOINED', playerId: newId, nome: nick });

    return res.json({
      success: true,
      roomCode: code,
      playerId: newId,
      sessionToken: token,
      snapshot: buildRoomSnapshot(room)
    });
  });

  router.post('/rooms/:code/leave', (req, res) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return res.json({ success: true });
    const { playerId, sessionToken } = req.body || {};
    const pid = Number(playerId);
    if (!room.playerTokens.get(pid) || room.playerTokens.get(pid) !== sessionToken) {
      return res.status(403).json({ error: 'Token da sessão inválido para esta sala.' });
    }

    if (room.status === 'waiting') {
      room.players = room.players.filter((p) => p.id !== pid);
      room.playerTokens.delete(pid);
      if (room.players.length === 0 || pid === room.hostPlayerId) {
        rooms.delete(code);
        return res.json({ success: true, closed: true });
      }
      broadcastRoom(room, { kind: 'PLAYER_LEFT', playerId: pid });
    } else if (room.status === 'playing') {
      const p = room.players.find((x) => x.id === pid);
      if (p && !p.falido) {
        p.connected = false;
        p.saldo = 0;
        checkBankruptcyServer(room, p);
        if (room.status === 'playing' && room.players[room.turnoAtual]?.id === pid) {
          advanceTurnServer(room);
        }
        broadcastRoom(room, { kind: 'PLAYER_DISCONNECTED', playerId: pid });
      }
    }
    return res.json({ success: true });
  });

  // -------------------- WEBSOCKET SERVER (/ws) --------------------
  function handleWsAction(ws: WebSocket, msg: any) {
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'PING') {
      ws.send(JSON.stringify({ type: 'PONG', ts: Date.now() }));
      return;
    }

    if (msg.type === 'AUTH') {
      const code = String(msg.roomCode || '').trim().toUpperCase();
      const pid = Number(msg.playerId);
      const token = String(msg.sessionToken || '').trim();
      const room = rooms.get(code);

      if (!room || room.playerTokens.get(pid) !== token) {
        ws.send(JSON.stringify({ type: 'ACTION_REJECTED', reason: 'Credenciais de sala WebSocket inválidas ou expiradas.' }));
        return;
      }

      socketMeta.set(ws, { roomCode: code, playerId: pid });
      if (!roomSockets.has(code)) roomSockets.set(code, new Set());
      roomSockets.get(code)!.add(ws);

      const player = room.players.find((p) => p.id === pid);
      if (player) player.connected = true;

      // Immediate authoritative snapshot sync (full reconnect recovery!)
      ws.send(
        JSON.stringify({
          type: 'STATE_SYNC',
          snapshot: buildRoomSnapshot(room),
          event: { kind: 'AUTH_OK', playerId: pid }
        })
      );
      broadcastRoom(room, { kind: 'PRESENCE_UPDATE', playerId: pid, connected: true });
      return;
    }

    const meta = socketMeta.get(ws);
    if (!meta) {
      ws.send(JSON.stringify({ type: 'ACTION_REJECTED', reason: 'Sessão WebSocket não autenticada nesta sala.' }));
      return;
    }

    const room = rooms.get(meta.roomCode);
    if (!room) {
      ws.send(JSON.stringify({ type: 'ACTION_REJECTED', reason: 'Esta sala não existe mais.' }));
      return;
    }

    const actor = room.players.find((p) => p.id === meta.playerId);
    if (!actor) {
      ws.send(JSON.stringify({ type: 'ACTION_REJECTED', reason: 'Jogador não pertence a esta sala.' }));
      return;
    }

    // Host starts the match
    if (msg.type === 'START_MATCH') {
      if (meta.playerId !== room.hostPlayerId) {
        ws.send(JSON.stringify({ type: 'ACTION_REJECTED', reason: 'Apenas o anfitrião pode iniciar a partida.' }));
        return;
      }
      if (room.status !== 'waiting') {
        ws.send(JSON.stringify({ type: 'ACTION_REJECTED', reason: 'A partida já foi iniciada.' }));
        return;
      }
      if (room.players.length < 2) {
        ws.send(JSON.stringify({ type: 'ACTION_REJECTED', reason: 'Aguardando pelo menos 2 guerreiros na sala.' }));
        return;
      }

      if (msg.customBoard) {
        const sanitized = sanitizeCustomTiles(msg.customBoard);
        room.tiles = sanitized.tiles;
        room.customBoardMeta = sanitized.meta;
      }

      room.status = 'playing';
      room.phase = 'coin_toss';
      room.turnoAtual = 0;
      pushHistory(room, `⚡ Partida iniciada com ${room.players.length} guerreiros! Sorteio de Cara ou Coroa...`);
      broadcastRoom(room, { kind: 'MATCH_STARTED' });
      return;
    }

    // All gameplay actions below require active turn authority
    if (room.status !== 'playing') {
      ws.send(JSON.stringify({ type: 'ACTION_REJECTED', reason: 'A partida não está ativa.' }));
      return;
    }

    const activePlayer = room.players[room.turnoAtual];
    if (!activePlayer || activePlayer.id !== actor.id) {
      ws.send(JSON.stringify({ type: 'ACTION_REJECTED', reason: `Não é a sua vez! Vez de ${activePlayer?.nome || 'outro jogador'}.` }));
      return;
    }

    if (msg.type === 'COIN_TOSS') {
      if (room.phase !== 'coin_toss') {
        ws.send(JSON.stringify({ type: 'ACTION_REJECTED', reason: 'Sorteio inicial já foi concluído.' }));
        return;
      }
      const choice = msg.choice === 'coroa' ? 'coroa' : 'cara';
      const result = crypto.randomInt(0, 2) === 0 ? 'cara' : 'coroa';
      const won = choice === result;
      room.turnoAtual = won ? 0 : room.players.length > 1 ? 1 : 0;
      room.phase = 'awaiting_roll';
      const starter = room.players[room.turnoAtual];
      pushHistory(room, `🪙 Cara ou Coroa: deu ${result.toUpperCase()}! ${starter.nome} começa jogando.`);
      broadcastRoom(room, { kind: 'COIN_TOSS_RESULT', choice, result, starterId: starter.id });
      return;
    }

    if (msg.type === 'PRISON_PAY_BAIL') {
      if (room.phase !== 'awaiting_roll' || !actor.preso) {
        ws.send(JSON.stringify({ type: 'ACTION_REJECTED', reason: 'Fiança indisponível fora do turno preso.' }));
        return;
      }
      const bailCost = applyClassBailCost(150, actor.classeId, room.competitiveSymmetric);
      if (actor.saldo < bailCost) {
        ws.send(JSON.stringify({ type: 'ACTION_REJECTED', reason: `Saldo insuficiente ($${bailCost}) para fiança.` }));
        return;
      }
      actor.saldo -= bailCost;
      actor.preso = false;
      actor.turnosPreso = 0;
      pushHistory(room, `💰 ${actor.nome} pagou $${bailCost} de fiança e saiu do Tártaro!`);
      advanceTurnServer(room);
      broadcastRoom(room, { kind: 'BAIL_PAID', playerId: actor.id, cost: bailCost });
      return;
    }

    if (msg.type === 'ROLL_DICE' || msg.type === 'PRISON_ROLL_EXIT') {
      if (room.phase !== 'awaiting_roll') {
        ws.send(JSON.stringify({ type: 'ACTION_REJECTED', reason: 'Aguardando conclusão da ação anterior antes de rolar o dado.' }));
        return;
      }
      const dice = crypto.randomInt(1, 7);
      room.lastDiceResult = dice;
      room.turnsPlayed += 1;

      if (actor.preso) {
        if (dice === 6) {
          actor.preso = false;
          actor.turnosPreso = 0;
          pushHistory(room, `🔥 ${actor.nome} tirou 6 no dado e escapou do Tártaro!`);
        } else {
          actor.turnosPreso += 1;
          if (actor.turnosPreso >= 3) {
            actor.preso = false;
            actor.turnosPreso = 0;
            pushHistory(room, `🔥 ${actor.nome} cumpriu 3 rodadas e saiu do Tártaro.`);
          } else {
            pushHistory(room, `🔥 ${actor.nome} tirou ${dice} e continua preso (${actor.turnosPreso}/3).`);
            advanceTurnServer(room);
            broadcastRoom(room, { kind: 'DICE_ROLLED', playerId: actor.id, dice, stillInPrison: true });
            return;
          }
        }
      }

      const startPos = actor.pos;
      let passedStart = false;
      const totalTiles = room.tiles.length;
      for (let step = 1; step <= dice; step++) {
        const nextPos = (startPos + step) % totalTiles;
        if (nextPos === 0) passedStart = true;
      }
      actor.pos = (startPos + dice) % totalTiles;

      let startBonus = 0;
      if (passedStart) {
        startBonus = applyClassPassStartBonus(200, actor.classeId, room.competitiveSymmetric);
        actor.saldo += startBonus;
        pushHistory(room, `⚡ ${actor.nome} passou pelo Início e recebeu +$${startBonus}.`);
      }

      const landEv = resolveLandingServer(room, actor);
      broadcastRoom(room, {
        kind: 'DICE_ROLLED',
        playerId: actor.id,
        dice,
        fromPos: startPos,
        toPos: actor.pos,
        passedStart,
        startBonus,
        landEvent: landEv || null
      });
      return;
    }

    if (msg.type === 'BUY_ACCEPT') {
      if (room.phase !== 'awaiting_buy') {
        ws.send(JSON.stringify({ type: 'ACTION_REJECTED', reason: 'Nenhuma compra pendente.' }));
        return;
      }
      const tile = room.tiles[actor.pos];
      if (!tile || tile.tipo !== 'propriedade' || tile.dono !== null) {
        ws.send(JSON.stringify({ type: 'ACTION_REJECTED', reason: 'Esta terra não está disponível para compra.' }));
        return;
      }
      const calc = applyClassPropertyBuyCost(tile.valor, actor.classeId, actor.usouDescontoPrimeiraCompra, room.competitiveSymmetric);
      if (actor.saldo < calc.cost) {
        ws.send(JSON.stringify({ type: 'ACTION_REJECTED', reason: `Saldo insuficiente ($${calc.cost}).` }));
        return;
      }
      actor.saldo -= calc.cost;
      if (calc.consumedFirstDiscount) actor.usouDescontoPrimeiraCompra = true;
      tile.dono = actor.id;
      pushHistory(room, `🏛️ ${actor.nome} adquiriu ${tile.nome} por $${calc.cost}!`);
      advanceTurnServer(room);
      broadcastRoom(room, { kind: 'PROPERTY_BOUGHT', playerId: actor.id, tileId: tile.id, cost: calc.cost });
      return;
    }

    if (msg.type === 'BUY_DECLINE') {
      if (room.phase !== 'awaiting_buy') return;
      pushHistory(room, `⏩ ${actor.nome} optou por não adquirir ${room.tiles[actor.pos]?.nome || 'o território'}.`);
      advanceTurnServer(room);
      broadcastRoom(room, { kind: 'PROPERTY_DECLINED', playerId: actor.id });
      return;
    }

    if (msg.type === 'UPGRADE_ACCEPT') {
      if (room.phase !== 'awaiting_upgrade') {
        ws.send(JSON.stringify({ type: 'ACTION_REJECTED', reason: 'Nenhuma evolução pendente.' }));
        return;
      }
      const tile = room.tiles[actor.pos];
      if (!tile || tile.tipo !== 'propriedade' || tile.dono !== actor.id || (tile.nivel || 0) >= 4) {
        ws.send(JSON.stringify({ type: 'ACTION_REJECTED', reason: 'Território não elegível para evolução.' }));
        return;
      }
      const baseCost = getUpgradeCost(tile, tile.nivel || 0);
      const cost = applyClassUpgradeCost(baseCost, actor.classeId, room.competitiveSymmetric);
      if (actor.saldo < cost) {
        ws.send(JSON.stringify({ type: 'ACTION_REJECTED', reason: `Saldo insuficiente ($${cost}) para construir.` }));
        return;
      }
      actor.saldo -= cost;
      tile.nivel = (tile.nivel || 0) + 1;
      const tierLabel = tile.nivel >= 4 ? 'Santuário Supremo ⚡' : `${tile.nivel}º Templo 🏛️`;
      pushHistory(room, `🔨 ${actor.nome} construiu ${tierLabel} em ${tile.nome}!`);
      advanceTurnServer(room);
      broadcastRoom(room, { kind: 'PROPERTY_UPGRADED', playerId: actor.id, tileId: tile.id, nivel: tile.nivel });
      return;
    }

    if (msg.type === 'UPGRADE_DECLINE') {
      if (room.phase !== 'awaiting_upgrade') return;
      advanceTurnServer(room);
      broadcastRoom(room, { kind: 'UPGRADE_DECLINED', playerId: actor.id });
      return;
    }

    if (msg.type === 'ACK_RENT') {
      if (room.phase !== 'awaiting_rent_ack') return;
      advanceTurnServer(room);
      broadcastRoom(room, { kind: 'RENT_ACKNOWLEDGED', playerId: actor.id });
      return;
    }

    if (msg.type === 'ACK_ORACLE') {
      if (room.phase !== 'awaiting_oracle_ack') return;
      advanceTurnServer(room);
      broadcastRoom(room, { kind: 'ORACLE_ACKNOWLEDGED', playerId: actor.id });
      return;
    }

    ws.send(JSON.stringify({ type: 'ACTION_REJECTED', reason: `Ação desconhecida ou indisponível: ${String(msg.type)}` }));
  }

  function attachWebSocketServer(httpServer: http.Server) {
    const wss = new WebSocketServer({
      server: httpServer,
      path: '/ws',
      maxPayload: 256 * 1024
    });

    wss.on('connection', (ws) => {
      ws.on('message', (raw) => {
        try {
          const text = typeof raw === 'string' ? raw : raw.toString('utf-8');
          const parsed = JSON.parse(text);
          handleWsAction(ws, parsed);
        } catch {
          ws.send(JSON.stringify({ type: 'ACTION_REJECTED', reason: 'Mensagem WebSocket malformada.' }));
        }
      });

      ws.on('close', () => {
        const meta = socketMeta.get(ws);
        if (!meta) return;
        const set = roomSockets.get(meta.roomCode);
        if (set) {
          set.delete(ws);
        }
        const room = rooms.get(meta.roomCode);
        if (room) {
          const player = room.players.find((p) => p.id === meta.playerId);
          if (player) {
            player.connected = false;
            broadcastRoom(room, { kind: 'PRESENCE_UPDATE', playerId: meta.playerId, connected: false });
          }
        }
      });
    });

    console.log('[Multiplayer WS] Servidor WebSocket autoritativo ativo no caminho /ws');
  }

  return {
    router,
    attachWebSocketServer,
    getRoomCount: () => rooms.size
  };
}

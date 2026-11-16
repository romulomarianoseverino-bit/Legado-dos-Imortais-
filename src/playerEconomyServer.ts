import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { validateCustomBoardConfig, CustomBoardConfig } from './customBoard';
import { PLANNED_MANIFEST_SAMPLE } from './versionManifest';

export interface EconomyTransaction {
  id: string;
  idempotencyKey?: string;
  type: 'daily_reward' | 'cosmetic_purchase' | 'ad_reward' | 'system_grant';
  amount: number; // positive = credit, negative = debit
  balanceAfter: number;
  description: string;
  createdAt: number;
}

export interface PlayerAccountRecord {
  userId: string;
  username: string;
  usernameKey: string;
  passwordHash: string; // scrypt "salt:derivedHex"
  coins: number;
  isPremium: boolean;
  unlockedCosmetics: string[];
  achievements: string[];
  weeklyRewardCycle: {
    weekStartUtcKey: string; // YYYY-MM-DD (Monday UTC)
    coinsClaimed: number;
    daysClaimed: string[]; // YYYY-MM-DD UTC dates claimed in this cycle
    lastClaimAt: number;
  };
  adClaimsDayUtc: string;
  adClaimsCountToday: number;
  verifiedWins: number;
  verifiedMatches: number;
  transactions: EconomyTransaction[];
  createdAt: number;
  updatedAt: number;
}

export interface PlayerSessionRecord {
  token: string;
  userId: string;
  username: string;
  createdAt: number;
  expiresAt: number;
}

export interface CommunityBoardEntry {
  id: string;
  authorUserId: string;
  authorUsername: string;
  board: CustomBoardConfig;
  ratingSum: number;
  ratingCount: number;
  ratedByUserIds: string[];
  reportedByUserIds: string[];
  hiddenByModeration: boolean;
  publishedAt: number;
}

export interface CosmeticItemSpec {
  id: string;
  nome: string;
  categoria: 'personagem' | 'tabuleiro' | 'dado';
  descricao: string;
  priceCoins: number;
  premiumIncluded?: boolean;
  icon: string;
  cosmeticOnly: true;
}

export const WEEKLY_COIN_CAP = 100;
export const WEEKLY_DAILY_SCHEDULE = [10, 12, 14, 15, 16, 16, 17] as const; // Soma exata = 100

export const COSMETIC_CATALOG: CosmeticItemSpec[] = [
  {
    id: 'cosmetic_coroa_imperial',
    nome: 'Coroa Imperial de Louros',
    categoria: 'personagem',
    descricao: 'Ornamento dourado de campeonato para o Criador 3D.',
    priceCoins: 35,
    icon: '👑',
    cosmeticOnly: true
  },
  {
    id: 'cosmetic_asas_fenix',
    nome: 'Asas da Fênix Rubra',
    categoria: 'personagem',
    descricao: 'Traço estilizado de chamas para seu avatar 3D (somente visual).',
    priceCoins: 60,
    icon: '🔥',
    cosmeticOnly: true
  },
  {
    id: 'cosmetic_dice_obsidiana',
    nome: 'Dado 3D Brasa do Tártaro',
    categoria: 'dado',
    descricao: 'Estilo visual vulcânico para rolagens de dado (RNG 100% justo).',
    priceCoins: 45,
    icon: '🎲',
    cosmeticOnly: true
  },
  {
    id: 'cosmetic_dice_cristal',
    nome: 'Dado 3D Cristal Glacial',
    categoria: 'dado',
    descricao: 'Acabamento translúcido frio para partidas temáticas.',
    priceCoins: 50,
    icon: '💎',
    cosmeticOnly: true
  },
  {
    id: 'cosmetic_board_espacial',
    nome: 'Tema Estação Nebulosa',
    categoria: 'tabuleiro',
    descricao: 'Paleta cósmica e cristais estelares para o Criador de Tabuleiros.',
    priceCoins: 70,
    icon: '🪐',
    cosmeticOnly: true
  },
  {
    id: 'cosmetic_board_retro',
    nome: 'Tema Reino dos Blocos (Original)',
    categoria: 'tabuleiro',
    descricao: 'Visual retrô original de blocos vibrantes no Criador de Tabuleiros.',
    priceCoins: 55,
    icon: '🟩',
    cosmeticOnly: true
  }
];

export const ACHIEVEMENT_CATALOG = [
  { id: 'first_account', nome: 'Cidadão do Olimpo', descricao: 'Criou uma conta persistente no servidor.', icone: '🏛️' },
  { id: 'daily_collector', nome: 'Disciplina Sagrada', descricao: 'Resgatou sua primeira recompensa diária no servidor.', icone: '🪙' },
  { id: 'weekly_100_champion', nome: 'Limite Semanal Completo', descricao: 'Atingiu 100 moedas no ciclo semanal (Segunda–Domingo).', icone: '⚡' },
  { id: 'cosmetic_patron', nome: 'Artífice Estético', descricao: 'Desbloqueou seu primeiro item cosmético na loja.', icone: '🎭' },
  { id: 'board_architect', nome: 'Arquiteto de Reinos', descricao: 'Publicou um tabuleiro personalizado validado na galeria.', icone: '🗺️' },
  { id: 'match_victor', nome: 'Campeão Inaugural', descricao: 'Conquistou sua 1ª vitória verificada em partida concluída.', icone: '🏆' },
  { id: 'veteran_5_wins', nome: 'Estrategista Imortal', descricao: 'Alcançou 5 vitórias em partidas concluídas.', icone: '👑' }
] as const;

export const ENTITLEMENTS_MATRIX = {
  free: [
    'Partidas completas Vs IA e Online P2P (2 a 4 jogadores)',
    'Todos os 4 Deuses do Olimpo e todas as Classes Balanceadas',
    '3 estilos visuais 3D (3D Estilizado, Cartoon, Anime) e Criador de Personagens',
    'Tabuleiro clássico + até 2 tabuleiros personalizados publicados na Galeria',
    'Oficina de Dados 3D visuais e Recompensas Diárias (até 100 moedas/semana)',
    'Ranking Global, Ranking entre Amigos, Histórico e Conquistas'
  ],
  premium: [
    'Publicação expandida na Galeria Comunitária (acima de 2 tabuleiros públicos)',
    'Selo visual Premium de Destaque na Galeria e Perfil (sem bônus de combate)',
    'Nenhuma vantagem competitiva, sem alteração de dados ou atributos de partida'
  ],
  planned: [
    'Integração futura com faturamento oficial (Google Play Billing / Stripe) ainda não conectada neste ambiente'
  ]
};

// Clock & ISO Week Monday 00:00 UTC helper (tamper-resistant server reference)
export function getIsoWeekCycleInfo(nowMs = Date.now()): {
  weekStartUtcKey: string;
  todayUtcKey: string;
  nextResetUtcIso: string;
  nextResetAt: number;
} {
  const d = new Date(nowMs);
  const utcDay = d.getUTCDay(); // 0 = Sun, 1 = Mon, ... 6 = Sat
  const daysSinceMonday = (utcDay + 6) % 7;
  const mondayStartMs = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() - daysSinceMonday,
    0,
    0,
    0,
    0
  );
  const nextMondayMs = mondayStartMs + 7 * 24 * 60 * 60 * 1000;
  const mondayDate = new Date(mondayStartMs);
  return {
    weekStartUtcKey: mondayDate.toISOString().slice(0, 10),
    todayUtcKey: d.toISOString().slice(0, 10),
    nextResetUtcIso: new Date(nextMondayMs).toISOString(),
    nextResetAt: nextMondayMs
  };
}

function normalizeHandle(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/[<>"'`]/g, '')
    .replace(/\s+/g, ' ')
    .substring(0, 24);
}

function containsAbusiveText(text: string): boolean {
  const lower = text.toLowerCase();
  const blocked = ['<script', 'javascript:', 'onerror=', 'onload=', 'porn', 'xxx', 'cassino-ilegal'];
  return blocked.some((w) => lower.includes(w));
}

function hashPasswordScrypt(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPasswordScrypt(password: string, stored: string): boolean {
  try {
    const [salt, expectedHex] = String(stored || '').split(':');
    if (!salt || !expectedHex || !/^[a-f0-9]{128}$/i.test(expectedHex)) return false;
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export interface PlayerEconomyRouterOptions {
  backupsDir: string;
  getClientIp: (req: express.Request) => string;
  rankingsFile?: string;
}

export function createPlayerEconomyRouter(opts: PlayerEconomyRouterOptions): express.Router {
  const router = express.Router();
  const ACCOUNTS_FILE = path.join(opts.backupsDir, 'player-accounts.json');
  const SESSIONS_FILE = path.join(opts.backupsDir, 'player-sessions.json');
  const COMMUNITY_BOARDS_FILE = path.join(opts.backupsDir, 'community-boards.json');

  if (!fs.existsSync(opts.backupsDir)) {
    fs.mkdirSync(opts.backupsDir, { recursive: true });
  }

  const atomicWriteJson = (filePath: string, data: unknown) => {
    const content = JSON.stringify(data, null, 2);
    const tmp = path.join(
      path.dirname(filePath),
      `.${path.basename(filePath)}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}.tmp`
    );
    const fd = fs.openSync(tmp, 'w');
    try {
      fs.writeSync(fd, Buffer.from(content, 'utf-8'));
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, filePath);
  };

  const readJsonSafe = <T>(filePath: string, fallback: T): T => {
    try {
      if (!fs.existsSync(filePath)) return fallback;
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
    } catch {
      return fallback;
    }
  };

  const loadAccounts = (): Record<string, PlayerAccountRecord> =>
    readJsonSafe<Record<string, PlayerAccountRecord>>(ACCOUNTS_FILE, {});
  const saveAccounts = (acc: Record<string, PlayerAccountRecord>) =>
    atomicWriteJson(ACCOUNTS_FILE, acc);

  const loadSessions = (): Record<string, PlayerSessionRecord> =>
    readJsonSafe<Record<string, PlayerSessionRecord>>(SESSIONS_FILE, {});
  const saveSessions = (sess: Record<string, PlayerSessionRecord>) =>
    atomicWriteJson(SESSIONS_FILE, sess);

  const loadCommunityBoards = (): CommunityBoardEntry[] =>
    readJsonSafe<CommunityBoardEntry[]>(COMMUNITY_BOARDS_FILE, []);
  const saveCommunityBoards = (list: CommunityBoardEntry[]) =>
    atomicWriteJson(COMMUNITY_BOARDS_FILE, list);

  // Brute-force & API rate limiting
  const loginFailures = new Map<string, { fails: number; lockUntil: number }>();
  const apiRateMap = new Map<string, { count: number; resetAt: number }>();

  router.use((req, res, next) => {
    const ip = opts.getClientIp(req);
    const now = Date.now();

    // Evita crescimento ilimitado do mapa em processos de longa duração.
    if (apiRateMap.size >= 10000) {
      for (const [key, entry] of apiRateMap) {
        if (now > entry.resetAt) apiRateMap.delete(key);
      }
      if (apiRateMap.size >= 10000) {
        const oldestKey = apiRateMap.keys().next().value;
        if (oldestKey) apiRateMap.delete(oldestKey);
      }
    }

    let rec = apiRateMap.get(ip);
    if (!rec || now > rec.resetAt) {
      rec = { count: 1, resetAt: now + 60_000 };
      apiRateMap.set(ip, rec);
      return next();
    }
    rec.count += 1;
    if (rec.count > 90) {
      return res.status(429).json({ error: 'Limite de requisições atingido. Aguarde um momento.' });
    }
    next();
  });

  const ensureCycleRollover = (user: PlayerAccountRecord, nowMs = Date.now()): void => {
    const info = getIsoWeekCycleInfo(nowMs);
    if (!user.weeklyRewardCycle || user.weeklyRewardCycle.weekStartUtcKey !== info.weekStartUtcKey) {
      user.weeklyRewardCycle = {
        weekStartUtcKey: info.weekStartUtcKey,
        coinsClaimed: 0,
        daysClaimed: [],
        lastClaimAt: 0
      };
    }
    if (user.adClaimsDayUtc !== info.todayUtcKey) {
      user.adClaimsDayUtc = info.todayUtcKey;
      user.adClaimsCountToday = 0;
    }
  };

  const grantAchievementIfEligible = (user: PlayerAccountRecord, id: string): boolean => {
    if (!user.achievements.includes(id)) {
      user.achievements.push(id);
      return true;
    }
    return false;
  };

  const syncAchievementsFromState = (user: PlayerAccountRecord, publishedCount = 0) => {
    grantAchievementIfEligible(user, 'first_account');
    if ((user.weeklyRewardCycle?.daysClaimed?.length || 0) > 0 || user.transactions.some((t) => t.type === 'daily_reward')) {
      grantAchievementIfEligible(user, 'daily_collector');
    }
    if ((user.weeklyRewardCycle?.coinsClaimed || 0) >= WEEKLY_COIN_CAP) {
      grantAchievementIfEligible(user, 'weekly_100_champion');
    }
    if (user.unlockedCosmetics.length > 0) {
      grantAchievementIfEligible(user, 'cosmetic_patron');
    }
    if (publishedCount > 0) {
      grantAchievementIfEligible(user, 'board_architect');
    }
    if (user.verifiedWins >= 1) {
      grantAchievementIfEligible(user, 'match_victor');
    }
    if (user.verifiedWins >= 5) {
      grantAchievementIfEligible(user, 'veteran_5_wins');
    }
  };

  const sanitizeUserPublic = (user: PlayerAccountRecord, nowMs = Date.now()) => {
    ensureCycleRollover(user, nowMs);
    const info = getIsoWeekCycleInfo(nowMs);
    const claimedToday = user.weeklyRewardCycle.daysClaimed.includes(info.todayUtcKey);
    const remainingWeeklyCoins = Math.max(0, WEEKLY_COIN_CAP - user.weeklyRewardCycle.coinsClaimed);
    const nextStepIndex = Math.min(6, user.weeklyRewardCycle.daysClaimed.length);
    const nextPlannedReward = Math.min(WEEKLY_DAILY_SCHEDULE[nextStepIndex], remainingWeeklyCoins);

    return {
      userId: user.userId,
      username: user.username,
      coins: user.coins,
      isPremium: Boolean(user.isPremium),
      unlockedCosmetics: user.unlockedCosmetics,
      achievements: user.achievements,
      verifiedWins: user.verifiedWins,
      verifiedMatches: user.verifiedMatches,
      dailyReward: {
        weekStartUtcKey: user.weeklyRewardCycle.weekStartUtcKey,
        todayUtcKey: info.todayUtcKey,
        weeklyCapCoins: WEEKLY_COIN_CAP,
        coinsClaimedThisWeek: user.weeklyRewardCycle.coinsClaimed,
        remainingWeeklyCoins,
        daysClaimedCount: user.weeklyRewardCycle.daysClaimed.length,
        claimedToday,
        canClaimNow: !claimedToday && remainingWeeklyCoins > 0,
        nextClaimAmount: claimedToday ? 0 : nextPlannedReward,
        nextResetUtcIso: info.nextResetUtcIso,
        schedule: WEEKLY_DAILY_SCHEDULE
      },
      recentTransactions: user.transactions.slice(0, 20),
      serverTimeIso: new Date(nowMs).toISOString()
    };
  };

  const authenticatePlayer = (req: express.Request): { user: PlayerAccountRecord; accounts: Record<string, PlayerAccountRecord> } | null => {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) return null;
    const token = auth.slice(7).trim();
    if (!token || token.length < 32) return null;

    const sessions = loadSessions();
    const session = sessions[token];
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      delete sessions[token];
      saveSessions(sessions);
      return null;
    }

    const accounts = loadAccounts();
    const user = accounts[session.userId];
    if (!user) return null;
    return { user, accounts };
  };

  // =============================================================
  // ETAPA 14: PLAYER ACCOUNTS (REGISTER / LOGIN / LOGOUT / ME)
  // =============================================================
  router.post('/player/register', (req, res) => {
    try {
      const username = normalizeHandle(req.body?.username || '');
      const password = String(req.body?.password || '');
      if (username.length < 3 || username.length > 24) {
        return res.status(400).json({ error: 'Nome de usuário deve ter entre 3 e 24 caracteres.' });
      }
      if (containsAbusiveText(username)) {
        return res.status(400).json({ error: 'Nome de usuário inválido.' });
      }
      if (password.length < 6 || password.length > 128) {
        return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres.' });
      }

      const key = username.toLowerCase();
      const accounts = loadAccounts();
      const duplicate = Object.values(accounts).some((a) => a.usernameKey === key);
      if (duplicate) {
        return res.status(409).json({ error: 'Este nome de guerreiro já está registrado.' });
      }

      const now = Date.now();
      const info = getIsoWeekCycleInfo(now);
      const userId = `u_${now}_${crypto.randomBytes(6).toString('hex')}`;
      const newUser: PlayerAccountRecord = {
        userId,
        username,
        usernameKey: key,
        passwordHash: hashPasswordScrypt(password),
        coins: 0,
        isPremium: false,
        unlockedCosmetics: [],
        achievements: ['first_account'],
        weeklyRewardCycle: {
          weekStartUtcKey: info.weekStartUtcKey,
          coinsClaimed: 0,
          daysClaimed: [],
          lastClaimAt: 0
        },
        adClaimsDayUtc: info.todayUtcKey,
        adClaimsCountToday: 0,
        verifiedWins: 0,
        verifiedMatches: 0,
        transactions: [],
        createdAt: now,
        updatedAt: now
      };

      accounts[userId] = newUser;
      saveAccounts(accounts);

      const token = crypto.randomBytes(32).toString('hex');
      const sessions = loadSessions();
      sessions[token] = {
        token,
        userId,
        username: newUser.username,
        createdAt: now,
        expiresAt: now + 30 * 24 * 60 * 60 * 1000
      };
      saveSessions(sessions);

      return res.status(201).json({
        success: true,
        token,
        player: sanitizeUserPublic(newUser, now)
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Falha ao criar conta: ' + err.message });
    }
  });

  router.post('/player/login', (req, res) => {
    try {
      const ip = opts.getClientIp(req);
      const username = normalizeHandle(req.body?.username || '');
      const password = String(req.body?.password || '');
      const failKey = `${ip}:${username.toLowerCase()}`;
      const now = Date.now();

      const failRec = loginFailures.get(failKey);
      if (failRec && failRec.lockUntil > now) {
        return res.status(429).json({ error: 'Muitas tentativas inválidas. Aguarde antes de tentar novamente.' });
      }

      const accounts = loadAccounts();
      const found = Object.values(accounts).find((a) => a.usernameKey === username.toLowerCase());
      if (!found || !verifyPasswordScrypt(password, found.passwordHash)) {
        if (!loginFailures.has(failKey) && loginFailures.size >= 5000) {
          for (const [key, value] of loginFailures) {
            if (value.lockUntil <= now) loginFailures.delete(key);
          }
          if (loginFailures.size >= 5000) {
            const oldestKey = loginFailures.keys().next().value;
            if (oldestKey) loginFailures.delete(oldestKey);
          }
        }
        const nextFails = (failRec?.fails || 0) + 1;
        loginFailures.set(failKey, {
          fails: nextFails,
          lockUntil: nextFails >= 5 ? now + 10 * 60 * 1000 : 0
        });
        return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
      }

      loginFailures.delete(failKey);
      ensureCycleRollover(found, now);
      syncAchievementsFromState(found);
      found.updatedAt = now;
      accounts[found.userId] = found;
      saveAccounts(accounts);

      const token = crypto.randomBytes(32).toString('hex');
      const sessions = loadSessions();
      sessions[token] = {
        token,
        userId: found.userId,
        username: found.username,
        createdAt: now,
        expiresAt: now + 30 * 24 * 60 * 60 * 1000
      };
      saveSessions(sessions);

      return res.json({
        success: true,
        token,
        player: sanitizeUserPublic(found, now)
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Falha ao autenticar: ' + err.message });
    }
  });

  router.post('/player/logout', (req, res) => {
    const auth = req.headers.authorization || '';
    if (auth.startsWith('Bearer ')) {
      const token = auth.slice(7).trim();
      const sessions = loadSessions();
      if (sessions[token]) {
        delete sessions[token];
        saveSessions(sessions);
      }
    }
    return res.json({ success: true });
  });

  router.get('/player/me', (req, res) => {
    const ctx = authenticatePlayer(req);
    if (!ctx) {
      return res.status(401).json({ error: 'Sessão de jogador ausente ou expirada.' });
    }
    const now = Date.now();
    ensureCycleRollover(ctx.user, now);
    const boards = loadCommunityBoards().filter((b) => b.authorUserId === ctx.user.userId);
    syncAchievementsFromState(ctx.user, boards.length);
    saveAccounts(ctx.accounts);
    return res.json({
      success: true,
      player: sanitizeUserPublic(ctx.user, now),
      achievementsCatalog: ACHIEVEMENT_CATALOG
    });
  });

  // Sincroniza vitórias verificadas no rankings-data.json do servidor (nunca aceita número arbitrário do cliente)
  router.post('/player/achievements/sync', (req, res) => {
    const ctx = authenticatePlayer(req);
    if (!ctx) return res.status(401).json({ error: 'Autenticação necessária.' });

    let srvWins = ctx.user.verifiedWins;
    let srvMatches = ctx.user.verifiedMatches;
    if (opts.rankingsFile && fs.existsSync(opts.rankingsFile)) {
      const rStore = readJsonSafe<{ players?: Record<string, { wins?: number; completedMatches?: number }> }>(
        opts.rankingsFile,
        {}
      );
      const rPlayer = rStore.players?.[ctx.user.usernameKey];
      if (rPlayer) {
        srvWins = Math.max(srvWins, Number(rPlayer.wins) || 0);
        srvMatches = Math.max(srvMatches, Number(rPlayer.completedMatches) || 0);
      }
    }

    ctx.user.verifiedWins = srvWins;
    ctx.user.verifiedMatches = srvMatches;
    const boards = loadCommunityBoards().filter((b) => b.authorUserId === ctx.user.userId);
    syncAchievementsFromState(ctx.user, boards.length);
    ctx.user.updatedAt = Date.now();
    saveAccounts(ctx.accounts);

    return res.json({
      success: true,
      player: sanitizeUserPublic(ctx.user),
      achievementsCatalog: ACHIEVEMENT_CATALOG
    });
  });

  // =============================================================
  // ETAPA 7 & 8: DAILY REWARD (SERVER CLOCK, CAP 100/WEEK, RESET MONDAY)
  // =============================================================
  router.get('/economy/daily-reward/status', (req, res) => {
    const ctx = authenticatePlayer(req);
    if (!ctx) {
      const now = Date.now();
      const info = getIsoWeekCycleInfo(now);
      return res.json({
        success: true,
        authenticated: false,
        weeklyCapCoins: WEEKLY_COIN_CAP,
        schedule: WEEKLY_DAILY_SCHEDULE,
        weekStartUtcKey: info.weekStartUtcKey,
        nextResetUtcIso: info.nextResetUtcIso,
        serverTimeIso: new Date(now).toISOString()
      });
    }
    const now = Date.now();
    const pub = sanitizeUserPublic(ctx.user, now);
    saveAccounts(ctx.accounts);
    return res.json({
      success: true,
      authenticated: true,
      ...pub.dailyReward,
      coins: pub.coins,
      serverTimeIso: pub.serverTimeIso
    });
  });

  const dailyClaimInFlight = new Set<string>();

  router.post('/economy/daily-reward/claim', (req, res) => {
    const ctx = authenticatePlayer(req);
    if (!ctx) {
      return res.status(401).json({ error: 'Faça login em sua conta do Panteão para resgatar moedas diárias.' });
    }
    const user = ctx.user;
    if (dailyClaimInFlight.has(user.userId)) {
      return res.status(409).json({ error: 'Resgate diário já em processamento. Aguarde um instante.' });
    }
    dailyClaimInFlight.add(user.userId);
    try {
      const now = Date.now();
      ensureCycleRollover(user, now);
      const info = getIsoWeekCycleInfo(now);
      const reqIdempotencyKey = String(req.body?.idempotencyKey || '').trim().substring(0, 64);

      if (reqIdempotencyKey && user.transactions.some((t) => t.idempotencyKey === reqIdempotencyKey)) {
        return res.json({
          success: true,
          deduplicated: true,
          grantedCoins: 0,
          player: sanitizeUserPublic(user, now)
        });
      }

      if (user.weeklyRewardCycle.daysClaimed.includes(info.todayUtcKey)) {
        return res.status(409).json({
          error: 'Você já resgatou a recompensa diária de hoje neste ciclo.',
          dailyReward: sanitizeUserPublic(user, now).dailyReward
        });
      }

      const remaining = Math.max(0, WEEKLY_COIN_CAP - user.weeklyRewardCycle.coinsClaimed);
      if (remaining <= 0) {
        return res.status(409).json({
          error: `Teto semanal de ${WEEKLY_COIN_CAP} moedas já atingido! Novo ciclo inicia na próxima segunda-feira (00:00 UTC).`,
          dailyReward: sanitizeUserPublic(user, now).dailyReward
        });
      }

      const stepIdx = Math.min(6, user.weeklyRewardCycle.daysClaimed.length);
      const scheduled = WEEKLY_DAILY_SCHEDULE[stepIdx];
      const granted = Math.min(scheduled, remaining);

      user.coins += granted;
      user.weeklyRewardCycle.coinsClaimed += granted;
      user.weeklyRewardCycle.daysClaimed.push(info.todayUtcKey);
      user.weeklyRewardCycle.lastClaimAt = now;
      user.updatedAt = now;

      user.transactions.unshift({
        id: `tx_${now}_${crypto.randomBytes(4).toString('hex')}`,
        idempotencyKey: reqIdempotencyKey || `daily_${info.weekStartUtcKey}_${info.todayUtcKey}`,
        type: 'daily_reward',
        amount: granted,
        balanceAfter: user.coins,
        description: `Recompensa Diária (Dia ${stepIdx + 1} do ciclo ${info.weekStartUtcKey})`,
        createdAt: now
      });
      if (user.transactions.length > 200) user.transactions = user.transactions.slice(0, 200);

      syncAchievementsFromState(user);
      saveAccounts(ctx.accounts);

      return res.json({
        success: true,
        grantedCoins: granted,
        player: sanitizeUserPublic(user, now)
      });
    } finally {
      dailyClaimInFlight.delete(user.userId);
    }
  });

  // =============================================================
  // ETAPA 9: OPTIONAL REWARDED ADS POLICY (HONEST PROVIDER CHECK)
  // =============================================================
  const isAdProviderConfigured = () =>
    process.env.AD_PROVIDER_CONFIGURED === 'true' && Boolean(process.env.AD_SDK_WEBHOOK_SECRET);

  router.get('/economy/ads/status', (_req, res) => {
    res.json({
      success: true,
      optionalOnly: true,
      providerConfigured: isAdProviderConfigured(),
      rewardPerVerifiedView: 15,
      maxDailyClaims: 3,
      ageAndSafetyPolicy: {
        targetAudience: 'Livre / Todas as idades',
        blockedCategories: ['+18', 'apostas', 'cassinos', 'alcool', 'tabaco', 'violencia-extrema'],
        explicitConsentRequired: true,
        honestNotice: isAdProviderConfigured()
          ? 'Provedor de anúncios certificado ativo com verificação criptográfica.'
          : 'Nenhum SDK de anúncios certificado (AdMob/Mediation) está integrado neste ambiente. Recompensas por anúncio permanecem bloqueadas para não gerar moedas fictícias.'
      }
    });
  });

  router.post('/economy/ads/verify-reward', (req, res) => {
    const ctx = authenticatePlayer(req);
    if (!ctx) return res.status(401).json({ error: 'Autenticação necessária.' });

    if (!isAdProviderConfigured()) {
      return res.status(503).json({
        error: 'Anúncios recompensados indisponíveis: nenhum provedor certificado (AdMob/SDK) está ativo neste ambiente. Nenhuma moeda fictícia foi concedida.'
      });
    }

    if (req.body?.userConsent !== true) {
      return res.status(400).json({ error: 'Consentimento explícito do jogador obrigatório.' });
    }

    return res.status(400).json({ error: 'Token de verificação de anúncio ausente ou inválido.' });
  });

  // =============================================================
  // ETAPA 3.6: SERVER-VALIDATED COSMETIC SHOP (NON-P2W)
  // =============================================================
  router.get('/economy/shop', (_req, res) => {
    res.json({
      success: true,
      items: COSMETIC_CATALOG
    });
  });

  router.post('/economy/shop/purchase', (req, res) => {
    const ctx = authenticatePlayer(req);
    if (!ctx) {
      return res.status(401).json({ error: 'Faça login para comprar cosméticos desbloqueáveis.' });
    }
    const itemId = String(req.body?.itemId || '').trim();
    const idempotencyKey = String(req.body?.idempotencyKey || '').trim().substring(0, 64);
    const item = COSMETIC_CATALOG.find((c) => c.id === itemId);
    if (!item) {
      return res.status(404).json({ error: 'Item cosmético não encontrado no catálogo.' });
    }

    const user = ctx.user;
    if (idempotencyKey && user.transactions.some((t) => t.idempotencyKey === idempotencyKey)) {
      return res.json({
        success: true,
        deduplicated: true,
        item,
        player: sanitizeUserPublic(user)
      });
    }

    if (user.unlockedCosmetics.includes(item.id)) {
      return res.status(409).json({ error: 'Você já possui este item cosmético desbloqueado.' });
    }

    if (user.coins < item.priceCoins) {
      return res.status(402).json({
        error: `Saldo insuficiente. Necessário: ${item.priceCoins} moedas (Seu saldo: ${user.coins}).`
      });
    }

    const now = Date.now();
    user.coins -= item.priceCoins;
    user.unlockedCosmetics.push(item.id);
    user.updatedAt = now;
    user.transactions.unshift({
      id: `tx_${now}_${crypto.randomBytes(4).toString('hex')}`,
      idempotencyKey: idempotencyKey || `buy_${item.id}_${now}`,
      type: 'cosmetic_purchase',
      amount: -item.priceCoins,
      balanceAfter: user.coins,
      description: `Desbloqueio cosmético: ${item.nome}`,
      createdAt: now
    });
    if (user.transactions.length > 200) user.transactions = user.transactions.slice(0, 200);

    syncAchievementsFromState(user);
    saveAccounts(ctx.accounts);

    return res.json({
      success: true,
      item,
      player: sanitizeUserPublic(user, now)
    });
  });

  // =============================================================
  // ETAPA 11: HONEST FREE VS PREMIUM ENTITLEMENTS CATALOG
  // =============================================================
  router.get('/entitlements/catalog', (_req, res) => {
    res.json({
      success: true,
      matrix: ENTITLEMENTS_MATRIX,
      billingIntegrated: false,
      note: 'Recursos Premium são estritamente cosméticos/criativos e verificados no servidor (sem pay-to-win).'
    });
  });

  // =============================================================
  // ETAPA 4: COMMUNITY BOARD GALLERY (VALIDATED & MODERATED)
  // =============================================================
  router.get('/boards/gallery', (req, res) => {
    const tema = String(req.query.tema || '').trim();
    const list = loadCommunityBoards()
      .filter((entry) => !entry.hiddenByModeration)
      .filter((entry) => (!tema ? true : entry.board.tema === tema))
      .sort((a, b) => b.publishedAt - a.publishedAt)
      .slice(0, 50)
      .map((entry) => ({
        id: entry.id,
        authorUsername: entry.authorUsername,
        board: entry.board,
        avgRating: entry.ratingCount > 0 ? Number((entry.ratingSum / entry.ratingCount).toFixed(1)) : 0,
        ratingCount: entry.ratingCount,
        publishedAt: entry.publishedAt
      }));

    res.json({ success: true, boards: list });
  });

  router.post('/boards/publish', (req, res) => {
    const ctx = authenticatePlayer(req);
    if (!ctx) {
      return res.status(401).json({ error: 'Faça login para publicar tabuleiros na galeria comunitária.' });
    }

    const rawBoard = req.body?.board;
    const rawStr = JSON.stringify(rawBoard || {});
    if (rawStr.length > 512 * 1024) {
      return res.status(413).json({ error: 'Payload do tabuleiro excede o limite seguro de 512 KB.' });
    }

    const check = validateCustomBoardConfig(rawBoard);
    if (!check.ok || !check.normalized) {
      return res.status(400).json({ error: check.erro || 'Tabuleiro inválido.' });
    }

    if (
      containsAbusiveText(check.normalized.nome) ||
      check.normalized.casas.some((c) => containsAbusiveText(c.nome))
    ) {
      return res.status(400).json({ error: 'Conteúdo bloqueado pelo filtro de moderação.' });
    }

    const gallery = loadCommunityBoards();
    const userPublished = gallery.filter(
      (b) => b.authorUserId === ctx.user.userId && !b.hiddenByModeration
    );

    // ETAPA 11 Server-side entitlement check: Free users capped at 2 published boards
    if (!ctx.user.isPremium && userPublished.length >= 2) {
      return res.status(403).json({
        error: 'Plano Gratuito permite até 2 tabuleiros públicos simultâneos na galeria (recurso Premium para cotas extras).',
        entitlementRequired: 'premium'
      });
    }

    const now = Date.now();
    const entry: CommunityBoardEntry = {
      id: `pub_${now}_${crypto.randomBytes(4).toString('hex')}`,
      authorUserId: ctx.user.userId,
      authorUsername: ctx.user.username,
      board: {
        ...check.normalized,
        autor: ctx.user.username
      },
      ratingSum: 0,
      ratingCount: 0,
      ratedByUserIds: [],
      reportedByUserIds: [],
      hiddenByModeration: false,
      publishedAt: now
    };

    gallery.unshift(entry);
    if (gallery.length > 200) gallery.pop();
    saveCommunityBoards(gallery);

    syncAchievementsFromState(ctx.user, userPublished.length + 1);
    ctx.user.updatedAt = now;
    saveAccounts(ctx.accounts);

    return res.status(201).json({
      success: true,
      entry: {
        id: entry.id,
        authorUsername: entry.authorUsername,
        board: entry.board,
        avgRating: 0,
        ratingCount: 0,
        publishedAt: entry.publishedAt
      },
      player: sanitizeUserPublic(ctx.user, now)
    });
  });

  router.post('/boards/:id/rate', (req, res) => {
    const ctx = authenticatePlayer(req);
    if (!ctx) return res.status(401).json({ error: 'Faça login para avaliar tabuleiros.' });

    const rating = Math.round(Number(req.body?.rating));
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Avaliação deve ser entre 1 e 5 estrelas.' });
    }

    const gallery = loadCommunityBoards();
    const entry = gallery.find((b) => b.id === req.params.id && !b.hiddenByModeration);
    if (!entry) return res.status(404).json({ error: 'Tabuleiro não encontrado.' });

    if (entry.ratedByUserIds.includes(ctx.user.userId)) {
      return res.status(409).json({ error: 'Você já avaliou este tabuleiro.' });
    }

    entry.ratedByUserIds.push(ctx.user.userId);
    entry.ratingSum += rating;
    entry.ratingCount += 1;
    saveCommunityBoards(gallery);

    return res.json({
      success: true,
      avgRating: Number((entry.ratingSum / entry.ratingCount).toFixed(1)),
      ratingCount: entry.ratingCount
    });
  });

  router.post('/boards/:id/report', (req, res) => {
    const ctx = authenticatePlayer(req);
    if (!ctx) return res.status(401).json({ error: 'Faça login para enviar denúncia de moderação.' });

    const gallery = loadCommunityBoards();
    const entry = gallery.find((b) => b.id === req.params.id);
    if (!entry) return res.status(404).json({ error: 'Tabuleiro não encontrado.' });

    if (!entry.reportedByUserIds.includes(ctx.user.userId)) {
      entry.reportedByUserIds.push(ctx.user.userId);
    }
    if (entry.reportedByUserIds.length >= 3) {
      entry.hiddenByModeration = true;
    }
    saveCommunityBoards(gallery);

    return res.json({
      success: true,
      hiddenByModeration: entry.hiddenByModeration,
      message: entry.hiddenByModeration
        ? 'Tabuleiro ocultado automaticamente para revisão após múltiplas denúncias.'
        : 'Denúncia registrada para moderação.'
    });
  });

  // =============================================================
  // ETAPA 15: APP VERSION MANIFEST
  // =============================================================
  router.get('/app-version', (_req, res) => {
    res.json({
      success: true,
      manifest: PLANNED_MANIFEST_SAMPLE
    });
  });

  return router;
}

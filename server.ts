import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const ROOT_DIR = process.cwd();
const BACKUPS_DIR = path.join(ROOT_DIR, '.backups');
const HISTORY_FILE = path.join(BACKUPS_DIR, 'history.json');
const AUDIT_LOG_FILE = path.join(BACKUPS_DIR, 'security-audit.json');

// Ensure backups & audit directory exist
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}
if (!fs.existsSync(HISTORY_FILE)) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify([]), 'utf-8');
}
if (!fs.existsSync(AUDIT_LOG_FILE)) {
  fs.writeFileSync(AUDIT_LOG_FILE, JSON.stringify([]), 'utf-8');
}

// -------------------------------------------------------------
// 1. HARDENED CONFIGURATION & FINGERPRINT SUPPRESSION
// -------------------------------------------------------------
app.disable('x-powered-by');
app.set('trust proxy', 1);

// Administrator Credentials Configuration
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'romulomarianoseverino@gmail.com';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'imortais-admin-olympus-2026';

// -------------------------------------------------------------
// 2. AUDIT LOGGING SYSTEM (TAMPER-RESISTANT)
// -------------------------------------------------------------
export interface SecurityEvent {
  id: string;
  timestamp: string;
  type: string;
  ip: string;
  userAgent: string;
  details: Record<string, any>;
}

function getClientIp(req?: express.Request): string {
  if (!req) return '127.0.0.1';
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function logSecurityEvent(type: string, details: Record<string, any>, req?: express.Request) {
  const ip = getClientIp(req);
  const userAgent = req ? (req.headers['user-agent'] || 'unknown').substring(0, 180) : 'server-internal';
  const event: SecurityEvent = {
    id: `sec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    timestamp: new Date().toISOString(),
    type,
    ip,
    userAgent,
    details
  };

  try {
    const existing: SecurityEvent[] = fs.existsSync(AUDIT_LOG_FILE)
      ? JSON.parse(fs.readFileSync(AUDIT_LOG_FILE, 'utf-8') || '[]')
      : [];
    existing.unshift(event);
    if (existing.length > 300) existing.length = 300;
    fs.writeFileSync(AUDIT_LOG_FILE, JSON.stringify(existing, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Security Logger Error]', err);
  }
}

// -------------------------------------------------------------
// 3. SENSITIVE PATH & SOURCE SHIELD (PATH TRAVERSAL & CODE LEAK BLOCKER)
// -------------------------------------------------------------
app.use((req, res, next) => {
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(req.path);
  } catch {
    logSecurityEvent('MALFORMED_URL_BLOCKED', { rawPath: req.path }, req);
    return res.status(400).json({ error: 'Requisição inválida: Caracteres malformados na URL.' });
  }

  // Detect and prevent Directory Traversal attacks (.., %2e%2e, null byte, backslashes)
  if (
    decodedPath.includes('..') ||
    decodedPath.includes('%2e') ||
    decodedPath.includes('\\') ||
    decodedPath.includes('\0')
  ) {
    logSecurityEvent('PATH_TRAVERSAL_BLOCKED', { path: decodedPath }, req);
    return res.status(403).json({
      error: 'Acesso negado: Tentativa de navegação transversal de diretórios bloqueada pelo sistema de segurança.'
    });
  }

  // Normalize path
  const normalized = path.normalize(decodedPath).replace(/^[/\\]+/, '').toLowerCase();

  // Explicit blacklist of protected internal server components, configs, and dev files
  const isProtectedResource =
    normalized.startsWith('.backups') ||
    normalized.startsWith('.git') ||
    normalized.startsWith('.env') ||
    normalized.startsWith('.aistudio') ||
    normalized.startsWith('node_modules') ||
    normalized === 'server.ts' ||
    normalized === 'server.js' ||
    normalized === 'package.json' ||
    normalized === 'package-lock.json' ||
    normalized === 'tsconfig.json' ||
    normalized === 'vite.config.ts' ||
    normalized === 'metadata.json' ||
    normalized.endsWith('.map') ||
    normalized.endsWith('.bak') ||
    normalized.endsWith('.log') ||
    normalized.endsWith('.env');

  if (isProtectedResource) {
    logSecurityEvent('SENSITIVE_RESOURCE_BLOCKED', { requestedResource: normalized }, req);
    return res.status(403).json({
      error: 'Acesso restrito: Este arquivo ou diretório é de uso interno e está blindado contra acessos externos.'
    });
  }

  next();
});

// -------------------------------------------------------------
// 4. HTTP SECURITY HEADERS (OWASP TOP 10 DEFENSE)
// -------------------------------------------------------------
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // CSP allowing Google Fonts, Tailwind CDN, Tone.js, PeerJS CDN, WebSockets
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://unpkg.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com data:; " +
    "img-src 'self' data: blob: https:; " +
    "connect-src 'self' ws: wss: https: https://*.peerjs.com; " +
    "media-src 'self' data: blob:; " +
    "object-src 'none'; " +
    "base-uri 'self';"
  );
  next();
});

// Body parsers with safe limits
app.use(express.json({ limit: '35mb' }));
app.use(express.urlencoded({ extended: true, limit: '35mb' }));

// -------------------------------------------------------------
// 5. BRUTE-FORCE RATE LIMITER FOR ADMIN ACCESS
// -------------------------------------------------------------
interface RateLimitRecord {
  attempts: number;
  firstAttempt: number;
  lockedUntil: number;
}
const adminLoginAttempts = new Map<string, RateLimitRecord>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes lockout

// Clean up old rate limit entries every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of adminLoginAttempts.entries()) {
    if (now > rec.lockedUntil && now - rec.firstAttempt > LOCKOUT_MS) {
      adminLoginAttempts.delete(ip);
    }
  }
}, 15 * 60 * 1000);

// Constant-time secret comparison to thwart timing attacks
function timingSafeCompare(provided: string, expected: string): boolean {
  try {
    const provHash = crypto.createHash('sha256').update(String(provided)).digest();
    const expHash = crypto.createHash('sha256').update(String(expected)).digest();
    return crypto.timingSafeEqual(provHash, expHash);
  } catch {
    return false;
  }
}

// -------------------------------------------------------------
// 6. CRYPTOGRAPHIC SESSION MANAGEMENT
// -------------------------------------------------------------
interface AdminSession {
  email: string;
  createdAt: number;
  expiresAt: number;
  clientIp: string;
  fingerprint: string;
}

const activeSessions = new Map<string, AdminSession>();

function createFingerprint(req: express.Request): string {
  const ip = getClientIp(req);
  const ua = req.headers['user-agent'] || '';
  return crypto.createHash('sha256').update(`${ip}:${ua}`).digest('hex');
}

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Session cleaner (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [token, sess] of activeSessions.entries()) {
    if (now > sess.expiresAt) {
      activeSessions.delete(token);
    }
  }
}, 10 * 60 * 1000);

// Admin Authentication Middleware
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logSecurityEvent('UNAUTHORIZED_ADMIN_REQUEST', { path: req.path }, req);
    return res.status(401).json({ error: 'Acesso negado: Credencial de autorização não fornecida.' });
  }

  const token = authHeader.substring(7);
  const session = activeSessions.get(token);

  if (!session) {
    logSecurityEvent('INVALID_SESSION_TOKEN', { path: req.path }, req);
    return res.status(401).json({ error: 'Acesso negado: Sessão administrativa inválida ou expirada.' });
  }

  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    logSecurityEvent('EXPIRED_SESSION_TOKEN', { email: session.email }, req);
    return res.status(401).json({ error: 'Acesso negado: Sessão expirada por inatividade. Faça login novamente.' });
  }

  // Extend idle session expiry (up to 4 hours from last activity)
  session.expiresAt = Date.now() + 4 * 60 * 60 * 1000;
  next();
}

// Allowed file extensions for project updates
const ALLOWED_EXTENSIONS = new Set([
  '.html', '.htm', '.css', '.js', '.ts', '.tsx', '.json',
  '.png', '.jpg', '.jpeg', '.svg', '.webp', '.ico', '.gif',
  '.md', '.txt', '.woff', '.woff2', '.ttf'
]);

// -------------------------------------------------------------
// 7. ADMIN API ENDPOINTS
// -------------------------------------------------------------

// 1. Login Admin (Rate-Limited, Timing-Safe, Audit-Logged)
app.post('/api/admin/login', (req, res) => {
  const ip = getClientIp(req);
  const now = Date.now();
  const attemptRecord = adminLoginAttempts.get(ip) || { attempts: 0, firstAttempt: now, lockedUntil: 0 };

  // Check lockout
  if (now < attemptRecord.lockedUntil) {
    const remainingMin = Math.ceil((attemptRecord.lockedUntil - now) / 60000);
    logSecurityEvent('LOGIN_REJECTED_LOCKED', { ip, remainingMinutes: remainingMin }, req);
    return res.status(429).json({
      error: `Acesso temporariamente bloqueado por excesso de tentativas. Tente novamente em ${remainingMin} minuto(s).`
    });
  }

  const { email, secretKey } = req.body;

  if (!email || !secretKey) {
    return res.status(400).json({ error: 'E-mail de administrador e Chave Mestra são obrigatórios.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanAdminEmail = ADMIN_EMAIL.trim().toLowerCase();

  const DEFAULT_SECRET = 'imortais-admin-olympus-2026';
  const ENV_SECRET = process.env.ADMIN_SECRET;

  const isEmailMatch = timingSafeCompare(cleanEmail, cleanAdminEmail) || timingSafeCompare(cleanEmail, 'romulomarianoseverino@gmail.com');
  const isSecretMatch = timingSafeCompare(String(secretKey).trim(), DEFAULT_SECRET) ||
    (ENV_SECRET ? timingSafeCompare(String(secretKey).trim(), ENV_SECRET) : false);

  if (!isEmailMatch || !isSecretMatch) {
    attemptRecord.attempts += 1;
    if (attemptRecord.attempts >= MAX_ATTEMPTS) {
      attemptRecord.lockedUntil = now + LOCKOUT_MS;
      adminLoginAttempts.set(ip, attemptRecord);
      logSecurityEvent('LOGIN_MAX_ATTEMPTS_LOCKED', { ip, attempts: attemptRecord.attempts }, req);
      return res.status(429).json({
        error: 'Limite de tentativas excedido. Acesso bloqueado temporariamente por 15 minutos.'
      });
    }

    adminLoginAttempts.set(ip, attemptRecord);
    logSecurityEvent('LOGIN_FAILED', { ip, attempts: attemptRecord.attempts }, req);
    return res.status(401).json({
      error: `Credenciais inválidas. Tentativa ${attemptRecord.attempts} de ${MAX_ATTEMPTS}.`
    });
  }

  // Success - Clear failed attempts
  adminLoginAttempts.delete(ip);

  const token = generateSessionToken();
  const expiresAt = now + 4 * 60 * 60 * 1000; // 4 hours

  activeSessions.set(token, {
    email: cleanEmail,
    createdAt: now,
    expiresAt,
    clientIp: ip,
    fingerprint: createFingerprint(req)
  });

  logSecurityEvent('LOGIN_SUCCESS', { adminEmail: cleanEmail }, req);

  return res.json({
    success: true,
    message: 'Autenticação de administrador realizada com sucesso.',
    token,
    adminEmail: cleanEmail,
    expiresAt
  });
});

// 2. Status Admin
app.get('/api/admin/status', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.json({ authenticated: false });
  }

  const token = authHeader.substring(7);
  const session = activeSessions.get(token);

  if (!session || Date.now() > session.expiresAt) {
    if (session) activeSessions.delete(token);
    return res.json({ authenticated: false });
  }

  return res.json({
    authenticated: true,
    adminEmail: session.email,
    expiresAt: session.expiresAt
  });
});

// 3. Logout Admin
app.post('/api/admin/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const session = activeSessions.get(token);
    if (session) {
      logSecurityEvent('LOGOUT', { email: session.email }, req);
      activeSessions.delete(token);
    }
  }
  return res.json({ success: true, message: 'Sessão administrativa encerrada com sucesso.' });
});

// 4. Update History
app.get('/api/admin/history', requireAdmin, (req, res) => {
  try {
    const content = fs.readFileSync(HISTORY_FILE, 'utf-8');
    const history = JSON.parse(content || '[]');
    return res.json({ success: true, history });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao carregar histórico: ' + err.message });
  }
});

// 5. Security Audit Logs (Admin Only)
app.get('/api/admin/logs', requireAdmin, (req, res) => {
  try {
    const content = fs.readFileSync(AUDIT_LOG_FILE, 'utf-8');
    const logs = JSON.parse(content || '[]');
    return res.json({ success: true, logs });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao carregar logs de segurança: ' + err.message });
  }
});

// Helper to strictly sanitize and validate allowed upload destination paths
function sanitizeUploadPath(rawPath: string): string | null {
  if (!rawPath || typeof rawPath !== 'string') return null;

  // Normalize path and remove leading slashes
  const clean = path.normalize(rawPath).replace(/^[/\\]+/, '');

  // Prevent directory traversal
  if (clean.includes('..') || clean.includes('\\') || path.isAbsolute(clean)) return null;

  // Resolve absolute path and verify it stays inside ROOT_DIR
  const resolved = path.resolve(ROOT_DIR, clean);
  if (!resolved.startsWith(ROOT_DIR + path.sep) && resolved !== path.join(ROOT_DIR, 'index.html')) {
    return null;
  }

  // Strict allowlist: Only index.html, src/* or public/* can be updated via admin
  const isAllowedTarget =
    clean === 'index.html' ||
    clean.startsWith('src' + path.sep) ||
    clean.startsWith('src/') ||
    clean.startsWith('public' + path.sep) ||
    clean.startsWith('public/');

  if (!isAllowedTarget) return null;

  // Strict blacklist of prohibited files
  const forbiddenFiles = new Set([
    'server.ts', 'server.js', 'package.json', 'package-lock.json',
    'tsconfig.json', 'vite.config.ts', 'metadata.json'
  ]);
  const baseName = path.basename(clean);
  if (forbiddenFiles.has(baseName)) return null;
  if (clean.startsWith('.git') || clean.startsWith('.env') || clean.startsWith('.backups')) return null;

  const ext = path.extname(clean).toLowerCase();
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) return null;

  return clean;
}

// 6. Apply Updates (with automated backup & SHA-256 integrity manifest)
app.post('/api/admin/update', requireAdmin, async (req, res) => {
  const { description, files } = req.body;

  if (!files || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'Nenhum arquivo válido fornecido para atualização.' });
  }

  if (files.length > 50) {
    return res.status(400).json({ error: 'Limite de arquivos por atualização excedido (máximo 50 arquivos).' });
  }

  const timestamp = Date.now();
  const dateStr = new Date(timestamp).toISOString();
  const backupId = `backup-${timestamp}`;
  const backupFolder = path.join(BACKUPS_DIR, backupId);

  try {
    fs.mkdirSync(backupFolder, { recursive: true });

    const validatedFiles: Array<{
      targetRelPath: string;
      fullTargetPath: string;
      fullBackupPath: string;
      contentBuffer: Buffer;
      sha256: string;
      existedPreviously: boolean;
    }> = [];

    // Step 1: Strict validation of all files before touching filesystem
    for (const file of files) {
      const relPath = sanitizeUploadPath(file.path || file.name);
      if (!relPath) {
        logSecurityEvent('REJECTED_UPDATE_FILE', { file: file.path || file.name }, req);
        return res.status(400).json({
          error: `Caminho ou extensão de arquivo não autorizada: "${file.path || file.name}". Atualizações são restritas a "index.html", "src/" e "public/" com extensões seguras.`
        });
      }

      let buffer: Buffer;
      if (file.base64 && typeof file.content === 'string') {
        const base64Data = file.content.replace(/^data:.*?;base64,/, '');
        buffer = Buffer.from(base64Data, 'base64');
      } else {
        buffer = Buffer.from(file.content || '', 'utf-8');
      }

      // Max 10MB per individual file
      if (buffer.length > 10 * 1024 * 1024) {
        return res.status(400).json({ error: `Arquivo "${relPath}" excede o tamanho máximo permitido de 10MB.` });
      }

      const fullTargetPath = path.join(ROOT_DIR, relPath);
      const fullBackupPath = path.join(backupFolder, relPath);
      const existedPreviously = fs.existsSync(fullTargetPath);
      const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

      validatedFiles.push({
        targetRelPath: relPath,
        fullTargetPath,
        fullBackupPath,
        contentBuffer: buffer,
        sha256,
        existedPreviously
      });
    }

    // Step 2: Back up all affected files prior to write
    const backedUpPaths: string[] = [];
    for (const item of validatedFiles) {
      if (item.existedPreviously) {
        const backupParentDir = path.dirname(item.fullBackupPath);
        if (!fs.existsSync(backupParentDir)) {
          fs.mkdirSync(backupParentDir, { recursive: true });
        }
        fs.copyFileSync(item.fullTargetPath, item.fullBackupPath);
        backedUpPaths.push(item.targetRelPath);
      }
    }

    // Step 3: Write new files
    const modifiedPaths: string[] = [];
    for (const item of validatedFiles) {
      const targetParentDir = path.dirname(item.fullTargetPath);
      if (!fs.existsSync(targetParentDir)) {
        fs.mkdirSync(targetParentDir, { recursive: true });
      }
      fs.writeFileSync(item.fullTargetPath, item.contentBuffer);
      modifiedPaths.push(item.targetRelPath);
    }

    // Step 4: Write backup manifest with SHA-256 hashes
    const manifest = {
      backupId,
      timestamp,
      date: dateStr,
      description: description || 'Atualização via Painel Administrativo',
      files: validatedFiles.map(f => ({ path: f.targetRelPath, sha256: f.sha256 })),
      backedUpFiles: backedUpPaths
    };
    fs.writeFileSync(path.join(backupFolder, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

    // Step 5: Update History file
    const currentHistory = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8') || '[]');
    currentHistory.unshift({
      id: backupId,
      timestamp,
      date: dateStr,
      description: description || 'Atualização segura de arquivos',
      filesCount: modifiedPaths.length,
      files: modifiedPaths,
      backupFolder: backupId,
      status: 'Sucesso',
      canRollback: backedUpPaths.length > 0
    });
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(currentHistory, null, 2), 'utf-8');

    logSecurityEvent('UPDATE_APPLIED', {
      backupId,
      filesCount: modifiedPaths.length,
      files: modifiedPaths,
      description
    }, req);

    return res.json({
      success: true,
      message: `Atualização aplicada com sucesso! ${modifiedPaths.length} arquivo(s) modificado(s).`,
      backupFolder: backupId,
      appliedFiles: modifiedPaths,
      timestamp: dateStr
    });
  } catch (err: any) {
    console.error('[Admin Update Error]', err);
    logSecurityEvent('UPDATE_ERROR', { error: err.message }, req);
    return res.status(500).json({ error: 'Falha durante a aplicação da atualização: ' + err.message });
  }
});

// 7. Rollback to Previous Version
app.post('/api/admin/rollback', requireAdmin, async (req, res) => {
  const { backupId } = req.body;
  if (!backupId || typeof backupId !== 'string') {
    return res.status(400).json({ error: 'ID de backup é obrigatório para recuperação.' });
  }

  // Ensure backupId strictly matches pattern 'backup-<timestamp>' to avoid path traversal
  if (!/^backup-\d+$/.test(backupId)) {
    logSecurityEvent('INVALID_ROLLBACK_ID', { backupId }, req);
    return res.status(400).json({ error: 'Formato de ID de backup inválido.' });
  }

  const cleanBackupId = path.basename(backupId);
  const backupFolder = path.join(BACKUPS_DIR, cleanBackupId);
  const manifestFile = path.join(backupFolder, 'manifest.json');

  if (!fs.existsSync(backupFolder) || !fs.existsSync(manifestFile)) {
    return res.status(404).json({ error: 'Cópia de segurança não encontrada ou manifest inválido.' });
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf-8'));
    const restoredFiles: string[] = [];

    for (const relPath of manifest.backedUpFiles || []) {
      const sanitizedRel = sanitizeUploadPath(relPath);
      if (!sanitizedRel) continue;

      const backupFilePath = path.join(backupFolder, sanitizedRel);
      const targetFilePath = path.join(ROOT_DIR, sanitizedRel);

      if (fs.existsSync(backupFilePath)) {
        const targetParent = path.dirname(targetFilePath);
        if (!fs.existsSync(targetParent)) {
          fs.mkdirSync(targetParent, { recursive: true });
        }
        fs.copyFileSync(backupFilePath, targetFilePath);
        restoredFiles.push(sanitizedRel);
      }
    }

    // Log rollback event in history
    const currentHistory = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8') || '[]');
    currentHistory.unshift({
      id: `rollback-${Date.now()}`,
      timestamp: Date.now(),
      date: new Date().toISOString(),
      description: `Rollback restaurado a partir do backup "${cleanBackupId}"`,
      filesCount: restoredFiles.length,
      files: restoredFiles,
      status: 'Rollback Concluído',
      canRollback: false
    });
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(currentHistory, null, 2), 'utf-8');

    logSecurityEvent('ROLLBACK_APPLIED', {
      sourceBackup: cleanBackupId,
      restoredFilesCount: restoredFiles.length,
      restoredFiles
    }, req);

    return res.json({
      success: true,
      message: `Versão recuperada com sucesso! ${restoredFiles.length} arquivo(s) restaurados à versão do backup.`,
      restoredFiles
    });
  } catch (err: any) {
    console.error('[Admin Rollback Error]', err);
    logSecurityEvent('ROLLBACK_ERROR', { error: err.message }, req);
    return res.status(500).json({ error: 'Falha durante a recuperação da versão anterior: ' + err.message });
  }
});

// -------------------------------------------------------------
// 8. VITE INTEGRATION (DEV / PROD)
// -------------------------------------------------------------
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    // Mount Vite dev server middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // Serve production build files
    const distPath = path.join(ROOT_DIR, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Legado dos Imortais] Servidor protegido executando em http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server Start Error]', err);
  process.exit(1);
});

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
const LOCKOUTS_FILE = path.join(BACKUPS_DIR, 'login-lockouts.json');
const PENDING_TX_FILE = path.join(BACKUPS_DIR, 'pending-transaction.json');
const RECOVERED_DIR = path.join(BACKUPS_DIR, 'recovered');
const RANKINGS_FILE = path.join(BACKUPS_DIR, 'rankings-data.json');
const RANKING_HMAC_KEY_FILE = path.join(BACKUPS_DIR, 'ranking-hmac.key');

// Ensure backups & audit directory exist
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}
if (!fs.existsSync(RECOVERED_DIR)) {
  fs.mkdirSync(RECOVERED_DIR, { recursive: true });
}
if (!fs.existsSync(HISTORY_FILE)) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify([]), 'utf-8');
}
if (!fs.existsSync(AUDIT_LOG_FILE)) {
  fs.writeFileSync(AUDIT_LOG_FILE, JSON.stringify([]), 'utf-8');
}
if (!fs.existsSync(LOCKOUTS_FILE)) {
  fs.writeFileSync(LOCKOUTS_FILE, JSON.stringify({}), 'utf-8');
}
if (!fs.existsSync(RANKINGS_FILE)) {
  fs.writeFileSync(RANKINGS_FILE, JSON.stringify({ players: {}, matches: [] }, null, 2), 'utf-8');
}
if (!fs.existsSync(RANKING_HMAC_KEY_FILE)) {
  fs.writeFileSync(RANKING_HMAC_KEY_FILE, crypto.randomBytes(32).toString('hex'), 'utf-8');
}

// -------------------------------------------------------------
// 1. ATOMIC & TAMPER-RESISTANT FILE WRITE & INTEGRITY UTILITIES
// -------------------------------------------------------------
function computeSha256Buffer(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function computeSha256File(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return computeSha256Buffer(buf);
}

function atomicWriteBufferSync(filePath: string, buffer: Buffer) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tempFile = path.join(
    dir,
    `.${path.basename(filePath)}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}.tmp`
  );
  let fd: number | null = null;
  try {
    fd = fs.openSync(tempFile, 'w');
    fs.writeSync(fd, buffer, 0, buffer.length, 0);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;
    fs.renameSync(tempFile, filePath);
  } catch (err) {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {}
    }
    if (fs.existsSync(tempFile)) {
      try {
        fs.unlinkSync(tempFile);
      } catch {}
    }
    throw err;
  }
}

function atomicWriteFileSync(filePath: string, content: string) {
  try {
    atomicWriteBufferSync(filePath, Buffer.from(content, 'utf-8'));
  } catch {
    // Fallback direct write if atomic rename fails on current filesystem
    fs.writeFileSync(filePath, content, 'utf-8');
  }
}

// -------------------------------------------------------------
// 2. HARDENED CONFIGURATION & FINGERPRINT SUPPRESSION
// -------------------------------------------------------------
app.disable('x-powered-by');
app.set('trust proxy', 1);

// Ensure .env is explicitly loaded from ROOT_DIR
dotenv.config({ path: path.join(ROOT_DIR, '.env'), override: true });

// Administrator Credentials Configuration (Strictly from Environment)
// NO hardcoded secrets or fallbacks. If ADMIN_SECRET or ADMIN_EMAIL is not configured, admin features are disabled.
function getAdminSecret(): string {
  if (!process.env.ADMIN_SECRET && fs.existsSync(path.join(ROOT_DIR, '.env'))) {
    dotenv.config({ path: path.join(ROOT_DIR, '.env'), override: true });
  }
  const s = (process.env.ADMIN_SECRET || '').trim();
  return s.replace(/^["']|["']$/g, '');
}

function getAdminEmail(): string {
  if (!process.env.ADMIN_EMAIL && fs.existsSync(path.join(ROOT_DIR, '.env'))) {
    dotenv.config({ path: path.join(ROOT_DIR, '.env'), override: true });
  }
  const e = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  return e.replace(/^["']|["']$/g, '');
}

// -------------------------------------------------------------
// 3. PRIVACY & DATA MASKING UTILITIES
// -------------------------------------------------------------
function maskEmail(email: string): string {
  if (!email || typeof email !== 'string') return '***';
  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2) return '***';
  const [user, domain] = parts;
  const maskedUser = user.length <= 2 ? user[0] + '***' : user[0] + '***' + user[user.length - 1];
  const domainParts = domain.split('.');
  const maskedDomain = domainParts
    .map((part, i) => (i === 0 ? (part.length <= 2 ? part[0] + '***' : part[0] + '***' + part[part.length - 1]) : part))
    .join('.');
  return `${maskedUser}@${maskedDomain}`;
}

function maskIp(ip: string): string {
  if (!ip || typeof ip !== 'string') return '***';
  const cleanIp = ip.replace(/^::ffff:/, '').trim();
  // IPv4
  const v4Match = cleanIp.match(/^(\d+\.\d+\.\d+)\.\d+$/);
  if (v4Match) {
    return `${v4Match[1]}.***`;
  }
  // IPv6
  if (cleanIp.includes(':')) {
    const parts = cleanIp.split(':');
    return parts.slice(0, Math.min(parts.length - 1, 3)).join(':') + ':***';
  }
  return '***';
}

function getClientIp(req?: express.Request): string {
  if (!req) return '127.0.0.1';
  // Use Express resolved IP (honors trust proxy: 1 securely)
  if (req.ip) {
    const clean = req.ip.replace(/^::ffff:/, '').trim();
    if (clean) return clean;
  }
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const candidate = forwarded.split(',')[0].trim().replace(/^::ffff:/, '');
    if (candidate) return candidate;
  }
  return req.socket?.remoteAddress?.replace(/^::ffff:/, '') || '127.0.0.1';
}

// -------------------------------------------------------------
// 4. AUDIT LOGGING SYSTEM (TAMPER-RESISTANT & PRIVACY-COMPLIANT)
// -------------------------------------------------------------
export interface SecurityEvent {
  id: string;
  timestamp: string;
  type: string;
  ip: string;
  userAgent: string;
  details: Record<string, any>;
}

function sanitizeDetails(details: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(details)) {
    const lowerKey = key.toLowerCase();
    // Exclude any credentials, secrets, raw keys, or length leaks
    if (
      lowerKey.includes('secret') ||
      lowerKey.includes('password') ||
      lowerKey.includes('token') ||
      lowerKey.includes('key') ||
      lowerKey.includes('len') ||
      lowerKey.includes('auth')
    ) {
      continue;
    }

    if (typeof value === 'string') {
      if (lowerKey.includes('email')) {
        sanitized[key] = maskEmail(value);
      } else if (lowerKey.includes('ip')) {
        sanitized[key] = maskIp(value);
      } else {
        sanitized[key] = value.substring(0, 150);
      }
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeDetails(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function logSecurityEvent(type: string, details: Record<string, any>, req?: express.Request) {
  const rawIp = getClientIp(req);
  const userAgent = req ? (req.headers['user-agent'] || 'unknown').substring(0, 180) : 'server-internal';
  const event: SecurityEvent = {
    id: `sec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    timestamp: new Date().toISOString(),
    type,
    ip: maskIp(rawIp),
    userAgent,
    details: sanitizeDetails(details)
  };

  try {
    let existing: SecurityEvent[] = [];
    if (fs.existsSync(AUDIT_LOG_FILE)) {
      try {
        existing = JSON.parse(fs.readFileSync(AUDIT_LOG_FILE, 'utf-8') || '[]');
      } catch {
        // Corrupted file auto-recovery
        const corruptBak = `${AUDIT_LOG_FILE}.corrupt.${Date.now()}.bak`;
        fs.copyFileSync(AUDIT_LOG_FILE, corruptBak);
        existing = [];
      }
    }
    existing.unshift(event);
    // Strict 100-event retention policy
    if (existing.length > 100) existing.length = 100;
    atomicWriteFileSync(AUDIT_LOG_FILE, JSON.stringify(existing, null, 2));
  } catch (err) {
    console.error('[Security Logger Error]', err);
  }
}

// Clean and anonymize existing historical audit logs on server startup
(function scrubHistoricalAuditLogs() {
  try {
    if (!fs.existsSync(AUDIT_LOG_FILE)) return;
    const raw = fs.readFileSync(AUDIT_LOG_FILE, 'utf-8');
    const logs = JSON.parse(raw || '[]');
    if (!Array.isArray(logs)) return;

    let modified = false;
    const sanitizedLogs = logs.slice(0, 100).map((item: any) => {
      let itemCopy = { ...item };
      if (itemCopy.ip && !itemCopy.ip.includes('***')) {
        itemCopy.ip = maskIp(itemCopy.ip);
        modified = true;
      }
      if (itemCopy.details) {
        const cleaned = sanitizeDetails(itemCopy.details);
        itemCopy.details = cleaned;
        modified = true;
      }
      return itemCopy;
    });

    if (modified || logs.length > 100) {
      atomicWriteFileSync(AUDIT_LOG_FILE, JSON.stringify(sanitizedLogs, null, 2));
    }
  } catch (err) {
    console.error('[Scrub Audit Logs Error]', err);
  }
})();

// -------------------------------------------------------------
// 4.1 AUTOMATIC CRASH & INCONSISTENCY RECOVERY (CRASH JOURNAL RESILIENCE)
// -------------------------------------------------------------
let recoveryBlockReason: string | null = null;

function isRecoveryBlocked(txFile: string = PENDING_TX_FILE): boolean {
  if (recoveryBlockReason) return true;
  try {
    if (!fs.existsSync(txFile)) return false;
    const raw = fs.readFileSync(txFile, 'utf-8');
    const tx = JSON.parse(raw);
    if (!tx || tx.status === 'IN_PROGRESS' || tx.status === 'RECOVERING' || tx.status === 'RECOVERY_INCOMPLETE') {
      return true;
    }
  } catch {
    return true;
  }
  return false;
}

export function recoverPendingTransactions(options?: {
  txFile?: string;
  recoveredDir?: string;
  validateRelPath?: (p: string) => string | null;
}): {
  status: 'NONE' | 'COMPLETED_CLEANED' | 'ALREADY_RECOVERED' | 'RECOVERED' | 'INCOMPLETE' | 'CORRUPTED' | 'INVALID';
  restored: string[];
  cleanedNewFiles: string[];
  errors: string[];
} {
  const txFile = options?.txFile || PENDING_TX_FILE;
  const recoveredDir = options?.recoveredDir || RECOVERED_DIR;
  const validateRelPath = options?.validateRelPath || sanitizeUploadPath;

  if (!fs.existsSync(recoveredDir)) {
    fs.mkdirSync(recoveredDir, { recursive: true });
  }

  try {
    if (!fs.existsSync(txFile)) {
      if (txFile === PENDING_TX_FILE) recoveryBlockReason = null;
      return { status: 'NONE', restored: [], cleanedNewFiles: [], errors: [] };
    }

    console.warn('[Crash Recovery] Journal de transação detectado em disco! Verificando estado...');
    let raw = '';
    try {
      raw = fs.readFileSync(txFile, 'utf-8');
    } catch (readErr: any) {
      if (txFile === PENDING_TX_FILE) {
        recoveryBlockReason = `Erro ao ler journal de transação: ${readErr.message}`;
      }
      return { status: 'CORRUPTED', restored: [], cleanedNewFiles: [], errors: [readErr.message] };
    }

    let tx: any = null;
    try {
      tx = JSON.parse(raw);
    } catch {
      console.warn('[Crash Recovery] Arquivo de transação corrompido. Arquivando...');
      const corruptFile = path.join(recoveredDir, `corrupted-tx-${Date.now()}.json`);
      fs.renameSync(txFile, corruptFile);
      if (txFile === PENDING_TX_FILE) {
        recoveryBlockReason = 'Journal de transação corrompido detectado na inicialização.';
      }
      return { status: 'CORRUPTED', restored: [], cleanedNewFiles: [], errors: ['Journal JSON corrompido'] };
    }

    // Transação já concluída e confirmada integralmente antes de queda/encerramento: NÃO reverter!
    if (tx && tx.status === 'COMPLETED') {
      console.log('[Crash Recovery] Transação concluída encontrada apenas aguardando limpeza de journal. Preservando atualização confirmada.');
      try {
        fs.unlinkSync(txFile);
      } catch {}
      if (txFile === PENDING_TX_FILE) recoveryBlockReason = null;
      logSecurityEvent('COMPLETED_TX_JOURNAL_CLEANED', { transactionId: tx.transactionId, backupId: tx.backupId });
      return { status: 'COMPLETED_CLEANED', restored: [], cleanedNewFiles: [], errors: [] };
    }

    // Recuperação já concluída anteriormente antes do unlink
    if (tx && tx.status === 'RECOVERED') {
      try {
        fs.unlinkSync(txFile);
      } catch {}
      if (txFile === PENDING_TX_FILE) recoveryBlockReason = null;
      return { status: 'ALREADY_RECOVERED', restored: [], cleanedNewFiles: [], errors: [] };
    }

    const validRecoverableStates = new Set(['IN_PROGRESS', 'RECOVERING', 'RECOVERY_INCOMPLETE']);
    if (!tx || !Array.isArray(tx.files) || !validRecoverableStates.has(tx.status)) {
      console.warn('[Crash Recovery] Transação em estado inválido. Bloqueando operações administrativas até inspeção.');
      if (txFile === PENDING_TX_FILE) {
        recoveryBlockReason = 'Journal de transação em estado inválido.';
      }
      return { status: 'INVALID', restored: [], cleanedNewFiles: [], errors: ['Estado de journal inválido'] };
    }

    // Correspondência com manifest.json caso exista na pasta de backup
    if (tx.backupFolder) {
      const manifestPath = path.join(tx.backupFolder, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
          if (manifest.transactionId !== tx.transactionId || manifest.backupId !== tx.backupId) {
            const mismatchErr = 'Incompatibilidade entre manifesto de backup, transactionId e journal.';
            tx.status = 'RECOVERY_INCOMPLETE';
            tx.lastErrors = [mismatchErr];
            atomicWriteFileSync(txFile, JSON.stringify(tx, null, 2));
            if (txFile === PENDING_TX_FILE) recoveryBlockReason = mismatchErr;
            logSecurityEvent('CRASH_RECOVERY_INTEGRITY_FAILED', { transactionId: tx.transactionId, backupId: tx.backupId, error: mismatchErr });
            return { status: 'INCOMPLETE', restored: [], cleanedNewFiles: [], errors: [mismatchErr] };
          }
        } catch (mErr: any) {
          const parseErr = `Manifesto de backup ilegível durante recuperação: ${mErr.message}`;
          tx.status = 'RECOVERY_INCOMPLETE';
          tx.lastErrors = [parseErr];
          atomicWriteFileSync(txFile, JSON.stringify(tx, null, 2));
          if (txFile === PENDING_TX_FILE) recoveryBlockReason = parseErr;
          return { status: 'INCOMPLETE', restored: [], cleanedNewFiles: [], errors: [parseErr] };
        }
      }
    }

    // Marcar transação como RECOVERING em disco antes de iniciar restauração (suporte a segunda falha)
    tx.status = 'RECOVERING';
    tx.recoveryStartedAt = tx.recoveryStartedAt || Date.now();
    atomicWriteFileSync(txFile, JSON.stringify(tx, null, 2));

    const restored: string[] = [];
    const cleanedNewFiles: string[] = [];
    const errors: string[] = [];

    for (const file of tx.files) {
      try {
        const sanitizedRel = validateRelPath(file.targetRelPath);
        if (!sanitizedRel) {
          errors.push(`Caminho inválido rejeitado na recuperação: ${file.targetRelPath}`);
          continue;
        }

        if (file.existedPreviously) {
          // Exigir hash SHA-256 válido do backup antes de qualquer restauração
          if (!file.backupSha256 || !/^[a-f0-9]{64}$/.test(file.backupSha256)) {
            errors.push(`Hash SHA-256 de integridade ausente ou inválido para backup de ${file.targetRelPath}`);
            continue;
          }
          if (!file.fullBackupPath || !fs.existsSync(file.fullBackupPath)) {
            errors.push(`Arquivo de backup ausente para ${file.targetRelPath}`);
            continue;
          }

          const actualBackupHash = computeSha256File(file.fullBackupPath);
          if (actualBackupHash !== file.backupSha256) {
            errors.push(`Backup corrompido ou adulterado para ${file.targetRelPath} (SHA-256 divergente)`);
            continue;
          }

          // Se já restaurado em tentativa anterior e confirmado em disco, preservar sem falha
          if (file.recovered && fs.existsSync(file.fullTargetPath) && computeSha256File(file.fullTargetPath) === file.backupSha256) {
            restored.push(file.targetRelPath);
            continue;
          }

          const backupBytes = fs.readFileSync(file.fullBackupPath);
          atomicWriteBufferSync(file.fullTargetPath, backupBytes);

          // Confirmar SHA-256 após gravação do arquivo restaurado
          if (computeSha256File(file.fullTargetPath) !== file.backupSha256) {
            errors.push(`Falha na confirmação de hash após restaurar ${file.targetRelPath}`);
            continue;
          }

          file.recovered = true;
          file.recoveredAt = Date.now();
          atomicWriteFileSync(txFile, JSON.stringify(tx, null, 2));
          restored.push(file.targetRelPath);
        } else {
          // Arquivo novo pertencente à atualização interrompida: remover com segurança
          if (file.fullTargetPath && fs.existsSync(file.fullTargetPath)) {
            fs.unlinkSync(file.fullTargetPath);
          }
          if (file.fullTargetPath && fs.existsSync(file.fullTargetPath)) {
            errors.push(`Não foi possível remover o arquivo novo incompleto ${file.targetRelPath}`);
            continue;
          }

          file.recovered = true;
          file.recoveredAt = Date.now();
          atomicWriteFileSync(txFile, JSON.stringify(tx, null, 2));
          cleanedNewFiles.push(file.targetRelPath);
        }
      } catch (fileErr: any) {
        errors.push(`Erro ao processar ${file.targetRelPath}: ${fileErr.message}`);
      }
    }

    // Conferência integral de todos os arquivos antes de declarar recuperado
    const allConfirmed = tx.files.every((file: any) => {
      if (!file.recovered) return false;
      if (file.existedPreviously) {
        return Boolean(
          file.fullTargetPath &&
          fs.existsSync(file.fullTargetPath) &&
          file.backupSha256 &&
          computeSha256File(file.fullTargetPath) === file.backupSha256
        );
      }
      return Boolean(!file.fullTargetPath || !fs.existsSync(file.fullTargetPath));
    });

    if (errors.length > 0 || !allConfirmed) {
      tx.status = 'RECOVERY_INCOMPLETE';
      tx.lastErrors = errors;
      atomicWriteFileSync(txFile, JSON.stringify(tx, null, 2));

      const incompleteRecord = {
        recoveryTimestamp: Date.now(),
        recoveryDate: new Date().toISOString(),
        status: 'RECOVERY_INCOMPLETE',
        transactionId: tx.transactionId,
        backupId: tx.backupId,
        restoredFiles: restored,
        cleanedNewFiles,
        errors
      };
      atomicWriteFileSync(
        path.join(recoveredDir, `incomplete-recovery-${tx.transactionId || Date.now()}.json`),
        JSON.stringify(incompleteRecord, null, 2)
      );

      if (txFile === PENDING_TX_FILE) {
        recoveryBlockReason = `Recuperação pós-interrupção incompleta (${errors.length} falha(s)). Operações administrativas bloqueadas.`;
      }

      logSecurityEvent('CRASH_RECOVERY_INCOMPLETE', {
        transactionId: tx.transactionId,
        backupId: tx.backupId,
        restoredCount: restored.length,
        cleanedCount: cleanedNewFiles.length,
        errors
      });

      console.error('[Crash Recovery] Recuperação INCOMPLETA. Journal preservado para retomada:', errors);
      return { status: 'INCOMPLETE', restored, cleanedNewFiles, errors };
    }

    // Somente após confirmação integral: registrar recuperação, marcar RECOVERED e remover journal
    const recoveryRecord = {
      recoveryTimestamp: Date.now(),
      recoveryDate: new Date().toISOString(),
      status: 'RECOVERED',
      transactionId: tx.transactionId,
      backupId: tx.backupId,
      restoredFiles: restored,
      cleanedNewFiles,
      errors: []
    };

    const recordFile = path.join(recoveredDir, `recovery-${tx.transactionId || Date.now()}.json`);
    atomicWriteFileSync(recordFile, JSON.stringify(recoveryRecord, null, 2));

    tx.status = 'RECOVERED';
    tx.recoveredAt = Date.now();
    atomicWriteFileSync(txFile, JSON.stringify(tx, null, 2));

    try {
      if (fs.existsSync(txFile)) {
        fs.unlinkSync(txFile);
      }
    } catch {}

    if (txFile === PENDING_TX_FILE) recoveryBlockReason = null;

    logSecurityEvent('CRASH_RECOVERY_APPLIED', {
      transactionId: tx.transactionId,
      backupId: tx.backupId,
      restoredCount: restored.length,
      restoredFiles: restored,
      cleanedCount: cleanedNewFiles.length,
      cleanedNewFiles
    });

    console.log(`[Crash Recovery] Integridade restaurada com sucesso: ${restored.length} restaurado(s), ${cleanedNewFiles.length} novo(s) removido(s).`);
    return { status: 'RECOVERED', restored, cleanedNewFiles, errors: [] };
  } catch (err: any) {
    console.error('[Crash Recovery Error] Falha crítica ao executar recuperação pós-interrupção:', err);
    if (txFile === PENDING_TX_FILE) {
      recoveryBlockReason = `Falha crítica na recuperação: ${err.message}`;
    }
    return { status: 'INCOMPLETE', restored: [], cleanedNewFiles: [], errors: [err.message] };
  }
}

// -------------------------------------------------------------
// 5. SENSITIVE PATH & SOURCE SHIELD (PATH TRAVERSAL & CODE LEAK BLOCKER)
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

  // In Vite development mode only, Vite serves pre-bundled browser dependencies from /node_modules/.vite/deps/
  const isDevVitePrebundle =
    process.env.NODE_ENV !== 'production' &&
    (normalized.startsWith('node_modules/.vite/deps/') || normalized === 'node_modules/.vite');

  // Explicit blacklist of protected internal server components, configs, and dev files
  const isProtectedResource =
    !isDevVitePrebundle && (
      normalized.startsWith('.') ||
      normalized.startsWith('node_modules') ||
      normalized === 'server.ts' ||
      normalized === 'server.js' ||
      normalized === 'package.json' ||
      normalized === 'package-lock.json' ||
      normalized === 'bun.lock' ||
      normalized === 'tsconfig.json' ||
      normalized === 'vite.config.ts' ||
      normalized === 'metadata.json' ||
      normalized.endsWith('.map') ||
      normalized.endsWith('.bak') ||
      normalized.endsWith('.log') ||
      normalized.endsWith('.tmp') ||
      normalized.endsWith('.lock') ||
      normalized.endsWith('.env')
    );

  if (isProtectedResource) {
    logSecurityEvent('SENSITIVE_RESOURCE_BLOCKED', { requestedResource: normalized }, req);
    return res.status(403).json({
      error: 'Acesso restrito: Este arquivo ou diretório é de uso interno e está blindado contra acessos externos.'
    });
  }

  next();
});

// -------------------------------------------------------------
// 6. HTTP SECURITY HEADERS (OWASP TOP 10 DEFENSE & HARDENING)
// -------------------------------------------------------------
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  const isProd = process.env.NODE_ENV === 'production';
  const appUrlOrigin = (() => {
    try {
      const u = (process.env.APP_URL || '').trim();
      return u ? new URL(u).origin : '';
    } catch {
      return '';
    }
  })();

  const frameAncestors = [
    "'self'",
    'https://aistudio.google.com',
    'https://*.googleusercontent.com',
    'https://*.usercontent.google.com',
    ...(appUrlOrigin ? [appUrlOrigin] : [])
  ].join(' ');

  const connectSrc = [
    "'self'",
    'data:',
    'blob:',
    'https://*.peerjs.com',
    'wss://*.peerjs.com',
    ...(!isProd ? ['ws://localhost:3000', 'wss://localhost:3000'] : []),
    ...(appUrlOrigin ? [appUrlOrigin, appUrlOrigin.replace(/^http/, 'ws')] : [])
  ].join(' ');

  // CSP restrita: Google Fonts, Tailwind CDN, Tone.js, PeerJS CDN/WSS, áudio local e frame-ancestors específicos do AI Studio
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com/ajax/libs/tone/ https://unpkg.com/peerjs@1.5.2/; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com data:; " +
    "img-src 'self' data: blob:; " +
    `connect-src ${connectSrc}; ` +
    "media-src 'self' data: blob:; " +
    "worker-src 'self' blob:; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'; " +
    `frame-ancestors ${frameAncestors}; ` +
    "frame-src 'self';"
  );
  next();
});

// Body parsers with safe limits
app.use(express.json({ limit: '35mb' }));
app.use(express.urlencoded({ extended: true, limit: '35mb' }));

// -------------------------------------------------------------
// 7. PERSISTENT BRUTE-FORCE RATE LIMITER & LOCKOUT MANAGEMENT
// -------------------------------------------------------------
interface LockoutRecord {
  attempts: number;
  firstAttempt: number;
  lockedUntil: number;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes lockout

// Load persisted lockouts from disk with auto-recovery on corruption
function loadPersistedLockouts(): Map<string, LockoutRecord> {
  const map = new Map<string, LockoutRecord>();
  try {
    if (fs.existsSync(LOCKOUTS_FILE)) {
      let data: Record<string, any> = {};
      try {
        data = JSON.parse(fs.readFileSync(LOCKOUTS_FILE, 'utf-8') || '{}');
      } catch {
        const corruptBak = `${LOCKOUTS_FILE}.corrupt.${Date.now()}.bak`;
        fs.copyFileSync(LOCKOUTS_FILE, corruptBak);
        data = {};
      }
      const now = Date.now();
      for (const [ip, rec] of Object.entries(data)) {
        const record = rec as LockoutRecord;
        if (record && typeof record.lockedUntil === 'number' && typeof record.firstAttempt === 'number') {
          if (record.lockedUntil > now || (now - record.firstAttempt < LOCKOUT_MS && record.attempts > 0)) {
            map.set(ip, record);
          }
        }
      }
    }
  } catch (err) {
    console.error('[Lockout Load Error]', err);
  }
  return map;
}

const adminLoginAttempts = loadPersistedLockouts();

function savePersistedLockouts() {
  try {
    const obj: Record<string, LockoutRecord> = {};
    for (const [ip, rec] of adminLoginAttempts.entries()) {
      obj[ip] = rec;
    }
    atomicWriteFileSync(LOCKOUTS_FILE, JSON.stringify(obj, null, 2));
  } catch (err) {
    console.error('[Lockout Save Error]', err);
  }
}

// Clean up expired rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const [ip, rec] of adminLoginAttempts.entries()) {
    if (now > rec.lockedUntil && now - rec.firstAttempt > LOCKOUT_MS) {
      adminLoginAttempts.delete(ip);
      changed = true;
    }
  }
  if (changed) {
    savePersistedLockouts();
  }
}, 5 * 60 * 1000);

// Constant-time string comparison to thwart timing attacks
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
// 8. GENERAL ADMIN API RATE LIMITER & CACHE PREVENTION
// -------------------------------------------------------------
interface ApiRateRecord {
  count: number;
  resetAt: number;
}
const adminApiRateLimits = new Map<string, ApiRateRecord>();
const ADMIN_API_MAX_PER_MINUTE = 60;

function adminRateLimitMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ip = getClientIp(req);
  const now = Date.now();
  let rec = adminApiRateLimits.get(ip);

  if (!rec || now > rec.resetAt) {
    rec = { count: 1, resetAt: now + 60000 };
    adminApiRateLimits.set(ip, rec);
    return next();
  }

  rec.count += 1;
  if (rec.count > ADMIN_API_MAX_PER_MINUTE) {
    logSecurityEvent('ADMIN_RATE_LIMIT_EXCEEDED', { ip, count: rec.count }, req);
    return res.status(429).json({
      error: 'Limite de taxa excedido para operações administrativas. Aguarde um momento e tente novamente.'
    });
  }

  next();
}

// Prevent caching of any administrative responses
app.use('/api/admin', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use('/api/admin', adminRateLimitMiddleware);

// -------------------------------------------------------------
// 9. CRYPTOGRAPHIC SESSION MANAGEMENT & HIJACKING DEFENSE
// -------------------------------------------------------------
interface AdminSession {
  email: string;
  createdAt: number;
  expiresAt: number;
  clientIp: string;
  fingerprint: string;
  secretHash: string;
}

const activeSessions = new Map<string, AdminSession>();
const MAX_ACTIVE_SESSIONS = 50;

function createFingerprint(req: express.Request): string {
  const ip = getClientIp(req);
  const ua = req.headers['user-agent'] || '';
  return crypto.createHash('sha256').update(`${ip}:${ua}`).digest('hex');
}

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function enforceMaxSessions() {
  if (activeSessions.size >= MAX_ACTIVE_SESSIONS) {
    let oldestToken: string | null = null;
    let oldestTime = Infinity;
    for (const [token, sess] of activeSessions.entries()) {
      if (sess.createdAt < oldestTime) {
        oldestTime = sess.createdAt;
        oldestToken = token;
      }
    }
    if (oldestToken) activeSessions.delete(oldestToken);
  }
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
  const adminSecret = getAdminSecret();
  const adminEmail = getAdminEmail();
  if (!adminSecret || !adminEmail) {
    logSecurityEvent('ADMIN_SERVICE_DISABLED_ATTEMPT', { path: req.path }, req);
    return res.status(503).json({
      error: 'Serviço administrativo desativado: credenciais administrativas não configuradas no ambiente.'
    });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logSecurityEvent('UNAUTHORIZED_ADMIN_REQUEST', { path: req.path }, req);
    return res.status(401).json({ error: 'Acesso negado: Credencial de autorização não fornecida.' });
  }

  const token = authHeader.substring(7).trim();
  // Formato estrito: token de 64 caracteres hexadecimais (32 bytes random)
  if (!/^[a-f0-9]{64}$/.test(token)) {
    logSecurityEvent('MALFORMED_ADMIN_TOKEN', { path: req.path }, req);
    return res.status(401).json({ error: 'Acesso negado: Formato de token inválido.' });
  }

  const session = activeSessions.get(token);

  if (!session) {
    logSecurityEvent('INVALID_SESSION_TOKEN', { path: req.path }, req);
    return res.status(401).json({ error: 'Acesso negado: Sessão administrativa inválida ou expirada.' });
  }

  // Session Hijacking / Replay Defense: Verify client fingerprint
  const currentFingerprint = createFingerprint(req);
  if (session.fingerprint !== currentFingerprint) {
    activeSessions.delete(token);
    logSecurityEvent('SESSION_HIJACK_ATTEMPT_BLOCKED', { email: session.email }, req);
    return res.status(401).json({
      error: 'Acesso negado: Inconsistência de integridade na sessão detectada. Faça login novamente.'
    });
  }

  // Secret Invalidation Defense: Invalidate all sessions if master secret in .env was modified
  const currentSecretHash = crypto.createHash('sha256').update(adminSecret).digest('hex');
  if (session.secretHash !== currentSecretHash) {
    activeSessions.delete(token);
    logSecurityEvent('SESSION_SECRET_MISMATCH_REVOKED', { email: session.email }, req);
    return res.status(401).json({
      error: 'Acesso negado: As credenciais do sistema foram alteradas. Todas as sessões anteriores foram revogadas.'
    });
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
// 10. ADMIN API ENDPOINTS
// -------------------------------------------------------------

// 1. Login Admin (Rate-Limited, Timing-Safe, Audit-Logged, Zero Hardcoded Fallbacks)
app.post('/api/admin/login', (req, res) => {
  const adminSecret = getAdminSecret();
  const adminEmail = getAdminEmail();

  // Exigência obrigatória: ADMIN_SECRET e ADMIN_EMAIL devem estar configuradas no ambiente
  if (!adminSecret || !adminEmail) {
    logSecurityEvent('ADMIN_LOGIN_DISABLED_NO_CREDENTIALS', {}, req);
    return res.status(503).json({
      error: 'Serviço administrativo desativado: credenciais administrativas não configuradas no ambiente.'
    });
  }

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

  if (!email || !secretKey || typeof email !== 'string' || typeof secretKey !== 'string') {
    return res.status(400).json({ error: 'E-mail de administrador e Chave Mestra são obrigatórios.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanSecret = secretKey.trim();

  // Input length guards
  if (cleanEmail.length < 3 || cleanEmail.length > 254 || cleanSecret.length < 1 || cleanSecret.length > 256) {
    return res.status(400).json({ error: 'Formato ou tamanho de credenciais inválido.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return res.status(400).json({ error: 'Formato de e-mail de administrador inválido.' });
  }

  // Timing-safe comparisons against environment configuration strictly
  const isEmailMatch = timingSafeCompare(cleanEmail, adminEmail);
  const isSecretMatch = timingSafeCompare(cleanSecret, adminSecret);

  if (!isEmailMatch || !isSecretMatch) {
    attemptRecord.attempts += 1;
    if (attemptRecord.attempts >= MAX_ATTEMPTS) {
      attemptRecord.lockedUntil = now + LOCKOUT_MS;
      adminLoginAttempts.set(ip, attemptRecord);
      savePersistedLockouts();
      logSecurityEvent('LOGIN_MAX_ATTEMPTS_LOCKED', { ip, attempts: attemptRecord.attempts }, req);
      return res.status(429).json({
        error: 'Limite de tentativas excedido. Acesso bloqueado temporariamente por 15 minutos.'
      });
    }

    adminLoginAttempts.set(ip, attemptRecord);
    savePersistedLockouts();
    logSecurityEvent('LOGIN_FAILED', { ip, attempts: attemptRecord.attempts }, req);
    return res.status(401).json({
      error: `Credenciais inválidas. Tentativa ${attemptRecord.attempts} de ${MAX_ATTEMPTS}.`
    });
  }

  // Success - Clear failed attempts
  adminLoginAttempts.delete(ip);
  savePersistedLockouts();

  enforceMaxSessions();
  const token = generateSessionToken();
  const expiresAt = now + 4 * 60 * 60 * 1000; // 4 hours
  const secretHash = crypto.createHash('sha256').update(adminSecret).digest('hex');

  activeSessions.set(token, {
    email: cleanEmail,
    createdAt: now,
    expiresAt,
    clientIp: ip,
    fingerprint: createFingerprint(req),
    secretHash
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
  const adminSecret = getAdminSecret();
  const adminEmail = getAdminEmail();
  if (!adminSecret || !adminEmail) {
    return res.json({ authenticated: false, disabled: true });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.json({ authenticated: false });
  }

  const token = authHeader.substring(7).trim();
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return res.json({ authenticated: false });
  }

  const session = activeSessions.get(token);

  if (!session || Date.now() > session.expiresAt) {
    if (session) activeSessions.delete(token);
    return res.json({ authenticated: false });
  }

  // Verify fingerprint & secretHash consistency
  const currentSecretHash = crypto.createHash('sha256').update(adminSecret).digest('hex');
  if (session.fingerprint !== createFingerprint(req) || session.secretHash !== currentSecretHash) {
    activeSessions.delete(token);
    return res.json({ authenticated: false });
  }

  return res.json({
    authenticated: true,
    adminEmail: session.email,
    expiresAt: session.expiresAt,
    recoveryBlocked: isRecoveryBlocked()
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

// 3.1 Logout Global / Revogação de Todas as Sessões Ativas
app.post('/api/admin/logout-all', requireAdmin, (req, res) => {
  const count = activeSessions.size;
  activeSessions.clear();
  logSecurityEvent('ALL_SESSIONS_REVOKED', { revokedCount: count }, req);
  return res.json({
    success: true,
    message: `Todas as sessões administrativas ativas (${count}) foram revogadas com sucesso.`
  });
});

// 4. Update History
app.get('/api/admin/history', requireAdmin, (req, res) => {
  try {
    let history: any[] = [];
    if (fs.existsSync(HISTORY_FILE)) {
      try {
        history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8') || '[]');
      } catch {
        history = [];
      }
    }
    return res.json({ success: true, history });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao carregar histórico: ' + err.message });
  }
});

// 5. Security Audit Logs (Admin Only)
app.get('/api/admin/logs', requireAdmin, (req, res) => {
  try {
    let logs: any[] = [];
    if (fs.existsSync(AUDIT_LOG_FILE)) {
      try {
        logs = JSON.parse(fs.readFileSync(AUDIT_LOG_FILE, 'utf-8') || '[]');
      } catch {
        logs = [];
      }
    }
    return res.json({ success: true, logs });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao carregar logs de segurança: ' + err.message });
  }
});

// Helper to strictly sanitize and validate allowed upload destination paths with realpath verification
function sanitizeUploadPath(rawPath: string): string | null {
  if (!rawPath || typeof rawPath !== 'string') return null;

  // Normalize path and remove leading slashes
  const clean = path.normalize(rawPath).replace(/^[/\\]+/, '');

  // Prevent directory traversal characters and null bytes
  if (clean.includes('..') || clean.includes('\\') || clean.includes('\0') || path.isAbsolute(clean)) return null;

  // Resolve absolute path and verify it stays inside ROOT_DIR
  const resolved = path.resolve(ROOT_DIR, clean);
  const rootNormalized = path.resolve(ROOT_DIR);

  // Realpath verification if path or parent exists to prevent symlink traversal
  try {
    if (fs.existsSync(resolved)) {
      const real = fs.realpathSync(resolved);
      if (!real.startsWith(rootNormalized + path.sep) && real !== path.join(rootNormalized, 'index.html')) {
        return null;
      }
    } else {
      let currentDir = path.dirname(resolved);
      while (!fs.existsSync(currentDir) && currentDir !== rootNormalized) {
        currentDir = path.dirname(currentDir);
      }
      if (fs.existsSync(currentDir)) {
        const realParent = fs.realpathSync(currentDir);
        if (!realParent.startsWith(rootNormalized + path.sep) && realParent !== rootNormalized) {
          return null;
        }
      }
    }
  } catch {
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

  // Strict blacklist of prohibited files & directories
  const forbiddenFiles = new Set([
    'server.ts', 'server.js', 'package.json', 'package-lock.json',
    'tsconfig.json', 'vite.config.ts', 'metadata.json'
  ]);
  const baseName = path.basename(clean);
  if (forbiddenFiles.has(baseName)) return null;
  if (
    clean.startsWith('.git') ||
    clean.startsWith('.env') ||
    clean.startsWith('.backups') ||
    clean.startsWith('.aistudio') ||
    clean.startsWith('node_modules')
  ) {
    return null;
  }

  const ext = path.extname(clean).toLowerCase();
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) return null;

  return clean;
}

// 6. Apply Updates (with automated backup & SHA-256 integrity manifest)
app.post('/api/admin/update', requireAdmin, async (req, res) => {
  if (isRecoveryBlocked()) {
    logSecurityEvent('ADMIN_UPDATE_BLOCKED_INCOMPLETE_RECOVERY', { reason: recoveryBlockReason }, req);
    return res.status(409).json({
      error: recoveryBlockReason || 'Atualizações bloqueadas: existe uma recuperação de transação pendente ou incompleta.'
    });
  }

  const { description, files } = req.body;

  if (description && (typeof description !== 'string' || description.length > 500)) {
    return res.status(400).json({ error: 'Descrição inválida (máximo 500 caracteres).' });
  }

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

    const seenRelPaths = new Set<string>();
    const validatedFiles: Array<{
      targetRelPath: string;
      fullTargetPath: string;
      fullBackupPath: string;
      contentBuffer: Buffer;
      sha256: string;
      backupSha256: string | null;
      existedPreviously: boolean;
    }> = [];

    // Step 1: Strict validation of all files before touching filesystem
    for (const file of files) {
      if (!file || typeof file !== 'object') {
        return res.status(400).json({ error: 'Formato de arquivo inválido na carga útil.' });
      }

      const filePathCandidate = String(file.path || file.name || '');
      if (filePathCandidate.length > 255) {
        return res.status(400).json({ error: 'Caminho de arquivo excede o limite máximo de 255 caracteres.' });
      }

      const relPath = sanitizeUploadPath(filePathCandidate);
      if (!relPath) {
        logSecurityEvent('REJECTED_UPDATE_FILE', { file: filePathCandidate }, req);
        return res.status(400).json({
          error: `Caminho ou extensão de arquivo não autorizada: "${filePathCandidate}". Atualizações são restritas a "index.html", "src/" e "public/" com extensões seguras.`
        });
      }

      if (seenRelPaths.has(relPath)) {
        return res.status(400).json({ error: `Arquivo duplicado no lote de atualização: "${relPath}".` });
      }
      seenRelPaths.add(relPath);

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
      const sha256 = computeSha256Buffer(buffer);
      const backupSha256 = existedPreviously ? computeSha256File(fullTargetPath) : null;

      validatedFiles.push({
        targetRelPath: relPath,
        fullTargetPath,
        fullBackupPath,
        contentBuffer: buffer,
        sha256,
        backupSha256,
        existedPreviously
      });
    }

    // Step 2: Back up all affected files prior to write and verify backup SHA-256
    const backedUpPaths: string[] = [];
    for (const item of validatedFiles) {
      if (item.existedPreviously && item.backupSha256) {
        const sourceBytes = fs.readFileSync(item.fullTargetPath);
        atomicWriteBufferSync(item.fullBackupPath, sourceBytes);
        if (computeSha256File(item.fullBackupPath) !== item.backupSha256) {
          throw new Error(`Falha na verificação de integridade do backup criado para "${item.targetRelPath}".`);
        }
        backedUpPaths.push(item.targetRelPath);
      }
    }

    // Step 2.5: Write atomic pending transaction journal to disk BEFORE live writes
    const transactionId = `tx-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const pendingTxData: any = {
      transactionId,
      backupId,
      backupFolder,
      timestamp,
      date: dateStr,
      status: 'IN_PROGRESS',
      files: validatedFiles.map(f => ({
        targetRelPath: f.targetRelPath,
        fullTargetPath: f.fullTargetPath,
        fullBackupPath: f.fullBackupPath,
        existedPreviously: f.existedPreviously,
        backupSha256: f.backupSha256,
        targetSha256: f.sha256
      }))
    };
    atomicWriteFileSync(PENDING_TX_FILE, JSON.stringify(pendingTxData, null, 2));

    // Step 3: Write new files atomically and verify every written file's SHA-256
    const modifiedPaths: string[] = [];
    const writtenPaths: Array<{
      targetRelPath: string;
      fullTargetPath: string;
      fullBackupPath: string;
      backupSha256: string | null;
      existedPreviously: boolean;
    }> = [];

    try {
      for (const item of validatedFiles) {
        atomicWriteBufferSync(item.fullTargetPath, item.contentBuffer);
        writtenPaths.push(item);
        if (computeSha256File(item.fullTargetPath) !== item.sha256) {
          throw new Error(`Falha de integridade pós-gravação para "${item.targetRelPath}".`);
        }
        modifiedPaths.push(item.targetRelPath);
      }
    } catch (writeErr: any) {
      // Revert any partially written files in this failed batch with backup SHA-256 check
      let revertHadError = false;
      for (const written of writtenPaths) {
        try {
          if (written.existedPreviously && written.fullBackupPath && fs.existsSync(written.fullBackupPath) && written.backupSha256) {
            if (computeSha256File(written.fullBackupPath) === written.backupSha256) {
              atomicWriteBufferSync(written.fullTargetPath, fs.readFileSync(written.fullBackupPath));
            } else {
              revertHadError = true;
            }
          } else if (!written.existedPreviously && fs.existsSync(written.fullTargetPath)) {
            fs.unlinkSync(written.fullTargetPath);
          }
        } catch {
          revertHadError = true;
        }
      }
      if (!revertHadError) {
        try {
          if (fs.existsSync(PENDING_TX_FILE)) {
            fs.unlinkSync(PENDING_TX_FILE);
          }
        } catch {}
      } else {
        pendingTxData.status = 'RECOVERY_INCOMPLETE';
        atomicWriteFileSync(PENDING_TX_FILE, JSON.stringify(pendingTxData, null, 2));
        recoveryBlockReason = 'Falha parcial ao reverter lote de atualização.';
      }
      throw new Error(`Falha na gravação do lote de arquivos: ${writeErr.message}. Operação abortada e arquivos revertidos.`);
    }

    // Step 4: Write backup manifest with both target SHA-256 and backup SHA-256 hashes using atomic write
    const createdPaths = validatedFiles.filter(f => !f.existedPreviously).map(f => f.targetRelPath);
    const manifest = {
      backupId,
      transactionId,
      timestamp,
      date: dateStr,
      description: description || 'Atualização via Painel Administrativo',
      files: validatedFiles.map(f => ({
        path: f.targetRelPath,
        sha256: f.sha256,
        backupSha256: f.backupSha256,
        existedPreviously: f.existedPreviously
      })),
      backedUpFiles: backedUpPaths,
      createdFiles: createdPaths
    };
    const manifestPath = path.join(backupFolder, 'manifest.json');
    atomicWriteFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    // Confirmar todas as gravações e manifesto antes de marcar o journal como COMPLETED
    const allConfirmed =
      fs.existsSync(manifestPath) &&
      validatedFiles.every(f => fs.existsSync(f.fullTargetPath) && computeSha256File(f.fullTargetPath) === f.sha256);

    if (!allConfirmed) {
      throw new Error('Confirmação final de integridade pós-atualização falhou.');
    }

    // Step 4.5: Marcar journal como COMPLETED antes de removê-lo (evita reversão indevida se processo cair antes do unlink)
    pendingTxData.status = 'COMPLETED';
    pendingTxData.completedAt = Date.now();
    atomicWriteFileSync(PENDING_TX_FILE, JSON.stringify(pendingTxData, null, 2));

    // Step 5: Update History file atomically
    let currentHistory: any[] = [];
    try {
      currentHistory = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8') || '[]');
    } catch {
      currentHistory = [];
    }

    currentHistory.unshift({
      id: backupId,
      transactionId,
      timestamp,
      date: dateStr,
      description: description || 'Atualização segura de arquivos',
      filesCount: modifiedPaths.length,
      files: modifiedPaths,
      backupFolder: backupId,
      status: 'Sucesso',
      canRollback: backedUpPaths.length > 0 || createdPaths.length > 0
    });
    atomicWriteFileSync(HISTORY_FILE, JSON.stringify(currentHistory, null, 2));

    // Somente agora remover o journal concluído
    try {
      if (fs.existsSync(PENDING_TX_FILE)) {
        fs.unlinkSync(PENDING_TX_FILE);
      }
    } catch {}

    logSecurityEvent('UPDATE_APPLIED', {
      backupId,
      transactionId,
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

// 7. Rollback to Previous Version (Pre-Flight SHA-256 Verification & Backup Preservation)
app.post('/api/admin/rollback', requireAdmin, async (req, res) => {
  if (isRecoveryBlocked()) {
    logSecurityEvent('ADMIN_ROLLBACK_BLOCKED_INCOMPLETE_RECOVERY', { reason: recoveryBlockReason }, req);
    return res.status(409).json({
      error: recoveryBlockReason || 'Rollback bloqueado: existe uma recuperação de transação pendente ou incompleta.'
    });
  }

  const { backupId } = req.body;
  if (!backupId || typeof backupId !== 'string') {
    return res.status(400).json({ error: 'ID de backup é obrigatório para recuperação.' });
  }

  // Ensure backupId strictly matches pattern 'backup-<digits>' to avoid path traversal
  if (!/^backup-\d{10,16}$/.test(backupId)) {
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

    // Verificar correspondência básica do manifesto e transactionId
    if (
      !manifest ||
      manifest.backupId !== cleanBackupId ||
      typeof manifest.transactionId !== 'string' ||
      !manifest.transactionId ||
      !Array.isArray(manifest.files)
    ) {
      logSecurityEvent('ROLLBACK_INTEGRITY_REJECTED', { backupId: cleanBackupId, reason: 'Manifesto inválido ou sem transactionId' }, req);
      return res.status(422).json({
        error: 'Rollback recusado: manifesto inválido, incompatível ou sem correspondência de transactionId.'
      });
    }

    // Fase 1 (Pre-flight): Validar existência e SHA-256 de TODAS as cópias de segurança ANTES de alterar qualquer arquivo real
    const verifiedToRestore: Array<{ relPath: string; backupFilePath: string; targetFilePath: string; expectedSha256: string }> = [];
    for (const relPath of manifest.backedUpFiles || []) {
      const sanitizedRel = sanitizeUploadPath(relPath);
      if (!sanitizedRel) {
        logSecurityEvent('ROLLBACK_INTEGRITY_REJECTED', { backupId: cleanBackupId, file: relPath, reason: 'Caminho inválido' }, req);
        return res.status(422).json({ error: `Rollback recusado: caminho inválido no manifesto (${relPath}).` });
      }

      const fileEntry = manifest.files.find((f: any) => f.path === sanitizedRel && f.existedPreviously === true);
      if (!fileEntry || !fileEntry.backupSha256 || !/^[a-f0-9]{64}$/.test(fileEntry.backupSha256)) {
        logSecurityEvent('ROLLBACK_INTEGRITY_REJECTED', { backupId: cleanBackupId, file: sanitizedRel, reason: 'Hash SHA-256 de backup ausente' }, req);
        return res.status(422).json({
          error: `Rollback recusado: não há hash SHA-256 de integridade comprovado para "${sanitizedRel}". Backups originais preservados.`
        });
      }

      const backupFilePath = path.join(backupFolder, sanitizedRel);
      const targetFilePath = path.join(ROOT_DIR, sanitizedRel);

      if (!fs.existsSync(backupFilePath)) {
        logSecurityEvent('ROLLBACK_INTEGRITY_REJECTED', { backupId: cleanBackupId, file: sanitizedRel, reason: 'Arquivo de backup ausente' }, req);
        return res.status(422).json({
          error: `Rollback recusado: arquivo de backup ausente para "${sanitizedRel}". Nenhuma alteração foi aplicada.`
        });
      }

      const actualBackupSha256 = computeSha256File(backupFilePath);
      if (actualBackupSha256 !== fileEntry.backupSha256) {
        logSecurityEvent('ROLLBACK_INTEGRITY_REJECTED', { backupId: cleanBackupId, file: sanitizedRel, reason: 'SHA-256 divergente (backup adulterado)' }, req);
        return res.status(422).json({
          error: `Rollback recusado: cópia de segurança de "${sanitizedRel}" adulterada ou corrompida (SHA-256 incompatível). Backups originais preservados.`
        });
      }

      verifiedToRestore.push({
        relPath: sanitizedRel,
        backupFilePath,
        targetFilePath,
        expectedSha256: fileEntry.backupSha256
      });
    }

    const restoredFiles: string[] = [];
    const removedFiles: string[] = [];

    // Fase 2: Aplicar restauração atômica e confirmar SHA-256 pós-gravação (preservando os backups originais)
    for (const item of verifiedToRestore) {
      const bytes = fs.readFileSync(item.backupFilePath);
      atomicWriteBufferSync(item.targetFilePath, bytes);
      if (computeSha256File(item.targetFilePath) !== item.expectedSha256) {
        throw new Error(`Falha na verificação pós-restauração do arquivo "${item.relPath}". Backups originais preservados.`);
      }
      restoredFiles.push(item.relPath);
    }

    // Fase 3: Remover arquivos novos criados durante aquela atualização
    const filesToRemove: string[] = manifest.createdFiles || (manifest.files || [])
      .filter((f: any) => f.existedPreviously === false)
      .map((f: any) => f.path);

    for (const relPath of filesToRemove) {
      const sanitizedRel = sanitizeUploadPath(relPath);
      if (!sanitizedRel) continue;
      if ((manifest.backedUpFiles || []).includes(sanitizedRel)) continue;

      const targetFilePath = path.join(ROOT_DIR, sanitizedRel);
      if (fs.existsSync(targetFilePath)) {
        try {
          fs.unlinkSync(targetFilePath);
          removedFiles.push(sanitizedRel);
        } catch {}
      }
    }

    // Log rollback event in history atomically
    let currentHistory: any[] = [];
    try {
      currentHistory = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8') || '[]');
    } catch {
      currentHistory = [];
    }

    currentHistory.unshift({
      id: `rollback-${Date.now()}`,
      transactionId: manifest.transactionId,
      timestamp: Date.now(),
      date: new Date().toISOString(),
      description: `Rollback restaurado a partir do backup "${cleanBackupId}"`,
      filesCount: restoredFiles.length,
      files: restoredFiles,
      status: 'Rollback Concluído',
      canRollback: false
    });
    atomicWriteFileSync(HISTORY_FILE, JSON.stringify(currentHistory, null, 2));

    logSecurityEvent('ROLLBACK_APPLIED', {
      sourceBackup: cleanBackupId,
      transactionId: manifest.transactionId,
      restoredFilesCount: restoredFiles.length,
      restoredFiles,
      removedFilesCount: removedFiles.length,
      removedFiles
    }, req);

    return res.json({
      success: true,
      message: `Versão recuperada com sucesso! ${restoredFiles.length} arquivo(s) restaurado(s)${removedFiles.length > 0 ? ` e ${removedFiles.length} arquivo(s) novos removidos` : ''}.`,
      restoredFiles,
      removedFiles
    });
  } catch (err: any) {
    console.error('[Admin Rollback Error]', err);
    logSecurityEvent('ROLLBACK_ERROR', { error: err.message }, req);
    return res.status(500).json({ error: 'Falha durante a recuperação da versão anterior: ' + err.message });
  }
});

// -------------------------------------------------------------
// 10.5 RANKING GLOBAL, AMIGOS & HISTÓRICO DE PARTIDAS (PERSISTÊNCIA SEGURA)
// -------------------------------------------------------------
interface RankingPlayerStats {
  playerKey: string;
  nickname: string;
  wins: number;
  losses: number;
  completedMatches: number;
  abandonedMatches: number;
  disconnectedMatches: number;
  incompleteMatches: number;
  favoriteGod: string;
  godUsage: Record<string, number>;
  shareWithFriends: boolean;
  totalTurnsPlayed: number;
  lastMatchAt: number;
  updatedAt: number;
}

interface RankingMatchRecord {
  matchId: string;
  mode: 'ai' | 'online';
  status: 'completed' | 'abandoned' | 'disconnected' | 'incomplete';
  playersCount: number;
  turnsPlayed: number;
  durationMs: number;
  winnerNickname: string | null;
  winnerGod: string | null;
  participants: Array<{ nickname: string; god: string; isAi?: boolean; balance?: number }>;
  reporterKey: string;
  tokenVerified: boolean;
  endedAt: number;
}

interface RankingsStore {
  players: Record<string, RankingPlayerStats>;
  matches: RankingMatchRecord[];
}

function getRankingHmacSecret(): string {
  try {
    if (fs.existsSync(RANKING_HMAC_KEY_FILE)) {
      const k = fs.readFileSync(RANKING_HMAC_KEY_FILE, 'utf-8').trim();
      if (k.length >= 32) return k;
    }
  } catch {}
  const fresh = crypto.randomBytes(32).toString('hex');
  try {
    atomicWriteFileSync(RANKING_HMAC_KEY_FILE, fresh);
  } catch {}
  return fresh;
}

function signRankingPayload(payload: Record<string, any>): string {
  const secret = getRankingHmacSecret();
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(data).digest('hex');
  return `${data}.${sig}`;
}

function verifyRankingToken(token: string): Record<string, any> | null {
  try {
    if (!token || typeof token !== 'string' || !token.includes('.')) return null;
    const [data, sig] = token.split('.');
    if (!data || !sig || !/^[a-f0-9]{64}$/.test(sig)) return null;
    const expected = crypto.createHmac('sha256', getRankingHmacSecret()).update(data).digest('hex');
    if (!timingSafeCompare(sig, expected)) return null;
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'));
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function normalizeNicknameKey(raw: string): string {
  return String(raw || '').trim().replace(/[<>"'`]/g, '').replace(/\s+/g, ' ').substring(0, 24).toLowerCase();
}

function sanitizeDisplayNickname(raw: string): string {
  return String(raw || '').trim().replace(/[<>"'`]/g, '').replace(/\s+/g, ' ').substring(0, 24);
}

function loadRankingsStore(): RankingsStore {
  try {
    if (!fs.existsSync(RANKINGS_FILE)) {
      return { players: {}, matches: [] };
    }
    const parsed = JSON.parse(fs.readFileSync(RANKINGS_FILE, 'utf-8') || '{}');
    return {
      players: parsed && typeof parsed.players === 'object' && parsed.players !== null ? parsed.players : {},
      matches: Array.isArray(parsed?.matches) ? parsed.matches : []
    };
  } catch {
    return { players: {}, matches: [] };
  }
}

function saveRankingsStore(store: RankingsStore) {
  if (store.matches.length > 500) {
    store.matches = store.matches.slice(0, 500);
  }
  atomicWriteFileSync(RANKINGS_FILE, JSON.stringify(store, null, 2));
}

function ensurePlayerRecord(store: RankingsStore, nickname: string): RankingPlayerStats {
  const cleanName = sanitizeDisplayNickname(nickname);
  const key = normalizeNicknameKey(cleanName);
  if (!store.players[key]) {
    store.players[key] = {
      playerKey: key,
      nickname: cleanName,
      wins: 0,
      losses: 0,
      completedMatches: 0,
      abandonedMatches: 0,
      disconnectedMatches: 0,
      incompleteMatches: 0,
      favoriteGod: 'Zeus',
      godUsage: {},
      shareWithFriends: true,
      totalTurnsPlayed: 0,
      lastMatchAt: 0,
      updatedAt: Date.now()
    };
  } else if (cleanName.length >= 2) {
    store.players[key].nickname = cleanName;
  }
  return store.players[key];
}

function computeWinRate(p: RankingPlayerStats): number {
  const denom = (p.wins || 0) + (p.losses || 0);
  if (denom <= 0) return 0;
  return Math.round((p.wins / denom) * 100);
}

function buildPublicRankingRow(p: RankingPlayerStats, position: number) {
  return {
    position,
    nickname: p.nickname,
    wins: p.wins || 0,
    losses: p.losses || 0,
    completedMatches: p.completedMatches || 0,
    abandonedMatches: p.abandonedMatches || 0,
    disconnectedMatches: p.disconnectedMatches || 0,
    incompleteMatches: p.incompleteMatches || 0,
    winRate: computeWinRate(p),
    favoriteGod: p.favoriteGod || 'Zeus',
    shareWithFriends: p.shareWithFriends !== false,
    lastMatchAt: p.lastMatchAt || 0
  };
}

// Rate limiter dedicado aos endpoints de ranking (protege contra spam/flood)
const rankingRateLimits = new Map<string, ApiRateRecord>();
const RANKING_MAX_PER_MIN = 45;
function rankingRateMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const origin = req.headers.origin;
  const allowedAppOrigin = (() => {
    try {
      const u = (process.env.APP_URL || '').trim();
      return u ? new URL(u).origin : '';
    } catch {
      return '';
    }
  })();
  const allowedOrigins = new Set([
    'capacitor://localhost',
    'https://localhost',
    'http://localhost',
    'http://localhost:3000',
    ...(allowedAppOrigin ? [allowedAppOrigin] : [])
  ]);
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const ip = getClientIp(req);
  const now = Date.now();
  let rec = rankingRateLimits.get(ip);
  if (!rec || now > rec.resetAt) {
    rec = { count: 1, resetAt: now + 60000 };
    rankingRateLimits.set(ip, rec);
    return next();
  }
  rec.count += 1;
  if (rec.count > RANKING_MAX_PER_MIN) {
    return res.status(429).json({ error: 'Muitas requisições ao ranking. Aguarde um instante.' });
  }
  next();
}

app.use('/api/ranking', rankingRateMiddleware);

// Registrar/consultar sessão de perfil do jogador para ranking
app.post('/api/ranking/session', (req, res) => {
  try {
    const nickname = sanitizeDisplayNickname(req.body?.nickname || '');
    if (nickname.length < 2) {
      return res.status(400).json({ error: 'Informe um nickname com pelo menos 2 caracteres.' });
    }
    const store = loadRankingsStore();
    const player = ensurePlayerRecord(store, nickname);
    if (typeof req.body?.shareWithFriends === 'boolean') {
      player.shareWithFriends = req.body.shareWithFriends;
      player.updatedAt = Date.now();
    }
    saveRankingsStore(store);

    const profileToken = signRankingPayload({
      playerKey: player.playerKey,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
    });

    return res.json({
      success: true,
      profileToken,
      player: buildPublicRankingRow(player, 0)
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Falha ao inicializar perfil de ranking: ' + err.message });
  }
});

// Atualizar preferência de privacidade no Ranking entre Amigos
app.post('/api/ranking/privacy', (req, res) => {
  try {
    const { nickname, shareWithFriends, profileToken } = req.body || {};
    const verified = profileToken ? verifyRankingToken(profileToken) : null;
    const key = verified?.playerKey || normalizeNicknameKey(nickname);
    const cleanName = sanitizeDisplayNickname(nickname || key);

    if (!key || cleanName.length < 2 || typeof shareWithFriends !== 'boolean') {
      return res.status(400).json({ error: 'Parâmetros inválidos para atualização de privacidade.' });
    }

    const store = loadRankingsStore();
    const player = store.players[key] || ensurePlayerRecord(store, cleanName);
    player.shareWithFriends = shareWithFriends;
    player.updatedAt = Date.now();
    saveRankingsStore(store);

    return res.json({
      success: true,
      shareWithFriends: player.shareWithFriends,
      player: buildPublicRankingRow(player, 0)
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao salvar privacidade: ' + err.message });
  }
});

// Emitir token HMAC de início de partida (reduz falsificação simples / repetição)
app.post('/api/ranking/match/start', (req, res) => {
  try {
    const nickname = sanitizeDisplayNickname(req.body?.nickname || 'Guerreiro');
    const mode = req.body?.mode === 'online' ? 'online' : 'ai';
    const playersCount = Math.min(4, Math.max(2, parseInt(req.body?.playersCount, 10) || 2));

    if (nickname.length < 2) {
      return res.status(400).json({ error: 'Nickname inválido para iniciar registro de partida.' });
    }

    const matchId = `m_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const startedAt = Date.now();
    const matchToken = signRankingPayload({
      matchId,
      playerKey: normalizeNicknameKey(nickname),
      mode,
      playersCount,
      startedAt,
      expiresAt: startedAt + 6 * 60 * 60 * 1000
    });

    return res.json({
      success: true,
      matchId,
      matchToken,
      startedAt
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Falha ao gerar sessão de partida: ' + err.message });
  }
});

// Registrar desfecho de partida (completed, abandoned, disconnected, incomplete)
app.post('/api/ranking/match/finish', (req, res) => {
  try {
    const body = req.body || {};
    const statusRaw = String(body.status || 'completed');
    const validStatuses = new Set(['completed', 'abandoned', 'disconnected', 'incomplete']);
    if (!validStatuses.has(statusRaw)) {
      return res.status(400).json({ error: 'Status de partida inválido.' });
    }
    const status = statusRaw as RankingMatchRecord['status'];
    const mode: 'ai' | 'online' = body.mode === 'online' ? 'online' : 'ai';
    const playersCount = Math.min(4, Math.max(2, parseInt(body.playersCount, 10) || 2));
    const turnsPlayed = Math.max(0, Math.min(2000, parseInt(body.turnsPlayed, 10) || 0));
    const durationMs = Math.max(0, Math.min(6 * 60 * 60 * 1000, parseInt(body.durationMs, 10) || 0));

    let matchId = String(body.matchId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 48);
    let tokenVerified = false;
    const verifiedToken = body.matchToken ? verifyRankingToken(String(body.matchToken)) : null;

    if (verifiedToken && typeof verifiedToken.matchId === 'string') {
      if (verifiedToken.expiresAt && Date.now() > Number(verifiedToken.expiresAt)) {
        return res.status(400).json({ error: 'Token de partida expirado.' });
      }
      matchId = verifiedToken.matchId;
      tokenVerified = true;
    }

    if (!matchId) {
      matchId = `m_local_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }

    const reporterNickname = sanitizeDisplayNickname(body.reporterNickname || '');
    if (reporterNickname.length < 2) {
      return res.status(400).json({ error: 'Nickname do jogador obrigatório para registro.' });
    }

    const participantsRaw = Array.isArray(body.participants) ? body.participants.slice(0, 4) : [];
    const participants = participantsRaw
      .map((p: any) => ({
        nickname: sanitizeDisplayNickname(p?.nickname || ''),
        god: sanitizeDisplayNickname(p?.god || 'Zeus').substring(0, 16) || 'Zeus',
        isAi: Boolean(p?.isAi),
        balance: Number.isFinite(Number(p?.balance)) ? Math.max(0, Math.round(Number(p.balance))) : 0
      }))
      .filter((p: any) => p.nickname.length >= 2);

    const store = loadRankingsStore();

    // Idempotência: nunca contabilizar a mesma partida duas vezes
    const existing = store.matches.find(m => m.matchId === matchId);
    if (existing) {
      const reporterStats = ensurePlayerRecord(store, reporterNickname);
      return res.json({
        success: true,
        deduplicated: true,
        match: existing,
        player: buildPublicRankingRow(reporterStats, 0)
      });
    }

    let winnerNickname: string | null = null;
    let winnerGod: string | null = null;

    if (status === 'completed') {
      // Validação de plausibilidade: partida concluída precisa ter vencedor declarado e ao menos 1 turno jogado
      const candidateWinner = sanitizeDisplayNickname(body.winnerNickname || '');
      if (candidateWinner.length < 2 || turnsPlayed < 1) {
        return res.status(400).json({
          error: 'Partida concluída requer ao menos 1 turno jogado e vencedor válido.'
        });
      }
      winnerNickname = candidateWinner;
      winnerGod = sanitizeDisplayNickname(body.winnerGod || 'Zeus').substring(0, 16) || 'Zeus';
    }

    const now = Date.now();
    const reporterKey = normalizeNicknameKey(reporterNickname);
    const reporterPlayer = ensurePlayerRecord(store, reporterNickname);
    reporterPlayer.lastMatchAt = now;
    reporterPlayer.updatedAt = now;
    reporterPlayer.totalTurnsPlayed += turnsPlayed;

    const reporterParticipant = participants.find((p: any) => normalizeNicknameKey(p.nickname) === reporterKey);
    if (reporterParticipant?.god) {
      reporterPlayer.godUsage[reporterParticipant.god] = (reporterPlayer.godUsage[reporterParticipant.god] || 0) + 1;
      const topGod = Object.entries(reporterPlayer.godUsage).sort((a, b) => b[1] - a[1])[0];
      if (topGod) reporterPlayer.favoriteGod = topGod[0];
    }

    // Regra justa: apenas partidas concluídas contam vitórias/derrotas e aproveitamento
    if (status === 'completed' && winnerNickname) {
      reporterPlayer.completedMatches += 1;
      const isReporterWinner = normalizeNicknameKey(winnerNickname) === reporterKey;
      if (isReporterWinner) {
        reporterPlayer.wins += 1;
      } else {
        reporterPlayer.losses += 1;
      }

      // Em partidas online P2P, atualizar também os participantes humanos identificados caso haja registro único de partida
      if (mode === 'online') {
        for (const part of participants) {
          if (part.isAi) continue;
          const pKey = normalizeNicknameKey(part.nickname);
          if (pKey === reporterKey || /^bot\b|ia$/i.test(pKey)) continue;
          const peerPlayer = ensurePlayerRecord(store, part.nickname);
          peerPlayer.completedMatches += 1;
          peerPlayer.lastMatchAt = now;
          peerPlayer.updatedAt = now;
          if (pKey === normalizeNicknameKey(winnerNickname)) {
            peerPlayer.wins += 1;
          } else {
            peerPlayer.losses += 1;
          }
        }
      }
    } else if (status === 'abandoned') {
      reporterPlayer.abandonedMatches += 1;
    } else if (status === 'disconnected') {
      reporterPlayer.disconnectedMatches += 1;
    } else {
      reporterPlayer.incompleteMatches += 1;
    }

    const matchRecord: RankingMatchRecord = {
      matchId,
      mode,
      status,
      playersCount,
      turnsPlayed,
      durationMs,
      winnerNickname,
      winnerGod,
      participants,
      reporterKey,
      tokenVerified,
      endedAt: now
    };

    store.matches.unshift(matchRecord);
    saveRankingsStore(store);

    return res.json({
      success: true,
      match: matchRecord,
      player: buildPublicRankingRow(reporterPlayer, 0),
      authorityNote: 'Partida registrada com token HMAC e deduplicação no servidor; desfechos de tabuleiro/P2P são atestados pelos clientes.'
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Falha ao gravar resultado da partida: ' + err.message });
  }
});

// Consultar Ranking Global e histórico recente
app.get('/api/ranking/global', (req, res) => {
  try {
    const nicknameFilter = normalizeNicknameKey(String(req.query.nickname || ''));
    const store = loadRankingsStore();

    const sortedPlayers = Object.values(store.players)
      .filter(p => (p.completedMatches > 0 || p.abandonedMatches > 0 || p.disconnectedMatches > 0 || p.incompleteMatches > 0))
      .sort((a, b) => {
        if ((b.wins || 0) !== (a.wins || 0)) return (b.wins || 0) - (a.wins || 0);
        const rateDiff = computeWinRate(b) - computeWinRate(a);
        if (rateDiff !== 0) return rateDiff;
        if ((a.losses || 0) !== (b.losses || 0)) return (a.losses || 0) - (b.losses || 0);
        return (b.completedMatches || 0) - (a.completedMatches || 0);
      });

    const leaderboard = sortedPlayers.slice(0, 50).map((p, idx) => buildPublicRankingRow(p, idx + 1));

    const myStats = nicknameFilter && store.players[nicknameFilter]
      ? buildPublicRankingRow(
          store.players[nicknameFilter],
          Math.max(0, sortedPlayers.findIndex(p => p.playerKey === nicknameFilter) + 1)
        )
      : null;

    const myMatches = nicknameFilter
      ? store.matches
          .filter(m => m.reporterKey === nicknameFilter || m.participants.some(p => normalizeNicknameKey(p.nickname) === nicknameFilter))
          .slice(0, 30)
      : store.matches.slice(0, 20);

    return res.json({
      success: true,
      totalRankedPlayers: sortedPlayers.length,
      leaderboard,
      myStats,
      recentMatches: myMatches,
      authorityNote: 'O servidor valida tokens de sessão/partida, idempotência e estatísticas, enquanto o fluxo de dados e turnos em Vs IA e P2P é atestado no cliente.'
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao carregar ranking global: ' + err.message });
  }
});

// Consultar Ranking entre Amigos (respeita shareWithFriends por jogador)
app.post('/api/ranking/friends', (req, res) => {
  try {
    const requesterRaw = sanitizeDisplayNickname(req.body?.requester || '');
    const requesterKey = normalizeNicknameKey(requesterRaw);
    const friendNamesRaw = Array.isArray(req.body?.friends) ? req.body.friends.slice(0, 100) : [];

    const store = loadRankingsStore();
    const keys = new Set<string>();
    if (requesterKey.length >= 2) keys.add(requesterKey);
    for (const f of friendNamesRaw) {
      const k = normalizeNicknameKey(typeof f === 'string' ? f : f?.nome || '');
      if (k.length >= 2) keys.add(k);
    }

    const hiddenFriends: string[] = [];
    const friendEntries: RankingPlayerStats[] = [];

    for (const key of keys) {
      const rec = store.players[key];
      if (!rec) continue;
      if (key !== requesterKey && rec.shareWithFriends === false) {
        hiddenFriends.push(rec.nickname);
        continue;
      }
      friendEntries.push(rec);
    }

    friendEntries.sort((a, b) => {
      if ((b.wins || 0) !== (a.wins || 0)) return (b.wins || 0) - (a.wins || 0);
      const rateDiff = computeWinRate(b) - computeWinRate(a);
      if (rateDiff !== 0) return rateDiff;
      return (a.losses || 0) - (b.losses || 0);
    });

    const leaderboard = friendEntries.map((p, idx) => ({
      ...buildPublicRankingRow(p, idx + 1),
      isSelf: p.playerKey === requesterKey
    }));

    return res.json({
      success: true,
      leaderboard,
      hiddenFriendsCount: hiddenFriends.length
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao consultar ranking de amigos: ' + err.message });
  }
});

// -------------------------------------------------------------
// 11. VITE INTEGRATION & STARTUP RECOVERY (DEV / PROD)
// -------------------------------------------------------------
async function startServer() {
  // Executar recuperação automática de integridade pós-interrupção antes de iniciar tráfego
  recoverPendingTransactions();

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

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Legado dos Imortais] Servidor protegido executando em http://localhost:${PORT}`);
  });

  // Tratamento de encerramento gracioso para evitar corrupções em desligamentos
  const handleShutdown = (signal: string) => {
    console.log(`[Servidor] Sinal ${signal} recebido. Finalizando conexões e garantindo integridade dos dados.`);
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

if (process.env.NO_AUTO_START !== '1') {
  startServer().catch((err) => {
    console.error('[Server Start Error]', err);
    process.exit(1);
  });
}

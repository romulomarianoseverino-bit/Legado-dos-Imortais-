import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Unsubscribe,
  type User
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email
        })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface FirebaseBootState {
  authReady: boolean;
  firestoreConnected: boolean;
  user: User | null;
}

const bootState: FirebaseBootState = {
  authReady: false,
  firestoreConnected: false,
  user: null
};

async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    bootState.firestoreConnected = true;
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      bootState.firestoreConnected = false;
      return false;
    }
    bootState.firestoreConnected = true;
    return true;
  }
}

void testConnection();

function sanitizeSafeId(raw: unknown, fallbackPrefix: string): string {
  const cleaned = String(raw || '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 64);
  if (cleaned.length >= 1) return cleaned;
  return `${fallbackPrefix}_${Date.now()}`.substring(0, 64);
}

function clampString(raw: unknown, minLen: number, maxLen: number, fallback: string): string {
  const cleaned = String(raw || '')
    .replace(/[<>"'`]/g, '')
    .trim()
    .substring(0, maxLen);
  return cleaned.length >= minLen ? cleaned : fallback.substring(0, maxLen);
}

function sanitizeFlatConfigMap(raw: unknown): Record<string, string | number | boolean> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const entries = Object.entries(raw as Record<string, unknown>).slice(0, 40);
  const clean: Record<string, string | number | boolean> = {};
  for (const [k, v] of entries) {
    const key = String(k).replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 40);
    if (!key) continue;
    if (typeof v === 'string') clean[key] = v.substring(0, 120);
    else if (typeof v === 'number' && Number.isFinite(v)) clean[key] = v;
    else if (typeof v === 'boolean') clean[key] = v;
  }
  return clean;
}

export function subscribeFirebaseAuth(
  callback: (user: User | null, state: FirebaseBootState) => void
): Unsubscribe {
  return onAuthStateChanged(auth, (user) => {
    bootState.authReady = true;
    bootState.user = user;
    callback(user, { ...bootState });
  });
}

export async function signInWithGoogleFirebase(): Promise<User> {
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

export async function getCurrentUserIdToken(forceRefresh = false): Promise<string | null> {
  if (!auth.currentUser) return null;
  try {
    return await auth.currentUser.getIdToken(forceRefresh);
  } catch {
    return null;
  }
}

export async function ensurePlayerCloudProfile(
  user: User,
  opts?: { displayName?: string; godId?: string; linkedLegacyUsername?: string; shareRankingWithFriends?: boolean }
): Promise<void> {
  const uid = sanitizeSafeId(user.uid, 'player');
  const displayName = clampString(opts?.displayName || user.displayName || 'Guerreiro', 2, 32, 'Guerreiro');
  const godId = sanitizeSafeId(opts?.godId || 'zeus', 'zeus').substring(0, 24);
  const photoUrl = typeof user.photoURL === 'string' ? user.photoURL.substring(0, 512) : '';

  const publicPath = `playersPublic/${uid}`;
  const publicRef = doc(db, 'playersPublic', uid);
  try {
    const snap = await getDoc(publicRef);
    if (!snap.exists()) {
      const payload: Record<string, unknown> = {
        uid,
        displayName,
        godId,
        wins: 0,
        losses: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      if (photoUrl) payload.photoUrl = photoUrl;
      await setDoc(publicRef, payload);
    } else {
      const updatePayload: Record<string, unknown> = {
        displayName,
        godId,
        updatedAt: serverTimestamp()
      };
      if (photoUrl) updatePayload.photoUrl = photoUrl;
      await updateDoc(publicRef, updatePayload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, publicPath);
  }

  const privatePath = `playersPrivate/${uid}`;
  const privateRef = doc(db, 'playersPrivate', uid);
  try {
    const pSnap = await getDoc(privateRef);
    const email = typeof user.email === 'string' ? user.email.substring(0, 254) : '';
    const linkedLegacyUsername = clampString(opts?.linkedLegacyUsername || '', 0, 32, '');
    const shareRankingWithFriends =
      typeof opts?.shareRankingWithFriends === 'boolean' ? opts.shareRankingWithFriends : true;

    if (!pSnap.exists()) {
      const privPayload: Record<string, unknown> = {
        uid,
        shareRankingWithFriends,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      if (email) privPayload.email = email;
      if (linkedLegacyUsername) privPayload.linkedLegacyUsername = linkedLegacyUsername;
      await setDoc(privateRef, privPayload);
    } else {
      const privUpdate: Record<string, unknown> = {
        shareRankingWithFriends,
        updatedAt: serverTimestamp()
      };
      if (email) privUpdate.email = email;
      if (linkedLegacyUsername) privUpdate.linkedLegacyUsername = linkedLegacyUsername;
      await updateDoc(privateRef, privUpdate);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, privatePath);
  }
}

export async function recordPlayerMatchOutcomeCloud(
  user: User,
  won: boolean,
  displayName?: string,
  godId?: string
): Promise<void> {
  const uid = sanitizeSafeId(user.uid, 'player');
  await ensurePlayerCloudProfile(user, { displayName, godId });
  const publicPath = `playersPublic/${uid}`;
  const publicRef = doc(db, 'playersPublic', uid);
  try {
    const snap = await getDoc(publicRef);
    const currentWins = Number(snap.data()?.wins || 0);
    const currentLosses = Number(snap.data()?.losses || 0);
    await updateDoc(publicRef, {
      wins: won ? Math.min(1000000, currentWins + 1) : currentWins,
      losses: !won ? Math.min(1000000, currentLosses + 1) : currentLosses,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, publicPath);
  }
}

export async function savePieceToCloud(
  user: User,
  piece: {
    id?: string;
    nome?: string;
    tipo?: string;
    estilo?: string;
    classeId?: string;
    charConfig?: Record<string, unknown>;
  }
): Promise<string> {
  const uid = sanitizeSafeId(user.uid, 'player');
  await ensurePlayerCloudProfile(user);
  const pieceId = sanitizeSafeId(piece?.id, 'piece');
  const piecePath = `playersPublic/${uid}/savedPieces/${pieceId}`;
  const pieceRef = doc(db, 'playersPublic', uid, 'savedPieces', pieceId);

  const tipo =
    piece?.tipo === 'preset' || piece?.tipo === 'glb' || piece?.tipo === 'character3d'
      ? piece.tipo
      : 'character3d';

  const basePayload = {
    nome: clampString(piece?.nome, 2, 32, 'Campeão Olímpico'),
    tipo,
    estilo: clampString(piece?.estilo, 2, 24, 'stylized3d'),
    classeId: clampString(piece?.classeId, 2, 32, 'classico_equilibrado'),
    charConfig: sanitizeFlatConfigMap(piece?.charConfig)
  };

  try {
    const snap = await getDoc(pieceRef);
    if (!snap.exists()) {
      await setDoc(pieceRef, {
        id: pieceId,
        ownerId: uid,
        ...basePayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      await updateDoc(pieceRef, {
        ...basePayload,
        updatedAt: serverTimestamp()
      });
    }
    return pieceId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, piecePath);
  }
}

export async function listCloudSavedPieces(user: User): Promise<Record<string, unknown>[]> {
  const uid = sanitizeSafeId(user.uid, 'player');
  const colPath = `playersPublic/${uid}/savedPieces`;
  try {
    const q = query(collection(db, 'playersPublic', uid, 'savedPieces'), where('ownerId', '==', uid), limit(30));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, colPath);
  }
}

export async function deleteCloudSavedPiece(user: User, pieceId: string): Promise<void> {
  const uid = sanitizeSafeId(user.uid, 'player');
  const cleanPieceId = sanitizeSafeId(pieceId, 'piece');
  const docPath = `playersPublic/${uid}/savedPieces/${cleanPieceId}`;
  try {
    await deleteDoc(doc(db, 'playersPublic', uid, 'savedPieces', cleanPieceId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export async function publishBoardToCloud(
  user: User,
  board: {
    id?: string;
    nome?: string;
    tema?: string;
    casas?: Array<Record<string, unknown>>;
  },
  isPublic = true
): Promise<string> {
  const uid = sanitizeSafeId(user.uid, 'player');
  const boardId = sanitizeSafeId(board?.id, 'board');
  const docPath = `communityBoards/${boardId}`;
  const docRef = doc(db, 'communityBoards', boardId);

  const rawCasas = Array.isArray(board?.casas) ? board.casas.slice(0, 24) : [];
  if (rawCasas.length < 8) {
    throw new Error('O tabuleiro precisa de pelo menos 8 casas para ser salvo na nuvem.');
  }

  const sanitizedCasas = rawCasas.map((tile, idx) => ({
    id: idx,
    nome: clampString(tile?.nome, 2, 26, `Casa ${idx}`),
    tipo:
      tile?.tipo === 'inicio' || tile?.tipo === 'prisao' || tile?.tipo === 'bencao'
        ? tile.tipo
        : 'propriedade',
    cor: clampString(tile?.cor, 2, 24, '#3b82f6'),
    grupo: clampString(tile?.grupo, 1, 24, 'Olimpo'),
    icon: clampString(tile?.icon, 1, 8, '🏛️'),
    valor: Number.isFinite(Number(tile?.valor)) ? Math.max(0, Math.min(5000, Math.round(Number(tile.valor)))) : 0,
    aluguel: Number.isFinite(Number(tile?.aluguel)) ? Math.max(0, Math.min(2500, Math.round(Number(tile.aluguel)))) : 0
  }));

  const mutablePayload = {
    authorName: clampString(user.displayName || 'Construtor', 2, 32, 'Construtor'),
    nome: clampString(board?.nome, 3, 36, 'Tabuleiro Olímpico'),
    tema: clampString(board?.tema, 2, 32, 'olimpo'),
    totalCasas: sanitizedCasas.length,
    isPublic: Boolean(isPublic),
    casas: sanitizedCasas
  };

  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      await setDoc(docRef, {
        id: boardId,
        authorId: uid,
        ...mutablePayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      await updateDoc(docRef, {
        ...mutablePayload,
        updatedAt: serverTimestamp()
      });
    }
    return boardId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export function subscribePublicCloudBoards(
  onBoards: (boards: Record<string, unknown>[]) => void
): Unsubscribe {
  if (!bootState.authReady || !auth.currentUser) {
    return () => {};
  }
  const colPath = 'communityBoards';
  const q = query(collection(db, 'communityBoards'), where('isPublic', '==', true), limit(30));
  return onSnapshot(
    q,
    (snapshot) => {
      onBoards(snapshot.docs.map((d) => ({ ...d.data(), id: d.id })));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, colPath);
    }
  );
}

export async function getPlayerCloudSnapshot(user: User): Promise<{
  publicProfile: Record<string, unknown> | null;
  privateInfo: Record<string, unknown> | null;
  savedPiecesCount: number;
}> {
  const uid = sanitizeSafeId(user.uid, 'player');
  let publicProfile: Record<string, unknown> | null = null;
  let privateInfo: Record<string, unknown> | null = null;

  const publicPath = `playersPublic/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'playersPublic', uid));
    publicProfile = snap.exists() ? snap.data() : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, publicPath);
  }

  const privatePath = `playersPrivate/${uid}`;
  try {
    const pSnap = await getDoc(doc(db, 'playersPrivate', uid));
    privateInfo = pSnap.exists() ? pSnap.data() : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, privatePath);
  }

  const pieces = await listCloudSavedPieces(user);
  return {
    publicProfile,
    privateInfo,
    savedPiecesCount: pieces.length
  };
}

export const LegadoFirebase = {
  db,
  auth,
  getBootState: () => ({ ...bootState }),
  testConnection,
  subscribeFirebaseAuth,
  signInWithGoogle: signInWithGoogleFirebase,
  signOut: signOutFirebase,
  getIdToken: getCurrentUserIdToken,
  ensurePlayerCloudProfile,
  recordPlayerMatchOutcomeCloud,
  savePieceToCloud,
  listCloudSavedPieces,
  deleteCloudSavedPiece,
  publishBoardToCloud,
  subscribePublicCloudBoards,
  getPlayerCloudSnapshot
};

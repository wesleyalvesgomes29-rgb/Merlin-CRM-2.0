import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { INITIAL_CLIENTS, DEFAULT_TAGS, INITIAL_SALES } from '../src/data/seed';

const DATA_DIR = path.join(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'merlin_db.json');

export const MASTER_INVITE_CODE = process.env.MASTER_INVITE_CODE || 'MERLIN-ADMIN-2026';

export interface DbUser {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  salt: string;
  role: 'admin' | 'broker';
  status: 'pending' | 'active' | 'blocked';
  google_access_token?: string | null;
  google_refresh_token?: string | null;
  google_token_expiry?: number | null;
  google_email?: string | null;
  google_connected_at?: string | null;
  created_at: string;
}

export interface DbInviteCode {
  code: string;
  created_by: string | null;
  used_by: string | null;
  used_at: string | null;
  is_active: number; // 1 = active, 0 = inactive/used
  created_at: string;
}

export interface DatabaseSchema {
  users: Record<string, DbUser>;
  invite_codes: Record<string, DbInviteCode>;
  clients: Record<string, any>;
  client_comments: Record<string, any>;
  client_history: Record<string, any>;
  tasks: Record<string, any>;
  sales: Record<string, any>;
  tags: Record<string, any>;
  broker_memory?: Record<string, any>;
  meta: {
    lastSyncedAt: string;
    version: number;
  };
}

// Cryptography helpers using standard Web Crypto API (crypto.subtle and crypto.getRandomValues)
export function generateSalt(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  const saltBuffer = encoder.encode(salt);

  const baseKey = await globalThis.crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const derivedBits = await globalThis.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBuffer,
      iterations: 10000,
      hash: "SHA-512"
    },
    baseKey,
    512
  );

  return Array.from(new Uint8Array(derivedBits))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyPassword(password: string, salt: string, expectedHash: string): Promise<boolean> {
  const hash = await hashPassword(password, salt);
  return hash === expectedHash;
}

export function generateRandomCode(prefix = 'MERLIN'): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let part1 = '';
  let part2 = '';
  for (let i = 0; i < 4; i++) {
    part1 += chars.charAt(Math.floor(Math.random() * chars.length));
    part2 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${part1}-${part2}`;
}

function getInitialDatabase(): DatabaseSchema {
  const now = new Date().toISOString();
  const db: DatabaseSchema = {
    users: {},
    invite_codes: {},
    clients: {},
    client_comments: {},
    client_history: {},
    tasks: {},
    sales: {},
    tags: {},
    broker_memory: {},
    meta: {
      lastSyncedAt: now,
      version: 2
    }
  };

  // Seed default admin invite code
  db.invite_codes[MASTER_INVITE_CODE] = {
    code: MASTER_INVITE_CODE,
    created_by: 'system',
    used_by: null,
    used_at: null,
    is_active: 1,
    created_at: now
  };

  // Seed sample initial team invite codes
  const seedCodes = ['MERLIN-EQUIPE-VIP1', 'MERLIN-BROKER-2026'];
  for (const c of seedCodes) {
    db.invite_codes[c] = {
      code: c,
      created_by: 'system',
      used_by: null,
      used_at: null,
      is_active: 1,
      created_at: now
    };
  }

  // Seed Tags
  for (const tag of DEFAULT_TAGS) {
    db.tags[tag.id] = { ...tag };
  }

  // Seed Sales
  for (const sale of INITIAL_SALES) {
    db.sales[sale.id] = { ...sale, user_id: 'default_broker' };
  }

  // Seed Clients with Comments and History
  for (const client of INITIAL_CLIENTS) {
    const { comments, history, ...clientFields } = client;
    db.clients[client.id] = {
      ...clientFields,
      user_id: 'default_broker',
      updatedAt: now
    };

    if (Array.isArray(comments)) {
      for (const comm of comments) {
        db.client_comments[comm.id] = {
          id: comm.id,
          clientId: client.id,
          text: comm.text,
          createdAt: comm.date
        };
      }
    }

    if (Array.isArray(history)) {
      for (const hist of history) {
        db.client_history[hist.id] = {
          id: hist.id,
          clientId: client.id,
          action: hist.action,
          date: hist.date
        };
      }
    }
  }

  return db;
}

export function initLocalDatabase(): DatabaseSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(DB_FILE)) {
      const initialDb = getInitialDatabase();
      fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), 'utf-8');
      return initialDb;
    }

    const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(fileContent) as DatabaseSchema;

    // Migrations / Schema updates
    let updated = false;
    if (!parsed.users) {
      parsed.users = {};
      updated = true;
    } else {
      // Ensure all existing users have a status
      for (const u of Object.values(parsed.users)) {
        if (!u.status) {
          u.status = 'active';
          updated = true;
        }
      }
    }
    if (!parsed.invite_codes) {
      parsed.invite_codes = {};
      updated = true;
    }
    if (!parsed.broker_memory) {
      parsed.broker_memory = {};
      updated = true;
    }

    // Always ensure Master Invite code exists
    if (!parsed.invite_codes[MASTER_INVITE_CODE]) {
      parsed.invite_codes[MASTER_INVITE_CODE] = {
        code: MASTER_INVITE_CODE,
        created_by: 'system',
        used_by: null,
        used_at: null,
        is_active: 1,
        created_at: new Date().toISOString()
      };
      updated = true;
    }

    if (updated) {
      writeDatabase(parsed);
    }

    return parsed;
  } catch (error) {
    console.error('[Merlin DB] Erro ao inicializar banco local SQLite/JSON:', error);
    return getInitialDatabase();
  }
}

export function readDatabase(): DatabaseSchema {
  return initLocalDatabase();
}

export function writeDatabase(db: DatabaseSchema): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (error) {
    console.error('[Merlin DB] Erro ao salvar dados no disco:', error);
  }
}

// User & Auth Operations
export function findUserByEmail(email: string): DbUser | null {
  const db = readDatabase();
  const normalized = email.trim().toLowerCase();
  for (const user of Object.values(db.users || {})) {
    if (user.email.toLowerCase() === normalized) {
      return user;
    }
  }
  return null;
}

export function findUserById(id: string): DbUser | null {
  const db = readDatabase();
  return db.users?.[id] || null;
}

export function validateInviteCode(code: string): { valid: boolean; isMaster: boolean; reason?: string; invite?: DbInviteCode } {
  const normalized = code.trim().toUpperCase();
  const db = readDatabase();

  if (normalized === MASTER_INVITE_CODE.toUpperCase()) {
    return { valid: true, isMaster: true };
  }

  const invite = db.invite_codes?.[normalized];
  if (!invite) {
    return { valid: false, isMaster: false, reason: 'Código de convite não encontrado.' };
  }

  if (invite.is_active !== 1 || invite.used_by) {
    return { valid: false, isMaster: false, reason: 'Código de convite já foi utilizado ou está inativo.' };
  }

  return { valid: true, isMaster: false, invite };
}

export async function registerUser(params: {
  name: string;
  email: string;
  password: string;
  inviteCode: string;
}): Promise<{ success: boolean; user?: Omit<DbUser, 'password_hash' | 'salt'>; message?: string; error?: string }> {
  const db = readDatabase();
  const emailNorm = params.email.trim().toLowerCase();

  // Check if email already registered
  if (findUserByEmail(emailNorm)) {
    return { success: false, error: 'Este e-mail já está cadastrado no sistema.' };
  }

  // Validate Invite Code
  const inviteCheck = validateInviteCode(params.inviteCode);
  if (!inviteCheck.valid) {
    return { success: false, error: 'Código de convite inválido ou expirado.' };
  }

  const now = new Date().toISOString();
  const salt = generateSalt();
  const passwordHash = await hashPassword(params.password, salt);
  const randomBytes = new Uint8Array(6);
  globalThis.crypto.getRandomValues(randomBytes);
  const userId = 'usr_' + Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  
  // The first user in the database OR user using MASTER_INVITE_CODE is active admin
  const isFirstUser = Object.keys(db.users || {}).length === 0;
  const isMasterOrFirst = isFirstUser || inviteCheck.isMaster;
  const role: 'admin' | 'broker' = isMasterOrFirst ? 'admin' : 'broker';
  const status: 'pending' | 'active' | 'blocked' = isMasterOrFirst ? 'active' : 'pending';

  const newUser: DbUser = {
    id: userId,
    name: params.name.trim(),
    email: emailNorm,
    password_hash: passwordHash,
    salt: salt,
    role: role,
    status: status,
    created_at: now
  };

  db.users[userId] = newUser;

  // Mark invite code as used if not the reusable master code
  const codeNorm = params.inviteCode.trim().toUpperCase();
  if (db.invite_codes[codeNorm] && codeNorm !== MASTER_INVITE_CODE.toUpperCase()) {
    db.invite_codes[codeNorm].is_active = 0;
    db.invite_codes[codeNorm].used_by = userId;
    db.invite_codes[codeNorm].used_at = now;
  }

  writeDatabase(db);

  const message = status === 'pending'
    ? 'Sua conta foi criada e está aguardando aprovação do administrador. Entre em contato para liberação.'
    : 'Usuário cadastrado e ativado com sucesso!';

  return {
    success: true,
    message,
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      status: newUser.status,
      created_at: newUser.created_at
    }
  };
}

export async function loginUser(email: string, password: string): Promise<{ success: boolean; user?: Omit<DbUser, 'password_hash' | 'salt'>; isGoogleConnected?: boolean; isPending?: boolean; isBlocked?: boolean; error?: string }> {
  const user = findUserByEmail(email);
  if (!user) {
    return { success: false, error: 'E-mail ou senha incorretos.' };
  }

  const isValid = await verifyPassword(password, user.salt, user.password_hash);
  if (!isValid) {
    return { success: false, error: 'E-mail ou senha incorretos.' };
  }

  const userStatus = user.status || 'active';

  // Enforce status checks
  if (userStatus === 'pending') {
    return {
      success: false,
      isPending: true,
      error: 'Sua conta foi criada e está aguardando aprovação do administrador. Entre em contato para liberação.'
    };
  }

  if (userStatus === 'blocked') {
    return {
      success: false,
      isBlocked: true,
      error: 'Sua conta foi bloqueada pelo administrador. Entre em contato com o suporte.'
    };
  }

  return {
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status || 'active',
      created_at: user.created_at,
      google_email: user.google_email,
      google_connected_at: user.google_connected_at
    },
    isGoogleConnected: !!(user.google_access_token || user.google_refresh_token)
  };
}

export function saveUserGoogleTokens(userId: string, tokens: {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  googleEmail?: string;
}): { success: boolean; error?: string } {
  try {
    const db = readDatabase();
    if (!db.users) {
      db.users = {};
    }

    // Try finding user by ID or by email
    let user = db.users[userId];
    if (!user) {
      const foundEntry = Object.values(db.users).find((u: DbUser) => u.id === userId || u.email === userId);
      if (foundEntry) {
        user = foundEntry;
      }
    }

    if (!user) {
      console.warn(`[Merlin DB] Usuário ${userId} não encontrado para salvar tokens Google.`);
      return { success: false, error: 'Usuário não encontrado na base de dados.' };
    }

    const now = Date.now();
    if (tokens.accessToken) {
      user.google_access_token = tokens.accessToken;
    }
    if (tokens.refreshToken) {
      user.google_refresh_token = tokens.refreshToken;
    }
    if (tokens.expiresIn) {
      user.google_token_expiry = now + (tokens.expiresIn * 1000);
    }
    if (tokens.googleEmail) {
      user.google_email = tokens.googleEmail;
    }
    user.google_connected_at = new Date().toISOString();

    writeDatabase(db);
    console.log(`[Merlin DB] Tokens Google persistidos com sucesso para o usuário ${user.email} (${user.id}).`);
    return { success: true };
  } catch (error: any) {
    console.error('[Merlin DB] Falha ao persistir tokens Google:', error);
    return { success: false, error: error.message || 'Falha ao salvar tokens no banco de dados.' };
  }
}

export function removeUserGoogleTokens(userId: string): { success: boolean; error?: string } {
  try {
    const db = readDatabase();
    if (!db.users) {
      return { success: true };
    }

    let user = db.users[userId];
    if (!user) {
      const foundEntry = Object.values(db.users).find((u: DbUser) => u.id === userId || u.email === userId);
      if (foundEntry) {
        user = foundEntry;
      }
    }

    if (!user) {
      return { success: false, error: 'Usuário não encontrado.' };
    }

    user.google_access_token = null;
    user.google_refresh_token = null;
    user.google_token_expiry = null;
    user.google_email = null;
    user.google_connected_at = null;

    writeDatabase(db);
    console.log(`[Merlin DB] Conexão Google removida para usuário ${user.email} (${user.id}).`);
    return { success: true };
  } catch (error: any) {
    console.error('[Merlin DB] Erro ao remover tokens Google:', error);
    return { success: false, error: error.message || 'Erro ao remover tokens do banco de dados.' };
  }
}

export function getUserGoogleTokens(userId: string): {
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiry?: number | null;
  googleEmail?: string | null;
  connectedAt?: string | null;
  isConnected: boolean;
} {
  try {
    const db = readDatabase();
    if (!db.users) {
      return { isConnected: false };
    }

    let user = db.users[userId];
    if (!user) {
      const foundEntry = Object.values(db.users).find((u: DbUser) => u.id === userId || u.email === userId);
      if (foundEntry) {
        user = foundEntry;
      }
    }

    if (!user) {
      return { isConnected: false };
    }

    const isConnected = !!(user.google_access_token || user.google_refresh_token);
    return {
      accessToken: user.google_access_token,
      refreshToken: user.google_refresh_token,
      tokenExpiry: user.google_token_expiry,
      googleEmail: user.google_email,
      connectedAt: user.google_connected_at,
      isConnected
    };
  } catch (error) {
    console.error('[Merlin DB] Erro ao consultar tokens Google:', error);
    return { isConnected: false };
  }
}

// Invite Code Management (for Admin)
export function createInviteCode(adminUserId: string, customCode?: string): { success: boolean; invite?: DbInviteCode; error?: string } {
  const db = readDatabase();
  const user = db.users[adminUserId];

  if (!user || user.role !== 'admin') {
    return { success: false, error: 'Apenas administradores podem gerar novos códigos de convite.' };
  }

  const code = (customCode ? customCode.trim().toUpperCase() : generateRandomCode('MERLIN')).replace(/\s+/g, '-');
  
  if (db.invite_codes[code]) {
    return { success: false, error: 'Este código de convite já existe.' };
  }

  const newInvite: DbInviteCode = {
    code: code,
    created_by: adminUserId,
    used_by: null,
    used_at: null,
    is_active: 1,
    created_at: new Date().toISOString()
  };

  db.invite_codes[code] = newInvite;
  writeDatabase(db);

  return { success: true, invite: newInvite };
}

export function listInviteCodes(): Array<DbInviteCode & { used_by_name?: string; used_by_email?: string }> {
  const db = readDatabase();
  const invites = Object.values(db.invite_codes || {}).map(inv => {
    let usedByName: string | undefined;
    let usedByEmail: string | undefined;
    if (inv.used_by && db.users[inv.used_by]) {
      usedByName = db.users[inv.used_by].name;
      usedByEmail = db.users[inv.used_by].email;
    }
    return {
      ...inv,
      used_by_name: usedByName,
      used_by_email: usedByEmail
    };
  });

  return invites.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function revokeInviteCode(adminUserId: string, code: string): { success: boolean; error?: string } {
  const db = readDatabase();
  const user = db.users[adminUserId];

  if (!user || user.role !== 'admin') {
    return { success: false, error: 'Apenas administradores podem revogar convites.' };
  }

  const codeNorm = code.trim().toUpperCase();
  if (!db.invite_codes[codeNorm]) {
    return { success: false, error: 'Código de convite não encontrado.' };
  }

  db.invite_codes[codeNorm].is_active = 0;
  writeDatabase(db);
  return { success: true };
}

// User Management (for Admin)
export function listUsers(adminUserId?: string): { success: boolean; users?: Array<Omit<DbUser, 'password_hash' | 'salt'>>; error?: string } {
  const db = readDatabase();
  
  if (adminUserId) {
    const admin = db.users[adminUserId];
    if (!admin || admin.role !== 'admin') {
      return { success: false, error: 'Acesso restrito a administradores.' };
    }
  }

  const usersList = Object.values(db.users || {}).map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status || 'active',
    created_at: u.created_at,
    google_email: u.google_email,
    google_connected_at: u.google_connected_at,
    isGoogleConnected: !!(u.google_access_token || u.google_refresh_token)
  }));

  usersList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return { success: true, users: usersList };
}

export function updateUserStatus(
  adminUserId: string,
  targetUserId: string,
  newStatus: 'pending' | 'active' | 'blocked'
): { success: boolean; user?: Omit<DbUser, 'password_hash' | 'salt'>; error?: string } {
  const db = readDatabase();
  const admin = db.users[adminUserId];

  if (!admin || admin.role !== 'admin') {
    return { success: false, error: 'Apenas administradores podem alterar o status de usuários.' };
  }

  const targetUser = db.users[targetUserId];
  if (!targetUser) {
    return { success: false, error: 'Usuário não encontrado.' };
  }

  // Prevent admin from blocking themselves
  if (adminUserId === targetUserId && newStatus !== 'active') {
    return { success: false, error: 'Você não pode desativar ou bloquear sua própria conta de administrador.' };
  }

  targetUser.status = newStatus;
  writeDatabase(db);

  return {
    success: true,
    user: {
      id: targetUser.id,
      name: targetUser.name,
      email: targetUser.email,
      role: targetUser.role,
      status: targetUser.status,
      created_at: targetUser.created_at
    }
  };
}

export function deleteUser(
  adminUserId: string,
  targetUserId: string
): { success: boolean; error?: string } {
  const db = readDatabase();
  const admin = db.users[adminUserId];

  if (!admin || admin.role !== 'admin') {
    return { success: false, error: 'Apenas administradores podem excluir usuários.' };
  }

  if (adminUserId === targetUserId) {
    return { success: false, error: 'Você não pode excluir sua própria conta de administrador.' };
  }

  if (!db.users[targetUserId]) {
    return { success: false, error: 'Usuário não encontrado.' };
  }

  delete db.users[targetUserId];

  // Clean up any invite codes used by this user
  for (const inv of Object.values(db.invite_codes || {})) {
    if (inv.used_by === targetUserId) {
      inv.used_by = null;
      inv.used_at = null;
      inv.is_active = 1;
    }
  }

  writeDatabase(db);
  return { success: true };
}

// CRM Data Operations with User Isolation
export function getAllData(userId?: string) {
  const db = readDatabase();

  const commentsList = Object.values(db.client_comments || {});
  const historyList = Object.values(db.client_history || {});

  let rawClients = Object.values(db.clients || {});
  let rawTasks = Object.values(db.tasks || {});
  let rawSales = Object.values(db.sales || {});

  // If userId is provided, filter records belonging to this user or unassigned
  if (userId) {
    rawClients = rawClients.filter((c: any) => !c.user_id || c.user_id === userId || c.user_id === 'default_broker');
    rawTasks = rawTasks.filter((t: any) => !t.user_id || t.user_id === userId || t.user_id === 'default_broker');
    rawSales = rawSales.filter((s: any) => !s.user_id || s.user_id === userId || s.user_id === 'default_broker');
  }

  const clients = rawClients.map((c: any) => {
    const clientComments = commentsList
      .filter((cm: any) => cm.clientId === c.id)
      .map((cm: any) => ({
        id: cm.id,
        date: cm.createdAt || cm.date,
        text: cm.text
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const clientHistory = historyList
      .filter((h: any) => h.clientId === c.id)
      .map((h: any) => ({
        id: h.id,
        date: h.date,
        action: h.action
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      ...c,
      tags: Array.isArray(c.tags) ? c.tags : (typeof c.tags === 'string' ? JSON.parse(c.tags || '[]') : []),
      secondBrainSummary: c.second_brain_summary || c.secondBrainSummary || undefined,
      secondBrainUpdatedAt: c.second_brain_updated_at || c.secondBrainUpdatedAt || undefined,
      comments: clientComments,
      history: clientHistory
    };
  });

  const tasks = rawTasks.sort((a: any, b: any) => 
    new Date(b.createdAt || b.dueDate).getTime() - new Date(a.createdAt || a.dueDate).getTime()
  );

  const sales = rawSales.sort((a: any, b: any) => 
    new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime()
  );

  const tags = Object.values(db.tags || {});

  return {
    clients,
    tasks,
    sales,
    tags,
    lastSyncedAt: db.meta?.lastSyncedAt || new Date().toISOString()
  };
}

export function syncAllData(payload: {
  clients?: any[];
  tasks?: any[];
  sales?: any[];
  tags?: any[];
}, userId?: string) {
  const db = readDatabase();
  const now = new Date().toISOString();

  // 1. Sync Tags
  if (Array.isArray(payload.tags)) {
    for (const tag of payload.tags) {
      if (tag && tag.id) {
        db.tags[tag.id] = { ...tag };
      }
    }
  }

  // 2. Sync Sales
  if (Array.isArray(payload.sales)) {
    for (const sale of payload.sales) {
      if (sale && sale.id) {
        db.sales[sale.id] = { 
          ...sale,
          user_id: sale.user_id || userId || 'default_broker'
        };
      }
    }
  }

  // 3. Sync Tasks
  if (Array.isArray(payload.tasks)) {
    for (const task of payload.tasks) {
      if (task && task.id) {
        db.tasks[task.id] = { 
          ...task,
          user_id: task.user_id || userId || 'default_broker'
        };
      }
    }
  }

  // 4. Sync Clients, Comments, History
  if (Array.isArray(payload.clients)) {
    for (const client of payload.clients) {
      if (client && client.id) {
        const { comments, history, ...clientFields } = client;
        
        db.clients[client.id] = {
          ...clientFields,
          user_id: clientFields.user_id || userId || 'default_broker',
          updatedAt: now
        };

        if (Array.isArray(comments)) {
          for (const comm of comments) {
            if (comm && comm.id) {
              db.client_comments[comm.id] = {
                id: comm.id,
                clientId: client.id,
                text: comm.text,
                createdAt: comm.date || comm.createdAt || now
              };
            }
          }
        }

        if (Array.isArray(history)) {
          for (const hist of history) {
            if (hist && hist.id) {
              db.client_history[hist.id] = {
                id: hist.id,
                clientId: client.id,
                action: hist.action,
                date: hist.date || now
              };
            }
          }
        }
      }
    }
  }

  db.meta.lastSyncedAt = now;
  writeDatabase(db);

  return {
    success: true,
    lastSyncedAt: now,
    counts: {
      clients: Object.keys(db.clients).length,
      tasks: Object.keys(db.tasks).length,
      sales: Object.keys(db.sales).length,
      tags: Object.keys(db.tags).length
    }
  };
}

export function saveClientSecondBrainSummary(clientId: string, summary: any, updatedAt?: string) {
  const db = readDatabase();
  const client = db.clients[clientId];
  if (!client) {
    return { success: false, error: 'Cliente não encontrado' };
  }

  const now = updatedAt || new Date().toISOString();
  client.second_brain_summary = summary;
  client.secondBrainSummary = summary;
  client.second_brain_updated_at = now;
  client.secondBrainUpdatedAt = now;
  client.updatedAt = now;

  writeDatabase(db);
  return { success: true, client };
}

export function getBrokerMemory(userId: string) {
  const db = readDatabase();
  return db.broker_memory?.[userId] || null;
}

export function saveBrokerMemory(userId: string, data: { communication_style?: string; custom_rules?: string }) {
  const db = readDatabase();
  if (!db.broker_memory) {
    db.broker_memory = {};
  }
  const now = new Date().toISOString();
  db.broker_memory[userId] = {
    user_id: userId,
    communication_style: data.communication_style || '',
    custom_rules: data.custom_rules || '',
    updated_at: now
  };
  writeDatabase(db);
  return { success: true, memory: db.broker_memory[userId] };
}

// -------------------------------------------------------------
// Agile Routine & Tasks Management Engine
// -------------------------------------------------------------

function getTodayIsoDate(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTasksGrouped(userId?: string) {
  const db = readDatabase();
  const todayStr = getTodayIsoDate();

  let rawTasks = Object.values(db.tasks || {});
  let rawClients = Object.values(db.clients || {});

  if (userId) {
    rawTasks = rawTasks.filter((t: any) => !t.user_id || t.user_id === userId || t.user_id === 'default_broker');
    rawClients = rawClients.filter((c: any) => !c.user_id || c.user_id === userId || c.user_id === 'default_broker');
  }

  // Enrich tasks with client information if missing
  const enrichedTasks = rawTasks.map((t: any) => {
    let clientName = t.clientName;
    let clientPhone = t.clientPhone;
    let clientStatus = t.clientStatus;
    let clientEmpreendimento = t.clientEmpreendimento;

    if (t.clientId && db.clients[t.clientId]) {
      const c = db.clients[t.clientId];
      clientName = clientName || c.name;
      clientPhone = clientPhone || c.phone;
      clientStatus = clientStatus || c.status;
      clientEmpreendimento = clientEmpreendimento || c.empreendimento;
    }

    return {
      ...t,
      clientName,
      clientPhone,
      clientStatus,
      clientEmpreendimento,
      completed: Boolean(t.completed)
    };
  });

  // Calculate 7 days ahead limit
  const d7 = new Date();
  d7.setDate(d7.getDate() + 7);
  const next7DaysStr = `${d7.getFullYear()}-${String(d7.getMonth() + 1).padStart(2, '0')}-${String(d7.getDate()).padStart(2, '0')}`;

  const overdue: any[] = [];
  const today: any[] = [];
  const upcoming: any[] = [];
  const completed: any[] = [];

  for (const task of enrichedTasks) {
    if (task.completed) {
      completed.push(task);
      continue;
    }

    if (task.dueDate < todayStr) {
      overdue.push(task);
    } else if (task.dueDate === todayStr) {
      today.push(task);
    } else {
      upcoming.push(task);
    }
  }

  // Sort by date & time
  const sortByDateTime = (a: any, b: any) => {
    const compDate = (a.dueDate || '').localeCompare(b.dueDate || '');
    if (compDate !== 0) return compDate;
    return (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99');
  };

  overdue.sort(sortByDateTime);
  today.sort(sortByDateTime);
  upcoming.sort(sortByDateTime);
  completed.sort((a: any, b: any) => new Date(b.completedAt || b.dueDate).getTime() - new Date(a.completedAt || a.dueDate).getTime());

  // Find stale critical leads (> 15 days without contact, active funil)
  const now = new Date();
  const staleClients: any[] = [];

  for (const c of rawClients) {
    if (c.status === 'Venda Fechada' || c.status === 'Perdido') continue;

    const lastContactStr = c.lastContactDate || c.createdAt;
    if (lastContactStr) {
      const contactDate = new Date(lastContactStr);
      if (!isNaN(contactDate.getTime())) {
        const diffDays = Math.floor((now.getTime() - contactDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 15) {
          staleClients.push({
            id: c.id,
            name: c.name,
            phone: c.phone,
            status: c.status,
            empreendimento: c.empreendimento,
            daysWithoutContact: diffDays,
            lastContactDate: c.lastContactDate,
            createdAt: c.createdAt
          });
        }
      }
    }
  }

  staleClients.sort((a, b) => b.daysWithoutContact - a.daysWithoutContact);

  return {
    success: true,
    todayStr,
    stats: {
      totalPending: overdue.length + today.length + upcoming.length,
      overdueCount: overdue.length,
      todayCount: today.length,
      upcomingCount: upcoming.length,
      completedCount: completed.length,
      staleClientsCount: staleClients.length
    },
    overdue,
    today,
    upcoming,
    completed,
    staleClients
  };
}

export function completeTask(taskId: string, userId?: string) {
  const db = readDatabase();
  const task = db.tasks[taskId];

  if (!task) {
    return { success: false, error: 'Tarefa não encontrada.' };
  }

  const now = new Date().toISOString();
  task.completed = true;
  task.completedAt = now;
  task.updatedAt = now;

  let clientHistoryAdded = false;

  // Add entry to client history if linked to a client
  if (task.clientId && db.clients[task.clientId]) {
    const client = db.clients[task.clientId];
    const historyId = `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    if (!db.client_history) {
      db.client_history = {};
    }

    db.client_history[historyId] = {
      id: historyId,
      clientId: client.id,
      action: `Tarefa concluída: "${task.actionType} - ${task.notes || 'Sem observações'}"`,
      date: now
    };

    client.updatedAt = now;
    clientHistoryAdded = true;
  }

  writeDatabase(db);

  return {
    success: true,
    task,
    clientHistoryAdded,
    googleCalendarEventId: task.googleCalendarEventId || task.google_event_id || null
  };
}

export function rescheduleTask(taskId: string, newDueDate: string, newDueTime?: string, userId?: string) {
  const db = readDatabase();
  const task = db.tasks[taskId];

  if (!task) {
    return { success: false, error: 'Tarefa não encontrada.' };
  }

  const now = new Date().toISOString();
  task.dueDate = newDueDate;
  if (newDueTime !== undefined) {
    task.dueTime = newDueTime;
  }
  task.completed = false;
  task.updatedAt = now;

  // If linked to a client, optionally update next contact date
  if (task.clientId && db.clients[task.clientId]) {
    const client = db.clients[task.clientId];
    client.nextContactDate = newDueTime ? `${newDueDate}T${newDueTime}` : `${newDueDate}T10:00`;
    client.updatedAt = now;
  }

  writeDatabase(db);

  return {
    success: true,
    task
  };
}


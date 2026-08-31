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
    }
    if (!parsed.invite_codes) {
      parsed.invite_codes = {};
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
}): Promise<{ success: boolean; user?: Omit<DbUser, 'password_hash' | 'salt'>; error?: string }> {
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
  
  // If master code was used, assign role 'admin', otherwise 'broker'
  const role: 'admin' | 'broker' = inviteCheck.isMaster ? 'admin' : 'broker';

  const newUser: DbUser = {
    id: userId,
    name: params.name.trim(),
    email: emailNorm,
    password_hash: passwordHash,
    salt: salt,
    role: role,
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

  return {
    success: true,
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      created_at: newUser.created_at
    }
  };
}

export async function loginUser(email: string, password: string): Promise<{ success: boolean; user?: Omit<DbUser, 'password_hash' | 'salt'>; error?: string }> {
  const user = findUserByEmail(email);
  if (!user) {
    return { success: false, error: 'E-mail ou senha incorretos.' };
  }

  const isValid = await verifyPassword(password, user.salt, user.password_hash);
  if (!isValid) {
    return { success: false, error: 'E-mail ou senha incorretos.' };
  }

  return {
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      created_at: user.created_at
    }
  };
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

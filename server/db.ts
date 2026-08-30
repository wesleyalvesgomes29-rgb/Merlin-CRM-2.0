import fs from 'fs';
import path from 'path';
import { INITIAL_CLIENTS, DEFAULT_TAGS, INITIAL_SALES } from '../src/data/seed';

const DATA_DIR = path.join(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'merlin_db.json');

export interface DatabaseSchema {
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

function getInitialDatabase(): DatabaseSchema {
  const db: DatabaseSchema = {
    clients: {},
    client_comments: {},
    client_history: {},
    tasks: {},
    sales: {},
    tags: {},
    meta: {
      lastSyncedAt: new Date().toISOString(),
      version: 1
    }
  };

  // Seed Tags
  for (const tag of DEFAULT_TAGS) {
    db.tags[tag.id] = { ...tag };
  }

  // Seed Sales
  for (const sale of INITIAL_SALES) {
    db.sales[sale.id] = { ...sale };
  }

  // Seed Clients with Comments and History
  for (const client of INITIAL_CLIENTS) {
    const { comments, history, ...clientFields } = client;
    db.clients[client.id] = {
      ...clientFields,
      updatedAt: new Date().toISOString()
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

export function getAllData() {
  const db = readDatabase();

  const commentsList = Object.values(db.client_comments || {});
  const historyList = Object.values(db.client_history || {});

  const clients = Object.values(db.clients || {}).map((c: any) => {
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

  const tasks = Object.values(db.tasks || {}).sort((a: any, b: any) => 
    new Date(b.createdAt || b.dueDate).getTime() - new Date(a.createdAt || a.dueDate).getTime()
  );

  const sales = Object.values(db.sales || {}).sort((a: any, b: any) => 
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
}) {
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
        db.sales[sale.id] = { ...sale };
      }
    }
  }

  // 3. Sync Tasks
  if (Array.isArray(payload.tasks)) {
    for (const task of payload.tasks) {
      if (task && task.id) {
        db.tasks[task.id] = { ...task };
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

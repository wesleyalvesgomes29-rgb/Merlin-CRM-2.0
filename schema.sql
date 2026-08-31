-- Merlin CRM - Schema Relacional SQLite / Cloudflare D1
-- Tabelas estruturadas para usuários, convites, clientes, histórico, tarefas, vendas e etiquetas

-- 1. Tabela de Usuários
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT DEFAULT 'broker', -- 'admin' ou 'broker'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'active', 'blocked'
  google_access_token TEXT,
  google_refresh_token TEXT,
  google_token_expiry INTEGER,
  google_email TEXT,
  google_connected_at TEXT,
  created_at TEXT NOT NULL
);

-- Tabela de Integrações de Usuário (opcional / suporte robusto a múltiplos serviços)
CREATE TABLE IF NOT EXISTS user_integrations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL, -- 'google_calendar'
  access_token TEXT,
  refresh_token TEXT,
  token_expiry INTEGER,
  account_email TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 2. Tabela de Códigos de Convite Secreto
CREATE TABLE IF NOT EXISTS invite_codes (
  code TEXT PRIMARY KEY,
  created_by TEXT,
  used_by TEXT,
  used_at TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (used_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 3. Tabela de Clientes (com user_id para isolamento)
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  empreendimento TEXT,
  origem TEXT,
  status TEXT NOT NULL DEFAULT 'Lead Novo',
  notes TEXT,
  tags TEXT, -- JSON Array stringificado de tags, ex: '["Alto Padrão", "Investidor"]'
  next_contact_date TEXT,
  contact_count INTEGER NOT NULL DEFAULT 0,
  last_contact_date TEXT,
  second_brain_summary TEXT, -- JSON stringificado da síntese comportamental do lead
  second_brain_updated_at TEXT, -- Data/hora ISO da última síntese
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de Memória Comportamental e Diretrizes do Corretor (Second Brain Global)
CREATE TABLE IF NOT EXISTS broker_memory (
  user_id TEXT PRIMARY KEY,
  communication_style TEXT,
  custom_rules TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Tabela de Comentários / Anotações do Cliente
CREATE TABLE IF NOT EXISTS client_comments (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- 5. Tabela de Histórico de Ações do Cliente
CREATE TABLE IF NOT EXISTS client_history (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  action TEXT NOT NULL,
  date TEXT NOT NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- 6. Tabela de Tarefas e Rotina (com user_id para isolamento)
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  client_id TEXT,
  client_name TEXT,
  action_type TEXT NOT NULL,
  due_date TEXT NOT NULL,
  due_time TEXT,
  priority TEXT NOT NULL DEFAULT 'Média',
  completed INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

-- 7. Tabela de Vendas e Comissões (com user_id para isolamento)
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  client_id TEXT,
  client_name TEXT NOT NULL,
  property_name TEXT,
  sale_date TEXT NOT NULL,
  vgv REAL DEFAULT 0,
  commission_rate REAL DEFAULT 0,
  commission_value REAL NOT NULL DEFAULT 0,
  payment_status TEXT DEFAULT 'Recebido',
  notes TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

-- 8. Tabela de Tags / Etiquetas do CRM
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  color TEXT NOT NULL
);

-- Índices para Otimização de Consultas Rápidas
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_invite_codes_active ON invite_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_next_contact ON clients(next_contact_date);
CREATE INDEX IF NOT EXISTS idx_comments_client_id ON client_comments(client_id);
CREATE INDEX IF NOT EXISTS idx_history_client_id ON client_history(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_client_id ON tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date);


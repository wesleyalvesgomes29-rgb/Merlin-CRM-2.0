-- Merlin CRM - Schema Relacional SQLite / Cloudflare D1
-- Tabelas estruturadas para clientes, histórico, anotações, tarefas, vendas e etiquetas

-- 1. Tabela de Clientes
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
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
  created_at TEXT NOT NULL,
  updated_at TEXT
);

-- 2. Tabela de Comentários / Anotações do Cliente
CREATE TABLE IF NOT EXISTS client_comments (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- 3. Tabela de Histórico de Ações do Cliente
CREATE TABLE IF NOT EXISTS client_history (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  action TEXT NOT NULL,
  date TEXT NOT NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- 4. Tabela de Tarefas e Rotina (Merlin Second Brain)
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  client_id TEXT,
  client_name TEXT,
  action_type TEXT NOT NULL,
  due_date TEXT NOT NULL,
  due_time TEXT,
  priority TEXT NOT NULL DEFAULT 'Média',
  completed INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

-- 5. Tabela de Vendas e Comissões
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  client_id TEXT,
  client_name TEXT NOT NULL,
  property_name TEXT,
  sale_date TEXT NOT NULL,
  vgv REAL DEFAULT 0,
  commission_rate REAL DEFAULT 0,
  commission_value REAL NOT NULL DEFAULT 0,
  payment_status TEXT DEFAULT 'Recebido',
  notes TEXT,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

-- 6. Tabela de Tags / Etiquetas do CRM
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  color TEXT NOT NULL
);

-- Índices para Otimização de Consultas Rápidas
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_next_contact ON clients(next_contact_date);
CREATE INDEX IF NOT EXISTS idx_comments_client_id ON client_comments(client_id);
CREATE INDEX IF NOT EXISTS idx_history_client_id ON client_history(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_client_id ON tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date);

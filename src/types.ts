export type ClientStatus =
  | 'Lead Novo'
  | 'Contato'
  | 'Em Atendimento'
  | 'Retrabalho'
  | 'Agendado'
  | 'Visitou'
  | 'Proposta'
  | 'Documentação'
  | 'Venda Fechada'
  | 'Perdido';

export interface HistoryEntry {
  id: string;
  date: string;
  action: string;
}

export interface CommentEntry {
  id: string;
  date: string;
  text: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
  notes: string;
  tags: string[]; // names of the tags
  status: ClientStatus;
  nextContactDate: string | null; // ISO DateTime format or YYYY-MM-DDThh:mm
  contactCount: number;
  lastContactDate: string | null; // ISO DateTime
  history: HistoryEntry[];
  comments: CommentEntry[];
  email?: string;
  empreendimento?: string;
  origem?: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string; // Tailwind color e.g. "bg-emerald-500 text-white" or border colors
}

export interface Sale {
  id: string;
  clientId?: string;
  clientName: string;
  commissionValue: number;
  saleDate: string; // YYYY-MM-DD
  vgv?: number; // Valor Geral de Vendas do Imóvel
  propertyName?: string; // Nome do Empreendimento / Unidade
  commissionRate?: number; // Percentual praticado ex: 3%
  paymentStatus?: 'Recebido' | 'A Receber' | 'Em Análise';
  notes?: string;
}

export interface Task {
  id: string;
  clientId?: string; // Linked client ID from CRM
  clientName?: string; // Stored name for quick display/fallback
  actionType: string; // 'Ligação' | 'WhatsApp' | 'Visita' | 'Enviar Proposta' | 'Outro'
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:MM
  priority: 'Alta' | 'Média' | 'Baixa';
  notes?: string;
  completed: boolean;
  createdAt: string;
}


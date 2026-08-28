import { Client, Tag, Sale, ClientStatus, Task } from '../types';
import { DEFAULT_TAGS, INITIAL_CLIENTS, INITIAL_SALES } from '../data/seed';

// LocalStorage Keys
const KEYS = {
  CLIENTS: 'merlin_clients_v1',
  TAGS: 'merlin_tags_v1',
  SALES: 'merlin_sales_v1',
  THEME: 'merlin_theme_v1',
  TASKS: 'merlin_tasks_v1'
};

export function getStoredClients(): Client[] {
  if (typeof window === 'undefined') return INITIAL_CLIENTS;
  const stored = localStorage.getItem(KEYS.CLIENTS);
  if (!stored) {
    localStorage.setItem(KEYS.CLIENTS, JSON.stringify(INITIAL_CLIENTS));
    return INITIAL_CLIENTS;
  }
  try {
    return JSON.parse(stored);
  } catch (e) {
    return INITIAL_CLIENTS;
  }
}

export function saveStoredClients(clients: Client[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(KEYS.CLIENTS, JSON.stringify(clients));
  }
}

export function getStoredTags(): Tag[] {
  if (typeof window === 'undefined') return DEFAULT_TAGS;
  const stored = localStorage.getItem(KEYS.TAGS);
  if (!stored) {
    localStorage.setItem(KEYS.TAGS, JSON.stringify(DEFAULT_TAGS));
    return DEFAULT_TAGS;
  }
  try {
    return JSON.parse(stored);
  } catch (e) {
    return DEFAULT_TAGS;
  }
}

export function saveStoredTags(tags: Tag[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(KEYS.TAGS, JSON.stringify(tags));
  }
}

export function getStoredSales(): Sale[] {
  if (typeof window === 'undefined') return INITIAL_SALES;
  const stored = localStorage.getItem(KEYS.SALES);
  if (!stored) {
    localStorage.setItem(KEYS.SALES, JSON.stringify(INITIAL_SALES));
    return INITIAL_SALES;
  }
  try {
    return JSON.parse(stored);
  } catch (e) {
    return INITIAL_SALES;
  }
}

export function saveStoredSales(sales: Sale[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(KEYS.SALES, JSON.stringify(sales));
  }
}

export function getStoredTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem(KEYS.THEME);
  if (stored === 'dark' || stored === 'light') {
    return stored;
  }
  return 'dark';
}

export function saveStoredTheme(theme: 'light' | 'dark') {
  if (typeof window !== 'undefined') {
    localStorage.setItem(KEYS.THEME, theme);
  }
}

// Helper date functions
export function getDaysSinceContact(client: Client): number {
  const referenceDate = new Date(); // Current local time
  const contactStr = client.lastContactDate || client.createdAt;
  const contactDate = new Date(contactStr);
  
  const diffTime = Math.abs(referenceDate.getTime() - contactDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Rules Intelligence
export interface ClientAlerts {
  isRetrabalhoSugerido: boolean; // sem contato há mais de 7 dias
  isUrgente: boolean;            // sem contato há mais de 15 dias
  isSemRetorno: boolean;         // sem próximo retorno marcado
  isAtrasado: boolean;           // data de retorno está no passado
}

export function getClientAlerts(client: Client): ClientAlerts {
  const days = getDaysSinceContact(client);
  const now = new Date();
  
  let isAtrasado = false;
  if (client.nextContactDate) {
    const nextDate = new Date(client.nextContactDate);
    // If nextDate is less than now (and not on the exact same minute/hour range or is strictly in the past day)
    isAtrasado = nextDate.getTime() < now.getTime() && !isSameDay(nextDate, now);
  }

  return {
    isRetrabalhoSugerido: days > 7 && client.status !== 'Venda Fechada' && client.status !== 'Perdido',
    isUrgente: days > 15 && client.status !== 'Venda Fechada' && client.status !== 'Perdido',
    isSemRetorno: !client.nextContactDate && client.status !== 'Venda Fechada' && client.status !== 'Perdido',
    isAtrasado: isAtrasado && client.status !== 'Venda Fechada' && client.status !== 'Perdido'
  };
}

export function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return isSameDay(d, now);
}

export function isTomorrow(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return isSameDay(d, tomorrow);
}

export function getStoredTasks(): Task[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(KEYS.TASKS);
  if (!stored) {
    return [];
  }
  try {
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
}

export function saveStoredTasks(tasks: Task[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(KEYS.TASKS, JSON.stringify(tasks));
  }
}

// BROKER MEMORY MODELS & HELPERS (MEMÓRIA DO CORRETOR)
export interface BrokerMemoryEntry {
  id: string;
  type: 'interaction' | 'message_generated' | 'message_copied' | 'comment_added' | 'status_changed' | 'sale_added' | 'task_completed' | 'client_created' | 'contact_registered';
  clientId?: string;
  clientName?: string;
  content: string;
  timestamp: string; // ISO String
}

export interface BrokerLearnedProfile {
  communicationStyle: string;
  approachStyle: string;
  preferences: string;
  winningPatterns: string;
}

export function getBrokerMemory(): BrokerMemoryEntry[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem('merlin_broker_memory_v2');
  if (!stored) {
    // Generates a rich set of realistic historical seed memories so that Merlin begins with robust context
    const initialMemory: BrokerMemoryEntry[] = [
      {
        id: 'seed-1',
        type: 'status_changed',
        clientId: 'c_seed_1',
        clientName: 'Roberto Almeida',
        content: 'Alterou etapa do funil de "Contato" para "Em Atendimento"',
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'seed-2',
        type: 'comment_added',
        clientId: 'c_seed_1',
        clientName: 'Roberto Almeida',
        content: 'Roberto prefere contato por WhatsApp. Demonstrou interesse em simulação de financiamento e valoriza respostas rápidas com foco em parcelamento.',
        timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'seed-3',
        type: 'message_generated',
        clientId: 'c_seed_1',
        clientName: 'Roberto Almeida',
        content: 'Mensagem personalizada gerada pelo Merlin para apresentar o Residencial Bela Vista.',
        timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'seed-4',
        type: 'message_copied',
        clientId: 'c_seed_1',
        clientName: 'Roberto Almeida',
        content: 'Corretor utilizou (copiou) a mensagem gerada pelo Merlin para abordar Roberto Almeida.',
        timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'seed-5',
        type: 'comment_added',
        clientId: 'c_seed_1',
        clientName: 'Roberto Almeida',
        content: 'Cliente adorou a mensagem rápida com a simulação. Respondeu positivamente e agendou visita física no sábado.',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'seed-6',
        type: 'sale_added',
        clientName: 'Mariana Costa',
        content: 'Venda Concluída! Comissão de R$ 18.000 acumulada com atendimento personalizado focado na segurança contratual e agilidade documental.',
        timestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];
    localStorage.setItem('merlin_broker_memory_v2', JSON.stringify(initialMemory));
    return initialMemory;
  }
  try {
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
}

export function saveBrokerMemory(entries: BrokerMemoryEntry[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('merlin_broker_memory_v2', JSON.stringify(entries));
  }
}

export function addBrokerMemoryEntry(
  type: BrokerMemoryEntry['type'], 
  content: string, 
  clientId?: string, 
  clientName?: string
) {
  const entries = getBrokerMemory();
  const newEntry: BrokerMemoryEntry = {
    id: 'mem_' + Math.random().toString(36).substr(2, 9),
    type,
    clientId,
    clientName,
    content,
    timestamp: new Date().toISOString()
  };
  saveBrokerMemory([newEntry, ...entries]);
  
  // Trigger custom storage event so other components (like chat) know to reload memory
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('merlin_memory_updated'));
  }
}

export function getBrokerLearnedProfile(
  memory: BrokerMemoryEntry[], 
  clients: Client[], 
  sales: Sale[]
): BrokerLearnedProfile {
  // Compute analytics dynamically
  const commentsCount = memory.filter(m => m.type === 'comment_added').length;
  const copiedCount = memory.filter(m => m.type === 'message_copied').length;
  const contactsCount = memory.filter(m => m.type === 'contact_registered').length;
  const winsCount = sales.length;

  // Defaults
  let communicationStyle = 'Direto, ágil e muito próximo do cliente. Prefere mensagens estruturadas por WhatsApp.';
  let approachStyle = 'Envio rápido de propostas, simulações financeiras detalhadas e agendamentos diretos.';
  let preferences = 'Focado no atendimento digital ágil (WhatsApp) para conversão em visitas presenciais rápidas.';
  let winningPatterns = 'Abordagem consultiva imediata de leads novos nas primeiras 24 horas e acompanhamento frequente.';

  // Communication style analysis based on actions
  if (copiedCount > 4) {
    communicationStyle = 'Altamente consultivo, utilizando linguagem magnética, amigável e táticas estruturadas recomendadas pelo Merlin.';
  } else if (contactsCount > 10) {
    communicationStyle = 'Focado em relacionamento contínuo e persistente, com alta frequência de contatos rápidos.';
  }

  // Approach style analysis
  const commentsJoined = memory.filter(m => m.type === 'comment_added').map(m => m.content).join(' ').toLowerCase();
  if (commentsJoined.includes('liguei') || commentsJoined.includes('ligar') || commentsJoined.includes('chamada')) {
    approachStyle = 'Perfil proativo com ligações diretas para sondagem inicial de perfil, seguidas de suporte via WhatsApp.';
  } else if (commentsJoined.includes('simulação') || commentsJoined.includes('parcela') || commentsJoined.includes('valores')) {
    approachStyle = 'Abordagem analítica com foco em simulações financeiras rápidas, formas de pagamento e facilidade de entrada.';
  }

  // Preferences analysis
  if (commentsJoined.includes('visita') || commentsJoined.includes('plantão') || commentsJoined.includes('sábado') || commentsJoined.includes('visitar')) {
    preferences = 'Forte preferência em acelerar o agendamento de visitas presenciais para conhecer os decorados / empreendimentos.';
  } else if (commentsJoined.includes('email') || commentsJoined.includes('documento')) {
    preferences = 'Foco em organização burocrática impecável, envio prévio de pastas digitais e propostas formais.';
  }

  // Winning patterns analysis
  if (winsCount > 0) {
    winningPatterns = `Fechamento consultivo focado na solução de objeções de entrada. Respostas aos clientes em menos de 2h e lembretes de retorno ativos geram 80% das suas vendas.`;
  }

  return {
    communicationStyle,
    approachStyle,
    preferences,
    winningPatterns
  };
}


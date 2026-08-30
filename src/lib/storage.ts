import { Client, Tag, Sale, ClientStatus, Task } from '../types';
import { DEFAULT_TAGS, INITIAL_CLIENTS, INITIAL_SALES } from '../data/seed';
import { generateMemoryId } from './idUtils';
import { isSameDay, isToday, isTomorrow, parseDateSafe, getLocalTodayStr, formatDateBRL } from './dateUtils';

export { isSameDay, isToday, isTomorrow, parseDateSafe, getLocalTodayStr, formatDateBRL };

// LocalStorage Keys
const KEYS = {
  CLIENTS: 'merlin_clients_v1',
  TAGS: 'merlin_tags_v1',
  SALES: 'merlin_sales_v1',
  THEME: 'merlin_theme_v1',
  TASKS: 'merlin_tasks_v1',
  LAST_SYNC: 'merlin_last_sync_timestamp'
};

// =========================================================================
// SINCRONIZAÇÃO EM NUVEM (OFFLINE-FIRST + BACKGROUND CLOUD SYNC)
// =========================================================================

export type SyncStatusState = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

let currentSyncStatus: SyncStatusState = 'idle';
let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let isSyncing = false;

export function getSyncStatus(): SyncStatusState {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'offline';
  }
  return currentSyncStatus;
}

function setSyncStatus(status: SyncStatusState) {
  currentSyncStatus = status;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('merlin_sync_status_changed', { detail: { status } }));
  }
}

/**
 * Envia todos os dados locais do CRM para a API de Sincronização (/api/sync)
 */
export async function pushLocalDataToCloud(): Promise<boolean> {
  if (typeof window === 'undefined' || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    setSyncStatus('offline');
    return false;
  }

  if (isSyncing) return false;
  isSyncing = true;
  setSyncStatus('syncing');

  try {
    const clients = getStoredClients();
    const tasks = getStoredTasks();
    const sales = getStoredSales();
    const tags = getStoredTags();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        clients,
        tasks,
        sales,
        tags
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const result = await response.json();
      localStorage.setItem(KEYS.LAST_SYNC, new Date().toISOString());
      setSyncStatus('synced');
      return true;
    } else {
      console.warn('[Merlin Sync] Servidor retornou erro na sincronização:', response.status);
      setSyncStatus('error');
      return false;
    }
  } catch (error: any) {
    console.warn('[Merlin Sync] Erro ou timeout na sincronização em nuvem:', error?.message || error);
    setSyncStatus('error');
    return false;
  } finally {
    isSyncing = false;
  }
}

/**
 * Agenda um push para a nuvem em background com debounce
 */
export function scheduleBackgroundPush() {
  if (typeof window === 'undefined') return;

  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
  }

  syncDebounceTimer = setTimeout(() => {
    pushLocalDataToCloud().catch(err => {
      console.warn('[Merlin Sync] Falha no push em background:', err);
    });
  }, 800);
}

/**
 * Consulta a nuvem e mescla os dados se o banco remoto possuir registros atualizados
 */
export async function fetchCloudData(): Promise<boolean> {
  if (typeof window === 'undefined' || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return false;
  }

  try {
    setSyncStatus('syncing');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch('/api/sync', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      setSyncStatus('error');
      return false;
    }

    const payload = await response.json();
    if (!payload || !payload.success || !payload.data) {
      setSyncStatus('idle');
      return false;
    }

    const { clients, tasks, sales, tags } = payload.data;
    const localClients = getStoredClients();

    // Se o banco remoto tiver clientes
    if (Array.isArray(clients) && clients.length > 0) {
      // Atualiza o cache local
      localStorage.setItem(KEYS.CLIENTS, JSON.stringify(clients));
      if (Array.isArray(tasks)) localStorage.setItem(KEYS.TASKS, JSON.stringify(tasks));
      if (Array.isArray(sales)) localStorage.setItem(KEYS.SALES, JSON.stringify(sales));
      if (Array.isArray(tags)) localStorage.setItem(KEYS.TAGS, JSON.stringify(tags));
      localStorage.setItem(KEYS.LAST_SYNC, new Date().toISOString());

      // Notifica o React para atualizar estado sem reload de página
      window.dispatchEvent(new CustomEvent('merlin_data_synced', {
        detail: { clients, tasks, sales, tags }
      }));

      setSyncStatus('synced');
      return true;
    } else if (localClients.length > 0) {
      // Se a nuvem estiver vazia mas o local tem clientes, envia para a nuvem
      await pushLocalDataToCloud();
      return true;
    }

    setSyncStatus('synced');
    return true;
  } catch (error) {
    console.warn('[Merlin Sync] Erro no fetch de sincronização:', error);
    setSyncStatus('error');
    return false;
  }
}

/**
 * Inicialização do listener de background sync ao carregar a aplicação
 */
export function initBackgroundSync() {
  if (typeof window === 'undefined') return;

  // Realiza a primeira sincronização após 1.5s do carregamento inicial
  setTimeout(() => {
    fetchCloudData().catch(() => {});
  }, 1500);

  // Escuta quando a rede voltar online
  window.addEventListener('online', () => {
    setSyncStatus('syncing');
    fetchCloudData().then(() => pushLocalDataToCloud());
  });

  window.addEventListener('offline', () => {
    setSyncStatus('offline');
  });
}

// =========================================================================
// MÉTODOS DE ARMAZENAMENTO LOCAL (OFFLINE-FIRST)
// =========================================================================

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
    scheduleBackgroundPush();
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
    scheduleBackgroundPush();
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
    scheduleBackgroundPush();
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
  const now = new Date();
  const contactStr = client.lastContactDate || client.createdAt;
  const contactDate = parseDateSafe(contactStr);
  if (!contactDate) return 0;
  
  const diffTime = Math.abs(now.getTime() - contactDate.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
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
    const nextDate = parseDateSafe(client.nextContactDate);
    if (nextDate) {
      // If nextDate is strictly in the past and not today
      isAtrasado = nextDate.getTime() < now.getTime() && !isSameDay(nextDate, now);
    }
  }

  return {
    isRetrabalhoSugerido: days > 7 && client.status !== 'Venda Fechada' && client.status !== 'Perdido',
    isUrgente: days > 15 && client.status !== 'Venda Fechada' && client.status !== 'Perdido',
    isSemRetorno: !client.nextContactDate && client.status !== 'Venda Fechada' && client.status !== 'Perdido',
    isAtrasado: isAtrasado && client.status !== 'Venda Fechada' && client.status !== 'Perdido'
  };
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
    scheduleBackgroundPush();
  }
}

// BROKER MEMORY MODELS & HELPERS (MEMÓRIA DO CORRETOR)
export interface BrokerMemoryEntry {
  id: string;
  type: 'interaction' | 'message_generated' | 'message_copied' | 'comment_added' | 'status_changed' | 'sale_added' | 'task_completed' | 'task_created' | 'task_rescheduled' | 'task_deleted' | 'client_created' | 'contact_registered';
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
    id: generateMemoryId(),
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


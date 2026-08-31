/**
 * Utilitários para integração e sincronização automática com o Google Agenda (Google Calendar)
 * Suporta:
 * 1. Sincronização 100% em segundo plano via API REST (/api/calendar/create-event)
 * 2. Autenticação OAuth2 / Google Identity Services (GSI)
 * 3. Fallback inteligente para template URL quando não conectado
 */

export interface GoogleCalendarTaskParams {
  title: string;
  notes?: string;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  location?: string;
  clientName?: string;
  clientPhone?: string;
  priority?: 'Alta' | 'Média' | 'Baixa';
  userId?: string;
}

const pad = (n: number): string => String(n).padStart(2, '0');

// Token em memória / localStorage para chamadas client-side
const GOOGLE_CLIENT_TOKEN_KEY = 'merlin_google_access_token';
const GOOGLE_CLIENT_INFO_KEY = 'merlin_google_account_info';

export function getStoredGoogleAccessToken(): string | null {
  try {
    return localStorage.getItem(GOOGLE_CLIENT_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredGoogleAccessToken(token: string, email?: string) {
  try {
    localStorage.setItem(GOOGLE_CLIENT_TOKEN_KEY, token);
    if (email) {
      localStorage.setItem(GOOGLE_CLIENT_INFO_KEY, JSON.stringify({ email, connectedAt: new Date().toISOString() }));
    }
  } catch (e) {
    console.error('Erro ao salvar token google:', e);
  }
}

export function clearStoredGoogleAccessToken() {
  try {
    localStorage.removeItem(GOOGLE_CLIENT_TOKEN_KEY);
    localStorage.removeItem(GOOGLE_CLIENT_INFO_KEY);
  } catch (e) {
    console.error('Erro ao limpar token google:', e);
  }
}

export function getStoredGoogleAccountInfo(): { email?: string; connectedAt?: string } | null {
  try {
    const raw = localStorage.getItem(GOOGLE_CLIENT_INFO_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Dispara a sincronização automática em segundo plano para o Google Calendar
 * Retorna sucesso e o eventId gerado pelo Google
 */
export async function syncTaskToGoogleCalendar(task: GoogleCalendarTaskParams): Promise<{
  success: boolean;
  eventId?: string;
  htmlLink?: string;
  error?: string;
  needsAuth?: boolean;
}> {
  try {
    const clientToken = getStoredGoogleAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (clientToken) {
      headers['Authorization'] = `Bearer ${clientToken}`;
    }
    if (task.userId) {
      headers['X-User-Id'] = task.userId;
    }

    const response = await fetch('/api/calendar/create-event', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: task.title,
        dueDate: task.dueDate,
        dueTime: task.dueTime,
        notes: task.notes,
        clientName: task.clientName,
        clientPhone: task.clientPhone,
        priority: task.priority,
        location: task.location,
        userId: task.userId
      })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log('[Merlin Calendar] Tarefa sincronizada com sucesso em segundo plano:', data.eventId);
      return {
        success: true,
        eventId: data.eventId,
        htmlLink: data.htmlLink
      };
    } else {
      console.warn('[Merlin Calendar] Falha na sincronização via API:', data.error);
      return {
        success: false,
        error: data.error || 'Falha ao sincronizar com o Google Calendar.',
        needsAuth: data.needsAuth || response.status === 401
      };
    }
  } catch (error: any) {
    console.error('[Merlin Calendar] Erro de requisição:', error);
    return {
      success: false,
      error: error.message || 'Erro de conexão com o serviço de agenda.'
    };
  }
}

/**
 * Gera a URL oficial do Google Calendar para criação de evento manual
 */
export function getGoogleCalendarUrl(task: GoogleCalendarTaskParams): string {
  const { title, notes = '', dueDate, dueTime, location, clientName, clientPhone, priority } = task;

  if (!dueDate) {
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE';
  }

  const [yStr, mStr, dStr] = dueDate.split('-');
  const year = parseInt(yStr, 10) || new Date().getFullYear();
  const month = (parseInt(mStr, 10) || (new Date().getMonth() + 1)) - 1;
  const day = parseInt(dStr, 10) || new Date().getDate();

  let datesParam = '';

  if (dueTime && dueTime.includes(':')) {
    const [hStr, minStr] = dueTime.split(':');
    const hours = parseInt(hStr, 10) || 0;
    const minutes = parseInt(minStr, 10) || 0;

    const startDate = new Date(year, month, day, hours, minutes, 0);
    // Término padrão: 30 minutos após o início
    const endDate = new Date(startDate.getTime() + 30 * 60 * 1000);

    const startIso = `${startDate.getFullYear()}${pad(startDate.getMonth() + 1)}${pad(startDate.getDate())}T${pad(startDate.getHours())}${pad(startDate.getMinutes())}00`;
    const endIso = `${endDate.getFullYear()}${pad(endDate.getMonth() + 1)}${pad(endDate.getDate())}T${pad(endDate.getHours())}${pad(endDate.getMinutes())}00`;

    datesParam = `${startIso}/${endIso}`;
  } else {
    // Evento de dia inteiro (all-day)
    const startDate = new Date(year, month, day);
    const endDate = new Date(year, month, day + 1);

    const startIso = `${startDate.getFullYear()}${pad(startDate.getMonth() + 1)}${pad(startDate.getDate())}`;
    const endIso = `${endDate.getFullYear()}${pad(endDate.getMonth() + 1)}${pad(endDate.getDate())}`;

    datesParam = `${startIso}/${endIso}`;
  }

  const encodedTitle = encodeURIComponent(title || 'Tarefa Comercial - Merlin CRM');
  
  const descriptionParts: string[] = [];
  if (notes) descriptionParts.push(`📝 Detalhes: ${notes}`);
  if (clientName) descriptionParts.push(`👤 Lead: ${clientName}`);
  if (clientPhone) descriptionParts.push(`📞 Contato: ${clientPhone}`);
  if (priority) descriptionParts.push(`⚡ Prioridade: ${priority}`);
  descriptionParts.push(`\nAgendado via Merlin CRM ⚡`);

  const encodedDetails = encodeURIComponent(descriptionParts.join('\n'));

  let url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodedTitle}&details=${encodedDetails}&dates=${datesParam}`;

  if (location) {
    url += `&location=${encodeURIComponent(location)}`;
  }

  return url;
}

/**
 * Abre o evento diretamente no Google Agenda em uma nova aba (fallback manual)
 */
export function openGoogleCalendarEvent(task: {
  title: string;
  notes?: string;
  dueDate: string;
  dueTime?: string;
  location?: string;
  clientName?: string;
  clientPhone?: string;
  priority?: 'Alta' | 'Média' | 'Baixa';
}): void {
  try {
    const url = getGoogleCalendarUrl(task);
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  } catch (error) {
    console.error('[Google Calendar] Erro ao abrir evento no calendário:', error);
  }
}

/**
 * Utilitários para integração e sincronização com o Google Agenda (Google Calendar)
 * 100% gratuito via Web Intent oficial sem necessidade de credenciais de terceiros.
 */

export interface GoogleCalendarTaskParams {
  title: string;
  notes?: string;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  location?: string;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/**
 * Gera a URL oficial do Google Calendar para criação de evento
 */
export function getGoogleCalendarUrl(task: GoogleCalendarTaskParams): string {
  const { title, notes = '', dueDate, dueTime, location } = task;

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
  const detailsContent = notes 
    ? `${notes}\n\nAgendado via Merlin CRM ⚡` 
    : 'Agendado via Merlin CRM ⚡';
  const encodedDetails = encodeURIComponent(detailsContent);

  let url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodedTitle}&details=${encodedDetails}&dates=${datesParam}`;

  if (location) {
    url += `&location=${encodeURIComponent(location)}`;
  }

  return url;
}

/**
 * Abre o evento diretamente no Google Agenda em uma nova aba
 */
export function openGoogleCalendarEvent(task: {
  title: string;
  notes?: string;
  dueDate: string;
  dueTime?: string;
  location?: string;
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

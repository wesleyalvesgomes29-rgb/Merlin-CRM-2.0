import React, { useState } from 'react';
import { Client, Tag, Sale, Task } from '../types';
import { getClientAlerts, getDaysSinceContact, isToday, getGreeting } from '../lib/storage';
import { useAuth } from '../modules/auth';
import { 
  Sparkles, 
  Flame, 
  AlertTriangle, 
  Calendar, 
  ArrowRight, 
  PhoneCall, 
  MessageSquare, 
  UserCheck, 
  CheckCircle2, 
  ChevronRight, 
  TrendingUp, 
  Clock, 
  CheckSquare, 
  Users, 
  Target, 
  ArrowUpRight,
  Zap,
  Snowflake,
  Brain,
  RotateCcw,
  UserPlus,
  Send,
  CalendarPlus
} from 'lucide-react';
import { EngineResult } from '../modules/rulesEngine/types';
import PlaybookQuickModal from './routine/PlaybookQuickModal';
import NextStepModal from './routine/NextStepModal';

interface MyDayProps {
  clients: Client[];
  tags: Tag[];
  sales: Sale[];
  tasks: Task[];
  engineResult?: EngineResult;
  onSelectClient: (id: string) => void;
  onQuickContact: (id: string) => void;
  onQuickReschedule: (id: string, dateStr: string) => void;
  onNavigateToClientsWithFilter?: (filterType: 'high_priority' | 'no_next_contact') => void;
  onNavigateToTasksWithFilter?: (todayOnly: boolean) => void;
  onNavigateToTab?: (tab: string) => void;
  onAddTask?: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  onOpenAddClient?: () => void;
}

export default function MyDay({
  clients,
  tags,
  sales,
  tasks,
  engineResult,
  onSelectClient,
  onQuickContact,
  onQuickReschedule,
  onNavigateToClientsWithFilter,
  onNavigateToTasksWithFilter,
  onNavigateToTab,
  onAddTask,
  onOpenAddClient
}: MyDayProps) {
  const { user } = useAuth();
  const dynamicGreeting = getGreeting(user?.name || user?.email);

  // Playbook & Next Step modal states
  const [playbookClient, setPlaybookClient] = useState<Client | null>(null);
  const [nextStepClient, setNextStepClient] = useState<Client | null>(null);

  // 1. CRM Data Summaries
  const todayClients = clients.filter(c => {
    return isToday(c.nextContactDate) && c.status !== 'Venda Fechada' && c.status !== 'Perdido';
  });

  const overdueClients = clients.filter(c => {
    const alerts = getClientAlerts(c);
    return alerts.isAtrasado && c.status !== 'Venda Fechada' && c.status !== 'Perdido';
  });

  const newLeads = clients.filter(c => c.status === 'Lead Novo');

  // Stale leads without contact for > 15 days
  const staleLeads = clients.filter(c => {
    const days = getDaysSinceContact(c);
    return days >= 15 && c.status !== 'Venda Fechada' && c.status !== 'Perdido';
  });

  // High priority clients from Rules Engine or fallback
  const enginePriorityClients = engineResult?.priorities && engineResult.priorities.length > 0
    ? engineResult.priorities
        .map(p => clients.find(c => c.id === p.clientId))
        .filter((c): c is Client => Boolean(c))
    : [];

  const highPriorityClients = enginePriorityClients.length > 0
    ? enginePriorityClients
    : clients.filter(c => {
        const alerts = getClientAlerts(c);
        return alerts.isUrgente && c.status !== 'Venda Fechada' && c.status !== 'Perdido';
      });

  const highPriorityCount = highPriorityClients.length;

  const noNextContactClients = clients.filter(c => {
    return !c.nextContactDate && c.status !== 'Venda Fechada' && c.status !== 'Perdido';
  });
  const noNextContactCount = noNextContactClients.length;

  const todayTasks = tasks.filter(t => isToday(t.dueDate) && !t.completed);
  const finalTasksCount = (engineResult?.todayTasks?.length || 0) + (engineResult?.overdueTasks?.length || 0) || (todayClients.length + overdueClients.length + todayTasks.length);

  // Immediate Action Items
  const urgentActionClients = highPriorityClients.slice(0, 5);

  // Today's due contacts
  const todayDueContacts = todayClients.slice(0, 5);

  const currentDateFormatted = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(new Date());

  // Helper for lead temperature
  const getLeadTemp = (client: Client) => {
    const urgency = typeof client.secondBrainSummary === 'object' && client.secondBrainSummary !== null
      ? client.secondBrainSummary.urgencyLevel
      : undefined;

    if (urgency === 'Alta' || client.status === 'Proposta' || client.status === 'Agendado' || client.status === 'Visitou') {
      return { label: 'Quente', icon: Flame, color: 'text-rose-400 bg-rose-500/15 border-rose-500/30' };
    }
    if (urgency === 'Média' || client.status === 'Em Atendimento' || client.status === 'Contato') {
      return { label: 'Morno', icon: Zap, color: 'text-amber-400 bg-amber-500/15 border-amber-500/30' };
    }
    return { label: 'Frio', icon: Snowflake, color: 'text-sky-400 bg-sky-500/15 border-sky-500/30' };
  };

  return (
    <div className="space-y-5 pb-10" id="my-day-panel">
      
      {/* 1. TOP SUMMARY CARD (FINTECH / RECARGAPAY STYLE COCKPIT) */}
      <div className="merlin-card p-4 sm:p-7 relative overflow-hidden bg-gradient-to-br from-[#18181B] via-[#141416] to-[#0F172A] border border-[#27272A] shadow-xl rounded-3xl">
        {/* Subtle geometric light accent */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-[#FF6B00]/20 via-[#FF7A00]/10 to-transparent rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />
        <div className="absolute bottom-0 left-1/3 w-60 h-60 bg-[#FF6B00]/5 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FF7A00]/15 text-[#FF7A00] border border-[#FF7A00]/30 text-[10px] font-extrabold uppercase tracking-wider">
                <Sparkles className="h-3 w-3 text-[#FF7A00]" />
                <span>Cockpit Merlin &bull; SuperApp</span>
              </div>
              <h1 className="text-xl sm:text-3xl font-black font-display tracking-tight text-white">
                {dynamicGreeting} 👋
              </h1>
              <p className="text-xs text-[#A1A1AA] font-medium capitalize">
                {currentDateFormatted}
              </p>
            </div>

            {/* Status Pill */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#202024] border border-[#303036] text-xs font-semibold text-[#E4E4E7]">
                <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
                <span>Carteira Ativa ({clients.filter(c => c.status !== 'Venda Fechada' && c.status !== 'Perdido').length})</span>
              </div>
            </div>
          </div>

          {/* Quick Stat Chips / Urgency Metrics Bar */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-5 pt-4 border-t border-[#27272A]">
            {/* Chip 1: Leads Quentes */}
            <button
              onClick={() => onNavigateToClientsWithFilter?.('high_priority')}
              className="p-2.5 sm:p-3.5 rounded-2xl bg-[#1E1E24]/80 border border-rose-500/25 hover:border-rose-500/60 active:scale-98 transition-all text-left group cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
                  <Flame className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                  <span className="hidden sm:inline">Leads</span> Quentes
                </span>
                <span className="text-base sm:text-xl font-black font-display text-rose-400">
                  {highPriorityCount}
                </span>
              </div>
              <p className="text-[10px] text-[#A1A1AA] mt-1 hidden sm:block truncate">
                Risco de esfriar
              </p>
            </button>

            {/* Chip 2: Agenda de Hoje */}
            <button
              onClick={() => onNavigateToTasksWithFilter?.(true)}
              className="p-2.5 sm:p-3.5 rounded-2xl bg-[#1E1E24]/80 border border-[#FF7A00]/25 hover:border-[#FF7A00]/60 active:scale-98 transition-all text-left group cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-bold text-[#FF7A00] uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-[#FF7A00] shrink-0" />
                  Hoje
                </span>
                <span className="text-base sm:text-xl font-black font-display text-[#FF7A00]">
                  {finalTasksCount}
                </span>
              </div>
              <p className="text-[10px] text-[#A1A1AA] mt-1 hidden sm:block truncate">
                Tarefas e visitas
              </p>
            </button>

            {/* Chip 3: Sem Retorno */}
            <button
              onClick={() => onNavigateToClientsWithFilter?.('no_next_contact')}
              className="p-2.5 sm:p-3.5 rounded-2xl bg-[#1E1E24]/80 border border-amber-500/25 hover:border-amber-500/60 active:scale-98 transition-all text-left group cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  Atrasados
                </span>
                <span className="text-base sm:text-xl font-black font-display text-amber-400">
                  {noNextContactCount}
                </span>
              </div>
              <p className="text-[10px] text-[#A1A1AA] mt-1 hidden sm:block truncate">
                Sem próximo contato
              </p>
            </button>
          </div>
        </div>
      </div>

      {/* 2. GRID DE ATALHOS RÁPIDOS (FINTECH / RECARGAPAY STYLE 4 CARDS) */}
      <div>
        <div className="flex items-center justify-between mb-2.5 px-1">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#A1A1AA] flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-[#FF7A00]" />
            <span>Atalhos de Alta Velocidade</span>
          </h2>
          <span className="text-[11px] text-[#71717A] font-medium">Toque rápido</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
          {/* Shortcut 1: Primeiro Contato */}
          <button
            id="quick-action-primeiro-contato"
            onClick={() => {
              if (newLeads.length > 0) {
                setPlaybookClient(newLeads[0]);
              } else if (onNavigateToTab) {
                onNavigateToTab('funil');
              }
            }}
            className="p-3.5 rounded-2xl bg-[#18181B] border border-[#27272A] hover:border-[#FF7A00]/60 active:scale-97 transition-all text-left group cursor-pointer flex flex-col justify-between h-28 relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#FF6B00] to-[#F97316] text-black font-black flex items-center justify-center shadow-md shadow-[#FF6B00]/20">
                <Target className="h-5 w-5 stroke-[2.5]" />
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FF7A00]/15 text-[#FF7A00] border border-[#FF7A00]/30">
                {newLeads.length} novos
              </span>
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-[#FF7A00] transition-colors leading-tight">
                Primeiro Contato
              </h3>
              <p className="text-[10px] text-[#71717A] truncate">
                Disparar abordagem rápida
              </p>
            </div>
          </button>

          {/* Shortcut 2: Resgatar Leads */}
          <button
            id="quick-action-resgatar-leads"
            onClick={() => {
              if (staleLeads.length > 0) {
                setPlaybookClient(staleLeads[0]);
              } else {
                onNavigateToClientsWithFilter?.('high_priority');
              }
            }}
            className="p-3.5 rounded-2xl bg-[#18181B] border border-[#27272A] hover:border-amber-500/60 active:scale-97 transition-all text-left group cursor-pointer flex flex-col justify-between h-28 relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                <RotateCcw className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                {staleLeads.length} parados
              </span>
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-amber-400 transition-colors leading-tight">
                Resgatar Leads
              </h3>
              <p className="text-[10px] text-[#71717A] truncate">
                Reativar via Playbook
              </p>
            </div>
          </button>

          {/* Shortcut 3: Agenda de Hoje */}
          <button
            id="quick-action-agenda-hoje"
            onClick={() => onNavigateToTasksWithFilter?.(true)}
            className="p-3.5 rounded-2xl bg-[#18181B] border border-[#27272A] hover:border-emerald-500/60 active:scale-97 transition-all text-left group cursor-pointer flex flex-col justify-between h-28 relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <Calendar className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                {finalTasksCount} hoje
              </span>
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-emerald-400 transition-colors leading-tight">
                Agenda de Hoje
              </h3>
              <p className="text-[10px] text-[#71717A] truncate">
                Retornos e visitas
              </p>
            </div>
          </button>

          {/* Shortcut 4: Segundo Cérebro */}
          <button
            id="quick-action-segundo-cerebro"
            onClick={() => {
              if (onNavigateToTab) {
                onNavigateToTab('intelligence');
              }
            }}
            className="p-3.5 rounded-2xl bg-[#18181B] border border-[#27272A] hover:border-purple-500/60 active:scale-97 transition-all text-left group cursor-pointer flex flex-col justify-between h-28 relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center justify-center">
                <Brain className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30">
                IA 24h
              </span>
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-purple-400 transition-colors leading-tight">
                Segundo Cérebro
              </h3>
              <p className="text-[10px] text-[#71717A] truncate">
                Copiloto comercial
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* 3. DUAL-COLUMN COCKPIT FEED: LEADS QUENTES & AGENDA DE HOJE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Column 1: AÇÕES IMEDIATAS & LEADS QUENTES */}
        <div className="lg:col-span-6 space-y-3.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
              <Flame className="h-4 w-4 text-rose-500" />
              <span>Prioridade Alta / Quentes</span>
            </h2>
            <button
              onClick={() => onNavigateToClientsWithFilter?.('high_priority')}
              className="text-xs font-bold text-[#FF7A00] hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>Ver todos ({highPriorityCount})</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {urgentActionClients.length > 0 ? (
            <div className="space-y-3">
              {urgentActionClients.map((client) => {
                const days = getDaysSinceContact(client);
                const temp = getLeadTemp(client);
                const TempIcon = temp.icon;

                return (
                  <div
                    key={client.id}
                    className="p-4 rounded-2xl bg-[#18181B] border border-[#27272A] hover:border-[#FF7A00]/50 transition-all flex flex-col gap-3 group shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => onSelectClient(client.id)}
                            className="font-bold text-sm text-white hover:text-[#FF7A00] text-left transition-colors cursor-pointer"
                          >
                            {client.name}
                          </button>
                          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md border flex items-center gap-1 ${temp.color}`}>
                            <TempIcon className="h-3 w-3" />
                            <span>{temp.label}</span>
                          </span>
                        </div>
                        <p className="text-xs text-[#A1A1AA] mt-1">
                          {client.empreendimento || 'Sem empreendimento especificado'} &bull; <span className="text-[#E4E4E7] font-medium">{client.status}</span>
                        </p>
                      </div>

                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 shrink-0">
                        {days}d sem contato
                      </span>
                    </div>

                    {/* Action Buttons Row */}
                    <div className="flex items-center gap-2 pt-2 border-t border-[#27272A]">
                      {/* Direct WhatsApp with Playbook */}
                      <button
                        onClick={() => setPlaybookClient(client)}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-98"
                      >
                        <MessageSquare className="h-4 w-4" />
                        <span>WhatsApp (Playbook)</span>
                      </button>

                      {/* Client Card */}
                      <button
                        onClick={() => onSelectClient(client.id)}
                        className="py-2.5 px-3.5 rounded-xl bg-[#222226] hover:bg-[#2A2A2E] text-[#E4E4E7] text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer border border-[#303036] active:scale-98"
                      >
                        <span>Ficha</span>
                        <ChevronRight className="h-3.5 w-3.5 text-[#71717A]" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 rounded-2xl text-center space-y-2 bg-[#18181B] border border-[#27272A]">
              <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto" />
              <h3 className="text-sm font-bold text-white">
                Nenhum lead com alta prioridade pendente!
              </h3>
              <p className="text-xs text-[#71717A]">
                Sua carteira está sob controle. Aproveite para fazer novos contatos.
              </p>
            </div>
          )}
        </div>

        {/* Column 2: RETORNOS E AGENDA DE HOJE */}
        <div className="lg:col-span-6 space-y-3.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#FF7A00]" />
              <span>Contatos & Retornos Agendados</span>
            </h2>
            <button
              onClick={() => onNavigateToTasksWithFilter?.(true)}
              className="text-xs font-bold text-[#FF7A00] hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>Ver Rotina Completa</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {todayDueContacts.length > 0 ? (
            <div className="space-y-3">
              {todayDueContacts.map((client) => {
                const temp = getLeadTemp(client);
                const TempIcon = temp.icon;

                return (
                  <div
                    key={client.id}
                    className="p-4 rounded-2xl bg-[#18181B] border border-[#27272A] hover:border-[#FF7A00]/50 transition-all flex flex-col gap-3 group shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => onSelectClient(client.id)}
                            className="font-bold text-sm text-white hover:text-[#FF7A00] text-left transition-colors cursor-pointer"
                          >
                            {client.name}
                          </button>
                          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md border flex items-center gap-1 ${temp.color}`}>
                            <TempIcon className="h-3 w-3" />
                            <span>{temp.label}</span>
                          </span>
                        </div>
                        <p className="text-xs text-[#A1A1AA] mt-1">
                          Status: <span className="text-[#E4E4E7] font-medium">{client.status}</span>
                        </p>
                      </div>

                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#FF7A00]/15 text-[#FF7A00] border border-[#FF7A00]/30 shrink-0">
                        Hoje
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-[#27272A]">
                      {/* Playbook Button */}
                      <button
                        onClick={() => setPlaybookClient(client)}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-[#FF7A00]/15 hover:bg-[#FF7A00]/25 text-[#FF7A00] border border-[#FF7A00]/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-98"
                      >
                        <MessageSquare className="h-4 w-4" />
                        <span>WhatsApp (Script)</span>
                      </button>

                      {/* Complete & Next Step */}
                      <button
                        onClick={() => {
                          onQuickContact(client.id);
                          setNextStepClient(client);
                        }}
                        className="py-2.5 px-3 rounded-xl bg-[#222226] hover:bg-[#2A2A2E] text-emerald-400 text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer border border-[#303036] active:scale-98"
                        title="Concluir contato e agendar próximo passo"
                      >
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        <span className="hidden sm:inline">Concluir</span>
                      </button>

                      {/* Client Card */}
                      <button
                        onClick={() => onSelectClient(client.id)}
                        className="py-2.5 px-3 rounded-xl bg-[#222226] hover:bg-[#2A2A2E] text-[#E4E4E7] text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer border border-[#303036] active:scale-98"
                      >
                        <span>Ficha</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 rounded-2xl text-center space-y-2 bg-[#18181B] border border-[#27272A]">
              <Calendar className="h-8 w-8 text-[#FF7A00]/60 mx-auto" />
              <h3 className="text-sm font-bold text-white">
                Nenhum retorno pendente para hoje
              </h3>
              <p className="text-xs text-[#71717A]">
                Todos os contatos agendados para hoje estão em dia.
              </p>
            </div>
          )}

          {/* Quick summary box */}
          <div className="p-3.5 rounded-2xl bg-[#18181B] border border-[#27272A] text-[#E4E4E7] text-xs flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Target className="h-4 w-4 text-[#FF7A00] shrink-0" />
              <span className="font-medium text-[#A1A1AA]">Clientes ativos em carteira:</span>
            </div>
            <span className="font-bold text-[#FF7A00] text-sm font-mono">
              {clients.filter(c => c.status !== 'Venda Fechada' && c.status !== 'Perdido').length}
            </span>
          </div>
        </div>

      </div>

      {/* PLAYBOOK QUICK SCRIPT MODAL (BOTTOM SHEET ON MOBILE) */}
      {playbookClient && (
        <PlaybookQuickModal
          isOpen={Boolean(playbookClient)}
          onClose={() => setPlaybookClient(null)}
          client={playbookClient}
        />
      )}

      {/* NEXT STEP MODAL (BOTTOM SHEET ON MOBILE) */}
      {nextStepClient && onAddTask && (
        <NextStepModal
          isOpen={Boolean(nextStepClient)}
          onClose={() => setNextStepClient(null)}
          client={nextStepClient}
          onScheduleNextStep={onAddTask}
        />
      )}

    </div>
  );
}

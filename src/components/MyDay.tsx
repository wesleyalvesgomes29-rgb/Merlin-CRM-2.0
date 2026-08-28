import React from 'react';
import { Client, Tag, Sale, Task } from '../types';
import { getClientAlerts, getDaysSinceContact, isToday } from '../lib/storage';
import { 
  Sparkles, 
  Flame, 
  AlertTriangle, 
  Calendar, 
  ArrowRight, 
  PhoneCall, 
  MessageCircle, 
  UserCheck, 
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  Clock,
  CheckSquare,
  Users,
  Target,
  ArrowUpRight
} from 'lucide-react';
import { EngineResult } from '../modules/rulesEngine/types';

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
  onNavigateToTasksWithFilter
}: MyDayProps) {
  // 1. CRM Data Summaries
  const todayClients = clients.filter(c => {
    return isToday(c.nextContactDate) && c.status !== 'Venda Fechada' && c.status !== 'Perdido';
  });

  const overdueClients = clients.filter(c => {
    const alerts = getClientAlerts(c);
    return alerts.isAtrasado && c.status !== 'Venda Fechada' && c.status !== 'Perdido';
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
  const urgentActionClients = highPriorityClients.slice(0, 4);

  // Today's due contacts
  const todayDueContacts = todayClients.slice(0, 4);

  const currentDateFormatted = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(new Date());

  return (
    <div className="space-y-6" id="my-day-panel">
      
      {/* 1. WELCOME & COCKPIT BANNER */}
      <div className="merlin-card p-5 sm:p-7 relative overflow-hidden bg-[#161616] border border-[#303030] shadow-xs rounded-2xl">
        {/* Subtle geometric light accent */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-[#FF7A00]/15 via-[#FF9800]/5 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-1/4 w-60 h-60 bg-[#E85D00]/5 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#FF7A00]/10 text-[#FF7A00] border border-[#FF7A00]/30 text-[11px] font-bold uppercase tracking-wider">
              <Sparkles className="h-3.5 w-3.5 text-[#FF7A00]" />
              <span>Cockpit Comercial &bull; Merlin CRM</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-display tracking-tight text-white capitalize">
              Bom dia, Corretor 👋
            </h1>
            <p className="text-xs sm:text-sm text-[#BDBDBD] font-medium">
              {currentDateFormatted} &bull; <span className="text-[#FF7A00] font-semibold">Painel tático de performance e rotina diária</span>
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1F1F1F] border border-[#303030] text-xs font-semibold text-[#E5E5E5]">
              <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
              <span>Carteira Atualizada</span>
            </div>
          </div>
        </div>

        {/* 2. STATS & URGENCY METRICS CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-6 pt-5 border-t border-[#303030]">
          {/* Card 1: High Priority */}
          <div 
            onClick={() => onNavigateToClientsWithFilter?.('high_priority')}
            className="p-4 bg-[#1F1F1F] border border-[#EF4444]/30 hover:border-[#EF4444]/60 cursor-pointer group rounded-2xl transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#EF4444] uppercase tracking-wider flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-[#EF4444]" />
                Alta Prioridade
              </span>
              <span className="text-xl font-black font-display text-[#EF4444]">
                {highPriorityCount}
              </span>
            </div>
            <p className="text-xs text-[#BDBDBD] leading-snug">
              Clientes estagnados com risco iminente de esfriamento.
            </p>
            <div className="mt-3 flex items-center gap-1 text-[11px] font-bold text-[#EF4444] group-hover:translate-x-1 transition-transform">
              <span>Atender agora</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* Card 2: No Next Contact */}
          <div 
            onClick={() => onNavigateToClientsWithFilter?.('no_next_contact')}
            className="p-4 bg-[#1F1F1F] border border-[#F59E0B]/30 hover:border-[#F59E0B]/60 cursor-pointer group rounded-2xl transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#F59E0B] uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />
                Sem Retorno
              </span>
              <span className="text-xl font-black font-display text-[#F59E0B]">
                {noNextContactCount}
              </span>
            </div>
            <p className="text-xs text-[#BDBDBD] leading-snug">
              Leads ativos sem data agendada para próximo contato.
            </p>
            <div className="mt-3 flex items-center gap-1 text-[11px] font-bold text-[#F59E0B] group-hover:translate-x-1 transition-transform">
              <span>Agendar retornos</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* Card 3: Today's Tasks */}
          <div 
            onClick={() => onNavigateToTasksWithFilter?.(true)}
            className="p-4 bg-[#1F1F1F] border border-[#FF7A00]/30 hover:border-[#FF7A00]/60 cursor-pointer group rounded-2xl transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#FF7A00] uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-[#FF7A00]" />
                Rotina de Hoje
              </span>
              <span className="text-xl font-black font-display text-[#FF7A00]">
                {finalTasksCount}
              </span>
            </div>
            <p className="text-xs text-[#BDBDBD] leading-snug">
              Compromissos, visitas e retornos agendados para hoje.
            </p>
            <div className="mt-3 flex items-center gap-1 text-[11px] font-bold text-[#FF7A00] group-hover:translate-x-1 transition-transform">
              <span>Ver agenda</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>
      </div>

      {/* 3. DUAL-COLUMN COCKPIT: IMMEDIATE ACTIONS + AGENDA DE HOJE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: AÇÕES IMEDIATAS (Priority Leads) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#E5E5E5] flex items-center gap-2">
              <Flame className="h-4 w-4 text-[#EF4444]" />
              <span>Ações Imediatas Recomendadas</span>
            </h2>
            <button
              onClick={() => onNavigateToClientsWithFilter?.('high_priority')}
              className="text-xs font-bold text-[#FF7A00] hover:underline cursor-pointer"
            >
              Ver todos ({highPriorityCount})
            </button>
          </div>

          {urgentActionClients.length > 0 ? (
            <div className="space-y-3">
              {urgentActionClients.map((client) => {
                const days = getDaysSinceContact(client);
                return (
                  <div
                    key={client.id}
                    className="p-4 rounded-2xl bg-[#161616] border border-[#303030] hover:border-[#FF7A00]/50 transition-all flex flex-col gap-3 group"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <button
                          onClick={() => onSelectClient(client.id)}
                          className="font-bold text-sm text-white hover:text-[#FF7A00] text-left transition-colors cursor-pointer"
                        >
                          {client.name}
                        </button>
                        <p className="text-xs text-[#888888] mt-0.5">
                          {client.empreendimento || 'Sem interesse especificado'}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30 shrink-0">
                        {days}d sem contato
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-[#303030]">
                      {client.phone && (
                        <a
                          href={`https://wa.me/55${client.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 py-2 px-3 rounded-xl bg-[#22C55E]/10 hover:bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/25 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          <span>WhatsApp</span>
                        </a>
                      )}
                      <button
                        onClick={() => onSelectClient(client.id)}
                        className="py-2 px-3.5 rounded-xl bg-[#1F1F1F] hover:bg-[#2A2A2A] text-[#E5E5E5] text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer border border-[#303030]"
                      >
                        <span>Ficha</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 rounded-2xl text-center space-y-2 bg-[#161616] border border-[#303030]">
              <CheckCircle2 className="h-8 w-8 text-[#22C55E] mx-auto" />
              <h3 className="text-sm font-bold text-[#E5E5E5]">
                Nenhum lead com alta prioridade pendente!
              </h3>
              <p className="text-xs text-[#888888]">
                Sua carteira está sob controle. Aproveite para prospectar ou fazer novos contatos.
              </p>
            </div>
          )}
        </div>

        {/* Right Column: RETORNOS E COMPROMISSOS DE HOJE */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#E5E5E5] flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#FF7A00]" />
              <span>Contatos & Retornos Agendados</span>
            </h2>
            <button
              onClick={() => onNavigateToTasksWithFilter?.(true)}
              className="text-xs font-bold text-[#FF7A00] hover:underline cursor-pointer"
            >
              Ver Rotina Completa
            </button>
          </div>

          {todayDueContacts.length > 0 ? (
            <div className="space-y-3">
              {todayDueContacts.map((client) => (
                <div
                  key={client.id}
                  className="p-4 rounded-2xl bg-[#161616] border border-[#303030] hover:border-[#FF7A00]/50 transition-all flex flex-col gap-3 group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <button
                        onClick={() => onSelectClient(client.id)}
                        className="font-bold text-sm text-white hover:text-[#FF7A00] text-left transition-colors cursor-pointer"
                      >
                        {client.name}
                      </button>
                      <p className="text-xs text-[#888888] mt-0.5">
                        Status: <span className="text-[#E5E5E5] font-medium">{client.status}</span>
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#FF7A00]/15 text-[#FF7A00] border border-[#FF7A00]/30 shrink-0">
                      Hoje
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-[#303030]">
                    {client.phone && (
                      <a
                        href={`https://wa.me/55${client.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-2 px-3 rounded-xl bg-[#FF7A00]/10 hover:bg-[#FF7A00]/20 text-[#FF7A00] border border-[#FF7A00]/25 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span>Falar</span>
                      </a>
                    )}
                    <button
                      onClick={() => onQuickContact(client.id)}
                      className="py-2 px-3 rounded-xl bg-[#1F1F1F] hover:bg-[#2A2A2A] text-[#E5E5E5] text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer border border-[#303030]"
                      title="Registrar contato realizado"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#22C55E]" />
                      <span>Concluir</span>
                    </button>
                    <button
                      onClick={() => onSelectClient(client.id)}
                      className="py-2 px-3 rounded-xl bg-[#1F1F1F] hover:bg-[#2A2A2A] text-[#E5E5E5] text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer border border-[#303030]"
                    >
                      <span>Ficha</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 rounded-2xl text-center space-y-2 bg-[#161616] border border-[#303030]">
              <Calendar className="h-8 w-8 text-[#FF7A00]/60 mx-auto" />
              <h3 className="text-sm font-bold text-[#E5E5E5]">
                Nenhum retorno pendente para hoje
              </h3>
              <p className="text-xs text-[#888888]">
                Todos os contatos agendados estão em dia.
              </p>
            </div>
          )}

          {/* Quick summary box */}
          <div className="p-3.5 rounded-2xl bg-[#161616] border border-[#303030] text-[#E5E5E5] text-xs flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Target className="h-4 w-4 text-[#FF7A00] shrink-0" />
              <span className="font-medium">Total de clientes ativos em carteira:</span>
            </div>
            <span className="font-bold text-[#FF7A00] text-sm font-mono">
              {clients.filter(c => c.status !== 'Venda Fechada' && c.status !== 'Perdido').length}
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}

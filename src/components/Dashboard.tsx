import React, { useState, useMemo } from 'react';
import { Client, Sale } from '../types';
import { getClientAlerts, getDaysSinceContact } from '../lib/storage';
import { 
  Users, 
  UserCheck, 
  Activity, 
  Calendar, 
  AlertTriangle, 
  DollarSign, 
  TrendingUp, 
  RotateCw,
  Award,
  Sparkles,
  MessageSquare,
  ChevronRight,
  PieChart as PieIcon,
  Flame,
  ArrowUpRight,
  Clock,
  Briefcase,
  Target
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  AreaChart, 
  Area,
  CartesianGrid
} from 'recharts';

interface DashboardProps {
  clients: Client[];
  sales: Sale[];
  onSelectClient: (id: string) => void;
  onNavigate: (tab: string) => void;
}

export default function Dashboard({ clients, sales, onSelectClient, onNavigate }: DashboardProps) {
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');

  const referenceDate = new Date();
  const currentMonth = referenceDate.getMonth(); // 0-indexed
  const currentYear = referenceDate.getFullYear();

  // Metrics Calculations
  const totalClients = clients.length;
  const leadsNovosCount = clients.filter(c => c.status === 'Lead Novo').length;

  const atrasadosCount = clients.filter(c => {
    const alerts = getClientAlerts(c);
    return alerts.isAtrasado;
  }).length;

  const retornarHojeCount = clients.filter(c => {
    if (!c.nextContactDate) return false;
    const d = new Date(c.nextContactDate);
    return (
      d.getFullYear() === referenceDate.getFullYear() &&
      d.getMonth() === referenceDate.getMonth() &&
      d.getDate() === referenceDate.getDate() &&
      c.status !== 'Venda Fechada' &&
      c.status !== 'Perdido'
    );
  }).length;

  // Clientes para retrabalho
  const retrabalhoSugeridosCount = clients.filter(c => {
    const alerts = getClientAlerts(c);
    return (alerts.isRetrabalhoSugerido || c.status === 'Retrabalho' || c.tags.includes('Retrabalho')) &&
      c.status !== 'Venda Fechada' && c.status !== 'Perdido';
  }).length;

  // Sales and commissions metrics
  const monthlySales = sales.filter(s => {
    const sDate = new Date(s.saleDate + 'T12:00:00');
    return sDate.getMonth() === currentMonth && sDate.getFullYear() === currentYear;
  });

  const monthlyCommissionSum = monthlySales.reduce((sum, s) => sum + s.commissionValue, 0);
  const totalVgvSum = sales.reduce((sum, s) => sum + (s.vgv || 0), 0);

  // Conversion rate: Venda Fechada / (Venda Fechada + Perdido)
  const totalFechadas = clients.filter(c => c.status === 'Venda Fechada').length;
  const totalPerdidos = clients.filter(c => c.status === 'Perdido').length;
  const conversionRate = totalFechadas + totalPerdidos > 0 
    ? Math.round((totalFechadas / (totalFechadas + totalPerdidos)) * 100) 
    : totalFechadas > 0 ? 100 : 0;

  // Funnel Stages Data
  const funnelStages: { name: string; value: number; color: string }[] = [
    { name: 'Lead Novo', value: clients.filter(c => c.status === 'Lead Novo').length, color: '#FF7A00' },
    { name: 'Contato', value: clients.filter(c => c.status === 'Contato').length, color: '#FF9800' },
    { name: 'Em Atendimento', value: clients.filter(c => c.status === 'Em Atendimento').length, color: '#E85D00' },
    { name: 'Retrabalho', value: clients.filter(c => c.status === 'Retrabalho').length, color: '#FBBF24' },
    { name: 'Agendado', value: clients.filter(c => c.status === 'Agendado').length, color: '#FF7A00' },
    { name: 'Visitou', value: clients.filter(c => c.status === 'Visitou').length, color: '#34D399' },
    { name: 'Proposta', value: clients.filter(c => c.status === 'Proposta').length, color: '#FF9800' },
    { name: 'Documentação', value: clients.filter(c => c.status === 'Documentação').length, color: '#E85D00' },
    { name: 'Venda Fechada', value: clients.filter(c => c.status === 'Venda Fechada').length, color: '#10B981' },
    { name: 'Perdido', value: clients.filter(c => c.status === 'Perdido').length, color: '#FB7185' }
  ];

  // Commission evolution chart data for 2026
  const monthsBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Dez'];
  const commissionChartData = monthsBR.map((monthName, idx) => {
    const monthSales = sales.filter(s => {
      const sDate = new Date(s.saleDate + 'T12:00:00');
      return sDate.getMonth() === idx && sDate.getFullYear() === 2026;
    });
    const totalVal = monthSales.reduce((sum, s) => sum + s.commissionValue, 0);
    return {
      name: monthName,
      Comissao: totalVal
    };
  });

  // Ranking of neglected leads (Termômetro de Atenção)
  const warmClientsEsquecidos = useMemo(() => {
    return clients
      .filter(c => c.status !== 'Venda Fechada' && c.status !== 'Perdido')
      .map(c => {
        const days = getDaysSinceContact(c);
        return { client: c, days: days !== null ? days : 99 };
      })
      .sort((a, b) => b.days - a.days)
      .slice(0, 5);
  }, [clients]);

  // Lead Origin Distribution
  const originDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    clients.forEach(c => {
      const orig = c.origem || 'Indicação / Outro';
      counts[orig] = (counts[orig] || 0) + 1;
    });
    const COLORS = ['#FF7A00', '#FF9800', '#E85D00', '#34D399', '#FBBF24', '#FB7185'];
    return Object.entries(counts).map(([name, value], idx) => ({
      name,
      value,
      color: COLORS[idx % COLORS.length]
    }));
  }, [clients]);

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // WhatsApp quick rescue handler
  const handleRescueWhatsApp = (client: Client) => {
    const cleanPhone = client.phone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
    const text = encodeURIComponent(`Olá, ${client.name}! Tudo bem? Passando para te atualizar sobre as oportunidades e tirar qualquer dúvida.`);
    window.open(`https://wa.me/${phoneWithCountry}?text=${text}`, '_blank');
  };

  return (
    <div className="space-y-6" id="dashboard-analytics-panel">
      {/* 1. Header with Period Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display text-white flex items-center gap-2">
            <span>Resultados &amp; Inteligência Comercial</span>
            <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-[#FF7A00]/10 text-[#FF7A00] border border-[#FF7A00]/20">
              Cockpit Gerencial
            </span>
          </h2>
          <p className="text-xs text-[#888888]">
            Métricas de conversão de funil, saúde da carteira e performance financeira
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Period Selector Tabs */}
          <div className="flex items-center p-1 bg-[#0B0B0B] border border-[#303030] rounded-xl text-xs font-bold">
            <button
              onClick={() => setPeriod('month')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                period === 'month'
                  ? 'bg-[#161616] text-[#FF7A00] shadow-2xs'
                  : 'text-[#888888] hover:text-white'
              }`}
            >
              Mês Vigente
            </button>
            <button
              onClick={() => setPeriod('quarter')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                period === 'quarter'
                  ? 'bg-[#161616] text-[#FF7A00] shadow-2xs'
                  : 'text-[#888888] hover:text-white'
              }`}
            >
              Trimestre
            </button>
            <button
              onClick={() => setPeriod('year')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                period === 'year'
                  ? 'bg-[#161616] text-[#FF7A00] shadow-2xs'
                  : 'text-[#888888] hover:text-white'
              }`}
            >
              Ano 2026
            </button>
          </div>
        </div>
      </div>

      {/* 2. Tactical Merlin Insights Card */}
      <div className="bg-[#161616] border border-[#FF7A00]/30 rounded-3xl p-5 sm:p-6 text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF7A00]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-start gap-3.5 relative z-10">
          <div className="p-3 bg-[#FF7A00]/20 text-[#FF7A00] rounded-2xl border border-[#FF7A00]/30 flex-shrink-0">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-sm font-display text-[#FF7A00] uppercase tracking-wider flex items-center gap-2">
              <span>Diagnóstico Tático Merlin</span>
              <span className="text-[10px] bg-[#FF7A00]/20 text-[#FF7A00] px-2 py-0.5 rounded-full lowercase font-mono border border-[#FF7A00]/30">
                automático
              </span>
            </h3>
            <p className="text-xs text-[#E5E5E5] leading-relaxed max-w-2xl">
              {atrasadosCount > 0 ? (
                <>Você possui <strong className="text-[#FB7185] font-bold">{atrasadosCount} leads atrasados</strong>. Priorize o contato imediato hoje para evitar o esfriamento de negociações quentes.</>
              ) : conversionRate > 50 ? (
                <>Excelente taxa de conversão do funil (<strong className="text-[#34D399] font-bold">{conversionRate}%</strong>). Bom momento para acelerar envio de propostas e agendamento de visitas no final de semana.</>
              ) : (
                <>Sua carteira está ativa com <strong className="text-[#FF7A00] font-bold">{totalClients} leads</strong>. Foque na passagem de etapa de <em>Em Atendimento</em> para <em>Agendado / Visita</em> para alavancar seu VGV.</>
              )}
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigate('intelligence')}
          className="bg-[#FF7A00] hover:bg-[#FF9800] text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm shadow-[#FF7A00]/30 flex-shrink-0 cursor-pointer active:scale-95 transition-all relative z-10"
        >
          <span>Abrir Consultor AI</span>
          <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>

      {/* 3. Core KPI Bento Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: Leads Ativos */}
        <div 
          onClick={() => onNavigate('clientes')}
          className="bg-[#161616] border border-[#303030] p-4 sm:p-5 rounded-2xl shadow-xs space-y-2 cursor-pointer hover:border-[#FF7A00]/40 transition-all"
        >
          <div className="flex items-center justify-between text-[#888888]">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total de Leads</span>
            <div className="p-2 bg-[#FF7A00]/10 text-[#FF7A00] rounded-xl">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xl sm:text-2xl font-black font-display text-white">
              {totalClients}
            </h4>
            <p className="text-[10px] text-[#34D399] font-bold">{leadsNovosCount} novos leads no topo</p>
          </div>
        </div>

        {/* KPI 2: Comissões no Mês */}
        <div 
          onClick={() => onNavigate('comissoes')}
          className="bg-[#161616] border border-[#303030] p-4 sm:p-5 rounded-2xl shadow-xs space-y-2 cursor-pointer hover:border-emerald-500/40 transition-all"
        >
          <div className="flex items-center justify-between text-[#888888]">
            <span className="text-[10px] font-bold uppercase tracking-wider">Comissões no Mês</span>
            <div className="p-2 bg-emerald-500/10 text-[#34D399] rounded-xl">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xl sm:text-2xl font-black font-display text-[#34D399]">
              {formatCurrency(monthlyCommissionSum)}
            </h4>
            <p className="text-[10px] text-[#888888]">{monthlySales.length} vendas registradas</p>
          </div>
        </div>

        {/* KPI 3: VGV Total Negociado */}
        <div 
          onClick={() => onNavigate('comissoes')}
          className="bg-[#161616] border border-[#303030] p-4 sm:p-5 rounded-2xl shadow-xs space-y-2 cursor-pointer hover:border-[#FF7A00]/40 transition-all"
        >
          <div className="flex items-center justify-between text-[#888888]">
            <span className="text-[10px] font-bold uppercase tracking-wider">VGV Comercializado</span>
            <div className="p-2 bg-[#FF7A00]/10 text-[#FF7A00] rounded-xl">
              <Briefcase className="h-4 w-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xl sm:text-2xl font-black font-display text-white">
              {totalVgvSum > 0 ? formatCurrency(totalVgvSum) : 'R$ 0,00'}
            </h4>
            <p className="text-[10px] text-[#888888]">Volume geral acumulado</p>
          </div>
        </div>

        {/* KPI 4: Taxa de Conversão */}
        <div 
          onClick={() => onNavigate('funil')}
          className="bg-[#161616] border border-[#303030] p-4 sm:p-5 rounded-2xl shadow-xs space-y-2 cursor-pointer hover:border-amber-500/40 transition-all"
        >
          <div className="flex items-center justify-between text-[#888888]">
            <span className="text-[10px] font-bold uppercase tracking-wider">Taxa de Conversão</span>
            <div className="p-2 bg-amber-500/10 text-[#FBBF24] rounded-xl">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xl sm:text-2xl font-black font-display text-white">
              {conversionRate}%
            </h4>
            <p className="text-[10px] text-[#888888]">{totalFechadas} fechadas vs {totalPerdidos} perdidos</p>
          </div>
        </div>
      </div>

      {/* 4. Charts Section (Funnel Distribution + Monthly Commissions Evolution) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Chart 1: Funnel Stages Bar */}
        <div className="bg-[#161616] border border-[#303030] rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm font-display text-white">
                Distribuição do Funil de Vendas
              </h3>
              <p className="text-xs text-[#888888]">Volume de leads em cada etapa da jornada</p>
            </div>
            <button
              onClick={() => onNavigate('funil')}
              className="text-xs text-[#FF7A00] hover:underline font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>Ver Kanban</span>
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelStages} margin={{ top: 10, right: 10, left: -25, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.08} />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 9, fill: '#888888' }} 
                  angle={-30} 
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fontSize: 10, fill: '#888888' }} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#161616', 
                    borderRadius: '12px', 
                    border: '1px solid #303030', 
                    color: '#fff',
                    fontSize: '12px' 
                  }}
                  cursor={{ fill: 'rgba(255, 122, 0, 0.05)' }}
                />
                <Bar dataKey="value" name="Leads" radius={[6, 6, 0, 0]}>
                  {funnelStages.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Monthly Commissions Evolution Area Chart */}
        <div className="bg-[#161616] border border-[#303030] rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm font-display text-white">
                Evolução Mensal de Comissões (2026)
              </h3>
              <p className="text-xs text-[#888888]">Curva de honorários arrecadados no ano</p>
            </div>
            <button
              onClick={() => onNavigate('comissoes')}
              className="text-xs text-[#FF7A00] hover:underline font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>Ver Extrato</span>
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={commissionChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="commGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF7A00" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#FF7A00" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.08} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#888888' }} />
                <YAxis 
                  tick={{ fontSize: 10, fill: '#888888' }} 
                  tickFormatter={(val) => `R$${val >= 1000 ? `${val / 1000}k` : val}`}
                />
                <Tooltip 
                  formatter={(val: any) => [formatCurrency(Number(val)), 'Comissão']}
                  contentStyle={{ 
                    backgroundColor: '#161616', 
                    borderRadius: '12px', 
                    border: '1px solid #303030', 
                    color: '#fff',
                    fontSize: '12px' 
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="Comissao" 
                  stroke="#FF7A00" 
                  strokeWidth={2.5} 
                  fillOpacity={1} 
                  fill="url(#commGrad)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 5. Bottom Row: Termômetro de Atenção (Leads Esquecidos) + Distribuição por Origem */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Termômetro dos Esquecidos (2 Cols) */}
        <div className="lg:col-span-2 bg-[#161616] border border-[#303030] rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-rose-500/10 text-[#FB7185] rounded-xl border border-rose-500/20">
                <Flame className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm font-display text-white">
                  Termômetro de Atenção (Leads sem Contato Recente)
                </h3>
                <p className="text-xs text-[#888888]">Clientes em negociação que necessitam de resgate</p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('clientes')}
              className="text-xs text-[#FF7A00] hover:underline font-bold cursor-pointer"
            >
              Ver Carteira
            </button>
          </div>

          {warmClientsEsquecidos.length === 0 ? (
            <div className="p-8 text-center text-[#888888]">
              <p className="text-xs font-semibold">Todos os seus leads estão em dia com contatos recentes!</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {warmClientsEsquecidos.map(({ client, days }) => (
                <div
                  key={client.id}
                  className="p-3 bg-[#1F1F1F] border border-[#303030] rounded-2xl flex items-center justify-between gap-3 hover:border-[#FF7A00]/30 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-xl text-xs font-bold font-mono ${
                      days >= 14 
                        ? 'bg-rose-500/15 text-[#FB7185] border border-rose-500/20' 
                        : 'bg-amber-500/15 text-[#FBBF24] border border-amber-500/20'
                    }`}>
                      {days === 99 ? 'Nunca' : `${days}d`}
                    </div>
                    <div className="min-w-0">
                      <button
                        onClick={() => onSelectClient(client.id)}
                        className="text-xs font-bold text-white hover:text-[#FF7A00] truncate block text-left cursor-pointer"
                      >
                        {client.name}
                      </button>
                      <span className="text-[10px] text-[#888888] block truncate">
                        Fase: <strong className="text-[#E5E5E5]">{client.status}</strong> {client.empreendimento ? `• ${client.empreendimento}` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleRescueWhatsApp(client)}
                      className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 text-[#34D399] hover:bg-emerald-500/20 text-xs font-bold flex items-center gap-1 border border-emerald-500/20 transition-all cursor-pointer"
                      title="Chamar no WhatsApp"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">WhatsApp</span>
                    </button>
                    <button
                      onClick={() => onSelectClient(client.id)}
                      className="p-1.5 text-[#888888] hover:text-[#FF7A00] rounded-lg hover:bg-[#161616] transition-all cursor-pointer"
                      title="Abrir Ficha"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lead Origins Pie Distribution */}
        <div className="bg-[#161616] border border-[#303030] rounded-3xl p-5 sm:p-6 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm font-display text-white flex items-center gap-2">
              <PieIcon className="h-4 w-4 text-[#FF7A00]" />
              <span>Origem dos Leads</span>
            </h3>
            <p className="text-xs text-[#888888]">Canais de captação de clientes</p>
          </div>

          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={originDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {originDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#161616', 
                    borderRadius: '12px', 
                    border: '1px solid #303030', 
                    color: '#fff', 
                    fontSize: '12px' 
                  }} 
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-[#303030]">
            {originDistribution.map(item => (
              <div key={item.name} className="flex items-center gap-1.5 text-[10px] text-[#888888]">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span>{item.name} ({item.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { Sale, Client } from '../types';
import { 
  DollarSign, 
  Plus, 
  Trash2, 
  TrendingUp, 
  Calendar, 
  Award, 
  Activity, 
  Briefcase,
  AlertCircle,
  Download,
  Target,
  Calculator,
  Search,
  CheckCircle2,
  Clock,
  Building2,
  Percent,
  X,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';

interface CommissionsProps {
  sales: Sale[];
  clients: Client[];
  onAddSale: (sale: Omit<Sale, 'id'>) => void;
  onDeleteSale: (id: string) => void;
}

export default function Commissions({
  sales,
  clients,
  onAddSale,
  onDeleteSale
}: CommissionsProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'Recebido' | 'A Receber'>('all');

  // Broker Monthly Target State (Default R$ 30.000)
  const [monthlyTarget, setMonthlyTarget] = useState<number>(() => {
    const saved = localStorage.getItem('merlin_broker_monthly_target');
    return saved ? parseFloat(saved) : 30000;
  });
  const [editingTargetInput, setEditingTargetInput] = useState<string>(monthlyTarget.toString());

  // Form States
  const [clientSelectionType, setClientSelectionType] = useState<'existing' | 'custom'>('existing');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [customClientName, setCustomClientName] = useState('');
  const [commissionValue, setCommissionValue] = useState('');
  const [vgvValue, setVgvValue] = useState('');
  const [propertyName, setPropertyName] = useState('');
  const [commissionRate, setCommissionRate] = useState('3.0');
  const [paymentStatus, setPaymentStatus] = useState<'Recebido' | 'A Receber'>('Recebido');
  const [notes, setNotes] = useState('');
  const [saleDate, setSaleDate] = useState(() => {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });

  // Standalone Calculator States
  const [calcVgv, setCalcVgv] = useState('850000');
  const [calcRate, setCalcRate] = useState('4.0');
  const [calcRepasse, setCalcRepasse] = useState('50'); // 50% repasse corretor

  const referenceDate = new Date();
  const currentMonth = referenceDate.getMonth(); // 0-indexed
  const currentYear = referenceDate.getFullYear();

  // Save Target
  const handleSaveTarget = () => {
    const val = parseFloat(editingTargetInput);
    if (!isNaN(val) && val > 0) {
      setMonthlyTarget(val);
      localStorage.setItem('merlin_broker_monthly_target', val.toString());
      setShowGoalModal(false);
    }
  };

  // Metric Calculations
  const monthlySales = useMemo(() => {
    return sales.filter(s => {
      const sDate = new Date(s.saleDate + 'T12:00:00');
      return sDate.getMonth() === currentMonth && sDate.getFullYear() === currentYear;
    });
  }, [sales, currentMonth, currentYear]);

  const monthCommissionTotal = useMemo(() => {
    return monthlySales.reduce((sum, s) => sum + s.commissionValue, 0);
  }, [monthlySales]);

  const yearCommissionTotal = useMemo(() => {
    return sales
      .filter(s => new Date(s.saleDate + 'T12:00:00').getFullYear() === selectedYear)
      .reduce((sum, s) => sum + s.commissionValue, 0);
  }, [sales, selectedYear]);

  const totalSalesCount = sales.length;

  const ticketMedio = useMemo(() => {
    return totalSalesCount > 0 
      ? Math.round(sales.reduce((sum, s) => sum + s.commissionValue, 0) / totalSalesCount)
      : 0;
  }, [sales, totalSalesCount]);

  // Goal Progress Math
  const goalProgressPercent = Math.min(100, Math.round((monthCommissionTotal / monthlyTarget) * 100));
  const goalRemainingValue = Math.max(0, monthlyTarget - monthCommissionTotal);
  const salesNeededForGoal = ticketMedio > 0 && goalRemainingValue > 0
    ? Math.ceil(goalRemainingValue / ticketMedio)
    : goalRemainingValue > 0 ? 1 : 0;

  // Auto-calculate commission based on VGV
  const handleVgvChange = (vgvStr: string) => {
    setVgvValue(vgvStr);
    const vgvNum = parseFloat(vgvStr);
    const rateNum = parseFloat(commissionRate);
    if (!isNaN(vgvNum) && !isNaN(rateNum) && vgvNum > 0) {
      const calculatedComm = (vgvNum * (rateNum / 100)).toFixed(2);
      setCommissionValue(calculatedComm);
    }
  };

  // Submit Sale Handler
  const handleSubmitSale = (e: React.FormEvent) => {
    e.preventDefault();
    let clientName = '';
    let clientId: string | undefined = undefined;

    if (clientSelectionType === 'existing') {
      const foundClient = clients.find(c => c.id === selectedClientId);
      if (!foundClient) {
        alert('Selecione um cliente válido da carteira ou digite um nome avulso.');
        return;
      }
      clientName = foundClient.name;
      clientId = foundClient.id;
    } else {
      if (!customClientName.trim()) {
        alert('Digite o nome do comprador.');
        return;
      }
      clientName = customClientName.trim();
    }

    const value = parseFloat(commissionValue);
    if (isNaN(value) || value <= 0) {
      alert('Digite um valor de comissão válido.');
      return;
    }

    onAddSale({
      clientId,
      clientName,
      commissionValue: value,
      saleDate,
      vgv: vgvValue ? parseFloat(vgvValue) : undefined,
      propertyName: propertyName.trim() || undefined,
      commissionRate: commissionRate ? parseFloat(commissionRate) : undefined,
      paymentStatus,
      notes: notes.trim() || undefined
    });

    // Reset Form
    setSelectedClientId('');
    setCustomClientName('');
    setCommissionValue('');
    setVgvValue('');
    setPropertyName('');
    setNotes('');
    setShowAddForm(false);
  };

  // Filtered sales for the table
  const filteredSales = useMemo(() => {
    return sales
      .filter(s => {
        // Year filter
        const sYear = new Date(s.saleDate + 'T12:00:00').getFullYear();
        if (sYear !== selectedYear) return false;

        // Status filter
        if (selectedStatusFilter !== 'all' && (s.paymentStatus || 'Recebido') !== selectedStatusFilter) {
          return false;
        }

        // Search term
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const matchesName = s.clientName.toLowerCase().includes(term);
          const matchesProp = s.propertyName?.toLowerCase().includes(term);
          if (!matchesName && !matchesProp) return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime());
  }, [sales, selectedYear, selectedStatusFilter, searchTerm]);

  // Export to Excel
  const handleExportExcel = () => {
    if (sales.length === 0) {
      alert('Não há registros de vendas para exportar.');
      return;
    }

    const dataToExport = sales.map(s => ({
      'Cliente Comprador': s.clientName,
      'Data da Venda': new Date(s.saleDate + 'T12:00:00').toLocaleDateString('pt-BR'),
      'Empreendimento / Imóvel': s.propertyName || 'N/A',
      'VGV (R$)': s.vgv || 0,
      'Taxa Comissão (%)': s.commissionRate ? `${s.commissionRate}%` : 'N/A',
      'Comissão Recebida (R$)': s.commissionValue,
      'Status': s.paymentStatus || 'Recebido',
      'Observações': s.notes || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Comissões');
    XLSX.writeFile(workbook, `Extrato_Comissoes_${selectedYear}.xlsx`);
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Calculated honorários in calculator modal
  const calcGross = (parseFloat(calcVgv) || 0) * ((parseFloat(calcRate) || 0) / 100);
  const calcNet = calcGross * ((parseFloat(calcRepasse) || 0) / 100);

  return (
    <div className="space-y-6" id="commissions-panel">
      {/* 1. Header with Title & Action Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
            <span>Controle Financeiro &amp; Comissões</span>
            <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-[#34D399] border border-emerald-500/20">
              {sales.length} escrituras fechadas
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#888888]">
            Acompanhe seu rendimento mensal, metas de faturamento e extrato detalhado
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Calculator Trigger */}
          <button
            onClick={() => setShowCalculator(!showCalculator)}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-[#2A2A2A] text-slate-600 dark:text-[#E5E5E5] hover:text-[#FD7A00] hover:bg-slate-50 dark:hover:bg-[#161616] transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer"
            title="Simulador de Honorários e VGV"
          >
            <Calculator className="h-4 w-4 text-[#FD7A00]" />
            <span className="hidden sm:inline">Calculadora VGV</span>
          </button>

          {/* Export Excel Button */}
          <button
            onClick={handleExportExcel}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-[#2A2A2A] text-slate-600 dark:text-[#E5E5E5] hover:text-emerald-500 hover:bg-slate-50 dark:hover:bg-[#161616] transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer"
            title="Exportar Planilha Excel (.xlsx)"
          >
            <Download className="h-4 w-4 text-emerald-500" />
            <span className="hidden sm:inline">Exportar Excel</span>
          </button>

          {/* Register Sale Primary Button */}
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-gradient-to-r from-[#FF9800] via-[#FD7A00] to-[#E85D00] text-[#0B0B0B] font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-sm shadow-[#FD7A00]/20 active:scale-95 transition-all cursor-pointer hover:brightness-105"
          >
            <Plus className="h-4 w-4" />
            <span>Lançar Venda</span>
          </button>
        </div>
      </div>

      {/* 2. Monthly Target & Progress Box */}
      <div className="bg-gradient-to-br from-[#161616] via-[#111111] to-[#0B0B0B] border border-[#FD7A00]/30 rounded-3xl p-5 sm:p-6 text-white shadow-xl relative overflow-hidden">
        {/* Background glow accents */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#FD7A00]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-[#E85D00]/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Target Stats */}
          <div className="space-y-2 flex-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#FD7A00]/20 text-[#FD7A00] rounded-xl border border-[#FD7A00]/30">
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#FD7A00] font-display">
                    Meta de Comissões do Mês
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-[#888888]">
                    Acompanhamento em tempo real para o mês vigente
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setEditingTargetInput(monthlyTarget.toString());
                  setShowGoalModal(true);
                }}
                className="text-xs text-[#FD7A00] hover:text-[#FF9800] underline font-semibold cursor-pointer"
              >
                Ajustar Meta
              </button>
            </div>

            <div className="flex items-baseline gap-3 pt-1">
              <span className="text-3xl sm:text-4xl font-black font-display text-white tracking-tight">
                {formatCurrency(monthCommissionTotal)}
              </span>
              <span className="text-sm text-slate-400 dark:text-[#888888] font-medium">
                de {formatCurrency(monthlyTarget)}
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                goalProgressPercent >= 100 
                  ? 'bg-emerald-500/20 text-[#34D399] border border-emerald-500/30' 
                  : 'bg-[#FD7A00]/20 text-[#FD7A00] border border-[#FD7A00]/30'
              }`}>
                {goalProgressPercent}% atingido
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-[#222222] rounded-full h-3 overflow-hidden p-0.5 border border-[#2A2A2A]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${goalProgressPercent}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="h-full rounded-full bg-gradient-to-r from-[#FF9800] via-[#FD7A00] to-[#E85D00] shadow-sm shadow-[#FD7A00]/50"
              />
            </div>
          </div>

          {/* Goal Insights pill */}
          <div className="bg-[#161616]/90 border border-[#2A2A2A] rounded-2xl p-4 flex items-center gap-4 min-w-[240px]">
            <div className="p-3 rounded-xl bg-amber-500/10 text-[#FD7A00] border border-[#FD7A00]/20">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-[#888888] tracking-wider">
                Para Bater a Meta:
              </p>
              {goalRemainingValue === 0 ? (
                <p className="text-sm font-bold text-[#34D399] flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> Meta Atingida! Parabéns!
                </p>
              ) : (
                <>
                  <p className="text-base font-bold text-white">
                    Faltam {formatCurrency(goalRemainingValue)}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-[#888888]">
                    Aprox. <strong className="text-[#FD7A00]">{salesNeededForGoal} {salesNeededForGoal === 1 ? 'venda' : 'vendas'}</strong> pelo ticket médio
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Metric Bento Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Metric 1: Month Commission */}
        <div className="bg-white dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] p-4 sm:p-5 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400 dark:text-[#888888]">
            <span className="text-[10px] font-bold uppercase tracking-wider">Comissão do Mês</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-[#34D399] rounded-xl">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xl sm:text-2xl font-black font-display text-slate-900 dark:text-white">
              {formatCurrency(monthCommissionTotal)}
            </h4>
            <p className="text-[10px] text-slate-400 dark:text-[#888888]">{monthlySales.length} fechamentos no mês</p>
          </div>
        </div>

        {/* Metric 2: Year Commission */}
        <div className="bg-white dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] p-4 sm:p-5 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400 dark:text-[#888888]">
            <span className="text-[10px] font-bold uppercase tracking-wider">Acumulado {selectedYear}</span>
            <div className="p-2 bg-[#FD7A00]/10 text-[#FD7A00] rounded-xl">
              <Briefcase className="h-4 w-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xl sm:text-2xl font-black font-display text-slate-900 dark:text-white">
              {formatCurrency(yearCommissionTotal)}
            </h4>
            <p className="text-[10px] text-slate-400 dark:text-[#888888]">Total no ano em exercício</p>
          </div>
        </div>

        {/* Metric 3: Total Sales */}
        <div className="bg-white dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] p-4 sm:p-5 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400 dark:text-[#888888]">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total de Vendas</span>
            <div className="p-2 bg-[#FD7A00]/10 text-[#FD7A00] rounded-xl">
              <Award className="h-4 w-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xl sm:text-2xl font-black font-display text-slate-900 dark:text-white">
              {totalSalesCount}
            </h4>
            <p className="text-[10px] text-slate-400 dark:text-[#888888]">Escrituras e contratos</p>
          </div>
        </div>

        {/* Metric 4: Ticket Médio */}
        <div className="bg-white dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] p-4 sm:p-5 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400 dark:text-[#888888]">
            <span className="text-[10px] font-bold uppercase tracking-wider">Ticket Médio</span>
            <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-[#FF9800] rounded-xl">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xl sm:text-2xl font-black font-display text-slate-900 dark:text-white">
              {formatCurrency(ticketMedio)}
            </h4>
            <p className="text-[10px] text-slate-400 dark:text-[#888888]">Honorários médios por venda</p>
          </div>
        </div>
      </div>

      {/* 4. Standalone VGV / Honorários Calculator (Collapsible) */}
      <AnimatePresence>
        {showCalculator && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-slate-50 dark:bg-[#161616] border border-[#FD7A00]/30 rounded-3xl p-5 sm:p-6 shadow-md space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-[#2A2A2A]">
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-[#FD7A00]" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white font-display">
                  Simulador de VGV &amp; Divisão de Comissões
                </h3>
              </div>
              <button 
                onClick={() => setShowCalculator(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-[#222222] transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-[#888888]">Valor do Imóvel (VGV)</label>
                <input
                  type="number"
                  value={calcVgv}
                  onChange={(e) => setCalcVgv(e.target.value)}
                  className="w-full text-xs bg-white dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-[#FD7A00]"
                  placeholder="Ex: 850000"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-[#888888]">Comissão da Imobiliária (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={calcRate}
                  onChange={(e) => setCalcRate(e.target.value)}
                  className="w-full text-xs bg-white dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-[#FD7A00]"
                  placeholder="Ex: 4.0"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-[#888888]">Seu Repasse Corretor (%)</label>
                <input
                  type="number"
                  value={calcRepasse}
                  onChange={(e) => setCalcRepasse(e.target.value)}
                  className="w-full text-xs bg-white dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-[#FD7A00]"
                  placeholder="Ex: 50"
                />
              </div>
            </div>

            {/* Calculated output card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-white dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A]">
                <span className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase">Comissão Bruta Total:</span>
                <p className="text-base font-black text-slate-800 dark:text-[#E5E5E5] font-mono">
                  {formatCurrency(calcGross)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[#FD7A00]/10 border border-[#FD7A00]/30">
                <span className="text-[10px] font-bold text-[#FD7A00] uppercase">Sua Comissão Líquida a Receber:</span>
                <p className="text-lg font-black text-[#FD7A00] font-mono">
                  {formatCurrency(calcNet)}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. Sales Statement Table with Search & Year Filters */}
      <div className="bg-white dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] rounded-3xl overflow-hidden shadow-xs space-y-4">
        {/* Table Header / Filters */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-[#2A2A2A] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-[#0B0B0B]">
          <div>
            <h3 className="font-bold text-sm font-display text-slate-900 dark:text-white">
              Extrato de Vendas &amp; Recebimentos
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#888888]">
              Exibindo {filteredSales.length} de {sales.length} registros
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Box */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrar por comprador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-xs bg-white dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl pl-8 pr-3 py-1.5 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#FD7A00]"
              />
            </div>

            {/* Status Filter */}
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
              className="text-xs bg-white dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl px-2.5 py-1.5 text-slate-700 dark:text-[#E5E5E5] focus:outline-none cursor-pointer"
            >
              <option value="all">Todos Status</option>
              <option value="Recebido">Recebidos</option>
              <option value="A Receber">A Receber</option>
            </select>

            {/* Year Selector */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="text-xs bg-white dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl px-2.5 py-1.5 text-slate-700 dark:text-[#E5E5E5] font-bold focus:outline-none cursor-pointer"
            >
              <option value={2026}>Ano 2026</option>
              <option value={2025}>Ano 2025</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        {filteredSales.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-[#888888] space-y-2">
            <AlertCircle className="h-10 w-10 mx-auto text-slate-300 dark:text-[#444444]" />
            <p className="font-bold text-sm text-slate-700 dark:text-[#E5E5E5]">Nenhum lançamento encontrado</p>
            <p className="text-xs max-w-sm mx-auto">Cadastre suas vendas para alimentar o painel financeiro e acompanhar suas metas.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-[#2A2A2A] text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase tracking-wider">
                  <th className="p-4 pl-6">Cliente Comprador</th>
                  <th className="p-4">Empreendimento</th>
                  <th className="p-4">Data da Venda</th>
                  <th className="p-4 text-right">VGV do Imóvel</th>
                  <th className="p-4 text-right">Sua Comissão</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 pr-6 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#222222] text-xs">
                {filteredSales.map(sale => {
                  return (
                    <tr 
                      key={sale.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-[#222222]/40 transition-all"
                      id={`sale-row-${sale.id}`}
                    >
                      {/* Buyer */}
                      <td className="p-4 pl-6 font-bold text-slate-800 dark:text-white">
                        {sale.clientName}
                        {sale.clientId && (
                          <span className="text-[9px] text-[#FD7A00] bg-[#FD7A00]/10 border border-[#FD7A00]/20 px-1.5 py-0.5 rounded-md ml-2 font-medium">
                            CRM
                          </span>
                        )}
                      </td>

                      {/* Property */}
                      <td className="p-4 text-slate-600 dark:text-[#E5E5E5] flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-slate-400 dark:text-[#888888] flex-shrink-0" />
                        <span className="truncate max-w-[150px]">{sale.propertyName || 'Imóvel Avulso'}</span>
                      </td>

                      {/* Date */}
                      <td className="p-4 font-mono text-slate-500 dark:text-[#888888] font-semibold">
                        {new Date(sale.saleDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </td>

                      {/* VGV */}
                      <td className="p-4 text-right font-mono text-slate-600 dark:text-[#888888] font-medium">
                        {sale.vgv ? formatCurrency(sale.vgv) : '—'}
                      </td>

                      {/* Commission */}
                      <td className="p-4 text-right font-black text-emerald-600 dark:text-[#34D399] font-mono text-sm">
                        {formatCurrency(sale.commissionValue)}
                      </td>

                      {/* Status */}
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          (sale.paymentStatus || 'Recebido') === 'Recebido'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-[#34D399] border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-600 dark:text-[#FD7A00] border border-amber-500/20'
                        }`}>
                          {(sale.paymentStatus || 'Recebido') === 'Recebido' ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <Clock className="h-3 w-3" />
                          )}
                          <span>{sale.paymentStatus || 'Recebido'}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-center pr-6">
                        <button
                          onClick={() => {
                            if (confirm(`Remover permanentemente o registro de comissão de ${sale.clientName}?`)) {
                              onDeleteSale(sale.id);
                            }
                          }}
                          className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-400 hover:text-[#FB7185] rounded-lg transition-colors cursor-pointer"
                          title="Remover Registro"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. CREATE SALE MODAL DIALOG */}
      <AnimatePresence>
        {showAddForm && (
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            onClick={() => setShowAddForm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#0B0B0B] border border-slate-200 dark:border-[#2A2A2A] rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="bg-slate-50 dark:bg-[#161616] px-6 py-4 border-b border-slate-200 dark:border-[#2A2A2A] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-500/10 text-[#34D399] rounded-xl border border-emerald-500/20">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold font-display text-slate-900 dark:text-white">
                      Registrar Venda &amp; Comissão
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-[#888888]">Lançamento de honorários no extrato</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#222222] transition-all cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitSale} className="p-6 space-y-4 overflow-y-auto flex-1">
                {/* Buyer selection mode */}
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#161616] p-1 rounded-xl w-fit border border-transparent dark:border-[#2A2A2A]">
                  <button
                    type="button"
                    onClick={() => setClientSelectionType('existing')}
                    className={`text-xs px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      clientSelectionType === 'existing'
                        ? 'bg-white dark:bg-[#222222] text-[#FD7A00] shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    Cliente da Carteira (CRM)
                  </button>
                  <button
                    type="button"
                    onClick={() => setClientSelectionType('custom')}
                    className={`text-xs px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      clientSelectionType === 'custom'
                        ? 'bg-white dark:bg-[#222222] text-[#FD7A00] shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    Comprador Avulso
                  </button>
                </div>

                {/* Buyer input */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase tracking-wider block">
                    Nome do Comprador *
                  </label>
                  {clientSelectionType === 'existing' ? (
                    <select
                      value={selectedClientId}
                      onChange={(e) => {
                        setSelectedClientId(e.target.value);
                        const c = clients.find(cl => cl.id === e.target.value);
                        if (c?.empreendimento) setPropertyName(c.empreendimento);
                      }}
                      className="w-full text-xs bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#FD7A00] cursor-pointer"
                      required
                    >
                      <option value="">Selecione um lead...</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Ex: Carlos Albuquerque"
                      value={customClientName}
                      onChange={(e) => setCustomClientName(e.target.value)}
                      className="w-full text-xs bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#FD7A00]"
                      required
                    />
                  )}
                </div>

                {/* Property Name */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase tracking-wider block">
                    Empreendimento / Unidade Negociada
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Reserva Imperial - Apto 84"
                    value={propertyName}
                    onChange={(e) => setPropertyName(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#FD7A00]"
                  />
                </div>

                {/* VGV & Commission Rate & Commission Value Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase tracking-wider block">
                      VGV do Imóvel (R$)
                    </label>
                    <input
                      type="number"
                      placeholder="850000"
                      value={vgvValue}
                      onChange={(e) => handleVgvChange(e.target.value)}
                      className="w-full text-xs bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#FD7A00] font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase tracking-wider block">
                      Taxa de Comissão (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="3.0"
                      value={commissionRate}
                      onChange={(e) => {
                        setCommissionRate(e.target.value);
                        if (vgvValue) {
                          const v = parseFloat(vgvValue);
                          const r = parseFloat(e.target.value);
                          if (!isNaN(v) && !isNaN(r)) {
                            setCommissionValue((v * (r / 100)).toFixed(2));
                          }
                        }
                      }}
                      className="w-full text-xs bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#FD7A00] font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase tracking-wider block">
                      Sua Comissão (R$) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="25500"
                      value={commissionValue}
                      onChange={(e) => setCommissionValue(e.target.value)}
                      className="w-full text-xs bg-slate-50 dark:bg-[#161616] border border-emerald-500/40 rounded-xl p-2.5 text-emerald-600 dark:text-[#34D399] font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      required
                    />
                  </div>
                </div>

                {/* Date & Payment Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase tracking-wider block">
                      Data da Venda *
                    </label>
                    <input
                      type="date"
                      value={saleDate}
                      onChange={(e) => setSaleDate(e.target.value)}
                      className="w-full text-xs bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#FD7A00] font-mono"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase tracking-wider block">
                      Status do Recebimento
                    </label>
                    <select
                      value={paymentStatus}
                      onChange={(e) => setPaymentStatus(e.target.value as any)}
                      className="w-full text-xs bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#FD7A00] cursor-pointer"
                    >
                      <option value="Recebido">Recebido na Conta</option>
                      <option value="A Receber">A Receber (Previsão)</option>
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase tracking-wider block">
                    Observações Financeiras
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Parcela única via PIX após assinatura da escritura"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#FD7A00]"
                  />
                </div>

                {/* Footer buttons */}
                <div className="flex gap-2 justify-end pt-3 border-t border-slate-100 dark:border-[#2A2A2A]">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="text-xs text-slate-500 dark:text-[#888888] font-semibold px-4 py-2 border border-slate-200 dark:border-[#2A2A2A] rounded-xl hover:bg-slate-50 dark:hover:bg-[#161616] transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="text-xs bg-gradient-to-r from-[#FF9800] via-[#FD7A00] to-[#E85D00] text-[#0B0B0B] font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm shadow-[#FD7A00]/20 transition-all cursor-pointer active:scale-95 hover:brightness-105"
                  >
                    <DollarSign className="h-4 w-4" />
                    <span>Confirmar Lançamento</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. ADJUST GOAL MODAL */}
      <AnimatePresence>
        {showGoalModal && (
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            onClick={() => setShowGoalModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#0B0B0B] border border-slate-200 dark:border-[#2A2A2A] rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-[#FD7A00]" />
                <h3 className="font-bold text-sm font-display text-slate-900 dark:text-white">
                  Definir Meta Mensal de Comissões
                </h3>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase tracking-wider block">
                  Valor Desejado no Mês (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                  <input
                    type="number"
                    value={editingTargetInput}
                    onChange={(e) => setEditingTargetInput(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] rounded-xl pl-9 pr-3 py-2.5 text-slate-800 dark:text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-[#FD7A00]"
                    placeholder="30000"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowGoalModal(false)}
                  className="text-xs text-slate-500 dark:text-[#888888] font-semibold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#2A2A2A] hover:bg-slate-50 dark:hover:bg-[#161616] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveTarget}
                  className="text-xs bg-gradient-to-r from-[#FF9800] to-[#FD7A00] text-[#0B0B0B] font-bold px-4 py-1.5 rounded-xl shadow-xs cursor-pointer hover:brightness-105"
                >
                  Salvar Meta
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

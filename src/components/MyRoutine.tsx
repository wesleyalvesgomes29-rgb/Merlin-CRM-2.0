import React, { useState, useMemo } from 'react';
import { Task, Client } from '../types';
import { 
  CheckSquare, 
  Square, 
  Trash2, 
  Plus, 
  Calendar, 
  Clock, 
  AlertCircle, 
  User, 
  CheckCircle2, 
  MessageSquare, 
  Phone, 
  Car, 
  FileText, 
  Users, 
  HelpCircle,
  X,
  ClipboardList,
  Flame,
  ArrowRight,
  Search,
  Filter,
  ExternalLink,
  MoreVertical,
  CalendarDays,
  Columns,
  Printer,
  Sparkles,
  Check,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MyRoutineProps {
  tasks: Task[];
  clients: Client[];
  onAddTask: (taskData: Omit<Task, 'id' | 'createdAt'>) => void;
  onToggleTaskComplete: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onSelectClient: (clientId: string) => void;
  onUpdateClient?: (client: Client) => void;
  showTodayOnly?: boolean;
  onClearTodayOnly?: () => void;
}

export const ACTION_TYPES = [
  { label: 'WhatsApp', value: 'WhatsApp', icon: MessageSquare, color: 'text-[#34D399] bg-[#34D399]/10 border-[#34D399]/30' },
  { label: 'Ligação', value: 'Ligação', icon: Phone, color: 'text-[#FD7A00] bg-[#FD7A00]/10 border-[#FD7A00]/30' },
  { label: 'Visita ao Imóvel', value: 'Visita ao Imóvel', icon: Car, color: 'text-[#FF9800] bg-[#FF9800]/10 border-[#FF9800]/30' },
  { label: 'Enviar Proposta', value: 'Enviar Proposta', icon: FileText, color: 'text-[#FBBF24] bg-[#FBBF24]/10 border-[#FBBF24]/30' },
  { label: 'Reunião', value: 'Reunião', icon: Users, color: 'text-[#FB7185] bg-[#FB7185]/10 border-[#FB7185]/30' },
  { label: 'Contrato / Docs', value: 'Contrato / Docs', icon: FileText, color: 'text-[#FD7A00] bg-[#FD7A00]/10 border-[#FD7A00]/30' },
  { label: 'Outro', value: 'Outro', icon: HelpCircle, color: 'text-slate-400 bg-slate-400/10 border-slate-400/30' }
];

export default function MyRoutine({
  tasks,
  clients,
  onAddTask,
  onToggleTaskComplete,
  onDeleteTask,
  onSelectClient,
  onUpdateClient,
  showTodayOnly = false,
  onClearTodayOnly
}: MyRoutineProps) {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [statusTab, setStatusTab] = useState<'pending' | 'completed' | 'all'>('pending');
  const [viewMode, setViewMode] = useState<'columns' | 'calendar'>('columns');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedActionFilter, setSelectedActionFilter] = useState<string>('all');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>('all');
  const [activeRescheduleMenuId, setActiveRescheduleMenuId] = useState<string | null>(null);

  // Form states for adding tasks
  const [clientId, setClientId] = useState('');
  const [actionType, setActionType] = useState('WhatsApp');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [priority, setPriority] = useState<'Alta' | 'Média' | 'Baixa'>('Média');
  const [notes, setNotes] = useState('');
  const [syncNextContact, setSyncNextContact] = useState(true);

  // Today Date string formatted
  const todayStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Quick Date Setters for creation form
  const handleSetQuickDate = (type: 'today' | 'tomorrow' | 'saturday') => {
    const d = new Date();
    if (type === 'tomorrow') {
      d.setDate(d.getDate() + 1);
    } else if (type === 'saturday') {
      const dayOfWeek = d.getDay();
      const distanceToSat = (6 - dayOfWeek + 7) % 7 || 7;
      d.setDate(d.getDate() + distanceToSat);
    }
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setDueDate(`${y}-${m}-${day}`);
  };

  // Reschedule handler
  const handleReschedule = (task: Task, daysToAdd: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysToAdd);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const newDate = `${y}-${m}-${day}`;

    // Update by deleting old and adding new with same properties
    onDeleteTask(task.id);
    onAddTask({
      clientId: task.clientId,
      clientName: task.clientName,
      actionType: task.actionType,
      dueDate: newDate,
      dueTime: task.dueTime,
      priority: task.priority,
      notes: task.notes,
      completed: false
    });
    setActiveRescheduleMenuId(null);
  };

  // Filter tasks based on search & action & priority
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesClient = task.clientName?.toLowerCase().includes(term);
        const matchesNotes = task.notes?.toLowerCase().includes(term);
        const matchesAction = task.actionType.toLowerCase().includes(term);
        if (!matchesClient && !matchesNotes && !matchesAction) return false;
      }

      // Action type filter
      if (selectedActionFilter !== 'all' && task.actionType !== selectedActionFilter) {
        return false;
      }

      // Priority filter
      if (selectedPriorityFilter !== 'all' && task.priority !== selectedPriorityFilter) {
        return false;
      }

      return true;
    });
  }, [tasks, searchTerm, selectedActionFilter, selectedPriorityFilter]);

  // Split into categories: Atrasadas, Hoje, Próximas
  const categories = useMemo(() => {
    const overdue: Task[] = [];
    const today: Task[] = [];
    const upcoming: Task[] = [];

    // Sort chronologically
    const sorted = [...filteredTasks].sort((a, b) => {
      const dateCompare = a.dueDate.localeCompare(b.dueDate);
      if (dateCompare !== 0) return dateCompare;
      const timeA = a.dueTime || '99:99';
      const timeB = b.dueTime || '99:99';
      return timeA.localeCompare(timeB);
    });

    sorted.forEach(task => {
      if (task.dueDate < todayStr) {
        overdue.push(task);
      } else if (task.dueDate === todayStr) {
        today.push(task);
      } else {
        upcoming.push(task);
      }
    });

    return { overdue, today, upcoming };
  }, [filteredTasks, todayStr]);

  // Calendar 7 Days calculation
  const next7Days = useMemo(() => {
    const days: { dateStr: string; label: string; dayNumber: number; weekDay: string; tasks: Task[] }[] = [];
    const weekDaysNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${day}`;

      const dayTasks = filteredTasks.filter(t => t.dueDate === dateStr);

      days.push({
        dateStr,
        label: i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : `${day}/${m}`,
        dayNumber: d.getDate(),
        weekDay: weekDaysNames[d.getDay()],
        tasks: dayTasks
      });
    }
    return days;
  }, [filteredTasks]);

  // Handle task submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dueDate) return;

    const linkedClient = clients.find(c => c.id === clientId);

    onAddTask({
      clientId: clientId || undefined,
      clientName: linkedClient ? linkedClient.name : undefined,
      actionType,
      dueDate,
      dueTime: dueTime || undefined,
      priority,
      notes: notes || undefined,
      completed: false
    });

    // Optionally update client next contact date
    if (linkedClient && syncNextContact && onUpdateClient) {
      const nextDateTime = dueTime ? `${dueDate}T${dueTime}` : `${dueDate}T10:00`;
      onUpdateClient({
        ...linkedClient,
        nextContactDate: nextDateTime
      });
    }

    // Reset
    setClientId('');
    setActionType('WhatsApp');
    setDueDate('');
    setDueTime('');
    setPriority('Média');
    setNotes('');
    setIsAddingTask(false);
  };

  // Helper for WhatsApp action
  const handleOpenWhatsApp = (task: Task) => {
    const linkedClient = clients.find(c => c.id === task.clientId);
    const phone = linkedClient?.phone;
    if (!phone) {
      alert('Cliente sem telefone cadastrado.');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
    const greeting = task.clientName ? `Olá, ${task.clientName}!` : 'Olá!';
    const context = task.notes ? ` Gostaria de falar com você sobre: ${task.notes}` : '';
    const text = encodeURIComponent(`${greeting} Tudo bem? Aqui é o seu consultor imobiliário.${context}`);
    window.open(`https://wa.me/${phoneWithCountry}?text=${text}`, '_blank');
  };

  // Helper for Call action
  const handleCall = (task: Task) => {
    const linkedClient = clients.find(c => c.id === task.clientId);
    const phone = linkedClient?.phone;
    if (!phone) {
      alert('Cliente sem telefone cadastrado.');
      return;
    }
    window.location.href = `tel:${phone.replace(/\D/g, '')}`;
  };

  // Helper for Action Icon & Color
  const getActionInfo = (type: string) => {
    const found = ACTION_TYPES.find(a => a.value === type);
    return found || { label: type, value: type, icon: HelpCircle, color: 'text-slate-500 bg-slate-500/10 border-slate-500/30' };
  };

  // Filter tasks list by status tab
  const filterByStatus = (list: Task[]) => {
    if (statusTab === 'all') return list;
    if (statusTab === 'pending') return list.filter(t => !t.completed);
    return list.filter(t => t.completed);
  };

  const pendingOverdueCount = useMemo(() => categories.overdue.filter(t => !t.completed).length, [categories.overdue]);
  const pendingTodayCount = useMemo(() => categories.today.filter(t => !t.completed).length, [categories.today]);
  const pendingUpcomingCount = useMemo(() => categories.upcoming.filter(t => !t.completed).length, [categories.upcoming]);

  // Print Routine
  const handlePrint = () => {
    window.print();
  };

  // Render a Single Task Card
  const renderTaskCard = (task: Task) => {
    const actionInfo = getActionInfo(task.actionType);
    const ActionIcon = actionInfo.icon;
    const linkedClient = clients.find(c => c.id === task.clientId);

    return (
      <motion.div
        key={task.id}
        layout
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`group bg-white dark:bg-[#161616] border rounded-2xl p-4 shadow-xs transition-all relative overflow-hidden flex flex-col justify-between ${
          task.completed 
            ? 'border-slate-100 dark:border-[#222222] opacity-60 bg-slate-50/50 dark:bg-[#0B0B0B]/50' 
            : 'border-slate-200 dark:border-[#2A2A2A] hover:border-[#FD7A00]/40 hover:shadow-md'
        }`}
        id={`task-card-${task.id}`}
      >
        {/* Priority visual bar */}
        <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${
          task.priority === 'Alta' 
            ? 'bg-[#FB7185] shadow-xs shadow-rose-500/50' 
            : task.priority === 'Média' 
              ? 'bg-[#FF9800]' 
              : 'bg-slate-300 dark:bg-[#303030]'
        }`} />

        <div className="pl-2 space-y-3">
          {/* Top row: Complete Checkbox + Badges + Options */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => onToggleTaskComplete(task.id)}
                className="text-slate-400 hover:text-[#FD7A00] dark:hover:text-[#FF9800] transition-colors cursor-pointer flex-shrink-0"
                title={task.completed ? 'Marcar como pendente' : 'Concluir tarefa'}
              >
                {task.completed ? (
                  <CheckCircle2 className="h-5 w-5 text-[#34D399]" />
                ) : (
                  <Square className="h-5 w-5 text-slate-300 dark:text-[#444444] hover:text-[#FD7A00]" />
                )}
              </button>

              {/* Action type badge */}
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${actionInfo.color}`}>
                <ActionIcon className="h-3 w-3" />
                <span>{task.actionType}</span>
              </span>

              {/* Priority badge */}
              {task.priority === 'Alta' && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-rose-500/15 text-[#FB7185] border border-rose-500/20">
                  <Flame className="h-2.5 w-2.5" /> Alta
                </span>
              )}

              {/* Date & Time */}
              <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-[#888888] flex items-center gap-1">
                <Calendar className="h-3 w-3 text-slate-400" />
                <span>
                  {task.dueDate === todayStr 
                    ? 'Hoje' 
                    : new Date(task.dueDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                </span>
                {task.dueTime && (
                  <>
                    <Clock className="h-3 w-3 text-[#FD7A00] ml-1" />
                    <span className="text-[#FD7A00] dark:text-[#FF9800] font-bold">{task.dueTime}</span>
                  </>
                )}
              </span>
            </div>

            {/* Quick delete / menu */}
            <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setActiveRescheduleMenuId(activeRescheduleMenuId === task.id ? null : task.id)}
                className="p-1 text-slate-400 hover:text-[#FD7A00] rounded-md hover:bg-slate-100 dark:hover:bg-[#222222] transition-colors cursor-pointer"
                title="Reagendar tarefa"
              >
                <Clock className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={() => onDeleteTask(task.id)}
                className="p-1 text-slate-400 hover:text-[#FB7185] rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                title="Excluir tarefa"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Reschedule Dropdown */}
          <AnimatePresence>
            {activeRescheduleMenuId === task.id && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-slate-50 dark:bg-[#0B0B0B] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2 space-y-1.5"
              >
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase tracking-wider">
                  <span>Adiar / Reagendar:</span>
                  <button onClick={() => setActiveRescheduleMenuId(null)} className="hover:text-white cursor-pointer">
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    onClick={() => handleReschedule(task, 0)}
                    className="text-[10px] font-semibold py-1 px-2 rounded-lg bg-white dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] text-slate-700 dark:text-[#E5E5E5] hover:border-[#FD7A00] cursor-pointer"
                  >
                    Hoje
                  </button>
                  <button
                    onClick={() => handleReschedule(task, 1)}
                    className="text-[10px] font-semibold py-1 px-2 rounded-lg bg-white dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] text-slate-700 dark:text-[#E5E5E5] hover:border-[#FD7A00] cursor-pointer"
                  >
                    Amanhã
                  </button>
                  <button
                    onClick={() => handleReschedule(task, 7)}
                    className="text-[10px] font-semibold py-1 px-2 rounded-lg bg-white dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] text-slate-700 dark:text-[#E5E5E5] hover:border-[#FD7A00] cursor-pointer"
                  >
                    +7 dias
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Notes description */}
          <p className={`text-xs font-medium text-slate-800 dark:text-[#E5E5E5] leading-relaxed break-words ${
            task.completed ? 'line-through text-slate-400 dark:text-[#888888]' : ''
          }`}>
            {task.notes || 'Sem anotações complementares.'}
          </p>

          {/* Linked CRM Client & Direct Actions */}
          <div className="pt-2 border-t border-slate-100 dark:border-[#222222] flex items-center justify-between gap-2 flex-wrap">
            {task.clientId ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold text-slate-400 dark:text-[#888888] uppercase tracking-wider">Lead:</span>
                <button
                  onClick={() => onSelectClient(task.clientId!)}
                  className="text-xs font-bold text-[#FD7A00] hover:text-[#FF9800] flex items-center gap-1 cursor-pointer"
                >
                  <User className="h-3 w-3" />
                  <span className="truncate max-w-[130px]">{task.clientName || 'Cliente'}</span>
                  <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                </button>
              </div>
            ) : (
              <span className="text-[10px] text-slate-400 dark:text-[#888888] italic">Tarefa Avulsa</span>
            )}

            {/* Direct Action Buttons (WhatsApp, Call) */}
            {task.clientId && linkedClient?.phone && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleOpenWhatsApp(task)}
                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-[#34D399] hover:bg-emerald-500/20 border border-emerald-500/20 transition-all cursor-pointer"
                  title="Abrir WhatsApp com mensagem rápida"
                >
                  <MessageSquare className="h-3 w-3" />
                  <span>Whats</span>
                </button>
                <button
                  onClick={() => handleCall(task)}
                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-[#FD7A00]/10 text-[#FD7A00] hover:bg-[#FD7A00]/20 border border-[#FD7A00]/20 transition-all cursor-pointer"
                  title="Ligar agora"
                >
                  <Phone className="h-3 w-3" />
                  <span>Ligar</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  // Render a Task Column
  const renderColumn = (title: string, list: Task[], emptyMsg: string, countBadgeColor: string, icon: any) => {
    const Icon = icon;
    const filtered = filterByStatus(list);

    return (
      <div className="space-y-3 flex flex-col h-full">
        {/* Column Header */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Icon className={`h-4.5 w-4.5 ${countBadgeColor}`} />
            <h3 className="text-xs font-bold font-display uppercase tracking-wider text-slate-800 dark:text-white">
              {title}
            </h3>
          </div>
          <span className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full ${
            filtered.length > 0
              ? 'bg-slate-200 dark:bg-[#222222] text-slate-800 dark:text-white'
              : 'bg-slate-100 dark:bg-[#161616] text-slate-400 dark:text-[#888888]'
          }`}>
            {filtered.length}
          </span>
        </div>

        {/* Column Body */}
        <div className="space-y-2.5 flex-1 min-h-[160px]">
          {filtered.length === 0 ? (
            <div className="bg-white/60 dark:bg-[#161616]/40 border border-dashed border-slate-200 dark:border-[#2A2A2A] rounded-2xl p-6 text-center space-y-2 flex flex-col items-center justify-center">
              <ClipboardList className="h-6 w-6 text-slate-300 dark:text-[#444444]" />
              <p className="text-xs text-slate-400 dark:text-[#888888] max-w-[200px]">{emptyMsg}</p>
            </div>
          ) : (
            filtered.map(task => renderTaskCard(task))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6" id="my-routine-module">
      {/* 1. Header with Stats & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
            <span>Agenda Comercial &amp; Rotina</span>
            <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-[#FD7A00]/10 text-[#FD7A00] border border-[#FD7A00]/20">
              {tasks.filter(t => !t.completed).length} pendentes
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#888888]">
            Gerencie follow-ups, visitas e atendimentos integrados à carteira de leads
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Print / Export Button */}
          <button
            onClick={handlePrint}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-[#2A2A2A] text-slate-500 dark:text-[#888888] hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#161616] transition-all cursor-pointer"
            title="Imprimir / Salvar Roteiro do Dia"
          >
            <Printer className="h-4 w-4" />
          </button>

          {/* View mode toggle: Columns vs Weekly Calendar */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] rounded-xl">
            <button
              onClick={() => setViewMode('columns')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'columns'
                  ? 'bg-white dark:bg-[#222222] text-[#FD7A00] shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <Columns className="h-3.5 w-3.5" />
              <span>Colunas</span>
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'calendar'
                  ? 'bg-white dark:bg-[#222222] text-[#FD7A00] shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span>Semana</span>
            </button>
          </div>

          {/* Add Task Primary Button */}
          <button
            onClick={() => setIsAddingTask(true)}
            className="bg-gradient-to-r from-[#FF9800] via-[#FD7A00] to-[#E85D00] text-[#0B0B0B] font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-sm shadow-[#FD7A00]/20 active:scale-95 transition-all cursor-pointer hover:brightness-105"
          >
            <Plus className="h-4 w-4" />
            <span>Nova Tarefa</span>
          </button>
        </div>
      </div>

      {/* 2. Top Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Atrasadas */}
        <div 
          onClick={() => { setStatusTab('pending'); setSelectedPriorityFilter('all'); }}
          className="bg-white dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] rounded-2xl p-4 flex items-center justify-between shadow-xs cursor-pointer hover:border-[#FB7185]/40 transition-all"
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase tracking-wider">Atrasadas</span>
            <div className="text-2xl font-black font-display text-slate-900 dark:text-white">
              {pendingOverdueCount}
            </div>
          </div>
          <div className={`p-3 rounded-xl ${
            pendingOverdueCount > 0 
              ? 'bg-rose-500/10 text-[#FB7185] animate-pulse border border-rose-500/20' 
              : 'bg-slate-100 dark:bg-[#222222] text-slate-400'
          }`}>
            <AlertCircle className="h-5 w-5" />
          </div>
        </div>

        {/* De Hoje */}
        <div 
          onClick={() => { setStatusTab('pending'); setSelectedPriorityFilter('all'); }}
          className="bg-white dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] rounded-2xl p-4 flex items-center justify-between shadow-xs cursor-pointer hover:border-[#FD7A00]/40 transition-all"
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase tracking-wider">Compromissos Hoje</span>
            <div className="text-2xl font-black font-display text-[#FD7A00]">
              {pendingTodayCount}
            </div>
          </div>
          <div className={`p-3 rounded-xl ${
            pendingTodayCount > 0 
              ? 'bg-[#FD7A00]/10 text-[#FD7A00] border border-[#FD7A00]/20' 
              : 'bg-slate-100 dark:bg-[#222222] text-slate-400'
          }`}>
            <Calendar className="h-5 w-5" />
          </div>
        </div>

        {/* Próximas */}
        <div 
          onClick={() => { setStatusTab('pending'); setSelectedPriorityFilter('all'); }}
          className="bg-white dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] rounded-2xl p-4 flex items-center justify-between shadow-xs cursor-pointer hover:border-amber-500/40 transition-all"
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase tracking-wider">Próximos Dias</span>
            <div className="text-2xl font-black font-display text-slate-900 dark:text-white">
              {pendingUpcomingCount}
            </div>
          </div>
          <div className="p-3 bg-amber-500/10 text-[#FF9800] border border-amber-500/20 rounded-xl">
            <Clock className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* 3. Search, Status Tabs & Filter Pills Bar */}
      <div className="bg-white dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] rounded-2xl p-3.5 space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Status Tab switch (Pendentes / Concluídas / Todas) */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#0B0B0B] rounded-xl w-fit border border-transparent dark:border-[#2A2A2A]">
            <button
              onClick={() => setStatusTab('pending')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                statusTab === 'pending'
                  ? 'bg-white dark:bg-[#222222] text-[#FD7A00] shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Pendentes ({tasks.filter(t => !t.completed).length})
            </button>
            <button
              onClick={() => setStatusTab('completed')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                statusTab === 'completed'
                  ? 'bg-white dark:bg-[#222222] text-[#34D399] shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Concluídas ({tasks.filter(t => t.completed).length})
            </button>
            <button
              onClick={() => setStatusTab('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                statusTab === 'all'
                  ? 'bg-white dark:bg-[#222222] text-slate-800 dark:text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Todas ({tasks.length})
            </button>
          </div>

          {/* Search box */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por lead ou observação..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-[#0B0B0B] border border-slate-200 dark:border-[#2A2A2A] rounded-xl pl-9 pr-8 py-2 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#FD7A00] focus:border-[#FD7A00]"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Action Type Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-semibold">
          <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-[#888888] mr-1 flex items-center gap-1 flex-shrink-0">
            <Filter className="h-3 w-3" /> Tipo:
          </span>
          <button
            onClick={() => setSelectedActionFilter('all')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex-shrink-0 ${
              selectedActionFilter === 'all'
                ? 'bg-[#FD7A00]/15 text-[#FD7A00] border border-[#FD7A00]/30 font-bold'
                : 'bg-slate-50 dark:bg-[#0B0B0B] text-slate-500 hover:text-slate-800 dark:hover:text-white border border-slate-200 dark:border-[#2A2A2A]'
            }`}
          >
            Todos
          </button>
          {ACTION_TYPES.map(a => (
            <button
              key={a.value}
              onClick={() => setSelectedActionFilter(selectedActionFilter === a.value ? 'all' : a.value)}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex-shrink-0 flex items-center gap-1.5 ${
                selectedActionFilter === a.value
                  ? `${a.color} font-bold shadow-2xs`
                  : 'bg-slate-50 dark:bg-[#0B0B0B] text-slate-500 hover:text-slate-800 dark:hover:text-white border border-slate-200 dark:border-[#2A2A2A]'
              }`}
            >
              <a.icon className="h-3 w-3" />
              <span>{a.label}</span>
            </button>
          ))}

          {/* Priority filter */}
          <div className="ml-auto flex items-center gap-1 flex-shrink-0">
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-[#888888] mr-1">Prioridade:</span>
            {(['all', 'Alta', 'Média', 'Baixa'] as const).map(p => (
              <button
                key={p}
                onClick={() => setSelectedPriorityFilter(p)}
                className={`px-2 py-0.5 rounded-md text-[10px] transition-all cursor-pointer ${
                  selectedPriorityFilter === p
                    ? p === 'Alta' 
                      ? 'bg-rose-500 text-white font-bold' 
                      : 'bg-[#FD7A00] text-black font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {p === 'all' ? 'Todas' : p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showTodayOnly && (
        <div className="bg-[#FD7A00]/10 border border-[#FD7A00]/20 rounded-xl p-3 flex items-center justify-between text-xs text-[#FD7A00]">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>Exibindo exclusivamente compromissos agendados para hoje.</span>
          </div>
          <button 
            onClick={onClearTodayOnly}
            className="underline hover:text-[#FF9800] font-bold cursor-pointer"
          >
            Exibir todas as datas
          </button>
        </div>
      )}

      {/* 4. MAIN VIEW (COLUMNS OR WEEKLY CALENDAR) */}
      {viewMode === 'columns' ? (
        <div className={`grid grid-cols-1 ${showTodayOnly ? 'lg:grid-cols-1 max-w-2xl mx-auto' : 'lg:grid-cols-3'} gap-5`}>
          {/* Col 1: Atrasadas */}
          {!showTodayOnly && (
            renderColumn(
              'Atrasadas', 
              categories.overdue, 
              'Excelente! Nenhuma tarefa atrasada no momento.', 
              'text-rose-500', 
              AlertCircle
            )
          )}

          {/* Col 2: Hoje */}
          {renderColumn(
            'Compromissos de Hoje', 
            categories.today, 
            'Sem compromissos restantes para hoje. Bom momento para prospecção!', 
            'text-[#FD7A00]', 
            Calendar
          )}

          {/* Col 3: Próximas */}
          {!showTodayOnly && (
            renderColumn(
              'Próximas Tarefas', 
              categories.upcoming, 
              'Nenhum compromisso futuro agendado.', 
              'text-[#FF9800]', 
              Clock
            )
          )}
        </div>
      ) : (
        /* Weekly Calendar View (Next 7 Days) */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {next7Days.map(day => (
              <div 
                key={day.dateStr}
                className={`bg-white dark:bg-[#161616] border rounded-2xl p-3 flex flex-col space-y-2.5 min-h-[300px] ${
                  day.dateStr === todayStr 
                    ? 'border-[#FD7A00]/50 shadow-md ring-1 ring-[#FD7A00]/30' 
                    : 'border-slate-200 dark:border-[#2A2A2A]'
                }`}
              >
                {/* Day Header */}
                <div className={`text-center pb-2 border-b ${
                  day.dateStr === todayStr 
                    ? 'border-[#FD7A00]/20' 
                    : 'border-slate-100 dark:border-[#2A2A2A]'
                }`}>
                  <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-[#888888]">{day.weekDay}</p>
                  <p className={`text-lg font-black font-display ${
                    day.dateStr === todayStr ? 'text-[#FD7A00]' : 'text-slate-800 dark:text-white'
                  }`}>
                    {day.dayNumber}
                  </p>
                  <p className="text-[9px] font-bold text-slate-400 dark:text-[#888888]">{day.label}</p>
                </div>

                {/* Day Tasks */}
                <div className="space-y-2 flex-1 overflow-y-auto max-h-[400px]">
                  {filterByStatus(day.tasks).length === 0 ? (
                    <div className="h-full flex items-center justify-center text-center p-2">
                      <span className="text-[10px] text-slate-400 dark:text-[#888888] italic">Livre</span>
                    </div>
                  ) : (
                    filterByStatus(day.tasks).map(task => renderTaskCard(task))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. ADD TASK MODAL DIALOG */}
      <AnimatePresence>
        {isAddingTask && (
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            onClick={() => setIsAddingTask(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#0B0B0B] border border-slate-200 dark:border-[#2A2A2A] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
              id="add-task-modal"
            >
              {/* Header */}
              <div className="bg-slate-50 dark:bg-[#161616] px-6 py-4 border-b border-slate-200 dark:border-[#2A2A2A] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-[#FD7A00]/10 text-[#FD7A00] rounded-xl border border-[#FD7A00]/20">
                    <CheckSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold font-display text-slate-900 dark:text-white">
                      Nova Tarefa Comercial
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-[#888888]">
                      Agende compromissos e tarefas de follow-up
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddingTask(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#222222] transition-all cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
                {/* Client Link */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase tracking-wider block">
                    Vincular a um Lead da Carteira
                  </label>
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#FD7A00] cursor-pointer"
                  >
                    <option value="">-- Sem vínculo (Tarefa geral interna) --</option>
                    {clients
                      .filter(c => c.status !== 'Venda Fechada' && c.status !== 'Perdido')
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.status}) {c.empreendimento ? `• ${c.empreendimento}` : ''}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Grid: Action Type & Priority */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase tracking-wider block">
                      Tipo de Ação
                    </label>
                    <select
                      value={actionType}
                      onChange={(e) => setActionType(e.target.value)}
                      className="w-full text-xs bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#FD7A00] cursor-pointer"
                    >
                      {ACTION_TYPES.map(action => (
                        <option key={action.value} value={action.value}>
                          {action.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase tracking-wider block">
                      Prioridade
                    </label>
                    <div className="flex gap-1.5 h-[38px]">
                      {(['Baixa', 'Média', 'Alta'] as const).map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPriority(p)}
                          className={`flex-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            priority === p
                              ? p === 'Alta'
                                ? 'bg-rose-500/10 border-[#FB7185] text-[#FB7185]'
                                : p === 'Média'
                                  ? 'bg-[#FD7A00]/15 border-[#FD7A00] text-[#FD7A00]'
                                  : 'bg-slate-100 border-slate-400 text-slate-700 dark:bg-[#222222] dark:text-slate-200'
                              : 'border-slate-200 dark:border-[#2A2A2A] text-slate-400 hover:border-slate-300 dark:hover:border-[#333333]'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Due Date with Quick Selectors */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase tracking-wider block">
                      Data Limite *
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleSetQuickDate('today')}
                        className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#161616] text-slate-600 dark:text-[#E5E5E5] hover:bg-[#FD7A00]/10 hover:text-[#FD7A00] transition-all cursor-pointer"
                      >
                        Hoje
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetQuickDate('tomorrow')}
                        className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#161616] text-slate-600 dark:text-[#E5E5E5] hover:bg-[#FD7A00]/10 hover:text-[#FD7A00] transition-all cursor-pointer"
                      >
                        Amanhã
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetQuickDate('saturday')}
                        className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#161616] text-slate-600 dark:text-[#E5E5E5] hover:bg-[#FD7A00]/10 hover:text-[#FD7A00] transition-all cursor-pointer"
                      >
                        Sábado
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <input
                      type="date"
                      required
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full text-xs bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#FD7A00] font-mono"
                    />
                    <input
                      type="time"
                      placeholder="Horário (opcional)"
                      value={dueTime}
                      onChange={(e) => setDueTime(e.target.value)}
                      className="w-full text-xs bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#FD7A00] font-mono"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase tracking-wider block">
                    Observações &amp; Roteiro do Contato *
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Ex: Ligar para confirmar se recebeu o espelho de vendas da unidade 402 e agendar visita no decorado..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#FD7A00]"
                  />
                </div>

                {/* Sync Option */}
                {clientId && (
                  <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-[#E5E5E5] cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={syncNextContact}
                      onChange={(e) => setSyncNextContact(e.target.checked)}
                      className="rounded border-slate-300 dark:border-[#2A2A2A] text-[#FD7A00] focus:ring-[#FD7A00]"
                    />
                    <span>Atualizar automaticamente a data de próximo contato na ficha do lead</span>
                  </label>
                )}

                {/* Footer buttons */}
                <div className="flex gap-2 justify-end pt-3 border-t border-slate-100 dark:border-[#2A2A2A]">
                  <button
                    type="button"
                    onClick={() => setIsAddingTask(false)}
                    className="text-xs text-slate-500 dark:text-[#888888] font-semibold px-4 py-2 border border-slate-200 dark:border-[#2A2A2A] rounded-xl hover:bg-slate-50 dark:hover:bg-[#161616] transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="text-xs bg-gradient-to-r from-[#FF9800] via-[#FD7A00] to-[#E85D00] text-[#0B0B0B] font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm shadow-[#FD7A00]/20 transition-all cursor-pointer active:scale-95 hover:brightness-105"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Salvar Tarefa</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

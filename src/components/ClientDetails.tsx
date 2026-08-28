import React, { useState, useEffect } from 'react';
import { Client, Tag, ClientStatus, CommentEntry, Task } from '../types';
import { getClientAlerts, getDaysSinceContact, getStoredTasks, saveStoredTasks } from '../lib/storage';
import { 
  X, 
  Phone, 
  MessageSquare, 
  Calendar, 
  Clock, 
  User, 
  Tag as TagIcon, 
  Check, 
  Plus, 
  History, 
  AlertTriangle,
  FileText,
  Save,
  MessageCircle,
  FolderOpen,
  Trash2,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { motion } from 'motion/react';
import DocumentsTab from '../modules/documents/components/DocumentsTab';

interface ClientDetailsProps {
  client: Client;
  tags: Tag[];
  onClose: () => void;
  onUpdateClient: (updated: Client) => void;
  tasks?: Task[];
  onAddTask?: (taskData: Omit<Task, 'id' | 'createdAt'>) => void;
  onToggleTaskComplete?: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => void;
}

export default function ClientDetails({
  client,
  tags,
  onClose,
  onUpdateClient,
  tasks: tasksProp,
  onAddTask,
  onToggleTaskComplete,
  onDeleteTask
}: ClientDetailsProps) {
  const [name, setName] = useState(client.name);
  const [phone, setPhone] = useState(client.phone);
  const [notes, setNotes] = useState(client.notes);
  const [status, setStatus] = useState<ClientStatus>(client.status);
  const [nextContactDate, setNextContactDate] = useState(client.nextContactDate || '');
  const [contactCount, setContactCount] = useState(client.contactCount);
  const [selectedTags, setSelectedTags] = useState<string[]>(client.tags);
  const [newComment, setNewComment] = useState('');
  const [email, setEmail] = useState(client.email || '');
  const [empreendimento, setEmpreendimento] = useState(client.empreendimento || '');
  const [origem, setOrigem] = useState(client.origem || '');

  const [isEditingGeneral, setIsEditingGeneral] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'informacoes' | 'historico' | 'atendimentos' | 'agenda' | 'documentos'>('informacoes');

  // Agenda sub-tab states
  const [clientTasks, setClientTasks] = useState<Task[]>([]);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [taskActionType, setTaskActionType] = useState('WhatsApp');
  const [taskPriority, setTaskPriority] = useState<'Alta' | 'Média' | 'Baixa'>('Média');
  const [taskDueDate, setTaskDueDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [taskDueTime, setTaskDueTime] = useState('');
  const [taskNotes, setTaskNotes] = useState('');

  // Sync client tasks reactively
  useEffect(() => {
    if (tasksProp) {
      setClientTasks(tasksProp.filter(t => t.clientId === client.id));
    } else {
      const allTasks = getStoredTasks();
      setClientTasks(allTasks.filter(t => t.clientId === client.id));
    }
  }, [client.id, tasksProp]);

  // Sync with prop changes
  useEffect(() => {
    setName(client.name);
    setPhone(client.phone);
    setNotes(client.notes);
    setStatus(client.status);
    setNextContactDate(client.nextContactDate || '');
    setContactCount(client.contactCount);
    setSelectedTags(client.tags);
    setEmail(client.email || '');
    setEmpreendimento(client.empreendimento || '');
    setOrigem(client.origem || '');
  }, [client]);

  // Form submit handler for new tasks
  const handleFormAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskDueDate) return;

    const taskData = {
      clientId: client.id,
      clientName: client.name,
      actionType: taskActionType,
      dueDate: taskDueDate,
      dueTime: taskDueTime || undefined,
      priority: taskPriority,
      notes: taskNotes || undefined,
      completed: false
    };

    if (onAddTask) {
      onAddTask(taskData);
    } else {
      const allTasks = getStoredTasks();
      const newTask: Task = {
        id: 'task_' + Math.random().toString(36).substr(2, 9),
        createdAt: new Date().toISOString(),
        ...taskData
      };
      const updated = [newTask, ...allTasks];
      saveStoredTasks(updated);
      setClientTasks(updated.filter(t => t.clientId === client.id));
    }

    setIsAddingTask(false);
    setTaskNotes('');
  };

  const alerts = getClientAlerts(client);
  const days = getDaysSinceContact(client);

  const handleToggleTag = (tagName: string) => {
    let updated: string[];
    if (selectedTags.includes(tagName)) {
      updated = selectedTags.filter(t => t !== tagName);
    } else {
      updated = [...selectedTags, tagName];
    }
    setSelectedTags(updated);
    
    const updatedClient: Client = {
      ...client,
      tags: updated,
      history: [
        {
          id: Math.random().toString(),
          date: new Date().toISOString(),
          action: `Etiquetas atualizadas: ${updated.join(', ') || 'Nenhuma'}`
        },
        ...client.history
      ]
    };
    onUpdateClient(updatedClient);
  };

  const handleIncrementContact = () => {
    const newVal = contactCount + 1;
    setContactCount(newVal);
    
    const updatedClient: Client = {
      ...client,
      contactCount: newVal,
      lastContactDate: new Date().toISOString(),
      history: [
        {
          id: Math.random().toString(),
          date: new Date().toISOString(),
          action: `Contato registrado (Total de toques: ${newVal})`
        },
        ...client.history
      ]
    };
    onUpdateClient(updatedClient);
  };

  const handleDecrementContact = () => {
    if (contactCount <= 0) return;
    const newVal = contactCount - 1;
    setContactCount(newVal);
    
    const updatedClient: Client = {
      ...client,
      contactCount: newVal,
      history: [
        {
          id: Math.random().toString(),
          date: new Date().toISOString(),
          action: `Ajuste manual de toques: ${newVal}`
        },
        ...client.history
      ]
    };
    onUpdateClient(updatedClient);
  };

  const handleQuickStatusChange = (newStatus: ClientStatus) => {
    if (newStatus === status) return;
    setStatus(newStatus);

    const updatedClient: Client = {
      ...client,
      status: newStatus,
      history: [
        {
          id: Math.random().toString(),
          date: new Date().toISOString(),
          action: `Etapa alterada de "${status}" para "${newStatus}"`
        },
        ...client.history
      ]
    };
    onUpdateClient(updatedClient);
  };

  const handleSaveGeneral = () => {
    const newHistory = [];
    if (status !== client.status) {
      newHistory.push({
        id: Math.random().toString(),
        date: new Date().toISOString(),
        action: `Etapa alterada de "${client.status}" para "${status}"`
      });
    }

    const updatedClient: Client = {
      ...client,
      name,
      phone,
      notes,
      status,
      nextContactDate: nextContactDate || null,
      email: email.trim() || undefined,
      empreendimento: empreendimento.trim() || undefined,
      origem: origem.trim() || undefined,
      history: [...newHistory, ...client.history]
    };

    onUpdateClient(updatedClient);
    setIsEditingGeneral(false);
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const newCommentObj: CommentEntry = {
      id: Math.random().toString(),
      date: new Date().toISOString(),
      text: newComment.trim()
    };

    const updatedClient: Client = {
      ...client,
      comments: [newCommentObj, ...client.comments],
      lastContactDate: new Date().toISOString(),
      history: [
        {
          id: Math.random().toString(),
          date: new Date().toISOString(),
          action: `Nova anotação registrada no histórico`
        },
        ...client.history
      ]
    };

    onUpdateClient(updatedClient);
    setNewComment('');
  };

  const STATUS_LIST: ClientStatus[] = [
    'Lead Novo',
    'Contato',
    'Em Atendimento',
    'Retrabalho',
    'Agendado',
    'Visitou',
    'Proposta',
    'Documentação',
    'Venda Fechada',
    'Perdido'
  ];

  const getInitials = (n: string) => {
    const parts = n.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-end md:items-stretch md:justify-end transition-all"
      onClick={onClose}
      id="client-profile-modal-backdrop"
    >
      <motion.div
        initial={{ y: '100%', md: { y: 0, x: '100%' } }}
        animate={{ y: 0, x: 0 }}
        exit={{ y: '100%', md: { y: 0, x: '100%' } }}
        transition={{ type: 'spring', damping: 28, stiffness: 260 }}
        className="w-full md:max-w-2xl lg:max-w-3xl bg-white dark:bg-[#0B0B0B] h-[92vh] md:h-full flex flex-col shadow-2xl relative rounded-t-3xl md:rounded-t-none md:border-l border-slate-200 dark:border-[#2A2A2A] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        id="client-profile-modal-body"
      >
        {/* Mobile Drag Indicator */}
        <div className="md:hidden pt-3 pb-1 flex justify-center bg-slate-50 dark:bg-[#161616]">
          <div className="w-12 h-1.5 bg-slate-300 dark:bg-[#333333] rounded-full" />
        </div>

        {/* Header Banner */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-[#2A2A2A] bg-slate-50 dark:bg-[#161616] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#FF9800] via-[#FD7A00] to-[#E85D00] text-[#0B0B0B] font-black text-sm flex items-center justify-center shrink-0 shadow-sm shadow-[#FD7A00]/20 font-display">
              {getInitials(client.name)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold font-display text-slate-900 dark:text-white tracking-tight truncate">
                  {client.name}
                </h2>
                <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-[#888888] shrink-0">
                  #{client.id.substring(0, 6)}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#888888] flex items-center gap-2 font-mono">
                <span>{client.phone}</span>
                {client.empreendimento && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-slate-400 dark:bg-[#555555]" />
                    <span className="font-sans text-slate-700 dark:text-[#E5E5E5] truncate">{client.empreendimento}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Quick WhatsApp button */}
            <a
              href={`https://wa.me/${client.phone.replace(/\D/g, '')}`}
              target="_blank"
              referrerPolicy="no-referrer"
              className="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-all shadow-2xs"
              title="WhatsApp"
            >
              <MessageSquare className="h-4 w-4" />
            </a>

            {/* Quick Call button */}
            <a
              href={`tel:${client.phone.replace(/\D/g, '')}`}
              className="p-2 bg-slate-200 dark:bg-[#222222] hover:bg-slate-300 dark:hover:bg-[#333333] text-slate-700 dark:text-[#E5E5E5] rounded-xl transition-all"
              title="Ligar"
            >
              <Phone className="h-4 w-4" />
            </a>

            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-200 dark:hover:bg-[#222222] rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
              id="close-profile-btn"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Quick Funnel Stage Switcher Row */}
        <div className="px-4 py-2 bg-white dark:bg-[#0B0B0B] border-b border-slate-200 dark:border-[#2A2A2A] flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase tracking-wider shrink-0">Etapa:</span>
          {STATUS_LIST.map((st) => (
            <button
              key={st}
              onClick={() => handleQuickStatusChange(st)}
              className={`text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap transition-all cursor-pointer ${
                status === st
                  ? 'bg-gradient-to-r from-[#FF9800] via-[#FD7A00] to-[#E85D00] text-[#0B0B0B] font-black shadow-xs'
                  : 'bg-slate-100 dark:bg-[#161616] text-slate-600 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#2A2A2A]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Sub-Tabs Bar */}
        <div className="px-4 border-b border-slate-200 dark:border-[#2A2A2A] bg-slate-50 dark:bg-[#161616] flex gap-1 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveSubTab('informacoes')}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold transition-all relative border-b-2 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'informacoes'
                ? 'border-[#FD7A00] text-[#FD7A00]'
                : 'border-transparent text-slate-500 dark:text-[#888888] hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <User className="h-3.5 w-3.5" />
            <span>Informações</span>
          </button>
          <button
            onClick={() => setActiveSubTab('historico')}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold transition-all relative border-b-2 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'historico'
                ? 'border-[#FD7A00] text-[#FD7A00]'
                : 'border-transparent text-slate-500 dark:text-[#888888] hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>Histórico</span>
          </button>
          <button
            onClick={() => setActiveSubTab('atendimentos')}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold transition-all relative border-b-2 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'atendimentos'
                ? 'border-[#FD7A00] text-[#FD7A00]'
                : 'border-transparent text-slate-500 dark:text-[#888888] hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Atendimentos ({client.comments.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('agenda')}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold transition-all relative border-b-2 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'agenda'
                ? 'border-[#FD7A00] text-[#FD7A00]'
                : 'border-transparent text-slate-500 dark:text-[#888888] hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Agenda ({clientTasks.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('documentos')}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold transition-all relative border-b-2 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'documentos'
                ? 'border-[#FD7A00] text-[#FD7A00]'
                : 'border-transparent text-slate-500 dark:text-[#888888] hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <FolderOpen className="h-3.5 w-3.5 text-[#FD7A00]" />
            <span>Documentos</span>
          </button>
        </div>

        {/* Content Body Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Intelligence Alerts Banner */}
          {(alerts.isAtrasado || alerts.isUrgente || alerts.isSemRetorno) && (
            <div className="bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 rounded-2xl p-3.5 space-y-1">
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                Alerta Comercial Inteligente
              </span>
              <ul className="text-xs text-slate-700 dark:text-slate-300 list-disc list-inside space-y-1 pt-0.5">
                {alerts.isAtrasado && (
                  <li>O retorno deste cliente está <strong>atrasado</strong>. Entre em contato prioritário.</li>
                )}
                {alerts.isUrgente && (
                  <li>Sem contato há <strong>{days} dias</strong> (&gt; 15 dias parado). Recomenda-se resgatar com uma oferta especial.</li>
                )}
                {alerts.isSemRetorno && (
                  <li>Este cliente não possui um <strong>próximo contato agendado</strong>. Defina uma data de retorno.</li>
                )}
              </ul>
            </div>
          )}

          {/* TAB 1: INFORMAÇÕES */}
          {activeSubTab === 'informacoes' && (
            <div className="space-y-6">
              {/* SECTION 1: GENERAL INFO (EDITABLE OR STATIC) */}
              <div className="bg-slate-50 dark:bg-[#161616] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-[#2A2A2A] space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#888888]">Dados do Cliente</h3>
                  <button
                    onClick={() => {
                      if (isEditingGeneral) {
                        handleSaveGeneral();
                      } else {
                        setIsEditingGeneral(true);
                      }
                    }}
                    className="text-xs font-bold text-[#FD7A00] hover:underline flex items-center gap-1.5 cursor-pointer"
                  >
                    {isEditingGeneral ? (
                      <>
                        <Save className="h-3.5 w-3.5" />
                        <span>Salvar Dados</span>
                      </>
                    ) : (
                      <span>Editar Informações</span>
                    )}
                  </button>
                </div>

                {isEditingGeneral ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase">Nome Completo</label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full text-xs bg-white dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-white focus:border-[#FD7A00] focus:ring-1 focus:ring-[#FD7A00]"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase">Telefone / WhatsApp</label>
                        <input
                          type="text"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="Ex: (11) 98765-4321"
                          className="w-full text-xs bg-white dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-white focus:border-[#FD7A00] focus:ring-1 focus:ring-[#FD7A00]"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase">Email</label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Ex: cliente@email.com"
                          className="w-full text-xs bg-white dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-white focus:border-[#FD7A00] focus:ring-1 focus:ring-[#FD7A00]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase">Empreendimento de Interesse</label>
                        <input
                          type="text"
                          value={empreendimento}
                          onChange={(e) => setEmpreendimento(e.target.value)}
                          placeholder="Ex: Residencial Bela Vista"
                          className="w-full text-xs bg-white dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-white focus:border-[#FD7A00] focus:ring-1 focus:ring-[#FD7A00]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase">Etapa do Funil</label>
                        <select
                          value={status}
                          onChange={(e) => setStatus(e.target.value as ClientStatus)}
                          className="w-full text-xs bg-white dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2 text-slate-800 dark:text-white focus:border-[#FD7A00] focus:ring-1 focus:ring-[#FD7A00]"
                        >
                          {STATUS_LIST.map(st => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase">Origem do Lead</label>
                        <input
                          type="text"
                          value={origem}
                          onChange={(e) => setOrigem(e.target.value)}
                          placeholder="Ex: Instagram, Placa, Indicação"
                          className="w-full text-xs bg-white dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2 text-slate-800 dark:text-white focus:border-[#FD7A00] focus:ring-1 focus:ring-[#FD7A00]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase">Próximo Retorno</label>
                        <input
                          type="datetime-local"
                          value={nextContactDate}
                          onChange={(e) => setNextContactDate(e.target.value)}
                          className="w-full text-xs bg-white dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2 text-slate-800 dark:text-white focus:border-[#FD7A00] focus:ring-1 focus:ring-[#FD7A00]"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase">Perfil &amp; Observações Iniciais</label>
                      <textarea
                        rows={3}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Orçamento, tipo de imóvel, requisitos..."
                        className="w-full text-xs bg-white dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-white focus:border-[#FD7A00] focus:ring-1 focus:ring-[#FD7A00]"
                      />
                    </div>
                  </div>
                ) : (
                  // STATIC DISPLAY
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-white dark:bg-[#222222] p-3 rounded-xl border border-slate-200 dark:border-[#2A2A2A]">
                        <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-[#888888] block">Status Atual</span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 inline-block">{client.status}</span>
                      </div>
                      <div className="bg-white dark:bg-[#222222] p-3 rounded-xl border border-slate-200 dark:border-[#2A2A2A]">
                        <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-[#888888] block">Sem Contato</span>
                        <span className="text-xs font-bold text-[#FD7A00] mt-0.5 inline-block">{days} dias</span>
                      </div>
                      <div className="bg-white dark:bg-[#222222] p-3 rounded-xl border border-slate-200 dark:border-[#2A2A2A]">
                        <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-[#888888] block">Toques Feitos</span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 inline-block">{contactCount} contatos</span>
                      </div>
                      <div className="bg-white dark:bg-[#222222] p-3 rounded-xl border border-slate-200 dark:border-[#2A2A2A]">
                        <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-[#888888] block">Próximo Retorno</span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 inline-block truncate">
                          {client.nextContactDate 
                            ? new Date(client.nextContactDate).toLocaleDateString('pt-BR') 
                            : 'Não agendado'}
                        </span>
                      </div>
                    </div>

                    {(client.email || client.empreendimento || client.origem) && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-200 dark:border-[#2A2A2A] pt-3">
                        {client.email && (
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase">Email</span>
                            <p className="text-xs text-slate-800 dark:text-[#E5E5E5] font-medium mt-0.5 truncate">{client.email}</p>
                          </div>
                        )}
                        {client.empreendimento && (
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase">Empreendimento</span>
                            <p className="text-xs text-slate-800 dark:text-[#E5E5E5] font-medium mt-0.5">{client.empreendimento}</p>
                          </div>
                        )}
                        {client.origem && (
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase">Origem</span>
                            <p className="text-xs text-slate-800 dark:text-[#E5E5E5] font-medium mt-0.5">{client.origem}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {client.notes && (
                      <div className="border-t border-slate-200 dark:border-[#2A2A2A] pt-3">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase block">Perfil Imobiliário</span>
                        <p className="text-xs text-slate-700 dark:text-[#E5E5E5] mt-1 bg-white dark:bg-[#222222] p-3 rounded-xl border border-slate-200 dark:border-[#2A2A2A] italic">
                          &ldquo;{client.notes}&rdquo;
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SECTION 2: WHATSAPP-STYLE TAGS */}
              <div className="space-y-2.5">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#888888]">Etiquetas WhatsApp</h3>
                  <p className="text-[10px] text-slate-400 dark:text-[#888888]">Clique para ativar ou desativar etiquetas deste lead</p>
                </div>

                <div className="flex flex-wrap gap-1.5 p-3.5 bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] rounded-2xl">
                  {tags.map(tag => {
                    const isActive = selectedTags.includes(tag.name);
                    return (
                      <button
                        type="button"
                        key={tag.id}
                        onClick={() => handleToggleTag(tag.name)}
                        className={`text-[10px] font-semibold px-3 py-1 rounded-full border transition-all flex items-center gap-1 cursor-pointer ${
                          isActive 
                            ? `${tag.color} ring-2 ring-[#FD7A00]/20 font-bold shadow-2xs` 
                            : 'bg-white dark:bg-[#222222] text-slate-400 dark:text-[#888888] border-slate-200 dark:border-[#2A2A2A] hover:bg-slate-100 dark:hover:bg-[#2A2A2A]'
                        }`}
                      >
                        <span>{tag.name}</span>
                        {isActive && <Check className="h-3 w-3" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 3: RE-TRABALHO (FOLLOW-UP COUNTER) */}
              <div className="bg-slate-50 dark:bg-[#161616] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-[#2A2A2A] flex items-center justify-between shadow-xs">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase block">Controle de Retrabalho</span>
                  <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">Toques de Relacionamento</h4>
                  <p className="text-xs text-slate-500 dark:text-[#888888]">
                    Último contato: {client.lastContactDate ? new Date(client.lastContactDate).toLocaleDateString('pt-BR') : 'Nenhum'}
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={handleDecrementContact}
                    disabled={contactCount === 0}
                    className="w-8 h-8 rounded-xl border border-slate-200 dark:border-[#2A2A2A] bg-white dark:bg-[#222222] flex items-center justify-center font-bold text-slate-600 dark:text-[#E5E5E5] hover:bg-slate-100 dark:hover:bg-[#2A2A2A] cursor-pointer disabled:opacity-40"
                  >
                    -
                  </button>
                  <span className="font-mono text-xl font-black text-slate-900 dark:text-white w-10 text-center">
                    {contactCount}
                  </span>
                  <button
                    onClick={handleIncrementContact}
                    className="w-8 h-8 rounded-xl bg-gradient-to-r from-[#FF9800] via-[#FD7A00] to-[#E85D00] text-[#0B0B0B] flex items-center justify-center font-bold shadow-xs cursor-pointer active:scale-95"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: HISTÓRICO */}
          {activeSubTab === 'historico' && (
            <div className="space-y-4">
              <div className="flex items-center gap-1.5">
                <History className="h-4 w-4 text-[#FD7A00]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#888888]">Linha do Tempo de Alterações</h3>
              </div>

              <div className="relative border-l border-slate-200 dark:border-[#2A2A2A] pl-4 ml-2.5 space-y-4">
                {client.history.map(hist => (
                  <div key={hist.id} className="relative">
                    {/* Timeline dot */}
                    <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-[#FD7A00] border-2 border-white dark:border-[#0B0B0B]" />
                    
                    <div className="text-[10px] text-slate-400 dark:text-[#888888] font-mono">
                      {new Date(hist.date).toLocaleString('pt-BR')}
                    </div>
                    <p className="text-xs text-slate-700 dark:text-[#E5E5E5] font-medium mt-0.5">
                      {hist.action}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: ATENDIMENTOS */}
          {activeSubTab === 'atendimentos' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#888888]">Histórico de Conversas</h3>
                <p className="text-[10px] text-slate-400 dark:text-[#888888]">Cadastre notas sobre telefonemas, visitas ou reuniões com este cliente</p>
              </div>

              {/* Comment Form */}
              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ex: Liguei hoje e agendamos visita para sábado às 10h..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="flex-1 text-xs bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#FD7A00] focus:border-[#FD7A00]"
                  required
                />
                <button
                  type="submit"
                  className="bg-gradient-to-r from-[#FF9800] via-[#FD7A00] to-[#E85D00] hover:brightness-105 text-[#0B0B0B] px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="h-4 w-4" />
                  <span>Salvar</span>
                </button>
              </form>

              {/* Comments List */}
              <div className="space-y-2.5">
                {client.comments.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-[#888888] text-center py-6 bg-slate-50 dark:bg-[#161616] rounded-2xl border border-dashed border-slate-200 dark:border-[#2A2A2A]">
                    Nenhuma anotação de conversa cadastrada ainda.
                  </p>
                ) : (
                  client.comments.map(comm => (
                    <div 
                      key={comm.id}
                      className="p-3.5 bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] rounded-2xl space-y-1 shadow-2xs"
                    >
                      <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-[#888888]">
                        <span className="font-semibold text-[#FD7A00] flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" />
                          Atendimento Registrado
                        </span>
                        <span className="font-mono">{new Date(comm.date).toLocaleString('pt-BR')}</span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-[#E5E5E5] leading-relaxed font-medium">
                        {comm.text}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: AGENDA */}
          {activeSubTab === 'agenda' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#888888] flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-[#FD7A00]" />
                    Agenda &amp; Compromissos
                  </h3>
                  <p className="text-[10px] text-slate-400 dark:text-[#888888]">Tarefas agendadas para este cliente</p>
                </div>
                
                <button
                  onClick={() => setIsAddingTask(!isAddingTask)}
                  className="text-xs font-bold text-[#FD7A00] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{isAddingTask ? 'Fechar' : 'Novo Compromisso'}</span>
                </button>
              </div>

              {/* Add task form */}
              {isAddingTask && (
                <form onSubmit={handleFormAddTask} className="bg-slate-50 dark:bg-[#161616] p-4 rounded-2xl border border-slate-200 dark:border-[#2A2A2A] space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#888888]">Novo Agendamento</h4>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase">Ação</label>
                      <select
                        value={taskActionType}
                        onChange={(e) => setTaskActionType(e.target.value)}
                        className="w-full text-xs bg-white dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2 text-slate-800 dark:text-white focus:border-[#FD7A00] focus:ring-1 focus:ring-[#FD7A00]"
                      >
                        <option value="WhatsApp">WhatsApp</option>
                        <option value="Ligação">Ligação</option>
                        <option value="Visita">Visita</option>
                        <option value="Enviar Proposta">Enviar Proposta</option>
                        <option value="Outro">Outro</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase">Prioridade</label>
                      <select
                        value={taskPriority}
                        onChange={(e) => setTaskPriority(e.target.value as 'Alta' | 'Média' | 'Baixa')}
                        className="w-full text-xs bg-white dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2 text-slate-800 dark:text-white focus:border-[#FD7A00] focus:ring-1 focus:ring-[#FD7A00]"
                      >
                        <option value="Alta">Alta 🔥</option>
                        <option value="Média">Média ⚡</option>
                        <option value="Baixa">Baixa 💤</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase">Data</label>
                      <input
                        type="date"
                        value={taskDueDate}
                        onChange={(e) => setTaskDueDate(e.target.value)}
                        className="w-full text-xs bg-white dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2 text-slate-800 dark:text-white font-mono focus:border-[#FD7A00] focus:ring-1 focus:ring-[#FD7A00]"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase">Hora</label>
                      <input
                        type="time"
                        value={taskDueTime}
                        onChange={(e) => setTaskDueTime(e.target.value)}
                        className="w-full text-xs bg-white dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2 text-slate-800 dark:text-white font-mono focus:border-[#FD7A00] focus:ring-1 focus:ring-[#FD7A00]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase">Observações</label>
                    <input
                      type="text"
                      placeholder="Ex: Apresentar simulação de financiamento"
                      value={taskNotes}
                      onChange={(e) => setTaskNotes(e.target.value)}
                      className="w-full text-xs bg-white dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-white focus:border-[#FD7A00] focus:ring-1 focus:ring-[#FD7A00]"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-[#FF9800] via-[#FD7A00] to-[#E85D00] text-[#0B0B0B] font-bold text-xs py-2 px-3 rounded-xl shadow-md flex items-center justify-center gap-1 cursor-pointer active:scale-95 hover:brightness-105"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Agendar Compromisso</span>
                  </button>
                </form>
              )}

              {/* Task List */}
              <div className="space-y-2.5">
                {clientTasks.length === 0 ? (
                  <div className="text-center py-6 bg-slate-50 dark:bg-[#161616] border border-dashed border-slate-200 dark:border-[#2A2A2A] rounded-2xl flex flex-col items-center justify-center space-y-2">
                    <Calendar className="h-7 w-7 text-slate-400 dark:text-[#888888]" />
                    <p className="text-xs text-slate-500 dark:text-[#888888]">Nenhum compromisso agendado.</p>
                  </div>
                ) : (
                  clientTasks.map(t => (
                    <div 
                      key={t.id}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 shadow-2xs transition-all ${
                        t.completed 
                          ? 'bg-slate-50 dark:bg-[#161616]/50 border-slate-200 dark:border-[#2A2A2A] opacity-60' 
                          : 'bg-white dark:bg-[#161616] border-slate-200 dark:border-[#2A2A2A]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => onToggleTaskComplete?.(t.id)}
                          className={`w-5 h-5 rounded-md border flex items-center justify-center cursor-pointer transition-all ${
                            t.completed 
                              ? 'bg-emerald-500 border-emerald-500 text-white' 
                              : 'border-slate-300 dark:border-[#444444] hover:border-[#FD7A00]'
                          }`}
                        >
                          {t.completed && <Check className="h-3.5 w-3.5 font-bold" />}
                        </button>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold ${t.completed ? 'line-through text-slate-400 dark:text-[#888888]' : 'text-slate-800 dark:text-white'}`}>
                              {t.actionType}
                            </span>
                            <span className={`text-[8px] px-1.5 py-0.2 rounded-md font-bold uppercase ${
                              t.priority === 'Alta' 
                                ? 'bg-rose-500/15 text-[#FB7185]' 
                                : t.priority === 'Média' 
                                ? 'bg-amber-500/15 text-[#FD7A00]' 
                                : 'bg-slate-500/15 text-slate-400 dark:text-[#888888]'
                            }`}>
                              {t.priority}
                            </span>
                          </div>
                          {t.notes && (
                            <p className={`text-[11px] mt-0.5 ${t.completed ? 'line-through text-slate-400 dark:text-[#888888]' : 'text-slate-500 dark:text-[#888888]'}`}>
                              {t.notes}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-1 text-[9px] text-slate-400 dark:text-[#888888] font-mono">
                            <span>
                              {new Date(t.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')} {t.dueTime ? `@ ${t.dueTime}` : ''}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => onDeleteTask?.(t.id)}
                        className="p-1 text-slate-400 hover:text-[#FB7185] rounded-lg transition-colors cursor-pointer"
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 5: DOCUMENTOS */}
          {activeSubTab === 'documentos' && (
            <DocumentsTab clientId={client.id} />
          )}
        </div>
      </motion.div>
    </div>
  );
}

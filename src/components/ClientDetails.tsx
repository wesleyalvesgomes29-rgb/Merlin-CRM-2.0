import React, { useState, useEffect, useMemo } from 'react';
import { Client, Tag, ClientStatus, CommentEntry, Task, SecondBrainSummary } from '../types';
import { getClientAlerts, getDaysSinceContact, getStoredTasks, saveStoredTasks, getLocalTodayStr, formatDateBRL } from '../lib/storage';
import { generateTaskId, generateHistoryId } from '../lib/idUtils';
import { openGoogleCalendarEvent } from '../lib/calendarUtils';
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
  Sparkles,
  CalendarPlus,
  Brain,
  RefreshCw,
  Copy,
  Send,
  Zap,
  Target,
  ShieldAlert,
  Heart,
  Compass,
  BookOpen,
  Edit3,
  Layers,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  CheckCheck,
  Building2,
  PieChart,
  Home,
  FileCheck
} from 'lucide-react';
import { motion } from 'motion/react';
import DocumentsTab from '../modules/documents/components/DocumentsTab';
import { SALES_PLAYBOOK_PILLARS, PlaybookPillarId, PlaybookPillar } from '../lib/salesPlaybook';
import { useAuth } from '../modules/auth/hooks/useAuth';

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
  const [activeSubTab, setActiveSubTab] = useState<'informacoes' | 'historico' | 'atendimentos' | 'agenda' | 'documentos' | 'second-brain'>('informacoes');

  // Second Brain & Playbook states
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisError, setSynthesisError] = useState<string | null>(null);
  const [isGeneratingMessage, setIsGeneratingMessage] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [messageGoal, setMessageGoal] = useState('Quebra-gelo amigável e sondagem de momento');
  const [copiedMessage, setCopiedMessage] = useState(false);

  const { user } = useAuth();

  // Advanced Playbook Commercial Script States
  const [selectedPlaybookPillar, setSelectedPlaybookPillar] = useState<PlaybookPillarId>(() => {
    if (client.status === 'Retrabalho') return 'retrabalho';
    if (client.status === 'Documentação') return 'pre-analise-docs';
    if (client.status === 'Proposta') return 'objecao-mcmv-caixa';
    return 'primeiro-contato';
  });
  const [brokerName, setBrokerName] = useState(() => user?.name?.trim() || '');
  const [companyName, setCompanyName] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [generatedOptions, setGeneratedOptions] = useState<{ label: string; style: string; text: string }[]>([]);
  const [activeOptionIndex, setActiveOptionIndex] = useState(0);
  const [playbookGoldenTip, setPlaybookGoldenTip] = useState('');
  const [showPlaybookCheatSheet, setShowPlaybookCheatSheet] = useState(false);
  const [isEditingOption, setIsEditingOption] = useState(false);
  const [editableOptionText, setEditableOptionText] = useState('');

  const parsedSecondBrain = useMemo<SecondBrainSummary | null>(() => {
    if (!client.secondBrainSummary) return null;
    if (typeof client.secondBrainSummary === 'string') {
      try {
        return JSON.parse(client.secondBrainSummary);
      } catch {
        return null;
      }
    }
    return client.secondBrainSummary;
  }, [client.secondBrainSummary]);

  // Agenda sub-tab states
  const [clientTasks, setClientTasks] = useState<Task[]>([]);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [taskActionType, setTaskActionType] = useState('WhatsApp');
  const [taskPriority, setTaskPriority] = useState<'Alta' | 'Média' | 'Baixa'>('Média');
  const [taskDueDate, setTaskDueDate] = useState(() => getLocalTodayStr());
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
        id: generateTaskId(),
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
          id: generateHistoryId('h_tag'),
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
          id: generateHistoryId('h_contact'),
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
          id: generateHistoryId('h_contact_adjust'),
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
          id: generateHistoryId('h_status'),
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
        id: generateHistoryId('h_status'),
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
      id: generateHistoryId('comm'),
      date: new Date().toISOString(),
      text: newComment.trim()
    };

    const updatedClient: Client = {
      ...client,
      comments: [newCommentObj, ...client.comments],
      lastContactDate: new Date().toISOString(),
      history: [
        {
          id: generateHistoryId('h_comm'),
          date: new Date().toISOString(),
          action: `Nova anotação registrada no histórico`
        },
        ...client.history
      ]
    };

    onUpdateClient(updatedClient);
    setNewComment('');
  };

  // Second Brain Handlers
  const handleSynthesizeSecondBrain = async () => {
    setIsSynthesizing(true);
    setSynthesisError(null);
    try {
      const res = await fetch('/api/gemini/second-brain/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client.id,
          clientData: client
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao sintetizar lead com Second Brain');
      }

      const updatedClient: Client = {
        ...client,
        secondBrainSummary: data.summary,
        secondBrainUpdatedAt: data.updatedAt,
        history: [
          {
            id: generateHistoryId('h_sb'),
            date: new Date().toISOString(),
            action: `🧠 Síntese comportamental Second Brain atualizada via IA`
          },
          ...client.history
        ]
      };

      onUpdateClient(updatedClient);
    } catch (err: any) {
      console.error('Erro na síntese Second Brain:', err);
      setSynthesisError(err.message || 'Falha ao processar síntese.');
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleGenerateMessage = async () => {
    setIsGeneratingMessage(true);
    try {
      const res = await fetch('/api/gemini/generate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: client.name,
          clientInterest: client.empreendimento,
          clientNotes: client.notes,
          goal: messageGoal,
          clientStatus: client.status,
          secondBrainSummary: client.secondBrainSummary,
          playbookIntent: selectedPlaybookPillar,
          brokerName: brokerName.trim() || undefined,
          companyName: companyName.trim() || undefined,
          customInstructions: customInstructions.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao gerar mensagem');
      }

      if (data.options && Array.isArray(data.options) && data.options.length > 0) {
        setGeneratedOptions(data.options);
        setActiveOptionIndex(0);
        setEditableOptionText(data.options[0].text);
        setGeneratedMessage(data.options[0].text);
        setPlaybookGoldenTip(data.goldenTip || '');
      } else if (data.text) {
        const fallbackOpts = [
          { label: 'Opção Direta / Objetiva', style: 'direta', text: data.text },
          { label: 'Opção Consultiva / Acolhedora', style: 'consultiva', text: data.text }
        ];
        setGeneratedOptions(fallbackOpts);
        setActiveOptionIndex(0);
        setEditableOptionText(data.text);
        setGeneratedMessage(data.text);
        setPlaybookGoldenTip(data.goldenTip || 'Conduza para o próximo passo com uma pergunta de dupla alternativa.');
      }
    } catch (err: any) {
      console.error('Erro ao gerar mensagem com Playbook:', err);
    } finally {
      setIsGeneratingMessage(false);
      setIsEditingOption(false);
    }
  };

  const handleCopyMessage = (textToCopy?: string) => {
    const targetText = textToCopy || editableOptionText || generatedMessage;
    if (!targetText) return;
    navigator.clipboard.writeText(targetText);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2500);
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
            onClick={() => setActiveSubTab('second-brain')}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold transition-all relative border-b-2 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'second-brain'
                ? 'border-[#FD7A00] text-[#FD7A00]'
                : 'border-transparent text-slate-500 dark:text-[#888888] hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <Brain className="h-3.5 w-3.5 text-[#FD7A00]" />
            <span>Second Brain</span>
            {client.secondBrainSummary && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            )}
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

              {/* SECTION: SECOND BRAIN QUICK INSIGHT BANNER */}
              <div className="bg-gradient-to-br from-amber-500/10 via-[#FD7A00]/5 to-transparent border border-[#FD7A00]/25 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-[#FD7A00]/15 text-[#FD7A00] rounded-xl">
                      <Brain className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">Second Brain • Síntese Comportamental</h4>
                      <span className="text-[10px] text-slate-500 dark:text-[#888888]">
                        {client.secondBrainUpdatedAt 
                          ? `Atualizado em ${new Date(client.secondBrainUpdatedAt).toLocaleDateString('pt-BR')} às ${new Date(client.secondBrainUpdatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` 
                          : 'Ainda não sintetizado com IA'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveSubTab('second-brain')}
                    className="text-xs font-bold text-[#FD7A00] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Abrir Dossiê</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {parsedSecondBrain ? (
                  <div className="space-y-2 pt-1 border-t border-[#FD7A00]/15">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-[#888888]">Urgência:</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        parsedSecondBrain.urgencyLevel === 'Alta'
                          ? 'bg-rose-500/15 text-[#FB7185]'
                          : parsedSecondBrain.urgencyLevel === 'Baixa'
                          ? 'bg-slate-500/15 text-slate-400'
                          : 'bg-amber-500/15 text-[#FD7A00]'
                      }`}>
                        {parsedSecondBrain.urgencyLevel === 'Alta' ? '🔥 Alta' : parsedSecondBrain.urgencyLevel === 'Baixa' ? '💤 Baixa' : '⚡ Média'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-[#E5E5E5] line-clamp-2">
                      <strong className="text-slate-900 dark:text-white">🎯 Gancho Persuasivo:</strong> {parsedSecondBrain.recommendedAngle}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between pt-1 border-t border-[#FD7A00]/15">
                    <p className="text-[11px] text-slate-500 dark:text-[#888888]">
                      Mapeie dores emocionais, medos ocultos e objeções com metodologia humanizada.
                    </p>
                    <button
                      onClick={handleSynthesizeSecondBrain}
                      disabled={isSynthesizing}
                      className="px-3 py-1.5 bg-[#FD7A00] hover:bg-[#E85D00] text-[#0B0B0B] text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                    >
                      <Sparkles className={`h-3.5 w-3.5 ${isSynthesizing ? 'animate-spin' : ''}`} />
                      <span>{isSynthesizing ? 'Analisando...' : 'Sintetizar com IA'}</span>
                    </button>
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

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openGoogleCalendarEvent({
                            title: t.notes || `${t.actionType} - ${client.name}`,
                            notes: `Tarefa: ${t.notes || t.actionType}\nLead: ${client.name}\nPrioridade: ${t.priority}\nTelefone: ${client.phone}`,
                            dueDate: t.dueDate,
                            dueTime: t.dueTime
                          })}
                          className="p-1.5 text-blue-500 hover:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors cursor-pointer"
                          title="Abrir no Google Agenda"
                        >
                          <CalendarPlus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteTask?.(t.id)}
                          className="p-1.5 text-slate-400 hover:text-[#FB7185] hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB: SECOND BRAIN */}
          {activeSubTab === 'second-brain' && (
            <div className="space-y-5">
              {/* Header Info & Action */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-[#161616] p-4 rounded-2xl border border-slate-200 dark:border-[#2A2A2A]">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-gradient-to-br from-[#FF9800] via-[#FD7A00] to-[#E85D00] text-[#0B0B0B] rounded-xl shadow-xs shrink-0">
                    <Brain className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Second Brain • Inteligência Comportamental</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-[#888888]">
                      Síntese psicológica, mapeamento de dores e metodologia comercial humanizada.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleSynthesizeSecondBrain}
                  disabled={isSynthesizing}
                  className="px-4 py-2 bg-gradient-to-r from-[#FF9800] via-[#FD7A00] to-[#E85D00] hover:brightness-105 text-[#0B0B0B] text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-xs transition-all shrink-0 active:scale-95"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSynthesizing ? 'animate-spin' : ''}`} />
                  <span>{isSynthesizing ? 'Sintetizando Lead...' : client.secondBrainSummary ? 'Atualizar Síntese' : 'Sintetizar Lead com IA'}</span>
                </button>
              </div>

              {synthesisError && (
                <div className="bg-rose-500/10 border border-rose-500/25 rounded-xl p-3 text-xs text-[#FB7185] flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{synthesisError}</span>
                </div>
              )}

              {parsedSecondBrain ? (
                <div className="space-y-4">
                  {/* Status & Urgency Bar */}
                  <div className="flex items-center justify-between bg-white dark:bg-[#161616] p-3.5 rounded-2xl border border-slate-200 dark:border-[#2A2A2A]">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 dark:text-[#888888] font-medium">Nível de Urgência Identificado:</span>
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        parsedSecondBrain.urgencyLevel === 'Alta'
                          ? 'bg-rose-500/15 text-[#FB7185] border border-rose-500/30'
                          : parsedSecondBrain.urgencyLevel === 'Baixa'
                          ? 'bg-slate-500/15 text-slate-400 border border-slate-500/30'
                          : 'bg-amber-500/15 text-[#FD7A00] border border-amber-500/30'
                      }`}>
                        {parsedSecondBrain.urgencyLevel === 'Alta' ? '🔥 Alta Prioridade' : parsedSecondBrain.urgencyLevel === 'Baixa' ? '💤 Baixa Prioridade' : '⚡ Média Prioridade'}
                      </span>
                    </div>

                    {client.secondBrainUpdatedAt && (
                      <span className="text-[10px] text-slate-400 dark:text-[#888888] font-mono">
                        Última leitura: {new Date(client.secondBrainUpdatedAt).toLocaleDateString('pt-BR')} às {new Date(client.secondBrainUpdatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>

                  {/* Highlight: Recommended Angle */}
                  <div className="bg-gradient-to-br from-[#FD7A00]/15 via-amber-500/10 to-transparent border border-[#FD7A00]/30 rounded-2xl p-4 sm:p-5 space-y-2 shadow-xs">
                    <div className="flex items-center gap-2 text-[#FD7A00]">
                      <Target className="h-4 w-4" />
                      <h4 className="text-xs font-bold uppercase tracking-wider">🎯 Gancho Persuasivo &amp; Tom Recomendado</h4>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-800 dark:text-[#E5E5E5] font-medium leading-relaxed">
                      {parsedSecondBrain.recommendedAngle}
                    </p>
                  </div>

                  {/* 3 Behavioral Pillars */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Emotional Pain */}
                    <div className="bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] rounded-2xl p-4 space-y-2 shadow-2xs">
                      <div className="flex items-center gap-2 text-rose-500">
                        <Heart className="h-4 w-4" />
                        <h4 className="text-[11px] font-bold uppercase tracking-wider">Dor &amp; Momento de Vida</h4>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-[#CCCCCC] leading-relaxed">
                        {parsedSecondBrain.emotionalPain}
                      </p>
                    </div>

                    {/* Key Objection */}
                    <div className="bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] rounded-2xl p-4 space-y-2 shadow-2xs">
                      <div className="flex items-center gap-2 text-amber-500">
                        <ShieldAlert className="h-4 w-4" />
                        <h4 className="text-[11px] font-bold uppercase tracking-wider">Principal Objeção</h4>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-[#CCCCCC] leading-relaxed">
                        {parsedSecondBrain.keyObjection}
                      </p>
                    </div>

                    {/* Decision Criteria */}
                    <div className="bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] rounded-2xl p-4 space-y-2 shadow-2xs">
                      <div className="flex items-center gap-2 text-emerald-500">
                        <Compass className="h-4 w-4" />
                        <h4 className="text-[11px] font-bold uppercase tracking-wider">Fator Decisivo</h4>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-[#CCCCCC] leading-relaxed">
                        {parsedSecondBrain.decisionCriteria}
                      </p>
                    </div>
                  </div>

                  {/* Suggested Next Action */}
                  <div className="bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] rounded-2xl p-4 space-y-2">
                    <div className="flex items-center gap-2 text-blue-500 dark:text-blue-400">
                      <Zap className="h-4 w-4" />
                      <h4 className="text-xs font-bold uppercase tracking-wider">🚀 Próxima Ação Tática Sugerida</h4>
                    </div>
                    <p className="text-xs text-slate-800 dark:text-[#E5E5E5] font-medium leading-relaxed">
                      {parsedSecondBrain.suggestedNextAction}
                    </p>
                  </div>

                  {/* SECTION: SALES PLAYBOOK COMMERCIAL SCRIPTS GENERATOR */}
                  <div className="bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-[#2A2A2A]">
                      <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                        <div className="p-2 rounded-xl bg-[#FD7A00]/15 text-[#FD7A00]">
                          <BookOpen className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider">Livreto de Scripts Comerciais</h4>
                          <p className="text-[10px] text-slate-500 dark:text-[#888888]">
                            Metodologia humanizada, condução por etapas e perguntas de dupla alternativa.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setShowPlaybookCheatSheet(!showPlaybookCheatSheet)}
                          className="px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-[#FD7A00] dark:hover:text-[#FD7A00] bg-white dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <FileText className="h-3 w-3 text-[#FD7A00]" />
                          <span>{showPlaybookCheatSheet ? 'Ocultar Roteiros Padrão' : 'Ver Roteiros Padrão do Livreto'}</span>
                          {showPlaybookCheatSheet ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-md">
                          Regra Anti-Infodump
                        </span>
                      </div>
                    </div>

                    {/* Pillar Selector Pills */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-[#888888] flex items-center gap-1">
                        <Layers className="h-3 w-3 text-[#FD7A00]" />
                        <span>Selecione a Etapa Comercial / Intenção do Contato:</span>
                      </label>

                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {SALES_PLAYBOOK_PILLARS.map((pillar) => {
                          const isSelected = selectedPlaybookPillar === pillar.id;
                          return (
                            <button
                              key={pillar.id}
                              type="button"
                              onClick={() => {
                                setSelectedPlaybookPillar(pillar.id);
                                setMessageGoal(pillar.title);
                              }}
                              className={`p-2 rounded-xl text-left transition-all border text-xs cursor-pointer flex flex-col justify-between ${
                                isSelected
                                  ? 'bg-[#FD7A00]/15 border-[#FD7A00] text-slate-900 dark:text-white shadow-xs font-bold ring-1 ring-[#FD7A00]'
                                  : 'bg-white dark:bg-[#202020] border-slate-200 dark:border-[#2A2A2A] text-slate-600 dark:text-[#CCCCCC] hover:border-slate-300 dark:hover:border-[#383838]'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#2A2A2A] text-slate-600 dark:text-slate-300 font-bold shrink-0">
                                  {pillar.badge}
                                </span>
                                <span className="font-semibold truncate text-[11px]">{pillar.shortTitle}</span>
                              </div>
                              <span className="text-[9px] text-slate-400 dark:text-[#888888] line-clamp-1">
                                {pillar.subtitle}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Active Pillar Guideline Box */}
                    {(() => {
                      const currentPillar = SALES_PLAYBOOK_PILLARS.find(p => p.id === selectedPlaybookPillar) || SALES_PLAYBOOK_PILLARS[0];
                      return (
                        <div className="bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/25 rounded-xl p-3 space-y-2">
                          <div className="flex items-start gap-2">
                            <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                              <p className="text-xs text-slate-800 dark:text-slate-200">
                                <strong className="text-amber-700 dark:text-amber-300">Regra de Ouro:</strong> {currentPillar.goldenRule}
                              </p>
                              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                                <strong className="text-slate-800 dark:text-slate-200">Fechamento Dupla Alternativa:</strong> &ldquo;{currentPillar.closingQuestionExample}&rdquo;
                              </p>
                            </div>
                          </div>

                          {/* Cheat Sheet Expandable */}
                          {showPlaybookCheatSheet && (
                            <div className="mt-3 pt-3 border-t border-amber-500/20 space-y-2.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
                                Roteiros Validados do Livreto para esta Etapa:
                              </span>
                              <div className="space-y-2">
                                {currentPillar.standardScripts.map((sc, idx) => {
                                  const effectiveBroker = brokerName.trim() || 'consultor imobiliário';
                                  const effectiveCompany = companyName.trim() || 'consultoria imobiliária especializada';
                                  const scriptText = sc.template
                                    .replace(/\{NOME\}|\[NOME_CLIENTE\]/g, client.name)
                                    .replace(/\{EMPREENDIMENTO\}|\[EMPREENDIMENTO\]/g, client.empreendimento || 'o imóvel')
                                    .replace(/\{CORRETOR\}|\[SEU_NOME\]/g, effectiveBroker)
                                    .replace(/INC Empreendimentos/g, effectiveCompany);

                                  return (
                                    <div key={idx} className="bg-white dark:bg-[#1C1C1C] p-3 rounded-lg border border-slate-200 dark:border-[#2E2E2E] space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-slate-500 dark:text-[#888888]">{sc.title}</span>
                                        <button
                                          type="button"
                                          onClick={() => handleCopyMessage(scriptText)}
                                          className="text-[10px] font-bold text-[#FD7A00] hover:underline flex items-center gap-1 cursor-pointer"
                                        >
                                          <Copy className="h-3 w-3" />
                                          <span>Copiar Script Padrão</span>
                                        </button>
                                      </div>
                                      <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-mono text-[11px]">
                                        {scriptText}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Generator Controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-[#888888]">
                          Seu Nome de Consultor:
                        </label>
                        <input
                          type="text"
                          value={brokerName}
                          onChange={(e) => setBrokerName(e.target.value)}
                          placeholder="Ex: Seu Nome"
                          className="w-full text-xs bg-white dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-white focus:border-[#FD7A00] focus:ring-1 focus:ring-[#FD7A00]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-[#888888]">
                          Imobiliária / Empresa:
                        </label>
                        <input
                          type="text"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="Ex: Minha Imobiliária"
                          className="w-full text-xs bg-white dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-white focus:border-[#FD7A00] focus:ring-1 focus:ring-[#FD7A00]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-[#888888]">
                          Instrução Específica (Opcional):
                        </label>
                        <input
                          type="text"
                          value={customInstructions}
                          onChange={(e) => setCustomInstructions(e.target.value)}
                          placeholder="Ex: É autônomo, falar após 18h"
                          className="w-full text-xs bg-white dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-white focus:border-[#FD7A00] focus:ring-1 focus:ring-[#FD7A00]"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleGenerateMessage}
                      disabled={isGeneratingMessage}
                      className="w-full py-3 bg-gradient-to-r from-[#FF9800] via-[#FD7A00] to-[#E85D00] hover:brightness-105 text-[#0B0B0B] text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm whitespace-nowrap active:scale-[0.99] transition-all"
                    >
                      <Sparkles className={`h-4 w-4 ${isGeneratingMessage ? 'animate-spin' : ''}`} />
                      <span>{isGeneratingMessage ? 'Gerando Abordagens com Playbook Comercial...' : 'Gerar Scripts Personalizados (Opção Direta vs. Consultiva)'}</span>
                    </button>

                    {/* Generated Results Area with 2 Options */}
                    {generatedOptions.length > 0 && (
                      <div className="space-y-4 pt-3 border-t border-slate-200 dark:border-[#2A2A2A]">
                        {/* Option Tabs Header */}
                        <div className="flex items-center gap-2 bg-slate-200/60 dark:bg-[#202020] p-1 rounded-xl">
                          {generatedOptions.map((opt, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setActiveOptionIndex(idx);
                                setEditableOptionText(opt.text);
                                setGeneratedMessage(opt.text);
                                setIsEditingOption(false);
                              }}
                              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                activeOptionIndex === idx
                                  ? 'bg-white dark:bg-[#111111] text-[#FD7A00] shadow-xs'
                                  : 'text-slate-600 dark:text-[#999999] hover:text-slate-900 dark:hover:text-white'
                              }`}
                            >
                              <span>{idx === 0 ? '🎯' : '🤝'}</span>
                              <span>{opt.label}</span>
                            </button>
                          ))}
                        </div>

                        {/* Active Option Box */}
                        <div className="bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/25 rounded-2xl p-4 space-y-3 relative">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>{generatedOptions[activeOptionIndex]?.label} • Pronta para WhatsApp</span>
                            </span>

                            <button
                              type="button"
                              onClick={() => setIsEditingOption(!isEditingOption)}
                              className="text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                            >
                              <Edit3 className="h-3 w-3" />
                              <span>{isEditingOption ? 'Concluir Ajuste' : 'Editar Texto'}</span>
                            </button>
                          </div>

                          {isEditingOption ? (
                            <textarea
                              value={editableOptionText}
                              onChange={(e) => setEditableOptionText(e.target.value)}
                              rows={5}
                              className="w-full text-xs bg-white dark:bg-[#1c1c1c] border border-slate-300 dark:border-[#333333] rounded-xl p-3 text-slate-800 dark:text-white focus:border-[#FD7A00] focus:ring-1 focus:ring-[#FD7A00]"
                            />
                          ) : (
                            <p className="text-xs text-slate-800 dark:text-[#E5E5E5] whitespace-pre-wrap leading-relaxed font-sans bg-white/70 dark:bg-[#141414]/70 p-3.5 rounded-xl border border-emerald-500/15 shadow-2xs">
                              {editableOptionText || generatedOptions[activeOptionIndex]?.text}
                            </p>
                          )}

                          {playbookGoldenTip && (
                            <div className="bg-white/90 dark:bg-[#161616] p-2.5 rounded-xl border border-emerald-500/20 text-[11px] text-slate-700 dark:text-slate-300 flex items-start gap-2">
                              <Lightbulb className="h-3.5 w-3.5 text-[#FD7A00] shrink-0 mt-0.5" />
                              <span><strong>Dica de Condução:</strong> {playbookGoldenTip}</span>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(editableOptionText || generatedOptions[activeOptionIndex]?.text)}
                            className="px-3.5 py-2 bg-white dark:bg-[#222222] hover:bg-slate-100 dark:hover:bg-[#2A2A2A] border border-slate-200 dark:border-[#2A2A2A] text-slate-700 dark:text-[#E5E5E5] text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                          >
                            <Copy className="h-3.5 w-3.5 text-[#FD7A00]" />
                            <span>{copiedMessage ? 'Copiado para a Área de Transferência! ✓' : 'Copiar Texto'}</span>
                          </button>

                          <a
                            href={`https://wa.me/${client.phone.replace(/\D/g, '')}?text=${encodeURIComponent(editableOptionText || generatedOptions[activeOptionIndex]?.text || '')}`}
                            target="_blank"
                            referrerPolicy="no-referrer"
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors"
                          >
                            <Send className="h-3.5 w-3.5" />
                            <span>Abrir no WhatsApp</span>
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Empty State for Second Brain with Direct Playbook Access */
                <div className="space-y-6">
                  <div className="text-center py-8 px-6 bg-slate-50 dark:bg-[#161616] border border-dashed border-slate-200 dark:border-[#2A2A2A] rounded-3xl space-y-4">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-amber-500/20 via-[#FD7A00]/20 to-transparent flex items-center justify-center text-[#FD7A00]">
                      <Brain className="h-6 w-6" />
                    </div>

                    <div className="max-w-md mx-auto space-y-1.5">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        Síntese comportamental não gerada ainda
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-[#888888] leading-relaxed">
                        Sintetize o histórico do lead para mapear dores emocionais e refinar a geração de scripts comerciais.
                      </p>
                    </div>

                    <button
                      onClick={handleSynthesizeSecondBrain}
                      disabled={isSynthesizing}
                      className="px-5 py-2.5 bg-gradient-to-r from-[#FF9800] via-[#FD7A00] to-[#E85D00] hover:brightness-105 text-[#0B0B0B] text-xs font-bold rounded-xl inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-md active:scale-95 transition-all"
                    >
                      <Sparkles className={`h-4 w-4 ${isSynthesizing ? 'animate-spin' : ''}`} />
                      <span>{isSynthesizing ? 'Analisando Histórico do Lead...' : 'Gerar Síntese com IA'}</span>
                    </button>
                  </div>

                  {/* Even without synthesis, allow Playbook commercial generation */}
                  <div className="bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-[#2A2A2A]">
                      <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                        <div className="p-2 rounded-xl bg-[#FD7A00]/15 text-[#FD7A00]">
                          <BookOpen className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider">Livreto de Scripts Comerciais</h4>
                          <p className="text-[10px] text-slate-500 dark:text-[#888888]">
                            Gere abordagens comerciais instantâneas usando o Playbook.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowPlaybookCheatSheet(!showPlaybookCheatSheet)}
                        className="px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-[#FD7A00] dark:hover:text-[#FD7A00] bg-white dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <FileText className="h-3 w-3 text-[#FD7A00]" />
                        <span>{showPlaybookCheatSheet ? 'Ocultar Roteiros' : 'Ver Roteiros Padrão'}</span>
                        {showPlaybookCheatSheet ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                    </div>

                    {/* Pillar Selector Pills */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-[#888888] flex items-center gap-1">
                        <Layers className="h-3 w-3 text-[#FD7A00]" />
                        <span>Selecione a Etapa Comercial:</span>
                      </label>

                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {SALES_PLAYBOOK_PILLARS.map((pillar) => {
                          const isSelected = selectedPlaybookPillar === pillar.id;
                          return (
                            <button
                              key={pillar.id}
                              type="button"
                              onClick={() => {
                                setSelectedPlaybookPillar(pillar.id);
                                setMessageGoal(pillar.title);
                              }}
                              className={`p-2 rounded-xl text-left transition-all border text-xs cursor-pointer flex flex-col justify-between ${
                                isSelected
                                  ? 'bg-[#FD7A00]/15 border-[#FD7A00] text-slate-900 dark:text-white shadow-xs font-bold ring-1 ring-[#FD7A00]'
                                  : 'bg-white dark:bg-[#202020] border-slate-200 dark:border-[#2A2A2A] text-slate-600 dark:text-[#CCCCCC] hover:border-slate-300 dark:hover:border-[#383838]'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#2A2A2A] text-slate-600 dark:text-slate-300 font-bold shrink-0">
                                  {pillar.badge}
                                </span>
                                <span className="font-semibold truncate text-[11px]">{pillar.shortTitle}</span>
                              </div>
                              <span className="text-[9px] text-slate-400 dark:text-[#888888] line-clamp-1">
                                {pillar.subtitle}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Active Pillar Guideline Box */}
                    {(() => {
                      const currentPillar = SALES_PLAYBOOK_PILLARS.find(p => p.id === selectedPlaybookPillar) || SALES_PLAYBOOK_PILLARS[0];
                      return (
                        <div className="bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/25 rounded-xl p-3 space-y-2">
                          <div className="flex items-start gap-2">
                            <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                              <p className="text-xs text-slate-800 dark:text-slate-200">
                                <strong className="text-amber-700 dark:text-amber-300">Regra de Ouro:</strong> {currentPillar.goldenRule}
                              </p>
                              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                                <strong className="text-slate-800 dark:text-slate-200">Fechamento Dupla Alternativa:</strong> &ldquo;{currentPillar.closingQuestionExample}&rdquo;
                              </p>
                            </div>
                          </div>

                          {showPlaybookCheatSheet && (
                            <div className="mt-3 pt-3 border-t border-amber-500/20 space-y-2.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
                                Roteiros Validados do Livreto:
                              </span>
                              <div className="space-y-2">
                                {currentPillar.standardScripts.map((sc, idx) => {
                                  const effectiveBroker = brokerName.trim() || 'consultor imobiliário';
                                  const effectiveCompany = companyName.trim() || 'consultoria imobiliária especializada';
                                  const scriptText = sc.template
                                    .replace(/\{NOME\}|\[NOME_CLIENTE\]/g, client.name)
                                    .replace(/\{EMPREENDIMENTO\}|\[EMPREENDIMENTO\]/g, client.empreendimento || 'o imóvel')
                                    .replace(/\{CORRETOR\}|\[SEU_NOME\]/g, effectiveBroker)
                                    .replace(/INC Empreendimentos/g, effectiveCompany);

                                  return (
                                    <div key={idx} className="bg-white dark:bg-[#1C1C1C] p-3 rounded-lg border border-slate-200 dark:border-[#2E2E2E] space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-slate-500 dark:text-[#888888]">{sc.title}</span>
                                        <button
                                          type="button"
                                          onClick={() => handleCopyMessage(scriptText)}
                                          className="text-[10px] font-bold text-[#FD7A00] hover:underline flex items-center gap-1 cursor-pointer"
                                        >
                                          <Copy className="h-3 w-3" />
                                          <span>Copiar Script</span>
                                        </button>
                                      </div>
                                      <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-mono text-[11px]">
                                        {scriptText}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Generator Controls for Quick Playbook */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-[#888888]">
                          Seu Nome de Consultor:
                        </label>
                        <input
                          type="text"
                          value={brokerName}
                          onChange={(e) => setBrokerName(e.target.value)}
                          placeholder="Ex: Seu Nome"
                          className="w-full text-xs bg-white dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-white focus:border-[#FD7A00] focus:ring-1 focus:ring-[#FD7A00]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-[#888888]">
                          Imobiliária / Empresa:
                        </label>
                        <input
                          type="text"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="Ex: Minha Imobiliária"
                          className="w-full text-xs bg-white dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-white focus:border-[#FD7A00] focus:ring-1 focus:ring-[#FD7A00]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-[#888888]">
                          Instrução Específica (Opcional):
                        </label>
                        <input
                          type="text"
                          value={customInstructions}
                          onChange={(e) => setCustomInstructions(e.target.value)}
                          placeholder="Ex: É autônomo, falar após 18h"
                          className="w-full text-xs bg-white dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-white focus:border-[#FD7A00] focus:ring-1 focus:ring-[#FD7A00]"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleGenerateMessage}
                      disabled={isGeneratingMessage}
                      className="w-full py-3 bg-gradient-to-r from-[#FF9800] via-[#FD7A00] to-[#E85D00] hover:brightness-105 text-[#0B0B0B] text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm whitespace-nowrap active:scale-[0.99] transition-all"
                    >
                      <Sparkles className={`h-4 w-4 ${isGeneratingMessage ? 'animate-spin' : ''}`} />
                      <span>{isGeneratingMessage ? 'Gerando Abordagens com Playbook Comercial...' : 'Gerar Scripts Personalizados (Opção Direta vs. Consultiva)'}</span>
                    </button>

                    {generatedOptions.length > 0 && (
                      <div className="space-y-4 pt-3 border-t border-slate-200 dark:border-[#2A2A2A]">
                        <div className="flex items-center gap-2 bg-slate-200/60 dark:bg-[#202020] p-1 rounded-xl">
                          {generatedOptions.map((opt, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setActiveOptionIndex(idx);
                                setEditableOptionText(opt.text);
                                setGeneratedMessage(opt.text);
                                setIsEditingOption(false);
                              }}
                              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                activeOptionIndex === idx
                                  ? 'bg-white dark:bg-[#111111] text-[#FD7A00] shadow-xs'
                                  : 'text-slate-600 dark:text-[#999999] hover:text-slate-900 dark:hover:text-white'
                              }`}
                            >
                              <span>{idx === 0 ? '🎯' : '🤝'}</span>
                              <span>{opt.label}</span>
                            </button>
                          ))}
                        </div>

                        <div className="bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/25 rounded-2xl p-4 space-y-3 relative">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>{generatedOptions[activeOptionIndex]?.label}</span>
                            </span>

                            <button
                              type="button"
                              onClick={() => setIsEditingOption(!isEditingOption)}
                              className="text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                            >
                              <Edit3 className="h-3 w-3" />
                              <span>{isEditingOption ? 'Concluir Ajuste' : 'Editar Texto'}</span>
                            </button>
                          </div>

                          {isEditingOption ? (
                            <textarea
                              value={editableOptionText}
                              onChange={(e) => setEditableOptionText(e.target.value)}
                              rows={5}
                              className="w-full text-xs bg-white dark:bg-[#1c1c1c] border border-slate-300 dark:border-[#333333] rounded-xl p-3 text-slate-800 dark:text-white focus:border-[#FD7A00] focus:ring-1 focus:ring-[#FD7A00]"
                            />
                          ) : (
                            <p className="text-xs text-slate-800 dark:text-[#E5E5E5] whitespace-pre-wrap leading-relaxed font-sans bg-white/70 dark:bg-[#141414]/70 p-3.5 rounded-xl border border-emerald-500/15 shadow-2xs">
                              {editableOptionText || generatedOptions[activeOptionIndex]?.text}
                            </p>
                          )}

                          {playbookGoldenTip && (
                            <div className="bg-white/90 dark:bg-[#161616] p-2.5 rounded-xl border border-emerald-500/20 text-[11px] text-slate-700 dark:text-slate-300 flex items-start gap-2">
                              <Lightbulb className="h-3.5 w-3.5 text-[#FD7A00] shrink-0 mt-0.5" />
                              <span><strong>Dica de Condução:</strong> {playbookGoldenTip}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(editableOptionText || generatedOptions[activeOptionIndex]?.text)}
                            className="px-3.5 py-2 bg-white dark:bg-[#222222] hover:bg-slate-100 dark:hover:bg-[#2A2A2A] border border-slate-200 dark:border-[#2A2A2A] text-slate-700 dark:text-[#E5E5E5] text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                          >
                            <Copy className="h-3.5 w-3.5 text-[#FD7A00]" />
                            <span>{copiedMessage ? 'Copiado! ✓' : 'Copiar Texto'}</span>
                          </button>

                          <a
                            href={`https://wa.me/${client.phone.replace(/\D/g, '')}?text=${encodeURIComponent(editableOptionText || generatedOptions[activeOptionIndex]?.text || '')}`}
                            target="_blank"
                            referrerPolicy="no-referrer"
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors"
                          >
                            <Send className="h-3.5 w-3.5" />
                            <span>Abrir no WhatsApp</span>
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
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

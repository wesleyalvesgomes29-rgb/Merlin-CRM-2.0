import React, { useState } from 'react';
import { Task, Client } from '../../types';
import { openGoogleCalendarEvent } from '../../lib/calendarUtils';
import { 
  CheckCircle2, 
  Square, 
  MessageSquare, 
  Phone, 
  Calendar, 
  Clock, 
  CalendarPlus, 
  Flame, 
  Zap, 
  Snowflake, 
  MoreVertical, 
  Trash2, 
  ExternalLink, 
  User, 
  X, 
  Edit3, 
  Check, 
  ArrowRight,
  Car,
  FileText,
  Users,
  HelpCircle,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TaskCardProps {
  task: Task;
  linkedClient?: Client;
  onToggleComplete: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onSelectClient: (clientId: string) => void;
  onOpenPlaybook: (client: Client, task?: Task) => void;
  onReschedule: (task: Task, daysToAdd: number, customDate?: string, customTime?: string) => void;
  onOpenNextStepPrompt?: (client: Client, task: Task) => void;
  isOverdue?: boolean;
}

export const getActionIconAndColor = (type: string) => {
  switch (type) {
    case 'WhatsApp':
      return { icon: MessageSquare, label: 'WhatsApp', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
    case 'Ligação':
      return { icon: Phone, label: 'Ligação', color: 'text-[#FF7A00] bg-[#FF7A00]/10 border-[#FF7A00]/30' };
    case 'Visita ao Imóvel':
      return { icon: Car, label: 'Visita', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
    case 'Enviar Proposta':
      return { icon: FileText, label: 'Proposta', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' };
    case 'Reunião':
      return { icon: Users, label: 'Reunião', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' };
    case 'Contrato / Docs':
      return { icon: FileText, label: 'Contrato / Docs', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' };
    default:
      return { icon: HelpCircle, label: type || 'Geral', color: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30' };
  }
};

export default function TaskCard({
  task,
  linkedClient,
  onToggleComplete,
  onDeleteTask,
  onSelectClient,
  onOpenPlaybook,
  onReschedule,
  onOpenNextStepPrompt,
  isOverdue = false
}: TaskCardProps) {
  const [showRescheduleMenu, setShowRescheduleMenu] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState(task.dueTime || '');

  const actionInfo = getActionIconAndColor(task.actionType);
  const ActionIcon = actionInfo.icon;

  // Infer Lead Temperature Tag
  const leadTemperature = React.useMemo(() => {
    if (!linkedClient) return null;
    const urgency = typeof linkedClient.secondBrainSummary === 'object' && linkedClient.secondBrainSummary !== null
      ? linkedClient.secondBrainSummary.urgencyLevel
      : undefined;

    if (urgency === 'Alta' || linkedClient.status === 'Proposta' || linkedClient.status === 'Agendado' || linkedClient.status === 'Visitou') {
      return { label: 'Quente', icon: Flame, color: 'text-rose-400 bg-rose-500/15 border-rose-500/30' };
    }
    if (urgency === 'Média' || linkedClient.status === 'Em Atendimento' || linkedClient.status === 'Contato') {
      return { label: 'Morno', icon: Zap, color: 'text-amber-400 bg-amber-500/15 border-amber-500/30' };
    }
    return { label: 'Frio', icon: Snowflake, color: 'text-sky-400 bg-sky-500/15 border-sky-500/30' };
  }, [linkedClient]);

  const handleToggleClick = () => {
    onToggleComplete(task.id);
    if (!task.completed && linkedClient && onOpenNextStepPrompt) {
      onOpenNextStepPrompt(linkedClient, task);
    }
  };

  const handleWhatsAppAction = () => {
    if (linkedClient) {
      onOpenPlaybook(linkedClient, task);
    } else {
      alert('Tarefa não vinculada a um cliente específico.');
    }
  };

  const handleCustomRescheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDate) return;
    onReschedule(task, 0, customDate, customTime || undefined);
    setShowRescheduleMenu(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`group bg-[#141414] border rounded-2xl p-4 shadow-sm transition-all relative overflow-hidden flex flex-col justify-between ${
        task.completed
          ? 'border-[#222222] bg-[#0E0E0E]/60 opacity-60'
          : isOverdue
            ? 'border-rose-500/40 bg-rose-950/10 hover:border-rose-500/60'
            : 'border-[#272727] hover:border-[#FF7A00]/50 hover:shadow-lg'
      }`}
      id={`task-card-${task.id}`}
    >
      {/* Visual Priority Accent Line */}
      <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${
        task.priority === 'Alta' || isOverdue
          ? 'bg-rose-500 shadow-sm shadow-rose-500/50'
          : task.priority === 'Média'
            ? 'bg-[#FF7A00]'
            : 'bg-zinc-700'
      }`} />

      <div className="pl-2 space-y-3">
        {/* Row 1: Checkbox + Action Badge + Time + Temperature Tag + Options */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Complete Checkbox Button */}
            <button
              onClick={handleToggleClick}
              className="text-zinc-500 hover:text-emerald-400 transition-colors cursor-pointer shrink-0"
              title={task.completed ? 'Reabrir tarefa' : 'Concluir tarefa agora'}
            >
              {task.completed ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              ) : (
                <Square className="h-5 w-5 text-zinc-600 hover:text-[#FF7A00]" />
              )}
            </button>

            {/* Action Type Badge */}
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${actionInfo.color}`}>
              <ActionIcon className="h-3 w-3" />
              <span>{actionInfo.label}</span>
            </span>

            {/* Scheduled Time */}
            {task.dueTime ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-[#FF7A00] bg-[#FF7A00]/10 px-2 py-0.5 rounded-md border border-[#FF7A00]/25">
                <Clock className="h-3 w-3" />
                <span>{task.dueTime}</span>
              </span>
            ) : (
              <span className="text-[10px] text-zinc-400 font-mono flex items-center gap-1">
                <Calendar className="h-3 w-3 text-zinc-500" />
                <span>{task.dueDate}</span>
              </span>
            )}

            {/* Lead Temperature Tag */}
            {leadTemperature && (
              <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${leadTemperature.color}`}>
                <leadTemperature.icon className="h-2.5 w-2.5" />
                <span>{leadTemperature.label}</span>
              </span>
            )}

            {/* Google Calendar Synced Badge */}
            {(task.googleCalendarEventId || (task as any).google_event_id) && (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/25">
                <Calendar className="h-2.5 w-2.5 text-blue-400" />
                <span>Google Agenda</span>
              </span>
            )}
          </div>

          {/* Quick Reschedule / Delete controls */}
          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={() => setShowRescheduleMenu(!showRescheduleMenu)}
              className="p-1 rounded-lg text-zinc-400 hover:text-[#FF7A00] hover:bg-[#202020] transition-colors cursor-pointer"
              title="Remarcar / Adiar data"
            >
              <Clock className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onDeleteTask(task.id)}
              className="p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
              title="Excluir tarefa"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Reschedule Inline Dropdown */}
        <AnimatePresence>
          {showRescheduleMenu && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-[#181818] border border-[#2D2D2D] rounded-xl p-3 space-y-2.5"
            >
              <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                <span>Remarcar Tarefa:</span>
                <button onClick={() => setShowRescheduleMenu(false)} className="hover:text-white cursor-pointer">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Quick Preset Buttons */}
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => { onReschedule(task, 0); setShowRescheduleMenu(false); }}
                  className="py-1.5 px-2 rounded-lg bg-[#222222] border border-[#333333] text-[11px] font-semibold text-zinc-200 hover:border-[#FF7A00] hover:text-[#FF7A00] transition-all cursor-pointer text-center"
                >
                  Hoje
                </button>
                <button
                  onClick={() => { onReschedule(task, 1); setShowRescheduleMenu(false); }}
                  className="py-1.5 px-2 rounded-lg bg-[#222222] border border-[#333333] text-[11px] font-semibold text-zinc-200 hover:border-[#FF7A00] hover:text-[#FF7A00] transition-all cursor-pointer text-center"
                >
                  Amanhã (+1d)
                </button>
                <button
                  onClick={() => { onReschedule(task, 3); setShowRescheduleMenu(false); }}
                  className="py-1.5 px-2 rounded-lg bg-[#222222] border border-[#333333] text-[11px] font-semibold text-zinc-200 hover:border-[#FF7A00] hover:text-[#FF7A00] transition-all cursor-pointer text-center"
                >
                  +3 Dias
                </button>
              </div>

              {/* Custom Date Picker */}
              <form onSubmit={handleCustomRescheduleSubmit} className="flex items-center gap-1.5 pt-1">
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="bg-[#101010] border border-[#333333] rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-[#FF7A00] w-full"
                  required
                />
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className="bg-[#101010] border border-[#333333] rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-[#FF7A00] w-24"
                />
                <button
                  type="submit"
                  disabled={!customDate}
                  className="px-2.5 py-1 rounded-lg bg-[#FF7A00] text-black font-bold text-xs hover:bg-[#FF9800] disabled:opacity-50 cursor-pointer"
                >
                  Salvar
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Task Notes / Description */}
        <p className={`text-xs font-medium text-zinc-200 leading-relaxed break-words ${
          task.completed ? 'line-through text-zinc-500' : ''
        }`}>
          {task.notes || 'Sem observações adicionais.'}
        </p>

        {/* Linked Client Header Info */}
        <div className="pt-2 border-t border-[#222222] flex items-center justify-between gap-2 flex-wrap">
          {task.clientId && linkedClient ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onSelectClient(linkedClient.id)}
                className="text-xs font-bold text-white hover:text-[#FF7A00] flex items-center gap-1.5 transition-colors cursor-pointer group/link"
              >
                <div className="w-5 h-5 rounded-full bg-[#252525] border border-[#3A3A3A] flex items-center justify-center text-[10px] text-[#FF7A00] font-bold">
                  {linkedClient.name.charAt(0)}
                </div>
                <span className="truncate max-w-[140px]">{linkedClient.name}</span>
                <ExternalLink className="h-2.5 w-2.5 opacity-50 group-hover/link:opacity-100" />
              </button>

              {linkedClient.phone && (
                <span className="text-[11px] font-mono text-zinc-400 hidden sm:inline">
                  {linkedClient.phone}
                </span>
              )}
            </div>
          ) : (
            <span className="text-[10px] text-zinc-500 italic">Tarefa Geral</span>
          )}

          {/* Direct Execution Action Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* 🟢 WhatsApp Button with Playbook Script */}
            {linkedClient && (
              <button
                onClick={handleWhatsAppAction}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 transition-all cursor-pointer active:scale-95"
                title="Abrir WhatsApp com Script do Playbook"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>WhatsApp</span>
              </button>
            )}

            {/* ✅ Concluir Button */}
            {!task.completed && (
              <button
                onClick={handleToggleClick}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 hover:border-emerald-500/50 transition-all cursor-pointer active:scale-95"
                title="Marcar como Concluída"
              >
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span>Concluir</span>
              </button>
            )}

            {/* ✏️ Remarcar Button */}
            <button
              onClick={() => setShowRescheduleMenu(!showRescheduleMenu)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-all cursor-pointer"
              title="Remarcar data"
            >
              <Edit3 className="h-3 w-3" />
              <span>Remarcar</span>
            </button>

            {/* Google Calendar Direct Link */}
            <button
              onClick={() => openGoogleCalendarEvent({
                title: task.notes || `${task.actionType} - ${task.clientName || 'Cliente'}`,
                notes: `Tarefa: ${task.notes || task.actionType}\nLead: ${task.clientName || 'N/A'}\nPrioridade: ${task.priority}`,
                dueDate: task.dueDate,
                dueTime: task.dueTime
              })}
              className="p-1.5 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/25 transition-all cursor-pointer"
              title="Abrir no Google Agenda"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

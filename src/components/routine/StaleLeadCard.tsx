import React from 'react';
import { Client, Task } from '../../types';
import { 
  AlertTriangle, 
  MessageSquare, 
  Plus, 
  User, 
  Phone, 
  Building, 
  Clock, 
  ArrowRight,
  Flame,
  Zap,
  Snowflake
} from 'lucide-react';
import { motion } from 'motion/react';

interface StaleLeadCardProps {
  client: Client;
  daysWithoutContact: number;
  onSelectClient: (clientId: string) => void;
  onOpenPlaybook: (client: Client, task?: Task) => void;
  onQuickScheduleTask: (client: Client) => void;
}

export default function StaleLeadCard({
  client,
  daysWithoutContact,
  onSelectClient,
  onOpenPlaybook,
  onQuickScheduleTask
}: StaleLeadCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-[#171313] border border-rose-500/30 hover:border-rose-500/60 rounded-2xl p-3.5 shadow-sm transition-all flex flex-col justify-between group"
      id={`stale-lead-${client.id}`}
    >
      <div className="space-y-2.5">
        {/* Top bar: Alert Badge + Days Count */}
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse">
            <AlertTriangle className="h-3 w-3 text-rose-400" />
            <span>Lead Estagnado</span>
          </span>

          <span className="text-[11px] font-mono font-black text-rose-400">
            {daysWithoutContact} dias sem toque
          </span>
        </div>

        {/* Client Name & Phone */}
        <div>
          <button
            onClick={() => onSelectClient(client.id)}
            className="text-sm font-bold text-white hover:text-[#FF7A00] flex items-center gap-1.5 transition-colors cursor-pointer text-left"
          >
            <User className="h-3.5 w-3.5 text-[#FF7A00]" />
            <span className="truncate">{client.name}</span>
          </button>
          
          <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
            {client.phone && <span>{client.phone}</span>}
            {client.empreendimento && (
              <>
                <span>•</span>
                <span className="truncate max-w-[140px] text-zinc-300">{client.empreendimento}</span>
              </>
            )}
          </div>
        </div>

        {/* Current status pill */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-zinc-500 font-bold uppercase">Status:</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700">
            {client.status}
          </span>
        </div>
      </div>

      {/* Action CTA Buttons */}
      <div className="pt-3 mt-3 border-t border-rose-950/40 flex items-center justify-between gap-2">
        <button
          onClick={() => onOpenPlaybook(client)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/40 transition-all cursor-pointer active:scale-95"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          <span>Reativar (Whats)</span>
        </button>

        <button
          onClick={() => onQuickScheduleTask(client)}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-all cursor-pointer active:scale-95"
          title="Agendar nova tarefa para este lead"
        >
          <Plus className="h-3.5 w-3.5 text-[#FF7A00]" />
          <span>Agendar</span>
        </button>
      </div>
    </motion.div>
  );
}

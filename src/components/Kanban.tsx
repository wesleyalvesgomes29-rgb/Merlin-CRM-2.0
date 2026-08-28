import React, { useState } from 'react';
import { Client, ClientStatus, Tag } from '../types';
import { getClientAlerts } from '../lib/storage';
import { 
  Plus, 
  MessageSquare, 
  Calendar, 
  AlertTriangle, 
  ChevronRight, 
  ChevronLeft,
  Settings,
  MoveRight,
  Eye
} from 'lucide-react';
import { motion } from 'motion/react';

interface KanbanProps {
  clients: Client[];
  tags: Tag[];
  onUpdateClientStatus: (clientId: string, newStatus: ClientStatus) => void;
  onSelectClient: (id: string) => void;
  onAddClient: (initialStatus?: ClientStatus) => void;
}

const COLUMNS: { 
  id: ClientStatus; 
  title: string; 
  barColor: string;
  titleColor: string;
}[] = [
  { 
    id: 'Lead Novo', 
    title: 'Lead Novo', 
    barColor: 'bg-[#FD7A00]',
    titleColor: 'text-[#FD7A00]'
  },
  { 
    id: 'Contato', 
    title: 'Contato', 
    barColor: 'bg-[#FF9800]',
    titleColor: 'text-[#FF9800]'
  },
  { 
    id: 'Em Atendimento', 
    title: 'Em Atendimento', 
    barColor: 'bg-[#FD7A00]',
    titleColor: 'text-[#FD7A00]'
  },
  { 
    id: 'Retrabalho', 
    title: 'Retrabalho', 
    barColor: 'bg-[#F59E0B]',
    titleColor: 'text-[#F59E0B]'
  },
  { 
    id: 'Agendado', 
    title: 'Agendado', 
    barColor: 'bg-[#E85D00]',
    titleColor: 'text-[#E85D00]'
  },
  { 
    id: 'Visitou', 
    title: 'Visitou', 
    barColor: 'bg-[#FF9800]',
    titleColor: 'text-[#FF9800]'
  },
  { 
    id: 'Proposta', 
    title: 'Proposta', 
    barColor: 'bg-[#FD7A00]',
    titleColor: 'text-[#FD7A00]'
  },
  { 
    id: 'Documentação', 
    title: 'Documentação', 
    barColor: 'bg-[#E85D00]',
    titleColor: 'text-[#E85D00]'
  },
  { 
    id: 'Venda Fechada', 
    title: 'Venda Fechada', 
    barColor: 'bg-[#10B981]',
    titleColor: 'text-[#10B981] font-extrabold'
  },
  { 
    id: 'Perdido', 
    title: 'Perdido', 
    barColor: 'bg-[#666666]',
    titleColor: 'text-[#888888]'
  }
];

export default function Kanban({
  clients,
  tags,
  onUpdateClientStatus,
  onSelectClient,
  onAddClient
}: KanbanProps) {
  const [draggedClientId, setDraggedClientId] = useState<string | null>(null);
  const [hoveredColumn, setHoveredColumn] = useState<ClientStatus | null>(null);

  const handleDragStart = (e: React.DragEvent, clientId: string) => {
    setDraggedClientId(clientId);
    e.dataTransfer.setData('text/plain', clientId);
  };

  const handleDragOver = (e: React.DragEvent, columnId: ClientStatus) => {
    e.preventDefault();
    setHoveredColumn(columnId);
  };

  const handleDrop = (e: React.DragEvent, columnId: ClientStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggedClientId;
    if (id) {
      onUpdateClientStatus(id, columnId);
    }
    setDraggedClientId(null);
    setHoveredColumn(null);
  };

  const moveColumn = (client: Client, direction: 'left' | 'right') => {
    const currentIdx = COLUMNS.findIndex(col => col.id === client.status);
    let targetIdx = currentIdx + (direction === 'right' ? 1 : -1);
    if (targetIdx >= 0 && targetIdx < COLUMNS.length) {
      onUpdateClientStatus(client.id, COLUMNS[targetIdx].id);
    }
  };

  return (
    <div className="space-y-4" id="kanban-panel">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display text-slate-800 dark:text-white">Funil de Vendas Visual</h2>
          <p className="text-xs text-slate-500 dark:text-[#888888]">Arraste os clientes para trocar de etapa ou use os botões rápidos de controle.</p>
        </div>
        <button
          onClick={() => onAddClient()}
          className="bg-gradient-to-r from-[#FF9800] via-[#FD7A00] to-[#E85D00] text-[#0B0B0B] px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all self-start md:self-auto hover:brightness-105 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span>Cadastrar Cliente</span>
        </button>
      </div>

      {/* Horizontal scrolling container for boards */}
      <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-[#2A2A2A] scrollbar-track-transparent">
        {COLUMNS.map(column => {
          const columnClients = clients.filter(c => c.status === column.id);
          const isOver = hoveredColumn === column.id;

          return (
            <div
              key={column.id}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={() => setHoveredColumn(null)}
              onDrop={(e) => handleDrop(e, column.id)}
              className={`w-72 flex-shrink-0 flex flex-col rounded-2xl border transition-all ${
                isOver 
                  ? 'border-[#FD7A00] ring-2 ring-[#FD7A00]/20 bg-[#FD7A00]/5 dark:bg-[#FD7A00]/10' 
                  : 'border-slate-200 dark:border-[#2A2A2A] bg-slate-50/50 dark:bg-[#161616]'
              }`}
              id={`kanban-column-${column.id.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {/* Colored top bar representing the stage's distinct palette color */}
              <div className={`h-1.5 w-full ${column.barColor} rounded-t-[14px]`} />

              {/* Lane Header */}
              <div className="p-3.5 flex items-center justify-between border-b border-slate-200 dark:border-[#2A2A2A] bg-white dark:bg-[#222222] rounded-b-none">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${column.barColor}`} />
                  <h3 className={`font-bold text-sm ${column.titleColor}`}>{column.title}</h3>
                </div>
                <span className="text-xs font-mono font-extrabold bg-slate-100 dark:bg-[#161616] text-slate-600 dark:text-[#E5E5E5] h-5 px-1.5 rounded-md flex items-center justify-center border border-slate-200/50 dark:border-[#2A2A2A]">
                  {columnClients.length}
                </span>
              </div>

              {/* Lane body (cards list) */}
              <div className="p-3 flex-1 overflow-y-auto space-y-3 min-h-[420px] max-h-[600px]">
                {columnClients.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-12 text-slate-400 dark:text-[#666666] border-2 border-dashed border-slate-200 dark:border-[#2A2A2A] rounded-xl">
                    <Plus 
                      onClick={() => onAddClient(column.id)}
                      className="h-8 w-8 cursor-pointer hover:text-[#FD7A00] transition-colors" 
                    />
                    <span className="text-[10px] mt-1 font-medium">Sem clientes aqui</span>
                  </div>
                ) : (
                  columnClients.map(client => {
                    const alerts = getClientAlerts(client);
                    return (
                      <div
                        key={client.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, client.id)}
                        className="bg-white dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-3 shadow-xs hover:shadow-md hover:border-slate-300 dark:hover:border-[#FD7A00]/40 transition-all cursor-grab active:cursor-grabbing space-y-2.5 group relative"
                        id={`kanban-card-${client.id}`}
                      >
                        {/* Quick controls for mobile touch */}
                        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white/90 dark:bg-[#161616]/90 pl-1.5 py-0.5 rounded-md shadow-xs border border-slate-100 dark:border-[#2A2A2A]">
                          {COLUMNS.findIndex(col => col.id === client.status) > 0 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); moveColumn(client, 'left'); }}
                              className="p-1 hover:bg-slate-100 dark:hover:bg-[#2A2A2A] text-slate-500 dark:text-[#888888] rounded-sm cursor-pointer"
                              title="Recuar etapa"
                            >
                              <ChevronLeft className="h-3 w-3" />
                            </button>
                          )}
                          {COLUMNS.findIndex(col => col.id === client.status) < COLUMNS.length - 1 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); moveColumn(client, 'right'); }}
                              className="p-1 hover:bg-slate-100 dark:hover:bg-[#2A2A2A] text-slate-500 dark:text-[#888888] rounded-sm cursor-pointer"
                              title="Avançar etapa"
                            >
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          )}
                        </div>

                        {/* Card Content */}
                        <div className="space-y-1 pr-6">
                          <h4 
                            onClick={() => onSelectClient(client.id)}
                            className="font-bold text-sm text-slate-800 dark:text-white hover:text-[#FD7A00] cursor-pointer transition-colors line-clamp-1"
                          >
                            {client.name}
                          </h4>
                          <p className="text-[10px] font-mono text-slate-500 dark:text-[#888888]">{client.phone}</p>
                        </div>

                        {/* Description snippet */}
                        {client.notes && (
                          <p className="text-[10px] text-slate-600 dark:text-[#CCCCCC] line-clamp-2 italic bg-slate-50 dark:bg-[#161616] p-1.5 rounded-md border border-slate-100 dark:border-[#2A2A2A]">
                            {client.notes}
                          </p>
                        )}

                        {/* Alerts & Warnings */}
                        <div className="space-y-1">
                          {alerts.isAtrasado && (
                            <span className="text-[9px] font-extrabold text-[#EF4444] bg-[#EF4444]/10 px-1.5 py-0.5 rounded border border-[#EF4444]/20 flex items-center gap-1">
                              <AlertTriangle className="h-2.5 w-2.5 animate-pulse" />
                              <span>Retorno Atrasado</span>
                            </span>
                          )}
                          {alerts.isUrgente && (
                            <span className="text-[9px] font-extrabold text-[#EF4444] bg-[#EF4444]/15 px-1.5 py-0.5 rounded border border-[#EF4444]/30 flex items-center gap-1 animate-pulse">
                              <AlertTriangle className="h-2.5 w-2.5" />
                              <span>Urgente: Parado &gt;15 dias</span>
                            </span>
                          )}
                          {alerts.isSemRetorno && (
                            <span className="text-[9px] font-extrabold text-[#F59E0B] bg-[#F59E0B]/10 px-1.5 py-0.5 rounded border border-[#F59E0B]/20 flex items-center gap-1">
                              <AlertTriangle className="h-2.5 w-2.5" />
                              <span>Sem retorno agendado</span>
                            </span>
                          )}
                        </div>

                        {/* Tags line */}
                        <div className="flex flex-wrap gap-1">
                          {client.tags.slice(0, 3).map(tagName => {
                            const tagColor = tags.find(t => t.name === tagName)?.color || 'bg-slate-100 dark:bg-[#161616] text-slate-800 dark:text-[#E5E5E5] border-slate-200 dark:border-[#2A2A2A]';
                            return (
                              <span
                                key={tagName}
                                className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-full border ${tagColor}`}
                              >
                                {tagName}
                              </span>
                            );
                          })}
                          {client.tags.length > 3 && (
                            <span className="text-[8px] bg-slate-100 dark:bg-[#161616] text-slate-500 dark:text-[#888888] px-1 py-0.2 rounded-full border border-slate-200 dark:border-[#2A2A2A]">
                              +{client.tags.length - 3}
                            </span>
                          )}
                        </div>

                        {/* Footer details / action buttons */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-[#2A2A2A] text-[10px] text-slate-400 dark:text-[#888888]">
                          <span>Conversas: <strong className="text-slate-700 dark:text-[#E5E5E5]">{client.contactCount}</strong></span>
                          
                          <button
                            onClick={() => onSelectClient(client.id)}
                            className="text-[#FD7A00] hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                          >
                            <Eye className="h-3 w-3" />
                            <span>Ver Ficha</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

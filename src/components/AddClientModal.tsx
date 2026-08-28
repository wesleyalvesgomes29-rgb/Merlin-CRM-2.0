import React, { useState } from 'react';
import { ClientStatus, Tag } from '../types';
import { X, UserPlus, Save, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

interface AddClientModalProps {
  tags: Tag[];
  initialStatus?: ClientStatus;
  onClose: () => void;
  onSave: (clientData: {
    name: string;
    phone: string;
    notes: string;
    status: ClientStatus;
    tags: string[];
    email?: string;
    empreendimento?: string;
    origem?: string;
  }) => void;
}

export default function AddClientModal({
  tags,
  initialStatus = 'Lead Novo',
  onClose,
  onSave
}: AddClientModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<ClientStatus>(initialStatus);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [empreendimento, setEmpreendimento] = useState('');
  const [origem, setOrigem] = useState('');

  const handleToggleTag = (tagName: string) => {
    if (selectedTags.includes(tagName)) {
      setSelectedTags(selectedTags.filter(t => t !== tagName));
    } else {
      setSelectedTags([...selectedTags, tagName]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      alert('Por favor, preencha o Nome e Telefone do cliente.');
      return;
    }

    onSave({
      name: name.trim(),
      phone: phone.trim(),
      notes: notes.trim(),
      status,
      tags: selectedTags,
      email: email.trim() || undefined,
      empreendimento: empreendimento.trim() || undefined,
      origem: origem.trim() || undefined
    });
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

  return (
    <div 
      className="fixed inset-0 bg-[#0B0B0B]/85 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center sm:p-4 transition-all"
      onClick={onClose}
      id="add-client-modal-backdrop"
    >
      <motion.div
        initial={{ y: 20, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.96 }}
        className="w-full sm:max-w-xl bg-white dark:bg-[#161616] rounded-t-3xl sm:rounded-3xl shadow-2xl relative overflow-hidden border border-slate-200 dark:border-[#2A2A2A] max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        id="add-client-modal-body"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-[#2A2A2A] bg-slate-50 dark:bg-[#0B0B0B] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#FD7A00]/10 text-[#FD7A00] rounded-xl border border-[#FD7A00]/20">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base font-display text-slate-900 dark:text-white">
                Cadastrar Novo Cliente
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#888888]">
                Adicione as informações essenciais para acompanhamento
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#222222] rounded-xl cursor-pointer transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Name */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase tracking-wider block">Nome do Cliente *</label>
              <input
                type="text"
                placeholder="Ex: Roberto Silva"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-[#E5E5E5] placeholder-slate-400 dark:placeholder-[#666666] focus:outline-none focus:ring-1 focus:ring-[#FD7A00] focus:border-[#FD7A00]"
                required
                autoFocus
              />
            </div>

            {/* Phone */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase tracking-wider block">Telefone / WhatsApp *</label>
              <input
                type="text"
                placeholder="Ex: (11) 98123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-[#E5E5E5] placeholder-slate-400 dark:placeholder-[#666666] focus:outline-none focus:ring-1 focus:ring-[#FD7A00] focus:border-[#FD7A00]"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Email */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase tracking-wider block">Email</label>
              <input
                type="email"
                placeholder="Ex: roberto@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-[#E5E5E5] placeholder-slate-400 dark:placeholder-[#666666] focus:outline-none focus:ring-1 focus:ring-[#FD7A00] focus:border-[#FD7A00]"
              />
            </div>

            {/* Imovel / Empreendimento */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase tracking-wider block">Imóvel / Interesse</label>
              <input
                type="text"
                placeholder="Ex: Apto 3 dorms, Casa Jardins..."
                value={empreendimento}
                onChange={(e) => setEmpreendimento(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-[#E5E5E5] placeholder-slate-400 dark:placeholder-[#666666] focus:outline-none focus:ring-1 focus:ring-[#FD7A00] focus:border-[#FD7A00]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Status Selector */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase tracking-wider block">Etapa Inicial</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ClientStatus)}
                className="w-full text-xs bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-[#E5E5E5] focus:outline-none focus:ring-1 focus:ring-[#FD7A00] cursor-pointer"
              >
                {STATUS_LIST.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            {/* Origem */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase tracking-wider block">Origem do Lead</label>
              <input
                type="text"
                placeholder="Ex: Instagram, Placa, Indicação"
                value={origem}
                onChange={(e) => setOrigem(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-[#E5E5E5] placeholder-slate-400 dark:placeholder-[#666666] focus:outline-none focus:ring-1 focus:ring-[#FD7A00] focus:border-[#FD7A00]"
              />
            </div>
          </div>

          {/* Observations */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase tracking-wider block">Perfil &amp; Observações Iniciais</label>
            <textarea
              placeholder="Ex: Busca casa de R$ 900k em condomínio fechado. Perfil investidor..."
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-[#E5E5E5] placeholder-slate-400 dark:placeholder-[#666666] focus:outline-none focus:ring-1 focus:ring-[#FD7A00] focus:border-[#FD7A00]"
            />
          </div>

          {/* Quick initial tags selection */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase tracking-wider block">Etiquetas Rápidas</label>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2.5 border border-slate-200 dark:border-[#2A2A2A] rounded-xl bg-slate-50 dark:bg-[#0B0B0B]">
              {tags.map(tag => {
                const isSelected = selectedTags.includes(tag.name);
                return (
                  <button
                    type="button"
                    key={tag.id}
                    onClick={() => handleToggleTag(tag.name)}
                    className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full border transition-all cursor-pointer ${
                      isSelected
                        ? `${tag.color} ring-2 ring-[#FD7A00]/20 font-bold shadow-2xs`
                        : 'bg-white dark:bg-[#222222] text-slate-400 dark:text-[#888888] border-slate-200 dark:border-[#2A2A2A] hover:border-slate-300 dark:hover:border-[#FD7A00]/40'
                    }`}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions Footer */}
          <div className="flex gap-2 justify-end pt-3 border-t border-slate-100 dark:border-[#2A2A2A]">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-500 dark:text-[#888888] font-semibold px-4 py-2 border border-slate-200 dark:border-[#2A2A2A] rounded-xl hover:bg-slate-50 dark:hover:bg-[#222222] hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="text-xs bg-gradient-to-r from-[#FF9800] via-[#FD7A00] to-[#E85D00] text-[#0B0B0B] font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm shadow-[#FD7A00]/20 transition-all cursor-pointer active:scale-95 hover:brightness-105"
            >
              <Save className="h-4 w-4" />
              <span>Cadastrar Cliente</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

import React, { useState, useMemo, useRef } from 'react';
import { Client, Tag, ClientStatus } from '../types';
import { getClientAlerts, getDaysSinceContact } from '../lib/storage';
import { 
  Search, 
  Plus, 
  Phone, 
  MessageSquare, 
  Calendar, 
  Tag as TagIcon, 
  Filter, 
  Trash2, 
  AlertTriangle,
  FolderMinus,
  Edit2,
  Upload,
  Download,
  Check,
  AlertCircle,
  FileSpreadsheet,
  X,
  LayoutGrid,
  List,
  Sparkles,
  ChevronRight,
  Clock,
  UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';

interface ImportedRow {
  name: string;
  phone: string;
  email?: string;
  empreendimento?: string;
  origem?: string;
  status: ClientStatus;
  notes: string;
  valid: boolean;
}

interface ClientDirectoryProps {
  clients: Client[];
  tags: Tag[];
  onSelectClient: (id: string) => void;
  onAddClient: () => void;
  onDeleteClient: (id: string) => void;
  onCreateTag: (name: string, color: string) => void;
  onImportClients: (importedList: {
    name: string;
    phone: string;
    email?: string;
    empreendimento?: string;
    origem?: string;
    status: ClientStatus;
    notes: string;
  }[]) => void;
  initialSpecialFilter?: 'all' | 'high_priority' | 'no_next_contact';
  onSpecialFilterChange?: (filter: 'all' | 'high_priority' | 'no_next_contact') => void;
}

export default function ClientDirectory({
  clients,
  tags,
  onSelectClient,
  onAddClient,
  onDeleteClient,
  onCreateTag,
  onImportClients,
  initialSpecialFilter = 'all',
  onSpecialFilterChange
}: ClientDirectoryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedSpecialFilter, setSelectedSpecialFilter] = useState<'all' | 'high_priority' | 'no_next_contact'>(initialSpecialFilter);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showTagCreator, setShowTagCreator] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800');

  // Sync initialSpecialFilter prop
  React.useEffect(() => {
    setSelectedSpecialFilter(initialSpecialFilter);
  }, [initialSpecialFilter]);

  const handleSpecialFilterChange = (val: 'all' | 'high_priority' | 'no_next_contact') => {
    setSelectedSpecialFilter(val);
    if (onSpecialFilterChange) {
      onSpecialFilterChange(val);
    }
  };

  // Excel Import / Export States
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewRows, setPreviewRows] = useState<ImportedRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // WhatsApp-style soft colors list for selection
  const TAG_COLOR_PRESETS = [
    { name: 'Laranja / Principal', value: 'bg-[#FD7A00]/15 text-[#FD7A00] border-[#FD7A00]/40' },
    { name: 'Amber / Destaque', value: 'bg-amber-500/15 text-amber-500 border-amber-500/40' },
    { name: 'Verde / WhatsApp', value: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40' },
    { name: 'Carvão / Neutro', value: 'bg-[#2A2A2A] text-[#E5E5E5] border-[#444444]' },
    { name: 'Vermelho / Urgente', value: 'bg-rose-500/15 text-rose-400 border-rose-500/40' },
    { name: 'Laranja Escuro / VIP', value: 'bg-[#E85D00]/15 text-[#E85D00] border-[#E85D00]/40' }
  ];

  const handleCreateTagSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    onCreateTag(newTagName.trim(), newTagColor);
    setNewTagName('');
    setShowTagCreator(false);
  };

  // EXCEL IMPORT & EXPORT HANDLERS
  const handleExportExcel = () => {
    try {
      const dataToExport = clients.map(c => ({
        'Nome': c.name,
        'Telefone': c.phone,
        'Email': c.email || '',
        'Empreendimento': c.empreendimento || '',
        'Origem': c.origem || '',
        'Status': c.status,
        'Observações': c.notes || ''
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Leads');
      XLSX.writeFile(wb, 'Leads_Chibi_CRM.xlsx');
    } catch (error) {
      console.error(error);
      alert('Ocorreu um erro ao exportar os dados para Excel.');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawData = XLSX.utils.sheet_to_json<any>(worksheet);

        if (rawData.length === 0) {
          alert('A planilha importada está vazia.');
          return;
        }

        const parsedRows: ImportedRow[] = rawData.map((row: any) => {
          const name = row['Nome'] || row['nome'] || row['Name'] || row['name'] || '';
          const phone = row['Telefone'] || row['telefone'] || row['Phone'] || row['phone'] || '';
          const email = row['Email'] || row['email'] || row['Mail'] || row['mail'] || '';
          const empreendimento = row['Empreendimento'] || row['empreendimento'] || row['Imóvel'] || row['imovel'] || '';
          const origem = row['Origem'] || row['origem'] || row['Source'] || row['source'] || '';
          const statusRaw = row['Status'] || row['status'] || 'Lead Novo';
          const notes = row['Observações'] || row['observações'] || row['Notes'] || row['notes'] || '';

          const validStatuses: ClientStatus[] = [
            'Lead Novo', 'Contato', 'Em Atendimento', 'Retrabalho', 'Agendado',
            'Visitou', 'Proposta', 'Documentação', 'Venda Fechada', 'Perdido'
          ];
          const status = validStatuses.includes(statusRaw) ? statusRaw as ClientStatus : 'Lead Novo';

          return {
            name: String(name).trim(),
            phone: String(phone).trim(),
            email: email ? String(email).trim() : undefined,
            empreendimento: empreendimento ? String(empreendimento).trim() : undefined,
            origem: origem ? String(origem).trim() : undefined,
            status,
            notes: notes ? String(notes).trim() : '',
            valid: !!String(name).trim() && !!String(phone).trim()
          };
        });

        setPreviewRows(parsedRows);
        setShowPreviewModal(true);
      } catch (err) {
        console.error(err);
        alert('Erro ao processar o arquivo Excel. Certifique-se de que é uma planilha válida.');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleConfirmImport = () => {
    const validRows = previewRows.filter(r => r.valid);
    if (validRows.length === 0) {
      alert('Nenhum lead válido para importação. O Nome e Telefone são campos obrigatórios.');
      return;
    }

    onImportClients(validRows.map(r => ({
      name: r.name,
      phone: r.phone,
      email: r.email,
      empreendimento: r.empreendimento,
      origem: r.origem,
      status: r.status,
      notes: r.notes
    })));

    setShowPreviewModal(false);
  };

  // Helpers for special filters
  const isClientHighPriority = (client: Client) => {
    const alerts = getClientAlerts(client);
    if (alerts.isUrgente) return true;
    
    if (client.status === 'Proposta' || client.status === 'Documentação' || client.status === 'Visitou') {
      return true;
    }
    
    const tagsLower = (client.tags || []).map(t => t.toLowerCase());
    if (tagsLower.includes('urgente') || tagsLower.includes('alta prioridade') || tagsLower.includes('investidor')) {
      return true;
    }
    
    if (client.contactCount >= 8) {
      return true;
    }
    
    return false;
  };

  const isClientNoNextContact = (client: Client) => {
    return !client.nextContactDate && client.status !== 'Venda Fechada' && client.status !== 'Perdido';
  };

  // Filtered clients list
  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      // 1. Search term
      const matchesSearch = 
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.phone.replace(/\D/g, '').includes(searchTerm.replace(/\D/g, '')) ||
        (client.empreendimento && client.empreendimento.toLowerCase().includes(searchTerm.toLowerCase())) ||
        client.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));

      // 2. Tag filter
      const matchesTag = selectedTagFilter === 'all' || client.tags.includes(selectedTagFilter);

      // 3. Status filter
      const matchesStatus = selectedStatusFilter === 'all' || client.status === selectedStatusFilter;

      // 4. Special filter
      let matchesSpecial = true;
      if (selectedSpecialFilter === 'high_priority') {
        matchesSpecial = isClientHighPriority(client);
      } else if (selectedSpecialFilter === 'no_next_contact') {
        matchesSpecial = isClientNoNextContact(client);
      }

      return matchesSearch && matchesTag && matchesStatus && matchesSpecial;
    });
  }, [clients, searchTerm, selectedTagFilter, selectedStatusFilter, selectedSpecialFilter]);

  const hasActiveFilters = searchTerm !== '' || selectedTagFilter !== 'all' || selectedStatusFilter !== 'all' || selectedSpecialFilter !== 'all';

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedTagFilter('all');
    setSelectedStatusFilter('all');
    handleSpecialFilterChange('all');
  };

  const getStatusColor = (status: ClientStatus) => {
    switch (status) {
      case 'Lead Novo':
        return 'bg-[#FD7A00]/15 text-[#FD7A00] border-[#FD7A00]/30';
      case 'Contato':
        return 'bg-[#FF9800]/15 text-[#FF9800] border-[#FF9800]/30';
      case 'Em Atendimento':
        return 'bg-[#FD7A00]/15 text-[#FD7A00] border-[#FD7A00]/30';
      case 'Retrabalho':
        return 'bg-amber-500/15 text-amber-500 border-amber-500/30';
      case 'Agendado':
        return 'bg-[#E85D00]/15 text-[#E85D00] border-[#E85D00]/30';
      case 'Visitou':
        return 'bg-[#FF9800]/15 text-[#FF9800] border-[#FF9800]/30';
      case 'Proposta':
        return 'bg-[#FD7A00]/15 text-[#FD7A00] border-[#FD7A00]/30';
      case 'Documentação':
        return 'bg-[#E85D00]/15 text-[#E85D00] border-[#E85D00]/30';
      case 'Venda Fechada':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'Perdido':
        return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
      default:
        return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
    }
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className="space-y-6" id="client-directory-panel">
      {/* Header and Add Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white tracking-tight">
              Gestão de Clientes & Leads
            </h2>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-[#FD7A00]/10 text-[#FD7A00] border border-[#FD7A00]/20">
              {filteredClients.length} {filteredClients.length === 1 ? 'lead' : 'leads'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-[#888888] mt-0.5">
            Base de dados comercial, histórico e controle individualizado
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Hidden File Input for Excel Import */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx, .xls"
            className="hidden"
          />

          {/* Importar Excel */}
          <button
            onClick={handleImportClick}
            className="bg-white dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] hover:bg-slate-50 dark:hover:bg-[#222222] text-slate-700 dark:text-[#E5E5E5] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            title="Importar Leads de planilha Excel"
          >
            <Upload className="h-3.5 w-3.5 text-emerald-500" />
            <span>Importar</span>
          </button>

          {/* Exportar Excel */}
          <button
            onClick={handleExportExcel}
            className="bg-white dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] hover:bg-slate-50 dark:hover:bg-[#222222] text-slate-700 dark:text-[#E5E5E5] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            title="Exportar todos os Leads para planilha Excel"
          >
            <Download className="h-3.5 w-3.5 text-[#FD7A00]" />
            <span>Exportar</span>
          </button>

          {/* Custom tag manager trigger */}
          <button
            onClick={() => setShowTagCreator(!showTagCreator)}
            className={`border px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
              showTagCreator
                ? 'bg-[#FD7A00]/10 border-[#FD7A00] text-[#FD7A00]'
                : 'bg-white dark:bg-[#161616] border-slate-200 dark:border-[#2A2A2A] text-slate-700 dark:text-[#E5E5E5] hover:bg-slate-50 dark:hover:bg-[#222222]'
            }`}
          >
            <TagIcon className="h-3.5 w-3.5" />
            <span>Etiquetas</span>
          </button>

          <button
            onClick={() => onAddClient()}
            className="bg-gradient-to-r from-[#FF9800] via-[#FD7A00] to-[#E85D00] text-[#0B0B0B] px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-[#FD7A00]/20 cursor-pointer active:scale-95 transition-all hover:brightness-105"
            id="open-add-client-modal-btn"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Novo Cliente</span>
          </button>
        </div>
      </div>

      {/* Tag Creator Dropdown Card */}
      <AnimatePresence>
        {showTagCreator && (
          <motion.div 
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            className="bg-white dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] p-4 rounded-2xl shadow-lg max-w-md space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                <TagIcon className="h-3.5 w-3.5 text-[#FD7A00]" />
                Criar Nova Etiqueta WhatsApp
              </h3>
              <button 
                onClick={() => setShowTagCreator(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <form onSubmit={handleCreateTagSubmit} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase mb-1">Nome da Etiqueta</label>
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Ex: Investidor Alto Padrão, Urgente..."
                  className="w-full text-xs bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-2.5 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#FD7A00] focus:border-[#FD7A00]"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase mb-1">Cor da Etiqueta</label>
                <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-1 border border-slate-100 dark:border-[#2A2A2A] rounded-xl">
                  {TAG_COLOR_PRESETS.map(preset => (
                    <button
                      type="button"
                      key={preset.value}
                      onClick={() => setNewTagColor(preset.value)}
                      className={`p-2 text-[10px] rounded-lg border text-left transition-all cursor-pointer ${
                        newTagColor === preset.value 
                          ? 'border-[#FD7A00] ring-2 ring-[#FD7A00]/20 font-bold bg-[#FD7A00]/10' 
                          : 'border-slate-200 dark:border-[#2A2A2A] hover:bg-slate-50 dark:hover:bg-[#222222]'
                      }`}
                    >
                      <span className={`px-2 py-0.5 rounded-full ${preset.value}`}>
                        {preset.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 dark:border-[#2A2A2A]">
                <button
                  type="button"
                  onClick={() => setShowTagCreator(false)}
                  className="text-xs text-slate-500 dark:text-[#888888] font-semibold px-3 py-1.5 border border-slate-200 dark:border-[#2A2A2A] rounded-xl hover:bg-slate-50 dark:hover:bg-[#222222] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="text-xs bg-gradient-to-r from-[#FF9800] via-[#FD7A00] to-[#E85D00] text-[#0B0B0B] font-bold px-3.5 py-1.5 rounded-xl shadow-xs cursor-pointer hover:brightness-105"
                >
                  Salvar Etiqueta
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search and Filters Hub */}
      <div className="bg-white dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] rounded-2xl p-3.5 space-y-3 shadow-xs">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#888888] h-4 w-4" />
            <input
              type="text"
              placeholder="Pesquisar por nome, telefone, empreendimento ou etiquetas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl pl-10 pr-9 py-2 text-xs sm:text-sm text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-[#888888] focus:outline-none focus:ring-1 focus:ring-[#FD7A00] focus:border-[#FD7A00]"
              id="search-client-input"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filters Selects */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-[#E5E5E5] focus:outline-none focus:ring-1 focus:ring-[#FD7A00] cursor-pointer"
              id="filter-status-select"
            >
              <option value="all">Todas as Etapas</option>
              <option value="Lead Novo">Lead Novo</option>
              <option value="Contato">Contato</option>
              <option value="Em Atendimento">Em Atendimento</option>
              <option value="Retrabalho">Retrabalho</option>
              <option value="Agendado">Agendado</option>
              <option value="Visitou">Visitou</option>
              <option value="Proposta">Proposta</option>
              <option value="Documentação">Documentação</option>
              <option value="Venda Fechada">Venda Fechada</option>
              <option value="Perdido">Perdido</option>
            </select>

            {/* Tag Filter */}
            <select
              value={selectedTagFilter}
              onChange={(e) => setSelectedTagFilter(e.target.value)}
              className="bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-[#E5E5E5] focus:outline-none focus:ring-1 focus:ring-[#FD7A00] cursor-pointer"
              id="filter-tag-select"
            >
              <option value="all">Todas Etiquetas</option>
              {tags.map(t => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </select>

            {/* Special Filter */}
            <select
              value={selectedSpecialFilter}
              onChange={(e) => handleSpecialFilterChange(e.target.value as any)}
              className="bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-[#E5E5E5] focus:outline-none focus:ring-1 focus:ring-[#FD7A00] cursor-pointer"
              id="filter-special-select"
            >
              <option value="all">Todos os Alertas</option>
              <option value="high_priority">Alta Prioridade</option>
              <option value="no_next_contact">Sem Retorno Agendado</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-[#222222] border border-slate-200 dark:border-[#2A2A2A] rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  viewMode === 'list' 
                    ? 'bg-white dark:bg-[#161616] text-[#FD7A00] shadow-2xs font-bold' 
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
                title="Visualização em Lista"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  viewMode === 'grid' 
                    ? 'bg-white dark:bg-[#161616] text-[#FD7A00] shadow-2xs font-bold' 
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
                title="Visualização em Grade"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Active Filters Pill Bar */}
        {hasActiveFilters && (
          <div className="flex items-center flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-[#2A2A2A] text-xs">
            <span className="text-[10px] font-bold text-slate-400 dark:text-[#888888] uppercase">Filtros Ativos:</span>
            {searchTerm && (
              <span className="bg-slate-100 dark:bg-[#222222] text-slate-700 dark:text-[#E5E5E5] px-2 py-0.5 rounded-md flex items-center gap-1 border border-slate-200/60 dark:border-[#2A2A2A]">
                Busca: "{searchTerm}"
                <button onClick={() => setSearchTerm('')} className="hover:text-rose-500 cursor-pointer">×</button>
              </span>
            )}
            {selectedStatusFilter !== 'all' && (
              <span className="bg-slate-100 dark:bg-[#222222] text-slate-700 dark:text-[#E5E5E5] px-2 py-0.5 rounded-md flex items-center gap-1 border border-slate-200/60 dark:border-[#2A2A2A]">
                Etapa: {selectedStatusFilter}
                <button onClick={() => setSelectedStatusFilter('all')} className="hover:text-rose-500 cursor-pointer">×</button>
              </span>
            )}
            {selectedTagFilter !== 'all' && (
              <span className="bg-slate-100 dark:bg-[#222222] text-slate-700 dark:text-[#E5E5E5] px-2 py-0.5 rounded-md flex items-center gap-1 border border-slate-200/60 dark:border-[#2A2A2A]">
                Tag: {selectedTagFilter}
                <button onClick={() => setSelectedTagFilter('all')} className="hover:text-rose-500 cursor-pointer">×</button>
              </span>
            )}
            {selectedSpecialFilter !== 'all' && (
              <span className="bg-slate-100 dark:bg-[#222222] text-slate-700 dark:text-[#E5E5E5] px-2 py-0.5 rounded-md flex items-center gap-1 border border-slate-200/60 dark:border-[#2A2A2A]">
                {selectedSpecialFilter === 'high_priority' ? 'Alta Prioridade' : 'Sem Retorno Agendado'}
                <button onClick={() => handleSpecialFilterChange('all')} className="hover:text-rose-500 cursor-pointer">×</button>
              </span>
            )}
            <button
              onClick={resetFilters}
              className="text-[11px] font-semibold text-[#FD7A00] hover:underline ml-auto cursor-pointer"
            >
              Limpar Todos
            </button>
          </div>
        )}
      </div>

      {/* Results Listing */}
      {filteredClients.length === 0 ? (
        <div className="bg-white dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] rounded-3xl p-12 text-center text-slate-400 dark:text-[#888888] space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-[#222222] flex items-center justify-center mx-auto text-slate-400 dark:text-[#888888]">
            <FolderMinus className="h-6 w-6" />
          </div>
          <div>
            <p className="font-bold text-slate-700 dark:text-[#E5E5E5] text-sm">Nenhum cliente encontrado</p>
            <p className="text-xs max-w-sm mx-auto mt-1 text-slate-500 dark:text-[#888888]">
              Experimente alterar os filtros de pesquisa ou cadastrar um novo cliente para esta seção.
            </p>
          </div>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="mt-2 text-xs font-bold text-[#FD7A00] bg-[#FD7A00]/10 hover:bg-[#FD7A00]/20 px-3 py-1.5 rounded-xl transition-colors cursor-pointer inline-block"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      ) : viewMode === 'list' ? (
        /* LIST VIEW */
        <div className="bg-white dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] rounded-3xl overflow-hidden shadow-xs">
          <div className="divide-y divide-slate-100 dark:divide-[#2A2A2A]">
            {filteredClients.map(client => {
              const alerts = getClientAlerts(client);
              const days = getDaysSinceContact(client);

              let daysColor = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/25';
              if (days >= 15) {
                daysColor = 'text-rose-400 bg-rose-500/10 border-rose-500/25 animate-pulse';
              } else if (days >= 4) {
                daysColor = 'text-amber-500 bg-amber-500/10 border-amber-500/25';
              }

              return (
                <div
                  key={client.id}
                  className="p-4 sm:p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 dark:hover:bg-[#222222]/50 transition-colors group"
                  id={`client-row-${client.id}`}
                >
                  {/* Avatar and Main Info */}
                  <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                    {/* Initials bubble */}
                    <div 
                      onClick={() => onSelectClient(client.id)}
                      className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-[#222222] dark:to-[#161616] border border-slate-200 dark:border-[#333333] text-slate-700 dark:text-[#E5E5E5] font-extrabold text-xs flex items-center justify-center shrink-0 cursor-pointer shadow-2xs group-hover:border-[#FD7A00]/50 transition-colors"
                    >
                      {getInitials(client.name)}
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 
                          onClick={() => onSelectClient(client.id)}
                          className="font-bold text-sm sm:text-base text-slate-900 dark:text-white hover:text-[#FD7A00] dark:hover:text-[#FD7A00] cursor-pointer transition-colors truncate"
                        >
                          {client.name}
                        </h3>

                        {/* Display Status tag */}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusColor(client.status)}`}>
                          {client.status}
                        </span>

                        {/* Client Rules Warning Badges */}
                        {alerts.isAtrasado && (
                          <span className="text-[9px] font-bold text-rose-400 bg-rose-950/30 px-1.5 py-0.5 rounded-md border border-rose-800 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 animate-pulse" />
                            <span>Retorno Atrasado</span>
                          </span>
                        )}
                        {alerts.isUrgente && (
                          <span className="text-[9px] font-bold text-red-400 bg-red-950/30 px-1.5 py-0.5 rounded-md border border-red-800 flex items-center gap-1 animate-pulse">
                            <AlertTriangle className="h-3 w-3" />
                            <span>&gt;15 dias parado</span>
                          </span>
                        )}
                        {alerts.isSemRetorno && (
                          <span className="text-[9px] font-bold text-yellow-400 bg-yellow-950/30 px-1.5 py-0.5 rounded-md border border-yellow-800 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            <span>Sem retorno</span>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-[#888888]">
                        <span className="font-mono text-slate-600 dark:text-[#E5E5E5]">{client.phone}</span>
                        {client.empreendimento && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-[#333333]" />
                            <span className="text-slate-700 dark:text-[#E5E5E5] font-medium truncate max-w-[200px]">
                              {client.empreendimento}
                            </span>
                          </>
                        )}
                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-[#333333]" />
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md border ${daysColor}`}>
                          {days}d sem toque
                        </span>
                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-[#333333]" />
                        <span className="text-[11px] text-slate-400 dark:text-[#888888]">
                          {client.contactCount} {client.contactCount === 1 ? 'toque' : 'toques'}
                        </span>
                      </div>

                      {/* Tags WhatsApp style */}
                      {client.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {client.tags.map(tagName => {
                            const tagColor = tags.find(t => t.name === tagName)?.color || 'bg-[#222222] text-[#E5E5E5] border-[#333333]';
                            return (
                              <span
                                key={tagName}
                                className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${tagColor}`}
                              >
                                {tagName}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-2 self-end md:self-center pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-[#2A2A2A] w-full md:w-auto justify-end">
                    <button
                      onClick={() => onSelectClient(client.id)}
                      className="px-3 py-1.5 rounded-xl text-slate-700 dark:text-[#E5E5E5] hover:bg-slate-100 dark:hover:bg-[#222222] transition-colors font-bold text-xs border border-slate-200 dark:border-[#2A2A2A] flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Edit2 className="h-3 w-3 text-[#FD7A00]" />
                      <span>Ficha</span>
                    </button>

                    <a
                      href={`https://wa.me/${client.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      referrerPolicy="no-referrer"
                      className="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-all shadow-2xs flex items-center justify-center cursor-pointer active:scale-95"
                      title="Abrir WhatsApp"
                    >
                      <MessageSquare className="h-4 w-4" />
                    </a>

                    <a
                      href={`tel:${client.phone.replace(/\D/g, '')}`}
                      className="p-2 bg-slate-100 dark:bg-[#222222] hover:bg-slate-200 dark:hover:bg-[#333333] text-slate-700 dark:text-[#E5E5E5] rounded-xl transition-all cursor-pointer"
                      title="Ligar"
                    >
                      <Phone className="h-4 w-4" />
                    </a>

                    <button
                      onClick={() => {
                        if (confirm(`Excluir permanentemente o cliente ${client.name}?`)) {
                          onDeleteClient(client.id);
                        }
                      }}
                      className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-400 hover:text-rose-500 rounded-xl transition-colors cursor-pointer"
                      title="Excluir Cliente"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map(client => {
            const alerts = getClientAlerts(client);
            const days = getDaysSinceContact(client);

            let daysColor = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/25';
            if (days >= 15) {
              daysColor = 'text-rose-400 bg-rose-500/10 border-rose-500/25 animate-pulse';
            } else if (days >= 4) {
              daysColor = 'text-amber-500 bg-amber-500/10 border-amber-500/25';
            }

            return (
              <div
                key={client.id}
                className="bg-white dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-xs hover:border-[#FD7A00]/50 transition-all group"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div 
                        onClick={() => onSelectClient(client.id)}
                        className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-[#222222] dark:to-[#161616] border border-slate-200 dark:border-[#333333] text-slate-800 dark:text-[#E5E5E5] font-extrabold text-xs flex items-center justify-center shrink-0 cursor-pointer"
                      >
                        {getInitials(client.name)}
                      </div>
                      <div>
                        <h3 
                          onClick={() => onSelectClient(client.id)}
                          className="font-bold text-sm text-slate-900 dark:text-white hover:text-[#FD7A00] dark:hover:text-[#FD7A00] cursor-pointer transition-colors truncate max-w-[160px]"
                        >
                          {client.name}
                        </h3>
                        <p className="text-xs font-mono text-slate-500 dark:text-[#888888]">{client.phone}</p>
                      </div>
                    </div>

                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${getStatusColor(client.status)}`}>
                      {client.status}
                    </span>
                  </div>

                  {client.empreendimento && (
                    <div className="bg-slate-50 dark:bg-[#222222] rounded-xl p-2 text-xs border border-slate-150 dark:border-[#2A2A2A]">
                      <span className="text-[9px] uppercase font-bold text-slate-400 dark:text-[#888888] block">Imóvel de Interesse</span>
                      <p className="text-slate-800 dark:text-[#E5E5E5] font-medium truncate">{client.empreendimento}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md border ${daysColor}`}>
                      {days}d sem contato
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-[#888888]">
                      {client.contactCount} toques
                    </span>
                  </div>

                  {/* Tags */}
                  {client.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {client.tags.map(tagName => {
                        const tagColor = tags.find(t => t.name === tagName)?.color || 'bg-[#222222] text-[#E5E5E5] border-[#333333]';
                        return (
                          <span
                            key={tagName}
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${tagColor}`}
                          >
                            {tagName}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-[#2A2A2A]">
                  <button
                    onClick={() => onSelectClient(client.id)}
                    className="text-xs font-bold text-[#FD7A00] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Ver Ficha</span>
                    <ChevronRight className="h-3 w-3" />
                  </button>

                  <div className="flex items-center gap-1.5">
                    <a
                      href={`https://wa.me/${client.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      referrerPolicy="no-referrer"
                      className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-all shadow-2xs"
                      title="WhatsApp"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                    </a>
                    <a
                      href={`tel:${client.phone.replace(/\D/g, '')}`}
                      className="p-1.5 bg-slate-100 dark:bg-[#222222] hover:bg-slate-200 dark:hover:bg-[#333333] text-slate-700 dark:text-[#E5E5E5] rounded-lg transition-all"
                      title="Ligar"
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Excel Preview Modal */}
      <AnimatePresence>
        {showPreviewModal && (
          <div 
            className="fixed inset-0 bg-[#0B0B0B]/80 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            onClick={() => setShowPreviewModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#161616] rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 dark:border-[#2A2A2A]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-100 dark:border-[#2A2A2A] flex items-center justify-between bg-slate-50 dark:bg-[#0B0B0B]">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white font-display">
                      Prévia da Importação Excel
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-[#888888]">
                      Confira os dados lidos da planilha antes de salvar no CRM
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#222222] rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-[#E5E5E5] transition-all cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Grid / Table Container */}
              <div className="flex-1 overflow-auto p-6 space-y-4">
                <div className="border border-slate-200 dark:border-[#2A2A2A] rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-[#0B0B0B] border-b border-slate-200 dark:border-[#2A2A2A] text-[10px] uppercase font-bold text-slate-500 dark:text-[#888888]">
                        <th className="p-3">Status</th>
                        <th className="p-3">Nome</th>
                        <th className="p-3">Telefone</th>
                        <th className="p-3">Email</th>
                        <th className="p-3">Empreendimento</th>
                        <th className="p-3">Origem</th>
                        <th className="p-3">Etapa do Funil</th>
                        <th className="p-3">Observações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#2A2A2A] text-xs">
                      {previewRows.map((row, index) => (
                        <tr 
                          key={index}
                          className={`${row.valid ? 'hover:bg-slate-50/50 dark:hover:bg-[#222222]/50' : 'bg-rose-50/40 dark:bg-rose-950/20'}`}
                        >
                          <td className="p-3 font-semibold">
                            {row.valid ? (
                              <span className="text-emerald-500 flex items-center gap-1 font-bold text-[11px]">
                                <Check className="h-3.5 w-3.5" /> Válido
                              </span>
                            ) : (
                              <span className="text-rose-400 flex items-center gap-1 font-bold text-[11px]" title="Nome e Telefone são obrigatórios">
                                <AlertCircle className="h-3.5 w-3.5" /> Inválido
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-medium text-slate-800 dark:text-[#E5E5E5] max-w-[120px] truncate">{row.name || <span className="italic text-rose-400">Ausente</span>}</td>
                          <td className="p-3 font-mono text-slate-700 dark:text-[#E5E5E5] max-w-[120px] truncate">{row.phone || <span className="italic text-rose-400">Ausente</span>}</td>
                          <td className="p-3 text-slate-600 dark:text-[#888888] max-w-[120px] truncate">{row.email || <span className="text-slate-400">-</span>}</td>
                          <td className="p-3 text-slate-600 dark:text-[#888888] max-w-[120px] truncate">{row.empreendimento || <span className="text-slate-400">-</span>}</td>
                          <td className="p-3 text-slate-600 dark:text-[#888888] max-w-[120px] truncate">{row.origem || <span className="text-slate-400">-</span>}</td>
                          <td className="p-3">
                            <span className="bg-slate-100 dark:bg-[#222222] text-slate-700 dark:text-[#E5E5E5] font-bold px-2 py-0.5 rounded-full text-[10px] uppercase">
                              {row.status}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500 dark:text-[#888888] max-w-[180px] truncate" title={row.notes}>{row.notes || <span className="text-slate-400">-</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {previewRows.some(r => !r.valid) && (
                  <p className="text-xs text-rose-400 mt-3 flex items-center gap-1.5 font-medium">
                    <AlertCircle className="h-4 w-4" />
                    Atenção: Linhas marcadas como "Inválido" não serão importadas por falta de Nome ou Telefone.
                  </p>
                )}
              </div>

              {/* Actions Footer */}
              <div className="p-5 border-t border-slate-100 dark:border-[#2A2A2A] flex items-center justify-between bg-slate-50 dark:bg-[#0B0B0B]">
                <span className="text-xs text-slate-500 dark:text-[#888888]">
                  Total de leads válidos: <strong>{previewRows.filter(r => r.valid).length}</strong> de {previewRows.length}
                </span>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowPreviewModal(false)}
                    className="border border-slate-200 dark:border-[#2A2A2A] hover:bg-slate-50 dark:hover:bg-[#222222] text-slate-600 dark:text-[#E5E5E5] px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmImport}
                    className="bg-[#FD7A00] hover:bg-[#FF9800] text-[#0B0B0B] px-5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all"
                  >
                    <Check className="h-4 w-4" />
                    <span>Confirmar Importação</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

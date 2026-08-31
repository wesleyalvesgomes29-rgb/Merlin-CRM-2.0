import React, { useState, useEffect } from 'react';
import { 
  X, 
  Users, 
  UserCheck, 
  UserX, 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  Trash2, 
  RefreshCw, 
  Loader2, 
  AlertCircle, 
  Check, 
  Clock, 
  KeyRound, 
  Sparkles, 
  Copy, 
  Plus, 
  Calendar,
  Lock,
  Unlock,
  Search,
  UserCheck2,
  Phone,
  MessageCircle
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { authService } from '../services/authService';
import { UserAdminView, UserStatus, InviteCode } from '../types';

interface UserManagementPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'pending' | 'all_users' | 'invites';
}

export const UserManagementPanel: React.FC<UserManagementPanelProps> = ({ 
  isOpen, 
  onClose,
  initialTab = 'pending'
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'pending' | 'all_users' | 'invites'>(initialTab);
  
  // Data states
  const [users, setUsers] = useState<UserAdminView[]>([]);
  const [invites, setInvites] = useState<InviteCode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  
  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'blocked'>('all');
  
  // Invite Generator state
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [customPrefix, setCustomPrefix] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Notifications
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchAllData = async () => {
    if (!user || user.role !== 'admin') return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [usersData, invitesData] = await Promise.all([
        authService.listUsers(user.id).catch(() => []),
        authService.listInviteCodes(user.id).catch(() => [])
      ]);
      setUsers(usersData);
      setInvites(invitesData);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao carregar dados de usuários e convites.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAllData();
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const showNotification = (successMsg?: string, errorMsg?: string) => {
    if (successMsg) {
      setSuccessMessage(successMsg);
      setTimeout(() => setSuccessMessage(null), 4000);
    }
    if (errorMsg) {
      setErrorMessage(errorMsg);
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  // User Actions
  const handleApproveUser = async (targetUser: UserAdminView) => {
    if (!user) return;
    setActionLoadingId(targetUser.id);
    try {
      await authService.updateUserStatus(user.id, targetUser.id, 'active');
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, status: 'active' } : u))
      );
      showNotification(`Usuário "${targetUser.name}" aprovado com sucesso! Acesso liberado.`);
    } catch (err: any) {
      showNotification(undefined, err.message || 'Erro ao aprovar usuário.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleBlockUser = async (targetUser: UserAdminView) => {
    if (!user) return;
    const nextStatus: UserStatus = targetUser.status === 'blocked' ? 'active' : 'blocked';
    const actionLabel = nextStatus === 'blocked' ? 'bloquear' : 'desbloquear';
    
    if (targetUser.id === user.id) {
      showNotification(undefined, 'Você não pode bloquear sua própria conta de administrador.');
      return;
    }

    if (!window.confirm(`Deseja realmente ${actionLabel} o acesso de "${targetUser.name}"?`)) return;

    setActionLoadingId(targetUser.id);
    try {
      await authService.updateUserStatus(user.id, targetUser.id, nextStatus);
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, status: nextStatus } : u))
      );
      showNotification(`Usuário "${targetUser.name}" foi ${nextStatus === 'blocked' ? 'bloqueado' : 'desbloqueado'}.`);
    } catch (err: any) {
      showNotification(undefined, err.message || 'Erro ao alterar status do usuário.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteUser = async (targetUser: UserAdminView) => {
    if (!user) return;
    if (targetUser.id === user.id) {
      showNotification(undefined, 'Você não pode excluir sua própria conta de administrador.');
      return;
    }

    const isPending = targetUser.status === 'pending';
    const confirmMsg = isPending
      ? `Rejeitar e excluir o cadastro pendente de "${targetUser.name}"?`
      : `ATENÇÃO: Deseja realmente excluir permanentemente o usuário "${targetUser.name}"? Esta ação não pode ser desfeita.`;

    if (!window.confirm(confirmMsg)) return;

    setActionLoadingId(targetUser.id);
    try {
      await authService.deleteUser(user.id, targetUser.id);
      setUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
      showNotification(`Usuário "${targetUser.name}" foi removido do sistema.`);
    } catch (err: any) {
      showNotification(undefined, err.message || 'Erro ao excluir usuário.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Invite Actions
  const handleGenerateInvite = async () => {
    if (!user) return;
    setIsGeneratingInvite(true);
    try {
      const customCode = customPrefix.trim() ? customPrefix.trim().toUpperCase() : undefined;
      const newInvite = await authService.createInviteCode(user.id, customCode);
      setCustomPrefix('');
      setInvites((prev) => [newInvite, ...prev]);
      showNotification(`Código de convite "${newInvite.code}" gerado com sucesso!`);
    } catch (err: any) {
      showNotification(undefined, err.message || 'Erro ao gerar código de convite.');
    } finally {
      setIsGeneratingInvite(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleRevokeInvite = async (code: string) => {
    if (!user) return;
    if (!window.confirm(`Deseja revogar o código ${code}?`)) return;
    try {
      await authService.revokeInviteCode(user.id, code);
      setInvites((prev) =>
        prev.map((i) => (i.code === code ? { ...i, is_active: 0 } : i))
      );
      showNotification(`Código "${code}" revogado.`);
    } catch (err: any) {
      showNotification(undefined, err.message || 'Erro ao revogar código.');
    }
  };

  if (!isOpen || !user) return null;

  const pendingUsers = users.filter((u) => u.status === 'pending');
  const activeUsers = users.filter((u) => u.status === 'active');
  const blockedUsers = users.filter((u) => u.status === 'blocked');

  const filteredAllUsers = users.filter((u) => {
    const matchesSearch = 
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#141414] border border-[#303030] rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#262626] flex items-center justify-between bg-[#1A1A1A]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#FF7A00]/15 text-[#FF7A00] border border-[#FF7A00]/30 rounded-xl">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Painel de Gestão & Aprovações
                </h2>
                <span className="text-[10px] bg-[#FF7A00]/20 text-[#FF7A00] px-2 py-0.5 rounded-full border border-[#FF7A00]/30 font-semibold flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Admin
                </span>
              </div>
              <p className="text-xs text-[#888888]">
                Gerencie permissões, libere novos corretores e controle códigos de convite
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchAllData}
              disabled={isLoading}
              title="Recarregar dados"
              className="p-2 text-[#888888] hover:text-white hover:bg-[#2A2A2A] rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-[#888888] hover:text-white hover:bg-[#2A2A2A] rounded-lg transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation Header */}
        <div className="bg-[#111111] px-4 sm:px-6 pt-3 border-b border-[#262626] flex items-center gap-2 sm:gap-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('pending')}
            className={`pb-3 px-2 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'pending'
                ? 'border-[#FF7A00] text-[#FF7A00]'
                : 'border-transparent text-[#888888] hover:text-[#DDDDDD]'
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>Aprovações Pendentes</span>
            {pendingUsers.length > 0 && (
              <span className="bg-[#EF4444] text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full animate-pulse">
                {pendingUsers.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('all_users')}
            className={`pb-3 px-2 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'all_users'
                ? 'border-[#FF7A00] text-[#FF7A00]'
                : 'border-transparent text-[#888888] hover:text-[#DDDDDD]'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Todos os Usuários</span>
            <span className="text-[10px] bg-[#262626] text-[#BDBDBD] px-1.5 py-0.2 rounded-md font-mono">
              {users.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('invites')}
            className={`pb-3 px-2 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'invites'
                ? 'border-[#FF7A00] text-[#FF7A00]'
                : 'border-transparent text-[#888888] hover:text-[#DDDDDD]'
            }`}
          >
            <KeyRound className="h-4 w-4" />
            <span>Códigos de Convite</span>
            <span className="text-[10px] bg-[#262626] text-[#BDBDBD] px-1.5 py-0.2 rounded-md font-mono">
              {invites.filter((i) => i.is_active === 1 && !i.used_by).length}
            </span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
          {/* Notification Alerts */}
          {errorMessage && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-xs rounded-xl p-3.5 flex items-center gap-2.5 animate-fadeIn">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-xs rounded-xl p-3.5 flex items-center gap-2.5 animate-fadeIn">
              <Check className="h-4 w-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#181818] border border-[#2A2A2A] p-3 rounded-xl">
              <p className="text-[10px] text-[#888888] uppercase font-bold tracking-wider">Aguardando Aprovação</p>
              <p className="text-xl font-black text-[#F59E0B] mt-0.5">{pendingUsers.length}</p>
            </div>
            <div className="bg-[#181818] border border-[#2A2A2A] p-3 rounded-xl">
              <p className="text-[10px] text-[#888888] uppercase font-bold tracking-wider">Usuários Ativos</p>
              <p className="text-xl font-black text-[#10B981] mt-0.5">{activeUsers.length}</p>
            </div>
            <div className="bg-[#181818] border border-[#2A2A2A] p-3 rounded-xl">
              <p className="text-[10px] text-[#888888] uppercase font-bold tracking-wider">Bloqueados</p>
              <p className="text-xl font-black text-[#EF4444] mt-0.5">{blockedUsers.length}</p>
            </div>
            <div className="bg-[#181818] border border-[#2A2A2A] p-3 rounded-xl">
              <p className="text-[10px] text-[#888888] uppercase font-bold tracking-wider">Total Cadastrados</p>
              <p className="text-xl font-black text-white mt-0.5">{users.length}</p>
            </div>
          </div>

          {/* TAB 1: PENDING APPROVALS */}
          {activeTab === 'pending' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-[#F59E0B]" />
                    Contas Aguardando Liberação do Administrador
                  </h3>
                  <p className="text-xs text-[#888888]">
                    Novos corretores que se cadastraram e precisam da sua autorização para acessar o CRM
                  </p>
                </div>
              </div>

              {isLoading && users.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#888888] flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-[#FF7A00]" />
                  <span>Carregando solicitações pendentes...</span>
                </div>
              ) : pendingUsers.length === 0 ? (
                <div className="bg-[#181818] border border-[#262626] rounded-xl p-8 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-[#10B981]/15 text-[#10B981] flex items-center justify-center mx-auto">
                    <UserCheck2 className="h-5 w-5" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Nenhum usuário pendente no momento</h4>
                  <p className="text-xs text-[#888888] max-w-sm mx-auto">
                    Todas as contas criadas foram revisadas ou não há novos cadastros pendentes de aprovação.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {pendingUsers.map((pendingUser) => (
                    <div
                      key={pendingUser.id}
                      className="bg-[#1C1812] border border-[#F59E0B]/30 hover:border-[#F59E0B]/60 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-all shadow-sm"
                    >
                      <div className="flex items-start sm:items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30 flex items-center justify-center font-bold text-sm shrink-0">
                          {pendingUser.name ? pendingUser.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-white truncate">{pendingUser.name}</p>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F59E0B]/20 text-[#FCD34D] border border-[#F59E0B]/40 flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" />
                              Pendente
                            </span>
                            <span className="text-[10px] text-[#888888] bg-black/40 px-2 py-0.5 rounded border border-[#333333]">
                              {pendingUser.role === 'admin' ? 'Admin' : 'Corretor'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-[#CCCCCC] truncate mt-1 flex-wrap">
                            <span>{pendingUser.email}</span>
                            {pendingUser.phone && (
                              <span className="flex items-center gap-1 text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded border border-[#10B981]/20">
                                <Phone className="h-3 w-3" />
                                {pendingUser.phone}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-[#888888] mt-1 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Cadastrado em: {new Date(pendingUser.created_at).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        {pendingUser.phone && (
                          <a
                            href={`https://wa.me/55${pendingUser.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#25D366] border border-[#25D366]/30 text-xs font-bold py-2 px-3 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                            title="Conversar com o corretor no WhatsApp"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">WhatsApp</span>
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => handleApproveUser(pendingUser)}
                          disabled={actionLoadingId === pendingUser.id}
                          className="bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold py-2 px-3.5 rounded-xl shadow-md flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                        >
                          {actionLoadingId === pendingUser.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <UserCheck className="h-3.5 w-3.5" />
                          )}
                          <span>Aprovar Acesso</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteUser(pendingUser)}
                          disabled={actionLoadingId === pendingUser.id}
                          className="bg-[#EF4444]/15 hover:bg-[#EF4444]/25 text-[#EF4444] border border-[#EF4444]/30 text-xs font-bold py-2 px-3 rounded-xl transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1"
                        >
                          <UserX className="h-3.5 w-3.5" />
                          <span>Rejeitar</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ALL USERS DIRECTORY */}
          {activeTab === 'all_users' && (
            <div className="space-y-3">
              {/* Search & Filter bar */}
              <div className="flex flex-col sm:flex-row gap-2.5 justify-between">
                <div className="relative flex-1">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]" />
                  <input
                    type="text"
                    placeholder="Buscar por nome ou e-mail..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-[#1A1A1A] border border-[#303030] focus:border-[#FF7A00] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-[#666666] outline-none"
                  />
                </div>

                <div className="flex items-center gap-1 bg-[#1A1A1A] p-1 rounded-xl border border-[#303030] shrink-0 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                      statusFilter === 'all' ? 'bg-[#333333] text-white' : 'text-[#888888] hover:text-white'
                    }`}
                  >
                    Todos ({users.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('active')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                      statusFilter === 'active' ? 'bg-emerald-500/20 text-[#34D399]' : 'text-[#888888] hover:text-white'
                    }`}
                  >
                    Ativos ({activeUsers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('pending')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                      statusFilter === 'pending' ? 'bg-amber-500/20 text-[#FBBF24]' : 'text-[#888888] hover:text-white'
                    }`}
                  >
                    Pendentes ({pendingUsers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('blocked')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                      statusFilter === 'blocked' ? 'bg-rose-500/20 text-[#F87171]' : 'text-[#888888] hover:text-white'
                    }`}
                  >
                    Bloqueados ({blockedUsers.length})
                  </button>
                </div>
              </div>

              {/* Users List Table/Cards */}
              {isLoading && users.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#888888] flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-[#FF7A00]" />
                  <span>Carregando usuários...</span>
                </div>
              ) : filteredAllUsers.length === 0 ? (
                <div className="bg-[#181818] border border-[#262626] rounded-xl p-8 text-center text-xs text-[#888888]">
                  Nenhum usuário encontrado com os filtros selecionados.
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredAllUsers.map((itemUser) => {
                    const isSelf = itemUser.id === user.id;
                    const isPending = itemUser.status === 'pending';
                    const isBlocked = itemUser.status === 'blocked';
                    const isActive = itemUser.status === 'active';

                    return (
                      <div
                        key={itemUser.id}
                        className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                          isBlocked
                            ? 'bg-[#181212] border-[#EF4444]/25'
                            : isPending
                            ? 'bg-[#1A1610] border-[#F59E0B]/25'
                            : 'bg-[#181818] border-[#2A2A2A] hover:border-[#383838]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border ${
                            itemUser.role === 'admin'
                              ? 'bg-[#FF7A00]/20 text-[#FF7A00] border-[#FF7A00]/30'
                              : 'bg-[#262626] text-[#CCCCCC] border-[#333333]'
                          }`}>
                            {itemUser.name ? itemUser.name.charAt(0).toUpperCase() : 'U'}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-xs font-bold text-white truncate">
                                {itemUser.name}
                                {isSelf && <span className="text-[10px] text-[#FF7A00] ml-1.5 font-normal">(Você)</span>}
                              </p>

                              {/* Status Badge */}
                              {isActive && (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-[#10B981]/15 text-[#34D399] border border-[#10B981]/30">
                                  Ativo
                                </span>
                              )}
                              {isPending && (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-[#F59E0B]/15 text-[#FCD34D] border border-[#F59E0B]/30 flex items-center gap-0.5">
                                  <Clock className="h-2.5 w-2.5" />
                                  Pendente
                                </span>
                              )}
                              {isBlocked && (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-[#EF4444]/15 text-[#FCA5A5] border border-[#EF4444]/30 flex items-center gap-0.5">
                                  <Lock className="h-2.5 w-2.5" />
                                  Bloqueado
                                </span>
                              )}

                              {/* Role Badge */}
                              <span className="text-[9px] text-[#888888] bg-black/40 px-1.5 py-0.2 rounded border border-[#333333]">
                                {itemUser.role === 'admin' ? 'Administrador' : 'Corretor'}
                              </span>
                            </div>

                            <div className="flex items-center gap-2.5 text-[11px] text-[#999999] truncate mt-0.5 flex-wrap">
                              <span>{itemUser.email}</span>
                              {itemUser.phone && (
                                <span className="flex items-center gap-1 text-[#10B981] bg-[#10B981]/10 px-1.5 py-0.2 rounded border border-[#10B981]/20 font-mono text-[10px]">
                                  <Phone className="h-2.5 w-2.5" />
                                  {itemUser.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                          {itemUser.phone && (
                            <a
                              href={`https://wa.me/55${itemUser.phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 border border-[#25D366]/30 rounded-lg transition-all cursor-pointer flex items-center justify-center"
                              title="Conversar no WhatsApp"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </a>
                          )}

                          {isPending && (
                            <button
                              type="button"
                              onClick={() => handleApproveUser(itemUser)}
                              disabled={actionLoadingId === itemUser.id}
                              title="Aprovar Acesso"
                              className="px-2.5 py-1.5 bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <UserCheck className="h-3 w-3" />
                              <span>Aprovar</span>
                            </button>
                          )}

                          {!isSelf && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleToggleBlockUser(itemUser)}
                                disabled={actionLoadingId === itemUser.id}
                                title={isBlocked ? 'Desbloquear Usuário' : 'Bloquear Usuário'}
                                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                  isBlocked
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                    : 'bg-[#222222] text-[#888888] border-[#333333] hover:text-[#EF4444] hover:bg-[#EF4444]/10'
                                }`}
                              >
                                {isBlocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteUser(itemUser)}
                                disabled={actionLoadingId === itemUser.id}
                                title="Excluir Usuário Permanentemente"
                                className="p-1.5 bg-[#222222] text-[#888888] hover:text-[#EF4444] hover:bg-[#EF4444]/15 border border-[#333333] rounded-lg transition-all cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: INVITE CODES */}
          {activeTab === 'invites' && (
            <div className="space-y-4">
              {/* Generator Box */}
              <div className="bg-[#1E1710] border border-[#FF7A00]/30 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-[#FF7A00]" />
                    Gerar Novo Código de Convite da Equipe
                  </h3>
                  <span className="text-[10px] text-[#FF9800]">Acesso Restrito</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Código customizado (opcional, ex: EQUIPE-ALPHA)"
                    value={customPrefix}
                    onChange={(e) => setCustomPrefix(e.target.value.toUpperCase())}
                    className="bg-[#0B0B0B] border border-[#FF7A00]/40 rounded-lg px-3 py-2 text-xs text-white uppercase font-mono flex-1 placeholder-[#666666] outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateInvite}
                    disabled={isGeneratingInvite}
                    className="bg-[#FF7A00] hover:bg-[#FF9800] text-white font-bold text-xs py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20 cursor-pointer disabled:opacity-50 transition-all"
                  >
                    {isGeneratingInvite ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Gerando...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        <span>Gerar Convite</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Invites List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#E5E5E5] flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-[#888888]" />
                  Convites Emitidos
                </h4>

                {invites.length === 0 ? (
                  <div className="bg-[#181818] border border-[#262626] rounded-xl p-6 text-center text-xs text-[#888888]">
                    Nenhum código de convite emitido. Clique acima para criar um convite.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {invites.map((inv) => {
                      const isAvailable = inv.is_active === 1 && !inv.used_by;
                      return (
                        <div
                          key={inv.code}
                          className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all ${
                            isAvailable
                              ? 'bg-[#141A14] border-[#10B981]/30 hover:border-[#10B981]/60'
                              : 'bg-[#161616] border-[#262626] opacity-75'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="font-mono text-xs font-bold text-white bg-black/40 px-2.5 py-1 rounded-lg border border-[#333333] tracking-wider select-all">
                              {inv.code}
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                {isAvailable ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-[#10B981] font-semibold bg-[#10B981]/15 px-2 py-0.5 rounded-md">
                                    <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] animate-ping" />
                                    Disponível
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-[#888888] bg-[#222222] px-2 py-0.5 rounded-md font-medium">
                                    Utilizado
                                  </span>
                                )}
                                <span className="text-[10px] text-[#666666]">
                                  {new Date(inv.created_at).toLocaleDateString('pt-BR')}
                                </span>
                              </div>

                              {inv.used_by_name && (
                                <p className="text-[11px] text-[#CCCCCC] mt-0.5 truncate">
                                  Usado por: <strong className="text-white">{inv.used_by_name}</strong> ({inv.used_by_email})
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                            <button
                              type="button"
                              onClick={() => handleCopyCode(inv.code)}
                              title="Copiar Código"
                              className="px-2.5 py-1.5 bg-[#222222] hover:bg-[#333333] text-white text-[11px] font-medium rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                            >
                              {copiedCode === inv.code ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-[#10B981]" />
                                  <span className="text-[#10B981]">Copiado!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5 text-[#888888]" />
                                  <span>Copiar</span>
                                </>
                              )}
                            </button>

                            {isAvailable && (
                              <button
                                type="button"
                                onClick={() => handleRevokeInvite(inv.code)}
                                title="Revogar Código"
                                className="p-1.5 text-[#888888] hover:text-[#EF4444] hover:bg-[#EF4444]/10 rounded-lg transition-all cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#262626] bg-[#171717] flex items-center justify-between">
          <p className="text-[11px] text-[#777777]">
            Status: <strong className="text-[#10B981]">Online</strong> &bull; Cloudflare D1
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#262626] hover:bg-[#333333] text-xs font-bold text-white rounded-xl transition-all cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

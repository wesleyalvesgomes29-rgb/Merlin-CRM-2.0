import React, { useState, useEffect } from 'react';
import { 
  X, 
  KeyRound, 
  Plus, 
  Copy, 
  Check, 
  Loader2, 
  ShieldCheck, 
  AlertCircle, 
  Trash2,
  RefreshCw,
  Sparkles,
  Users
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { authService } from '../services/authService';
import { InviteCode } from '../types';

interface AdminInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminInviteModal: React.FC<AdminInviteModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [invites, setInvites] = useState<InviteCode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [customPrefix, setCustomPrefix] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchInvites = async () => {
    if (!user || user.role !== 'admin') return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await authService.listInviteCodes(user.id);
      setInvites(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao carregar convites.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchInvites();
    }
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const handleGenerateInvite = async () => {
    setIsGenerating(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const customCode = customPrefix.trim() ? customPrefix.trim().toUpperCase() : undefined;
      const newInvite = await authService.createInviteCode(user.id, customCode);
      setCustomPrefix('');
      setSuccessMessage(`Código ${newInvite.code} gerado com sucesso!`);
      await fetchInvites();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao gerar código de convite.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => {
      setCopiedCode(null);
    }, 2500);
  };

  const handleRevoke = async (code: string) => {
    if (!window.confirm(`Deseja realmente revogar o código ${code}?`)) return;
    try {
      await authService.revokeInviteCode(user.id, code);
      await fetchInvites();
      setSuccessMessage(`Código ${code} revogado.`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao revogar código.');
    }
  };

  const activeCount = invites.filter(i => i.is_active === 1 && !i.used_by).length;
  const usedCount = invites.filter(i => i.used_by).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#161616] border border-[#303030] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-[#262626] flex items-center justify-between bg-[#1A1A1A]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#FF7A00]/15 text-[#FF7A00] border border-[#FF7A00]/30 rounded-xl">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Gestão de Códigos de Convite
                <span className="text-[10px] bg-[#FF7A00]/20 text-[#FF7A00] px-2 py-0.5 rounded-full border border-[#FF7A00]/30">
                  Admin
                </span>
              </h2>
              <p className="text-xs text-[#888888]">
                Cadastre e gerencie o acesso exclusivo de corretores da sua equipe ao Merlin CRM
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#888888] hover:text-white hover:bg-[#2A2A2A] rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          {/* Status alerts */}
          {errorMessage && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-xs rounded-xl p-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-xs rounded-xl p-3 flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-[#111111] border border-[#262626] p-3 rounded-xl">
              <p className="text-[10px] text-[#888888] uppercase font-bold tracking-wider">Convites Ativos</p>
              <p className="text-lg font-bold text-[#10B981] mt-0.5">{activeCount}</p>
            </div>
            <div className="bg-[#111111] border border-[#262626] p-3 rounded-xl">
              <p className="text-[10px] text-[#888888] uppercase font-bold tracking-wider">Membros Cadastrados</p>
              <p className="text-lg font-bold text-[#FF7A00] mt-0.5">{usedCount}</p>
            </div>
            <div className="bg-[#111111] border border-[#262626] p-3 rounded-xl col-span-2 sm:col-span-1">
              <p className="text-[10px] text-[#888888] uppercase font-bold tracking-wider">Total Gerados</p>
              <p className="text-lg font-bold text-white mt-0.5">{invites.length}</p>
            </div>
          </div>

          {/* Generator Box */}
          <div className="bg-[#1E1710] border border-[#FF7A00]/30 p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[#FF7A00]" />
                Gerar Novo Código de Convite
              </h3>
              <span className="text-[10px] text-[#FF9800]">Acesso Imediato</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Código customizado (opcional)"
                value={customPrefix}
                onChange={(e) => setCustomPrefix(e.target.value.toUpperCase())}
                className="bg-[#0B0B0B] border border-[#FF7A00]/40 rounded-lg px-3 py-2 text-xs text-white uppercase font-mono flex-1 placeholder-[#666666] outline-none"
              />
              <button
                type="button"
                onClick={handleGenerateInvite}
                disabled={isGenerating}
                className="bg-[#FF7A00] hover:bg-[#FF9800] text-white font-bold text-xs py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20 cursor-pointer disabled:opacity-50 transition-all"
              >
                {isGenerating ? (
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

          {/* Invite Codes List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#E5E5E5] flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-[#888888]" />
                Lista de Convites Emitidos
              </h3>
              <button
                onClick={fetchInvites}
                disabled={isLoading}
                title="Atualizar lista"
                className="text-xs text-[#888888] hover:text-white p-1 rounded transition-colors cursor-pointer flex items-center gap-1"
              >
                <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Atualizar</span>
              </button>
            </div>

            {isLoading && invites.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#888888] flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-[#FF7A00]" />
                <span>Carregando convites...</span>
              </div>
            ) : invites.length === 0 ? (
              <div className="bg-[#111111] border border-[#262626] rounded-xl p-6 text-center text-xs text-[#888888]">
                Nenhum código de convite gerado ainda. Clique no botão acima para gerar o primeiro.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {invites.map((inv) => {
                  const isAvailable = inv.is_active === 1 && !inv.used_by;
                  return (
                    <div
                      key={inv.code}
                      className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all ${
                        isAvailable
                          ? 'bg-[#141A14] border-[#10B981]/30 hover:border-[#10B981]/60'
                          : 'bg-[#141414] border-[#262626] opacity-75'
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
                            onClick={() => handleRevoke(inv.code)}
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

        {/* Footer */}
        <div className="p-4 border-t border-[#262626] bg-[#141414] flex justify-end">
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

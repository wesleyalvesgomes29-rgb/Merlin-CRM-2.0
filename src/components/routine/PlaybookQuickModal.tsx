import React, { useState, useEffect } from 'react';
import { Client, Task } from '../../types';
import { SALES_PLAYBOOK_PILLARS, PlaybookPillarId } from '../../lib/salesPlaybook';
import { 
  X, 
  MessageSquare, 
  Sparkles, 
  Copy, 
  Check, 
  Send, 
  User, 
  Building2, 
  Flame, 
  Clock, 
  HelpCircle,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Zap,
  Phone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PlaybookQuickModalProps {
  isOpen: boolean;
  onClose: () => void;
  client?: Client;
  task?: Task;
  defaultBrokerName?: string;
  defaultCompanyName?: string;
}

export default function PlaybookQuickModal({
  isOpen,
  onClose,
  client,
  task,
  defaultBrokerName = 'Wesley',
  defaultCompanyName = 'INC Empreendimentos'
}: PlaybookQuickModalProps) {
  // Infer best initial pillar
  const initialPillarId: PlaybookPillarId = React.useMemo(() => {
    if (!client) return 'primeiro-contato';
    if (client.status === 'Lead Novo') return 'primeiro-contato';
    if (client.status === 'Contato' || client.status === 'Retrabalho') return 'retrabalho';
    if (client.status === 'Agendado' || client.status === 'Visitou') return 'retrabalho';
    if (client.status === 'Documentação') return 'pre-analise-docs';
    return 'primeiro-contato';
  }, [client]);

  const [selectedPillarId, setSelectedPillarId] = useState<PlaybookPillarId>(initialPillarId);
  const [selectedScriptIndex, setSelectedScriptIndex] = useState<number>(0);
  const [messageText, setMessageText] = useState<string>('');
  const [brokerName, setBrokerName] = useState<string>(defaultBrokerName);
  const [companyName, setCompanyName] = useState<string>(defaultCompanyName);
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [aiGeneratedOptions, setAiGeneratedOptions] = useState<string[]>([]);
  const [customObjection, setCustomObjection] = useState<string>('');

  // Load broker data from storage if available
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('merlin_auth_user');
      if (storedUser) {
        const u = JSON.parse(storedUser);
        if (u.name) setBrokerName(u.name.split(' ')[0]);
      }
    } catch {
      // fallback
    }
  }, []);

  // Update selected pillar when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedPillarId(initialPillarId);
      setSelectedScriptIndex(0);
      setAiGeneratedOptions([]);
    }
  }, [isOpen, initialPillarId]);

  const selectedPillar = SALES_PLAYBOOK_PILLARS.find(p => p.id === selectedPillarId) || SALES_PLAYBOOK_PILLARS[0];

  // Populate message text based on selected pillar/template
  useEffect(() => {
    if (!selectedPillar) return;
    const script = selectedPillar.standardScripts[selectedScriptIndex] || selectedPillar.standardScripts[0];
    if (script) {
      let t = script.template;
      const cName = client?.name ? client.name.split(' ')[0] : 'amigo(a)';
      const emp = client?.empreendimento || 'nossos empreendimentos';
      
      t = t.replace(/{NOME}/g, cName)
           .replace(/{CORRETOR}/g, brokerName || 'seu consultor')
           .replace(/{EMPREENDIMENTO}/g, emp)
           .replace(/INC Empreendimentos/g, companyName || 'nossa imobiliária');
      
      setMessageText(t);
    }
  }, [selectedPillar, selectedScriptIndex, client, brokerName, companyName]);

  // AI Message Generation using dynamic Gemini Playbook API
  const handleGenerateWithAi = async () => {
    if (!client) return;
    setIsGeneratingAi(true);
    try {
      const res = await fetch('/api/gemini/generate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client.id,
          pillar: selectedPillarId,
          customObjection: customObjection || undefined,
          brokerName: brokerName.trim() || undefined,
          companyName: companyName.trim() || undefined,
          client: {
            name: client.name,
            phone: client.phone,
            status: client.status,
            empreendimento: client.empreendimento,
            tags: client.tags,
            notes: client.notes,
            comments: client.comments?.map(c => c.text),
            secondBrainSummary: client.secondBrainSummary
          }
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.options && Array.isArray(data.options) && data.options.length > 0) {
          setAiGeneratedOptions(data.options);
          setMessageText(data.options[0]);
        } else if (data.message) {
          setMessageText(data.message);
        }
      }
    } catch (err) {
      console.warn('[PlaybookQuickModal] AI error, keeping standard template:', err);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleCopy = () => {
    if (!messageText) return;
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendWhatsApp = () => {
    if (!client?.phone) {
      alert('Cliente sem telefone cadastrado.');
      return;
    }
    const cleanPhone = client.phone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
    const textEncoded = encodeURIComponent(messageText);
    window.open(`https://wa.me/${phoneWithCountry}?text=${textEncoded}`, '_blank');
    onClose();
  };

  if (!isOpen || !client) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-xs overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          transition={{ type: 'spring', damping: 26, stiffness: 280 }}
          className="bg-[#141414] border border-[#2D2D2D] rounded-t-3xl sm:rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
          onClick={(e) => e.stopPropagation()}
          id="playbook-quick-modal"
        >
          {/* Mobile Drag Handle */}
          <div className="pt-2.5 pb-1 sm:hidden flex justify-center bg-[#191919]">
            <div className="w-12 h-1.5 bg-[#383838] rounded-full" />
          </div>

          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-[#282828] flex items-center justify-between bg-[#191919]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-white text-base sm:text-lg">Script WhatsApp Comercial</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FF7A00]/15 text-[#FF7A00] border border-[#FF7A00]/30">
                    Playbook Merlin
                  </span>
                </div>
                <p className="text-xs text-[#888888]">
                  Lead: <span className="text-white font-medium">{client.name}</span> ({client.phone || 'Sem telefone'})
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#888888] hover:text-white hover:bg-[#222222] transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
            {/* Context & Personalization Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[#1A1A1A] p-2.5 rounded-xl border border-[#262626] text-xs">
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-[#FF7A00]" />
                <span className="text-[#888888]">Consultor:</span>
                <input
                  type="text"
                  value={brokerName}
                  onChange={(e) => setBrokerName(e.target.value)}
                  className="bg-[#242424] border border-[#333333] rounded px-2 py-1 text-white font-medium text-xs focus:outline-none focus:border-[#FF7A00] w-full"
                  placeholder="Nome do Corretor"
                />
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-[#FF7A00]" />
                <span className="text-[#888888]">Empresa:</span>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="bg-[#242424] border border-[#333333] rounded px-2 py-1 text-white font-medium text-xs focus:outline-none focus:border-[#FF7A00] w-full"
                  placeholder="Empresa / Imobiliária"
                />
              </div>
            </div>

            {/* Pillar Selector Tabs */}
            <div>
              <label className="block text-[11px] font-bold text-[#888888] uppercase tracking-wider mb-2">
                Selecione o Pilar do Script:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {SALES_PLAYBOOK_PILLARS.map(p => {
                  const isActive = selectedPillarId === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedPillarId(p.id);
                        setSelectedScriptIndex(0);
                        setAiGeneratedOptions([]);
                      }}
                      className={`text-left p-2 rounded-xl border transition-all text-xs font-semibold flex items-center justify-between cursor-pointer ${
                        isActive
                          ? 'bg-[#FF7A00]/15 text-[#FF7A00] border-[#FF7A00]/50 shadow-xs'
                          : 'bg-[#181818] text-[#AAAAAA] border-[#2A2A2A] hover:text-white hover:bg-[#202020]'
                      }`}
                    >
                      <span className="truncate">{p.shortTitle}</span>
                      {isActive && <Check className="h-3.5 w-3.5 text-[#FF7A00] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Golden Rule banner */}
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-3 text-xs flex items-start gap-2.5 text-amber-200">
              <Zap className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-400">Regra de Ouro: </span>
                <span>{selectedPillar.goldenRule}</span>
              </div>
            </div>

            {/* AI Generation trigger */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-white">Mensagem Formatada:</span>
              <button
                onClick={handleGenerateWithAi}
                disabled={isGeneratingAi}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#FF7A00]/15 text-[#FF7A00] hover:bg-[#FF7A00]/25 border border-[#FF7A00]/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {isGeneratingAi ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Ajustando com IA...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Personalizar com IA (Gemini)</span>
                  </>
                )}
              </button>
            </div>

            {/* AI Generated alternatives if available */}
            {aiGeneratedOptions.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <span className="text-[10px] text-[#888888] font-bold uppercase shrink-0">Opções da IA:</span>
                {aiGeneratedOptions.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => setMessageText(opt)}
                    className={`text-xs px-2.5 py-1 rounded-lg border shrink-0 cursor-pointer font-medium transition-all ${
                      messageText === opt
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                        : 'bg-[#1C1C1C] text-[#AAAAAA] border-[#2C2C2C] hover:text-white'
                    }`}
                  >
                    Opção {idx + 1}
                  </button>
                ))}
              </div>
            )}

            {/* Message Textarea */}
            <div className="relative">
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={6}
                className="w-full bg-[#121212] border border-[#2B2B2B] rounded-xl p-3 text-sm text-white font-normal focus:outline-none focus:border-emerald-500/60 leading-relaxed resize-none"
                placeholder="Mensagem do script..."
              />
              <div className="absolute bottom-2.5 right-2.5 text-[10px] font-mono text-[#666666]">
                {messageText.length} caracteres
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:p-5 border-t border-[#282828] bg-[#191919] flex items-center justify-between gap-2 flex-wrap">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-[#262626] hover:bg-[#303030] text-white border border-[#3A3A3A] transition-all cursor-pointer active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 text-[#888888]" />
                  <span>Copiar Mensagem</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[#888888] hover:text-white hover:bg-[#252525] transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                onClick={handleSendWhatsApp}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20 transition-all cursor-pointer active:scale-95"
              >
                <Send className="h-4 w-4" />
                <span>Abrir WhatsApp</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

import React, { useState } from 'react';
import { 
  Sun, 
  Calendar, 
  Plus, 
  Trello, 
  Sparkles, 
  CheckSquare, 
  Users, 
  MessageSquare, 
  DollarSign, 
  LayoutDashboard, 
  X,
  Flame,
  Brain,
  ChevronRight,
  UserPlus,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Client, Task } from '../types';

interface MobileBottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenAddClient: () => void;
  onOpenQuickTask?: () => void;
  onOpenPlaybookWithLead?: () => void;
  todayAlertsCount?: number;
  pendingTasksCount?: number;
  urgentLeadsCount?: number;
}

export default function MobileBottomNav({
  activeTab,
  onTabChange,
  onOpenAddClient,
  onOpenQuickTask,
  onOpenPlaybookWithLead,
  todayAlertsCount = 0,
  pendingTasksCount = 0,
  urgentLeadsCount = 0
}: MobileBottomNavProps) {
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);

  const handleActionClick = (action: () => void) => {
    setIsActionSheetOpen(false);
    action();
  };

  return (
    <>
      {/* Action Sheet Backdrop & Drawer */}
      <AnimatePresence>
        {isActionSheetOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsActionSheetOpen(false)}
              className="md:hidden fixed inset-0 bg-black/75 backdrop-blur-xs z-50 cursor-pointer"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#161616] dark:bg-[#121212] border-t border-[#2A2A2A] rounded-t-3xl p-5 pb-9 shadow-2xl max-h-[85vh] overflow-y-auto"
            >
              {/* Drag Handle */}
              <div className="w-12 h-1.5 bg-[#383838] rounded-full mx-auto mb-4" />

              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-white font-display">
                    Ações Rápidas Merlin
                  </h3>
                  <p className="text-xs text-[#888888]">
                    Acelere sua rotina comercial em 1 toque
                  </p>
                </div>
                <button
                  onClick={() => setIsActionSheetOpen(false)}
                  className="p-1.5 rounded-xl bg-[#202020] text-[#888888] hover:text-white border border-[#303030]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Action Grid */}
              <div className="grid grid-cols-2 gap-2.5 mb-4">
                {/* 1. Novo Lead */}
                <button
                  onClick={() => handleActionClick(onOpenAddClient)}
                  className="p-3.5 rounded-2xl bg-gradient-to-br from-[#FF7A00]/15 to-[#FF5500]/5 border border-[#FF7A00]/40 text-left hover:border-[#FF7A00] transition-all flex flex-col justify-between group active:scale-[0.98]"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#FF7A00] text-black font-bold flex items-center justify-center mb-2 shadow-md shadow-[#FF7A00]/20">
                    <UserPlus className="h-5 w-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white group-hover:text-[#FF7A00] transition-colors">
                      Novo Lead
                    </h4>
                    <p className="text-[11px] text-[#A0A0A0] leading-tight">
                      Cadastrar cliente
                    </p>
                  </div>
                </button>

                {/* 2. Rotina / Nova Tarefa */}
                <button
                  onClick={() => handleActionClick(() => {
                    if (onOpenQuickTask) {
                      onOpenQuickTask();
                    } else {
                      onTabChange('rotina');
                    }
                  })}
                  className="p-3.5 rounded-2xl bg-[#1E1E1E] border border-[#303030] text-left hover:border-[#FF7A00]/50 transition-all flex flex-col justify-between group active:scale-[0.98]"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/15 text-[#3B82F6] border border-[#3B82F6]/30 flex items-center justify-center mb-2">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white group-hover:text-[#FF7A00] transition-colors">
                      Minha Rotina
                    </h4>
                    <p className="text-[11px] text-[#A0A0A0] leading-tight">
                      Agenda & tarefas
                    </p>
                  </div>
                </button>

                {/* 3. Assistente Merlin AI */}
                <button
                  onClick={() => handleActionClick(() => onTabChange('intelligence'))}
                  className="p-3.5 rounded-2xl bg-[#1E1E1E] border border-[#303030] text-left hover:border-[#FF7A00]/50 transition-all flex flex-col justify-between group active:scale-[0.98]"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center justify-center mb-2">
                    <Brain className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white group-hover:text-[#FF7A00] transition-colors">
                      Copiloto IA
                    </h4>
                    <p className="text-[11px] text-[#A0A0A0] leading-tight">
                      Scripts & conselhos
                    </p>
                  </div>
                </button>

                {/* 4. Lista Completa de Clientes */}
                <button
                  onClick={() => handleActionClick(() => onTabChange('clientes'))}
                  className="p-3.5 rounded-2xl bg-[#1E1E1E] border border-[#303030] text-left hover:border-[#FF7A00]/50 transition-all flex flex-col justify-between group active:scale-[0.98]"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mb-2">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white group-hover:text-[#FF7A00] transition-colors">
                      Diretório
                    </h4>
                    <p className="text-[11px] text-[#A0A0A0] leading-tight">
                      Todos os clientes
                    </p>
                  </div>
                </button>
              </div>

              {/* Secondary Navigation List */}
              <div className="space-y-1.5 border-t border-[#2A2A2A] pt-3">
                <button
                  onClick={() => handleActionClick(() => onTabChange('comissoes'))}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-[#1A1A1A] hover:bg-[#222] border border-[#2D2D2D] text-left transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400">
                      <DollarSign className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-semibold text-white">Comissões & Simulador</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#777]" />
                </button>

                <button
                  onClick={() => handleActionClick(() => onTabChange('dashboard'))}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-[#1A1A1A] hover:bg-[#222] border border-[#2D2D2D] text-left transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-sky-500/15 text-sky-400">
                      <LayoutDashboard className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-semibold text-white">Métricas & Performance</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#777]" />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* FIXED MOBILE BOTTOM NAVBAR */}
      <nav 
        id="mobile-superapp-bottom-nav"
        className="fixed bottom-0 left-0 right-0 z-40 bg-[#121212]/95 backdrop-blur-xl border-t border-[#262626] md:hidden px-3 pt-1.5 pb-[max(env(safe-area-inset-bottom),0.6rem)] shadow-2xl"
      >
        <div className="flex items-center justify-between relative max-w-lg mx-auto">
          {/* Tab 1: Meu Dia */}
          <button
            id="mobile-nav-meu-dia"
            onClick={() => onTabChange('meu_dia')}
            className={`flex flex-col items-center justify-center w-14 py-1 relative touch-target transition-all cursor-pointer ${
              activeTab === 'meu_dia' ? 'text-[#FF7A00] font-bold' : 'text-[#888888] hover:text-white'
            }`}
          >
            <div className="relative">
              <Sun className={`h-5 w-5 transition-transform ${activeTab === 'meu_dia' ? 'scale-110 stroke-[2.5]' : ''}`} />
              {todayAlertsCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-[#EF4444] text-white text-[9px] font-black h-4 min-w-4 px-1 rounded-full flex items-center justify-center border border-[#121212] shadow-xs">
                  {todayAlertsCount > 9 ? '9+' : todayAlertsCount}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-1 font-medium tracking-tight">Meu Dia</span>
            {activeTab === 'meu_dia' && (
              <motion.span 
                layoutId="mobile-nav-indicator"
                className="absolute bottom-0 w-4 h-1 rounded-full bg-[#FF7A00]" 
              />
            )}
          </button>

          {/* Tab 2: Rotina */}
          <button
            id="mobile-nav-rotina"
            onClick={() => onTabChange('rotina')}
            className={`flex flex-col items-center justify-center w-14 py-1 relative touch-target transition-all cursor-pointer ${
              activeTab === 'rotina' ? 'text-[#FF7A00] font-bold' : 'text-[#888888] hover:text-white'
            }`}
          >
            <div className="relative">
              <CheckSquare className={`h-5 w-5 transition-transform ${activeTab === 'rotina' ? 'scale-110 stroke-[2.5]' : ''}`} />
              {pendingTasksCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-[#F59E0B] text-[#121212] text-[9px] font-black h-4 min-w-4 px-1 rounded-full flex items-center justify-center border border-[#121212]">
                  {pendingTasksCount > 9 ? '9+' : pendingTasksCount}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-1 font-medium tracking-tight">Rotina</span>
            {activeTab === 'rotina' && (
              <motion.span 
                layoutId="mobile-nav-indicator"
                className="absolute bottom-0 w-4 h-1 rounded-full bg-[#FF7A00]" 
              />
            )}
          </button>

          {/* CENTRAL ELEVATED FLOATING BUTTON */}
          <div className="relative -top-4 flex items-center justify-center px-1">
            <button
              id="mobile-nav-floating-action"
              onClick={() => setIsActionSheetOpen(!isActionSheetOpen)}
              className="w-13 h-13 rounded-full bg-gradient-to-tr from-[#FF6B00] via-[#FF7A00] to-[#F97316] text-[#0A0A0A] font-black flex items-center justify-center shadow-xl shadow-[#FF6B00]/40 border-3 border-[#121212] active:scale-95 transition-all transform hover:scale-105 cursor-pointer"
              title="Nova Ação Rápida"
            >
              <Plus className={`h-6 w-6 stroke-[3] transition-transform duration-200 ${isActionSheetOpen ? 'rotate-45 text-white' : ''}`} />
            </button>
          </div>

          {/* Tab 4: Funil */}
          <button
            id="mobile-nav-funil"
            onClick={() => onTabChange('funil')}
            className={`flex flex-col items-center justify-center w-14 py-1 relative touch-target transition-all cursor-pointer ${
              activeTab === 'funil' ? 'text-[#FF7A00] font-bold' : 'text-[#888888] hover:text-white'
            }`}
          >
            <Trello className={`h-5 w-5 transition-transform ${activeTab === 'funil' ? 'scale-110 stroke-[2.5]' : ''}`} />
            <span className="text-[10px] mt-1 font-medium tracking-tight">Funil</span>
            {activeTab === 'funil' && (
              <motion.span 
                layoutId="mobile-nav-indicator"
                className="absolute bottom-0 w-4 h-1 rounded-full bg-[#FF7A00]" 
              />
            )}
          </button>

          {/* Tab 5: Copiloto */}
          <button
            id="mobile-nav-copiloto"
            onClick={() => onTabChange('intelligence')}
            className={`flex flex-col items-center justify-center w-14 py-1 relative touch-target transition-all cursor-pointer ${
              activeTab === 'intelligence' ? 'text-[#FF7A00] font-bold' : 'text-[#888888] hover:text-white'
            }`}
          >
            <div className="relative">
              <Sparkles className={`h-5 w-5 transition-transform ${activeTab === 'intelligence' ? 'scale-110 stroke-[2.5]' : ''}`} />
            </div>
            <span className="text-[10px] mt-1 font-medium tracking-tight">Copiloto</span>
            {activeTab === 'intelligence' && (
              <motion.span 
                layoutId="mobile-nav-indicator"
                className="absolute bottom-0 w-4 h-1 rounded-full bg-[#FF7A00]" 
              />
            )}
          </button>
        </div>
      </nav>
    </>
  );
}

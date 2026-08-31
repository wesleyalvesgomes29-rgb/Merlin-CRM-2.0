import React, { useState, useEffect } from 'react';
import { LogOut, User as UserIcon, KeyRound, Shield, Calendar, Users } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { UserManagementPanel } from './UserManagementPanel';
import { GoogleIntegrationModal } from '../../../components/GoogleIntegrationModal';
import { getStoredGoogleAccessToken } from '../../../lib/calendarUtils';
import { authService } from '../services/authService';

interface UserMenuProps {
  compact?: boolean;
}

export const UserMenu: React.FC<UserMenuProps> = ({ compact = false }) => {
  const { user, logout } = useAuth();
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminPanelTab, setAdminPanelTab] = useState<'pending' | 'all_users' | 'invites'>('pending');
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [hasGoogleToken, setHasGoogleToken] = useState<boolean>(() => {
    return !!(user?.isGoogleConnected || getStoredGoogleAccessToken());
  });

  const isAdmin = user?.role === 'admin';
  const isGoogleConnected = hasGoogleToken || user?.isGoogleConnected;

  // Check pending users count for admin badge
  useEffect(() => {
    if (!user || user.role !== 'admin') return;

    const checkPending = async () => {
      try {
        const usersList = await authService.listUsers(user.id);
        const pending = usersList.filter((u) => u.status === 'pending').length;
        setPendingCount(pending);
      } catch {
        // silent fail
      }
    };

    checkPending();
    const interval = setInterval(checkPending, 30000);
    return () => clearInterval(interval);
  }, [user]);

  if (!user) return null;

  if (compact) {
    return (
      <>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowGoogleModal(true)}
            title={isGoogleConnected ? 'Google Agenda Conectado (Auto Sync)' : 'Conectar Google Agenda'}
            className={`p-2 rounded-lg transition-all cursor-pointer flex items-center justify-center relative ${
              isGoogleConnected 
                ? 'bg-emerald-500/15 text-[#34D399] hover:bg-emerald-500/25' 
                : 'hover:bg-[#222222] text-[#888888] hover:text-blue-400'
            }`}
          >
            <Calendar className="h-4 w-4" />
            {isGoogleConnected && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#34D399] rounded-full animate-pulse" />
            )}
          </button>

          {isAdmin && (
            <button
              onClick={() => {
                setAdminPanelTab('pending');
                setShowAdminPanel(true);
              }}
              title="Gestão de Usuários & Aprovações"
              className="p-2 hover:bg-[#222222] text-[#FF7A00] hover:text-[#FF9800] rounded-lg transition-all cursor-pointer flex items-center justify-center relative"
            >
              <Users className="h-4 w-4" />
              {pendingCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-[#EF4444] text-white text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center border-2 border-[#111111] animate-pulse">
                  {pendingCount}
                </span>
              )}
            </button>
          )}

          <button
            onClick={logout}
            title="Sair do Merlin CRM"
            className="p-2 hover:bg-[#222222] text-[#888888] hover:text-[#EF4444] rounded-lg transition-all cursor-pointer flex items-center justify-center"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        {isAdmin && (
          <UserManagementPanel
            isOpen={showAdminPanel}
            initialTab={adminPanelTab}
            onClose={() => {
              setShowAdminPanel(false);
              // refresh pending count
              if (user) {
                authService.listUsers(user.id).then((list) => {
                  setPendingCount(list.filter((u) => u.status === 'pending').length);
                }).catch(() => {});
              }
            }}
          />
        )}

        <GoogleIntegrationModal
          isOpen={showGoogleModal}
          onClose={() => setShowGoogleModal(false)}
          onStatusChange={(status) => setHasGoogleToken(status)}
        />
      </>
    );
  }

  return (
    <>
      <div className="bg-[#1F1F1F] border border-[#303030] rounded-xl p-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-[#FF7A00]/20 text-[#FF7A00] border border-[#FF7A00]/30 flex items-center justify-center font-bold text-xs shrink-0">
              {user.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-white truncate">{user.name}</p>
                {isAdmin && (
                  <span className="text-[9px] bg-[#FF7A00]/20 text-[#FF7A00] px-1.5 py-0.2 rounded border border-[#FF7A00]/30 font-semibold flex items-center gap-0.5">
                    <Shield className="h-2.5 w-2.5" />
                    Admin
                  </span>
                )}
              </div>
              <p className="text-[10px] text-[#BDBDBD] truncate">{user.email}</p>
            </div>
          </div>

          <button
            onClick={logout}
            title="Sair da Conta"
            className="p-1.5 hover:bg-[#EF4444]/20 text-[#888888] hover:text-[#EF4444] rounded-lg transition-colors shrink-0 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        {/* Botão de Integração com Google Agenda */}
        <button
          type="button"
          onClick={() => setShowGoogleModal(true)}
          className={`w-full text-[11px] font-bold py-1.5 px-2.5 rounded-lg flex items-center justify-between gap-1.5 transition-all cursor-pointer border ${
            isGoogleConnected
              ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-[#34D399] border-emerald-500/30'
              : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/25'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            <span>Google Agenda</span>
          </div>
          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-black/40">
            {isGoogleConnected ? 'Ativo ⚡' : 'Conectar'}
          </span>
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              setAdminPanelTab(pendingCount > 0 ? 'pending' : 'all_users');
              setShowAdminPanel(true);
            }}
            className="w-full bg-[#FF7A00]/15 hover:bg-[#FF7A00]/25 text-[#FF9800] border border-[#FF7A00]/30 text-[11px] font-bold py-1.5 px-2.5 rounded-lg flex items-center justify-between gap-1.5 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              <span>Gestão de Usuários</span>
            </div>
            {pendingCount > 0 ? (
              <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-[#EF4444] text-white animate-pulse">
                {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
              </span>
            ) : (
              <span className="text-[9px] text-[#888888] font-normal">
                Painel
              </span>
            )}
          </button>
        )}
      </div>

      {isAdmin && (
        <UserManagementPanel
          isOpen={showAdminPanel}
          initialTab={adminPanelTab}
          onClose={() => {
            setShowAdminPanel(false);
            if (user) {
              authService.listUsers(user.id).then((list) => {
                setPendingCount(list.filter((u) => u.status === 'pending').length);
              }).catch(() => {});
            }
          }}
        />
      )}

      <GoogleIntegrationModal
        isOpen={showGoogleModal}
        onClose={() => setShowGoogleModal(false)}
        onStatusChange={(status) => setHasGoogleToken(status)}
      />
    </>
  );
};


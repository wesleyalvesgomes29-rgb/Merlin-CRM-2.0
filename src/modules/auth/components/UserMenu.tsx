import React, { useState } from 'react';
import { LogOut, User as UserIcon, KeyRound, Shield } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { AdminInviteModal } from './AdminInviteModal';

interface UserMenuProps {
  compact?: boolean;
}

export const UserMenu: React.FC<UserMenuProps> = ({ compact = false }) => {
  const { user, logout } = useAuth();
  const [showInviteModal, setShowInviteModal] = useState(false);

  if (!user) return null;

  const isAdmin = user.role === 'admin';

  if (compact) {
    return (
      <>
        <div className="flex items-center gap-1">
          {isAdmin && (
            <button
              onClick={() => setShowInviteModal(true)}
              title="Gerenciar Convites da Equipe"
              className="p-2 hover:bg-[#222222] text-[#FF7A00] hover:text-[#FF9800] rounded-lg transition-all cursor-pointer flex items-center justify-center"
            >
              <KeyRound className="h-4 w-4" />
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
          <AdminInviteModal
            isOpen={showInviteModal}
            onClose={() => setShowInviteModal(false)}
          />
        )}
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

        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="w-full bg-[#FF7A00]/15 hover:bg-[#FF7A00]/25 text-[#FF9800] border border-[#FF7A00]/30 text-[11px] font-bold py-1.5 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>Gerenciar Convites da Equipe</span>
          </button>
        )}
      </div>

      {isAdmin && (
        <AdminInviteModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
        />
      )}
    </>
  );
};

import React from 'react';
import { LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface UserMenuProps {
  compact?: boolean;
}

export const UserMenu: React.FC<UserMenuProps> = ({ compact = false }) => {
  const { user, logout } = useAuth();

  if (!user) return null;

  if (compact) {
    return (
      <button
        onClick={logout}
        title="Sair do Merlin CRM"
        className="p-2 hover:bg-[#222222] text-[#888888] hover:text-[#EF4444] rounded-lg transition-all cursor-pointer flex items-center justify-center"
      >
        <LogOut className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="bg-[#1F1F1F] border border-[#303030] rounded-xl p-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="h-8 w-8 rounded-lg bg-[#FF7A00]/20 text-[#FF7A00] border border-[#FF7A00]/30 flex items-center justify-center font-bold text-xs shrink-0">
          {user.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="h-4 w-4" />}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-white truncate">{user.name}</p>
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
  );
};

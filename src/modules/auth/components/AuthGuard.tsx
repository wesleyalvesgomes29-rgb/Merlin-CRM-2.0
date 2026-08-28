import React, { ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { LoginForm } from './LoginForm';
import { Sparkles, Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0B0B0B] flex flex-col items-center justify-center text-white p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 bg-[#FD7A00]/10 border border-[#FD7A00]/20 rounded-2xl shadow-inner">
            <Sparkles className="h-8 w-8 text-[#FD7A00] animate-pulse" />
          </div>
          <div className="flex items-center gap-2 text-sm text-[#888888] font-medium">
            <Loader2 className="h-4 w-4 animate-spin text-[#FD7A00]" />
            <span>Carregando Merlin CRM...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return <>{children}</>;
};

import React, { useState } from 'react';
import { Sparkles, Mail, Lock, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export const LoginForm: React.FC = () => {
  const { login, isLoading, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    await login({ email, password });
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center p-4 sm:p-6 text-white font-sans">
      <div className="w-full max-w-md space-y-8 bg-[#161616] border border-[#303030] p-6 sm:p-8 rounded-2xl shadow-2xl relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#FF7A00]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[#FF7A00]/5 rounded-full blur-3xl pointer-events-none" />

        {/* Logo and Header */}
        <div className="text-center space-y-3 relative z-10">
          <div className="inline-flex items-center justify-center p-3 bg-[#FF7A00]/10 border border-[#FF7A00]/20 rounded-2xl mb-1 shadow-inner">
            <Sparkles className="h-8 w-8 text-[#FF7A00] animate-pulse" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-display text-white">
            Merlin CRM
          </h1>
          <p className="text-xs sm:text-sm text-[#BDBDBD] max-w-xs mx-auto">
            Acesse sua conta para gerenciar seus clientes, funil e vendas imobiliárias.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-xs sm:text-sm rounded-xl p-3.5 flex items-start gap-3 animate-fadeIn">
            <AlertCircle className="h-5 w-5 text-[#EF4444] shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block mb-0.5">Erro na autenticação</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[#E5E5E5] block">
              E-mail de Acesso
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#888888]">
                <Mail className="h-4.5 w-4.5" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) clearError();
                }}
                placeholder="seu.email@corretor.com"
                className="w-full bg-[#0B0B0B] border border-[#303030] focus:border-[#FF7A00] focus:ring-1 focus:ring-[#FF7A00] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-[#666666] transition-all outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[#E5E5E5] block">
              Senha
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#888888]">
                <Lock className="h-4.5 w-4.5" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) clearError();
                }}
                placeholder="••••••••"
                className="w-full bg-[#0B0B0B] border border-[#303030] focus:border-[#FF7A00] focus:ring-1 focus:ring-[#FF7A00] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-[#666666] transition-all outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#FF7A00] hover:bg-[#FF9800] text-white font-bold text-sm py-3 px-4 rounded-xl shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Autenticando...</span>
              </>
            ) : (
              <>
                <span>Entrar no Merlin CRM</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer info */}
        <div className="text-[10px] text-[#666666] text-center pt-2">
          Merlin CRM &copy; 2026 &bull; Módulo de Autenticação v1.0
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { 
  Mail, 
  Lock, 
  User as UserIcon, 
  KeyRound, 
  ArrowRight, 
  AlertCircle, 
  Loader2, 
  ShieldCheck,
  CheckCircle2,
  Info
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import merlinLogo from '../../../assets/images/merlin_logo_transparent.png';

export const LoginForm: React.FC = () => {
  const { login, register, isLoading, error, clearError } = useAuth();
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regInviteCode, setRegInviteCode] = useState('');
  const [showInviteHint, setShowInviteHint] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) return;
    await login({ email: loginEmail, password: loginPassword });
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPassword || !regInviteCode.trim()) return;
    await register({
      name: regName,
      email: regEmail,
      password: regPassword,
      confirmPassword: regConfirmPassword,
      inviteCode: regInviteCode.toUpperCase().trim(),
    });
  };

  const handleTabSwitch = (tab: 'login' | 'register') => {
    setActiveTab(tab);
    if (error) clearError();
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center p-4 sm:p-6 text-white font-sans selection:bg-[#FF7A00]/30 selection:text-white">
      <div className="w-full max-w-md bg-[#161616] border border-[#303030] p-6 sm:p-8 rounded-2xl shadow-2xl relative overflow-hidden">
        {/* Subtle decorative glows */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#FF7A00]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[#FF7A00]/5 rounded-full blur-3xl pointer-events-none" />

        {/* Logo and Header */}
        <div className="text-center relative z-10 space-y-3">
          <div className="flex items-center justify-center">
            <img
              src={merlinLogo}
              alt="Merlin CRM"
              className="h-12 sm:h-14 w-auto max-w-[220px] object-contain select-none filter drop-shadow-sm"
              referrerPolicy="no-referrer"
            />
          </div>
          <p className="text-xs text-[#BDBDBD] max-w-xs mx-auto leading-relaxed">
            Plataforma de alta performance para corretores e imobiliárias de elite.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="mt-6 mb-6 grid grid-cols-2 bg-[#0B0B0B] p-1 rounded-xl border border-[#262626] relative z-10">
          <button
            type="button"
            id="tab-login"
            onClick={() => handleTabSwitch('login')}
            className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'login'
                ? 'bg-[#222222] text-white shadow-sm border border-[#3A3A3A]'
                : 'text-[#888888] hover:text-[#CCCCCC]'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            id="tab-register"
            onClick={() => handleTabSwitch('register')}
            className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'register'
                ? 'bg-[#FF7A00] text-white shadow-md shadow-orange-500/20'
                : 'text-[#888888] hover:text-[#CCCCCC]'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>Cadastrar com Convite</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-xs rounded-xl p-3.5 flex items-start gap-3 animate-fadeIn">
            <AlertCircle className="h-5 w-5 text-[#EF4444] shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block mb-0.5">Aviso de Autenticação</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* LOGIN VIEW */}
        {activeTab === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4 relative z-10">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#E5E5E5] block">
                E-mail de Acesso
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#888888]">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  id="login-email-input"
                  required
                  value={loginEmail}
                  onChange={(e) => {
                    setLoginEmail(e.target.value);
                    if (error) clearError();
                  }}
                  placeholder="seu.email@corretor.com"
                  className="w-full bg-[#0B0B0B] border border-[#303030] focus:border-[#FF7A00] focus:ring-1 focus:ring-[#FF7A00] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-[#555555] transition-all outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#E5E5E5] block">
                Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#888888]">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  id="login-password-input"
                  required
                  value={loginPassword}
                  onChange={(e) => {
                    setLoginPassword(e.target.value);
                    if (error) clearError();
                  }}
                  placeholder="••••••••"
                  className="w-full bg-[#0B0B0B] border border-[#303030] focus:border-[#FF7A00] focus:ring-1 focus:ring-[#FF7A00] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-[#555555] transition-all outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              id="btn-submit-login"
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
        )}

        {/* REGISTER VIEW (RESTRICTED BY INVITE CODE) */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5 relative z-10">
            {/* Invite Code Input */}
            <div className="space-y-1.5 bg-[#1F1710] border border-[#FF7A00]/30 p-3 rounded-xl">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold uppercase tracking-wider text-[#FF9800] flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-[#FF7A00]" />
                  Código de Convite Secreto *
                </label>
                <button
                  type="button"
                  onClick={() => setShowInviteHint(!showInviteHint)}
                  className="text-[10px] text-[#FF9800]/80 hover:text-[#FF9800] flex items-center gap-1 underline cursor-pointer"
                >
                  <Info className="h-3 w-3" />
                  Onde obter?
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  id="reg-invite-code-input"
                  required
                  value={regInviteCode}
                  onChange={(e) => {
                    setRegInviteCode(e.target.value.toUpperCase());
                    if (error) clearError();
                  }}
                  placeholder="Ex: MERLIN-XXXX-XXXX"
                  className="w-full bg-[#0B0B0B] border border-[#FF7A00]/40 focus:border-[#FF7A00] focus:ring-1 focus:ring-[#FF7A00] rounded-lg px-3 py-2 text-sm text-white font-mono uppercase tracking-wider placeholder-[#666666] outline-none"
                />
              </div>

              {showInviteHint && (
                <div className="text-[11px] text-[#BDBDBD] bg-[#0B0B0B] p-2.5 rounded-lg border border-[#333333] space-y-1 mt-1.5 animate-fadeIn">
                  <p>
                    🔒 O cadastro no Merlin CRM é restrito para membros convidados. Peça um código ao administrador da sua imobiliária.
                  </p>
                  <p className="text-[10px] text-[#888888]">
                    Dica: O primeiro administrador pode utilizar o código mestre inicial <strong className="text-[#FF9800] font-mono">MERLIN-ADMIN-2026</strong>.
                  </p>
                </div>
              )}
            </div>

            {/* Name */}
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-[#E5E5E5] block">
                Nome Completo
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#888888]">
                  <UserIcon className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  id="reg-name-input"
                  required
                  value={regName}
                  onChange={(e) => {
                    setRegName(e.target.value);
                    if (error) clearError();
                  }}
                  placeholder="Ex: Ana Silva Corretora"
                  className="w-full bg-[#0B0B0B] border border-[#303030] focus:border-[#FF7A00] focus:ring-1 focus:ring-[#FF7A00] rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-[#555555] transition-all outline-none"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-[#E5E5E5] block">
                E-mail Profissional
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#888888]">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  id="reg-email-input"
                  required
                  value={regEmail}
                  onChange={(e) => {
                    setRegEmail(e.target.value);
                    if (error) clearError();
                  }}
                  placeholder="seu.email@imobiliaria.com"
                  className="w-full bg-[#0B0B0B] border border-[#303030] focus:border-[#FF7A00] focus:ring-1 focus:ring-[#FF7A00] rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-[#555555] transition-all outline-none"
                />
              </div>
            </div>

            {/* Password Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-[#E5E5E5] block">
                  Senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#888888]">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type="password"
                    id="reg-password-input"
                    required
                    minLength={6}
                    value={regPassword}
                    onChange={(e) => {
                      setRegPassword(e.target.value);
                      if (error) clearError();
                    }}
                    placeholder="Mín. 6 dígitos"
                    className="w-full bg-[#0B0B0B] border border-[#303030] focus:border-[#FF7A00] focus:ring-1 focus:ring-[#FF7A00] rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-[#555555] transition-all outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-[#E5E5E5] block">
                  Confirmar
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#888888]">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <input
                    type="password"
                    id="reg-confirm-password-input"
                    required
                    minLength={6}
                    value={regConfirmPassword}
                    onChange={(e) => {
                      setRegConfirmPassword(e.target.value);
                      if (error) clearError();
                    }}
                    placeholder="Repita a senha"
                    className="w-full bg-[#0B0B0B] border border-[#303030] focus:border-[#FF7A00] focus:ring-1 focus:ring-[#FF7A00] rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-[#555555] transition-all outline-none"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              id="btn-submit-register"
              disabled={isLoading}
              className="w-full bg-[#FF7A00] hover:bg-[#FF9800] text-white font-bold text-sm py-3 px-4 rounded-xl shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-3"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Validando Convite...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Concluir Cadastro</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Footer info */}
        <div className="text-[10px] text-[#666666] text-center pt-3 border-t border-[#222222] mt-4">
          Merlin CRM &copy; 2026 &bull; Acesso Restrito &bull; Cloudflare D1
        </div>
      </div>
    </div>
  );
};

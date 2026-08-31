import React, { useState } from 'react';
import { 
  Mail, 
  Lock, 
  User as UserIcon, 
  Phone,
  KeyRound, 
  ArrowRight, 
  AlertCircle, 
  Loader2, 
  ShieldCheck,
  CheckCircle2,
  Info,
  Clock,
  ShieldAlert,
  Eye,
  EyeOff,
  UserPlus,
  LogIn
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import merlinLogo from '../../../assets/images/merlin_logo_transparent.png';

export const LoginForm: React.FC = () => {
  const { login, register, isLoading, error, clearError, registrationSuccessNotice, clearRegistrationNotice } = useAuth();
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regInviteCode, setRegInviteCode] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showInviteHint, setShowInviteHint] = useState(false);
  const [localValidationWarning, setLocalValidationWarning] = useState<string | null>(null);

  // Mask Phone: (XX) XXXXX-XXXX
  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits.length > 0 ? `(${digits}` : '';
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRegPhone(formatPhone(e.target.value));
    if (localValidationWarning) setLocalValidationWarning(null);
    if (error) clearError();
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) return;
    if (registrationSuccessNotice) clearRegistrationNotice();
    await login({ email: loginEmail, password: loginPassword });
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalValidationWarning(null);

    if (!regName.trim()) {
      setLocalValidationWarning('Por favor, informe seu nome completo.');
      return;
    }

    if (!regEmail.trim() || !regEmail.includes('@')) {
      setLocalValidationWarning('Por favor, informe um endereço de e-mail válido.');
      return;
    }

    const cleanPhone = regPhone.replace(/\D/g, '');
    if (!regPhone.trim() || cleanPhone.length < 10) {
      setLocalValidationWarning('Por favor, informe um número de Telefone / WhatsApp válido com DDD.');
      return;
    }

    if (!regPassword || regPassword.length < 6) {
      setLocalValidationWarning('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setLocalValidationWarning('As senhas digitadas não coincidem.');
      return;
    }

    const result = await register({
      name: regName.trim(),
      email: regEmail.trim(),
      phone: regPhone.trim(),
      password: regPassword,
      confirmPassword: regConfirmPassword,
      inviteCode: regInviteCode.trim() ? regInviteCode.trim().toUpperCase() : undefined,
    });

    if (result.success && result.isPending) {
      // Clear register inputs and prefill login email
      setLoginEmail(regEmail.trim());
      setRegName('');
      setRegEmail('');
      setRegPhone('');
      setRegPassword('');
      setRegConfirmPassword('');
      setRegInviteCode('');
      setActiveTab('login');
    }
  };

  const handleTabSwitch = (tab: 'login' | 'register') => {
    setActiveTab(tab);
    setLocalValidationWarning(null);
    if (error) clearError();
  };

  const isPendingApprovalError = error?.includes('aguardando aprovação') || error?.includes('aprovação do administrador');
  const isBlockedError = error?.includes('bloqueada') || error?.includes('bloqueado');

  return (
    <div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center p-4 sm:p-6 text-white font-sans selection:bg-[#FF7A00]/30 selection:text-white">
      <div className="w-full max-w-lg bg-[#161616] border border-[#303030] p-6 sm:p-8 rounded-2xl shadow-2xl relative overflow-hidden">
        {/* Subtle decorative background glows */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#FF7A00]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[#FF7A00]/5 rounded-full blur-3xl pointer-events-none" />

        {/* Logo and Header */}
        <div className="text-center relative z-10 space-y-2.5 mb-6">
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

        {/* Primary Tab Switcher */}
        <div className="mb-6 grid grid-cols-2 bg-[#0B0B0B] p-1.5 rounded-xl border border-[#2A2A2A] relative z-10 gap-1">
          <button
            type="button"
            id="tab-login"
            onClick={() => handleTabSwitch('login')}
            className={`py-2.5 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'login'
                ? 'bg-[#222222] text-white shadow-sm border border-[#3A3A3A]'
                : 'text-[#888888] hover:text-[#CCCCCC] hover:bg-[#151515]'
            }`}
          >
            <LogIn className="h-4 w-4 text-[#FF7A00]" />
            <span>Entrar na Conta</span>
          </button>
          
          <button
            type="button"
            id="tab-register"
            onClick={() => handleTabSwitch('register')}
            className={`py-2.5 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'register'
                ? 'bg-[#FF7A00] text-white shadow-md shadow-orange-500/20'
                : 'text-[#888888] hover:text-[#CCCCCC] hover:bg-[#151515]'
            }`}
          >
            <UserPlus className="h-4 w-4" />
            <span>Criar Nova Conta</span>
          </button>
        </div>

        {/* Pending Registration Success Notice Alert */}
        {registrationSuccessNotice && (
          <div className="mb-5 bg-[#FF7A00]/10 border border-[#FF7A00]/40 text-[#FF9800] text-xs rounded-xl p-4 flex items-start gap-3 animate-fadeIn">
            <div className="p-2 bg-[#FF7A00]/20 rounded-lg text-[#FF7A00] shrink-0 mt-0.5">
              <Clock className="h-5 w-5" />
            </div>
            <div className="flex-1 space-y-1">
              <span className="font-bold text-white block text-sm">Cadastro Realizado com Sucesso!</span>
              <p className="text-xs text-[#E5E5E5] leading-relaxed">
                {registrationSuccessNotice}
              </p>
            </div>
          </div>
        )}

        {/* Local Validation Warnings */}
        {localValidationWarning && (
          <div className="mb-5 bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-xs rounded-xl p-3.5 flex items-start gap-2.5 animate-fadeIn">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{localValidationWarning}</span>
          </div>
        )}

        {/* Error / Status Alerts */}
        {error && (
          <div className={`mb-5 text-xs rounded-xl p-3.5 flex items-start gap-3 animate-fadeIn ${
            isPendingApprovalError 
              ? 'bg-[#F59E0B]/15 border border-[#F59E0B]/40 text-[#FCD34D]' 
              : isBlockedError
              ? 'bg-[#EF4444]/15 border border-[#EF4444]/40 text-[#FCA5A5]'
              : 'bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444]'
          }`}>
            {isPendingApprovalError ? (
              <Clock className="h-5 w-5 text-[#F59E0B] shrink-0 mt-0.5" />
            ) : isBlockedError ? (
              <ShieldAlert className="h-5 w-5 text-[#EF4444] shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-[#EF4444] shrink-0 mt-0.5" />
            )}
            <div className="flex-1 space-y-0.5">
              <span className="font-bold block text-white">
                {isPendingApprovalError ? 'Aguardando Aprovação' : isBlockedError ? 'Acesso Bloqueado' : 'Aviso de Autenticação'}
              </span>
              <p className="text-[11px] leading-relaxed opacity-90">{error}</p>
            </div>
          </div>
        )}

        {/* TAB 1: LOGIN VIEW */}
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
                  type={showLoginPassword ? 'text' : 'password'}
                  id="login-password-input"
                  required
                  value={loginPassword}
                  onChange={(e) => {
                    setLoginPassword(e.target.value);
                    if (error) clearError();
                  }}
                  placeholder="••••••••"
                  className="w-full bg-[#0B0B0B] border border-[#303030] focus:border-[#FF7A00] focus:ring-1 focus:ring-[#FF7A00] rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-[#555555] transition-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#777777] hover:text-[#CCCCCC] cursor-pointer"
                >
                  {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
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

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => handleTabSwitch('register')}
                className="text-xs text-[#888888] hover:text-[#FF7A00] transition-colors cursor-pointer"
              >
                Ainda não tem conta? <strong className="text-[#E5E5E5] underline">Criar Nova Conta / Solicitar Acesso</strong>
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: REGISTER VIEW */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5 relative z-10">
            {/* Name */}
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-[#E5E5E5] block">
                Nome Completo <span className="text-[#FF7A00]">*</span>
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
                    if (localValidationWarning) setLocalValidationWarning(null);
                    if (error) clearError();
                  }}
                  placeholder="Ex: Ana Silva Corretora"
                  className="w-full bg-[#0B0B0B] border border-[#303030] focus:border-[#FF7A00] focus:ring-1 focus:ring-[#FF7A00] rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-[#555555] transition-all outline-none"
                />
              </div>
            </div>

            {/* Email & Phone Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Email */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-[#E5E5E5] block">
                  E-mail <span className="text-[#FF7A00]">*</span>
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
                      if (localValidationWarning) setLocalValidationWarning(null);
                      if (error) clearError();
                    }}
                    placeholder="seu.email@imobiliaria.com"
                    className="w-full bg-[#0B0B0B] border border-[#303030] focus:border-[#FF7A00] focus:ring-1 focus:ring-[#FF7A00] rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-white placeholder-[#555555] transition-all outline-none"
                  />
                </div>
              </div>

              {/* Phone / WhatsApp */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-[#E5E5E5] block">
                  Telefone / WhatsApp <span className="text-[#FF7A00]">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#888888]">
                    <Phone className="h-4 w-4" />
                  </div>
                  <input
                    type="tel"
                    id="reg-phone-input"
                    required
                    value={regPhone}
                    onChange={handlePhoneChange}
                    placeholder="(11) 99999-9999"
                    className="w-full bg-[#0B0B0B] border border-[#303030] focus:border-[#FF7A00] focus:ring-1 focus:ring-[#FF7A00] rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-white placeholder-[#555555] transition-all outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Password & Confirm Password Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-[#E5E5E5] block">
                  Senha <span className="text-[#FF7A00]">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#888888]">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    id="reg-password-input"
                    required
                    minLength={6}
                    value={regPassword}
                    onChange={(e) => {
                      setRegPassword(e.target.value);
                      if (localValidationWarning) setLocalValidationWarning(null);
                      if (error) clearError();
                    }}
                    placeholder="Mín. 6 dígitos"
                    className="w-full bg-[#0B0B0B] border border-[#303030] focus:border-[#FF7A00] focus:ring-1 focus:ring-[#FF7A00] rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm text-white placeholder-[#555555] transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#777777] hover:text-[#CCCCCC] cursor-pointer"
                  >
                    {showRegPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-[#E5E5E5] block">
                  Confirmar Senha <span className="text-[#FF7A00]">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#888888]">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    id="reg-confirm-password-input"
                    required
                    minLength={6}
                    value={regConfirmPassword}
                    onChange={(e) => {
                      setRegConfirmPassword(e.target.value);
                      if (localValidationWarning) setLocalValidationWarning(null);
                      if (error) clearError();
                    }}
                    placeholder="Repita a senha"
                    className={`w-full bg-[#0B0B0B] border rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-white placeholder-[#555555] transition-all outline-none ${
                      regConfirmPassword && regPassword !== regConfirmPassword
                        ? 'border-[#EF4444] focus:border-[#EF4444]'
                        : regConfirmPassword && regPassword === regConfirmPassword
                        ? 'border-[#10B981] focus:border-[#10B981]'
                        : 'border-[#303030] focus:border-[#FF7A00]'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Optional Invite Code Box */}
            <div className="space-y-1.5 bg-[#171411] border border-[#3A2E22] p-3 rounded-xl">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-[#E5E5E5] flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-[#FF7A00]" />
                  Código de Convite
                  <span className="text-[10px] text-[#A0A0A0] font-normal lowercase bg-[#2A2218] px-2 py-0.2 rounded-md border border-[#443322]">
                    (Opcional)
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowInviteHint(!showInviteHint)}
                  className="text-[10px] text-[#FF9800] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Info className="h-3 w-3" />
                  Como funciona?
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  id="reg-invite-code-input"
                  value={regInviteCode}
                  onChange={(e) => {
                    setRegInviteCode(e.target.value.toUpperCase());
                    if (error) clearError();
                  }}
                  placeholder="Se tiver código, digite aqui para liberação imediata"
                  className="w-full bg-[#0B0B0B] border border-[#383838] focus:border-[#FF7A00] focus:ring-1 focus:ring-[#FF7A00] rounded-lg px-3 py-2 text-xs text-white font-mono uppercase tracking-wider placeholder-[#666666] outline-none"
                />
              </div>

              {showInviteHint ? (
                <div className="text-[11px] text-[#BDBDBD] bg-[#0B0B0B] p-2.5 rounded-lg border border-[#333333] space-y-1 mt-1.5 animate-fadeIn">
                  <p>
                    ⚡ <strong className="text-white">Com código de convite:</strong> Seu acesso é ativado na hora e você já entra diretamente no sistema.
                  </p>
                  <p>
                    ⏳ <strong className="text-white">Sem código de convite:</strong> Sua solicitação é enviada para análise e o administrador da imobiliária aprovará seu acesso.
                  </p>
                </div>
              ) : (
                <p className="text-[10px] text-[#888888] leading-tight">
                  Não possui código? Deixe em branco para solicitar a aprovação do administrador.
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              id="btn-submit-register"
              disabled={isLoading}
              className="w-full bg-[#FF7A00] hover:bg-[#FF9800] text-white font-bold text-sm py-3 px-4 rounded-xl shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-3"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processando Solicitação...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Cadastrar e Solicitar Acesso</span>
                </>
              )}
            </button>

            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() => handleTabSwitch('login')}
                className="text-xs text-[#888888] hover:text-[#CCCCCC] transition-colors cursor-pointer"
              >
                Já possui uma conta ativa? <strong className="text-[#FF7A00] underline">Fazer Login</strong>
              </button>
            </div>
          </form>
        )}

        {/* Footer info */}
        <div className="text-[10px] text-[#666666] text-center pt-3 border-t border-[#222222] mt-4">
          Merlin CRM &copy; 2026 &bull; Acesso Restrito &bull; Segurança & Gestão
        </div>
      </div>
    </div>
  );
};

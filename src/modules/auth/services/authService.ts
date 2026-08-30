import { LoginCredentials, RegisterCredentials, User, InviteCode } from '../types';

export const authService = {
  /**
   * Autentica o usuário via backend ou Cloudflare Pages D1
   */
  async login(credentials: LoginCredentials): Promise<User> {
    if (!credentials.email || !credentials.email.trim()) {
      throw new Error('Por favor, informe seu e-mail para acessar o Merlin CRM.');
    }

    if (!credentials.password) {
      throw new Error('Por favor, informe sua senha de acesso.');
    }

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: credentials.email.trim().toLowerCase(),
        password: credentials.password,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'E-mail ou senha incorretos.');
    }

    return data.user as User;
  },

  /**
   * Realiza o cadastro exigindo obrigatoriamente um Código de Convite Secreto
   */
  async register(credentials: RegisterCredentials): Promise<User> {
    if (!credentials.name || !credentials.name.trim()) {
      throw new Error('Informe seu nome completo.');
    }

    if (!credentials.email || !credentials.email.trim() || !credentials.email.includes('@')) {
      throw new Error('Informe um endereço de e-mail válido.');
    }

    if (!credentials.password || credentials.password.length < 6) {
      throw new Error('A senha deve ter no mínimo 6 caracteres.');
    }

    if (credentials.confirmPassword && credentials.password !== credentials.confirmPassword) {
      throw new Error('As senhas digitadas não coincidem.');
    }

    if (!credentials.inviteCode || !credentials.inviteCode.trim()) {
      throw new Error('O Código de Convite é obrigatório para cadastro no Merlin CRM.');
    }

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: credentials.name.trim(),
        email: credentials.email.trim().toLowerCase(),
        password: credentials.password,
        inviteCode: credentials.inviteCode.trim().toUpperCase(),
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      if (response.status === 403 || data.error?.includes('convite')) {
        throw new Error('Código de convite inválido ou expirado. Verifique com seu administrador.');
      }
      throw new Error(data.error || 'Falha ao realizar cadastro.');
    }

    return data.user as User;
  },

  /**
   * Valida a sessão atual com o servidor
   */
  async getMe(userId: string): Promise<User | null> {
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'X-User-Id': userId,
        },
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.success ? data.user : null;
    } catch {
      return null;
    }
  },

  /**
   * Cria novo código de convite (Administrador)
   */
  async createInviteCode(adminUserId: string, customCode?: string): Promise<InviteCode> {
    const response = await fetch('/api/admin/create-invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': adminUserId,
      },
      body: JSON.stringify({
        adminUserId,
        customCode: customCode ? customCode.trim().toUpperCase() : undefined,
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Erro ao gerar código de convite.');
    }

    return data.invite as InviteCode;
  },

  /**
   * Lista todos os códigos de convite gerados (Administrador)
   */
  async listInviteCodes(adminUserId: string): Promise<InviteCode[]> {
    const response = await fetch(`/api/admin/invite-codes?userId=${encodeURIComponent(adminUserId)}`, {
      headers: {
        'X-User-Id': adminUserId,
      },
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Erro ao consultar códigos de convite.');
    }

    return data.invites as InviteCode[];
  },

  /**
   * Revoga um código de convite ativo (Administrador)
   */
  async revokeInviteCode(adminUserId: string, code: string): Promise<void> {
    const response = await fetch('/api/admin/revoke-invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': adminUserId,
      },
      body: JSON.stringify({
        adminUserId,
        code,
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Erro ao revogar código de convite.');
    }
  },

  async logout(): Promise<void> {
    // Client-side cleanup hook
    await new Promise((resolve) => setTimeout(resolve, 50));
  },
};

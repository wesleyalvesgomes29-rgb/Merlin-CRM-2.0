import { LoginCredentials, RegisterCredentials, User, InviteCode, UserAdminView, UserStatus } from '../types';

/**
 * Utilitário seguro para processar respostas da API, prevenindo erros de parse JSON
 * caso o servidor retorne páginas de erro 404/500 em texto plano ou HTML.
 */
async function parseApiResponse<T = any>(response: Response, fallbackErrorMessage: string): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  let data: any = null;

  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    // Tratamento defensivo para respostas que não são JSON (ex: 404 Not Found, 500)
    const rawText = await response.text().catch(() => '');
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Serviço de autenticação temporariamente indisponível (404 Not Found).');
      }
      if (response.status >= 500) {
        throw new Error('Instabilidade temporária no servidor (500). Tente novamente em instantes.');
      }
      throw new Error(rawText.trim() || fallbackErrorMessage);
    }
  }

  if (!response.ok) {
    const errorMsg = data?.error || data?.message || fallbackErrorMessage;
    throw new Error(errorMsg);
  }

  if (data && data.success === false) {
    throw new Error(data.error || data.message || fallbackErrorMessage);
  }

  return (data || {}) as T;
}

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

    const data = await parseApiResponse<{ success: boolean; user: User; error?: string; isPending?: boolean; isBlocked?: boolean }>(
      response,
      'E-mail ou senha incorretos.'
    );

    return data.user;
  },

  /**
   * Realiza o cadastro do usuário. Se o código de convite for informado e válido, a conta é ativada imediatamente.
   * Caso contrário, a conta é criada com status 'pending' para aprovação do administrador.
   */
  async register(credentials: RegisterCredentials): Promise<{ user: User; isPending: boolean; message: string }> {
    if (!credentials.name || !credentials.name.trim()) {
      throw new Error('Informe seu nome completo.');
    }

    if (!credentials.email || !credentials.email.trim() || !credentials.email.includes('@')) {
      throw new Error('Informe um endereço de e-mail válido.');
    }

    if (!credentials.phone || !credentials.phone.trim() || credentials.phone.trim().replace(/\D/g, '').length < 8) {
      throw new Error('Informe seu número de Telefone / WhatsApp.');
    }

    if (!credentials.password || credentials.password.length < 6) {
      throw new Error('A senha deve ter no mínimo 6 caracteres.');
    }

    if (credentials.confirmPassword && credentials.password !== credentials.confirmPassword) {
      throw new Error('As senhas digitadas não coincidem.');
    }

    const hasInviteCode = Boolean(credentials.inviteCode && credentials.inviteCode.trim());

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: credentials.name.trim(),
        email: credentials.email.trim().toLowerCase(),
        phone: credentials.phone.trim(),
        password: credentials.password,
        inviteCode: hasInviteCode ? credentials.inviteCode!.trim().toUpperCase() : undefined,
      }),
    });

    try {
      const data = await parseApiResponse<{ success: boolean; user: User; message?: string; error?: string }>(
        response,
        'Falha ao realizar cadastro.'
      );
      const isPending = data.user?.status === 'pending';
      const message = data.message || (isPending 
        ? 'Cadastro realizado com sucesso! Sua conta está em análise e aguarda liberação do administrador. Em breve seu acesso será liberado.'
        : 'Usuário cadastrado e ativado com sucesso!');
      return { user: data.user, isPending, message };
    } catch (err: any) {
      if (response.status === 403 || err.message?.includes('convite')) {
        throw new Error('Código de convite inválido ou expirado. Verifique com seu administrador ou cadastre-se sem código para solicitar acesso.');
      }
      throw err;
    }
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
      const data = await parseApiResponse<{ success: boolean; user: User }>(
        response,
        'Sessão expirada.'
      );
      return data?.user || null;
    } catch {
      return null;
    }
  },

  /**
   * Lista todos os usuários do sistema (Administrador)
   */
  async listUsers(adminUserId: string): Promise<UserAdminView[]> {
    const response = await fetch(`/api/admin/users?userId=${encodeURIComponent(adminUserId)}`, {
      headers: {
        'X-User-Id': adminUserId,
      },
    });

    const data = await parseApiResponse<{ success: boolean; users: UserAdminView[]; error?: string }>(
      response,
      'Erro ao listar usuários.'
    );

    return data.users || [];
  },

  /**
   * Atualiza o status de um usuário (Administrador: pending | active | blocked)
   */
  async updateUserStatus(adminUserId: string, targetUserId: string, status: UserStatus): Promise<void> {
    const response = await fetch(`/api/admin/users/${encodeURIComponent(targetUserId)}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': adminUserId,
      },
      body: JSON.stringify({
        adminUserId,
        status,
      }),
    });

    await parseApiResponse<{ success: boolean; message?: string; error?: string }>(
      response,
      'Erro ao atualizar status do usuário.'
    );
  },

  /**
   * Aprova e ativa o acesso de um usuário pendente (Administrador)
   */
  async approveUser(adminUserId: string, targetUserId: string): Promise<void> {
    const response = await fetch(`/api/admin/users/${encodeURIComponent(targetUserId)}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': adminUserId,
      },
      body: JSON.stringify({
        adminUserId,
      }),
    });

    await parseApiResponse<{ success: boolean; message?: string; error?: string }>(
      response,
      'Erro ao aprovar usuário.'
    );
  },

  /**
   * Remove/Rejeita um usuário (Administrador)
   */
  async deleteUser(adminUserId: string, targetUserId: string): Promise<void> {
    const response = await fetch(`/api/admin/users/${encodeURIComponent(targetUserId)}/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': adminUserId,
      },
      body: JSON.stringify({
        adminUserId,
      }),
    });

    await parseApiResponse<{ success: boolean; message?: string; error?: string }>(
      response,
      'Erro ao excluir usuário.'
    );
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

    const data = await parseApiResponse<{ success: boolean; invite: InviteCode; error?: string }>(
      response,
      'Erro ao gerar código de convite.'
    );

    return data.invite;
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

    const data = await parseApiResponse<{ success: boolean; invites: InviteCode[]; error?: string }>(
      response,
      'Erro ao consultar códigos de convite.'
    );

    return data.invites || [];
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

    await parseApiResponse<{ success: boolean; message?: string; error?: string }>(
      response,
      'Erro ao revogar código de convite.'
    );
  },

  async logout(): Promise<void> {
    // Client-side cleanup hook
    await new Promise((resolve) => setTimeout(resolve, 50));
  },
};


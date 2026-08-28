import { LoginCredentials, User } from '../types';

const DEFAULT_USER: User = {
  id: 'usr_merlin_default',
  name: 'Corretor Merlin',
  email: 'corretor@merlin.crm',
  role: 'Corretor de Imóveis',
  createdAt: new Date().toISOString(),
};

export const authService = {
  /**
   * Authenticates user locally.
   * Prepared for future cloud authentication (Cloudflare D1 / Cloud Auth API).
   */
  async login(credentials: LoginCredentials): Promise<User> {
    // Network delay simulation for clean interface contract
    await new Promise(resolve => setTimeout(resolve, 300));

    if (!credentials.email || !credentials.email.trim()) {
      throw new Error('Por favor, informe seu e-mail para acessar o Merlin CRM.');
    }

    const emailTrimmed = credentials.email.trim().toLowerCase();
    
    // Simple email format check
    if (!emailTrimmed.includes('@') || !emailTrimmed.includes('.')) {
      throw new Error('Por favor, insira um endereço de e-mail válido.');
    }

    // Extract name from email prefix or default
    const prefix = emailTrimmed.split('@')[0];
    const cleanPrefix = prefix.replace(/[._-]/g, ' ');
    const formattedName = cleanPrefix
      .split(' ')
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    const user: User = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      name: formattedName || DEFAULT_USER.name,
      email: emailTrimmed,
      role: 'Corretor de Imóveis',
      createdAt: new Date().toISOString(),
    };

    return user;
  },

  async logout(): Promise<void> {
    // Extensible hook for future cloud session revocation
    await new Promise(resolve => setTimeout(resolve, 100));
  }
};

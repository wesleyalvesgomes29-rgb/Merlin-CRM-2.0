import { AuthSession, User } from '../types';

const AUTH_SESSION_KEY = 'merlin_auth_session_v1';

export const authStorage = {
  getStoredSession(): AuthSession | null {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(AUTH_SESSION_KEY);
      if (!stored) return null;
      return JSON.parse(stored) as AuthSession;
    } catch (e) {
      console.error('[AuthStorage] Failed to parse auth session:', e);
      return null;
    }
  },

  saveSession(user: User): AuthSession {
    const session: AuthSession = {
      user,
      authenticatedAt: new Date().toISOString(),
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    }
    return session;
  },

  clearSession(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_SESSION_KEY);
    }
  }
};

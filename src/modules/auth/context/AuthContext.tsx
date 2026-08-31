import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { AuthContextType, AuthState, LoginCredentials, RegisterCredentials } from '../types';
import { authStorage } from '../storage/authStorage';
import { authService } from '../services/authService';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
    registrationSuccessNotice: null,
  });

  useEffect(() => {
    // Restore persistent session on startup
    const session = authStorage.getStoredSession();
    if (session && session.user) {
      if (session.user.status === 'pending' || session.user.status === 'blocked') {
        authStorage.clearSession();
        setState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: session.user.status === 'pending'
            ? 'Sua conta foi criada e está aguardando aprovação do administrador. Entre em contato para liberação.'
            : 'Sua conta foi bloqueada pelo administrador.',
          registrationSuccessNotice: null,
        });
        return;
      }

      setState({
        user: session.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        registrationSuccessNotice: null,
      });

      // Background verification of active session
      authService.getMe(session.user.id).then((freshUser) => {
        if (freshUser) {
          if (freshUser.status === 'pending' || freshUser.status === 'blocked') {
            authStorage.clearSession();
            setState({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              error: freshUser.status === 'pending'
                ? 'Sua conta foi criada e está aguardando aprovação do administrador. Entre em contato para liberação.'
                : 'Sua conta foi bloqueada pelo administrador.',
              registrationSuccessNotice: null,
            });
            return;
          }
          authStorage.saveSession(freshUser);
          setState((prev) => ({
            ...prev,
            user: freshUser,
          }));
        }
      }).catch(() => {
        // Keep cached session if offline/error
      });
    } else {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        registrationSuccessNotice: null,
      });
    }
  }, []);

  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null, registrationSuccessNotice: null }));
    try {
      const user = await authService.login(credentials);
      if (user.status === 'pending') {
        throw new Error('Sua conta foi criada e está aguardando aprovação do administrador. Entre em contato para liberação.');
      }
      if (user.status === 'blocked') {
        throw new Error('Sua conta foi bloqueada pelo administrador. Entre em contato com o suporte.');
      }

      authStorage.saveSession(user);
      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        registrationSuccessNotice: null,
      });
      return true;
    } catch (err: any) {
      const errorMessage = err?.message || 'Falha ao realizar login. Tente novamente.';
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      return false;
    }
  };

  const register = async (credentials: RegisterCredentials): Promise<{ success: boolean; isPending: boolean; message?: string }> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null, registrationSuccessNotice: null }));
    try {
      const result = await authService.register(credentials);
      if (result.isPending) {
        setState((prev) => ({
          ...prev,
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
          registrationSuccessNotice: result.message,
        }));
        return { success: true, isPending: true, message: result.message };
      }

      // If active directly (e.g. Master Admin or First User)
      authStorage.saveSession(result.user);
      setState({
        user: result.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        registrationSuccessNotice: null,
      });
      return { success: true, isPending: false, message: result.message };
    } catch (err: any) {
      const errorMessage = err?.message || 'Falha ao realizar cadastro com código de convite.';
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        registrationSuccessNotice: null,
      }));
      return { success: false, isPending: false, message: errorMessage };
    }
  };

  const logout = () => {
    authStorage.clearSession();
    authService.logout();
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      registrationSuccessNotice: null,
    });
  };

  const clearError = () => {
    setState((prev) => ({ ...prev, error: null }));
  };

  const clearRegistrationNotice = () => {
    setState((prev) => ({ ...prev, registrationSuccessNotice: null }));
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        clearError,
        clearRegistrationNotice,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

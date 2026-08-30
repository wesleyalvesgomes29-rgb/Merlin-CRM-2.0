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
  });

  useEffect(() => {
    // Restore persistent session on startup
    const session = authStorage.getStoredSession();
    if (session && session.user) {
      setState({
        user: session.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      // Background verification of active session
      authService.getMe(session.user.id).then((freshUser) => {
        if (freshUser) {
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
      });
    }
  }, []);

  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const user = await authService.login(credentials);
      authStorage.saveSession(user);
      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
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

  const register = async (credentials: RegisterCredentials): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const user = await authService.register(credentials);
      authStorage.saveSession(user);
      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      return true;
    } catch (err: any) {
      const errorMessage = err?.message || 'Falha ao realizar cadastro com código de convite.';
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      return false;
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
    });
  };

  const clearError = () => {
    setState((prev) => ({ ...prev, error: null }));
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

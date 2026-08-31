export type UserRole = 'admin' | 'broker';
export type UserStatus = 'pending' | 'active' | 'blocked';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  role: UserRole;
  status?: UserStatus;
  createdAt: string;
  google_email?: string | null;
  google_connected_at?: string | null;
  isGoogleConnected?: boolean;
}

export interface UserAdminView {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  google_email?: string | null;
  google_connected_at?: string | null;
  isGoogleConnected?: boolean;
}

export interface AuthSession {
  user: User;
  authenticatedAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword?: string;
  inviteCode?: string;
}

export interface RegisterResult {
  success: boolean;
  user: User;
  isPending: boolean;
  message?: string;
}

export interface InviteCode {
  code: string;
  created_by: string | null;
  used_by: string | null;
  used_at: string | null;
  is_active: number; // 1 = active, 0 = used/inactive
  created_at: string;
  used_by_name?: string;
  used_by_email?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  registrationSuccessNotice?: string | null;
}

export interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<boolean>;
  register: (credentials: RegisterCredentials) => Promise<{ success: boolean; isPending: boolean; message?: string }>;
  logout: () => void;
  clearError: () => void;
  clearRegistrationNotice: () => void;
}

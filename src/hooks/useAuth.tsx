import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { apiFetch } from '@/lib/apiClient';
import { loadLanguagesFromServer, setLanguage } from '@/i18n';
import type { LocalUser } from '@/types/api';

interface AuthContextType {
  user: LocalUser | null;
  loading: boolean;
  needsInitialSetup: boolean;
  signIn: (username: string, password: string, totpCode?: string) => Promise<{ error: Error | null; requires2fa?: boolean }>;
  initializeAdmin: (username: string, password: string) => Promise<{ error: Error | null }>;
  completeInitialSetup: (username: string, newPassword: string) => Promise<{ error: Error | null }>;
  updateAccount: (updates: {
    username?: string;
    displayName?: string;
    avatarDataUrl?: string;
    currentPassword?: string;
    newPassword?: string;
  }) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsInitialSetup, setNeedsInitialSetup] = useState(false);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      apiFetch<{ user: LocalUser | null }>('/auth/session'),
      apiFetch<{ needs_initial_setup: boolean }>('/auth/status'),
    ])
      .then(([sessionData, statusData]) => {
        if (!mounted) return;
        setUser(sessionData.user);
        setNeedsInitialSetup(statusData.needs_initial_setup);
        if (sessionData.user) {
          loadLanguagesFromServer().then(() => {
            if (sessionData.user?.language) setLanguage(sessionData.user.language);
          });
        }
      })
      .catch(() => {
        if (!mounted) return;
        setUser(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const signIn = async (username: string, password: string, totpCode?: string) => {
    try {
      const data = await apiFetch<{ user: LocalUser }>('/auth/signin', {
        method: 'POST',
        body: JSON.stringify({ username, password, totpCode }),
      });
      setUser(data.user);
      loadLanguagesFromServer().then(() => {
        if (data.user?.language) setLanguage(data.user.language);
      });
      return { error: null };
    } catch (error) {
      const err = error as Error;
      if (err.message === '2fa_required') {
        return { error: null, requires2fa: true };
      }
      return { error: err };
    }
  };

  const initializeAdmin = async (username: string, password: string) => {
    try {
      const data = await apiFetch<{ user: LocalUser }>('/auth/initialize-admin', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      setUser(data.user);
      setNeedsInitialSetup(false);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const completeInitialSetup = async (username: string, newPassword: string) => {
    try {
      const data = await apiFetch<{ user: LocalUser }>('/auth/complete-initial-setup', {
        method: 'POST',
        body: JSON.stringify({ username, newPassword }),
      });
      setUser(data.user);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const updateAccount = async (updates: {
    username?: string;
    displayName?: string;
    avatarDataUrl?: string;
    currentPassword?: string;
    newPassword?: string;
  }) => {
    try {
      const data = await apiFetch<{ user: LocalUser }>('/account', {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      setUser(data.user);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await apiFetch<void>('/auth/signout', { method: 'POST' });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, needsInitialSetup, signIn, initializeAdmin, completeInitialSetup, updateAccount, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

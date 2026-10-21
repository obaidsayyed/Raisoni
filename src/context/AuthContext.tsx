import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Profile, UserRole } from '../types';
import {
  loginWithUsername,
  changeOwnPassword,
  changeOwnUsername,
  bootstrapAdminAccount,
  isAdministratorBootstrapped,
} from '../services/storageEngine';
import { supabase, getSupabaseConfigStatus } from '../lib/supabaseClient';

interface AuthContextType {
  user: Profile | null;
  role: UserRole;
  isAuthenticated: boolean;
  mustChangePassword: boolean;
  loading: boolean;
  isBootstrapped: boolean;
  login: (username: string, pass: string) => Promise<Profile>;
  logout: () => Promise<void>;
  enterReaderMode: () => Promise<void>;
  completeInitialPasswordChange: (newPass: string) => Promise<void>;
  changePassword: (currentPass: string, newPass: string) => Promise<void>;
  changeUsername: (newUsername: string) => Promise<string>;
  bootstrapAdmin: () => Promise<{ success: boolean; message: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'classroom_allocator_session_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBootstrapped, setIsBootstrapped] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Check initial bootstrap status
    setIsBootstrapped(isAdministratorBootstrapped());

    const restoreSession = async () => {
      try {
        // 1. Immediately inspect local cached session profile
        const saved = localStorage.getItem(AUTH_STORAGE_KEY);
        let cachedProfile: Profile | null = null;
        if (saved) {
          try {
            cachedProfile = JSON.parse(saved);
            if (isMounted && cachedProfile) {
              setUser(cachedProfile);
            }
          } catch (e) {
            console.error('Failed to parse saved session cache', e);
          }
        }

        // 2. If Supabase is configured, verify and synchronize with Supabase Auth
        const config = getSupabaseConfigStatus();
        if (config.isConfigured) {
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) {
            console.warn('Session retrieval error:', sessionError);
          }

          if (session?.user) {
            // Active session found in Supabase Auth
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle();

            if (profile && profile.status === 'active') {
              if (isMounted) {
                setUser(profile);
                localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(profile));
              }
            } else if (profile?.status === 'disabled') {
              // Deactivated account
              await supabase.auth.signOut();
              if (isMounted) {
                setUser(null);
                localStorage.removeItem(AUTH_STORAGE_KEY);
              }
            }
          } else if (!cachedProfile) {
            // No Supabase session and no cached profile -> Reader Mode by default
            if (isMounted) {
              setUser(null);
              localStorage.removeItem(AUTH_STORAGE_KEY);
            }
          }
        }
      } catch (err) {
        console.error('Failed to restore persistent session:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    restoreSession();

    // 3. Listen to Supabase Auth state changes (token refresh, sign-in, sign-out)
    const config = getSupabaseConfigStatus();
    let authSub: any = null;

    if (config.isConfigured) {
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!isMounted) return;

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle();

            if (profile && profile.status === 'active') {
              setUser(profile);
              localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(profile));
            }
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      });
      authSub = data?.subscription;
    }

    return () => {
      isMounted = false;
      if (authSub) {
        authSub.unsubscribe();
      }
    };
  }, []);

  const login = async (username: string, pass: string): Promise<Profile> => {
    const { profile } = await loginWithUsername(username, pass);
    setUser(profile);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(profile));
    return profile;
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    const config = getSupabaseConfigStatus();
    if (config.isConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('Error during Supabase signOut:', e);
      }
    }
  };

  const enterReaderMode = async () => {
    await logout();
  };

  const completeInitialPasswordChange = async (newPass: string) => {
    if (!user) throw new Error('No authenticated user');
    const defaultInitialPass = user.role === 'admin' ? 'Admin@123' : 'Faculty@123';
    await changeOwnPassword(user.id, defaultInitialPass, newPass);
    const updatedUser = { ...user, must_change_password: false };
    setUser(updatedUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
  };

  const changePassword = async (currentPass: string, newPass: string) => {
    if (!user) throw new Error('No authenticated user');
    await changeOwnPassword(user.id, currentPass, newPass);
    const updatedUser = { ...user, must_change_password: false };
    setUser(updatedUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
  };

  const changeUsername = async (newUsername: string) => {
    if (!user) throw new Error('No authenticated user');
    const updatedName = await changeOwnUsername(user.id, newUsername);
    const updatedUser = { ...user, username: updatedName };
    setUser(updatedUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
    return updatedName;
  };

  const bootstrapAdmin = async () => {
    const res = await bootstrapAdminAccount();
    setIsBootstrapped(true);
    return res;
  };

  // Reader mode is active by default when user is null
  const role: UserRole = user ? user.role : 'reader';
  const isAuthenticated = Boolean(user);
  const mustChangePassword = Boolean(user?.must_change_password);

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated,
        mustChangePassword,
        loading,
        isBootstrapped,
        login,
        logout,
        enterReaderMode,
        completeInitialPasswordChange,
        changePassword,
        changeUsername,
        bootstrapAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

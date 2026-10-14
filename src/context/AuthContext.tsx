import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Profile, UserRole } from '../types';
import {
  loginWithUsername,
  changeOwnPassword,
  changeOwnUsername,
  bootstrapAdminAccount,
  isAdministratorBootstrapped,
} from '../services/storageEngine';

interface AuthContextType {
  user: Profile | null;
  role: UserRole;
  isAuthenticated: boolean;
  mustChangePassword: boolean;
  loading: boolean;
  isBootstrapped: boolean;
  login: (username: string, pass: string) => Promise<Profile>;
  logout: () => void;
  enterReaderMode: () => void;
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
    // Check initial bootstrap status
    setIsBootstrapped(isAdministratorBootstrapped());

    // Restore saved session if any
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setUser(parsed);
      }
    } catch (e) {
      console.error('Failed to parse saved session', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (username: string, pass: string): Promise<Profile> => {
    const { profile } = await loginWithUsername(username, pass);
    setUser(profile);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(profile));
    return profile;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const enterReaderMode = () => {
    logout();
  };

  const completeInitialPasswordChange = async (newPass: string) => {
    if (!user) throw new Error('No authenticated user');
    // Using current default or user's session
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

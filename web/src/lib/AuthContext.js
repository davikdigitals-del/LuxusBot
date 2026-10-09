'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import api, { auth as authStorage, ApiError } from './api';

const AuthContext = createContext(null);

const CURRENT_BUSINESS_KEY = 'luxus_current_business_id';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [currentBusinessId, setCurrentBusinessId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingGoogleCredential, setPendingGoogleCredential] = useState('');
  const router = useRouter();

  const loadSession = useCallback(async () => {
    if (!authStorage.isLoggedIn()) {
      setLoading(false);
      return;
    }
    try {
      const me = await api.get('/api/auth/me');
      setUser(me.user);
      const list = await api.get('/api/business');
      setBusinesses(list.businesses || []);

      const stored = typeof window !== 'undefined' ? localStorage.getItem(CURRENT_BUSINESS_KEY) : null;
      const validStored = list.businesses?.find((b) => b._id === stored);
      const chosen = validStored || list.businesses?.[0];
      if (chosen) {
        setCurrentBusinessId(chosen._id);
        localStorage.setItem(CURRENT_BUSINESS_KEY, chosen._id);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        authStorage.clear();
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const completeLogin = useCallback(async (data) => {
    authStorage.setTokens(data.token, data.refreshToken);
    await loadSession();
    return data;
  }, [loadSession]);

  const consumePendingGoogleCredential = useCallback(() => {
    const credential = pendingGoogleCredential;
    setPendingGoogleCredential('');
    return credential;
  }, [pendingGoogleCredential]);

  const login = useCallback(async (email, password) => {
    const data = await api.post('/api/auth/login', { email, password }, { skipAuth: true });
    return completeLogin(data);
  }, [completeLogin]);

  const logout = useCallback(() => {
    authStorage.clear();
    localStorage.removeItem(CURRENT_BUSINESS_KEY);
    setUser(null);
    setBusinesses([]);
    setCurrentBusinessId(null);
    router.push('/login');
  }, [router]);

  const switchBusiness = useCallback((id) => {
    setCurrentBusinessId(id);
    localStorage.setItem(CURRENT_BUSINESS_KEY, id);
  }, []);

  const updateUser = useCallback((updatedUser) => {
    setUser(updatedUser);
  }, []);

  const currentBusiness = useMemo(
    () => businesses.find((b) => b._id === currentBusinessId) || null,
    [businesses, currentBusinessId]
  );

  const currentRole = useMemo(() => currentBusiness?.userRole || null, [currentBusiness]);

  const value = {
    user,
    businesses,
    currentBusiness,
    currentBusinessId,
    currentRole,
    loading,
    login,
    completeLogin,
    pendingGoogleCredential,
    setPendingGoogleCredential,
    consumePendingGoogleCredential,
    logout,
    switchBusiness,
    updateUser,
    refresh: loadSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

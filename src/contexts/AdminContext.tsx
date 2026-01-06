import React, { createContext, useContext, useState, useEffect } from 'react';

interface AdminContextType {
  isAuthenticated: boolean;
  login: (password: string) => boolean;
  logout: () => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

const ADMIN_PASSWORD = 'stephadmin';
const STORAGE_KEY = 'sen_admin_auth';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check for existing session
    const storedAuth = localStorage.getItem(STORAGE_KEY);
    if (storedAuth) {
      const { timestamp } = JSON.parse(storedAuth);
      const now = Date.now();
      if (now - timestamp < SESSION_DURATION) {
        setIsAuthenticated(true);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const login = (password: string): boolean => {
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ timestamp: Date.now() })
      );
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AdminContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}

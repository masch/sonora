import { AdminApiClient } from '@/services/admin-api-client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean | null;
  isLoading: boolean;
  login: (key: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkSession = async (isMounted?: () => boolean): Promise<boolean> => {
    try {
      const isValid = await AdminApiClient.checkSession();
      if (!isMounted || isMounted()) setIsAuthenticated(isValid);
      return isValid;
    } catch {
      if (!isMounted || isMounted()) setIsAuthenticated(false);
      return false;
    } finally {
      if (!isMounted || isMounted()) setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const timer = setTimeout(() => {
      checkSession(() => isMounted);
    }, 0);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  const login = async (key: string): Promise<boolean> => {
    setIsLoading(true);
    const success = await AdminApiClient.loginSession(key);
    setIsAuthenticated(success);
    setIsLoading(false);
    return success;
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    await AdminApiClient.logoutSession();
    setIsAuthenticated(false);
    setIsLoading(false);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        login,
        logout,
        checkSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

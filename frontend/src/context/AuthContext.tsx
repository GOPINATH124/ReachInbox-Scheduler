import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  slackConnected: boolean;
  slackChannel?: string;
  slackTeam?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => void;
  devLogin: () => void;
  logout: () => Promise<void>;
  checkUser: () => Promise<void>;
  disconnectSlack: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const login = () => {
    // Redirect browser to backend Google OAuth redirect endpoint
    window.location.href = 'http://localhost:5000/api/auth/google';
  };

  const devLogin = () => {
    // Redirect browser to backend dev-login bypass endpoint
    window.location.href = 'http://localhost:5000/api/auth/dev-login';
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (err) {
      console.error('Logout request failed:', err);
    } finally {
      localStorage.removeItem('token');
      setUser(null);
    }
  };

  const checkUser = async () => {
    try {
      const response = await api.get('/api/auth/me');
      setUser(response.data.user);
    } catch (err) {
      console.warn('Unauthorized or user session expired.');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const disconnectSlack = async () => {
    try {
      await api.delete('/api/slack/disconnect');
      if (user) {
        setUser({
          ...user,
          slackConnected: false,
          slackChannel: undefined,
          slackTeam: undefined,
        });
      }
    } catch (err) {
      console.error('Failed to disconnect Slack:', err);
      throw err;
    }
  };

  useEffect(() => {
    checkUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, devLogin, logout, checkUser, disconnectSlack }}>
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

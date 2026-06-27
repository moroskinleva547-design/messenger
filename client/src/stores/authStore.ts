import { create } from 'zustand';
import { api } from '@/services/api';
import { socketService } from '@/services/socket';
import type { User, UserSettings } from '@/types';
import { offlineDb } from '@/services/db';

interface AuthState {
  user: User | null;
  settings: UserSettings | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  updateProfile: (data: { nickname?: string; bio?: string }) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  updateSettings: (settings: Partial<UserSettings>) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  settings: null,
  isAuthenticated: !!localStorage.getItem('token'),
  isLoading: false,
  error: null,

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const { token, user } = await api.login(username, password);
      socketService.connect(token);
      const me = await api.getMe();
      await offlineDb.saveUser(me);
      set({ user: me, settings: me.settings, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      set({ error: err.response?.data?.error || 'Login failed', isLoading: false });
      throw err;
    }
  },

  register: async (username, email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { token, user } = await api.register(username, email, password);
      socketService.connect(token);
      set({ user, settings: null, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      set({ error: err.response?.data?.error || 'Registration failed', isLoading: false });
      throw err;
    }
  },

  logout: () => {
    socketService.disconnect();
    api.setToken(null);
    offlineDb.clearAll();
    set({ user: null, settings: null, isAuthenticated: false, isLoading: false, error: null });
  },

  loadUser: async () => {
    const token = api.getToken();
    if (!token) { set({ isAuthenticated: false }); return; }
    set({ isLoading: true });
    try {
      socketService.connect(token);
      const me = await api.getMe();
      await offlineDb.saveUser(me);
      set({ user: me, settings: me.settings, isAuthenticated: true, isLoading: false });
    } catch {
      const cached = await offlineDb.getUser('me');
      if (cached) set({ user: cached, isAuthenticated: true });
      else set({ isAuthenticated: false });
      set({ isLoading: false });
    }
  },

  updateProfile: async (data) => {
    const updated = await api.updateProfile(data.nickname, data.bio);
    set({ user: { ...get().user!, ...updated } });
  },

  uploadAvatar: async (file) => {
    const { avatar_url } = await api.uploadAvatar(file);
    set({ user: { ...get().user!, avatar_url } });
  },

  updateSettings: async (settings) => {
    const updated = await api.updateSettings(settings);
    set({ settings: updated, user: { ...get().user!, settings: updated } });
    if (settings.theme) {
      document.documentElement.classList.toggle('dark', settings.theme === 'dark');
    }
  },

  clearError: () => set({ error: null }),
}));

import { create } from 'zustand';

interface UiState {
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  settingsOpen: boolean;
  settingsSection: string;
  showForwardModal: boolean;
  forwardData: { messageId: string; chatId: string } | null;
  showImagePreview: string | null;
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  replyTo: { messageId: string; content: string; sender: string } | null;

  setTheme: (theme: 'light' | 'dark') => void;
  toggleSidebar: () => void;
  setSettingsOpen: (open: boolean) => void;
  setSettingsSection: (section: string) => void;
  setShowForwardModal: (show: boolean, data?: { messageId: string; chatId: string } | null) => void;
  setShowImagePreview: (url: string | null) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  setReplyTo: (reply: { messageId: string; content: string; sender: string } | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  theme: localStorage.getItem('theme') as 'light' | 'dark' || 'dark',
  sidebarOpen: true,
  settingsOpen: false,
  settingsSection: 'appearance',
  showForwardModal: false,
  forwardData: null,
  showImagePreview: null,
  toast: null,
  replyTo: null,

  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    set({ theme });
  },

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  setSettingsOpen: (open) => set({ settingsOpen: open }),

  setSettingsSection: (section) => set({ settingsSection: section }),

  setShowForwardModal: (show, data) => set({ showForwardModal: show, forwardData: data || null }),

  setShowImagePreview: (url) => set({ showImagePreview: url }),

  showToast: (message, type = 'info') => {
    set({ toast: { message, type } });
    setTimeout(() => set({ toast: null }), 3000);
  },

  setReplyTo: (reply) => set({ replyTo: reply }),
}));

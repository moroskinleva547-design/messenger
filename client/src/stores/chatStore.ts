import { create } from 'zustand';
import { api } from '@/services/api';
import { socketService } from '@/services/socket';
import { offlineDb } from '@/services/db';
import type { Chat, Message, TypingUser } from '@/types';

interface ChatState {
  chats: Chat[];
  activeChatId: string | null;
  messages: Record<string, Message[]>;
  typingUsers: TypingUser[];
  isLoadingChats: boolean;
  isLoadingMessages: boolean;
  hasMoreMessages: Record<string, boolean>;
  error: string | null;

  loadChats: () => Promise<void>;
  setActiveChat: (chatId: string | null) => void;
  loadMessages: (chatId: string) => Promise<void>;
  loadMoreMessages: (chatId: string) => Promise<void>;
  sendMessage: (chatId: string, content: string, type?: string, replyToId?: string, forwardedFromId?: string) => Promise<void>;
  sendMedia: (chatId: string, file: File, replyToId?: string) => Promise<void>;
  editMessage: (messageId: string, content: string, chatId: string) => Promise<void>;
  deleteMessage: (messageId: string, chatId: string, deleteForAll?: boolean) => Promise<void>;
  sendTyping: (chatId: string) => void;
  stopTyping: (chatId: string) => void;
  addMessage: (message: Message) => void;
  updateMessageStatus: (messageId: string, userId: string, chatId: string) => void;
  updateMessageContent: (messageId: string, content: string, chatId: string) => void;
  removeMessage: (messageId: string, chatId: string) => void;
  handleUserTyping: (data: TypingUser) => void;
  handleUserStopTyping: (data: { chatId: string; userId: string }) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  activeChatId: null,
  messages: {},
  typingUsers: [],
  isLoadingChats: false,
  isLoadingMessages: false,
  hasMoreMessages: {},
  error: null,

  loadChats: async () => {
    set({ isLoadingChats: true });
    try {
      const chats = await api.getChats();
      await offlineDb.saveChats(chats);
      set({ chats, isLoadingChats: false });
    } catch {
      const cached = await offlineDb.getChats();
      set({ chats: cached, isLoadingChats: false });
    }
  },

  setActiveChat: (chatId) => set({ activeChatId: chatId }),

  loadMessages: async (chatId) => {
    set({ isLoadingMessages: true });
    try {
      const messages = await api.getMessages(chatId, 50, 0);
      await offlineDb.saveMessages(chatId, messages);
      set((s) => ({
        messages: { ...s.messages, [chatId]: messages.reverse() },
        hasMoreMessages: { ...s.hasMoreMessages, [chatId]: messages.length >= 50 },
        isLoadingMessages: false,
      }));
    } catch {
      const cached = await offlineDb.getMessages(chatId);
      set((s) => ({
        messages: { ...s.messages, [chatId]: cached },
        isLoadingMessages: false,
      }));
    }
  },

  loadMoreMessages: async (chatId) => {
    const current = get().messages[chatId] || [];
    const offset = current.length;
    try {
      const older = await api.getMessages(chatId, 50, offset);
      set((s) => ({
        messages: { ...s.messages, [chatId]: [...older.reverse(), ...current] },
        hasMoreMessages: { ...s.hasMoreMessages, [chatId]: older.length >= 50 },
      }));
    } catch {}
  },

  sendMessage: async (chatId, content, type = 'text', replyToId, forwardedFromId) => {
    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      chat_id: chatId,
      sender_id: 'me',
      content,
      type: type as any,
      media_url: '',
      created_at: new Date().toISOString(),
      is_own: true,
      status: 'sending',
      temp_id: tempId,
    };
    set((s) => ({
      messages: { ...s.messages, [chatId]: [...(s.messages[chatId] || []), optimistic] },
      chats: s.chats.map((c) =>
        c.id === chatId
          ? { ...c, last_message: content, last_message_at: new Date().toISOString(), last_message_type: type }
          : c
      ),
    }));
    socketService.sendMessage({
      chatId, content, type, replyToId, forwardedFromId, tempId,
    });
  },

  sendMedia: async (chatId, file, replyToId) => {
    const formData = new FormData();
    formData.append('files', file);
    if (replyToId) formData.append('reply_to_id', replyToId);
    try {
      const msg = await api.sendMessage(chatId, formData);
      set((s) => ({
        messages: { ...s.messages, [chatId]: [...(s.messages[chatId] || []), msg] },
      }));
    } catch {}
  },

  editMessage: async (messageId, content, chatId) => {
    await api.editMessage(messageId, content);
    socketService.messageUpdated({ messageId, content, chatId });
    set((s) => ({
      messages: {
        ...s.messages,
        [chatId]: (s.messages[chatId] || []).map((m) =>
          m.id === messageId ? { ...m, content, edited_at: new Date().toISOString() } : m
        ),
      },
    }));
  },

  deleteMessage: async (messageId, chatId, deleteForAll) => {
    await api.deleteMessage(messageId, deleteForAll);
    socketService.messageDeleted({ messageId, chatId, deleteForAll });
    set((s) => ({
      messages: {
        ...s.messages,
        [chatId]: (s.messages[chatId] || []).filter((m) => m.id !== messageId),
      },
    }));
  },

  sendTyping: (chatId) => socketService.sendTyping(chatId),

  stopTyping: (chatId) => socketService.sendStopTyping(chatId),

  addMessage: (message) => {
    set((s) => {
      const existing = s.messages[message.chat_id] || [];
      const idx = existing.findIndex((m) => m.temp_id === message.temp_id || m.id === message.id);
      let newMessages: Message[];
      if (idx !== -1) {
        newMessages = [...existing];
        newMessages[idx] = { ...message, is_own: newMessages[idx].is_own, status: 'sent' };
      } else {
        newMessages = [...existing, { ...message, is_own: message.sender_id === s.chats.find(c => c.id === message.chat_id)?.other_user?.id ? false : message.is_own }];
      }
      return {
        messages: { ...s.messages, [message.chat_id]: newMessages },
        chats: s.chats.map((c) =>
          c.id === message.chat_id
            ? { ...c, last_message: message.content, last_message_at: message.created_at, last_message_type: message.type, unread_count: message.sender_id !== 'me' ? (c.unread_count || 0) + 1 : c.unread_count }
            : c
        ),
      };
    });
  },

  updateMessageStatus: (messageId, userId, chatId) => {
    set((s) => ({
      messages: {
        ...s.messages,
        [chatId]: (s.messages[chatId] || []).map((m) =>
          m.id === messageId ? { ...m, status: 'read' as const } : m
        ),
      },
    }));
  },

  updateMessageContent: (messageId, content, chatId) => {
    set((s) => ({
      messages: {
        ...s.messages,
        [chatId]: (s.messages[chatId] || []).map((m) =>
          m.id === messageId ? { ...m, content, edited_at: new Date().toISOString() } : m
        ),
      },
    }));
  },

  removeMessage: (messageId, chatId) => {
    set((s) => ({
      messages: {
        ...s.messages,
        [chatId]: (s.messages[chatId] || []).filter((m) => m.id !== messageId),
      },
    }));
  },

  handleUserTyping: (data) => {
    set((s) => {
      const exists = s.typingUsers.find((t) => t.userId === data.userId && t.chatId === data.chatId);
      if (exists) return s;
      return { typingUsers: [...s.typingUsers, data] };
    });
  },

  handleUserStopTyping: (data) => {
    set((s) => ({
      typingUsers: s.typingUsers.filter((t) => !(t.userId === data.userId && t.chatId === data.chatId)),
    }));
  },
}));

import { io, Socket } from 'socket.io-client';
import type { Message, TypingUser } from '@/types';

type EventHandler = (...args: any[]) => void;

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<EventHandler>> = new Map();

  connect(token: string) {
    if (this.socket?.connected) return;
    this.socket = io('/', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    this.socket.on('connect', () => console.log('Socket connected'));
    this.socket.on('disconnect', () => console.log('Socket disconnected'));
    this.socket.on('connect_error', (err) => console.error('Socket error:', err.message));
    this.reapplyListeners();
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  onNewMessage(handler: (message: Message) => void) {
    this.on('new_message', handler);
  }

  onMessageRead(handler: (data: { messageId: string; userId: string; chatId: string }) => void) {
    this.on('message_read', handler);
  }

  onMessageUpdated(handler: (data: { messageId: string; content: string; chatId: string }) => void) {
    this.on('message_updated', handler);
  }

  onMessageDeleted(handler: (data: { messageId: string; chatId: string }) => void) {
    this.on('message_deleted', handler);
  }

  onUserTyping(handler: (data: TypingUser) => void) {
    this.on('user_typing', handler);
  }

  onUserStopTyping(handler: (data: { chatId: string; userId: string }) => void) {
    this.on('user_stop_typing', handler);
  }

  onUserStatus(handler: (data: { userId: string; status: string; last_seen?: string }) => void) {
    this.on('user_status', handler);
  }

  sendMessage(data: { chatId: string; content?: string; type?: string; mediaUrl?: string; mediaSize?: number; mediaName?: string; replyToId?: string; forwardedFromId?: string; tempId?: string }) {
    this.emit('send_message', data);
  }

  sendTyping(chatId: string) {
    this.emit('typing', { chatId });
  }

  sendStopTyping(chatId: string) {
    this.emit('stop_typing', { chatId });
  }

  markRead(messageId: string, chatId: string) {
    this.emit('mark_read', { messageId, chatId });
  }

  messageUpdated(data: { messageId: string; content: string; chatId: string }) {
    this.emit('message_updated', data);
  }

  messageDeleted(data: { messageId: string; chatId: string; deleteForAll?: boolean }) {
    this.emit('message_deleted', data);
  }

  private on(event: string, handler: EventHandler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
    this.socket?.on(event, handler);
  }

  private emit(event: string, data: any) {
    this.socket?.emit(event, data);
  }

  private reapplyListeners() {
    if (!this.socket) return;
    for (const [event, handlers] of this.listeners.entries()) {
      for (const handler of handlers) {
        this.socket.on(event, handler);
      }
    }
  }

  off(handler: EventHandler) {
    for (const [event, handlers] of this.listeners.entries()) {
      if (handlers.has(handler)) {
        handlers.delete(handler);
        this.socket?.off(event, handler);
      }
    }
  }
}

export const socketService = new SocketService();

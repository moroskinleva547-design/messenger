import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { getDb } from './database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'messenger-jwt-secret-2024';

interface AuthSocket extends Socket {
  userId?: string;
}

const typingUsers: Map<string, { userId: string; username: string; timeout: NodeJS.Timeout }[]> = new Map();

export function setupSocket(httpServer: HTTPServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  io.use((socket: AuthSocket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) { return next(new Error('Authentication error')); }
    try {
      const decoded = jwt.verify(token as string, JWT_SECRET) as { userId: string };
      socket.userId = decoded.userId;
      next();
    } catch {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket: AuthSocket) => {
    const userId = socket.userId!;
    const db = getDb();
    const user = db.prepare('SELECT id, username, nickname, avatar_url, status FROM users WHERE id = ?').get(userId) as any;
    if (!user) { socket.disconnect(); return; }

    db.prepare("UPDATE users SET status = 'online', last_seen = datetime('now') WHERE id = ?").run(userId);
    socket.join(`user:${userId}`);

    const chats = db.prepare('SELECT chat_id FROM chat_participants WHERE user_id = ?').all(userId);
    for (const chat of chats as any[]) {
      socket.join(`chat:${chat.chat_id}`);
    }

    socket.broadcast.emit('user_status', { userId, status: 'online' });

    socket.on('send_message', (data: { chatId: string; content?: string; type?: string; mediaUrl?: string; mediaSize?: number; mediaName?: string; replyToId?: string; forwardedFromId?: string; tempId?: string }) => {
      const { v4: uuidv4 } = require('uuid');
      const messageId = uuidv4();
      const now = new Date().toISOString();
      const msgType = data.type || 'text';

      db.prepare(
        'INSERT INTO messages (id, chat_id, sender_id, content, type, media_url, media_size, media_name, reply_to_id, forwarded_from_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(messageId, data.chatId, userId, data.content || '', msgType, data.mediaUrl || '', data.mediaSize || 0, data.mediaName || '', data.replyToId || null, data.forwardedFromId || null, now);

      const participants = db.prepare('SELECT user_id FROM chat_participants WHERE chat_id = ? AND user_id != ?').all(data.chatId, userId);
      const insertStatus = db.prepare('INSERT OR IGNORE INTO message_status (message_id, user_id, status) VALUES (?, ?, ?)');
      for (const p of participants as any[]) {
        insertStatus.run(messageId, p.user_id, 'sent');
      }

      const message = db.prepare(
        `SELECT m.*, u.username as sender_username, u.nickname as sender_nickname, u.avatar_url as sender_avatar
         FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?`
      ).get(messageId) as any;

      io.to(`chat:${data.chatId}`).emit('new_message', { ...message, is_own: false, temp_id: data.tempId });
    });

    socket.on('typing', (data: { chatId: string }) => {
      socket.to(`chat:${data.chatId}`).emit('user_typing', { chatId: data.chatId, userId, username: user.nickname || user.username });

      if (!typingUsers.has(data.chatId)) typingUsers.set(data.chatId, []);
      const list = typingUsers.get(data.chatId)!;
      const existing = list.find(t => t.userId === userId);
      if (existing) clearTimeout(existing.timeout);
      else list.push({ userId, username: user.nickname || user.username, timeout: null! });
      const entry = list.find(t => t.userId === userId)!;
      entry.timeout = setTimeout(() => {
        socket.to(`chat:${data.chatId}`).emit('user_stop_typing', { chatId: data.chatId, userId });
        const idx = list.findIndex(t => t.userId === userId);
        if (idx !== -1) list.splice(idx, 1);
        if (list.length === 0) typingUsers.delete(data.chatId);
      }, 3000);
    });

    socket.on('stop_typing', (data: { chatId: string }) => {
      socket.to(`chat:${data.chatId}`).emit('user_stop_typing', { chatId: data.chatId, userId });
      if (typingUsers.has(data.chatId)) {
        const list = typingUsers.get(data.chatId)!;
        const idx = list.findIndex(t => t.userId === userId);
        if (idx !== -1) { clearTimeout(list[idx].timeout); list.splice(idx, 1); }
        if (list.length === 0) typingUsers.delete(data.chatId);
      }
    });

    socket.on('mark_read', (data: { messageId: string; chatId: string }) => {
      db.prepare("UPDATE message_status SET status = 'read', read_at = datetime('now') WHERE message_id = ? AND user_id = ?").run(data.messageId, userId);
      const msg = db.prepare('SELECT sender_id FROM messages WHERE id = ?').get(data.messageId) as any;
      if (msg) {
        io.to(`chat:${data.chatId}`).emit('message_read', { messageId: data.messageId, userId, chatId: data.chatId });
      }
    });

    socket.on('message_updated', (data: { messageId: string; content: string; chatId: string }) => {
      db.prepare("UPDATE messages SET content = ?, edited_at = datetime('now') WHERE id = ? AND sender_id = ?").run(data.content, data.messageId, userId);
      io.to(`chat:${data.chatId}`).emit('message_updated', { messageId: data.messageId, content: data.content, chatId: data.chatId });
    });

    socket.on('message_deleted', (data: { messageId: string; chatId: string; deleteForAll?: boolean }) => {
      db.prepare("UPDATE messages SET deleted_at = datetime('now'), content = '[deleted]' WHERE id = ?").run(data.messageId);
      io.to(`chat:${data.chatId}`).emit('message_deleted', { messageId: data.messageId, chatId: data.chatId });
    });

    socket.on('disconnect', () => {
      db.prepare("UPDATE users SET status = 'offline', last_seen = datetime('now') WHERE id = ?").run(userId);
      socket.broadcast.emit('user_status', { userId, status: 'offline', last_seen: new Date().toISOString() });
      for (const [chatId, list] of typingUsers.entries()) {
        const idx = list.findIndex(t => t.userId === userId);
        if (idx !== -1) { clearTimeout(list[idx].timeout); list.splice(idx, 1); }
        if (list.length === 0) typingUsers.delete(chatId);
      }
    });
  });

  return io;
}

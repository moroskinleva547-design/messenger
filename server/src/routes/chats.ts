import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const chats = db.prepare(
    `SELECT c.*, 
      (SELECT content FROM messages m WHERE m.chat_id = c.id AND m.deleted_at IS NULL ORDER BY m.created_at DESC LIMIT 1) as last_message,
      (SELECT created_at FROM messages m WHERE m.chat_id = c.id AND m.deleted_at IS NULL ORDER BY m.created_at DESC LIMIT 1) as last_message_at,
      (SELECT sender_id FROM messages m WHERE m.chat_id = c.id AND m.deleted_at IS NULL ORDER BY m.created_at DESC LIMIT 1) as last_message_sender_id,
      (SELECT type FROM messages m WHERE m.chat_id = c.id AND m.deleted_at IS NULL ORDER BY m.created_at DESC LIMIT 1) as last_message_type,
      (SELECT COUNT(*) FROM messages m WHERE m.chat_id = c.id AND m.deleted_at IS NULL AND m.created_at > COALESCE(
        (SELECT MAX(ms.read_at) FROM message_status ms WHERE ms.message_id IN (SELECT id FROM messages WHERE chat_id = c.id) AND ms.user_id = ?), '1970-01-01'
      )) as unread_count
    FROM chats c
    JOIN chat_participants cp ON cp.chat_id = c.id AND cp.user_id = ?
    ORDER BY last_message_at DESC`
  ).all(req.userId, req.userId);

  const chatList = chats.map((chat: any) => {
    let chatName = chat.name;
    let chatAvatar = chat.avatar_url;
    if (chat.type === 'private') {
      const otherUser = db.prepare(
        `SELECT u.id, u.username, u.nickname, u.avatar_url, u.status, u.last_seen 
         FROM users u JOIN chat_participants cp ON cp.user_id = u.id 
         WHERE cp.chat_id = ? AND u.id != ?`
      ).get(chat.id, req.userId) as any;
      if (otherUser) {
        chatName = otherUser.nickname || otherUser.username;
        chatAvatar = otherUser.avatar_url;
        chat.other_user = otherUser;
      }
    }
    return { ...chat, name: chatName, avatar_url: chatAvatar };
  });

  res.json(chatList);
});

router.post('/', authenticateToken, (req: AuthRequest, res: Response) => {
  const { participantIds, name, type = 'private' } = req.body;
  if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
    res.status(400).json({ error: 'At least one participant is required' });
    return;
  }
  const userIds = [req.userId, ...participantIds.filter((id: string) => id !== req.userId)];

  if (type === 'private' && userIds.length === 2) {
    const db = getDb();
    const existing = db.prepare(
      `SELECT c.id FROM chats c 
       JOIN chat_participants cp1 ON cp1.chat_id = c.id AND cp1.user_id = ?
       JOIN chat_participants cp2 ON cp2.chat_id = c.id AND cp2.user_id = ?
       WHERE c.type = 'private'
       AND (SELECT COUNT(*) FROM chat_participants WHERE chat_id = c.id) = 2`
    ).get(userIds[0], userIds[1]) as any;
    if (existing) {
      res.json({ id: existing.id, exists: true });
      return;
    }
  }

  const chatId = uuidv4();
  const db = getDb();
  db.prepare('INSERT INTO chats (id, type, name, created_by) VALUES (?, ?, ?, ?)').run(chatId, type, name || null, req.userId);
  const insertParticipant = db.prepare('INSERT INTO chat_participants (chat_id, user_id) VALUES (?, ?)');
  for (const uid of [...new Set(userIds)]) {
    insertParticipant.run(chatId, uid);
  }

  if (type === 'private' && userIds.length === 2) {
    const otherUser = db.prepare('SELECT id, username, nickname, avatar_url, status, last_seen FROM users WHERE id = ?').get(userIds.find(id => id !== req.userId)) as any;
    res.json({ id: chatId, type, name: otherUser?.nickname || otherUser?.username, avatar_url: otherUser?.avatar_url, other_user: otherUser });
  } else {
    res.json({ id: chatId, type, name, avatar_url: '' });
  }
});

router.get('/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(req.params.id) as any;
  if (!chat) { res.status(404).json({ error: 'Chat not found' }); return; }
  const participants = db.prepare(
    'SELECT u.id, u.username, u.nickname, u.avatar_url, u.status FROM users u JOIN chat_participants cp ON cp.user_id = u.id WHERE cp.chat_id = ?'
  ).all(req.params.id);
  res.json({ ...chat, participants });
});

export default router;

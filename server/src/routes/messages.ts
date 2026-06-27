import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

const router = Router();

router.get('/:chatId', authenticateToken, (req: AuthRequest, res: Response) => {
  const { chatId } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const db = getDb();

  const isParticipant = db.prepare('SELECT 1 FROM chat_participants WHERE chat_id = ? AND user_id = ?').get(chatId, req.userId);
  if (!isParticipant) { res.status(403).json({ error: 'Not a participant' }); return; }

  const messages = db.prepare(
    `SELECT m.*, u.username as sender_username, u.nickname as sender_nickname, u.avatar_url as sender_avatar
     FROM messages m JOIN users u ON u.id = m.sender_id
     WHERE m.chat_id = ? AND m.deleted_at IS NULL
     ORDER BY m.created_at DESC LIMIT ? OFFSET ?`
  ).all(chatId, limit, offset);

  const statuses = db.prepare(
    `SELECT ms.message_id, ms.user_id, ms.status, ms.read_at FROM message_status ms WHERE ms.message_id IN (${messages.map(() => '?').join(',')})`
  ).all(...messages.map(m => (m as any).id));

  const statusMap: Record<string, any[]> = {};
  for (const s of statuses as any[]) {
    if (!statusMap[s.message_id]) statusMap[s.message_id] = [];
    statusMap[s.message_id].push(s);
  }

  const result = messages.map(msg => ({
    ...msg,
    statuses: statusMap[msg.id] || [],
    is_own: msg.sender_id === req.userId,
  }));

  res.json(result);
});

router.post('/:chatId', authenticateToken, upload.array('files'), async (req: AuthRequest, res: Response) => {
  const { chatId } = req.params;
  const { content, type = 'text', reply_to_id, forwarded_from_id } = req.body;
  const db = getDb();

  const isParticipant = db.prepare('SELECT 1 FROM chat_participants WHERE chat_id = ? AND user_id = ?').get(chatId, req.userId);
  if (!isParticipant) { res.status(403).json({ error: 'Not a participant' }); return; }

  const messageId = uuidv4();
  const files = req.files as Express.Multer.File[];
  let mediaUrl = '';
  let mediaSize = 0;
  let mediaName = '';
  let msgType = type;

  if (files && files.length > 0) {
    const file = files[0];
    if (file.mimetype.startsWith('image/')) {
      const filename = `${uuidv4()}-preview.webp`;
      const outputPath = path.join(uploadsDir, filename);
      try {
        await sharp(file.path).resize(1920, 1080, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toFile(outputPath);
        fs.unlinkSync(file.path);
        mediaUrl = `/uploads/${filename}`;
      } catch {
        mediaUrl = `/uploads/${file.filename}`;
      }
      msgType = 'image';
    } else {
      mediaUrl = `/uploads/${file.filename}`;
      msgType = 'document';
    }
    mediaSize = file.size;
    mediaName = file.originalname;
  }

  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO messages (id, chat_id, sender_id, content, type, media_url, media_size, media_name, reply_to_id, forwarded_from_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(messageId, chatId, req.userId, content, msgType, mediaUrl, mediaSize, mediaName, reply_to_id || null, forwarded_from_id || null, now);

  const participants = db.prepare('SELECT user_id FROM chat_participants WHERE chat_id = ? AND user_id != ?').all(chatId, req.userId);
  const insertStatus = db.prepare('INSERT OR IGNORE INTO message_status (message_id, user_id, status) VALUES (?, ?, ?)');
  for (const p of participants as any[]) {
    insertStatus.run(messageId, p.user_id, 'sent');
  }

  const message = db.prepare(
    `SELECT m.*, u.username as sender_username, u.nickname as sender_nickname, u.avatar_url as sender_avatar
     FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?`
  ).get(messageId) as any;

  res.status(201).json({ ...message, is_own: true });
});

router.put('/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  const { content } = req.body;
  const db = getDb();
  const msg = db.prepare('SELECT * FROM messages WHERE id = ? AND sender_id = ? AND deleted_at IS NULL').get(req.params.id, req.userId) as any;
  if (!msg) { res.status(404).json({ error: 'Message not found or cannot edit' }); return; }
  db.prepare("UPDATE messages SET content = ?, edited_at = datetime('now') WHERE id = ?").run(content, req.params.id);
  const updated = db.prepare(
    `SELECT m.*, u.username as sender_username, u.nickname as sender_nickname, u.avatar_url as sender_avatar
     FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?`
  ).get(req.params.id);
  res.json(updated);
});

router.delete('/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  const { deleteForAll } = req.query;
  const db = getDb();
  const msg = db.prepare('SELECT * FROM messages WHERE id = ? AND deleted_at IS NULL').get(req.params.id) as any;
  if (!msg) { res.status(404).json({ error: 'Message not found' }); return; }
  if (deleteForAll === 'true') {
    if (msg.sender_id !== req.userId) { res.status(403).json({ error: 'Cannot delete for all' }); return; }
    db.prepare("UPDATE messages SET deleted_at = datetime('now'), content = '[deleted]' WHERE id = ?").run(req.params.id);
  } else {
    if (msg.sender_id !== req.userId) {
      db.prepare("UPDATE messages SET deleted_at = datetime('now'), content = '[deleted]' WHERE id = ?").run(req.params.id);
    } else {
      db.prepare("UPDATE messages SET deleted_at = datetime('now'), content = '[deleted]' WHERE id = ?").run(req.params.id);
    }
  }
  res.json({ success: true, messageId: req.params.id, deleteForAll: deleteForAll === 'true' });
});

router.put('/:id/read', authenticateToken, (req: AuthRequest, res: Response) => {
  const db = getDb();
  db.prepare("UPDATE message_status SET status = 'read', read_at = datetime('now') WHERE message_id = ? AND user_id = ?").run(req.params.id, req.userId);
  res.json({ success: true });
});

router.post('/:chatId/read-all', authenticateToken, (req: AuthRequest, res: Response) => {
  const { chatId } = req.params;
  const db = getDb();
  db.prepare(
    `UPDATE message_status SET status = 'read', read_at = datetime('now') 
     WHERE message_id IN (SELECT id FROM messages WHERE chat_id = ?) AND user_id = ? AND status != 'read'`
  ).run(chatId, req.userId);
  res.json({ success: true });
});

export default router;

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
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

router.get('/search', authenticateToken, (req: AuthRequest, res: Response) => {
  const q = req.query.q as string;
  if (!q || q.length < 1) { res.json([]); return; }
  const db = getDb();
  const users = db.prepare(
    "SELECT id, username, nickname, avatar_url, status FROM users WHERE (username LIKE ? OR nickname LIKE ?) AND id != ? LIMIT 20"
  ).all(`%${q}%`, `%${q}%`, req.userId);
  res.json(users);
});

router.get('/blocked', authenticateToken, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const blocked = db.prepare(
    `SELECT u.id, u.username, u.nickname, u.avatar_url FROM blocked_users b JOIN users u ON u.id = b.blocked_user_id WHERE b.user_id = ?`
  ).all(req.userId);
  res.json(blocked);
});

router.post('/block/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  if (req.params.id === req.userId) { res.status(400).json({ error: 'Cannot block yourself' }); return; }
  const db = getDb();
  try {
    db.prepare('INSERT OR IGNORE INTO blocked_users (user_id, blocked_user_id) VALUES (?, ?)').run(req.userId, req.params.id);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed to block user' }); }
});

router.delete('/block/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?').run(req.userId, req.params.id);
  res.json({ success: true });
});

router.put('/avatar', authenticateToken, upload.single('avatar'), async (req: AuthRequest, res: Response) => {
  if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }
  try {
    const filename = `${uuidv4()}.webp`;
    const outputPath = path.join(uploadsDir, filename);
    await sharp(req.file.path).resize(256, 256, { fit: 'cover' }).webp({ quality: 80 }).toFile(outputPath);
    fs.unlinkSync(req.file.path);
    const db = getDb();
    db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(`/uploads/${filename}`, req.userId);
    res.json({ avatar_url: `/uploads/${filename}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process image' });
  }
});

router.get('/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const user = db.prepare('SELECT id, username, nickname, avatar_url, bio, status, last_seen FROM users WHERE id = ?').get(req.params.id) as any;
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  const settings = db.prepare('SELECT hide_last_seen FROM user_settings WHERE user_id = ?').get(req.params.id) as any;
  if (settings?.hide_last_seen) user.last_seen = null;
  res.json(user);
});

export default router;

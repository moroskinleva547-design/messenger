import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database.js';
import { generateToken, authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.post('/register', (req: Request, res: Response) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    res.status(400).json({ error: 'Username, email and password are required' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }
  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
  if (existing) {
    res.status(409).json({ error: 'Username or email already exists' });
    return;
  }
  const id = uuidv4();
  const password_hash = bcrypt.hashSync(password, 10);
  db.prepare(
    'INSERT INTO users (id, username, email, password_hash, nickname) VALUES (?, ?, ?, ?, ?)'
  ).run(id, username, email, password_hash, username);
  db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(id);
  const token = generateToken(id);
  res.status(201).json({ token, user: { id, username, email, nickname: username, avatar_url: '', bio: '', status: 'online' } });
});

router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username) as any;
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  db.prepare("UPDATE users SET status = 'online', last_seen = datetime('now') WHERE id = ?").run(user.id);
  const token = generateToken(user.id);
  res.json({
    token,
    user: { id: user.id, username: user.username, email: user.email, nickname: user.nickname, avatar_url: user.avatar_url, bio: user.bio, status: 'online' },
  });
});

router.get('/me', authenticateToken, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const user = db.prepare('SELECT id, username, email, nickname, avatar_url, bio, status, last_seen, created_at FROM users WHERE id = ?').get(req.userId) as any;
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.userId) as any;
  res.json({ ...user, settings: settings || {} });
});

router.put('/me', authenticateToken, (req: AuthRequest, res: Response) => {
  const { nickname, bio } = req.body;
  const db = getDb();
  if (nickname !== undefined) db.prepare('UPDATE users SET nickname = ? WHERE id = ?').run(nickname, req.userId);
  if (bio !== undefined) db.prepare('UPDATE users SET bio = ? WHERE id = ?').run(bio, req.userId);
  const user = db.prepare('SELECT id, username, email, nickname, avatar_url, bio, status, last_seen FROM users WHERE id = ?').get(req.userId) as any;
  res.json(user);
});

export default router;

import { Router, Response } from 'express';
import { getDb } from '../database.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, (req: AuthRequest, res: Response) => {
  const db = getDb();
  let settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.userId) as any;
  if (!settings) {
    db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(req.userId);
    settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.userId) as any;
  }
  res.json(settings);
});

router.put('/', authenticateToken, (req: AuthRequest, res: Response) => {
  const { theme, background_url, hide_last_seen, notifications_enabled, sound_enabled, push_enabled } = req.body;
  const db = getDb();
  const updates: string[] = [];
  const params: any[] = [];
  if (theme !== undefined) { updates.push('theme = ?'); params.push(theme); }
  if (background_url !== undefined) { updates.push('background_url = ?'); params.push(background_url); }
  if (hide_last_seen !== undefined) { updates.push('hide_last_seen = ?'); params.push(hide_last_seen ? 1 : 0); }
  if (notifications_enabled !== undefined) { updates.push('notifications_enabled = ?'); params.push(notifications_enabled ? 1 : 0); }
  if (sound_enabled !== undefined) { updates.push('sound_enabled = ?'); params.push(sound_enabled ? 1 : 0); }
  if (push_enabled !== undefined) { updates.push('push_enabled = ?'); params.push(push_enabled ? 1 : 0); }
  if (updates.length > 0) {
    params.push(req.userId);
    db.prepare(`UPDATE user_settings SET ${updates.join(', ')} WHERE user_id = ?`).run(...params);
  }
  const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.userId);
  res.json(settings);
});

export default router;

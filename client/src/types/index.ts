export interface User {
  id: string;
  username: string;
  email?: string;
  nickname: string;
  avatar_url: string;
  bio: string;
  status: 'online' | 'offline' | 'away';
  last_seen?: string;
  created_at?: string;
  settings?: UserSettings;
}

export interface UserSettings {
  theme: 'light' | 'dark';
  background_url: string;
  hide_last_seen: number;
  notifications_enabled: number;
  sound_enabled: number;
  push_enabled: number;
}

export interface Chat {
  id: string;
  type: 'private' | 'group';
  name: string;
  avatar_url: string;
  created_by?: string;
  created_at: string;
  last_message?: string;
  last_message_at?: string;
  last_message_sender_id?: string;
  last_message_type?: string;
  unread_count: number;
  other_user?: User;
  participants?: User[];
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  type: 'text' | 'image' | 'document' | 'voice' | 'system';
  media_url: string;
  media_size?: number;
  media_name?: string;
  reply_to_id?: string;
  forwarded_from_id?: string;
  edited_at?: string;
  deleted_at?: string;
  created_at: string;
  sender_username?: string;
  sender_nickname?: string;
  sender_avatar?: string;
  is_own?: boolean;
  statuses?: MessageStatus[];
  temp_id?: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
}

export interface MessageStatus {
  message_id: string;
  user_id: string;
  status: 'sent' | 'delivered' | 'read';
  read_at?: string;
}

export interface TypingUser {
  userId: string;
  username: string;
  chatId: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface SenderInfo {
  id: string;
  username: string;
  nickname: string;
  avatar_url: string;
}

export const StatusIcons = {
  sending: 'clock',
  sent: 'check',
  delivered: 'check-check',
  read: 'check-check',
  failed: 'alert-circle',
} as const;

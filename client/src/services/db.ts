import { openDB, IDBPDatabase } from 'idb';
import type { Chat, Message, User } from '@/types';

const DB_NAME = 'messenger-offline';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('chats')) {
          db.createObjectStore('chats', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('messages')) {
          const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
          msgStore.createIndex('chat_id', 'chat_id');
          msgStore.createIndex('created_at', 'created_at');
        }
        if (!db.objectStoreNames.contains('users')) {
          db.createObjectStore('users', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('pending')) {
          db.createObjectStore('pending', { keyPath: 'tempId', autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}

export const offlineDb = {
  async saveChats(chats: Chat[]) {
    const db = await getDb();
    const tx = db.transaction('chats', 'readwrite');
    for (const chat of chats) {
      await tx.store.put(chat);
    }
    await tx.done;
  },

  async getChats(): Promise<Chat[]> {
    const db = await getDb();
    return db.getAll('chats');
  },

  async saveMessages(chatId: string, messages: Message[]) {
    const db = await getDb();
    const tx = db.transaction('messages', 'readwrite');
    for (const msg of messages) {
      await tx.store.put(msg);
    }
    await tx.done;
  },

  async getMessages(chatId: string): Promise<Message[]> {
    const db = await getDb();
    const index = db.transaction('messages').store.index('chat_id');
    return index.getAll(chatId);
  },

  async saveMessage(message: Message) {
    const db = await getDb();
    await db.put('messages', message);
  },

  async saveUser(user: User) {
    const db = await getDb();
    await db.put('users', user);
  },

  async getUser(userId: string): Promise<User | undefined> {
    const db = await getDb();
    return db.get('users', userId);
  },

  async addPendingMessage(msg: { chatId: string; content: string; type: string; tempId: string }) {
    const db = await getDb();
    await db.add('pending', msg);
  },

  async getPendingMessages(): Promise<any[]> {
    const db = await getDb();
    return db.getAll('pending');
  },

  async removePending(tempId: string) {
    const db = await getDb();
    await db.delete('pending', tempId);
  },

  async clearAll() {
    const db = await getDb();
    await db.clear('chats');
    await db.clear('messages');
    await db.clear('users');
    await db.clear('pending');
  },
};

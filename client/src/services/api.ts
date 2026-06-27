import axios, { AxiosInstance } from 'axios';
import type { User, Chat, Message, AuthResponse, UserSettings } from '@/types';

const API_BASE = '/api';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE,
      headers: { 'Content-Type': 'application/json' },
    });
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
  }

  setToken(token: string | null) {
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  async register(username: string, email: string, password: string): Promise<AuthResponse> {
    const { data } = await this.client.post('/auth/register', { username, email, password });
    this.setToken(data.token);
    return data;
  }

  async login(username: string, password: string): Promise<AuthResponse> {
    const { data } = await this.client.post('/auth/login', { username, password });
    this.setToken(data.token);
    return data;
  }

  async getMe(): Promise<User & { settings: UserSettings }> {
    const { data } = await this.client.get('/auth/me');
    return data;
  }

  async updateProfile(nickname?: string, bio?: string): Promise<User> {
    const { data } = await this.client.put('/auth/me', { nickname, bio });
    return data;
  }

  async uploadAvatar(file: File): Promise<{ avatar_url: string }> {
    const form = new FormData();
    form.append('avatar', file);
    const { data } = await this.client.put('/users/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }

  async getChats(): Promise<Chat[]> {
    const { data } = await this.client.get('/chats');
    return data;
  }

  async createChat(participantIds: string[], name?: string, type?: string): Promise<Chat> {
    const { data } = await this.client.post('/chats', { participantIds, name, type });
    return data;
  }

  async getChat(chatId: string): Promise<Chat> {
    const { data } = await this.client.get(`/chats/${chatId}`);
    return data;
  }

  async getMessages(chatId: string, limit = 50, offset = 0): Promise<Message[]> {
    const { data } = await this.client.get(`/messages/${chatId}`, { params: { limit, offset } });
    return data;
  }

  async sendMessage(chatId: string, formData: FormData): Promise<Message> {
    const { data } = await this.client.post(`/messages/${chatId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }

  async editMessage(messageId: string, content: string): Promise<Message> {
    const { data } = await this.client.put(`/messages/${messageId}`, { content });
    return data;
  }

  async deleteMessage(messageId: string, deleteForAll = false): Promise<void> {
    await this.client.delete(`/messages/${messageId}`, { params: { deleteForAll } });
  }

  async markRead(messageId: string): Promise<void> {
    await this.client.put(`/messages/${messageId}/read`);
  }

  async markChatRead(chatId: string): Promise<void> {
    await this.client.post(`/messages/${chatId}/read-all`);
  }

  async searchUsers(q: string): Promise<User[]> {
    const { data } = await this.client.get('/users/search', { params: { q } });
    return data;
  }

  async getBlockedUsers(): Promise<User[]> {
    const { data } = await this.client.get('/users/blocked');
    return data;
  }

  async blockUser(userId: string): Promise<void> {
    await this.client.post(`/users/block/${userId}`);
  }

  async unblockUser(userId: string): Promise<void> {
    await this.client.delete(`/users/block/${userId}`);
  }

  async getSettings(): Promise<UserSettings> {
    const { data } = await this.client.get('/settings');
    return data;
  }

  async updateSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
    const { data } = await this.client.put('/settings', settings);
    return data;
  }

  async getUser(id: string): Promise<User> {
    const { data } = await this.client.get(`/users/${id}`);
    return data;
  }
}

export const api = new ApiService();

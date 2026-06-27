import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from '@/components/common/Modal';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { api } from '@/services/api';
import { useChatStore } from '@/stores/chatStore';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus } from 'lucide-react';
import type { User } from '@/types';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewChatModal({ isOpen, onClose }: NewChatModalProps) {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const { createChat } = useChatStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!search.trim()) { setUsers([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await api.searchUsers(search);
        setUsers(results);
      } catch {}
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const startChat = async (userId: string) => {
    try {
      const chat = await api.createChat([userId]);
      onClose();
      navigate(`/chat/${chat.id}`);
    } catch {}
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Conversation">
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
          className="w-full pl-9 pr-3 py-2.5 bg-gray-100 dark:bg-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30"
        />
      </div>
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-4">Searching...</p>
        ) : users.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <UserPlus size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Search for users to start chatting</p>
          </div>
        ) : (
          <AnimatePresence>
            {users.map((u) => (
              <motion.button
                key={u.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => startChat(u.id)}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <Avatar src={u.avatar_url} name={u.nickname || u.username} size="md" status={u.status} />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{u.nickname || u.username}</p>
                  <p className="text-xs text-gray-500">@{u.username}</p>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        )}
      </div>
    </Modal>
  );
}

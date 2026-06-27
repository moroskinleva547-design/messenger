import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import { Avatar } from '@/components/common/Avatar';
import { ChatSkeleton } from '@/components/common/Skeleton';
import { formatTime, truncate } from '@/utils/format';
import { Search, Plus, MessageSquare, LogOut, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function ChatList() {
  const { chats, activeChatId, setActiveChat, loadChats, isLoadingChats } = useChatStore();
  const { user, logout } = useAuthStore();
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadChats();
  }, []);

  const filteredChats = chats.filter((c) =>
    c.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      <div className="p-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Chats</h1>
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/new-chat')}
              className="p-2 rounded-xl bg-primary-500 text-white shadow-lg shadow-primary-500/25"
            >
              <Plus size={20} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/settings')}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
            >
              <Settings size={20} />
            </motion.button>
          </div>
        </div>
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search chats..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoadingChats ? (
          Array.from({ length: 8 }).map((_, i) => <ChatSkeleton key={i} />)
        ) : filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 p-8">
            <MessageSquare size={48} className="mb-3 opacity-50" />
            <p className="text-sm">No chats yet</p>
            <p className="text-xs mt-1">Start a new conversation</p>
          </div>
        ) : (
          <AnimatePresence>
            {filteredChats.map((chat, i) => (
              <motion.div
                key={chat.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => {
                  setActiveChat(chat.id);
                  navigate(`/chat/${chat.id}`);
                }}
                className={`flex items-center gap-3 p-3 mx-2 rounded-xl cursor-pointer transition-colors ${
                  activeChatId === chat.id
                    ? 'bg-primary-50 dark:bg-primary-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                }`}
              >
                <Avatar
                  src={chat.avatar_url}
                  name={chat.name}
                  size="lg"
                  status={chat.other_user?.status}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                      {chat.name}
                    </h3>
                    {chat.last_message_at && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 ml-2">
                        {formatTime(chat.last_message_at)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
                    {chat.last_message_type === 'image'
                      ? 'Photo'
                      : chat.last_message_type === 'document'
                        ? 'File'
                        : chat.last_message_type === 'voice'
                          ? 'Voice message'
                          : truncate(chat.last_message || 'No messages yet', 30)}
                  </p>
                </div>
                {chat.unread_count > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="min-w-[20px] h-5 flex items-center justify-center px-1.5 rounded-full bg-primary-500 text-white text-xs font-semibold"
                  >
                    {chat.unread_count > 99 ? '99+' : chat.unread_count}
                  </motion.span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      <div className="p-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-3">
        <Avatar src={user?.avatar_url} name={user?.nickname || user?.username || 'U'} size="sm" status={user?.status} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {user?.nickname || user?.username}
          </p>
          <p className="text-xs text-gray-400 capitalize">{user?.status}</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={logout}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-red-500 transition-colors"
        >
          <LogOut size={18} />
        </motion.button>
      </div>
    </div>
  );
}

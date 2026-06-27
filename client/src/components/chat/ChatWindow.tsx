import { useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { MessageInput } from './MessageInput';
import { Avatar } from '@/components/common/Avatar';
import { MessageSkeleton } from '@/components/common/Skeleton';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { groupMessagesByDate } from '@/utils/format';
import { ArrowLeft, Phone, Video, MoreVertical, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ChatWindowProps {
  chatId: string;
}

export function ChatWindow({ chatId }: ChatWindowProps) {
  const { chats, messages, loadMessages, loadMoreMessages, isLoadingMessages, hasMoreMessages, typingUsers } = useChatStore();
  const { user: authUser } = useAuthStore();
  const { replyTo } = useUiStore();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chat = chats.find((c) => c.id === chatId);
  const chatMessages = messages[chatId] || [];

  useEffect(() => {
    loadMessages(chatId);
  }, [chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  const loadMore = useCallback(() => {
    if (hasMoreMessages[chatId]) loadMoreMessages(chatId);
  }, [chatId, hasMoreMessages]);

  const scrollRef = useInfiniteScroll(loadMore, hasMoreMessages[chatId] || false, isLoadingMessages);

  const dateGroups = groupMessagesByDate(chatMessages);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg z-10">
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/')}
            className="p-1 -ml-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 lg:hidden"
          >
            <ArrowLeft size={20} className="text-gray-700 dark:text-gray-300" />
          </motion.button>
          <Avatar
            src={chat?.avatar_url}
            name={chat?.name || ''}
            size="md"
            status={chat?.other_user?.status}
          />
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-sm text-gray-900 dark:text-white truncate">
              {chat?.name || 'Chat'}
            </h2>
            <p className="text-xs text-gray-500">
              {chat?.other_user?.status === 'online'
                ? 'Online'
                : chat?.other_user?.last_seen
                  ? `Last seen ${new Date(chat.other_user.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : 'Offline'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <motion.button whileTap={{ scale: 0.9 }} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
              <Phone size={18} />
            </motion.button>
            <motion.button whileTap={{ scale: 0.9 }} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
              <Video size={18} />
            </motion.button>
            <motion.button whileTap={{ scale: 0.9 }} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
              <MoreVertical size={18} />
            </motion.button>
          </div>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto scrollbar-thin bg-cover bg-center"
        style={{
          backgroundImage: authUser?.settings?.background_url
            ? `url(${authUser.settings.background_url})`
            : undefined,
        }}
      >
        <div ref={scrollRef} />
        {isLoadingMessages ? (
          Array.from({ length: 6 }).map((_, i) => <MessageSkeleton key={i} />)
        ) : chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
            <p className="text-sm">No messages yet</p>
            <p className="text-xs mt-1">Send a message to start the conversation</p>
          </div>
        ) : (
          <>
            {Array.from(dateGroups.entries()).map(([date, indices]) => (
              <div key={date}>
                <div className="flex justify-center my-4">
                  <span className="px-3 py-1 text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-full">
                    {date}
                  </span>
                </div>
                {indices.map((msgIdx, i) => {
                  const msg = chatMessages[msgIdx];
                  const prevMsg = msgIdx > 0 ? chatMessages[msgIdx - 1] : null;
                  const showSender = !msg.is_own && (!prevMsg || prevMsg.sender_id !== msg.sender_id);
                  return (
                    <MessageBubble
                      key={msg.id || msgIdx}
                      message={msg}
                      showSender={showSender}
                    />
                  );
                })}
              </div>
            ))}
          </>
        )}
        <TypingIndicator chatId={chatId} />
        <div ref={messagesEndRef} />
      </div>

      <MessageInput chatId={chatId} />
    </div>
  );
}

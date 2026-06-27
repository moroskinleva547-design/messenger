import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import type { Message } from '@/types';
import { Avatar } from '@/components/common/Avatar';
import { useSwipe } from '@/hooks/useSwipe';
import { formatTime } from '@/utils/format';
import { useUiStore } from '@/stores/uiStore';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import {
  Check, CheckCheck, Clock, AlertCircle, Edit2, Trash2, Reply, Forward,
  FileText, Image as ImageIcon, ChevronDown,
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';

interface MessageBubbleProps {
  message: Message;
  showSender?: boolean;
}

export function MessageBubble({ message, showSender = false }: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const { setReplyTo, setShowForwardModal, showToast } = useUiStore();
  const { deleteMessage } = useChatStore();
  const { user } = useAuthStore();
  const isOwn = message.sender_id === user?.id || message.is_own;
  const menuRef = useRef<HTMLDivElement>(null);

  const swipe = useSwipe({
    onSwipeRight: () => {
      if (!isOwn) {
        setReplyTo({ messageId: message.id, content: message.content, sender: message.sender_nickname || '' });
      }
    },
    threshold: 40,
  });

  const statusIcon = () => {
    switch (message.status) {
      case 'sending': return <Clock size={12} className="text-gray-400 animate-pulse" />;
      case 'sent': return <Check size={12} className="text-gray-400" />;
      case 'delivered': return <CheckCheck size={12} className="text-gray-400" />;
      case 'read': return <CheckCheck size={12} className="text-blue-400" />;
      case 'failed': return <AlertCircle size={12} className="text-red-400" />;
      default: return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', damping: 20, stiffness: 200, mass: 0.8 }}
      className={`flex gap-2 px-4 py-0.5 group ${isOwn ? 'justify-end' : 'justify-start'}`}
      {...swipe}
    >
      {!isOwn && showSender && (
        <Avatar src={message.sender_avatar} name={message.sender_nickname || ''} size="sm" className="mt-1 self-end" />
      )}
      {!isOwn && !showSender && <div className="w-8 shrink-0" />}

      <div className={`max-w-[75%] min-w-[80px] relative ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
        {showSender && !isOwn && (
          <p className="text-xs text-primary-500 font-medium mb-0.5 ml-1">
            {message.sender_nickname || message.sender_username}
          </p>
        )}

        {message.reply_to_id && (
          <div className="max-w-[200px] mb-1 px-2 py-1 rounded-lg bg-black/5 dark:bg-white/5 text-xs text-gray-500 dark:text-gray-400 border-l-2 border-primary-400 truncate">
            {message.content ? `Replying to a message` : ''}
          </div>
        )}

        {message.type === 'image' && message.media_url ? (
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="relative rounded-2xl overflow-hidden cursor-pointer max-w-[280px] shadow-md"
            onClick={() => useUiStore.getState().setShowImagePreview(message.media_url)}
          >
            <img src={message.media_url} alt="Image" className="w-full h-auto object-cover" loading="lazy" />
          </motion.div>
        ) : message.type === 'document' && message.media_url ? (
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-gray-100 dark:bg-gray-700 max-w-[260px]">
            <FileText size={24} className="text-primary-500" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {message.media_name || 'File'}
              </p>
              <p className="text-xs text-gray-500">
                {message.media_size ? `${(message.media_size / 1024).toFixed(1)} KB` : ''}
              </p>
            </div>
          </div>
        ) : (
          <motion.div
            className={`px-4 py-2.5 rounded-2xl relative ${
              isOwn
                ? 'bg-primary-500 text-white rounded-br-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-md'
            } shadow-sm`}
          >
            {message.forwarded_from_id && (
              <p className="text-[10px] opacity-60 font-medium mb-0.5 flex items-center gap-1">
                <Forward size={10} /> Forwarded
              </p>
            )}
            <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
              {message.deleted_at ? 'This message was deleted' : message.content}
            </p>
            <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <span className="text-[10px] opacity-60">{formatTime(message.created_at)}</span>
              {message.edited_at && <span className="text-[10px] opacity-40">edited</span>}
              {isOwn && statusIcon()}
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {showActions && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className={`absolute -top-8 ${isOwn ? 'left-0' : 'right-0'} flex items-center gap-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-1 z-10`}
            >
              <button
                onClick={() => { setReplyTo({ messageId: message.id, content: message.content, sender: message.sender_nickname || '' }); setShowActions(false); }}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
                title="Reply"
              >
                <Reply size={14} />
              </button>
              {isOwn && !message.deleted_at && (
                <>
                  <button
                    onClick={() => { setShowActions(false); showToast('Edit clicked (implement inline edit)'); }}
                    className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
                    title="Edit"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => { deleteMessage(message.id, message.chat_id); setShowActions(false); }}
                    className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
              <button
                onClick={() => { setShowForwardModal(true, { messageId: message.id, chatId: message.chat_id }); setShowActions(false); }}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
                title="Forward"
              >
                <Forward size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <button
        onClick={() => setShowActions(!showActions)}
        className="opacity-0 group-hover:opacity-100 transition-opacity self-center p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <ChevronDown size={14} className="text-gray-400" />
      </button>
    </motion.div>
  );
}

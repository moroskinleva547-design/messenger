import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '@/stores/chatStore';
import { useUiStore } from '@/stores/uiStore';
import { compressImage } from '@/utils/compress';
import { Button } from '@/components/common/Button';
import {
  Send, Paperclip, Image as ImageIcon, Mic, X, Smile,
} from 'lucide-react';

interface MessageInputProps {
  chatId: string;
}

const EMOJI_LIST = ['😀','😃','😄','😁','😅','😂','🤣','😊','😇','🙂','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🫢','🫣','🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥴','😵','🤯','🥶','🥵','😎','🥸','🤩','🥳','😈','👿','👹','👺','💀','☠️','👻','👽','👾','🤖','🎃','😺','😸','😹','😻','😼','😽','🙀','😿','😾','💋','👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦵','🦶','👂','🦻','👃','🧠','🦷','🦴','👀','👁','👅','👄'];

export function MessageInput({ chatId }: MessageInputProps) {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeout = useRef<NodeJS.Timeout>();
  const { sendMessage, sendMedia, sendTyping, stopTyping } = useChatStore();
  const { replyTo, setReplyTo, showToast } = useUiStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [chatId]);

  const handleTyping = useCallback(() => {
    sendTyping(chatId);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => stopTyping(chatId), 2000);
  }, [chatId, sendTyping, stopTyping]);

  const handleSend = async () => {
    const content = text.trim();
    if (!content && !isRecording) return;
    if (content) {
      await sendMessage(chatId, content, 'text', replyTo?.messageId);
    }
    setText('');
    setReplyTo(null);
    stopTyping(chatId);
    setShowEmoji(false);
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      showToast('File too large (max 50MB)', 'error');
      return;
    }
    if (file.type.startsWith('image/')) {
      const compressed = await compressImage(file);
      const newFile = new File([compressed], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' });
      await sendMedia(chatId, newFile, replyTo?.messageId);
    } else {
      await sendMedia(chatId, file, replyTo?.messageId);
    }
    setReplyTo(null);
    e.target.value = '';
  };

  const insertEmoji = (emoji: string) => {
    setText((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const adjustHeight = () => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  };

  return (
    <div className="px-4 py-3 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex items-center gap-2 mb-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm"
          >
            <div className="w-0.5 h-8 bg-primary-400 rounded-full shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-primary-500 font-medium">Reply to {replyTo.sender}</p>
              <p className="text-xs text-gray-500 truncate">{replyTo.content}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
              <X size={14} className="text-gray-400" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEmoji && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 200 }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-y-auto mb-2 grid grid-cols-8 gap-1 p-2 bg-gray-50 dark:bg-gray-800 rounded-xl"
          >
            {EMOJI_LIST.map((emoji) => (
              <button
                key={emoji}
                onClick={() => insertEmoji(emoji)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-lg transition-colors"
              >
                {emoji}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-end gap-2">
        <div className="flex items-center gap-1">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowEmoji(!showEmoji)}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-amber-400 transition-colors"
          >
            <Smile size={20} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-500 transition-colors"
          >
            <Paperclip size={20} />
          </motion.button>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx,.zip,.rar"
          />
        </div>

        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => { setText(e.target.value); handleTyping(); adjustHeight(); }}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            rows={1}
            className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-800 rounded-2xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 resize-none transition-all"
            style={{ maxHeight: '120px' }}
          />
        </div>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleSend}
          disabled={!text.trim()}
          className="p-2.5 rounded-xl bg-primary-500 text-white shadow-lg shadow-primary-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <Send size={18} />
        </motion.button>
      </div>
    </div>
  );
}

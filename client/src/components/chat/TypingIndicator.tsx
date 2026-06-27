import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '@/stores/chatStore';

interface TypingIndicatorProps {
  chatId: string;
}

export function TypingIndicator({ chatId }: TypingIndicatorProps) {
  const typingUsers = useChatStore((s) => s.typingUsers);
  const users = typingUsers.filter((t) => t.chatId === chatId);

  if (users.length === 0) return null;

  const names = users.map((u) => u.username);
  const label = names.length === 1
    ? `${names[0]} is typing`
    : names.length === 2
      ? `${names[0]} and ${names[1]} are typing`
      : `${names[0]} and ${names.length - 1} others are typing`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className="flex items-center gap-2 px-4 py-2"
      >
        <div className="flex items-center gap-1">
          <motion.span
            className="w-1.5 h-1.5 bg-primary-400 rounded-full"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: 0 }}
          />
          <motion.span
            className="w-1.5 h-1.5 bg-primary-400 rounded-full"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: 0.2 }}
          />
          <motion.span
            className="w-1.5 h-1.5 bg-primary-400 rounded-full"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: 0.4 }}
          />
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400 italic">{label}</span>
      </motion.div>
    </AnimatePresence>
  );
}

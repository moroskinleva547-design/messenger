import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/services/api';
import { Avatar } from '@/components/common/Avatar';
import { Switch } from '@/components/common/Switch';
import { X, Shield, Ban } from 'lucide-react';
import type { User } from '@/types';

export function PrivacySettings() {
  const { settings, updateSettings } = useAuthStore();
  const [blockedUsers, setBlockedUsers] = useState<User[]>([]);

  useEffect(() => {
    api.getBlockedUsers().then(setBlockedUsers).catch(() => {});
  }, []);

  const toggleHideLastSeen = async () => {
    await updateSettings({ hide_last_seen: settings?.hide_last_seen ? 0 : 1 });
  };

  const unblock = async (userId: string) => {
    try {
      await api.unblockUser(userId);
      setBlockedUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch {}
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">Hide Last Seen</p>
          <p className="text-xs text-gray-500 mt-0.5">Don't show when you were last online</p>
        </div>
        <Switch
          checked={!!settings?.hide_last_seen}
          onChange={toggleHideLastSeen}
        />
      </motion.div>

      <div>
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Ban size={16} className="text-red-400" />
          Blocked Users
        </h3>
        {blockedUsers.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No blocked users</p>
        ) : (
          <div className="space-y-1">
            <AnimatePresence>
              {blockedUsers.map((u) => (
                <motion.div
                  key={u.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-3 p-2 rounded-xl"
                >
                  <Avatar src={u.avatar_url} name={u.nickname || u.username} size="sm" />
                  <span className="flex-1 text-sm text-gray-900 dark:text-white">
                    {u.nickname || u.username}
                  </span>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => unblock(u.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 transition-colors"
                  >
                    <X size={16} />
                  </motion.button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

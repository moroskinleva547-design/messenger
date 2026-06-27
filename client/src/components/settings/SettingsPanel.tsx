import { motion, AnimatePresence } from 'framer-motion';
import { useUiStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { AppearanceSettings } from './AppearanceSettings';
import { PrivacySettings } from './PrivacySettings';
import { NotificationSettings } from './NotificationSettings';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { ArrowLeft, Palette, Shield, Bell, Trash2, LogOut, Camera } from 'lucide-react';
import { useRef } from 'react';
import { compressImage } from '@/utils/compress';

const sections = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'privacy', label: 'Privacy', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
];

export function SettingsPanel() {
  const { settingsOpen, setSettingsOpen, settingsSection, setSettingsSection, theme, setTheme } = useUiStore();
  const { user, updateProfile, uploadAvatar, logout, updateSettings } = useAuthStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, 256, 0.7);
      const newFile = new File([compressed], 'avatar.webp', { type: 'image/webp' });
      await uploadAvatar(newFile);
    } catch {}
  };

  const clearCache = async () => {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    localStorage.clear();
    window.location.reload();
  };

  return (
    <AnimatePresence>
      {settingsOpen && (
        <motion.div
          initial={{ opacity: 0, x: '100%' }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed inset-0 z-40 bg-white dark:bg-gray-900"
        >
          <div className="h-full flex flex-col max-w-lg mx-auto">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setSettingsOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <ArrowLeft size={20} className="text-gray-700 dark:text-gray-300" />
              </motion.button>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">Settings</h1>
            </div>

            <div className="p-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <Avatar src={user?.avatar_url} name={user?.nickname || user?.username || 'U'} size="xl" />
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    onClick={() => fileRef.current?.click()}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Camera size={18} className="text-white" />
                  </motion.button>
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">{user?.nickname || user?.username}</h2>
                  <p className="text-sm text-gray-500">{user?.bio || 'No bio yet'}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 p-4 border-b border-gray-100 dark:border-gray-800">
              {sections.map(({ id, label, icon: Icon }) => (
                <motion.button
                  key={id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSettingsSection(id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    settingsSection === id
                      ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </motion.button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {settingsSection === 'appearance' && <AppearanceSettings />}
              {settingsSection === 'privacy' && <PrivacySettings />}
              {settingsSection === 'notifications' && <NotificationSettings />}
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
              <Button variant="danger" onClick={clearCache} className="w-full justify-start" size="sm">
                <Trash2 size={16} /> Clear Cache
              </Button>
              <Button variant="ghost" onClick={logout} className="w-full justify-start text-red-500" size="sm">
                <LogOut size={16} /> Log Out
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

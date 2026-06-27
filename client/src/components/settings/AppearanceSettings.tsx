import { motion } from 'framer-motion';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { Sun, Moon, Image } from 'lucide-react';

const backgrounds = [
  { url: '', label: 'None', color: 'transparent' },
  { url: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=400', label: 'Gradient', color: 'from-purple-400 to-pink-400' },
  { url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400', label: 'Starry', color: 'from-blue-900 to-indigo-900' },
  { url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400', label: 'Nature', color: 'from-green-400 to-emerald-400' },
  { url: 'https://images.unsplash.com/photo-1554668048-3c3e5e0b0c5a?w=400', label: 'Ocean', color: 'from-cyan-400 to-blue-500' },
];

export function AppearanceSettings() {
  const { theme, setTheme } = useUiStore();
  const { updateSettings, settings } = useAuthStore();

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    updateSettings({ theme: newTheme });
  };

  const setBackground = async (url: string) => {
    await updateSettings({ background_url: url });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Theme</h3>
        <div className="flex gap-3">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => { setTheme('light'); updateSettings({ theme: 'light' }); }}
            className={`flex-1 p-4 rounded-2xl border-2 transition-all ${
              theme === 'light'
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`}
          >
            <Sun size={24} className="mx-auto mb-2 text-amber-500" />
            <p className="text-xs font-medium text-gray-900 dark:text-white">Light</p>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => { setTheme('dark'); updateSettings({ theme: 'dark' }); }}
            className={`flex-1 p-4 rounded-2xl border-2 transition-all ${
              theme === 'dark'
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`}
          >
            <Moon size={24} className="mx-auto mb-2 text-indigo-400" />
            <p className="text-xs font-medium text-gray-900 dark:text-white">Dark</p>
          </motion.button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Chat Background</h3>
        <div className="grid grid-cols-5 gap-2">
          {backgrounds.map((bg) => (
            <motion.button
              key={bg.url || 'none'}
              whileTap={{ scale: 0.9 }}
              onClick={() => setBackground(bg.url)}
              className={`aspect-video rounded-xl overflow-hidden border-2 transition-all ${
                (settings?.background_url || '') === bg.url
                  ? 'border-primary-500 ring-2 ring-primary-500/30'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              {bg.url ? (
                <img src={bg.url} alt={bg.label} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                  <Image size={16} className="text-gray-400" />
                </div>
              )}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

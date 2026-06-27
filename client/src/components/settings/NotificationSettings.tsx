import { motion } from 'framer-motion';
import { useAuthStore } from '@/stores/authStore';
import { Switch } from '@/components/common/Switch';
import { Bell, Volume2, Globe } from 'lucide-react';

export function NotificationSettings() {
  const { settings, updateSettings } = useAuthStore();

  const toggles = [
    {
      key: 'notifications_enabled' as const,
      label: 'Push Notifications',
      desc: 'Receive push notifications for new messages',
      icon: Bell,
      checked: !!settings?.notifications_enabled,
    },
    {
      key: 'sound_enabled' as const,
      label: 'Sound',
      desc: 'Play sound for incoming messages',
      icon: Volume2,
      checked: !!settings?.sound_enabled,
    },
    {
      key: 'push_enabled' as const,
      label: 'In-App Notifications',
      desc: 'Show popup notifications in the app',
      icon: Globe,
      checked: !!settings?.push_enabled,
    },
  ];

  return (
    <div className="space-y-3">
      {toggles.map(({ key, label, desc, icon: Icon, checked }, i) => (
        <motion.div
          key={key}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/50"
        >
          <div className="p-2 rounded-xl bg-white dark:bg-gray-700">
            <Icon size={18} className="text-primary-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
            <p className="text-xs text-gray-500">{desc}</p>
          </div>
          <Switch
            checked={checked}
            onChange={() => updateSettings({ [key]: checked ? 0 : 1 })}
          />
        </motion.div>
      ))}
    </div>
  );
}

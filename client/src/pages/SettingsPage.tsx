import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { AppearanceSettings } from '@/components/settings/AppearanceSettings';
import { PrivacySettings } from '@/components/settings/PrivacySettings';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { compressImage } from '@/utils/compress';
import { ArrowLeft, Palette, Shield, Bell, Camera, Save, Trash2, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function SettingsPage() {
  const { user, updateProfile, uploadAvatar, logout } = useAuthStore();
  const { showToast } = useUiStore();
  const navigate = useNavigate();
  const [section, setSection] = useState('appearance');
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const sections = [
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'privacy', label: 'Privacy', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, 256, 0.7);
      const newFile = new File([compressed], 'avatar.webp', { type: 'image/webp' });
      await uploadAvatar(newFile);
      showToast('Avatar updated', 'success');
    } catch { showToast('Failed to update avatar', 'error'); }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await updateProfile({ nickname, bio });
      showToast('Profile updated', 'success');
    } catch { showToast('Failed to update profile', 'error'); }
    setSaving(false);
  };

  const clearCache = () => {
    if ('caches' in window) caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
    showToast('Cache cleared', 'success');
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 max-w-lg mx-auto">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate('/')} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
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
              className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <Camera size={18} className="text-white" />
            </motion.button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </div>
          <div className="flex-1 space-y-2">
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Nickname"
              containerClassName="!space-y-0"
              className="!py-1.5 !text-sm"
            />
            <Input
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Bio"
              containerClassName="!space-y-0"
              className="!py-1.5 !text-sm"
            />
            <Button size="sm" onClick={handleSaveProfile} loading={saving} className="w-full">
              <Save size={14} /> Save
            </Button>
          </div>
        </div>
      </div>

      <div className="flex gap-2 p-4 border-b border-gray-100 dark:border-gray-800 overflow-x-auto">
        {sections.map(({ id, label, icon: Icon }) => (
          <motion.button
            key={id}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSection(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              section === id
                ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}
          >
            <Icon size={16} /> {label}
          </motion.button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {section === 'appearance' && <AppearanceSettings />}
        {section === 'privacy' && <PrivacySettings />}
        {section === 'notifications' && <NotificationSettings />}
      </div>

      <div className="p-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
        <Button variant="danger" onClick={clearCache} size="sm" className="w-full justify-start">
          <Trash2 size={16} /> Clear Cache
        </Button>
        <Button variant="ghost" onClick={() => { logout(); navigate('/login'); }} size="sm" className="w-full justify-start text-red-500">
          <LogOut size={16} /> Log Out
        </Button>
      </div>
    </div>
  );
}

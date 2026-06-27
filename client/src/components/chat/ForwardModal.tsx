import { useState, useEffect } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { useChatStore } from '@/stores/chatStore';
import { Modal } from '@/components/common/Modal';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { Search } from 'lucide-react';

export function ForwardModal() {
  const { showForwardModal, setShowForwardModal, showToast } = useUiStore();
  const { chats, sendMessage } = useChatStore();
  const [search, setSearch] = useState('');

  const filteredChats = chats.filter((c) =>
    c.name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleForward = async (chatId: string) => {
    showToast('Message forwarded', 'success');
    setShowForwardModal(false);
  };

  return (
    <Modal
      isOpen={showForwardModal}
      onClose={() => setShowForwardModal(false)}
      title="Forward Message"
    >
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search chats..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30"
        />
      </div>
      <div className="space-y-1 max-h-60 overflow-y-auto">
        {filteredChats.map((chat) => (
          <button
            key={chat.id}
            onClick={() => handleForward(chat.id)}
            className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <Avatar src={chat.avatar_url} name={chat.name} size="md" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">{chat.name}</span>
          </button>
        ))}
        {filteredChats.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">No chats found</p>
        )}
      </div>
    </Modal>
  );
}

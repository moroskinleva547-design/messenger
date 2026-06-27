import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { ChatList } from '@/components/chat/ChatList';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { useChatStore } from '@/stores/chatStore';

export function ChatsPage() {
  const { chatId } = useParams();
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const { setActiveChat } = useChatStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (chatId) setActiveChat(chatId);
    else setActiveChat(null);
  }, [chatId]);

  if (isMobile) {
    if (chatId) {
      return <ChatWindow chatId={chatId} />;
    }
    return <ChatList />;
  }

  return (
    <div className="flex h-screen">
      <div className="w-80 lg:w-96 border-r border-gray-200 dark:border-gray-800 shrink-0">
        <ChatList />
      </div>
      <div className="flex-1">
        {chatId ? (
          <ChatWindow chatId={chatId} />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
            <div className="text-center">
              <div className="text-6xl mb-4 opacity-30">💬</div>
              <p className="text-lg font-medium">Select a chat</p>
              <p className="text-sm">Choose a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

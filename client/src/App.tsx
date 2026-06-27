import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { useUiStore } from '@/stores/uiStore';
import { socketService } from '@/services/socket';
import { LoginPage } from '@/pages/LoginPage';
import { ChatsPage } from '@/pages/ChatsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { Toast } from '@/components/common/Toast';
import { ImageViewer } from '@/components/media/ImageViewer';
import { ForwardModal } from '@/components/chat/ForwardModal';
import { NewChatModal } from '@/components/chat/NewChatModal';
import { SettingsPanel } from '@/components/settings/SettingsPanel';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppShell() {
  const { theme } = useUiStore();
  const { addMessage, updateMessageStatus, updateMessageContent, removeMessage, handleUserTyping, handleUserStopTyping, loadChats } = useChatStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    socketService.onNewMessage((message) => {
      addMessage(message);
      loadChats();
    });
    socketService.onMessageRead((data) => {
      updateMessageStatus(data.messageId, data.userId, data.chatId);
    });
    socketService.onMessageUpdated((data) => {
      updateMessageContent(data.messageId, data.content, data.chatId);
    });
    socketService.onMessageDeleted((data) => {
      removeMessage(data.messageId, data.chatId);
    });
    socketService.onUserTyping((data) => {
      handleUserTyping(data);
    });
    socketService.onUserStopTyping((data) => {
      handleUserStopTyping(data);
    });
    socketService.onUserStatus((data) => {
      loadChats();
    });
  }, []);

  return (
    <div className="h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-300">
      <Routes>
        <Route path="/" element={<ChatsPage />} />
        <Route path="/chat/:chatId" element={<ChatsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/new-chat" element={<NewChatPage />} />
      </Routes>
      <Toast />
      <ImageViewer />
      <ForwardModal />
      <SettingsPanel />
    </div>
  );
}

function NewChatPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  
  useEffect(() => {
    if (!open) navigate('/');
  }, [open]);

  return (
    <div className="h-full flex items-center justify-center bg-white dark:bg-gray-900">
      <NewChatModal isOpen={open} onClose={() => setOpen(false)} />
      {open && <div className="hidden" />}
    </div>
  );
}

export default function App() {
  const { loadUser, isAuthenticated } = useAuthStore();

  useEffect(() => {
    loadUser();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
        } />
        <Route path="/*" element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

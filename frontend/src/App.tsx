import { useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { SettingsModal } from './components/SettingsModal';
import { NewChatModal } from './components/NewChatModal';
import { Dashboard } from './pages/Dashboard';
import { Chat } from './pages/Chat';
import { createConversation } from './lib/api';

function AppContent() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const navigate = useNavigate();

  async function handleCreateConversation(title?: string) {
    try {
      const result = await createConversation(title);
      setNewChatOpen(false);
      navigate(`/chat/${result.conversation_id}`);
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  }

  return (
    <>
      <Routes>
        <Route 
          path="/" 
          element={
            <Layout 
              onOpenSettings={() => setSettingsOpen(true)} 
              onNewChat={() => setNewChatOpen(true)} 
            />
          }
        >
          <Route index element={<Dashboard onOpenSettings={() => setSettingsOpen(true)} />} />
          <Route path="chat/:id" element={<Chat />} />
        </Route>
      </Routes>

      <SettingsModal 
        isOpen={settingsOpen} 
        onClose={() => setSettingsOpen(false)} 
      />
      
      <NewChatModal 
        isOpen={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        onSubmit={handleCreateConversation}
      />
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;

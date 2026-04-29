import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { NewChatModal } from './components/NewChatModal';
import { Dashboard } from './pages/Dashboard';
import { Chat } from './pages/Chat';
import { createConversation } from './lib/api';
import { AppearanceProvider } from './theme';
import { Launch } from './pages/Launch';
import { Login } from './pages/Login';
import { Onboarding } from './pages/Onboarding';
import { SharedConversation } from './pages/SharedConversation';
import {
  ApiKeysSettings,
  AppSettings,
  BillingSettings,
  ConnectionSettings,
  IntegrationsSettings,
  LlmSettings,
  McpSettings,
  OrganizationSettings,
  SecretsSettings,
  SettingsLayout,
  SkillsSettings,
  UserSettings,
} from './pages/Settings';

function AppContent() {
  const [newChatOpen, setNewChatOpen] = useState(false);
  const navigate = useNavigate();

  async function handleCreateConversation(title?: string) {
    try {
      const result = await createConversation(title);
      setNewChatOpen(false);
      navigate(`/chat/${result.conversation_id}`);
    } catch (error) {
      console.error('Failed to create conversation:', error);
      throw error;
    }
  }

  return (
    <>
      <Routes>
        <Route 
          path="/" 
          element={
            <Layout 
              onOpenSettings={() => navigate('/settings/connection')} 
              onNewChat={() => setNewChatOpen(true)} 
            />
          }
        >
          <Route index element={<Dashboard onOpenSettings={() => navigate('/settings/llm')} />} />
          <Route path="launch" element={<Launch />} />
          <Route path="login" element={<Login />} />
          <Route path="onboarding" element={<Onboarding />} />
          <Route path="shared/:id" element={<SharedConversation />} />
          <Route path="chat/:id" element={<Chat />} />
          <Route path="settings" element={<SettingsLayout />}>
            <Route index element={<Navigate to="/settings/connection" replace />} />
            <Route path="connection" element={<ConnectionSettings />} />
            <Route path="llm" element={<LlmSettings />} />
            <Route path="secrets" element={<SecretsSettings />} />
            <Route path="integrations" element={<IntegrationsSettings />} />
            <Route path="mcp" element={<McpSettings />} />
            <Route path="skills" element={<SkillsSettings />} />
            <Route path="app" element={<AppSettings />} />
            <Route path="user" element={<UserSettings />} />
            <Route path="api-keys" element={<ApiKeysSettings />} />
            <Route path="billing" element={<BillingSettings />} />
            <Route path="org" element={<OrganizationSettings />} />
          </Route>
        </Route>
      </Routes>
      
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
    <AppearanceProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AppearanceProvider>
  );
}

export default App;

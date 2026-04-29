import { Link, Outlet } from 'react-router-dom';
import { Bot, MessageSquarePlus, Settings } from 'lucide-react';

interface LayoutProps {
  onOpenSettings: () => void;
  onNewChat: () => void;
}

export function Layout({ onOpenSettings, onNewChat }: LayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-bg app-text">
      {/* Navbar */}
      <nav className="app-card flex items-center justify-between border-x-0 border-t-0 px-8 py-4">
        <Link to="/" className="flex items-center gap-3 text-xl font-semibold app-text hover:text-primary transition-colors">
          <Bot className="w-7 h-7" />
          <span>OpenHands Client</span>
        </Link>
        
        <div className="flex items-center gap-4">
          <Link 
            to="/" 
            className="app-button-subtle rounded-lg px-4 py-2"
          >
            Dashboard
          </Link>
          <button 
            onClick={onNewChat}
            className="app-button-subtle flex items-center gap-2 rounded-lg px-4 py-2"
          >
            <MessageSquarePlus className="w-4 h-4" />
            New Chat
          </button>
          <button 
            onClick={onOpenSettings}
            className="app-button-subtle flex items-center gap-2 rounded-lg px-4 py-2"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t app-border py-4 text-center text-sm app-text-subtle">
        OpenHands Client v0.1.0 | Powered by{' '}
        <a 
          href="https://docs.openhands.dev/sdk" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          OpenHands SDK
        </a>
      </footer>
    </div>
  );
}

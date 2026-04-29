import { Link, Outlet } from 'react-router-dom';
import { Bot, MessageSquarePlus, Settings } from 'lucide-react';

interface LayoutProps {
  onOpenSettings: () => void;
  onNewChat: () => void;
}

export function Layout({ onOpenSettings, onNewChat }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="flex justify-between items-center px-8 py-4 bg-surface border-b border-border">
        <Link to="/" className="flex items-center gap-3 text-text-primary font-semibold text-xl hover:text-primary transition-colors">
          <Bot className="w-7 h-7" />
          <span>OpenHands Client</span>
        </Link>
        
        <div className="flex items-center gap-4">
          <Link 
            to="/" 
            className="text-text-secondary hover:text-text-primary px-4 py-2 rounded-lg hover:bg-surface-hover transition-colors"
          >
            Dashboard
          </Link>
          <button 
            onClick={onNewChat}
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary px-4 py-2 rounded-lg hover:bg-surface-hover transition-colors"
          >
            <MessageSquarePlus className="w-4 h-4" />
            New Chat
          </button>
          <button 
            onClick={onOpenSettings}
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary px-4 py-2 rounded-lg hover:bg-surface-hover transition-colors"
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
      <footer className="text-center py-4 text-text-muted text-sm border-t border-border">
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

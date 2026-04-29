import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Building2, CreditCard, Home, KeyRound, LogIn, MessageSquarePlus, Rocket, Settings, Share2 } from 'lucide-react';
import { AppPage, AppShell, Rail, RailFooter, RailGroup, RailItem, RailLogo } from './shell';

interface LayoutProps {
  onOpenSettings: () => void;
  onNewChat: () => void;
}

export function Layout({ onOpenSettings, onNewChat }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const title = getPageTitle(location.pathname);

  return (
    <AppShell
      rail={
        <Rail>
          <RailLogo label="OpenHands" />
          <RailGroup>
            <RailItem icon={<Home className="h-4 w-4" />} label="Dashboard" active={location.pathname === '/'} onClick={() => navigate('/')} />
            <RailItem icon={<Rocket className="h-4 w-4" />} label="Launch" active={location.pathname.startsWith('/launch')} onClick={() => navigate('/launch')} />
            <RailItem icon={<Share2 className="h-4 w-4" />} label="Shared" active={location.pathname.startsWith('/shared')} onClick={() => navigate('/shared/demo')} />
            <RailItem icon={<KeyRound className="h-4 w-4" />} label="API Keys" active={location.pathname.includes('/api-keys')} onClick={() => navigate('/settings/api-keys')} />
            <RailItem icon={<CreditCard className="h-4 w-4" />} label="Billing" active={location.pathname.includes('/billing')} onClick={() => navigate('/settings/billing')} />
            <RailItem icon={<Building2 className="h-4 w-4" />} label="Org" active={location.pathname.includes('/org')} onClick={() => navigate('/settings/org')} />
          </RailGroup>
          <RailFooter>
            <RailItem icon={<MessageSquarePlus className="h-4 w-4" />} label="New Chat" onClick={onNewChat} />
            <RailItem icon={<Settings className="h-4 w-4" />} label="Settings" active={location.pathname.startsWith('/settings')} onClick={onOpenSettings} />
            <RailItem icon={<LogIn className="h-4 w-4" />} label="Sign in" active={location.pathname.startsWith('/login')} onClick={() => navigate('/login')} />
          </RailFooter>
        </Rail>
      }
    >
      <AppPage title={title}>
        <Outlet />
      </AppPage>
    </AppShell>
  );
}

function getPageTitle(pathname: string) {
  if (pathname.startsWith('/chat/')) return 'Conversation';
  if (pathname.startsWith('/launch')) return 'Launch';
  if (pathname.startsWith('/settings')) return 'Settings';
  if (pathname.startsWith('/shared')) return 'Shared conversation';
  if (pathname.startsWith('/login')) return 'Sign in';
  if (pathname.startsWith('/onboarding')) return 'Onboarding';
  return 'Dashboard';
}

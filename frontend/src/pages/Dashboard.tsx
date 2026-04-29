import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  MessageSquare, 
  Activity, 
  FileText, 
  Wrench, 
  DollarSign, 
  AlertTriangle,
  Trash2,
  Key
} from 'lucide-react';
import { 
  getGlobalStats, 
  getConfig, 
  listConversations, 
  deleteConversation,
  hasApiKey 
} from '../lib/api';
import type { GlobalStats, AppConfig, Conversation } from '../types';

interface DashboardProps {
  onOpenSettings: () => void;
}

export function Dashboard({ onOpenSettings }: DashboardProps) {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSetupBanner, setShowSetupBanner] = useState(false);

  useEffect(() => {
    loadData();
    setShowSetupBanner(!hasApiKey());
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [statsData, configData, convsData] = await Promise.all([
        getGlobalStats(),
        getConfig(),
        listConversations(),
      ]);
      setStats(statsData);
      setConfig(configData);
      setConversations(convsData.conversations);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this conversation?')) return;
    
    try {
      await deleteConversation(id);
      setConversations(conversations.filter(c => c.id !== id));
      const newStats = await getGlobalStats();
      setStats(newStats);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleString();
  }

  const statCards = [
    { icon: MessageSquare, label: 'Total Conversations', value: stats?.total_conversations ?? '-', color: 'text-primary' },
    { icon: Activity, label: 'Active Conversations', value: stats?.active_conversations ?? '-', color: 'text-success' },
    { icon: FileText, label: 'Total Messages', value: stats?.total_messages ?? '-', color: 'text-secondary' },
    { icon: Wrench, label: 'Tool Calls', value: stats?.total_tool_calls ?? '-', color: 'text-warning' },
    { icon: DollarSign, label: 'Total Cost', value: stats ? `$${stats.total_cost.toFixed(2)}` : '-', color: 'text-success' },
    { icon: AlertTriangle, label: 'Errors', value: stats?.total_errors ?? '-', color: 'text-danger' },
  ];

  return (
    <div className="space-y-8">
      {/* Setup Banner */}
      {showSetupBanner && (
        <section className="bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 rounded-xl p-6">
          <div className="flex items-center gap-6">
            <div className="text-4xl">🔑</div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-text-primary mb-1">
                Configure Your LLM Provider
              </h3>
              <p className="text-text-secondary">
                Set up your API key and model to start using OpenHands with real AI capabilities.
              </p>
            </div>
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors"
            >
              <Key className="w-4 h-4" />
              Open Settings
            </button>
          </div>
        </section>
      )}

      {/* Stats Grid */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {statCards.map((stat, index) => (
            <div 
              key={index}
              className="bg-surface border border-border rounded-xl p-5 text-center hover:border-primary/50 transition-colors"
            >
              <stat.icon className={`w-8 h-8 mx-auto mb-2 ${stat.color}`} />
              <div className="text-2xl font-bold text-text-primary">{stat.value}</div>
              <div className="text-sm text-text-secondary">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Configuration */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Configuration</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-surface border border-border rounded-lg p-4">
            <div className="text-xs text-text-muted uppercase tracking-wider mb-1">LLM Model</div>
            <div className="text-text-primary font-mono text-sm truncate">
              {config?.llm.model ?? '-'}
            </div>
          </div>
          <div className="bg-surface border border-border rounded-lg p-4">
            <div className="text-xs text-text-muted uppercase tracking-wider mb-1">Workspace Type</div>
            <div className="text-text-primary font-mono text-sm">
              {config?.workspace.type ?? '-'}
            </div>
          </div>
          <div className="bg-surface border border-border rounded-lg p-4">
            <div className="text-xs text-text-muted uppercase tracking-wider mb-1">Security Policy</div>
            <div className="text-text-primary font-mono text-sm">
              {config?.security_policy ?? '-'}
            </div>
          </div>
          <div className="bg-surface border border-border rounded-lg p-4">
            <div className="text-xs text-text-muted uppercase tracking-wider mb-1">Browser Tools</div>
            <div className="text-text-primary font-mono text-sm">
              {config?.enable_browser_tools ? 'Enabled' : 'Disabled'}
            </div>
          </div>
        </div>
      </section>

      {/* Conversations */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Conversations</h2>
        {loading ? (
          <div className="text-center py-8 text-text-muted">Loading conversations...</div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-8 text-text-muted">
            No conversations yet. Click "New Chat" to start.
          </div>
        ) : (
          <div className="space-y-3">
            {conversations.map((conv) => (
              <Link
                key={conv.id}
                to={`/chat/${conv.id}`}
                className="flex items-center justify-between bg-surface border border-border rounded-lg px-6 py-4 hover:bg-surface-hover hover:border-primary transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-text-primary truncate">
                    {conv.title}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-text-muted">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      conv.status === 'active' ? 'bg-success/20 text-success' :
                      conv.status === 'paused' ? 'bg-warning/20 text-warning' :
                      conv.status === 'completed' ? 'bg-secondary/20 text-secondary' :
                      'bg-danger/20 text-danger'
                    }`}>
                      {conv.status}
                    </span>
                    <span>{conv.message_count} messages</span>
                    <span>${conv.total_cost.toFixed(4)}</span>
                    <span>{formatDate(conv.updated_at)}</span>
                  </div>
                </div>
                <button
                  onClick={(e) => handleDelete(conv.id, e)}
                  className="p-2 text-text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

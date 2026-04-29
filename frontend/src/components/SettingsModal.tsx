import { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Save, Key, Shield, Monitor } from 'lucide-react';
import { getConfig, settingsFromConfig, updateConfig, type Settings } from '../lib/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LLM_MODELS = [
  { group: 'Anthropic', models: [
    { value: 'anthropic/claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
    { value: 'anthropic/claude-opus-4-0-20250514', label: 'Claude Opus 4' },
    { value: 'anthropic/claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'anthropic/claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
  ]},
  { group: 'OpenAI', models: [
    { value: 'openai/gpt-4o', label: 'GPT-4o' },
    { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'openai/gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'openai/o1-preview', label: 'o1-preview' },
  ]},
  { group: 'OpenHands Cloud', models: [
    { value: 'openhands/claude-sonnet-4-5-20250929', label: 'OH Claude Sonnet 4.5' },
    { value: 'openhands/claude-3-5-sonnet-20241022', label: 'OH Claude 3.5 Sonnet' },
  ]},
  { group: 'Other', models: [
    { value: 'custom', label: 'Custom Model...' },
  ]},
];

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showCloudApiKey, setShowCloudApiKey] = useState(false);
  const [customModel, setCustomModel] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      getConfig()
        .then((config) => setSettings(settingsFromConfig(config)))
        .catch(() => setStatus({ type: 'error', message: 'Failed to load settings' }));
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!settings) return;
    try {
      const finalSettings = {
        ...settings,
        llm_model: settings.llm_model === 'custom' ? customModel : settings.llm_model,
      };
      await updateConfig(finalSettings);
      setStatus({ type: 'success', message: 'Settings saved. New conversations will use the updated configuration.' });
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch {
      setStatus({ type: 'error', message: 'Failed to save settings' });
    }
  };

  if (!isOpen) return null;
  if (!settings) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-surface rounded-xl w-full max-w-md p-6 shadow-2xl">
          <p className="text-text-secondary">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-border">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            ⚙️ Settings
          </h2>
          <button 
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary p-1 rounded hover:bg-surface-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] space-y-8">
          {/* LLM Configuration */}
          <section>
            <h3 className="flex items-center gap-2 text-lg font-medium mb-2">
              <Key className="w-5 h-5 text-primary" />
              LLM Configuration
            </h3>
            <p className="text-text-secondary text-sm mb-4">
              Configure your language model provider and API credentials.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-2">Model</label>
                <select
                  value={settings.llm_model}
                  onChange={(e) => setSettings({ ...settings, llm_model: e.target.value })}
                  className="w-full px-4 py-3 bg-bg border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                >
                  {LLM_MODELS.map(group => (
                    <optgroup key={group.group} label={group.group}>
                      {group.models.map(model => (
                        <option key={model.value} value={model.value}>
                          {model.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {settings.llm_model === 'custom' && (
                <div>
                  <label className="block text-sm text-text-secondary mb-2">Custom Model Name</label>
                  <input
                    type="text"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    placeholder="e.g., mistral/mistral-large"
                    className="w-full px-4 py-3 bg-bg border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm text-text-secondary mb-2">API Key</label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={settings.llm_api_key}
                    onChange={(e) => setSettings({ ...settings, llm_api_key: e.target.value })}
                    placeholder="sk-... or your API key"
                    className="w-full px-4 py-3 pr-12 bg-bg border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                  >
                    {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-text-muted mt-1">
                  Stored by the local backend. Leave blank to keep the existing key
                  {settings.has_llm_api_key ? ' (currently configured).' : '.'}
                </p>
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-2">Base URL (optional)</label>
                <input
                  type="text"
                  value={settings.llm_base_url}
                  onChange={(e) => setSettings({ ...settings, llm_base_url: e.target.value })}
                  placeholder="https://api.example.com/v1"
                  className="w-full px-4 py-3 bg-bg border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
                />
                <p className="text-xs text-text-muted mt-1">
                  For custom API endpoints or proxies. Leave empty for default.
                </p>
              </div>
            </div>
          </section>

          {/* Security */}
          <section>
            <h3 className="flex items-center gap-2 text-lg font-medium mb-2">
              <Shield className="w-5 h-5 text-success" />
              Security
            </h3>
            <div>
              <label className="block text-sm text-text-secondary mb-2">Confirmation Policy</label>
              <select
                value={settings.security_policy}
                onChange={(e) => setSettings({ ...settings, security_policy: e.target.value })}
                className="w-full px-4 py-3 bg-bg border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
              >
                <option value="confirm_risky">Confirm Risky Actions</option>
                <option value="always_confirm">Always Confirm</option>
                <option value="never_confirm">Never Confirm (Auto-execute)</option>
              </select>
              <p className="text-xs text-text-muted mt-1">
                Controls when the agent asks for permission before executing actions.
              </p>
            </div>
          </section>

          {/* Workspace */}
          <section>
            <h3 className="flex items-center gap-2 text-lg font-medium mb-2">
              <Monitor className="w-5 h-5 text-warning" />
              Workspace
            </h3>
            <div>
              <label className="block text-sm text-text-secondary mb-2">Workspace Type</label>
              <select
                value={settings.workspace_type}
                onChange={(e) => setSettings({ ...settings, workspace_type: e.target.value })}
                className="w-full px-4 py-3 bg-bg border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
              >
                <option value="local">Local (Direct filesystem)</option>
                <option value="docker">Docker (Isolated container)</option>
                  <option value="remote">Remote Agent Server</option>
                  <option value="api_remote">Runtime API</option>
                <option value="cloud">OpenHands Cloud</option>
              </select>
            </div>

              <div className="mt-4">
                <label className="block text-sm text-text-secondary mb-2">Workspace Directory</label>
                <input
                  type="text"
                  value={settings.workspace_dir}
                  onChange={(e) => setSettings({ ...settings, workspace_dir: e.target.value })}
                  placeholder="/workspace"
                  className="w-full px-4 py-3 bg-bg border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
                />
              </div>

              {settings.workspace_type === 'cloud' && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm text-text-secondary mb-2">OpenHands Cloud URL</label>
                    <input
                      type="text"
                      value={settings.openhands_cloud_url}
                      onChange={(e) => setSettings({ ...settings, openhands_cloud_url: e.target.value })}
                      placeholder="https://app.all-hands.dev"
                      className="w-full px-4 py-3 bg-bg border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-2">OpenHands Cloud API Key</label>
                    <div className="relative">
                      <input
                        type={showCloudApiKey ? 'text' : 'password'}
                        value={settings.openhands_cloud_api_key}
                        onChange={(e) => setSettings({ ...settings, openhands_cloud_api_key: e.target.value })}
                        placeholder={settings.has_openhands_cloud_api_key ? 'Configured - leave blank to keep existing key' : 'sk-oh-...'}
                        className="w-full px-4 py-3 pr-12 bg-bg border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCloudApiKey(!showCloudApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                      >
                        {showCloudApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
          </section>

          {/* Status */}
          {status && (
            <div className={`p-4 rounded-lg ${
              status.type === 'success' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
            }`}>
              {status.message}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" />
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

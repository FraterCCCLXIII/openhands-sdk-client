import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { X, Eye, EyeOff, Save, Key, Shield, Monitor, Server, Moon, Sun, Palette } from 'lucide-react';
import { deleteSecret, getConfig, healthCheck, listSecrets, saveSecret, settingsFromConfig, updateConfig, type Settings } from '../lib/api';
import { getDefaultConnection } from '../lib/backend/connection';
import { SegmentedChoice, SettingsRow, SettingsSection } from './design';
import { useAppearance, type AppearanceMode } from '../theme';
import type { BackendMode, SecretInfo } from '../types';

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

const appearanceOptions: {
  value: AppearanceMode;
  label: string;
  icon: ReactNode;
}[] = [
  { value: 'light', label: 'Light', icon: <Sun className="h-4 w-4" /> },
  { value: 'dark', label: 'Dark', icon: <Moon className="h-4 w-4" /> },
  { value: 'system', label: 'System', icon: <Monitor className="h-4 w-4" /> },
];

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { mode: appearanceMode, resolvedColorScheme, setMode, themeId } = useAppearance();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showCloudApiKey, setShowCloudApiKey] = useState(false);
  const [showBackendToken, setShowBackendToken] = useState(false);
  const [customModel, setCustomModel] = useState('');
  const [secrets, setSecrets] = useState<SecretInfo[]>([]);
  const [newSecret, setNewSecret] = useState({ name: '', value: '', description: '' });
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      getConfig()
        .then((config) => setSettings(settingsFromConfig(config)))
        .catch(() => setStatus({ type: 'error', message: 'Failed to load settings' }));
      listSecrets()
        .then((data) => setSecrets(data.secrets))
        .catch(() => setSecrets([]));
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

  const handleModeChange = (backend_mode: BackendMode) => {
    if (!settings) return;
    const defaults = getDefaultConnection(backend_mode);
    setSettings({
      ...settings,
      backend_mode,
      backend_base_url: defaults.baseUrl,
      workspace_type: backend_mode,
    });
  };

  const handleTestConnection = async () => {
    if (!settings) return;
    try {
      await updateConfig({
        backend_mode: settings.backend_mode,
        backend_base_url: settings.backend_base_url,
        backend_auth_token: settings.backend_auth_token,
      });
      await healthCheck();
      setStatus({ type: 'success', message: 'Connection succeeded.' });
    } catch {
      setStatus({ type: 'error', message: 'Connection failed. Check the base URL and token.' });
    }
  };

  const handleAddSecret = async () => {
    if (!newSecret.name.trim() || !newSecret.value) return;
    try {
      await saveSecret(newSecret);
      const data = await listSecrets();
      setSecrets(data.secrets);
      setNewSecret({ name: '', value: '', description: '' });
      setStatus({ type: 'success', message: 'Secret saved.' });
    } catch {
      setStatus({ type: 'error', message: 'Failed to save secret.' });
    }
  };

  const handleDeleteSecret = async (name: string) => {
    try {
      await deleteSecret(name);
      setSecrets(secrets.filter(secret => secret.name !== name));
      setStatus({ type: 'success', message: 'Secret deleted.' });
    } catch {
      setStatus({ type: 'error', message: 'Failed to delete secret.' });
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
      <div className="app-card w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b app-border">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            ⚙️ Settings
          </h2>
          <button 
            onClick={onClose}
            className="app-button-subtle p-1 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] space-y-8">
          <SettingsSection
            title="Appearance"
            description="Use the same theme contract as the scaffold: one provider resolves light, dark, or system mode into shared design tokens."
          >
            <SettingsRow
              label="Mode preference"
              description="Stored locally and applied through root data attributes so every component consumes the same token palette."
              control={
                <SegmentedChoice
                  ariaLabel="Appearance mode"
                  value={appearanceMode}
                  onChange={setMode}
                  options={appearanceOptions}
                />
              }
            />
            <SettingsRow
              label="Resolved palette"
              description="System mode follows the operating system and updates the token set automatically."
              control={
                <span className="inline-flex items-center gap-2 rounded-full border app-border bg-[var(--app-surface-muted)] px-3 py-1.5 text-sm font-medium capitalize app-text">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      resolvedColorScheme === 'dark'
                        ? 'bg-[var(--app-accent)]'
                        : 'bg-[var(--app-warning)]'
                    }`}
                  />
                  {resolvedColorScheme}
                </span>
              }
            />
            <SettingsRow
              label="Theme family"
              description="The current theme family is default, with room to add more token maps later."
              control={
                <span className="inline-flex items-center gap-2 rounded-full border app-border bg-[var(--app-surface-muted)] px-3 py-1.5 text-sm font-medium app-text">
                  <Palette className="h-4 w-4 app-text-muted" />
                  {themeId}
                </span>
              }
            />
          </SettingsSection>

          {/* Backend Connection */}
          <section>
            <h3 className="flex items-center gap-2 text-lg font-medium mb-2">
              <Server className="w-5 h-5 text-primary" />
              Backend Connection
            </h3>
            <p className="text-text-secondary text-sm mb-4">
              Choose where this client sends OpenHands API requests. Only the mode and base URL are persisted locally; tokens are kept for this browser session.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              {(['prototype', 'local', 'cloud'] as BackendMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleModeChange(mode)}
                  className={`px-4 py-3 rounded-lg border text-left capitalize transition-colors ${
                    settings.backend_mode === mode
                      ? 'border-primary bg-primary/10 text-text-primary'
                      : 'border-border bg-bg text-text-secondary hover:border-primary/50'
                  }`}
                >
                  <div className="font-medium">{mode}</div>
                  <div className="text-xs text-text-muted">
                    {mode === 'prototype' ? 'Current SDK server' : mode === 'local' ? 'OpenHands Main local' : 'OpenHands Cloud'}
                  </div>
                </button>
              ))}
            </div>

            {settings.backend_mode !== 'prototype' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-2">Base URL</label>
                  <input
                    type="url"
                    value={settings.backend_base_url}
                    onChange={(e) => setSettings({ ...settings, backend_base_url: e.target.value })}
                    placeholder={settings.backend_mode === 'local' ? 'http://localhost:3000' : 'https://app.all-hands.dev'}
                    className="w-full px-4 py-3 bg-bg border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-2">Auth Token</label>
                  <div className="relative">
                    <input
                      type={showBackendToken ? 'text' : 'password'}
                      value={settings.backend_auth_token}
                      onChange={(e) => setSettings({ ...settings, backend_auth_token: e.target.value })}
                      placeholder={settings.has_backend_auth_token ? 'Configured for this session - leave blank to keep' : 'Optional bearer token'}
                      className="w-full px-4 py-3 pr-12 bg-bg border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowBackendToken(!showBackendToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                    >
                      {showBackendToken ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-text-muted mt-1">
                    This follows OpenHands Main redaction semantics: blank means keep the existing session token; values are not written to localStorage.
                  </p>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleTestConnection}
              className="mt-4 px-4 py-2 bg-surface-hover hover:bg-border rounded-lg text-sm transition-colors"
            >
              Test Connection
            </button>
          </section>

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
                  Stored by the selected OpenHands backend. Leave blank to keep the existing redacted key
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
                <option value="auto">Auto Approve</option>
                <option value="confirm_risky">Confirm Risky Actions</option>
                <option value="always_confirm">Always Confirm</option>
                <option value="never_confirm">Never Confirm (Auto-execute)</option>
              </select>
              <p className="text-xs text-text-muted mt-1">
                Controls when the agent asks for permission before executing actions.
              </p>
            </div>
          </section>

          {/* Secrets */}
          <section>
            <h3 className="flex items-center gap-2 text-lg font-medium mb-2">
              <Key className="w-5 h-5 text-warning" />
              Secrets
            </h3>
            <p className="text-text-secondary text-sm mb-4">
              Custom secrets are stored by OpenHands Main and listed only by name. Values are never read back into this client.
            </p>
            <div className="space-y-3 mb-4">
              {secrets.length === 0 ? (
                <p className="text-sm text-text-muted">No custom secrets configured.</p>
              ) : secrets.map(secret => (
                <div key={secret.name} className="flex items-center justify-between gap-3 p-3 bg-bg border border-border rounded-lg">
                  <div>
                    <div className="font-mono text-sm text-text-primary">{secret.name}</div>
                    <div className="text-xs text-text-muted">{secret.description || 'Secret value configured'}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteSecret(secret.name)}
                    className="text-xs text-danger hover:text-danger/80"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                value={newSecret.name}
                onChange={(e) => setNewSecret({ ...newSecret, name: e.target.value })}
                placeholder="SECRET_NAME"
                className="px-4 py-3 bg-bg border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary font-mono"
              />
              <input
                type="password"
                value={newSecret.value}
                onChange={(e) => setNewSecret({ ...newSecret, value: e.target.value })}
                placeholder="Secret value"
                className="px-4 py-3 bg-bg border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary font-mono"
              />
              <input
                type="text"
                value={newSecret.description}
                onChange={(e) => setNewSecret({ ...newSecret, description: e.target.value })}
                placeholder="Description"
                className="px-4 py-3 bg-bg border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
              />
            </div>
            <button
              type="button"
              onClick={handleAddSecret}
              className="mt-3 px-4 py-2 bg-surface-hover hover:bg-border rounded-lg text-sm transition-colors"
            >
              Add Secret
            </button>
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
                <option value="local">Local (OpenHands Main)</option>
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
        <div className="flex justify-end gap-3 px-6 py-4 border-t app-border">
          <button
            onClick={onClose}
            className="app-button-subtle px-4 py-2 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="app-button-accent flex items-center gap-2 px-4 py-2 rounded-lg"
          >
            <Save className="w-4 h-4" />
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Monitor, Moon, Sun } from 'lucide-react';
import {
  deleteSecret,
  getApiKeysStatus,
  getBillingStatus,
  getConfig,
  getOrganizationStatus,
  listMcpServers,
  listSecrets,
  listSkills,
  saveSecret,
  settingsFromConfig,
  updateConfig,
  type Settings,
} from '../lib/api';
import { getDefaultConnection } from '../lib/backend/connection';
import { SegmentedChoice, SettingsRow, SettingsSection } from '../components/design';
import { useAppearance, type AppearanceMode } from '../theme';
import type { BackendMode, McpServerInfo, ProductStatus, SecretInfo, SkillInfo } from '../types';
import { ProductPage } from './ProductPage';

const settingsNav = [
  { to: '/settings/connection', label: 'Connection' },
  { to: '/settings/llm', label: 'LLM' },
  { to: '/settings/secrets', label: 'Secrets' },
  { to: '/settings/integrations', label: 'Integrations' },
  { to: '/settings/mcp', label: 'MCP' },
  { to: '/settings/skills', label: 'Skills' },
  { to: '/settings/app', label: 'App' },
  { to: '/settings/user', label: 'User' },
  { to: '/settings/api-keys', label: 'API Keys' },
  { to: '/settings/billing', label: 'Billing' },
  { to: '/settings/org', label: 'Organization' },
];

const appearanceOptions: Array<{ value: AppearanceMode; label: string; icon: ReactNode }> = [
  { value: 'light', label: 'Light', icon: <Sun className="h-4 w-4" /> },
  { value: 'dark', label: 'Dark', icon: <Moon className="h-4 w-4" /> },
  { value: 'system', label: 'System', icon: <Monitor className="h-4 w-4" /> },
];

export function SettingsLayout() {
  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <aside className="app-card h-fit rounded-xl p-3">
        <h1 className="px-3 py-2 text-lg font-semibold app-text">Settings</h1>
        <nav className="mt-2 space-y-1">
          {settingsNav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm ${isActive ? 'app-list-item-active' : 'app-list-item'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <Outlet />
    </div>
  );
}

function useSettingsState() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    getConfig().then(config => setSettings(settingsFromConfig(config))).catch(() => setStatus('Failed to load settings.'));
  }, []);

  async function save(next: Partial<Settings>) {
    if (!settings) return;
    const merged = { ...settings, ...next };
    setSettings(merged);
    await updateConfig(merged);
    setStatus('Settings saved.');
  }

  return { settings, setSettings, status, save };
}

export function ConnectionSettings() {
  const { settings, setSettings, status, save } = useSettingsState();
  if (!settings) return <LoadingSettings />;
  const currentSettings = settings;

  function changeMode(mode: BackendMode) {
    const defaults = getDefaultConnection(mode);
    setSettings({
      ...currentSettings,
      backend_mode: mode,
      backend_base_url: defaults.baseUrl,
      backend_auth_token: currentSettings.backend_auth_token,
      workspace_type: mode,
    });
  }

  return (
    <SettingsPage title="Backend connection" description="Select the SDK facade, local OpenHands Main, or a hosted OpenHands-compatible backend.">
      <SettingsSection title="Target backend">
        <SettingsRow
          label="Mode"
          description="Prototype uses the SDK client server. Local and cloud use OpenHands-compatible product APIs where available."
          control={
            <SegmentedChoice
              ariaLabel="Backend mode"
              value={settings.backend_mode}
              onChange={changeMode}
              options={[
                { value: 'prototype', label: 'SDK' },
                { value: 'local', label: 'Local' },
                { value: 'cloud', label: 'Cloud' },
              ]}
            />
          }
        />
        <FieldRow label="Base URL" value={settings.backend_base_url} onChange={(value) => setSettings({ ...settings, backend_base_url: value })} />
        <SecretRow label="Auth token" value={settings.backend_auth_token} onChange={(value) => setSettings({ ...settings, backend_auth_token: value })} placeholder={settings.has_backend_auth_token ? 'Configured - leave blank to keep' : 'Bearer token'} />
      </SettingsSection>
      <SaveFooter status={status} onSave={() => save(settings)} />
    </SettingsPage>
  );
}

export function LlmSettings() {
  const { settings, setSettings, status, save } = useSettingsState();
  if (!settings) return <LoadingSettings />;

  return (
    <SettingsPage title="LLM settings" description="Configure model, base URL, and redacted API key semantics.">
      <SettingsSection title="Model provider">
        <FieldRow label="Model" value={settings.llm_model} onChange={(value) => setSettings({ ...settings, llm_model: value })} />
        <FieldRow label="Base URL" value={settings.llm_base_url} onChange={(value) => setSettings({ ...settings, llm_base_url: value })} />
        <SecretRow label="API key" value={settings.llm_api_key} onChange={(value) => setSettings({ ...settings, llm_api_key: value })} placeholder={settings.has_llm_api_key ? 'Configured - leave blank to keep' : 'API key'} />
      </SettingsSection>
      <SaveFooter status={status} onSave={() => save(settings)} />
    </SettingsPage>
  );
}

export function SecretsSettings() {
  const [secrets, setSecrets] = useState<SecretInfo[]>([]);
  const [newSecret, setNewSecret] = useState({ name: '', value: '', description: '' });
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    listSecrets().then(result => setSecrets(result.secrets)).catch(() => setSecrets([]));
  }, []);

  async function addSecret() {
    await saveSecret(newSecret);
    setNewSecret({ name: '', value: '', description: '' });
    const result = await listSecrets();
    setSecrets(result.secrets);
    setStatus('Secret saved.');
  }

  async function removeSecret(name: string) {
    await deleteSecret(name);
    setSecrets(secrets.filter(secret => secret.name !== name));
    setStatus('Secret deleted.');
  }

  return (
    <SettingsPage title="Secrets" description="Custom secrets are listed by name only; values are never read back into the client.">
      <SettingsSection title="Custom secrets">
        <div className="space-y-3 px-6 py-5">
          {secrets.length === 0 ? <p className="text-sm app-text-muted">No custom secrets configured.</p> : secrets.map(secret => (
            <div key={secret.name} className="flex items-center justify-between rounded-lg bg-bg px-3 py-2">
              <span className="font-mono text-sm app-text">{secret.name}</span>
              <button type="button" onClick={() => removeSecret(secret.name)} className="text-sm text-danger">Delete</button>
            </div>
          ))}
        </div>
        <div className="grid gap-3 border-t app-border px-6 py-5 md:grid-cols-3">
          <input value={newSecret.name} onChange={(event) => setNewSecret({ ...newSecret, name: event.target.value })} placeholder="SECRET_NAME" className="rounded-lg border app-border bg-bg px-3 py-2 app-text" />
          <input type="password" value={newSecret.value} onChange={(event) => setNewSecret({ ...newSecret, value: event.target.value })} placeholder="Value" className="rounded-lg border app-border bg-bg px-3 py-2 app-text" />
          <input value={newSecret.description} onChange={(event) => setNewSecret({ ...newSecret, description: event.target.value })} placeholder="Description" className="rounded-lg border app-border bg-bg px-3 py-2 app-text" />
        </div>
      </SettingsSection>
      <SaveFooter status={status} onSave={addSecret} label="Add secret" />
    </SettingsPage>
  );
}

export function IntegrationsSettings() {
  return <CapabilitySettings title="Git integrations" description="Git provider linking, repository search, branch selection, and suggested tasks are exposed through OpenHands-compatible backend capabilities." />;
}

export function McpSettings() {
  const [servers, setServers] = useState<McpServerInfo[]>([]);
  useEffect(() => { listMcpServers().then(result => setServers(result.servers)).catch(() => setServers([])); }, []);
  return <InventorySettings title="MCP servers" description="MCP servers available to the selected runtime." items={servers.map(server => `${server.name} · ${server.status}`)} empty="No MCP servers reported." />;
}

export function SkillsSettings() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  useEffect(() => { listSkills().then(result => setSkills(result.skills)).catch(() => setSkills([])); }, []);
  return <InventorySettings title="Skills" description="Skills and microagent metadata reported by the backend." items={skills.map(skill => `${skill.name}${skill.type ? ` · ${skill.type}` : ''}`)} empty="No skills reported." />;
}

export function AppSettings() {
  const { mode, setMode, resolvedColorScheme } = useAppearance();
  const { settings, setSettings, status, save } = useSettingsState();
  if (!settings) return <LoadingSettings />;

  return (
    <SettingsPage title="App preferences" description="Theme, metrics, browser tools, and runtime limits.">
      <SettingsSection title="Appearance">
        <SettingsRow label="Theme mode" description={`Currently resolved as ${resolvedColorScheme}.`} control={<SegmentedChoice ariaLabel="Theme mode" value={mode} onChange={setMode} options={appearanceOptions} />} />
      </SettingsSection>
      <SettingsSection title="Runtime preferences">
        <ToggleRow label="Browser tools" checked={settings.enable_browser_tools} onChange={(value) => setSettings({ ...settings, enable_browser_tools: value })} />
        <ToggleRow label="Metrics" checked={settings.enable_metrics} onChange={(value) => setSettings({ ...settings, enable_metrics: value })} />
        <FieldRow label="Max context size" value={String(settings.max_context_size)} onChange={(value) => setSettings({ ...settings, max_context_size: Number(value) || 0 })} />
      </SettingsSection>
      <SaveFooter status={status} onSave={() => save(settings)} />
    </SettingsPage>
  );
}

export function UserSettings() {
  return <CapabilitySettings title="User profile" description="Profile, email verification, and account preferences are product backend concerns. SDK-only mode uses local runtime configuration." />;
}

export function ApiKeysSettings() {
  return <StatusSettings title="API keys" description="API keys are managed by hosted product backends." loadStatus={getApiKeysStatus} />;
}

export function BillingSettings() {
  return <StatusSettings title="Billing" description="Billing is available only when the selected backend provides SaaS billing capabilities." loadStatus={getBillingStatus} />;
}

export function OrganizationSettings() {
  return <StatusSettings title="Organization" description="Organization members and invitations are product/SaaS capabilities." loadStatus={getOrganizationStatus} />;
}

function SettingsPage({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] app-text-subtle">Settings</p>
        <h1 className="mt-2 text-2xl font-semibold app-text">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 app-text-muted">{description}</p>
      </div>
      {children}
    </div>
  );
}

function FieldRow({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <SettingsRow
      label={label}
      description="Blank values are passed through to the selected backend according to its persistence semantics."
      control={<input value={value} onChange={(event) => onChange(event.target.value)} className="w-72 rounded-lg border app-border bg-bg px-3 py-2 text-sm app-text" />}
    />
  );
}

function SecretRow({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <SettingsRow
      label={label}
      description="Secret values are redacted. Leave blank to keep an existing value."
      control={<input type="password" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-72 rounded-lg border app-border bg-bg px-3 py-2 text-sm app-text" />}
    />
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <SettingsRow
      label={label}
      description="This preference is sent to the selected backend when supported."
      control={<input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5" />}
    />
  );
}

function SaveFooter({ status, onSave, label = 'Save settings' }: { status: string | null; onSave: () => void; label?: string }) {
  return (
    <div className="flex items-center justify-end gap-3">
      {status && <span className="text-sm app-text-muted">{status}</span>}
      <button type="button" onClick={onSave} className="app-button-accent rounded-lg px-4 py-2 text-sm">{label}</button>
    </div>
  );
}

function LoadingSettings() {
  return <div className="py-10 text-center app-text-muted">Loading settings...</div>;
}

function CapabilitySettings({ title, description }: { title: string; description: string }) {
  return (
    <SettingsPage title={title} description={description}>
      <SettingsSection title="Capability status">
        <SettingsRow label="Implementation status" description="This route is wired into the full product shell and will light up as backend capability adapters are completed." control={<span className="rounded-full app-status-neutral px-3 py-1.5 text-sm">Capability gated</span>} />
      </SettingsSection>
    </SettingsPage>
  );
}

function InventorySettings({ title, description, items, empty }: { title: string; description: string; items: string[]; empty: string }) {
  return (
    <SettingsPage title={title} description={description}>
      <SettingsSection title={title}>
        <div className="space-y-2 px-6 py-5">
          {items.length === 0 ? <p className="text-sm app-text-muted">{empty}</p> : items.map(item => <div key={item} className="rounded-lg bg-bg px-3 py-2 text-sm app-text">{item}</div>)}
        </div>
      </SettingsSection>
    </SettingsPage>
  );
}

function StatusSettings({ title, description, loadStatus }: { title: string; description: string; loadStatus: () => Promise<ProductStatus> }) {
  return <ProductPage title={title} description={description} loadStatus={loadStatus} />;
}

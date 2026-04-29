import type {
  AppConfig,
  BackendConnection,
  BackendMode,
  Conversation,
  ConversationEvent,
  ConversationStats,
  GitChange,
  GlobalStats,
  McpServerInfo,
  ProductStatus,
  Repository,
  RuntimeLink,
  SandboxInfo,
  SecretInfo,
  Settings,
  SkillInfo,
  StartTask,
  SuggestedTask,
  UserSession,
  WorkspaceFile,
} from '../../types';
import { request } from './http';
import { saveBackendConnection } from './connection';
import type { BackendHealth, OpenHandsBackend, SocketEnvelope } from './types';
import { capabilitiesForMode, UNSUPPORTED_PRODUCT_STATUS } from './capabilities';

interface V1Page<T> {
  items: T[];
  next_page_id: string | null;
}

interface V1Conversation {
  id: string;
  title: string | null;
  sandbox_id: string;
  created_at: string;
  updated_at: string;
  sandbox_status?: string | null;
  execution_status?: string | null;
  conversation_url?: string | null;
  session_api_key?: string | null;
  metrics?: {
    accumulated_cost?: number | null;
    accumulated_token_usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
    } | null;
  } | null;
}

interface V1StartTask {
  id: string;
  status: 'WORKING' | 'READY' | 'ERROR' | string;
  detail: string | null;
  app_conversation_id: string | null;
  created_at?: string;
  updated_at?: string;
}

interface V1Settings {
  agent_settings?: {
    llm?: {
      model?: string | null;
      base_url?: string | null;
      api_key?: string | null;
    };
  };
  conversation_settings?: {
    confirmation_mode?: boolean;
  };
  llm_api_key_set?: boolean;
  search_api_key_set?: boolean;
  max_iterations?: number | null;
  enable_default_condenser?: boolean | null;
  user_consents_to_analytics?: boolean | null;
}

const DEFAULT_STATS: ConversationStats = {
  total_messages: 0,
  user_messages: 0,
  assistant_messages: 0,
  tool_calls: 0,
  total_tokens: 0,
  input_tokens: 0,
  output_tokens: 0,
  accumulated_cost: 0,
  average_response_time: 0,
  errors: 0,
};

function apiPrefix(mode: BackendMode): string {
  return mode === 'prototype' ? '/api' : '/api/v1';
}

function mapStatus(conversation: V1Conversation): Conversation['status'] {
  if (conversation.sandbox_status === 'RUNNING') return 'active';
  if (conversation.sandbox_status === 'PAUSED') return 'paused';
  if (conversation.sandbox_status === 'ERROR' || conversation.execution_status === 'ERROR') return 'error';
  return 'completed';
}

export function mapV1Conversation(conversation: V1Conversation, mode: BackendMode): Conversation {
  return {
    id: conversation.id,
    title: conversation.title || 'Untitled conversation',
    created_at: conversation.created_at,
    updated_at: conversation.updated_at,
    message_count: 0,
    total_cost: conversation.metrics?.accumulated_cost ?? 0,
    status: mapStatus(conversation),
    workspace_type: mode,
    sandbox_id: conversation.sandbox_id,
    conversation_url: conversation.conversation_url ?? null,
    session_api_key: conversation.session_api_key ?? null,
  };
}

function mapEvent(raw: Record<string, unknown>): ConversationEvent {
  const id = String(raw.id ?? raw.event_id ?? `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`);
  const source = raw.source === 'user' || raw.source === 'assistant' || raw.source === 'agent' || raw.source === 'environment'
    ? raw.source
    : raw.source === 'USER'
      ? 'user'
      : raw.source === 'AGENT'
        ? 'agent'
        : 'environment';
  const kind = String(raw.kind ?? raw.type ?? raw.action ?? '').toLowerCase();
  const text = raw.message ?? raw.text ?? raw.content ?? raw.args;
  const eventType: ConversationEvent['type'] =
    kind.includes('error') ? 'error' :
    kind.includes('observation') ? 'observation' :
    kind.includes('action') || kind.includes('tool') ? 'action' :
    kind.includes('state') ? 'state_update' :
    'message';

  return {
    id,
    type: eventType,
    timestamp: String(raw.timestamp ?? new Date().toISOString()),
    source,
    content: typeof text === 'string'
      ? { text }
      : { ...raw, text: typeof raw.message === 'string' ? raw.message : undefined },
  };
}

function v1SettingsToConfig(settings: V1Settings, connection: BackendConnection): AppConfig {
  const llm = settings.agent_settings?.llm;
  return {
    llm: {
      model: llm?.model ?? '',
      base_url: llm?.base_url ?? null,
      has_api_key: Boolean(settings.llm_api_key_set),
    },
    workspace: {
      type: connection.mode,
      working_dir: '',
      cloud_api_url: connection.mode === 'cloud' ? connection.baseUrl : null,
      host: connection.mode === 'local' ? connection.baseUrl : null,
      runtime_api_url: null,
      has_api_key: Boolean(connection.authToken),
      has_runtime_api_key: false,
      has_cloud_api_key: Boolean(connection.authToken),
    },
    security_policy: settings.conversation_settings?.confirmation_mode ? 'confirm_risky' : 'auto',
    persistence_dir: '',
    enable_browser_tools: true,
    enable_metrics: Boolean(settings.user_consents_to_analytics),
    max_context_size: settings.max_iterations ?? 0,
  };
}

function settingsUpdateToV1(config: Partial<Settings>) {
  const payload: Record<string, unknown> = {};
  const llm: Record<string, unknown> = {};

  if (config.llm_model !== undefined) llm.model = config.llm_model;
  if (config.llm_base_url !== undefined) llm.base_url = config.llm_base_url || null;
  if (config.llm_api_key) llm.api_key = config.llm_api_key;
  if (Object.keys(llm).length > 0) payload.agent_settings_diff = { llm };

  if (config.security_policy !== undefined) {
    payload.conversation_settings_diff = {
      confirmation_mode: config.security_policy !== 'auto',
    };
  }

  if (config.enable_metrics !== undefined) {
    payload.user_consents_to_analytics = config.enable_metrics;
  }
  if (config.max_context_size !== undefined) {
    payload.max_iterations = config.max_context_size;
  }

  return payload;
}

export class OpenHandsV1Backend implements OpenHandsBackend {
  readonly connection: BackendConnection;
  protected readonly prefix: string;

  constructor(connection: BackendConnection) {
    this.connection = connection;
    this.prefix = apiPrefix(connection.mode);
  }

  getCapabilities() {
    return capabilitiesForMode(this.connection.mode);
  }

  protected request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return request(this.connection.baseUrl, `${this.prefix}${endpoint}`, options, this.connection.authToken);
  }

  async healthCheck(): Promise<BackendHealth> {
    await request(this.connection.baseUrl, '/alive', {}, this.connection.authToken);
    return { status: 'ok', initialized: true, mode: this.connection.mode };
  }

  async getSession(): Promise<UserSession> {
    try {
      const user = await this.request<{ id?: string; email?: string | null; name?: string | null }>('/users/me');
      return {
        authenticated: true,
        user: {
          id: user.id ?? user.email ?? 'openhands-user',
          email: user.email ?? null,
          name: user.name ?? null,
        },
      };
    } catch {
      return { authenticated: false, user: null };
    }
  }

  async getConfig(): Promise<AppConfig> {
    const settings = await this.request<V1Settings>('/settings');
    return v1SettingsToConfig(settings, this.connection);
  }

  async updateConfig(config: Partial<Settings>): Promise<{ status: string; message: string; config?: AppConfig }> {
    if (config.backend_mode || config.backend_base_url !== undefined || config.backend_auth_token !== undefined) {
      saveBackendConnection({
        mode: config.backend_mode ?? this.connection.mode,
        baseUrl: config.backend_base_url ?? this.connection.baseUrl,
        authToken: config.backend_auth_token || this.connection.authToken,
      });
    }

    const payload = settingsUpdateToV1(config);
    if (Object.keys(payload).length > 0) {
      await this.request('/settings', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    return { status: 'success', message: 'Settings saved' };
  }

  async getGlobalStats(): Promise<GlobalStats> {
    const [conversations, count] = await Promise.all([
      this.listConversations(100),
      this.request<number>('/app-conversations/count').catch(() => 0),
    ]);
    return {
      total_conversations: count || conversations.total,
      active_conversations: conversations.conversations.filter(conversation => conversation.status === 'active').length,
      total_messages: conversations.conversations.reduce((sum, conversation) => sum + conversation.message_count, 0),
      total_cost: conversations.conversations.reduce((sum, conversation) => sum + conversation.total_cost, 0),
      total_tool_calls: 0,
      total_errors: conversations.conversations.filter(conversation => conversation.status === 'error').length,
    };
  }

  async listConversations(limit = 50): Promise<{ conversations: Conversation[]; total: number }> {
    const page = await this.request<V1Page<V1Conversation>>(`/app-conversations/search?limit=${limit}`);
    return {
      conversations: page.items.map(item => mapV1Conversation(item, this.connection.mode)),
      total: page.items.length,
    };
  }

  async createConversation(title?: string): Promise<{ conversation_id: string }> {
    const task = await this.request<V1StartTask>('/app-conversations', {
      method: 'POST',
      body: JSON.stringify({
        title: title || 'New conversation',
        trigger: 'gui',
      }),
    });

    if (task.app_conversation_id) return { conversation_id: task.app_conversation_id };

    for (let attempt = 0; attempt < 30; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const tasks = await this.request<Array<V1StartTask | null>>(`/app-conversations/start-tasks?ids=${task.id}`);
      const current = tasks[0];
      if (current?.status === 'READY' && current.app_conversation_id) {
        return { conversation_id: current.app_conversation_id };
      }
      if (current?.status === 'ERROR') {
        throw new Error(current.detail || 'Failed to start OpenHands conversation');
      }
    }

    return { conversation_id: task.id };
  }

  async getConversation(id: string): Promise<Conversation> {
    const items = await this.request<Array<V1Conversation | null>>(`/app-conversations?ids=${id}`);
    const conversation = items[0];
    if (!conversation) throw new Error(`Conversation ${id} not found`);
    return mapV1Conversation(conversation, this.connection.mode);
  }

  async deleteConversation(id: string): Promise<{ status: string }> {
    await this.request(`/app-conversations/${id}`, { method: 'DELETE' });
    return { status: 'success' };
  }

  async updateConversationTitle(id: string, title: string): Promise<{ status: string }> {
    await this.request(`/app-conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    });
    return { status: 'success' };
  }

  async getConversationHistory(id: string): Promise<{ events: ConversationEvent[] }> {
    const page = await this.request<V1Page<Record<string, unknown>>>(`/conversation/${id}/events/search?limit=100`);
    return { events: page.items.map(mapEvent) };
  }

  async getConversationStats(id: string): Promise<ConversationStats> {
    const events = await this.getConversationHistory(id).catch(() => ({ events: [] }));
    const conversation = await this.getConversation(id).catch(() => null);
    return {
      ...DEFAULT_STATS,
      total_messages: events.events.filter(event => event.type === 'message').length,
      user_messages: events.events.filter(event => event.type === 'message' && event.source === 'user').length,
      assistant_messages: events.events.filter(event => event.type === 'message' && event.source !== 'user').length,
      tool_calls: events.events.filter(event => event.type === 'action').length,
      errors: events.events.filter(event => event.type === 'error').length,
      accumulated_cost: conversation?.total_cost ?? 0,
    };
  }

  startConversation(): Promise<{ status: string }> {
    return Promise.resolve({ status: 'success' });
  }

  async pauseConversation(id: string): Promise<{ status: string }> {
    const conversation = await this.getConversation(id);
    if (conversation.sandbox_id) {
      await this.request(`/sandboxes/${conversation.sandbox_id}/pause`, { method: 'POST' });
    }
    return { status: 'success' };
  }

  async resumeConversation(id: string): Promise<{ status: string }> {
    const conversation = await this.getConversation(id);
    if (conversation.sandbox_id) {
      await this.request(`/sandboxes/${conversation.sandbox_id}/resume`, { method: 'POST' });
    }
    return { status: 'success' };
  }

  async stopConversation(id: string): Promise<{ status: string }> {
    await this.deleteConversation(id);
    return { status: 'success' };
  }

  confirmAction(): Promise<{ status: string }> {
    return Promise.resolve({ status: 'success' });
  }

  async sendMessage(id: string, message: string): Promise<{ events: ConversationEvent[] }> {
    await this.request(`/conversations/${id}/pending-messages`, {
      method: 'POST',
      body: JSON.stringify({
        role: 'user',
        content: [{ type: 'text', text: message }],
      }),
    });
    return { events: [] };
  }

  async getSandbox(id: string): Promise<SandboxInfo | null> {
    const sandboxes = await this.request<Array<SandboxInfo | null>>(`/sandboxes?id=${id}`);
    return sandboxes[0] ?? null;
  }

  async listRepositories(query = ''): Promise<{ repositories: Repository[] }> {
    const suffix = query ? `&query=${encodeURIComponent(query)}` : '';
    const page = await this.request<V1Page<Record<string, unknown>>>(`/git/repositories/search?limit=50${suffix}`);
    return {
      repositories: page.items.map(item => ({
        id: String(item.id ?? item.full_name ?? item.name),
        full_name: String(item.full_name ?? item.name ?? item.repository ?? 'unknown/repository'),
        provider: typeof item.provider === 'string' ? item.provider : null,
        default_branch: typeof item.default_branch === 'string' ? item.default_branch : null,
      })),
    };
  }

  async listSuggestedTasks(repository?: string): Promise<{ tasks: SuggestedTask[] }> {
    const suffix = repository ? `&repository=${encodeURIComponent(repository)}` : '';
    const page = await this.request<V1Page<Record<string, unknown>>>(`/git/suggested-tasks/search?limit=20${suffix}`);
    return {
      tasks: page.items.map(item => ({
        id: String(item.id ?? item.title ?? crypto.randomUUID()),
        title: String(item.title ?? item.issue_title ?? 'Suggested task'),
        description: typeof item.description === 'string' ? item.description : null,
        repository: typeof item.repository === 'string' ? item.repository : repository ?? null,
      })),
    };
  }

  async listStartTasks(): Promise<{ tasks: StartTask[] }> {
    const page = await this.request<V1Page<V1StartTask>>('/app-conversations/start-tasks/search?limit=25');
    return {
      tasks: page.items.map(task => ({
        id: task.id,
        status: task.status,
        detail: task.detail,
        conversation_id: task.app_conversation_id,
      })),
    };
  }

  async readWorkspaceFile(conversationId: string, path: string): Promise<WorkspaceFile> {
    const params = new URLSearchParams({ path });
    const response = await this.request<{ content?: string; path?: string; language?: string | null }>(
      `/app-conversations/${conversationId}/file?${params.toString()}`,
    );
    return {
      path: response.path ?? path,
      content: response.content ?? '',
      language: response.language ?? null,
    };
  }

  async listGitChanges(conversationId: string): Promise<{ changes: GitChange[] }> {
    const conversation = await this.getConversation(conversationId).catch(() => null);
    if (!conversation?.conversation_url) return { changes: [] };
    return { changes: [] };
  }

  async getRuntimeLinks(conversation: Conversation | null): Promise<{ links: RuntimeLink[] }> {
    const links: RuntimeLink[] = [];
    if (conversation?.conversation_url) {
      links.push({
        id: 'agent-server',
        label: 'Agent server',
        url: conversation.conversation_url,
        kind: 'agent',
      });
    }
    if (conversation?.sandbox_id) {
      const sandbox = await this.getSandbox(conversation.sandbox_id).catch(() => null);
      for (const exposed of sandbox?.exposed_urls ?? []) {
        const name = exposed.name.toLowerCase();
        links.push({
          id: exposed.name,
          label: exposed.name,
          url: exposed.url,
          kind: name.includes('vscode') ? 'vscode' : name.includes('browser') ? 'browser' : 'served',
        });
      }
    }
    return { links };
  }

  async listSkills(): Promise<{ skills: SkillInfo[] }> {
    const page = await this.request<V1Page<Record<string, unknown>>>('/skills/search?limit=100');
    return {
      skills: page.items.map(item => ({
        name: String(item.name ?? 'Unnamed skill'),
        type: typeof item.type === 'string' ? item.type : undefined,
        description: typeof item.description === 'string' ? item.description : null,
        enabled: typeof item.enabled === 'boolean' ? item.enabled : undefined,
      })),
    };
  }

  listMcpServers(): Promise<{ servers: McpServerInfo[] }> {
    return Promise.resolve({ servers: [] });
  }

  async listSecrets(): Promise<{ secrets: SecretInfo[] }> {
    const page = await this.request<V1Page<{ id?: string; name: string; description?: string | null }>>('/secrets/search?limit=100');
    return {
      secrets: page.items.map(secret => ({
        id: secret.id,
        name: secret.name,
        description: secret.description ?? null,
        value_set: true,
      })),
    };
  }

  async saveSecret(secret: { name: string; value?: string; description?: string }): Promise<{ status: string }> {
    if (!secret.value) return { status: 'success' };
    await this.request('/secrets', {
      method: 'POST',
      body: JSON.stringify({
        name: secret.name,
        description: secret.description || null,
        value: secret.value,
      }),
    });
    return { status: 'success' };
  }

  async deleteSecret(name: string): Promise<{ status: string }> {
    await this.request(`/secrets/${encodeURIComponent(name)}`, { method: 'DELETE' });
    return { status: 'success' };
  }

  getBillingStatus(): Promise<ProductStatus> {
    return Promise.resolve(this.connection.mode === 'cloud'
      ? { available: true, message: 'Billing is managed by OpenHands SaaS.' }
      : UNSUPPORTED_PRODUCT_STATUS);
  }

  getOrganizationStatus(): Promise<ProductStatus> {
    return Promise.resolve(this.connection.mode === 'cloud'
      ? { available: true, message: 'Organization management is available through OpenHands SaaS.' }
      : UNSUPPORTED_PRODUCT_STATUS);
  }

  getApiKeysStatus(): Promise<ProductStatus> {
    return Promise.resolve(this.connection.mode === 'cloud'
      ? { available: true, message: 'API keys are managed by OpenHands SaaS.' }
      : UNSUPPORTED_PRODUCT_STATUS);
  }

  getSharedConversation(): Promise<{ conversation: Conversation | null; events: ConversationEvent[] }> {
    return Promise.resolve({ conversation: null, events: [] });
  }

  getWebSocketUrl(conversation: Conversation | null, fallbackConversationId: string): string | null {
    if (!fallbackConversationId) return null;
    const conversationUrl = conversation?.conversation_url;
    if (!conversationUrl) return null;

    const url = new URL(conversationUrl, this.connection.baseUrl);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const pathPrefix = url.pathname.split('/api/conversations')[0].replace(/\/$/, '');
    const params = new URLSearchParams({ resend_all: 'true' });
    if (conversation?.session_api_key) {
      params.set('session_api_key', conversation.session_api_key);
    }

    return `${protocol}//${url.host}${pathPrefix}/sockets/events/${fallbackConversationId}?${params.toString()}`;
  }

  buildSocketMessage(message: string): unknown {
    return {
      role: 'user',
      content: [{ type: 'text', text: message }],
    };
  }

  normalizeSocketMessage(data: unknown): SocketEnvelope {
    if (data && typeof data === 'object' && 'type' in data) {
      const envelope = data as SocketEnvelope;
      if (['history', 'event', 'complete', 'error', 'ack', 'pong', 'confirmed'].includes(envelope.type)) {
        return envelope;
      }
    }

    return {
      type: 'event',
      event: mapEvent(data as Record<string, unknown>),
    };
  }
}

export class LocalOpenHandsBackend extends OpenHandsV1Backend {}

export class CloudOpenHandsBackend extends OpenHandsV1Backend {}

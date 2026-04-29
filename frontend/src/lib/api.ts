import type { 
  Conversation, 
  ConversationStats, 
  GlobalStats, 
  AppConfig,
  ConversationEvent,
  Settings 
} from '../types';

export type { Settings };

const API_BASE = '/api';

class APIError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'APIError';
    this.status = status;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new APIError(response.status, error.detail || 'Request failed');
  }

  return response.json();
}

export function settingsFromConfig(config: AppConfig): Settings {
  return {
    llm_model: config.llm.model,
    llm_api_key: '',
    llm_base_url: config.llm.base_url ?? '',
    workspace_type: config.workspace.type,
    workspace_dir: config.workspace.working_dir,
    remote_host: config.workspace.host ?? '',
    remote_api_key: '',
    runtime_api_url: config.workspace.runtime_api_url ?? '',
    runtime_api_key: '',
    openhands_cloud_url: config.workspace.cloud_api_url ?? 'https://app.all-hands.dev',
    openhands_cloud_api_key: '',
    security_policy: config.security_policy,
    enable_browser_tools: config.enable_browser_tools,
    enable_metrics: config.enable_metrics,
    max_context_size: config.max_context_size,
    has_llm_api_key: config.llm.has_api_key,
    has_openhands_cloud_api_key: config.workspace.has_cloud_api_key,
  };
}

// Health check
export async function healthCheck(): Promise<{ status: string; initialized: boolean; mode?: string }> {
  return request('/health');
}

// Config
export async function getConfig(): Promise<AppConfig> {
  return request('/config');
}

export async function updateConfig(config: Partial<Settings>): Promise<{ status: string; message: string }> {
  return request('/config', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

// Global stats
export async function getGlobalStats(): Promise<GlobalStats> {
  return request('/stats');
}

// Conversations
export async function listConversations(limit = 50, offset = 0): Promise<{ conversations: Conversation[]; total: number }> {
  return request(`/conversations?limit=${limit}&offset=${offset}`);
}

export async function createConversation(title?: string): Promise<{ conversation_id: string }> {
  return request('/conversations', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export async function getConversation(id: string): Promise<Conversation> {
  return request(`/conversations/${id}`);
}

export async function deleteConversation(id: string): Promise<{ status: string }> {
  return request(`/conversations/${id}`, {
    method: 'DELETE',
  });
}

export async function updateConversationTitle(id: string, title: string): Promise<{ status: string }> {
  return request(`/conversations/${id}/title`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  });
}

export async function getConversationHistory(id: string): Promise<{ events: ConversationEvent[] }> {
  return request(`/conversations/${id}/history`);
}

export async function getConversationStats(id: string): Promise<ConversationStats> {
  return request(`/conversations/${id}/stats`);
}

// Conversation actions
export async function startConversation(id: string): Promise<{ status: string }> {
  return request(`/conversations/${id}/start`, { method: 'POST' });
}

export async function pauseConversation(id: string): Promise<{ status: string }> {
  return request(`/conversations/${id}/pause`, { method: 'POST' });
}

export async function resumeConversation(id: string): Promise<{ status: string }> {
  return request(`/conversations/${id}/resume`, { method: 'POST' });
}

export async function stopConversation(id: string): Promise<{ status: string }> {
  return request(`/conversations/${id}/stop`, { method: 'POST' });
}

export async function confirmAction(id: string, approved: boolean): Promise<{ status: string }> {
  return request(`/conversations/${id}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ approved }),
  });
}

export async function sendMessage(id: string, message: string): Promise<{ events: ConversationEvent[] }> {
  return request(`/conversations/${id}/message`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

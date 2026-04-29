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
  
  // Get settings from localStorage for API key
  const settings = getSettings();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  // Add API key header if available
  if (settings.llm_api_key) {
    (headers as Record<string, string>)['X-LLM-API-Key'] = settings.llm_api_key;
  }
  
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

// Settings (stored in localStorage)
export function getSettings(): Settings {
  const stored = localStorage.getItem('openhands-settings');
  if (stored) {
    return JSON.parse(stored);
  }
  return {
    llm_model: 'anthropic/claude-sonnet-4-5-20250929',
    llm_api_key: '',
    llm_base_url: '',
    workspace_type: 'local',
    security_policy: 'confirm_risky',
  };
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem('openhands-settings', JSON.stringify(settings));
}

export function hasApiKey(): boolean {
  const settings = getSettings();
  return !!settings.llm_api_key;
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

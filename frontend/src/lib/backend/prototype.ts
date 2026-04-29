import type {
  AppConfig,
  BackendConnection,
  Conversation,
  ConversationEvent,
  ConversationStats,
  GlobalStats,
  Settings,
} from '../../types';
import { request } from './http';
import type { BackendHealth, OpenHandsBackend, SocketEnvelope } from './types';

const API_BASE = '/api';

export class DevSdkBackend implements OpenHandsBackend {
  readonly connection: BackendConnection;

  constructor(connection: BackendConnection) {
    this.connection = connection;
  }

  healthCheck(): Promise<BackendHealth> {
    return request(API_BASE, '/health');
  }

  getConfig(): Promise<AppConfig> {
    return request(API_BASE, '/config');
  }

  updateConfig(config: Partial<Settings>): Promise<{ status: string; message: string }> {
    return request(API_BASE, '/config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  getGlobalStats(): Promise<GlobalStats> {
    return request(API_BASE, '/stats');
  }

  listConversations(limit = 50, offset = 0): Promise<{ conversations: Conversation[]; total: number }> {
    return request(API_BASE, `/conversations?limit=${limit}&offset=${offset}`);
  }

  createConversation(title?: string): Promise<{ conversation_id: string }> {
    return request(API_BASE, '/conversations', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  }

  getConversation(id: string): Promise<Conversation> {
    return request(API_BASE, `/conversations/${id}`);
  }

  deleteConversation(id: string): Promise<{ status: string }> {
    return request(API_BASE, `/conversations/${id}`, { method: 'DELETE' });
  }

  updateConversationTitle(id: string, title: string): Promise<{ status: string }> {
    return request(API_BASE, `/conversations/${id}/title`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    });
  }

  getConversationHistory(id: string): Promise<{ events: ConversationEvent[] }> {
    return request(API_BASE, `/conversations/${id}/history`);
  }

  getConversationStats(id: string): Promise<ConversationStats> {
    return request(API_BASE, `/conversations/${id}/stats`);
  }

  startConversation(id: string): Promise<{ status: string }> {
    return request(API_BASE, `/conversations/${id}/start`, { method: 'POST' });
  }

  pauseConversation(id: string): Promise<{ status: string }> {
    return request(API_BASE, `/conversations/${id}/pause`, { method: 'POST' });
  }

  resumeConversation(id: string): Promise<{ status: string }> {
    return request(API_BASE, `/conversations/${id}/resume`, { method: 'POST' });
  }

  stopConversation(id: string): Promise<{ status: string }> {
    return request(API_BASE, `/conversations/${id}/stop`, { method: 'POST' });
  }

  confirmAction(id: string, approved: boolean): Promise<{ status: string }> {
    return request(API_BASE, `/conversations/${id}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ approved }),
    });
  }

  sendMessage(id: string, message: string): Promise<{ events: ConversationEvent[] }> {
    return request(API_BASE, `/conversations/${id}/message`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  listSecrets(): Promise<{ secrets: [] }> {
    return Promise.resolve({ secrets: [] });
  }

  saveSecret(): Promise<{ status: string }> {
    return Promise.resolve({ status: 'success' });
  }

  deleteSecret(): Promise<{ status: string }> {
    return Promise.resolve({ status: 'success' });
  }

  getWebSocketUrl(_conversation: Conversation | null, fallbackConversationId: string): string | null {
    if (!fallbackConversationId) return null;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws/${fallbackConversationId}`;
  }

  buildSocketMessage(message: string): unknown {
    return { type: 'message', content: message };
  }

  normalizeSocketMessage(data: unknown): SocketEnvelope {
    return data as SocketEnvelope;
  }
}

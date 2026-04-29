import type {
  AppConfig,
  GitChange,
  BackendConnection,
  Conversation,
  ConversationEvent,
  ConversationStats,
  GlobalStats,
  McpServerInfo,
  ProductStatus,
  Repository,
  RuntimeLink,
  Settings,
  SkillInfo,
  StartTask,
  SuggestedTask,
  UserSession,
  WorkspaceFile,
} from '../../types';
import { request } from './http';
import type { BackendHealth, OpenHandsBackend, SocketEnvelope } from './types';
import { capabilitiesForMode, UNSUPPORTED_PRODUCT_STATUS } from './capabilities';

const API_BASE = '/api';

export class DevSdkBackend implements OpenHandsBackend {
  readonly connection: BackendConnection;

  constructor(connection: BackendConnection) {
    this.connection = connection;
  }

  getCapabilities() {
    return capabilitiesForMode(this.connection.mode);
  }

  healthCheck(): Promise<BackendHealth> {
    return request(API_BASE, '/health');
  }

  getSession(): Promise<UserSession> {
    return Promise.resolve({ authenticated: true, user: { id: 'local-sdk', name: 'Local SDK User' } });
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

  listRepositories(): Promise<{ repositories: Repository[] }> {
    return Promise.resolve({ repositories: [] });
  }

  listSuggestedTasks(): Promise<{ tasks: SuggestedTask[] }> {
    return Promise.resolve({ tasks: [] });
  }

  listStartTasks(): Promise<{ tasks: StartTask[] }> {
    return Promise.resolve({ tasks: [] });
  }

  readWorkspaceFile(conversationId: string, path: string): Promise<WorkspaceFile> {
    void conversationId;
    return Promise.resolve({
      path,
      content: 'Workspace file browsing is not exposed by the SDK prototype facade yet.',
      language: 'text',
    });
  }

  listGitChanges(): Promise<{ changes: GitChange[] }> {
    return Promise.resolve({ changes: [] });
  }

  getRuntimeLinks(): Promise<{ links: RuntimeLink[] }> {
    return Promise.resolve({ links: [] });
  }

  listSkills(): Promise<{ skills: SkillInfo[] }> {
    return Promise.resolve({ skills: [] });
  }

  listMcpServers(): Promise<{ servers: McpServerInfo[] }> {
    return Promise.resolve({ servers: [] });
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

  getBillingStatus(): Promise<ProductStatus> {
    return Promise.resolve(UNSUPPORTED_PRODUCT_STATUS);
  }

  getOrganizationStatus(): Promise<ProductStatus> {
    return Promise.resolve(UNSUPPORTED_PRODUCT_STATUS);
  }

  getApiKeysStatus(): Promise<ProductStatus> {
    return Promise.resolve(UNSUPPORTED_PRODUCT_STATUS);
  }

  getSharedConversation(): Promise<{ conversation: Conversation | null; events: ConversationEvent[] }> {
    return Promise.resolve({ conversation: null, events: [] });
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

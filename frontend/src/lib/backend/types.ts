import type {
  AppConfig,
  BackendConnection,
  Conversation,
  ConversationEvent,
  ConversationStats,
  GlobalStats,
  SecretInfo,
  SandboxInfo,
  Settings,
} from '../../types';

export interface BackendHealth {
  status: string;
  initialized: boolean;
  mode?: string;
}

export interface BackendConfigUpdate {
  status: string;
  message: string;
  config?: AppConfig;
}

export interface BackendRequestOptions extends RequestInit {
  skipJsonContentType?: boolean;
}

export interface SocketEnvelope {
  type: 'history' | 'event' | 'complete' | 'error' | 'ack' | 'pong' | 'confirmed';
  events?: ConversationEvent[];
  event?: ConversationEvent;
  error?: string;
  message?: string;
  approved?: boolean;
}

export interface OpenHandsBackend {
  readonly connection: BackendConnection;
  healthCheck(): Promise<BackendHealth>;
  getConfig(): Promise<AppConfig>;
  updateConfig(config: Partial<Settings>): Promise<BackendConfigUpdate>;
  getGlobalStats(): Promise<GlobalStats>;
  listConversations(limit?: number, offset?: number): Promise<{ conversations: Conversation[]; total: number }>;
  createConversation(title?: string): Promise<{ conversation_id: string }>;
  getConversation(id: string): Promise<Conversation>;
  deleteConversation(id: string): Promise<{ status: string }>;
  updateConversationTitle(id: string, title: string): Promise<{ status: string }>;
  getConversationHistory(id: string): Promise<{ events: ConversationEvent[] }>;
  getConversationStats(id: string): Promise<ConversationStats>;
  startConversation(id: string): Promise<{ status: string }>;
  pauseConversation(id: string): Promise<{ status: string }>;
  resumeConversation(id: string): Promise<{ status: string }>;
  stopConversation(id: string): Promise<{ status: string }>;
  confirmAction(id: string, approved: boolean): Promise<{ status: string }>;
  sendMessage(id: string, message: string): Promise<{ events: ConversationEvent[] }>;
  getSandbox?(id: string): Promise<SandboxInfo | null>;
  listSecrets(): Promise<{ secrets: SecretInfo[] }>;
  saveSecret(secret: { name: string; value?: string; description?: string }): Promise<{ status: string }>;
  deleteSecret(name: string): Promise<{ status: string }>;
  getWebSocketUrl(conversation: Conversation | null, fallbackConversationId: string): string | null;
  buildSocketMessage(message: string): unknown;
  normalizeSocketMessage(data: unknown): SocketEnvelope;
}

// Conversation types
export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  total_cost: number;
  status: 'active' | 'paused' | 'completed' | 'error';
  workspace_type: string;
  sandbox_id?: string | null;
  conversation_url?: string | null;
  session_api_key?: string | null;
}

export interface ConversationStats {
  total_messages: number;
  user_messages: number;
  assistant_messages: number;
  tool_calls: number;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  accumulated_cost: number;
  average_response_time: number;
  errors: number;
}

export interface GlobalStats {
  total_conversations: number;
  active_conversations: number;
  total_messages: number;
  total_cost: number;
  total_tool_calls: number;
  total_errors: number;
}

// Event types
export type EventType = 'message' | 'action' | 'observation' | 'state_update' | 'error' | 'confirmation_request';

export interface ConversationEvent {
  id: string;
  type: EventType;
  timestamp: string;
  source: 'user' | 'assistant' | 'agent' | 'environment';
  content: Record<string, unknown>;
}

// Config types
export interface LLMConfig {
  model: string;
  base_url: string | null;
  has_api_key: boolean;
}

export interface WorkspaceConfig {
  type: string;
  working_dir: string;
  host?: string | null;
  runtime_api_url?: string | null;
  cloud_api_url?: string | null;
  has_api_key: boolean;
  has_runtime_api_key: boolean;
  has_cloud_api_key: boolean;
}

export interface AppConfig {
  llm: LLMConfig;
  workspace: WorkspaceConfig;
  security_policy: string;
  persistence_dir: string;
  enable_browser_tools: boolean;
  enable_metrics: boolean;
  max_context_size: number;
}

// Settings edited in the app and persisted server-side.
export interface Settings {
  backend_mode: BackendMode;
  backend_base_url: string;
  backend_auth_token: string;
  has_backend_auth_token: boolean;
  llm_model: string;
  llm_api_key: string;
  llm_base_url: string;
  workspace_type: string;
  workspace_dir: string;
  remote_host: string;
  remote_api_key: string;
  runtime_api_url: string;
  runtime_api_key: string;
  openhands_cloud_url: string;
  openhands_cloud_api_key: string;
  security_policy: string;
  enable_browser_tools: boolean;
  enable_metrics: boolean;
  max_context_size: number;
  has_llm_api_key: boolean;
  has_openhands_cloud_api_key: boolean;
}

export type BackendMode = 'prototype' | 'local' | 'cloud';

export interface BackendConnection {
  mode: BackendMode;
  baseUrl: string;
  authToken?: string;
}

export interface SandboxInfo {
  id: string;
  status: string;
  session_api_key?: string | null;
  exposed_urls?: Array<{
    name: string;
    url: string;
    port: number;
  }> | null;
}

export interface SecretInfo {
  id?: string;
  name: string;
  description?: string | null;
  value_set: boolean;
}

export interface BackendCapabilities {
  sdkRuntime: boolean;
  appV1: boolean;
  auth: boolean;
  billing: boolean;
  organizations: boolean;
  invitations: boolean;
  sharedConversations: boolean;
  repositories: boolean;
  suggestedTasks: boolean;
  startTasks: boolean;
  files: boolean;
  gitDiffs: boolean;
  runtimeLinks: boolean;
  terminal: boolean;
  browser: boolean;
  skills: boolean;
  mcp: boolean;
  apiKeys: boolean;
}

export interface UserSession {
  authenticated: boolean;
  user?: {
    id: string;
    email?: string | null;
    name?: string | null;
  } | null;
}

export interface Repository {
  id: string;
  full_name: string;
  provider?: string | null;
  default_branch?: string | null;
}

export interface SuggestedTask {
  id: string;
  title: string;
  description?: string | null;
  repository?: string | null;
}

export interface StartTask {
  id: string;
  status: string;
  detail?: string | null;
  conversation_id?: string | null;
}

export interface WorkspaceFile {
  path: string;
  content?: string;
  language?: string | null;
}

export interface GitChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'unknown';
  diff?: string | null;
}

export interface RuntimeLink {
  id: string;
  label: string;
  url: string;
  kind: 'agent' | 'browser' | 'vscode' | 'served' | 'terminal' | 'other';
}

export interface SkillInfo {
  name: string;
  type?: string;
  description?: string | null;
  enabled?: boolean;
}

export interface McpServerInfo {
  name: string;
  status: 'enabled' | 'disabled' | 'unknown';
  description?: string | null;
}

export interface ProductStatus {
  available: boolean;
  message: string;
}

// WebSocket message types
export interface WSMessage {
  type: 'message' | 'confirm' | 'ping';
  content?: string;
  approved?: boolean;
}

export interface WSResponse {
  type: 'history' | 'event' | 'complete' | 'error' | 'ack' | 'pong' | 'confirmed';
  events?: ConversationEvent[];
  event?: ConversationEvent;
  error?: string;
  message?: string;
  approved?: boolean;
}

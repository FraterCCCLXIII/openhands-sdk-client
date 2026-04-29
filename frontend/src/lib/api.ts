import type { 
  BackendCapabilities,
  Conversation, 
  ConversationStats, 
  GlobalStats, 
  AppConfig,
  ConversationEvent,
  ProductStatus,
  Settings 
} from '../types';
import { getBackend, updateBackendConnection } from './backend';

export type { Settings };

export function settingsFromConfig(config: AppConfig): Settings {
  const backend = getBackend();
  return {
    backend_mode: backend.connection.mode,
    backend_base_url: backend.connection.baseUrl,
    backend_auth_token: '',
    has_backend_auth_token: Boolean(backend.connection.authToken),
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

export function getCapabilities(): BackendCapabilities {
  return getBackend().getCapabilities();
}

export async function getSession() {
  return getBackend().getSession();
}

// Health check
export async function healthCheck(): Promise<{ status: string; initialized: boolean; mode?: string }> {
  return getBackend().healthCheck();
}

// Config
export async function getConfig(): Promise<AppConfig> {
  return getBackend().getConfig();
}

export async function updateConfig(config: Partial<Settings>): Promise<{ status: string; message: string }> {
  if (config.backend_mode || config.backend_base_url !== undefined || config.backend_auth_token !== undefined) {
    updateBackendConnection({
      mode: config.backend_mode ?? getBackend().connection.mode,
      baseUrl: config.backend_base_url ?? getBackend().connection.baseUrl,
      authToken: config.backend_auth_token || getBackend().connection.authToken,
    });
  }
  return getBackend().updateConfig(config);
}

// Global stats
export async function getGlobalStats(): Promise<GlobalStats> {
  return getBackend().getGlobalStats();
}

// Conversations
export async function listConversations(limit = 50, offset = 0): Promise<{ conversations: Conversation[]; total: number }> {
  return getBackend().listConversations(limit, offset);
}

export async function createConversation(title?: string): Promise<{ conversation_id: string }> {
  return getBackend().createConversation(title);
}

export async function getConversation(id: string): Promise<Conversation> {
  return getBackend().getConversation(id);
}

export async function deleteConversation(id: string): Promise<{ status: string }> {
  return getBackend().deleteConversation(id);
}

export async function updateConversationTitle(id: string, title: string): Promise<{ status: string }> {
  return getBackend().updateConversationTitle(id, title);
}

export async function getConversationHistory(id: string): Promise<{ events: ConversationEvent[] }> {
  return getBackend().getConversationHistory(id);
}

export async function getConversationStats(id: string): Promise<ConversationStats> {
  return getBackend().getConversationStats(id);
}

// Conversation actions
export async function startConversation(id: string): Promise<{ status: string }> {
  return getBackend().startConversation(id);
}

export async function pauseConversation(id: string): Promise<{ status: string }> {
  return getBackend().pauseConversation(id);
}

export async function resumeConversation(id: string): Promise<{ status: string }> {
  return getBackend().resumeConversation(id);
}

export async function stopConversation(id: string): Promise<{ status: string }> {
  return getBackend().stopConversation(id);
}

export async function confirmAction(id: string, approved: boolean): Promise<{ status: string }> {
  return getBackend().confirmAction(id, approved);
}

export async function sendMessage(id: string, message: string): Promise<{ events: ConversationEvent[] }> {
  return getBackend().sendMessage(id, message);
}

export async function listSecrets() {
  return getBackend().listSecrets();
}

export async function saveSecret(secret: { name: string; value?: string; description?: string }) {
  return getBackend().saveSecret(secret);
}

export async function deleteSecret(name: string) {
  return getBackend().deleteSecret(name);
}

export async function listRepositories(query?: string) {
  return getBackend().listRepositories(query);
}

export async function listSuggestedTasks(repository?: string) {
  return getBackend().listSuggestedTasks(repository);
}

export async function listStartTasks() {
  return getBackend().listStartTasks();
}

export async function readWorkspaceFile(conversationId: string, path: string) {
  return getBackend().readWorkspaceFile(conversationId, path);
}

export async function listGitChanges(conversationId: string) {
  return getBackend().listGitChanges(conversationId);
}

export async function getRuntimeLinks(conversation: Conversation | null) {
  return getBackend().getRuntimeLinks(conversation);
}

export async function listSkills() {
  return getBackend().listSkills();
}

export async function listMcpServers() {
  return getBackend().listMcpServers();
}

export async function getBillingStatus(): Promise<ProductStatus> {
  return getBackend().getBillingStatus();
}

export async function getOrganizationStatus(): Promise<ProductStatus> {
  return getBackend().getOrganizationStatus();
}

export async function getApiKeysStatus(): Promise<ProductStatus> {
  return getBackend().getApiKeysStatus();
}

export async function getSharedConversation(id: string) {
  return getBackend().getSharedConversation(id);
}

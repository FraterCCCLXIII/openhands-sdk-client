import type { BackendConnection, BackendMode } from '../../types';

const CONNECTION_STORAGE_KEY = 'openhands-client-backend';
const AUTH_STORAGE_KEY = 'openhands-client-backend-auth';

const DEFAULT_CONNECTIONS: Record<BackendMode, BackendConnection> = {
  prototype: {
    mode: 'prototype',
    baseUrl: '',
  },
  local: {
    mode: 'local',
    baseUrl: 'http://localhost:3000',
  },
  cloud: {
    mode: 'cloud',
    baseUrl: 'https://app.all-hands.dev',
  },
};

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, '');
}

export function getDefaultConnection(mode: BackendMode = 'prototype'): BackendConnection {
  return { ...DEFAULT_CONNECTIONS[mode] };
}

export function getBackendConnection(): BackendConnection {
  const raw = localStorage.getItem(CONNECTION_STORAGE_KEY);
  const bootstrapped = getConnectionFromUrl();
  const shouldForceBootstrap = new URLSearchParams(window.location.search).get('backendOverride') === '1';
  if (bootstrapped && (!raw || shouldForceBootstrap)) {
    saveBackendConnection(bootstrapped);
    return bootstrapped;
  }

  if (!raw) return getDefaultConnection();

  try {
    const parsed = JSON.parse(raw) as Partial<BackendConnection>;
    const mode = parsed.mode ?? 'prototype';
    return {
      ...getDefaultConnection(mode),
      ...parsed,
      mode,
      baseUrl: normalizeBaseUrl(parsed.baseUrl ?? getDefaultConnection(mode).baseUrl),
      authToken: sessionStorage.getItem(AUTH_STORAGE_KEY) ?? undefined,
    };
  } catch {
    return getDefaultConnection();
  }
}

function getConnectionFromUrl(): BackendConnection | null {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('backendMode') as BackendConnection['mode'] | null;
  const baseUrl = params.get('backendBaseUrl');

  if (!mode || !['prototype', 'local', 'cloud'].includes(mode)) {
    return null;
  }

  const defaults = getDefaultConnection(mode);
  return {
    mode,
    baseUrl: normalizeBaseUrl(baseUrl || defaults.baseUrl),
    authToken: sessionStorage.getItem(AUTH_STORAGE_KEY) ?? undefined,
  };
}

export function saveBackendConnection(connection: BackendConnection): void {
  localStorage.setItem(CONNECTION_STORAGE_KEY, JSON.stringify({
    mode: connection.mode,
    baseUrl: normalizeBaseUrl(connection.baseUrl),
  }));
  if (connection.authToken) {
    sessionStorage.setItem(AUTH_STORAGE_KEY, connection.authToken);
  }
}

export function clearBackendConnection(): void {
  localStorage.removeItem(CONNECTION_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
}

import type { BackendConnection } from '../../types';
import { getBackendConnection, saveBackendConnection } from './connection';
import { CloudOpenHandsBackend, LocalOpenHandsBackend } from './openhands-v1';
import { DevSdkBackend } from './prototype';
import type { OpenHandsBackend } from './types';

let cachedConnectionKey = '';
let cachedBackend: OpenHandsBackend | null = null;

function connectionKey(connection: BackendConnection): string {
  return JSON.stringify({
    mode: connection.mode,
    baseUrl: connection.baseUrl,
    hasAuthToken: Boolean(connection.authToken),
  });
}

export function createBackend(connection: BackendConnection): OpenHandsBackend {
  if (connection.mode === 'local') return new LocalOpenHandsBackend(connection);
  if (connection.mode === 'cloud') return new CloudOpenHandsBackend(connection);
  return new DevSdkBackend(connection);
}

export function getBackend(): OpenHandsBackend {
  const connection = getBackendConnection();
  const nextKey = connectionKey(connection);

  if (!cachedBackend || cachedConnectionKey !== nextKey) {
    cachedBackend = createBackend(connection);
    cachedConnectionKey = nextKey;
  }

  return cachedBackend;
}

export function updateBackendConnection(connection: BackendConnection): OpenHandsBackend {
  saveBackendConnection(connection);
  cachedBackend = createBackend(connection);
  cachedConnectionKey = connectionKey(connection);
  return cachedBackend;
}

export type { OpenHandsBackend };
export { getBackendConnection, saveBackendConnection };

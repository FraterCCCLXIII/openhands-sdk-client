import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getBackendConnection, saveBackendConnection } from './connection';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    removeItem: vi.fn((key: string) => values.delete(key)),
  };
}

describe('backend connection persistence', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage());
    vi.stubGlobal('sessionStorage', createStorage());
    vi.stubGlobal('window', {
      location: {
        search: '',
      },
    });
  });

  it('persists only non-secret connection metadata in localStorage', () => {
    saveBackendConnection({
      mode: 'cloud',
      baseUrl: 'https://app.all-hands.dev/',
      authToken: 'secret-token',
    });

    const localSetItem = vi.mocked(localStorage.setItem);
    const storedMetadata = JSON.parse(localSetItem.mock.calls[0][1]);

    expect(storedMetadata).toEqual({
      mode: 'cloud',
      baseUrl: 'https://app.all-hands.dev',
    });
    expect(JSON.stringify(storedMetadata)).not.toContain('secret-token');
    expect(sessionStorage.setItem).toHaveBeenCalledWith('openhands-client-backend-auth', 'secret-token');
  });

  it('restores the default prototype mode when no metadata is present', () => {
    expect(getBackendConnection()).toEqual({
      mode: 'prototype',
      baseUrl: '',
    });
  });
});

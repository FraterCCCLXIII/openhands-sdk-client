import { describe, expect, it } from 'vitest';
import { capabilitiesForMode } from './capabilities';
import { DevSdkBackend } from './prototype';

describe('backend capabilities', () => {
  it('keeps SDK prototype mode focused on runtime capabilities', () => {
    const capabilities = capabilitiesForMode('prototype');

    expect(capabilities.sdkRuntime).toBe(true);
    expect(capabilities.appV1).toBe(false);
    expect(capabilities.billing).toBe(false);
    expect(capabilities.repositories).toBe(false);
  });

  it('enables OpenHands app server capabilities for local mode', () => {
    const capabilities = capabilitiesForMode('local');

    expect(capabilities.sdkRuntime).toBe(false);
    expect(capabilities.appV1).toBe(true);
    expect(capabilities.repositories).toBe(true);
    expect(capabilities.files).toBe(true);
    expect(capabilities.billing).toBe(false);
  });

  it('marks cloud mode as product-capable', () => {
    const capabilities = capabilitiesForMode('cloud');

    expect(capabilities.auth).toBe(true);
    expect(capabilities.billing).toBe(true);
    expect(capabilities.organizations).toBe(true);
    expect(capabilities.sharedConversations).toBe(true);
  });

  it('returns stable SDK fallback inventories', async () => {
    const backend = new DevSdkBackend({ mode: 'prototype', baseUrl: '' });

    await expect(backend.listRepositories()).resolves.toEqual({ repositories: [] });
    await expect(backend.listSuggestedTasks()).resolves.toEqual({ tasks: [] });
    await expect(backend.listStartTasks()).resolves.toEqual({ tasks: [] });
    await expect(backend.getBillingStatus()).resolves.toMatchObject({ available: false });
  });
});

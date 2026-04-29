import type { BackendCapabilities, BackendMode, ProductStatus } from '../../types';

export const UNSUPPORTED_PRODUCT_STATUS: ProductStatus = {
  available: false,
  message: 'This capability is owned by the selected product backend and is not available in SDK-only mode yet.',
};

export function capabilitiesForMode(mode: BackendMode): BackendCapabilities {
  const appV1 = mode === 'local' || mode === 'cloud';
  const productBackend = mode === 'cloud';

  return {
    sdkRuntime: mode === 'prototype',
    appV1,
    auth: productBackend,
    billing: productBackend,
    organizations: productBackend,
    invitations: productBackend,
    sharedConversations: productBackend,
    repositories: appV1,
    suggestedTasks: appV1,
    startTasks: appV1,
    files: appV1,
    gitDiffs: appV1,
    runtimeLinks: appV1,
    terminal: false,
    browser: appV1,
    skills: appV1,
    mcp: false,
    apiKeys: productBackend,
  };
}

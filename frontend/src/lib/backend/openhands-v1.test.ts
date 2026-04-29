import { describe, expect, it } from 'vitest';
import { OpenHandsV1Backend, mapV1Conversation } from './openhands-v1';

describe('OpenHands V1 adapter contract', () => {
  it('normalizes OpenHands Main conversations into the client shape', () => {
    const conversation = mapV1Conversation({
      id: 'conv-1',
      title: null,
      sandbox_id: 'sandbox-1',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:01:00Z',
      sandbox_status: 'RUNNING',
      execution_status: 'RUNNING',
      conversation_url: 'http://localhost:3000/api/conversations/conv-1',
      session_api_key: 'session-key',
      metrics: {
        accumulated_cost: 1.25,
        accumulated_token_usage: null,
      },
    }, 'local');

    expect(conversation).toMatchObject({
      id: 'conv-1',
      title: 'Untitled conversation',
      status: 'active',
      workspace_type: 'local',
      sandbox_id: 'sandbox-1',
      total_cost: 1.25,
    });
  });

  it('builds V1 websocket URLs from the runtime conversation URL', () => {
    const backend = new OpenHandsV1Backend({
      mode: 'local',
      baseUrl: 'http://localhost:3000',
    });

    const url = backend.getWebSocketUrl({
      id: 'conv-1',
      title: 'Conversation',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:01:00Z',
      message_count: 0,
      total_cost: 0,
      status: 'active',
      workspace_type: 'local',
      conversation_url: 'http://localhost:4567/runtime/123/api/conversations/conv-1',
      session_api_key: 'secret',
    }, 'conv-1');

    expect(url).toBe('ws://localhost:4567/runtime/123/sockets/events/conv-1?resend_all=true&session_api_key=secret');
  });

  it('wraps raw OpenHands event payloads in the shared socket envelope', () => {
    const backend = new OpenHandsV1Backend({
      mode: 'local',
      baseUrl: 'http://localhost:3000',
    });

    const envelope = backend.normalizeSocketMessage({
      id: 'evt-1',
      source: 'USER',
      action: 'message',
      message: 'hello',
      timestamp: '2026-01-01T00:00:00Z',
    });

    expect(envelope.type).toBe('event');
    expect(envelope.event).toMatchObject({
      id: 'evt-1',
      type: 'message',
      source: 'user',
      content: { text: 'hello' },
    });
  });
});

import { useEffect, useRef, useCallback, useState } from 'react';
import { getBackend } from '../lib/backend';
import type { Conversation, ConversationEvent, WSResponse } from '../types';

interface UseWebSocketOptions {
  onHistory?: (events: ConversationEvent[]) => void;
  onEvent?: (event: ConversationEvent) => void;
  onComplete?: (events: ConversationEvent[]) => void;
  onError?: (error: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useWebSocket(conversationId: string, conversation: Conversation | null, options: UseWebSocketOptions = {}) {
  const wsRef = useRef<WebSocket | null>(null);
  const optionsRef = useRef(options);
  const connectRef = useRef<() => void>(() => {});
  const reconnectAttemptsRef = useRef(0);
  const pingIntervalRef = useRef<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const handleMessage = useCallback((data: WSResponse) => {
    switch (data.type) {
      case 'history':
        optionsRef.current.onHistory?.(data.events || []);
        break;
      case 'event':
        if (data.event) {
          optionsRef.current.onEvent?.(data.event);
        }
        break;
      case 'complete':
        setIsProcessing(false);
        optionsRef.current.onComplete?.(data.events || []);
        break;
      case 'error':
        setIsProcessing(false);
        optionsRef.current.onError?.(data.error || 'Unknown error');
        break;
      case 'ack':
        // Message acknowledged
        break;
      case 'pong':
        // Ping response
        break;
      case 'confirmed':
        optionsRef.current.onEvent?.({
          id: `evt_confirm_${Date.now()}`,
          type: 'state_update',
          timestamp: new Date().toISOString(),
          source: 'environment',
          content: { state: data.approved ? 'approved' : 'rejected' },
        });
        break;
    }
  }, []);

  const attemptReconnect = useCallback(() => {
    const maxAttempts = 5;
    if (reconnectAttemptsRef.current < maxAttempts) {
      reconnectAttemptsRef.current++;
      const delay = 1000 * reconnectAttemptsRef.current;
      console.log(`Attempting reconnect in ${delay}ms...`);
      setTimeout(() => connectRef.current(), delay);
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const wsUrl = getBackend().getWebSocketUrl(conversation, conversationId);
    if (!wsUrl) return;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      reconnectAttemptsRef.current = 0;
      setIsConnected(true);
      optionsRef.current.onConnect?.();
      
      // Start ping interval
      pingIntervalRef.current = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const data = getBackend().normalizeSocketMessage(JSON.parse(event.data)) as WSResponse;
        handleMessage(data);
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      optionsRef.current.onDisconnect?.();
      attemptReconnect();
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      optionsRef.current.onError?.('Connection error');
    };
  }, [attemptReconnect, conversation, conversationId, handleMessage]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const sendMessage = useCallback((content: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setIsProcessing(true);
      wsRef.current.send(JSON.stringify(getBackend().buildSocketMessage(content)));
    }
  }, []);

  const confirmAction = useCallback((approved: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'confirm', approved }));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    isConnected,
    isProcessing,
    sendMessage,
    confirmAction,
    disconnect,
  };
}

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Send, 
  Pause, 
  Play, 
  Square, 
  Check, 
  X,
  Bot,
  User,
  Wrench,
  AlertTriangle,
  Info
} from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';
import { 
  getConversation, 
  getConversationStats, 
  pauseConversation, 
  resumeConversation, 
  stopConversation 
} from '../lib/api';
import type { Conversation, ConversationStats, ConversationEvent } from '../types';

export function Chat() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [stats, setStats] = useState<ConversationStats | null>(null);
  const [events, setEvents] = useState<ConversationEvent[]>([]);
  const [message, setMessage] = useState('');
  const [pendingConfirmation, setPendingConfirmation] = useState<ConversationEvent | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const appendEvents = useCallback((incomingEvents: ConversationEvent[]) => {
    setEvents(prev => {
      const seenIds = new Set(prev.map(event => event.id));
      const next = [...prev];

      for (const event of incomingEvents) {
        if (seenIds.has(event.id)) continue;
        const isDuplicateOptimisticUserMessage =
          event.type === 'message' &&
          event.source === 'user' &&
          next.some(existing =>
            existing.id.startsWith('user_') &&
            existing.source === 'user' &&
            existing.content.text === event.content.text
          );

        if (!isDuplicateOptimisticUserMessage) {
          next.push(event);
          seenIds.add(event.id);
        }
      }

      return next;
    });
  }, []);

  const handleHistory = useCallback((historyEvents: ConversationEvent[]) => {
    setEvents(historyEvents);
  }, []);

  const handleEvent = useCallback((event: ConversationEvent) => {
    appendEvents([event]);
    if (event.type === 'confirmation_request') {
      setPendingConfirmation(event);
    }
  }, [appendEvents]);

  const handleComplete = useCallback(async (completedEvents: ConversationEvent[]) => {
    appendEvents(completedEvents);
    if (id) {
      const newStats = await getConversationStats(id);
      setStats(newStats);
    }
  }, [appendEvents, id]);

  const handleError = useCallback((error: string) => {
    setEvents(prev => [...prev, {
      id: `error_${Date.now()}`,
      type: 'error',
      timestamp: new Date().toISOString(),
      source: 'environment',
      content: { error },
    }]);
  }, []);

  const { isConnected, isProcessing, sendMessage: wsSendMessage, confirmAction } = useWebSocket(
    id || '',
    conversation,
    {
      onHistory: handleHistory,
      onEvent: handleEvent,
      onComplete: handleComplete,
      onError: handleError,
    }
  );

  const loadConversation = useCallback(async () => {
    if (!id) return;
    try {
      const [convData, statsData] = await Promise.all([
        getConversation(id),
        getConversationStats(id),
      ]);
      setConversation(convData);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load conversation:', error);
      navigate('/');
    }
  }, [id, navigate]);

  useEffect(() => {
    if (!id) {
      navigate('/');
      return;
    }
    loadConversation();
  }, [id, navigate, loadConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  function handleSendMessage() {
    if (!message.trim() || isProcessing) return;
    
    // Add user message to events immediately
    const userEvent: ConversationEvent = {
      id: `user_${Date.now()}`,
      type: 'message',
      timestamp: new Date().toISOString(),
      source: 'user',
      content: { text: message, role: 'user' },
    };
    setEvents(prev => [...prev, userEvent]);
    
    wsSendMessage(message);
    setMessage('');
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setMessage(e.target.value);
    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
  }

  async function handlePause() {
    if (!id) return;
    await pauseConversation(id);
    setConversation(prev => prev ? { ...prev, status: 'paused' } : null);
  }

  async function handleResume() {
    if (!id) return;
    await resumeConversation(id);
    setConversation(prev => prev ? { ...prev, status: 'active' } : null);
  }

  async function handleStop() {
    if (!id || !confirm('Are you sure you want to stop this conversation?')) return;
    await stopConversation(id);
    setConversation(prev => prev ? { ...prev, status: 'completed' } : null);
  }

  function handleConfirm(approved: boolean) {
    confirmAction(approved);
    setPendingConfirmation(null);
  }

  function renderEvent(event: ConversationEvent) {
    const { type, source, content, timestamp } = event;
    
    if (type === 'confirmation_request') return null;

    const isUser = source === 'user';
    const time = new Date(timestamp).toLocaleTimeString();
    
    const baseClasses = 'max-w-[85%] rounded-xl p-4';
    const messageClasses = isUser 
      ? `${baseClasses} app-button-accent self-end`
      : type === 'action'
      ? `${baseClasses} border border-primary bg-[var(--app-accent-soft)] self-start`
      : type === 'observation'
      ? `${baseClasses} app-status-success self-start`
      : type === 'error'
      ? `${baseClasses} app-status-danger self-start`
      : `${baseClasses} bg-surface-hover self-start`;

    const icon = isUser ? <User className="w-4 h-4" /> :
      type === 'action' ? <Wrench className="w-4 h-4 text-primary" /> :
      type === 'observation' ? <Check className="w-4 h-4 text-success" /> :
      type === 'error' ? <AlertTriangle className="w-4 h-4 text-danger" /> :
      type === 'state_update' ? <Info className="w-4 h-4 text-secondary" /> :
      <Bot className="w-4 h-4 text-text-secondary" />;

    return (
      <div key={event.id} className={messageClasses}>
        <div className="flex items-center justify-between gap-2 mb-2 text-xs opacity-70">
          <span className="flex items-center gap-1 capitalize">
            {icon}
            {type === 'action' ? 'Tool Call' : type === 'observation' ? 'Tool Result' : source}
          </span>
          <span>{time}</span>
        </div>
        <div className="whitespace-pre-wrap break-words">
          {type === 'message' && (
            <span>{(content as { text?: string }).text || JSON.stringify(content)}</span>
          )}
          {type === 'action' && (
            <div>
              <div className="font-mono text-sm font-medium text-primary mb-2">
                {(content as { tool_name?: string }).tool_name}
              </div>
              <pre className="text-xs bg-bg/50 p-2 rounded overflow-x-auto">
                {JSON.stringify((content as { parameters?: unknown }).parameters, null, 2)}
              </pre>
            </div>
          )}
          {type === 'observation' && (
            <pre className="text-xs bg-bg/50 p-2 rounded overflow-x-auto">
              {typeof (content as { result?: unknown }).result === 'string' 
                ? (content as { result?: string }).result 
                : JSON.stringify((content as { result?: unknown }).result, null, 2)}
            </pre>
          )}
          {type === 'error' && (
            <span className="text-danger">{(content as { error?: string }).error}</span>
          )}
          {type === 'state_update' && (
            <span>{(content as { state?: string }).state}: {(content as { details?: string }).details}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-180px)]">
      {/* Sidebar */}
      <aside className="app-card w-72 rounded-xl p-5 flex flex-col gap-6">
        <div>
          <h3 className="font-medium text-text-primary truncate">
            {conversation?.title || 'Loading...'}
          </h3>
          <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${
            conversation?.status === 'active' ? 'app-status-success' :
            conversation?.status === 'paused' ? 'app-status-warning' :
            conversation?.status === 'completed' ? 'app-status-neutral' :
            'app-status-danger'
          }`}>
            {conversation?.status || '-'}
          </span>
          <div className={`mt-2 text-xs ${isConnected ? 'text-success' : 'text-danger'}`}>
            {isConnected ? '● Connected' : '○ Disconnected'}
          </div>
        </div>

        <div>
          <h4 className="text-xs uppercase text-text-muted tracking-wider mb-3">Statistics</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">Messages</span>
              <span className="font-medium">{stats?.total_messages ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Tool Calls</span>
              <span className="font-medium">{stats?.tool_calls ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Tokens</span>
              <span className="font-medium">{stats?.total_tokens ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Cost</span>
              <span className="font-medium">${(stats?.accumulated_cost ?? 0).toFixed(4)}</span>
            </div>
          </div>
        </div>

        <div className="mt-auto flex gap-2">
          {conversation?.status === 'paused' ? (
            <button 
              onClick={handleResume}
              className="app-button-subtle flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm"
            >
              <Play className="w-4 h-4" /> Resume
            </button>
          ) : (
            <button 
              onClick={handlePause}
              className="app-button-subtle flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm"
            >
              <Pause className="w-4 h-4" /> Pause
            </button>
          )}
          <button 
            onClick={handleStop}
            className="app-status-danger flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm"
          >
            <Square className="w-4 h-4" /> Stop
          </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="app-card flex-1 flex flex-col rounded-xl overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          {events.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-text-secondary">
              <Bot className="w-16 h-16 mb-4 text-text-muted" />
              <h2 className="text-xl font-medium text-text-primary mb-2">Start a conversation</h2>
              <p>Send a message to begin interacting with the OpenHands agent.</p>
            </div>
          ) : (
            <>
              {events.map(renderEvent)}
              {isProcessing && (
                <div className="flex gap-1 p-4 self-start">
                  <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                  <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Confirmation Banner */}
        {pendingConfirmation && (
          <div className="border-t app-border bg-[var(--app-warning-soft)] px-6 py-4">
            <div className="flex items-center gap-4">
              <AlertTriangle className="w-6 h-6 text-warning" />
              <div className="flex-1">
                <strong className="text-warning">Action requires confirmation</strong>
                <p className="text-sm text-text-secondary">
                  Security Risk: {(pendingConfirmation.content as { security_risk?: string }).security_risk}
                </p>
              </div>
              <button
                onClick={() => handleConfirm(true)}
                className="app-status-success flex items-center gap-1 px-4 py-2 rounded-lg"
              >
                <Check className="w-4 h-4" /> Approve
              </button>
              <button
                onClick={() => handleConfirm(false)}
                className="app-status-danger flex items-center gap-1 px-4 py-2 rounded-lg"
              >
                <X className="w-4 h-4" /> Reject
              </button>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t app-border">
          <div className="flex gap-3 items-end">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Send a message..."
              disabled={isProcessing || conversation?.status === 'completed'}
              rows={1}
              className="flex-1 px-4 py-3 bg-bg border app-border rounded-lg text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-primary disabled:opacity-50"
              style={{ minHeight: '48px', maxHeight: '200px' }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!message.trim() || isProcessing || conversation?.status === 'completed'}
              className="app-button-accent p-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-text-muted mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}

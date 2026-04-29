/**
 * Chat Interface JavaScript - handles real-time messaging
 */

document.addEventListener('DOMContentLoaded', () => {
    const chat = new Chat(CONVERSATION_ID);
    chat.init();
});

class Chat {
    constructor(conversationId) {
        this.conversationId = conversationId;
        this.ws = null;
        this.isProcessing = false;
        this.renderedEventIds = new Set();
        
        // DOM elements
        this.messagesContainer = document.getElementById('messages-container');
        this.messageInput = document.getElementById('message-input');
        this.sendBtn = document.getElementById('send-btn');
        this.confirmationBanner = document.getElementById('confirmation-banner');
        this.confirmDetails = document.getElementById('confirmation-details');
    }
    
    async init() {
        this.setupEventListeners();
        await this.loadConversation();
        this.connectWebSocket();
    }
    
    setupEventListeners() {
        // Send message
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        
        // Enter to send, Shift+Enter for new line
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Auto-resize textarea
        this.messageInput.addEventListener('input', () => {
            this.messageInput.style.height = 'auto';
            this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 200) + 'px';
        });
        
        // Confirmation buttons
        document.getElementById('confirm-approve').addEventListener('click', () => this.handleConfirmation(true));
        document.getElementById('confirm-reject').addEventListener('click', () => this.handleConfirmation(false));
        
        // Conversation control buttons
        document.getElementById('pause-btn').addEventListener('click', () => this.pauseConversation());
        document.getElementById('resume-btn').addEventListener('click', () => this.resumeConversation());
        document.getElementById('stop-btn').addEventListener('click', () => this.stopConversation());
    }
    
    async loadConversation() {
        try {
            const conv = await API.getConversation(this.conversationId);
            
            document.getElementById('conversation-title').textContent = conv.title;
            document.getElementById('conversation-status').textContent = conv.status;
            document.getElementById('conversation-status').className = `conversation-status status-badge status-${conv.status}`;
            
            // Update button visibility based on status
            this.updateControlButtons(conv.status);
            
            // Load stats
            await this.loadStats();
            
        } catch (error) {
            console.error('Failed to load conversation:', error);
            document.getElementById('conversation-title').textContent = 'Error loading conversation';
        }
    }
    
    async loadStats() {
        try {
            const stats = await API.getConversationStats(this.conversationId);
            
            document.getElementById('stat-messages').textContent = stats.total_messages || 0;
            document.getElementById('stat-tool-calls').textContent = stats.tool_calls || 0;
            document.getElementById('stat-tokens').textContent = stats.total_tokens || 0;
            document.getElementById('stat-cost').textContent = `$${(stats.accumulated_cost || 0).toFixed(4)}`;
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }
    
    updateControlButtons(status) {
        const pauseBtn = document.getElementById('pause-btn');
        const resumeBtn = document.getElementById('resume-btn');
        
        if (status === 'paused') {
            pauseBtn.style.display = 'none';
            resumeBtn.style.display = 'inline-flex';
        } else {
            pauseBtn.style.display = 'inline-flex';
            resumeBtn.style.display = 'none';
        }
    }
    
    connectWebSocket() {
        this.ws = new WebSocketManager(this.conversationId);
        
        this.ws.on('history', (events) => {
            if (events.length > 0) {
                // Clear welcome message
                const welcome = this.messagesContainer.querySelector('.welcome-message');
                if (welcome) {
                    welcome.remove();
                }
                
                events.forEach(event => this.renderEvent(event));
                this.scrollToBottom();
            }
        });
        
        this.ws.on('event', (event) => {
            this.renderEvent(event);
            this.scrollToBottom();
            
            if (event.type === 'confirmation_request') {
                this.showConfirmation(event.content);
            }
        });
        
        this.ws.on('complete', (events) => {
            events.forEach(event => this.renderEvent(event));
            this.setProcessing(false);
            this.loadStats();
            this.scrollToBottom();
        });
        
        this.ws.on('error', (data) => {
            this.setProcessing(false);
            this.renderEvent({
                type: 'error',
                source: 'environment',
                content: { error: data.error || 'Unknown error' },
                timestamp: new Date().toISOString(),
            });
        });
        
        this.ws.on('connect', () => {
            console.log('Connected to conversation');
        });
        
        this.ws.on('disconnect', () => {
            console.log('Disconnected from conversation');
        });
        
        this.ws.connect();
    }
    
    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message || this.isProcessing) return;
        
        // Clear welcome message if present
        const welcome = this.messagesContainer.querySelector('.welcome-message');
        if (welcome) {
            welcome.remove();
        }
        
        // Add user message to UI immediately
        this.renderEvent({
            type: 'message',
            source: 'user',
            content: { text: message, role: 'user' },
            timestamp: new Date().toISOString(),
        });
        
        // Clear input
        this.messageInput.value = '';
        this.messageInput.style.height = 'auto';
        
        // Show typing indicator
        this.showTypingIndicator();
        
        this.setProcessing(true);
        this.scrollToBottom();
        
        // Send via WebSocket
        this.ws.sendMessage(message);
    }
    
    renderEvent(event) {
        if (event.id) {
            if (this.renderedEventIds.has(event.id)) return;
            this.renderedEventIds.add(event.id);
        }

        // Remove typing indicator if present
        this.removeTypingIndicator();
        
        const messageDiv = document.createElement('div');
        messageDiv.className = this.getMessageClass(event);
        
        let content = '';
        
        switch (event.type) {
            case 'message':
                content = this.renderMessageContent(event);
                break;
            case 'action':
                content = this.renderActionContent(event);
                break;
            case 'observation':
                content = this.renderObservationContent(event);
                break;
            case 'error':
                content = this.renderErrorContent(event);
                break;
            case 'state_update':
                content = this.renderStateUpdateContent(event);
                break;
            case 'confirmation_request':
                // Don't render, just show the banner
                return;
            default:
                content = this.renderGenericContent(event);
        }
        
        messageDiv.innerHTML = content;
        this.messagesContainer.appendChild(messageDiv);
    }
    
    getMessageClass(event) {
        const baseClass = 'message';
        switch (event.type) {
            case 'message':
                return `${baseClass} message-${event.source === 'user' ? 'user' : 'assistant'}`;
            case 'action':
                return `${baseClass} message-action`;
            case 'observation':
                return `${baseClass} message-observation`;
            case 'error':
                return `${baseClass} message-error`;
            default:
                return `${baseClass} message-assistant`;
        }
    }
    
    renderMessageContent(event) {
        const text = event.content?.text || event.content?.content || '';
        return `
            <div class="message-header">
                <span class="message-source">${event.source}</span>
                <span class="message-time">${this.formatTime(event.timestamp)}</span>
            </div>
            <div class="message-content">${this.formatText(text)}</div>
        `;
    }
    
    renderActionContent(event) {
        const toolName = event.content?.tool_name || 'Unknown Tool';
        const params = event.content?.parameters || {};
        
        return `
            <div class="message-header">
                <span class="message-source">🔧 Tool Call</span>
                <span class="message-time">${this.formatTime(event.timestamp)}</span>
            </div>
            <div class="tool-details">
                <div class="tool-name">${this.escapeHtml(toolName)}</div>
                <div class="tool-params"><pre>${this.escapeHtml(JSON.stringify(params, null, 2))}</pre></div>
            </div>
        `;
    }
    
    renderObservationContent(event) {
        const result = event.content?.result || {};
        const success = event.content?.success !== false;
        
        return `
            <div class="message-header">
                <span class="message-source">${success ? '✅' : '❌'} Tool Result</span>
                <span class="message-time">${this.formatTime(event.timestamp)}</span>
            </div>
            <div class="message-content">
                <pre>${this.escapeHtml(typeof result === 'string' ? result : JSON.stringify(result, null, 2))}</pre>
            </div>
        `;
    }
    
    renderErrorContent(event) {
        const error = event.content?.error || 'Unknown error';
        return `
            <div class="message-header">
                <span class="message-source">❌ Error</span>
                <span class="message-time">${this.formatTime(event.timestamp)}</span>
            </div>
            <div class="message-content">${this.escapeHtml(error)}</div>
        `;
    }
    
    renderStateUpdateContent(event) {
        const state = event.content?.state || '';
        const details = event.content?.details || '';
        return `
            <div class="message-header">
                <span class="message-source">ℹ️ State Update</span>
                <span class="message-time">${this.formatTime(event.timestamp)}</span>
            </div>
            <div class="message-content">${this.escapeHtml(state)}: ${this.escapeHtml(details)}</div>
        `;
    }
    
    renderGenericContent(event) {
        return `
            <div class="message-header">
                <span class="message-source">${event.source || 'System'}</span>
                <span class="message-time">${this.formatTime(event.timestamp)}</span>
            </div>
            <div class="message-content">${this.escapeHtml(JSON.stringify(event.content))}</div>
        `;
    }
    
    showConfirmation(content) {
        const action = content?.action || {};
        const risk = content?.security_risk || 'unknown';
        
        this.confirmDetails.textContent = `Security Risk: ${risk}. Action: ${JSON.stringify(action).slice(0, 100)}...`;
        this.confirmationBanner.style.display = 'block';
    }
    
    hideConfirmation() {
        this.confirmationBanner.style.display = 'none';
    }
    
    handleConfirmation(approved) {
        this.ws.confirmAction(approved);
        this.hideConfirmation();
    }
    
    showTypingIndicator() {
        const existing = this.messagesContainer.querySelector('.typing-indicator');
        if (existing) return;
        
        const indicator = document.createElement('div');
        indicator.className = 'typing-indicator';
        indicator.innerHTML = '<span></span><span></span><span></span>';
        this.messagesContainer.appendChild(indicator);
    }
    
    removeTypingIndicator() {
        const indicator = this.messagesContainer.querySelector('.typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }
    
    setProcessing(processing) {
        this.isProcessing = processing;
        this.sendBtn.disabled = processing;
        this.messageInput.disabled = processing;
        
        if (!processing) {
            this.messageInput.focus();
        }
    }
    
    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
    
    formatTime(timestamp) {
        if (!timestamp) return '';
        try {
            return new Date(timestamp).toLocaleTimeString();
        } catch {
            return '';
        }
    }
    
    formatText(text) {
        if (!text) return '';
        
        // Escape HTML first
        let formatted = this.escapeHtml(text);
        
        // Format code blocks
        formatted = formatted.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
        
        // Format inline code
        formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // Format bold
        formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        
        // Format italic
        formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        
        // Format line breaks
        formatted = formatted.replace(/\n/g, '<br>');
        
        return formatted;
    }
    
    escapeHtml(text) {
        if (typeof text !== 'string') return text;
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    async pauseConversation() {
        try {
            await API.pauseConversation(this.conversationId);
            document.getElementById('conversation-status').textContent = 'paused';
            document.getElementById('conversation-status').className = 'conversation-status status-badge status-paused';
            this.updateControlButtons('paused');
        } catch (error) {
            console.error('Failed to pause:', error);
        }
    }
    
    async resumeConversation() {
        try {
            await API.resumeConversation(this.conversationId);
            document.getElementById('conversation-status').textContent = 'active';
            document.getElementById('conversation-status').className = 'conversation-status status-badge status-active';
            this.updateControlButtons('active');
        } catch (error) {
            console.error('Failed to resume:', error);
        }
    }
    
    async stopConversation() {
        if (!confirm('Are you sure you want to stop this conversation?')) return;
        
        try {
            await API.stopConversation(this.conversationId);
            document.getElementById('conversation-status').textContent = 'completed';
            document.getElementById('conversation-status').className = 'conversation-status status-badge status-completed';
            this.setProcessing(true); // Disable further input
        } catch (error) {
            console.error('Failed to stop:', error);
        }
    }
}

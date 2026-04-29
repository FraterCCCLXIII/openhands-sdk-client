/**
 * OpenHands Client API module
 * Handles all API calls to the backend server
 */

const API = {
    baseUrl: '',
    
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        };
        
        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }
        
        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({ detail: response.statusText }));
                throw new Error(error.detail || 'Request failed');
            }
            
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },
    
    // Health check
    async healthCheck() {
        return this.request('/api/health');
    },
    
    // Configuration
    async getConfig() {
        return this.request('/api/config');
    },
    
    async updateConfig(config) {
        return this.request('/api/config', {
            method: 'POST',
            body: config,
        });
    },
    
    // Global stats
    async getStats() {
        return this.request('/api/stats');
    },
    
    // Conversations
    async listConversations(limit = 50, offset = 0) {
        return this.request(`/api/conversations?limit=${limit}&offset=${offset}`);
    },
    
    async createConversation(title = null) {
        return this.request('/api/conversations', {
            method: 'POST',
            body: { title },
        });
    },
    
    async getConversation(conversationId) {
        return this.request(`/api/conversations/${conversationId}`);
    },
    
    async deleteConversation(conversationId) {
        return this.request(`/api/conversations/${conversationId}`, {
            method: 'DELETE',
        });
    },
    
    async updateConversationTitle(conversationId, title) {
        return this.request(`/api/conversations/${conversationId}/title`, {
            method: 'PATCH',
            body: { title },
        });
    },
    
    async getConversationHistory(conversationId) {
        return this.request(`/api/conversations/${conversationId}/history`);
    },
    
    async getConversationStats(conversationId) {
        return this.request(`/api/conversations/${conversationId}/stats`);
    },
    
    // Conversation actions
    async startConversation(conversationId) {
        return this.request(`/api/conversations/${conversationId}/start`, {
            method: 'POST',
        });
    },
    
    async pauseConversation(conversationId) {
        return this.request(`/api/conversations/${conversationId}/pause`, {
            method: 'POST',
        });
    },
    
    async resumeConversation(conversationId) {
        return this.request(`/api/conversations/${conversationId}/resume`, {
            method: 'POST',
        });
    },
    
    async stopConversation(conversationId) {
        return this.request(`/api/conversations/${conversationId}/stop`, {
            method: 'POST',
        });
    },
    
    async confirmAction(conversationId, approved) {
        return this.request(`/api/conversations/${conversationId}/confirm`, {
            method: 'POST',
            body: { approved },
        });
    },
    
    async sendMessage(conversationId, message) {
        return this.request(`/api/conversations/${conversationId}/message`, {
            method: 'POST',
            body: { message },
        });
    },
};

/**
 * WebSocket connection manager
 */
class WebSocketManager {
    constructor(conversationId) {
        this.conversationId = conversationId;
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.handlers = {
            onHistory: () => {},
            onEvent: () => {},
            onComplete: () => {},
            onError: () => {},
            onConnect: () => {},
            onDisconnect: () => {},
        };
    }
    
    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/${this.conversationId}`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.reconnectAttempts = 0;
            this.handlers.onConnect();
            this.startPingInterval();
        };
        
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {
                console.error('WebSocket message parse error:', error);
            }
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.stopPingInterval();
            this.handlers.onDisconnect();
            this.attemptReconnect();
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.handlers.onError({ error: 'Connection error' });
        };
    }
    
    handleMessage(data) {
        switch (data.type) {
            case 'history':
                this.handlers.onHistory(data.events || []);
                break;
            case 'event':
                this.handlers.onEvent(data.event);
                break;
            case 'complete':
                this.handlers.onComplete(data.events || []);
                break;
            case 'error':
                this.handlers.onError(data);
                break;
            case 'ack':
                // Message acknowledged
                break;
            case 'pong':
                // Ping response
                break;
            case 'confirmed':
                this.handlers.onEvent({
                    type: 'state_update',
                    content: { state: data.approved ? 'approved' : 'rejected' }
                });
                break;
        }
    }
    
    send(type, data = {}) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, ...data }));
        }
    }
    
    sendMessage(content) {
        this.send('message', { content });
    }
    
    confirmAction(approved) {
        this.send('confirm', { approved });
    }
    
    startPingInterval() {
        this.pingInterval = setInterval(() => {
            this.send('ping');
        }, 30000);
    }
    
    stopPingInterval() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
    
    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * this.reconnectAttempts;
            console.log(`Attempting reconnect in ${delay}ms...`);
            setTimeout(() => this.connect(), delay);
        }
    }
    
    disconnect() {
        this.stopPingInterval();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
    
    on(event, handler) {
        const handlerName = `on${event.charAt(0).toUpperCase() + event.slice(1)}`;
        if (this.handlers.hasOwnProperty(handlerName)) {
            this.handlers[handlerName] = handler;
        }
    }
}

// Export for use in other scripts
window.API = API;
window.WebSocketManager = WebSocketManager;

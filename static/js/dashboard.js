/**
 * Dashboard JavaScript - handles the main dashboard page
 */

document.addEventListener('DOMContentLoaded', () => {
    const dashboard = new Dashboard();
    dashboard.init();
});

class Dashboard {
    constructor() {
        this.modal = document.getElementById('new-conversation-modal');
        this.conversationsList = document.getElementById('conversations-list');
    }
    
    async init() {
        this.setupEventListeners();
        await this.loadStats();
        await this.loadConfig();
        await this.loadConversations();
    }
    
    setupEventListeners() {
        // New conversation buttons
        document.getElementById('create-conversation-btn').addEventListener('click', () => this.showModal());
        document.getElementById('new-chat-btn').addEventListener('click', (e) => {
            e.preventDefault();
            this.showModal();
        });
        
        // Modal events
        this.modal.querySelector('.modal-close').addEventListener('click', () => this.hideModal());
        this.modal.querySelector('.modal-cancel').addEventListener('click', () => this.hideModal());
        document.getElementById('create-conversation-submit').addEventListener('click', () => this.createConversation());
        
        // Close modal on outside click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hideModal();
            }
        });
        
        // Enter key in title input
        document.getElementById('conversation-title').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.createConversation();
            }
        });
    }
    
    showModal() {
        this.modal.classList.add('active');
        document.getElementById('conversation-title').focus();
    }
    
    hideModal() {
        this.modal.classList.remove('active');
        document.getElementById('conversation-title').value = '';
    }
    
    async loadStats() {
        try {
            const stats = await API.getStats();
            
            document.getElementById('total-conversations').textContent = stats.total_conversations || 0;
            document.getElementById('active-conversations').textContent = stats.active_conversations || 0;
            document.getElementById('total-messages').textContent = stats.total_messages || 0;
            document.getElementById('total-tool-calls').textContent = stats.total_tool_calls || 0;
            document.getElementById('total-cost').textContent = `$${(stats.total_cost || 0).toFixed(2)}`;
            document.getElementById('total-errors').textContent = stats.total_errors || 0;
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }
    
    async loadConfig() {
        try {
            const config = await API.getConfig();
            
            document.getElementById('config-llm-model').textContent = config.llm?.model || '-';
            document.getElementById('config-workspace-type').textContent = config.workspace?.type || '-';
            document.getElementById('config-security-policy').textContent = config.security_policy || '-';
            document.getElementById('config-browser-tools').textContent = config.enable_browser_tools ? 'Enabled' : 'Disabled';
        } catch (error) {
            console.error('Failed to load config:', error);
        }
    }
    
    async loadConversations() {
        this.conversationsList.innerHTML = '<div class="loading">Loading conversations...</div>';
        
        try {
            const data = await API.listConversations();
            const conversations = data.conversations || [];
            
            if (conversations.length === 0) {
                this.conversationsList.innerHTML = `
                    <div class="loading">
                        No conversations yet. Click "New Conversation" to start.
                    </div>
                `;
                return;
            }
            
            this.conversationsList.innerHTML = conversations.map(conv => this.renderConversationCard(conv)).join('');
            
            // Add event listeners for delete buttons
            this.conversationsList.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const id = btn.dataset.id;
                    if (confirm('Are you sure you want to delete this conversation?')) {
                        await this.deleteConversation(id);
                    }
                });
            });
        } catch (error) {
            console.error('Failed to load conversations:', error);
            this.conversationsList.innerHTML = `
                <div class="loading" style="color: var(--danger-color);">
                    Failed to load conversations. Make sure the server is running.
                </div>
            `;
        }
    }
    
    renderConversationCard(conv) {
        const statusClass = `status-${conv.status || 'active'}`;
        const updatedAt = new Date(conv.updated_at).toLocaleString();
        
        return `
            <a href="/chat/${conv.id}" class="conversation-card">
                <div class="conversation-card-content">
                    <div class="conversation-card-title">${this.escapeHtml(conv.title)}</div>
                    <div class="conversation-card-meta">
                        <span class="status-badge ${statusClass}">${conv.status}</span>
                        <span>${conv.message_count} messages</span>
                        <span>$${(conv.total_cost || 0).toFixed(4)}</span>
                        <span>${updatedAt}</span>
                    </div>
                </div>
                <div class="conversation-card-actions">
                    <button class="btn btn-small btn-danger delete-btn" data-id="${conv.id}">🗑️</button>
                </div>
            </a>
        `;
    }
    
    async createConversation() {
        const titleInput = document.getElementById('conversation-title');
        const title = titleInput.value.trim() || null;
        
        try {
            const result = await API.createConversation(title);
            this.hideModal();
            
            // Navigate to the new conversation
            window.location.href = `/chat/${result.conversation_id}`;
        } catch (error) {
            console.error('Failed to create conversation:', error);
            alert('Failed to create conversation: ' + error.message);
        }
    }
    
    async deleteConversation(id) {
        try {
            await API.deleteConversation(id);
            await this.loadConversations();
            await this.loadStats();
        } catch (error) {
            console.error('Failed to delete conversation:', error);
            alert('Failed to delete conversation: ' + error.message);
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

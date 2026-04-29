"""Conversation management for OpenHands client."""

import uuid
import json
import os
from datetime import datetime
from typing import Optional, Any
from pathlib import Path
from dataclasses import dataclass, field

from openhands_client.event_handler import EventHandler, EventType


@dataclass
class ConversationMetadata:
    """Metadata for a conversation."""
    id: str
    title: str
    created_at: str
    updated_at: str
    message_count: int = 0
    total_cost: float = 0.0
    status: str = "active"  # active, paused, completed, error
    workspace_type: str = "local"
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "message_count": self.message_count,
            "total_cost": self.total_cost,
            "status": self.status,
            "workspace_type": self.workspace_type,
        }


@dataclass
class ConversationStats:
    """Statistics for a conversation."""
    total_messages: int = 0
    user_messages: int = 0
    assistant_messages: int = 0
    tool_calls: int = 0
    total_tokens: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    accumulated_cost: float = 0.0
    average_response_time: float = 0.0
    errors: int = 0
    
    def to_dict(self) -> dict:
        return {
            "total_messages": self.total_messages,
            "user_messages": self.user_messages,
            "assistant_messages": self.assistant_messages,
            "tool_calls": self.tool_calls,
            "total_tokens": self.total_tokens,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "accumulated_cost": self.accumulated_cost,
            "average_response_time": self.average_response_time,
            "errors": self.errors,
        }


class ConversationManager:
    """
    Manages multiple conversations and their persistence.
    Works with the OpenHands SDK Conversation class.
    """
    
    def __init__(self, persistence_dir: str = "./conversations"):
        self.persistence_dir = Path(persistence_dir)
        self.persistence_dir.mkdir(parents=True, exist_ok=True)
        
        self._conversations: dict[str, ConversationMetadata] = {}
        self._active_conversation_id: Optional[str] = None
        self._event_handlers: dict[str, EventHandler] = {}
        self._stats: dict[str, ConversationStats] = {}
        
        # Load existing conversations from disk
        self._load_conversations_index()
    
    def _load_conversations_index(self):
        """Load conversation index from disk."""
        index_path = self.persistence_dir / "index.json"
        if index_path.exists():
            try:
                with open(index_path, "r") as f:
                    data = json.load(f)
                    for conv_data in data.get("conversations", []):
                        conv = ConversationMetadata(**conv_data)
                        self._conversations[conv.id] = conv
            except Exception as e:
                print(f"Error loading conversation index: {e}")
    
    def _save_conversations_index(self):
        """Save conversation index to disk."""
        index_path = self.persistence_dir / "index.json"
        data = {
            "conversations": [c.to_dict() for c in self._conversations.values()],
            "updated_at": datetime.utcnow().isoformat() + "Z",
        }
        with open(index_path, "w") as f:
            json.dump(data, f, indent=2)
    
    def create_conversation(
        self,
        title: Optional[str] = None,
        workspace_type: str = "local"
    ) -> str:
        """Create a new conversation and return its ID."""
        conversation_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat() + "Z"
        
        metadata = ConversationMetadata(
            id=conversation_id,
            title=title or f"Conversation {len(self._conversations) + 1}",
            created_at=now,
            updated_at=now,
            workspace_type=workspace_type,
        )
        
        self._conversations[conversation_id] = metadata
        self._event_handlers[conversation_id] = EventHandler()
        self._stats[conversation_id] = ConversationStats()
        
        # Create conversation directory
        conv_dir = self.persistence_dir / conversation_id
        conv_dir.mkdir(exist_ok=True)
        
        self._save_conversations_index()
        return conversation_id
    
    def get_conversation(self, conversation_id: str) -> Optional[ConversationMetadata]:
        """Get conversation metadata by ID."""
        return self._conversations.get(conversation_id)
    
    def list_conversations(
        self,
        limit: int = 50,
        offset: int = 0,
        status: Optional[str] = None
    ) -> list[dict]:
        """List all conversations."""
        convs = list(self._conversations.values())
        
        if status:
            convs = [c for c in convs if c.status == status]
        
        # Sort by updated_at descending
        convs.sort(key=lambda c: c.updated_at, reverse=True)
        
        return [c.to_dict() for c in convs[offset:offset + limit]]
    
    def delete_conversation(self, conversation_id: str) -> bool:
        """Delete a conversation."""
        if conversation_id not in self._conversations:
            return False
        
        # Remove from memory
        del self._conversations[conversation_id]
        if conversation_id in self._event_handlers:
            del self._event_handlers[conversation_id]
        if conversation_id in self._stats:
            del self._stats[conversation_id]
        
        # Remove from disk
        conv_dir = self.persistence_dir / conversation_id
        if conv_dir.exists():
            import shutil
            shutil.rmtree(conv_dir)
        
        self._save_conversations_index()
        return True
    
    def update_conversation_title(self, conversation_id: str, title: str) -> bool:
        """Update conversation title."""
        if conversation_id not in self._conversations:
            return False
        
        self._conversations[conversation_id].title = title
        self._conversations[conversation_id].updated_at = datetime.utcnow().isoformat() + "Z"
        self._save_conversations_index()
        return True
    
    def get_event_handler(self, conversation_id: str) -> Optional[EventHandler]:
        """Get the event handler for a conversation."""
        if conversation_id not in self._event_handlers:
            self._event_handlers[conversation_id] = EventHandler()
        return self._event_handlers.get(conversation_id)
    
    def get_stats(self, conversation_id: str) -> Optional[ConversationStats]:
        """Get statistics for a conversation."""
        return self._stats.get(conversation_id)
    
    def update_stats(self, conversation_id: str, metrics: dict):
        """Update conversation statistics from SDK metrics."""
        if conversation_id not in self._stats:
            self._stats[conversation_id] = ConversationStats()
        
        stats = self._stats[conversation_id]
        stats.accumulated_cost = metrics.get("accumulated_cost", stats.accumulated_cost)
        stats.total_tokens = metrics.get("total_tokens", stats.total_tokens)
        stats.input_tokens = metrics.get("input_tokens", stats.input_tokens)
        stats.output_tokens = metrics.get("output_tokens", stats.output_tokens)
        
        # Update metadata cost
        if conversation_id in self._conversations:
            self._conversations[conversation_id].total_cost = stats.accumulated_cost
            self._conversations[conversation_id].updated_at = datetime.utcnow().isoformat() + "Z"
    
    def record_message(self, conversation_id: str, source: str):
        """Record a message for statistics."""
        if conversation_id not in self._stats:
            self._stats[conversation_id] = ConversationStats()
        
        stats = self._stats[conversation_id]
        stats.total_messages += 1
        if source == "user":
            stats.user_messages += 1
        elif source in ("assistant", "agent"):
            stats.assistant_messages += 1
        
        if conversation_id in self._conversations:
            self._conversations[conversation_id].message_count = stats.total_messages
            self._conversations[conversation_id].updated_at = datetime.utcnow().isoformat() + "Z"
    
    def record_tool_call(self, conversation_id: str):
        """Record a tool call for statistics."""
        if conversation_id not in self._stats:
            self._stats[conversation_id] = ConversationStats()
        self._stats[conversation_id].tool_calls += 1
    
    def record_error(self, conversation_id: str):
        """Record an error for statistics."""
        if conversation_id not in self._stats:
            self._stats[conversation_id] = ConversationStats()
        self._stats[conversation_id].errors += 1
    
    def set_status(self, conversation_id: str, status: str):
        """Set conversation status."""
        if conversation_id in self._conversations:
            self._conversations[conversation_id].status = status
            self._conversations[conversation_id].updated_at = datetime.utcnow().isoformat() + "Z"
            self._save_conversations_index()
    
    def save_events(self, conversation_id: str):
        """Save event history to disk."""
        if conversation_id not in self._event_handlers:
            return
        
        handler = self._event_handlers[conversation_id]
        events = handler.get_history()
        
        conv_dir = self.persistence_dir / conversation_id
        conv_dir.mkdir(exist_ok=True)
        
        events_path = conv_dir / "events.json"
        with open(events_path, "w") as f:
            json.dump({"events": events}, f, indent=2)
    
    def load_events(self, conversation_id: str) -> list[dict]:
        """Load event history from disk."""
        events_path = self.persistence_dir / conversation_id / "events.json"
        if events_path.exists():
            try:
                with open(events_path, "r") as f:
                    data = json.load(f)
                    return data.get("events", [])
            except Exception as e:
                print(f"Error loading events: {e}")
        return []
    
    def get_active_conversation_id(self) -> Optional[str]:
        """Get the active conversation ID."""
        return self._active_conversation_id
    
    def set_active_conversation(self, conversation_id: Optional[str]):
        """Set the active conversation."""
        self._active_conversation_id = conversation_id
    
    def get_global_stats(self) -> dict:
        """Get aggregated statistics across all conversations."""
        total_conversations = len(self._conversations)
        active_conversations = sum(1 for c in self._conversations.values() if c.status == "active")
        total_messages = sum(s.total_messages for s in self._stats.values())
        total_cost = sum(s.accumulated_cost for s in self._stats.values())
        total_tool_calls = sum(s.tool_calls for s in self._stats.values())
        total_errors = sum(s.errors for s in self._stats.values())
        
        return {
            "total_conversations": total_conversations,
            "active_conversations": active_conversations,
            "total_messages": total_messages,
            "total_cost": total_cost,
            "total_tool_calls": total_tool_calls,
            "total_errors": total_errors,
        }

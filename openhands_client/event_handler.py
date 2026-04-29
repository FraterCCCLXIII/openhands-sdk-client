"""Event handling for OpenHands SDK events."""

import json
import asyncio
from datetime import datetime
from typing import Callable, Optional, Any
from dataclasses import dataclass, field
from enum import Enum


class EventType(str, Enum):
    """Event types from OpenHands SDK."""
    MESSAGE = "message"
    ACTION = "action"
    OBSERVATION = "observation"
    STATE_UPDATE = "state_update"
    ERROR = "error"
    METRICS = "metrics"
    CONFIRMATION_REQUEST = "confirmation_request"


@dataclass
class ClientEvent:
    """Normalized event for the client interface."""
    id: str
    event_type: EventType
    timestamp: str
    source: str  # 'user', 'assistant', 'agent', 'environment'
    content: dict
    raw_event: Optional[Any] = None
    
    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "id": self.id,
            "type": self.event_type.value,
            "timestamp": self.timestamp,
            "source": self.source,
            "content": self.content,
        }
    
    def to_json(self) -> str:
        """Convert to JSON string."""
        return json.dumps(self.to_dict())


class EventHandler:
    """
    Handles SDK events and converts them to client-friendly format.
    Supports both sync and async callbacks for real-time streaming.
    """
    
    def __init__(self):
        self._event_counter = 0
        self._callbacks: list[Callable[[ClientEvent], None]] = []
        self._async_callbacks: list[Callable[[ClientEvent], Any]] = []
        self._event_history: list[ClientEvent] = []
        self._pending_confirmation: Optional[ClientEvent] = None
    
    def add_callback(self, callback: Callable[[ClientEvent], None]):
        """Add a synchronous callback for events."""
        self._callbacks.append(callback)
    
    def add_async_callback(self, callback: Callable[[ClientEvent], Any]):
        """Add an async callback for events."""
        self._async_callbacks.append(callback)
    
    def remove_callback(self, callback: Callable):
        """Remove a callback."""
        if callback in self._callbacks:
            self._callbacks.remove(callback)
        if callback in self._async_callbacks:
            self._async_callbacks.remove(callback)
    
    def _generate_event_id(self) -> str:
        """Generate unique event ID."""
        self._event_counter += 1
        return f"evt_{self._event_counter:06d}"
    
    def _get_timestamp(self) -> str:
        """Get current ISO timestamp."""
        return datetime.utcnow().isoformat() + "Z"
    
    def process_sdk_event(self, event) -> ClientEvent:
        """
        Process an SDK event and convert to ClientEvent.
        This is the main callback to register with the OpenHands Conversation.
        """
        event_type = EventType.MESSAGE
        source = "environment"
        content = {}
        
        event_class_name = event.__class__.__name__
        
        # Handle different SDK event types
        if event_class_name == "MessageEvent":
            event_type = EventType.MESSAGE
            source = getattr(event, "source", "assistant")
            content = {
                "text": getattr(event, "content", str(event)),
                "role": source,
            }
        
        elif event_class_name == "ActionEvent":
            event_type = EventType.ACTION
            source = "agent"
            action = getattr(event, "action", None)
            content = {
                "tool_name": getattr(action, "name", "unknown") if action else "unknown",
                "parameters": action.model_dump() if hasattr(action, "model_dump") else str(action),
                "security_risk": getattr(event, "security_risk", "unknown"),
            }
        
        elif event_class_name == "ObservationEvent":
            event_type = EventType.OBSERVATION
            source = "environment"
            observation = getattr(event, "observation", None)
            content = {
                "result": observation.model_dump() if hasattr(observation, "model_dump") else str(observation),
                "success": getattr(observation, "success", True) if observation else True,
            }
        
        elif event_class_name == "ConversationStateUpdateEvent":
            event_type = EventType.STATE_UPDATE
            source = "environment"
            content = {
                "state": getattr(event, "state", "unknown"),
                "details": str(event),
            }
        
        elif hasattr(event, "to_llm_message"):
            # Generic LLM-convertible event
            event_type = EventType.MESSAGE
            llm_msg = event.to_llm_message()
            source = llm_msg.get("role", "assistant") if isinstance(llm_msg, dict) else "assistant"
            content = llm_msg if isinstance(llm_msg, dict) else {"text": str(llm_msg)}
        
        else:
            # Fallback for unknown events
            content = {"raw": str(event)}
        
        client_event = ClientEvent(
            id=self._generate_event_id(),
            event_type=event_type,
            timestamp=self._get_timestamp(),
            source=source,
            content=content,
            raw_event=event,
        )
        
        # Store in history
        self._event_history.append(client_event)
        
        # Notify callbacks
        self._dispatch_event(client_event)
        
        return client_event
    
    def _dispatch_event(self, event: ClientEvent):
        """Dispatch event to all registered callbacks."""
        for callback in self._callbacks:
            try:
                callback(event)
            except Exception as e:
                print(f"Error in event callback: {e}")
        
        # Handle async callbacks
        for async_callback in self._async_callbacks:
            try:
                # Create task if we're in an event loop
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    asyncio.create_task(async_callback(event))
                else:
                    loop.run_until_complete(async_callback(event))
            except RuntimeError:
                # No event loop, skip async callbacks
                pass
            except Exception as e:
                print(f"Error in async event callback: {e}")
    
    def create_message_event(self, text: str, source: str = "user") -> ClientEvent:
        """Create a message event for user input."""
        event = ClientEvent(
            id=self._generate_event_id(),
            event_type=EventType.MESSAGE,
            timestamp=self._get_timestamp(),
            source=source,
            content={"text": text, "role": source},
        )
        self._event_history.append(event)
        self._dispatch_event(event)
        return event
    
    def create_error_event(self, error: str, details: Optional[dict] = None) -> ClientEvent:
        """Create an error event."""
        event = ClientEvent(
            id=self._generate_event_id(),
            event_type=EventType.ERROR,
            timestamp=self._get_timestamp(),
            source="environment",
            content={"error": error, "details": details or {}},
        )
        self._event_history.append(event)
        self._dispatch_event(event)
        return event
    
    def create_confirmation_request(self, action: dict, security_risk: str) -> ClientEvent:
        """Create a confirmation request event."""
        event = ClientEvent(
            id=self._generate_event_id(),
            event_type=EventType.CONFIRMATION_REQUEST,
            timestamp=self._get_timestamp(),
            source="agent",
            content={
                "action": action,
                "security_risk": security_risk,
                "requires_confirmation": True,
            },
        )
        self._pending_confirmation = event
        self._event_history.append(event)
        self._dispatch_event(event)
        return event
    
    def get_history(self, limit: Optional[int] = None) -> list[dict]:
        """Get event history as list of dicts."""
        events = self._event_history[-limit:] if limit else self._event_history
        return [e.to_dict() for e in events]
    
    def clear_history(self):
        """Clear event history."""
        self._event_history.clear()
    
    @property
    def has_pending_confirmation(self) -> bool:
        """Check if there's a pending confirmation request."""
        return self._pending_confirmation is not None
    
    def get_pending_confirmation(self) -> Optional[ClientEvent]:
        """Get the pending confirmation event."""
        return self._pending_confirmation
    
    def clear_pending_confirmation(self):
        """Clear the pending confirmation."""
        self._pending_confirmation = None

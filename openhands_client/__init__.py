"""OpenHands Client - Custom chat interface and dashboard for OpenHands."""

from openhands_client.client import OpenHandsClient
from openhands_client.conversation_manager import ConversationManager
from openhands_client.event_handler import EventHandler
from openhands_client.config import ClientConfig

__version__ = "0.1.0"
__all__ = ["OpenHandsClient", "ConversationManager", "EventHandler", "ClientConfig"]

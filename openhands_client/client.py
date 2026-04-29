"""Main OpenHands client that wraps the SDK."""

import asyncio
import os
from typing import Optional, Callable, Any
from pydantic import SecretStr

from openhands_client.config import ClientConfig, WorkspaceType, SecurityPolicy
from openhands_client.conversation_manager import ConversationManager
from openhands_client.event_handler import EventHandler, EventType, ClientEvent


class OpenHandsClient:
    """
    Main client for interacting with OpenHands.
    Wraps the OpenHands SDK to provide a higher-level interface for chat UIs and dashboards.
    """
    
    def __init__(self, config: Optional[ClientConfig] = None):
        self.config = config or ClientConfig.from_env()
        self.conversation_manager = ConversationManager(self.config.persistence_dir)
        
        self._sdk_llm = None
        self._sdk_agent = None
        self._sdk_conversations: dict[str, Any] = {}  # conversation_id -> SDK Conversation
        self._initialized = False
        
    async def initialize(self):
        """Initialize the SDK components."""
        if self._initialized:
            return
        
        try:
            # Import SDK components
            from openhands.sdk import LLM, Agent, Tool
            from openhands.tools.preset.default import get_default_tools
            
            # Initialize LLM
            api_key = self.config.llm.api_key.get_secret_value() if self.config.llm.api_key else None
            self._sdk_llm = LLM(
                model=self.config.llm.model,
                api_key=api_key,
                base_url=self.config.llm.base_url,
            )
            
            # Get default tools
            tools = get_default_tools(enable_browser=self.config.enable_browser_tools)
            
            # Initialize agent
            self._sdk_agent = Agent(
                llm=self._sdk_llm,
                tools=tools,
            )
            
            self._initialized = True
            
        except ImportError as e:
            raise RuntimeError(
                f"Failed to import OpenHands SDK: {e}. "
                "Please install with: pip install openhands-sdk openhands-tools"
            )
    
    def _get_workspace(self, conversation_id: str):
        """Create workspace based on configuration."""
        workspace_type = self.config.workspace.workspace_type
        
        if workspace_type == WorkspaceType.LOCAL:
            return self.config.workspace.working_dir
        
        elif workspace_type == WorkspaceType.DOCKER:
            from openhands.workspace import DockerWorkspace
            return DockerWorkspace()
        
        elif workspace_type == WorkspaceType.REMOTE:
            from openhands.sdk.workspace import RemoteWorkspace
            api_key = self.config.workspace.api_key.get_secret_value() if self.config.workspace.api_key else None
            return RemoteWorkspace(
                host=self.config.workspace.host,
                working_dir=self.config.workspace.working_dir,
                api_key=api_key,
            )
        
        elif workspace_type == WorkspaceType.API_REMOTE:
            from openhands.workspace import APIRemoteWorkspace
            api_key = self.config.workspace.runtime_api_key.get_secret_value() if self.config.workspace.runtime_api_key else None
            return APIRemoteWorkspace(
                runtime_api_url=self.config.workspace.runtime_api_url,
                runtime_api_key=api_key,
                server_image=self.config.workspace.server_image,
            )
        
        elif workspace_type == WorkspaceType.CLOUD:
            from openhands.workspace import OpenHandsCloudWorkspace
            api_key = self.config.workspace.cloud_api_key.get_secret_value() if self.config.workspace.cloud_api_key else None
            return OpenHandsCloudWorkspace(
                cloud_api_url=self.config.workspace.cloud_api_url,
                cloud_api_key=api_key,
            )
        
        return self.config.workspace.working_dir
    
    def _get_security_policy(self):
        """Get security policy based on configuration."""
        from openhands.sdk.security.confirmation_policy import (
            AlwaysConfirm, NeverConfirm, ConfirmRisky
        )
        
        policy = self.config.security_policy
        
        if policy == SecurityPolicy.ALWAYS_CONFIRM:
            return AlwaysConfirm()
        elif policy == SecurityPolicy.NEVER_CONFIRM:
            return NeverConfirm()
        else:
            return ConfirmRisky()
    
    async def create_conversation(self, title: Optional[str] = None) -> str:
        """Create a new conversation."""
        await self.initialize()
        
        workspace_type = self.config.workspace.workspace_type
        ws_type_str = workspace_type.value if isinstance(workspace_type, WorkspaceType) else workspace_type
        conversation_id = self.conversation_manager.create_conversation(
            title=title,
            workspace_type=ws_type_str,
        )
        
        return conversation_id
    
    async def start_conversation(self, conversation_id: str) -> bool:
        """Start/initialize an SDK conversation."""
        await self.initialize()
        
        if conversation_id in self._sdk_conversations:
            return True
        
        try:
            from openhands.sdk import Conversation
            from openhands.sdk.settings import CondenserSettings
            
            # Get event handler for this conversation
            event_handler = self.conversation_manager.get_event_handler(conversation_id)
            
            # Create workspace
            workspace = self._get_workspace(conversation_id)
            
            # Create SDK conversation. Remote/cloud workspaces persist state on
            # the remote agent server, and the SDK rejects a local persistence dir.
            conv_dir = self.conversation_manager.persistence_dir / conversation_id
            conversation_kwargs = {
                "agent": self._sdk_agent,
                "workspace": workspace,
                "conversation_id": conversation_id,
                "callbacks": [event_handler.process_sdk_event],
            }
            if not self._is_remote_workspace(workspace):
                conversation_kwargs["persistence_dir"] = str(conv_dir)

            sdk_conversation = Conversation(**conversation_kwargs)
            
            # Set security policy
            policy = self._get_security_policy()
            sdk_conversation.set_confirmation_policy(policy)
            
            self._sdk_conversations[conversation_id] = sdk_conversation
            self.conversation_manager.set_status(conversation_id, "active")
            
            return True
            
        except Exception as e:
            event_handler = self.conversation_manager.get_event_handler(conversation_id)
            if event_handler:
                event_handler.create_error_event(str(e))
            self.conversation_manager.set_status(conversation_id, "error")
            return False

    @staticmethod
    def _is_remote_workspace(workspace: Any) -> bool:
        """Return whether the SDK workspace is backed by a remote agent server."""
        try:
            from openhands.sdk.workspace import RemoteWorkspace
        except ImportError:
            return False

        return isinstance(workspace, RemoteWorkspace)
    
    async def send_message(
        self,
        conversation_id: str,
        message: str,
        stream_callback: Optional[Callable[[ClientEvent], None]] = None
    ) -> list[ClientEvent]:
        """
        Send a message to a conversation and run the agent.
        Returns the list of events generated during the run.
        """
        await self.initialize()
        
        # Ensure conversation is started
        if conversation_id not in self._sdk_conversations:
            if not await self.start_conversation(conversation_id):
                raise RuntimeError(f"Failed to start conversation {conversation_id}")
        
        sdk_conversation = self._sdk_conversations[conversation_id]
        event_handler = self.conversation_manager.get_event_handler(conversation_id)
        
        # Record user message
        self.conversation_manager.record_message(conversation_id, "user")
        user_event = event_handler.create_message_event(message, source="user")
        
        # Add stream callback if provided
        if stream_callback:
            event_handler.add_callback(stream_callback)
        
        events_before = len(event_handler.get_history())
        
        try:
            # Send message and run
            sdk_conversation.send_message(message)
            sdk_conversation.run()
            
            # Update stats from SDK metrics
            if hasattr(sdk_conversation, "conversation_stats"):
                try:
                    metrics = sdk_conversation.conversation_stats.get_combined_metrics()
                    self.conversation_manager.update_stats(conversation_id, {
                        "accumulated_cost": getattr(metrics, "accumulated_cost", 0),
                        "total_tokens": getattr(metrics, "total_tokens", 0),
                        "input_tokens": getattr(metrics, "input_tokens", 0),
                        "output_tokens": getattr(metrics, "output_tokens", 0),
                    })
                except Exception:
                    pass
            
            # Get events generated during this run
            all_events = event_handler.get_history()
            new_events = all_events[events_before:]
            
            # Record assistant messages
            for event in new_events:
                if event.get("source") in ("assistant", "agent"):
                    self.conversation_manager.record_message(conversation_id, "assistant")
                if event.get("type") == "action":
                    self.conversation_manager.record_tool_call(conversation_id)
            
            # Save events
            self.conversation_manager.save_events(conversation_id)
            
            return new_events
            
        except Exception as e:
            self.conversation_manager.record_error(conversation_id)
            event_handler.create_error_event(str(e))
            raise
        
        finally:
            if stream_callback:
                event_handler.remove_callback(stream_callback)
    
    async def confirm_action(self, conversation_id: str, approved: bool) -> bool:
        """Confirm or reject a pending action."""
        if conversation_id not in self._sdk_conversations:
            return False
        
        sdk_conversation = self._sdk_conversations[conversation_id]
        event_handler = self.conversation_manager.get_event_handler(conversation_id)
        
        if not event_handler.has_pending_confirmation:
            return False
        
        try:
            if hasattr(sdk_conversation, "confirm_action"):
                sdk_conversation.confirm_action(approved)
            event_handler.clear_pending_confirmation()
            return True
        except Exception:
            return False
    
    async def pause_conversation(self, conversation_id: str) -> bool:
        """Pause a running conversation."""
        if conversation_id not in self._sdk_conversations:
            return False
        
        sdk_conversation = self._sdk_conversations[conversation_id]
        
        try:
            if hasattr(sdk_conversation, "pause"):
                sdk_conversation.pause()
            self.conversation_manager.set_status(conversation_id, "paused")
            self.conversation_manager.save_events(conversation_id)
            return True
        except Exception:
            return False
    
    async def resume_conversation(self, conversation_id: str) -> bool:
        """Resume a paused conversation."""
        try:
            if conversation_id in self._sdk_conversations:
                sdk_conversation = self._sdk_conversations[conversation_id]
                if hasattr(sdk_conversation, "resume"):
                    sdk_conversation.resume()
            else:
                await self.start_conversation(conversation_id)
            
            self.conversation_manager.set_status(conversation_id, "active")
            return True
        except Exception:
            return False
    
    async def stop_conversation(self, conversation_id: str) -> bool:
        """Stop a conversation."""
        if conversation_id in self._sdk_conversations:
            sdk_conversation = self._sdk_conversations[conversation_id]
            
            try:
                if hasattr(sdk_conversation, "stop"):
                    sdk_conversation.stop()
            except Exception:
                pass
            
            del self._sdk_conversations[conversation_id]
        
        self.conversation_manager.set_status(conversation_id, "completed")
        self.conversation_manager.save_events(conversation_id)
        return True
    
    def get_conversation_history(self, conversation_id: str) -> list[dict]:
        """Get the event history for a conversation."""
        event_handler = self.conversation_manager.get_event_handler(conversation_id)
        if event_handler:
            return event_handler.get_history()
        return self.conversation_manager.load_events(conversation_id)
    
    def get_conversation_stats(self, conversation_id: str) -> Optional[dict]:
        """Get statistics for a conversation."""
        stats = self.conversation_manager.get_stats(conversation_id)
        return stats.to_dict() if stats else None
    
    def list_conversations(self, limit: int = 50, offset: int = 0) -> list[dict]:
        """List all conversations."""
        return self.conversation_manager.list_conversations(limit=limit, offset=offset)
    
    def delete_conversation(self, conversation_id: str) -> bool:
        """Delete a conversation."""
        if conversation_id in self._sdk_conversations:
            del self._sdk_conversations[conversation_id]
        return self.conversation_manager.delete_conversation(conversation_id)
    
    def get_global_stats(self) -> dict:
        """Get global statistics."""
        return self.conversation_manager.get_global_stats()
    
    def get_config(self) -> dict:
        """Get current configuration."""
        return self.config.to_dict()
    
    async def close(self):
        """Clean up resources."""
        for conv_id in list(self._sdk_conversations.keys()):
            await self.stop_conversation(conv_id)
        
        self._sdk_llm = None
        self._sdk_agent = None
        self._initialized = False

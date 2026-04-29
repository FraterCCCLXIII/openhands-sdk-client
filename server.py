"""FastAPI server for OpenHands client dashboard and chat interface."""

import asyncio
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from openhands_client import OpenHandsClient, ClientConfig
from openhands_client.config import SecurityPolicy, WorkspaceType
from openhands_client.event_handler import ClientEvent

load_dotenv()


# Request/Response models
class CreateConversationRequest(BaseModel):
    title: Optional[str] = None


class SendMessageRequest(BaseModel):
    message: str


class UpdateTitleRequest(BaseModel):
    title: str


class ConfirmActionRequest(BaseModel):
    approved: bool


class ConfigUpdateRequest(BaseModel):
    llm_model: Optional[str] = None
    llm_api_key: Optional[str] = None
    llm_base_url: Optional[str] = None
    workspace_type: Optional[str] = None
    workspace_dir: Optional[str] = None
    remote_host: Optional[str] = None
    remote_api_key: Optional[str] = None
    runtime_api_url: Optional[str] = None
    runtime_api_key: Optional[str] = None
    openhands_cloud_url: Optional[str] = None
    openhands_cloud_api_key: Optional[str] = None
    security_policy: Optional[str] = None
    enable_browser_tools: Optional[bool] = None
    enable_metrics: Optional[bool] = None
    max_context_size: Optional[int] = None


# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, conversation_id: str):
        await websocket.accept()
        if conversation_id not in self.active_connections:
            self.active_connections[conversation_id] = []
        self.active_connections[conversation_id].append(websocket)
    
    def disconnect(self, websocket: WebSocket, conversation_id: str):
        if conversation_id in self.active_connections:
            if websocket in self.active_connections[conversation_id]:
                self.active_connections[conversation_id].remove(websocket)
            if not self.active_connections[conversation_id]:
                del self.active_connections[conversation_id]
    
    async def broadcast(self, conversation_id: str, message: dict):
        if conversation_id in self.active_connections:
            dead_connections = []
            for connection in self.active_connections[conversation_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    dead_connections.append(connection)
            for conn in dead_connections:
                self.disconnect(conn, conversation_id)


# Global instances
client: Optional[OpenHandsClient] = None
manager = ConnectionManager()
CONFIG_PATH = Path(".openhands-client/config.json")
FRONTEND_DIST = Path("frontend/dist")
FRONTEND_INDEX = FRONTEND_DIST / "index.html"


def load_runtime_config() -> ClientConfig:
    return ClientConfig.from_runtime_file(CONFIG_PATH)


def save_runtime_config(config: ClientConfig) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_PATH, "w") as f:
        json.dump(config.to_runtime_dict(), f, indent=2)
    os.chmod(CONFIG_PATH, 0o600)


def apply_config_update(config: ClientConfig, update: ConfigUpdateRequest) -> ClientConfig:
    if update.llm_model is not None:
        config.llm.model = update.llm_model
    if update.llm_api_key:
        from pydantic import SecretStr
        config.llm.api_key = SecretStr(update.llm_api_key)
    if update.llm_base_url is not None:
        config.llm.base_url = update.llm_base_url or None

    if update.workspace_type is not None:
        config.workspace.workspace_type = WorkspaceType(update.workspace_type)
    if update.workspace_dir is not None:
        config.workspace.working_dir = update.workspace_dir
    if update.remote_host is not None:
        config.workspace.host = update.remote_host or None
    if update.remote_api_key:
        from pydantic import SecretStr
        config.workspace.api_key = SecretStr(update.remote_api_key)
    if update.runtime_api_url is not None:
        config.workspace.runtime_api_url = update.runtime_api_url or None
    if update.runtime_api_key:
        from pydantic import SecretStr
        config.workspace.runtime_api_key = SecretStr(update.runtime_api_key)
    if update.openhands_cloud_url is not None:
        config.workspace.cloud_api_url = update.openhands_cloud_url or None
    if update.openhands_cloud_api_key:
        from pydantic import SecretStr
        config.workspace.cloud_api_key = SecretStr(update.openhands_cloud_api_key)

    if update.security_policy is not None:
        config.security_policy = SecurityPolicy(update.security_policy)
    if update.enable_browser_tools is not None:
        config.enable_browser_tools = update.enable_browser_tools
    if update.enable_metrics is not None:
        config.enable_metrics = update.enable_metrics
    if update.max_context_size is not None:
        config.max_context_size = update.max_context_size

    return config


async def replace_client(config: ClientConfig) -> None:
    global client
    old_client = client
    client = OpenHandsClient(config)
    if old_client:
        await old_client.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown."""
    global client
    config = load_runtime_config()
    client = OpenHandsClient(config)
    yield
    if client:
        await client.close()


app = FastAPI(
    title="OpenHands Client Dashboard",
    description="Custom chat interface and dashboard for OpenHands",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files. React assets are primary; legacy static remains for fallback
# templates when the React build has not been generated yet.
if (FRONTEND_DIST / "assets").exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


# ==================== HTML Pages ====================

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """Main dashboard page."""
    if FRONTEND_INDEX.exists():
        return FileResponse(FRONTEND_INDEX)
    return templates.TemplateResponse(request, "index.html")


@app.get("/chat/{conversation_id}", response_class=HTMLResponse)
async def chat_page(request: Request, conversation_id: str):
    """Chat interface for a specific conversation."""
    if FRONTEND_INDEX.exists():
        return FileResponse(FRONTEND_INDEX)
    return templates.TemplateResponse(request, "chat.html", {
        "conversation_id": conversation_id,
    })


# ==================== REST API ====================

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "initialized": client is not None and client._initialized}


@app.get("/api/config")
async def get_config():
    """Get current configuration."""
    if not client:
        raise HTTPException(status_code=503, detail="Client not initialized")
    return client.get_config()


@app.post("/api/config")
async def update_config(config_update: ConfigUpdateRequest):
    """Update persisted runtime configuration and reset future SDK clients."""
    if not client:
        raise HTTPException(status_code=503, detail="Client not initialized")

    try:
        new_config = apply_config_update(client.config.model_copy(deep=True), config_update)
        save_runtime_config(new_config)
        await replace_client(new_config)
        return {
            "status": "ok",
            "message": "Configuration saved. Existing running conversations were stopped so new settings can apply.",
            "config": new_config.to_dict(),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/stats")
async def get_global_stats():
    """Get global statistics."""
    if not client:
        raise HTTPException(status_code=503, detail="Client not initialized")
    return client.get_global_stats()


# ==================== Conversation API ====================

@app.get("/api/conversations")
async def list_conversations(limit: int = 50, offset: int = 0):
    """List all conversations."""
    if not client:
        raise HTTPException(status_code=503, detail="Client not initialized")
    conversations = client.list_conversations(limit=limit, offset=offset)
    return {"conversations": conversations, "total": len(conversations)}


@app.post("/api/conversations")
async def create_conversation(request: CreateConversationRequest):
    """Create a new conversation."""
    if not client:
        raise HTTPException(status_code=503, detail="Client not initialized")
    conversation_id = await client.create_conversation(title=request.title)
    return {"conversation_id": conversation_id}


@app.get("/api/conversations/{conversation_id}")
async def get_conversation(conversation_id: str):
    """Get conversation details."""
    if not client:
        raise HTTPException(status_code=503, detail="Client not initialized")
    conv = client.conversation_manager.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv.to_dict()


@app.delete("/api/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    """Delete a conversation."""
    if not client:
        raise HTTPException(status_code=503, detail="Client not initialized")
    success = client.delete_conversation(conversation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"status": "deleted"}


@app.patch("/api/conversations/{conversation_id}/title")
async def update_conversation_title(conversation_id: str, request: UpdateTitleRequest):
    """Update conversation title."""
    if not client:
        raise HTTPException(status_code=503, detail="Client not initialized")
    success = client.conversation_manager.update_conversation_title(
        conversation_id, request.title
    )
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"status": "updated"}


@app.get("/api/conversations/{conversation_id}/history")
async def get_conversation_history(conversation_id: str):
    """Get conversation event history."""
    if not client:
        raise HTTPException(status_code=503, detail="Client not initialized")
    history = client.get_conversation_history(conversation_id)
    return {"events": history}


@app.get("/api/conversations/{conversation_id}/stats")
async def get_conversation_stats(conversation_id: str):
    """Get conversation statistics."""
    if not client:
        raise HTTPException(status_code=503, detail="Client not initialized")
    stats = client.get_conversation_stats(conversation_id)
    if not stats:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return stats


@app.post("/api/conversations/{conversation_id}/start")
async def start_conversation(conversation_id: str):
    """Start/initialize a conversation."""
    if not client:
        raise HTTPException(status_code=503, detail="Client not initialized")
    success = await client.start_conversation(conversation_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to start conversation")
    return {"status": "started"}


@app.post("/api/conversations/{conversation_id}/pause")
async def pause_conversation(conversation_id: str):
    """Pause a conversation."""
    if not client:
        raise HTTPException(status_code=503, detail="Client not initialized")
    success = await client.pause_conversation(conversation_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to pause conversation")
    return {"status": "paused"}


@app.post("/api/conversations/{conversation_id}/resume")
async def resume_conversation(conversation_id: str):
    """Resume a paused conversation."""
    if not client:
        raise HTTPException(status_code=503, detail="Client not initialized")
    success = await client.resume_conversation(conversation_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to resume conversation")
    return {"status": "resumed"}


@app.post("/api/conversations/{conversation_id}/stop")
async def stop_conversation(conversation_id: str):
    """Stop a conversation."""
    if not client:
        raise HTTPException(status_code=503, detail="Client not initialized")
    success = await client.stop_conversation(conversation_id)
    return {"status": "stopped"}


@app.post("/api/conversations/{conversation_id}/confirm")
async def confirm_action(conversation_id: str, request: ConfirmActionRequest):
    """Confirm or reject a pending action."""
    if not client:
        raise HTTPException(status_code=503, detail="Client not initialized")
    success = await client.confirm_action(conversation_id, request.approved)
    if not success:
        raise HTTPException(status_code=400, detail="No pending confirmation")
    return {"status": "confirmed" if request.approved else "rejected"}


@app.post("/api/conversations/{conversation_id}/message")
async def send_message(conversation_id: str, request: SendMessageRequest):
    """Send a message to a conversation (non-streaming)."""
    if not client:
        raise HTTPException(status_code=503, detail="Client not initialized")
    
    try:
        events = await client.send_message(
            conversation_id,
            request.message,
            stream_callback=lambda e: asyncio.create_task(
                manager.broadcast(conversation_id, {
                    "type": "event",
                    "event": e.to_dict(),
                })
            ) if isinstance(e, ClientEvent) else None
        )
        
        return {"events": events}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== WebSocket ====================

@app.websocket("/ws/{conversation_id}")
async def websocket_endpoint(websocket: WebSocket, conversation_id: str):
    """WebSocket endpoint for real-time conversation updates."""
    await manager.connect(websocket, conversation_id)
    
    try:
        # Send conversation history on connect
        if client:
            history = client.get_conversation_history(conversation_id)
            await websocket.send_json({
                "type": "history",
                "events": history,
            })
        
        while True:
            # Receive messages from the client
            data = await websocket.receive_json()
            
            if data.get("type") == "message" and client:
                message = data.get("content", "")
                
                # Send acknowledgment
                await websocket.send_json({
                    "type": "ack",
                    "message": "Processing...",
                })
                
                # Define callback for streaming events. EventHandler callbacks are
                # synchronous, so schedule the async broadcast on the running loop.
                def event_callback(event):
                    if isinstance(event, ClientEvent):
                        asyncio.create_task(manager.broadcast(conversation_id, {
                            "type": "event",
                            "event": event.to_dict(),
                        }))
                
                try:
                    # Process the message
                    events = await client.send_message(
                        conversation_id,
                        message,
                        stream_callback=event_callback,
                    )
                    
                    # Send completion
                    await websocket.send_json({
                        "type": "complete",
                        "events": events,
                    })
                    
                except Exception as e:
                    await websocket.send_json({
                        "type": "error",
                        "error": str(e),
                    })
            
            elif data.get("type") == "confirm" and client:
                approved = data.get("approved", False)
                await client.confirm_action(conversation_id, approved)
                await websocket.send_json({
                    "type": "confirmed",
                    "approved": approved,
                })
            
            elif data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, conversation_id)
    except Exception as e:
        manager.disconnect(websocket, conversation_id)
        print(f"WebSocket error: {e}")


@app.get("/{full_path:path}", response_class=HTMLResponse)
async def spa_fallback(full_path: str):
    """Serve the React app for client-side routes in web and Electron shells."""
    if FRONTEND_INDEX.exists():
        return FileResponse(FRONTEND_INDEX)
    raise HTTPException(status_code=404, detail="Not found")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "12000"))
    uvicorn.run(app, host="0.0.0.0", port=port)

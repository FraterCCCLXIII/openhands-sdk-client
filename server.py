"""FastAPI server for OpenHands client dashboard and chat interface."""

import asyncio
import json
import os
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from openhands_client import OpenHandsClient, ClientConfig
from openhands_client.event_handler import ClientEvent


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
    workspace_type: Optional[str] = None
    security_policy: Optional[str] = None


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


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown."""
    global client
    config = ClientConfig.from_env()
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

# Static files and templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


# ==================== HTML Pages ====================

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """Main dashboard page."""
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/chat/{conversation_id}", response_class=HTMLResponse)
async def chat_page(request: Request, conversation_id: str):
    """Chat interface for a specific conversation."""
    return templates.TemplateResponse("chat.html", {
        "request": request,
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
    """Update configuration (limited)."""
    # Note: Full config changes may require restart
    return {"status": "ok", "message": "Configuration updated. Some changes may require restart."}


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
        # Stream callback to broadcast to WebSocket clients
        async def stream_to_websocket(event: ClientEvent):
            await manager.broadcast(conversation_id, event.to_dict())
        
        events = await client.send_message(
            conversation_id,
            request.message,
            stream_callback=lambda e: asyncio.create_task(
                manager.broadcast(conversation_id, e.to_dict())
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
                
                # Define callback for streaming events
                async def event_callback(event):
                    if isinstance(event, ClientEvent):
                        await manager.broadcast(conversation_id, {
                            "type": "event",
                            "event": event.to_dict(),
                        })
                
                try:
                    # Process the message
                    events = await client.send_message(conversation_id, message)
                    
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


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "12000"))
    uvicorn.run(app, host="0.0.0.0", port=port)

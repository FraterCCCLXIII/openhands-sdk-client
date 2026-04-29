"""
Standalone FastAPI server for OpenHands Client Dashboard.
This version works without the full OpenHands SDK installed,
using mock implementations for demonstration purposes.
"""

import asyncio
import json
import os
import uuid
from datetime import datetime
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()


# ==================== Mock Client Implementation ====================

class MockConversation:
    """Mock conversation for demonstration."""
    def __init__(self, id: str, title: str):
        self.id = id
        self.title = title
        self.created_at = datetime.utcnow().isoformat() + "Z"
        self.updated_at = self.created_at
        self.message_count = 0
        self.total_cost = 0.0
        self.status = "active"
        self.events = []
        self.stats = {
            "total_messages": 0,
            "user_messages": 0,
            "assistant_messages": 0,
            "tool_calls": 0,
            "total_tokens": 0,
            "accumulated_cost": 0.0,
        }
    
    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "message_count": self.message_count,
            "total_cost": self.total_cost,
            "status": self.status,
            "workspace_type": "local",
        }


class MockOpenHandsClient:
    """Mock client for demonstration without SDK."""
    
    def __init__(self):
        self.conversations: dict[str, MockConversation] = {}
        self._initialized = True
        self.config = {
            "llm": {
                "model": os.getenv("LLM_MODEL", "anthropic/claude-sonnet-4-5-20250929"),
                "base_url": os.getenv("LLM_BASE_URL"),
                "has_api_key": bool(os.getenv("LLM_API_KEY")),
            },
            "workspace": {
                "type": os.getenv("WORKSPACE_TYPE", "local"),
                "working_dir": os.getenv("WORKSPACE_DIR", "/workspace"),
            },
            "security_policy": os.getenv("SECURITY_POLICY", "confirm_risky"),
            "persistence_dir": "./conversations",
            "enable_browser_tools": os.getenv("ENABLE_BROWSER", "false").lower() == "true",
            "enable_metrics": True,
            "max_context_size": 50,
        }
    
    async def create_conversation(self, title: Optional[str] = None) -> str:
        conv_id = str(uuid.uuid4())
        conv = MockConversation(
            id=conv_id,
            title=title or f"Conversation {len(self.conversations) + 1}"
        )
        self.conversations[conv_id] = conv
        return conv_id
    
    def get_conversation(self, conv_id: str) -> Optional[MockConversation]:
        return self.conversations.get(conv_id)
    
    def list_conversations(self, limit: int = 50, offset: int = 0) -> list[dict]:
        convs = sorted(
            self.conversations.values(),
            key=lambda c: c.updated_at,
            reverse=True
        )
        return [c.to_dict() for c in convs[offset:offset + limit]]
    
    def delete_conversation(self, conv_id: str) -> bool:
        if conv_id in self.conversations:
            del self.conversations[conv_id]
            return True
        return False
    
    def get_global_stats(self) -> dict:
        total_messages = sum(c.message_count for c in self.conversations.values())
        total_cost = sum(c.total_cost for c in self.conversations.values())
        active = sum(1 for c in self.conversations.values() if c.status == "active")
        
        return {
            "total_conversations": len(self.conversations),
            "active_conversations": active,
            "total_messages": total_messages,
            "total_cost": total_cost,
            "total_tool_calls": 0,
            "total_errors": 0,
        }
    
    async def send_message(self, conv_id: str, message: str) -> list[dict]:
        """Generate mock response events."""
        conv = self.conversations.get(conv_id)
        if not conv:
            return []
        
        now = datetime.utcnow().isoformat() + "Z"
        events = []
        
        # Record user message
        conv.message_count += 1
        conv.stats["total_messages"] += 1
        conv.stats["user_messages"] += 1
        conv.updated_at = now
        
        # Generate mock assistant response
        response_text = self._generate_mock_response(message)
        
        events.append({
            "id": f"evt_{len(conv.events) + 1:06d}",
            "type": "message",
            "timestamp": now,
            "source": "assistant",
            "content": {"text": response_text, "role": "assistant"},
        })
        
        conv.events.extend(events)
        conv.message_count += 1
        conv.stats["total_messages"] += 1
        conv.stats["assistant_messages"] += 1
        conv.stats["total_tokens"] += len(message.split()) + len(response_text.split())
        conv.stats["accumulated_cost"] += 0.001
        conv.total_cost = conv.stats["accumulated_cost"]
        
        return events
    
    def _generate_mock_response(self, message: str) -> str:
        """Generate a mock response based on the message."""
        message_lower = message.lower()
        
        if "hello" in message_lower or "hi" in message_lower:
            return "Hello! I'm a mock OpenHands agent. This is a demonstration of the client interface. In a real deployment, I would be powered by the OpenHands SDK and could execute code, edit files, and perform various tasks."
        
        elif "help" in message_lower:
            return """I can help you with various tasks! Here's what a real OpenHands agent can do:

1. **Execute terminal commands** - Run bash commands in a sandbox
2. **Edit files** - Create and modify code files
3. **Browse the web** - Navigate websites and extract information
4. **Search code** - Find patterns in your codebase
5. **Manage tasks** - Track and organize work items

This is a demo interface - connect the OpenHands SDK to enable full functionality!"""
        
        elif "code" in message_lower or "write" in message_lower:
            return """I would typically help you write code! For example:

```python
def hello_world():
    print("Hello from OpenHands!")
    
if __name__ == "__main__":
    hello_world()
```

In a real deployment, I can create files, run tests, and iterate on solutions."""
        
        else:
            return f"""I received your message: "{message}"

This is a demonstration response from the mock client. To get real AI-powered responses:

1. Set your `LLM_API_KEY` environment variable
2. Ensure the OpenHands SDK is properly installed
3. The client will then use the real agent for responses

The UI you're seeing demonstrates:
- Real-time messaging via WebSocket
- Conversation management
- Event streaming and visualization"""


# ==================== Request/Response Models ====================

class CreateConversationRequest(BaseModel):
    title: Optional[str] = None

class SendMessageRequest(BaseModel):
    message: str

class UpdateTitleRequest(BaseModel):
    title: str

class ConfirmActionRequest(BaseModel):
    approved: bool


# ==================== WebSocket Manager ====================

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


# ==================== App Setup ====================

client: Optional[MockOpenHandsClient] = None
manager = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global client
    client = MockOpenHandsClient()
    yield


app = FastAPI(
    title="OpenHands Client Dashboard",
    description="Custom chat interface and dashboard for OpenHands",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Check if React frontend build exists
from pathlib import Path
frontend_dist = Path(__file__).parent / "frontend" / "dist"
use_react = frontend_dist.exists()

if use_react:
    # Serve React build assets
    app.mount("/assets", StaticFiles(directory=frontend_dist / "assets"), name="assets")
else:
    # Fallback to old static files
    if Path("static").exists():
        app.mount("/static", StaticFiles(directory="static"), name="static")
    templates = Jinja2Templates(directory="templates")


# ==================== HTML Routes ====================

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    if use_react:
        return HTMLResponse(content=(frontend_dist / "index.html").read_text())
    return templates.TemplateResponse(request, "index.html")


@app.get("/chat/{conversation_id}", response_class=HTMLResponse)
async def chat_page(request: Request, conversation_id: str):
    if use_react:
        return HTMLResponse(content=(frontend_dist / "index.html").read_text())
    return templates.TemplateResponse(request, "chat.html", {
        "conversation_id": conversation_id,
    })


# ==================== API Routes ====================

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "initialized": client is not None, "mode": "standalone"}


@app.get("/api/config")
async def get_config():
    return client.config if client else {}


@app.get("/api/stats")
async def get_global_stats():
    return client.get_global_stats() if client else {}


@app.get("/api/conversations")
async def list_conversations(limit: int = 50, offset: int = 0):
    conversations = client.list_conversations(limit=limit, offset=offset) if client else []
    return {"conversations": conversations, "total": len(conversations)}


@app.post("/api/conversations")
async def create_conversation(request: CreateConversationRequest):
    if not client:
        raise HTTPException(status_code=503, detail="Client not initialized")
    conversation_id = await client.create_conversation(title=request.title)
    return {"conversation_id": conversation_id}


@app.get("/api/conversations/{conversation_id}")
async def get_conversation(conversation_id: str):
    if not client:
        raise HTTPException(status_code=503, detail="Client not initialized")
    conv = client.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv.to_dict()


@app.delete("/api/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    if not client:
        raise HTTPException(status_code=503, detail="Client not initialized")
    success = client.delete_conversation(conversation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"status": "deleted"}


@app.patch("/api/conversations/{conversation_id}/title")
async def update_conversation_title(conversation_id: str, request: UpdateTitleRequest):
    if not client:
        raise HTTPException(status_code=503, detail="Client not initialized")
    conv = client.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conv.title = request.title
    conv.updated_at = datetime.utcnow().isoformat() + "Z"
    return {"status": "updated"}


@app.get("/api/conversations/{conversation_id}/history")
async def get_conversation_history(conversation_id: str):
    if not client:
        raise HTTPException(status_code=503, detail="Client not initialized")
    conv = client.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"events": conv.events}


@app.get("/api/conversations/{conversation_id}/stats")
async def get_conversation_stats(conversation_id: str):
    if not client:
        raise HTTPException(status_code=503, detail="Client not initialized")
    conv = client.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv.stats


@app.post("/api/conversations/{conversation_id}/start")
async def start_conversation(conversation_id: str):
    return {"status": "started"}


@app.post("/api/conversations/{conversation_id}/pause")
async def pause_conversation(conversation_id: str):
    if client:
        conv = client.get_conversation(conversation_id)
        if conv:
            conv.status = "paused"
    return {"status": "paused"}


@app.post("/api/conversations/{conversation_id}/resume")
async def resume_conversation(conversation_id: str):
    if client:
        conv = client.get_conversation(conversation_id)
        if conv:
            conv.status = "active"
    return {"status": "resumed"}


@app.post("/api/conversations/{conversation_id}/stop")
async def stop_conversation(conversation_id: str):
    if client:
        conv = client.get_conversation(conversation_id)
        if conv:
            conv.status = "completed"
    return {"status": "stopped"}


@app.post("/api/conversations/{conversation_id}/confirm")
async def confirm_action(conversation_id: str, request: ConfirmActionRequest):
    return {"status": "confirmed" if request.approved else "rejected"}


@app.post("/api/conversations/{conversation_id}/message")
async def send_message(conversation_id: str, request: SendMessageRequest):
    if not client:
        raise HTTPException(status_code=503, detail="Client not initialized")
    
    events = await client.send_message(conversation_id, request.message)
    
    # Broadcast events to WebSocket clients
    for event in events:
        await manager.broadcast(conversation_id, {"type": "event", "event": event})
    
    return {"events": events}


# ==================== WebSocket ====================

@app.websocket("/ws/{conversation_id}")
async def websocket_endpoint(websocket: WebSocket, conversation_id: str):
    await manager.connect(websocket, conversation_id)
    
    try:
        # Send history on connect
        if client:
            conv = client.get_conversation(conversation_id)
            if conv:
                await websocket.send_json({
                    "type": "history",
                    "events": conv.events,
                })
        
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "message" and client:
                message = data.get("content", "")
                
                await websocket.send_json({
                    "type": "ack",
                    "message": "Processing...",
                })
                
                # Simulate processing delay
                await asyncio.sleep(0.5)
                
                events = await client.send_message(conversation_id, message)
                
                for event in events:
                    await manager.broadcast(conversation_id, {
                        "type": "event",
                        "event": event,
                    })
                
                await websocket.send_json({
                    "type": "complete",
                    "events": events,
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
    print(f"\n🚀 OpenHands Client Dashboard (Standalone Mode)")
    print(f"📍 Dashboard: http://localhost:{port}/")
    print(f"📖 API Docs: http://localhost:{port}/docs")
    print(f"\nNote: This is running in standalone/demo mode.")
    print(f"For full functionality, configure LLM_API_KEY and use server.py\n")
    uvicorn.run(app, host="0.0.0.0", port=port)

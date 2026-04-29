# OpenHands Client Dashboard

A custom chat interface and dashboard for interacting with OpenHands agents using the [OpenHands SDK](https://docs.openhands.dev/sdk).

## Features

- 🖥️ **Dashboard** - Overview of all conversations with statistics
- 💬 **Chat Interface** - Real-time messaging with WebSocket support
- 📊 **Metrics** - Track tokens, costs, and tool usage
- 🔒 **Security Policies** - Configurable action confirmation
- 💾 **Persistence** - Save and restore conversation state
- 🔌 **Multiple Workspaces** - Support for local, Docker, remote, and cloud workspaces

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    OpenHands Client                              │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (HTML/CSS/JS)                                         │
│  ├── Dashboard (index.html)                                      │
│  │   ├── Stats overview                                          │
│  │   ├── Configuration display                                   │
│  │   └── Conversation list                                       │
│  └── Chat Interface (chat.html)                                  │
│      ├── Message display                                         │
│      ├── Tool call visualization                                 │
│      └── Action confirmation                                     │
├─────────────────────────────────────────────────────────────────┤
│  Backend (FastAPI)                                               │
│  ├── REST API endpoints                                          │
│  │   ├── /api/conversations - CRUD operations                    │
│  │   ├── /api/stats - Global statistics                          │
│  │   └── /api/config - Configuration                             │
│  └── WebSocket endpoint                                          │
│      └── /ws/{conversation_id} - Real-time updates               │
├─────────────────────────────────────────────────────────────────┤
│  Client Library (openhands_client)                               │
│  ├── OpenHandsClient - Main SDK wrapper                          │
│  ├── ConversationManager - Multi-conversation support            │
│  ├── EventHandler - SDK event processing                         │
│  └── ClientConfig - Configuration management                     │
├─────────────────────────────────────────────────────────────────┤
│  OpenHands SDK                                                   │
│  ├── Agent - Reasoning/action loop                               │
│  ├── LLM - Language model interface                              │
│  ├── Conversation - State management                             │
│  ├── Tools - Terminal, FileEditor, etc.                          │
│  └── Workspace - Local, Docker, Remote, Cloud                    │
└─────────────────────────────────────────────────────────────────┘
```

## Installation

### Prerequisites

- Python 3.11+
- An LLM API key (Anthropic, OpenAI, or OpenHands Cloud)

### Install Dependencies

```bash
# Using pip
pip install -e .

# Or using uv
uv pip install -e .
```

### Configure Environment

```bash
# Copy example config
cp .env.example .env

# Edit with your settings
nano .env
```

Required settings:
- `LLM_API_KEY` - Your LLM provider API key
- `LLM_MODEL` - The model to use (default: `anthropic/claude-sonnet-4-5-20250929`)

## Usage

### Start the Server

```bash
# Using Python directly
python server.py

# Or using uvicorn for development
uvicorn server:app --reload --port 12000

# With environment variables
LLM_API_KEY=your-key python server.py
```

### Access the Dashboard

Open your browser to:
- **Dashboard**: http://localhost:12000/
- **Chat**: http://localhost:12000/chat/{conversation_id}

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/config` | GET | Get configuration |
| `/api/stats` | GET | Get global statistics |
| `/api/conversations` | GET | List conversations |
| `/api/conversations` | POST | Create conversation |
| `/api/conversations/{id}` | GET | Get conversation details |
| `/api/conversations/{id}` | DELETE | Delete conversation |
| `/api/conversations/{id}/history` | GET | Get event history |
| `/api/conversations/{id}/stats` | GET | Get conversation stats |
| `/api/conversations/{id}/message` | POST | Send message |
| `/api/conversations/{id}/start` | POST | Start/initialize |
| `/api/conversations/{id}/pause` | POST | Pause conversation |
| `/api/conversations/{id}/resume` | POST | Resume conversation |
| `/api/conversations/{id}/stop` | POST | Stop conversation |
| `/api/conversations/{id}/confirm` | POST | Confirm/reject action |
| `/ws/{id}` | WebSocket | Real-time updates |

## Configuration

### Workspace Types

| Type | Description | Use Case |
|------|-------------|----------|
| `local` | Direct filesystem access | Development |
| `docker` | Isolated Docker container | Testing |
| `remote` | Connect to agent server | Existing server |
| `api_remote` | Runtime API provisioned | Production |
| `cloud` | OpenHands Cloud sandbox | SaaS |

### Security Policies

| Policy | Description |
|--------|-------------|
| `always_confirm` | Require approval for all actions |
| `never_confirm` | Auto-execute all actions |
| `confirm_risky` | Only confirm risky actions |

## Project Structure

```
openhands-client/
├── openhands_client/          # Python client library
│   ├── __init__.py            # Package exports
│   ├── client.py              # Main OpenHands client
│   ├── config.py              # Configuration management
│   ├── conversation_manager.py # Multi-conversation support
│   └── event_handler.py       # SDK event processing
├── static/                    # Frontend assets
│   ├── css/
│   │   └── style.css          # Styles
│   └── js/
│       ├── api.js             # API client
│       ├── dashboard.js       # Dashboard logic
│       └── chat.js            # Chat interface
├── templates/                 # Jinja2 templates
│   ├── base.html              # Base template
│   ├── index.html             # Dashboard
│   └── chat.html              # Chat interface
├── conversations/             # Conversation persistence
├── server.py                  # FastAPI server
├── pyproject.toml             # Project config
├── .env.example               # Example config
└── README.md                  # This file
```

## Development

### Adding Custom Tools

```python
from openhands.sdk import Action, Observation, ToolDefinition
from openhands.sdk.tool import ToolExecutor, register_tool

class MyAction(Action):
    query: str

class MyObservation(Observation):
    result: str
    
    @property
    def to_llm_content(self):
        return [TextContent(text=self.result)]

class MyExecutor(ToolExecutor[MyAction, MyObservation]):
    def __call__(self, action, conversation=None):
        return MyObservation(result=f"Processed: {action.query}")

# Register the tool
register_tool("MyTool", MyTool)
```

### Customizing the Frontend

The frontend uses vanilla JavaScript and CSS for simplicity. Modify:
- `static/css/style.css` - Styles and theming
- `static/js/chat.js` - Chat behavior
- `templates/*.html` - Page structure

### Extending the API

Add new endpoints in `server.py`:

```python
@app.get("/api/custom")
async def custom_endpoint():
    return {"message": "Custom endpoint"}
```

## Troubleshooting

### SDK Not Found

```bash
pip install openhands-sdk openhands-tools openhands-workspace
```

### LLM API Errors

- Verify `LLM_API_KEY` is set correctly
- Check the model name format (e.g., `anthropic/claude-sonnet-4-5-20250929`)
- Ensure you have API credits/quota

### WebSocket Disconnects

- Check browser console for errors
- Verify the server is running
- Check firewall/proxy settings

## License

MIT License - See LICENSE file for details.

## Resources

- [OpenHands SDK Documentation](https://docs.openhands.dev/sdk)
- [OpenHands GitHub](https://github.com/OpenHands/software-agent-sdk)
- [SDK Examples](https://github.com/OpenHands/software-agent-sdk/tree/main/examples/01_standalone_sdk)

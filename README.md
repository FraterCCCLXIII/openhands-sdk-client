# OpenHands Client Dashboard

A lean chat interface and dashboard for interacting with OpenHands through a selectable backend adapter: the current SDK prototype, an already-running local OpenHands Main server, or OpenHands Cloud.

Built with **React + Vite + TypeScript + Tailwind CSS** for a modern, type-safe frontend.

## Features

- 🖥️ **Dashboard** - Overview of all conversations with statistics
- 💬 **Chat Interface** - Real-time messaging with WebSocket support
- ⚙️ **Settings UI** - Configure backend target, redacted LLM credentials, custom secrets, model, and security policies
- 📊 **Metrics** - Track tokens, costs, and tool usage
- 🔒 **Security Policies** - Configurable action confirmation
- 💾 **Persistence** - Save and restore conversation state
- 🔌 **Multiple Backends** - Support for prototype, local OpenHands Main, and OpenHands Cloud targets

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Tailwind CSS v4, Vite, React Router, Lucide Icons |
| **Backend** | FastAPI, WebSocket, Pydantic |
| **SDK** | OpenHands SDK, OpenHands Tools |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    OpenHands Client                              │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (React + TypeScript + Tailwind)                       │
│  ├── Dashboard                                                   │
│  │   ├── Stats overview                                          │
│  │   ├── Configuration display                                   │
│  │   └── Conversation list                                       │
│  ├── Chat Interface                                              │
│  │   ├── Real-time messaging (WebSocket)                         │
│  │   ├── Tool call visualization                                 │
│  │   └── Action confirmation                                     │
│  └── Settings Modal                                              │
│      ├── Backend target selection                                │
│      ├── Redacted settings and secrets                           │
│      └── Security policy settings                                │
├─────────────────────────────────────────────────────────────────┤
│  Frontend Backend Adapters                                       │
│  ├── DevSdkBackend - existing /api + /ws prototype server         │
│  ├── LocalOpenHandsBackend - OpenHands Main /api/v1 routes        │
│  └── CloudOpenHandsBackend - configurable cloud URL + auth        │
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
# Build the primary React UI
cd frontend && npm install && npm run build && cd ..

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

`server.py` serves the built React app from `frontend/dist` when present. The
legacy `templates/` and `static/` UI remains as a fallback for development.

### Backend Modes

Use Settings → Backend Connection to choose:

| Mode | Description |
|------|-------------|
| `prototype` | Uses this repo's FastAPI SDK server under `/api` and `/ws` |
| `local` | Connects to OpenHands Main at `http://localhost:3000` by default and uses `/api/v1` |
| `cloud` | Connects to a configurable OpenHands Cloud base URL with a session auth token |

Only backend mode and base URL are persisted in browser storage. Auth tokens and secret values use OpenHands-style redaction: blank means keep the current value, and values are not read back into the client.

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
├── frontend/                  # React frontend (Vite + TypeScript + Tailwind)
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── Layout.tsx     # App shell with navbar
│   │   │   ├── SettingsModal.tsx # LLM configuration modal
│   │   │   └── NewChatModal.tsx  # Create conversation modal
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx  # Main dashboard page
│   │   │   └── Chat.tsx       # Chat interface page
│   │   ├── hooks/
│   │   │   └── useWebSocket.ts # WebSocket connection hook
│   │   ├── lib/
│   │   │   ├── api.ts         # Adapter-backed API facade
│   │   │   └── backend/       # Backend interface and concrete adapters
│   │   ├── types/
│   │   │   └── index.ts       # TypeScript type definitions
│   │   ├── App.tsx            # Root component with routing
│   │   └── index.css          # Tailwind CSS imports
│   ├── dist/                  # Production build (included)
│   ├── package.json           # npm dependencies
│   └── vite.config.ts         # Vite configuration
├── openhands_client/          # Python SDK wrapper
│   ├── __init__.py            # Package exports
│   ├── client.py              # Main OpenHands client
│   ├── config.py              # Configuration management
│   ├── conversation_manager.py # Multi-conversation support
│   └── event_handler.py       # SDK event processing
├── templates/                 # Fallback Jinja2 templates
├── static/                    # Fallback static assets
├── server.py                  # Full FastAPI server (with SDK)
├── server_standalone.py       # Demo server (works without SDK)
├── pyproject.toml             # Python dependencies
├── .env.example               # Configuration template
└── README.md                  # This file
```

## Development

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Start dev server (with hot reload)
npm run dev

# Build for production
npm run build

# Run adapter contract tests
npm run test

# The dev server proxies /api and /ws to localhost:12000
```

### Desktop Development

The same web app can be launched in Electron once the Python backend is running:

```bash
cd frontend
OPENHANDS_CLIENT_URL=http://localhost:12000 npm run desktop
```

If `OPENHANDS_CLIENT_URL` is omitted, Electron defaults to
`http://localhost:12002`, matching the local port used when `12000` is occupied.

### Runtime Settings

Settings edited in the app are persisted by the backend in
`.openhands-client/config.json` and are redacted when returned through
`/api/config`. Secret fields can be left blank in the UI to keep existing stored
values. The file is gitignored and created with owner-only permissions.

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

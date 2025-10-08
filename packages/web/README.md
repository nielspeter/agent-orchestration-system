# Agent System Web UI

Web interface for the agent orchestration system with real-time event streaming.

## Architecture

- **Server**: Express server with SSE endpoint for event streaming
- **Client**: React + Vite with native EventSource API
- **Real-time**: Server-Sent Events (SSE) for one-way server→client streaming

## Development

```bash
# From workspace root
npm install

# Start both server and client in dev mode
npm run dev -w @agent-system/web

# Or start individually
npm run dev:server -w @agent-system/web  # Port 3001
npm run dev:client -w @agent-system/web  # Port 3000
```

## How It Works

### Server (Port 3001)

**SSE Endpoint**: `/events/:sessionId`
- Streams real-time events from agent execution
- Auto-cleanup when client disconnects
- Uses EventLogger from @agent-system/core

**REST API**:
- `POST /api/executions` - Start agent execution
- `GET /api/executions/:sessionId` - Get execution status
- `POST /api/executions/:sessionId/control` - Control execution (TODO)
- `GET /api/agents` - List available agents (TODO)

### Client (Port 3000)

**Features**:
- Start agent execution with custom prompt
- Real-time event streaming via EventSource
- Timeline visualization of all events
- Connection status indicator

**Dev Proxy**:
Vite proxies `/api` and `/events` to port 3001 for seamless development.

## Production Build

```bash
npm run build -w @agent-system/web
```

Outputs:
- `dist/client/` - Static React app
- `server/dist/` - Compiled server

## Tech Stack

### Server
- Express 4
- @agent-system/core (workspace dependency)
- TypeScript

### Client
- React 18
- Vite 5
- TypeScript
- Native EventSource API (no libraries needed!)

## Next Steps

- [ ] Add authentication
- [ ] Implement execution controls (pause/stop/resume)
- [ ] Add agent upload/management UI
- [ ] Session history viewer
- [ ] Cost tracking dashboard
- [ ] Multi-user collaborative viewing

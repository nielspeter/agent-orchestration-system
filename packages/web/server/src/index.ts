import dotenv from 'dotenv';
import { resolve } from 'path';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { AgentSystemBuilder, EventLogger } from '@agent-system/core';

// Load .env from workspace root (2 levels up from packages/web)
dotenv.config({ path: resolve(process.cwd(), '../../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Store active event loggers by sessionId
const activeSessions = new Map<string, EventLogger>();

/**
 * SSE endpoint - streams events for a session in real-time
 */
app.get('/events/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected', sessionId, timestamp: Date.now() })}\n\n`);

  // Get or create event logger for this session
  const eventLogger = activeSessions.get(sessionId);

  if (!eventLogger) {
    res.write(
      `data: ${JSON.stringify({
        type: 'error',
        message: 'Session not found. Start an execution first.',
      })}\n\n`
    );
    return;
  }

  // Subscribe to all events
  const handler = (event: unknown) => {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch (error) {
      console.error('Error sending event:', error);
    }
  };

  eventLogger.on('*', handler);

  // Clean up when client disconnects
  req.on('close', () => {
    eventLogger.off('*', handler);
    console.log(`Client disconnected from session ${sessionId}`);
  });
});

/**
 * Start agent execution
 */
app.post('/api/executions', async (req: Request, res: Response) => {
  try {
    const { agentPath, prompt, sessionId } = req.body;

    if (!agentPath || !prompt) {
      return res.status(400).json({
        error: 'Missing required fields: agentPath, prompt',
      });
    }

    // Build agent system
    const actualSessionId = sessionId || `session-${Date.now()}`;
    const system = await AgentSystemBuilder.default()
      .withAgents([agentPath])
      .withSessionId(actualSessionId)
      .build();

    // Store event logger for SSE streaming
    activeSessions.set(actualSessionId, system.eventLogger);

    // Start execution in background
    // Extract agent name from path (e.g., "agents/orchestrator.md" -> "orchestrator")
    const agentName = agentPath.replace(/^.*\//, '').replace(/\.md$/, '');

    system.executor
      .execute(agentName, prompt)
      .then((result: string) => {
        console.log(`Execution completed for session ${actualSessionId}`);
        console.log(`Result: ${result}`);
      })
      .catch((error: Error) => {
        console.error(`Execution failed for session ${actualSessionId}:`, error);
      });

    // Return session info immediately
    res.json({
      sessionId: actualSessionId,
      status: 'started',
      message: 'Execution started. Connect to /events/:sessionId for real-time updates.',
    });
  } catch (error) {
    console.error('Error starting execution:', error);
    res.status(500).json({
      error: 'Failed to start execution',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Get execution status
 */
app.get('/api/executions/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const isActive = activeSessions.has(sessionId);

  res.json({
    sessionId,
    status: isActive ? 'active' : 'not_found',
  });
});

/**
 * Control execution (pause/stop/resume)
 */
app.post('/api/executions/:sessionId/control', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { action } = req.body;

  // TODO: Implement control mechanisms
  res.json({
    sessionId,
    action,
    message: 'Control actions not yet implemented',
  });
});

/**
 * List available agents
 */
app.get('/api/agents', (_req: Request, res: Response) => {
  // TODO: Scan agents directory and return list
  res.json({
    agents: [
      { id: 'orchestrator', path: 'agents/orchestrator.md' },
      { id: 'analyzer', path: 'agents/analyzer.md' },
    ],
  });
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Agent System Web Server running on http://localhost:${PORT}`);
  console.log(`📡 SSE endpoint: http://localhost:${PORT}/events/:sessionId`);
  console.log(`🔌 API endpoint: http://localhost:${PORT}/api/executions`);
});

import { useState, useEffect, useRef } from 'react';
import './App.css';

interface Event {
  type: string;
  timestamp: number;
  data?: unknown;
}

function App() {
  const [sessionId, setSessionId] = useState<string>('');
  const [agentPath, setAgentPath] = useState('agents/orchestrator.md');
  const [prompt, setPrompt] = useState('');
  const [events, setEvents] = useState<Event[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Start execution
  const handleStart = async () => {
    if (!prompt.trim()) {
      alert('Please enter a prompt');
      return;
    }

    try {
      setIsRunning(true);
      setEvents([]);

      const response = await fetch('/api/executions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentPath,
          prompt,
          sessionId: sessionId || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start execution');
      }

      setSessionId(data.sessionId);

      // Connect to SSE stream
      const eventSource = new EventSource(`/events/${data.sessionId}`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('SSE connection opened');
        setIsConnected(true);
      };

      eventSource.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          setEvents((prev) => [...prev, event]);

          // Stop running if agent completes
          if (event.type === 'agent:complete' || event.type === 'agent:error') {
            setIsRunning(false);
          }
        } catch (error) {
          console.error('Error parsing event:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        setIsConnected(false);
        setIsRunning(false);
        eventSource.close();
      };
    } catch (error) {
      console.error('Error starting execution:', error);
      alert(error instanceof Error ? error.message : 'Failed to start execution');
      setIsRunning(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return (
    <div className="app">
      <header className="header">
        <h1>🤖 Agent System</h1>
        <div className="status">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
          {sessionId && <span className="session-id">Session: {sessionId}</span>}
        </div>
      </header>

      <main className="main">
        <div className="control-panel">
          <h2>Start Execution</h2>

          <div className="form-group">
            <label htmlFor="agent">Agent:</label>
            <input
              id="agent"
              type="text"
              value={agentPath}
              onChange={(e) => setAgentPath(e.target.value)}
              placeholder="agents/orchestrator.md"
              disabled={isRunning}
            />
          </div>

          <div className="form-group">
            <label htmlFor="prompt">Prompt:</label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your task..."
              rows={4}
              disabled={isRunning}
            />
          </div>

          <button onClick={handleStart} disabled={isRunning} className="start-button">
            {isRunning ? '⏳ Running...' : '▶️ Start'}
          </button>
        </div>

        <div className="event-timeline">
          <h2>Event Timeline ({events.length})</h2>
          <div className="events">
            {events.length === 0 && <div className="no-events">No events yet. Start an execution to see events stream in real-time.</div>}
            {events.map((event, i) => (
              <div key={i} className="event">
                <div className="event-header">
                  <span className="event-type">{event.type}</span>
                  <span className="event-timestamp">{new Date(event.timestamp).toLocaleTimeString()}</span>
                </div>
                {event.data && (
                  <pre className="event-data">{JSON.stringify(event.data, null, 2)}</pre>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;

# Web UI: Workflow Selection

## The Real Requirement

**User wants:** Run different agentic workflows from the same web UI

**Examples:**
- Werewolf Game (packages/examples/werewolf-game/)
- Thinking Demo (packages/examples/thinking/)
- Coding Team (packages/examples/coding-team/)
- Critical Illness (packages/examples/critical-illness-claim/)
- Orchestration (packages/examples/orchestration/)

**Not asking for:** Concurrent executions or tabs

**Asking for:** Choose which workflow to run from the UI

## Current Problem

Web UI has hardcoded agent path:
```tsx
<input
  type="text"
  value={agentPath}
  placeholder="agents/orchestrator.md"
/>
```

User must:
1. Know exact path to agent file
2. Type it manually
3. No way to discover available workflows

## Solution: Workflow Selector

### UI Design

```
┌────────────────────────────────────────────┐
│ Select Workflow:                           │
│ ┌────────────────────────────────────────┐ │
│ │ Werewolf Game                        ▼ │ │ ← Dropdown
│ └────────────────────────────────────────┘ │
│                                            │
│ Description:                               │
│ Multi-agent game with game-master,         │
│ werewolf, seer, and villager agents.       │
│ Demonstrates autonomous agent interaction. │
│                                            │
│ Starting Agent: game-master                │
│                                            │
│ Prompt:                                    │
│ ┌────────────────────────────────────────┐ │
│ │ Start a game with 5 players           │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ [Start Execution]                          │
└────────────────────────────────────────────┘
```

**Dropdown options:**
- Werewolf Game
- Thinking Demo
- Coding Team
- Critical Illness Claim
- Orchestration Demo
- Custom (manual path entry)

### Workflow Configuration

**Backend API:**
```typescript
GET /api/workflows

Response:
[
  {
    id: "werewolf",
    name: "Werewolf Game",
    description: "Multi-agent game with autonomous agents",
    agentDirectory: "packages/examples/werewolf-game/agents",
    entryAgent: "game-master",
    examplePrompts: [
      "Start a game with 5 players",
      "Run a game with 7 players"
    ]
  },
  {
    id: "thinking",
    name: "Thinking Demo",
    description: "Agents with extended thinking/reasoning",
    agentDirectory: "packages/examples/thinking/agents",
    entryAgent: "deep-reasoner",
    examplePrompts: [
      "Solve the trolley problem",
      "Design a distributed cache system"
    ]
  },
  {
    id: "coding-team",
    name: "Coding Team",
    description: "Collaborative software development",
    agentDirectory: "packages/examples/coding-team/agents",
    entryAgent: "driver",
    examplePrompts: [
      "Implement a binary search function",
      "Create a REST API with validation"
    ]
  }
]
```

**Configuration file:**
```json
// packages/web/server/workflows.json
{
  "workflows": [
    {
      "id": "werewolf",
      "name": "Werewolf Game",
      "description": "Multi-agent game demonstrating autonomous agent interaction",
      "agentDirectory": "packages/examples/werewolf-game/agents",
      "entryAgent": "game-master",
      "examplePrompts": [
        "Start a game with 5 players",
        "Run a game with 7 players"
      ]
    },
    {
      "id": "thinking",
      "name": "Thinking Demo",
      "description": "Agents with extended thinking and reasoning",
      "agentDirectory": "packages/examples/thinking/agents",
      "entryAgent": "deep-reasoner",
      "examplePrompts": [
        "Solve the trolley problem",
        "Design a distributed cache system"
      ]
    },
    {
      "id": "coding-team",
      "name": "Coding Team",
      "description": "Collaborative software development workflow",
      "agentDirectory": "packages/examples/coding-team/agents",
      "entryAgent": "driver",
      "examplePrompts": [
        "Implement a binary search function with tests",
        "Create a REST API with validation"
      ]
    },
    {
      "id": "critical-illness",
      "name": "Critical Illness Claim",
      "description": "Insurance claim processing workflow",
      "agentDirectory": "packages/examples/critical-illness-claim/agents",
      "entryAgent": "claim-processor",
      "examplePrompts": [
        "Process a heart attack claim"
      ]
    },
    {
      "id": "orchestration",
      "name": "Orchestration Demo",
      "description": "Basic orchestrator with specialist agents",
      "agentDirectory": "packages/examples/orchestration/agents",
      "entryAgent": "orchestrator",
      "examplePrompts": [
        "Analyze a TypeScript file",
        "Research best practices for React"
      ]
    }
  ]
}
```

### User Experience

**1. User opens web UI:**
```
Sees dropdown with workflow options
Default: First workflow (Werewolf Game)
Shows description
Shows example prompts
```

**2. User selects workflow:**
```
Dropdown changes to "Coding Team"
Description updates
Example prompts update
Entry agent path auto-fills
```

**3. User clicks example prompt:**
```
Prompt textarea auto-fills
Ready to click "Start"
```

**4. User clicks Start:**
```
AgentSystemBuilder loads agents from workflow's directory
Executes entry agent with prompt
Events stream to browser
```

**5. For custom workflows:**
```
Select "Custom" from dropdown
Manual entry fields appear:
- Agent directory path
- Entry agent name
- Prompt
```

## Implementation

### Phase 1: Backend API (1 hour)

**Create workflows configuration:**
```typescript
// packages/web/server/src/workflows.ts
export interface Workflow {
  id: string;
  name: string;
  description: string;
  agentDirectory: string;
  entryAgent: string;
  examplePrompts: string[];
}

export const WORKFLOWS: Workflow[] = [
  {
    id: "werewolf",
    name: "Werewolf Game",
    description: "Multi-agent game with game-master, werewolf, seer, and villager agents",
    agentDirectory: "packages/examples/werewolf-game/agents",
    entryAgent: "game-master",
    examplePrompts: [
      "Start a game with 5 players",
      "Run a game with 7 players"
    ]
  },
  // ... more workflows
];
```

**Add API endpoint:**
```typescript
// packages/web/server/src/index.ts
app.get('/api/workflows', (req, res) => {
  res.json({ workflows: WORKFLOWS });
});
```

**Update execution endpoint:**
```typescript
app.post('/api/executions', async (req, res) => {
  const { workflowId, prompt, sessionId } = req.body;

  // Get workflow config
  const workflow = WORKFLOWS.find(w => w.id === workflowId);
  if (!workflow) {
    return res.status(404).json({ error: 'Workflow not found' });
  }

  const newSessionId = sessionId || `session-${Date.now()}`;

  // Build system with workflow's agents
  const system = await AgentSystemBuilder.default()
    .withAgentsFrom(workflow.agentDirectory)
    .withSessionId(newSessionId)
    .build();

  // Store for SSE
  activeSessions.set(newSessionId, system.eventLogger);

  // Execute entry agent
  system.executor.execute(workflow.entryAgent, prompt)
    .then((result) => console.log('Completed:', result))
    .catch((error) => console.error('Failed:', error));

  res.json({
    sessionId: newSessionId,
    status: 'started',
    workflow: workflow.name,
    agent: workflow.entryAgent
  });
});
```

### Phase 2: Frontend UI (2 hours)

**State management:**
```typescript
const [workflows, setWorkflows] = useState<Workflow[]>([]);
const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
const [prompt, setPrompt] = useState('');
```

**Fetch workflows on mount:**
```typescript
useEffect(() => {
  fetch('/api/workflows')
    .then(res => res.json())
    .then(data => {
      setWorkflows(data.workflows);
      setSelectedWorkflow(data.workflows[0]); // Default to first
      setPrompt(data.workflows[0].examplePrompts[0]); // Default prompt
    });
}, []);
```

**UI components:**
```tsx
<div className="workflow-selector">
  <label>Select Workflow:</label>
  <select
    value={selectedWorkflow?.id}
    onChange={(e) => {
      const workflow = workflows.find(w => w.id === e.target.value);
      setSelectedWorkflow(workflow);
      setPrompt(workflow?.examplePrompts[0] || '');
    }}
  >
    {workflows.map(w => (
      <option key={w.id} value={w.id}>{w.name}</option>
    ))}
  </select>

  {selectedWorkflow && (
    <div className="workflow-info">
      <p className="description">{selectedWorkflow.description}</p>
      <p className="agent">Entry Agent: <code>{selectedWorkflow.entryAgent}</code></p>

      <div className="example-prompts">
        <label>Example Prompts:</label>
        {selectedWorkflow.examplePrompts.map((example, i) => (
          <button
            key={i}
            onClick={() => setPrompt(example)}
            className="example-prompt"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  )}

  <label>Prompt:</label>
  <textarea
    value={prompt}
    onChange={(e) => setPrompt(e.target.value)}
    rows={4}
  />

  <button onClick={handleStart}>
    Start Execution
  </button>
</div>
```

**Start handler:**
```typescript
const handleStart = async () => {
  if (!selectedWorkflow) return;

  const response = await fetch('/api/executions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workflowId: selectedWorkflow.id,
      prompt,
      sessionId // Optional: reuse session
    })
  });

  const data = await response.json();
  setSessionId(data.sessionId);

  // Connect to SSE stream
  const eventSource = new EventSource(`/events/${data.sessionId}`);
  // ... rest of SSE setup
};
```

### Phase 3: Styling (1 hour)

**Make it look good:**
- Dropdown styling
- Description card with nice typography
- Example prompt buttons with hover effects
- Responsive layout
- Loading states
- Error states

### Phase 4: Custom Workflow Support (1 hour)

**Add "Custom" option:**
```tsx
<select>
  {workflows.map(w => <option key={w.id}>{w.name}</option>)}
  <option value="custom">Custom (Advanced)</option>
</select>

{selectedWorkflow?.id === 'custom' && (
  <div className="custom-config">
    <label>Agent Directory:</label>
    <input
      value={customAgentDir}
      onChange={(e) => setCustomAgentDir(e.target.value)}
      placeholder="packages/examples/my-workflow/agents"
    />

    <label>Entry Agent:</label>
    <input
      value={customEntryAgent}
      onChange={(e) => setCustomEntryAgent(e.target.value)}
      placeholder="orchestrator"
    />
  </div>
)}
```

**Backend support:**
```typescript
app.post('/api/executions', async (req, res) => {
  const { workflowId, customAgentDir, customEntryAgent, prompt } = req.body;

  let agentDirectory: string;
  let entryAgent: string;

  if (workflowId === 'custom') {
    agentDirectory = customAgentDir;
    entryAgent = customEntryAgent;
  } else {
    const workflow = WORKFLOWS.find(w => w.id === workflowId);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    agentDirectory = workflow.agentDirectory;
    entryAgent = workflow.entryAgent;
  }

  // Build and execute
  const system = await AgentSystemBuilder.default()
    .withAgentsFrom(agentDirectory)
    .withSessionId(sessionId)
    .build();

  // ...
});
```

## Workflow Discovery (Future)

**Automatic discovery from filesystem:**
```typescript
// Scan packages/examples/ for workflows
export async function discoverWorkflows(): Promise<Workflow[]> {
  const examplesDir = 'packages/examples';
  const subdirs = await fs.readdir(examplesDir);

  const workflows: Workflow[] = [];

  for (const dir of subdirs) {
    const agentDir = path.join(examplesDir, dir, 'agents');
    const configFile = path.join(examplesDir, dir, 'workflow.json');

    if (await exists(agentDir)) {
      // Look for workflow.json
      if (await exists(configFile)) {
        const config = await fs.readJson(configFile);
        workflows.push(config);
      } else {
        // Auto-generate from directory
        workflows.push({
          id: dir,
          name: toTitleCase(dir),
          description: `Workflow from ${dir}`,
          agentDirectory: agentDir,
          entryAgent: guessEntryAgent(agentDir)
        });
      }
    }
  }

  return workflows;
}
```

**Workflow metadata file:**
```json
// packages/examples/werewolf-game/workflow.json
{
  "id": "werewolf",
  "name": "Werewolf Game",
  "description": "Multi-agent game demonstrating autonomous interaction",
  "entryAgent": "game-master",
  "examplePrompts": [
    "Start a game with 5 players",
    "Run a game with 7 players"
  ]
}
```

## Benefits

### ✅ Easy Workflow Discovery
Users see all available workflows in dropdown

### ✅ Better Onboarding
New users don't need to know agent paths

### ✅ Example Prompts
Users see what's possible, can click to try

### ✅ Professional Feel
More like a product, less like a dev tool

### ✅ Extensible
Easy to add new workflows

### ✅ Custom Support
Advanced users can still use custom paths

## Implementation Checklist

- [ ] Phase 1: Create workflows.ts with configuration (1 hour)
- [ ] Phase 1: Add GET /api/workflows endpoint (30 min)
- [ ] Phase 1: Update POST /api/executions to accept workflowId (30 min)
- [ ] Phase 2: Add workflow dropdown to frontend (1 hour)
- [ ] Phase 2: Add description and example prompts display (30 min)
- [ ] Phase 2: Update start handler to use workflow (30 min)
- [ ] Phase 3: Style the UI nicely (1 hour)
- [ ] Phase 4: Add "Custom" option for advanced users (1 hour)
- [ ] Testing: Test each workflow from UI (30 min)
- [ ] Documentation: Update README with workflow setup (30 min)

**Total: ~6-7 hours**

## Example Workflows to Include

### 1. Werewolf Game
```json
{
  "id": "werewolf",
  "name": "Werewolf Game",
  "description": "Multi-agent social deduction game with game-master, werewolf, seer, and villagers",
  "agentDirectory": "packages/examples/werewolf-game/agents",
  "entryAgent": "game-master",
  "examplePrompts": [
    "Start a game with 5 players",
    "Run a game with 7 players"
  ]
}
```

### 2. Thinking Demo
```json
{
  "id": "thinking",
  "name": "Extended Thinking",
  "description": "Agents with extended thinking/reasoning for complex problems",
  "agentDirectory": "packages/examples/thinking/agents",
  "entryAgent": "deep-reasoner",
  "examplePrompts": [
    "Solve the trolley problem",
    "Design a distributed cache system",
    "Explain quantum entanglement"
  ]
}
```

### 3. Coding Team
```json
{
  "id": "coding-team",
  "name": "Coding Team",
  "description": "Collaborative development with driver, implementer, and test-writer agents",
  "agentDirectory": "packages/examples/coding-team/agents",
  "entryAgent": "driver",
  "examplePrompts": [
    "Implement a binary search function with tests",
    "Create a user authentication API"
  ]
}
```

### 4. Orchestration
```json
{
  "id": "orchestration",
  "name": "Orchestration Demo",
  "description": "Orchestrator coordinating specialist agents for complex tasks",
  "agentDirectory": "packages/examples/orchestration/agents",
  "entryAgent": "orchestrator",
  "examplePrompts": [
    "Analyze this TypeScript file for issues",
    "Research React best practices"
  ]
}
```

### 5. Critical Illness
```json
{
  "id": "critical-illness",
  "name": "Insurance Claim Processing",
  "description": "Multi-step workflow for processing insurance claims",
  "agentDirectory": "packages/examples/critical-illness-claim/agents",
  "entryAgent": "claim-processor",
  "examplePrompts": [
    "Process a heart attack claim for a 45-year-old"
  ]
}
```

## Future Enhancements

### Workflow Categories
```
Categories:
- Games (Werewolf)
- Development (Coding Team, Orchestration)
- Business (Critical Illness, Tender Analysis)
- Research (Thinking Demo)
```

### Workflow Marketplace
- User-contributed workflows
- Rating/reviews
- Import from GitHub

### Workflow Builder
- Visual editor to create workflows
- Drag-and-drop agent configuration
- Save custom workflows

### Workflow Templates
- Clone and customize existing workflows
- Share workflows with team

## Conclusion

**Simple solution:** Dropdown to select workflow, example prompts to guide users.

**Key insight:** Users want to run different **example workflows**, not manage concurrent executions. The web UI becomes a demo/exploration tool.

**Implementation:** ~6-7 hours for full workflow selection with nice UI.

Ready to implement?

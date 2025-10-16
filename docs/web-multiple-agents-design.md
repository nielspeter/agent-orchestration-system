# Web UI: Multiple Agents Design

## The Question

**User wants:** "Not just one agent, but maybe several agents from the web"

This could mean several things. Let's explore each interpretation.

## Possible Interpretations

### Interpretation 1: Session Continuity (We Have This)
**What:** Multiple prompts to same agent in same session
```
User: "Analyze React docs"
Agent: [responds]

User: "Now compare to Vue"
Agent: [responds with context from previous]
```

**Status:** ✅ Already supported via session continuity

---

### Interpretation 2: Multiple Agents, Sequential
**What:** Run different agents one after another
```
Step 1: Run orchestrator with "plan website"
[wait for completion]

Step 2: Run designer with "create design based on plan"
[wait for completion]

Step 3: Run coder with "implement design"
```

**Status:** ✅ Can do this manually (run, wait, run next)

---

### Interpretation 3: Internal Delegation (We Have This)
**What:** One agent delegates to multiple specialists
```
User starts: orchestrator "Build website"
System: orchestrator → designer → coder → tester

User sees delegation tree in events
```

**Status:** ✅ Already supported via Delegate tool

---

### Interpretation 4: Multiple Concurrent Executions ⭐
**What:** Run several agents at the same time
```
Tab 1: orchestrator "analyze React"    [RUNNING]
Tab 2: analyzer "analyze Vue"         [RUNNING]
Tab 3: researcher "analyze Angular"   [RUNNING]

All three running simultaneously, each with own event stream
```

**Status:** ❌ NOT supported - this is what's missing

---

### Interpretation 5: Batch Execution with Same Prompt
**What:** Ask multiple agents the same question
```
Prompt: "What's the best way to handle state?"

Run with:
☑ react-expert
☑ vue-expert
☑ angular-expert

Get three perspectives, compare answers
```

**Status:** ❌ NOT supported

---

### Interpretation 6: Agent Catalog/Browser
**What:** Visual directory of available agents
```
┌────────────────────────────────────┐
│ Available Agents                   │
├────────────────────────────────────┤
│ 📊 Orchestrator                    │
│    Coordinates complex tasks       │
│    [Start] [Details]               │
│                                    │
│ 🔍 Analyzer                        │
│    Code analysis expert            │
│    [Start] [Details]               │
│                                    │
│ 📝 Writer                          │
│    Content generation              │
│    [Start] [Details]               │
└────────────────────────────────────┘
```

**Status:** ❌ NOT supported

---

## Most Likely Need: Concurrent Executions (Interpretation 4)

### Why This Makes Sense

**Use Case 1: Experiments**
"Try same task with different agents, compare results"
- Orchestrator vs Analyzer vs Researcher
- Same prompt, different approaches
- See which performs better

**Use Case 2: Parallel Work**
"Process multiple items simultaneously"
- Analyze file1.ts
- Analyze file2.ts
- Analyze file3.ts
- Faster than sequential

**Use Case 3: Long Task + Quick Task**
"Start big task, continue working"
- Start researcher on 30-minute task
- While running, do quick analysis
- Come back to see long task results

**Use Case 4: Different Contexts**
"Work on multiple projects"
- Project A: feature planning
- Project B: bug investigation
- Project C: documentation
- Switch between as needed

### Current Problem

Web UI can only show **one execution at a time**:
```
┌─────────────────────────────────────┐
│ Agent: [orchestrator.md]            │
│ Prompt: [analyze React]             │
│ [Start]                             │
├─────────────────────────────────────┤
│ Event Timeline (143 events)         │
│ - agent_start                       │
│ - tool_call                         │
│ - assistant                         │
└─────────────────────────────────────┘
```

If user clicks "Start" again:
- **Current behavior:** Unclear - might reuse session or clear timeline
- **User expectation:** New execution, both visible

## Solution: Browser-Style Tabs

### UI Design

```
┌──────────────────────────────────────────────────────────┐
│ [React Analysis] [Vue Research] [x] [Docs Writer] [+New] │ ← Tab Bar
├──────────────────────────────────────────────────────────┤
│ Active Tab: React Analysis                               │
│                                                          │
│ Agent: agents/orchestrator.md                           │
│ Prompt: Analyze React documentation                     │
│ [Start] [Stop]                     Status: ⚡ Running  │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ Event Timeline (143 events)                              │
│ 10:30:15  agent_start                                    │
│ 10:30:16  tool_call: WebFetch(react.dev)               │
│ 10:30:17  assistant: "Analyzing React documentation..." │
│ 10:30:18  tool_call: Read(...)                         │
│                                                          │
│ 📊 Metrics: 4,521 tokens | $0.0234 | 3.4s              │
└──────────────────────────────────────────────────────────┘
```

**Tab States:**
- 🟢 Running (green indicator)
- ✅ Complete (checkmark)
- ❌ Error (red X)
- ⏸️ Idle (gray)

### Workflow

**1. User opens web UI:**
```
Shows one empty tab "New Execution"
```

**2. User fills form and clicks Start:**
```
Tab renamed to agent name or prompt preview
Execution starts
Events stream in
```

**3. User clicks "+ New" while first is running:**
```
New tab created
Switches to new tab
First tab keeps running in background
```

**4. User switches between tabs:**
```
Each tab shows its own:
- Agent path
- Prompt
- Event timeline
- Status
- Metrics
```

**5. User closes tab:**
```
EventSource connection closed
Tab removed from UI
Session remains in storage (can view later)
```

### Features

**Tab Management:**
- Create new tab (+ button or Cmd+T)
- Close tab (X button or Cmd+W)
- Switch tabs (click or Cmd+Number)
- Reorder tabs (drag and drop - future)
- Max 10 tabs (prevent resource exhaustion)

**Tab Naming:**
- Auto: First 30 chars of prompt
- Manual: Click to rename (future)
- Shows agent name + status icon

**Tab Persistence:**
- Save to localStorage on change
- Restore tabs on page refresh
- Option to "restore previous session"

**Visual Indicators:**
- Active tab highlighted
- Running tabs show spinner
- Complete tabs show checkmark
- Error tabs show red indicator
- Token count badge (for cost awareness)

## Technical Architecture

### State Structure

```typescript
interface ExecutionTab {
  // Identity
  id: string;              // UUID for tab
  sessionId: string;       // Session ID for backend

  // Configuration
  agentPath: string;
  prompt: string;

  // State
  status: 'idle' | 'running' | 'complete' | 'error';
  events: SessionEvent[];

  // Metadata
  createdAt: number;
  startedAt?: number;
  completedAt?: number;

  // Metrics
  totalTokens: number;
  totalCost: number;

  // SSE Connection
  eventSource?: EventSource;

  // UI
  label?: string;          // Custom tab name
}

interface AppState {
  tabs: ExecutionTab[];
  activeTabId: string;
}
```

### Component Structure

```
<App>
  <TabBar>
    {tabs.map(tab => <Tab key={tab.id} {...tab} />)}
    <NewTabButton />
  </TabBar>

  <TabContent>
    {activeTab && (
      <>
        <ExecutionForm
          agentPath={activeTab.agentPath}
          prompt={activeTab.prompt}
          onStart={handleStart}
        />

        <EventTimeline
          events={activeTab.events}
          status={activeTab.status}
        />

        <MetricsPanel
          tokens={activeTab.totalTokens}
          cost={activeTab.totalCost}
          duration={activeTab.completedAt - activeTab.startedAt}
        />
      </>
    )}
  </TabContent>
</App>
```

### SSE Management

**Multiple Connections:**
```typescript
function createTabEventSource(sessionId: string): EventSource {
  const eventSource = new EventSource(`/events/${sessionId}`);

  eventSource.onmessage = (e) => {
    const event = JSON.parse(e.data);

    // Add event to correct tab
    setTabs(prev => prev.map(tab =>
      tab.sessionId === sessionId
        ? { ...tab, events: [...tab.events, event] }
        : tab
    ));
  };

  eventSource.onerror = () => {
    // Update tab status
    setTabs(prev => prev.map(tab =>
      tab.sessionId === sessionId
        ? { ...tab, status: 'error' }
        : tab
    ));
  };

  return eventSource;
}
```

**Cleanup:**
```typescript
function closeTab(tabId: string) {
  const tab = tabs.find(t => t.id === tabId);

  // Close SSE connection
  if (tab?.eventSource) {
    tab.eventSource.close();
  }

  // Remove tab
  setTabs(prev => prev.filter(t => t.id !== tabId));
}
```

### Resource Limits

**Max Concurrent Tabs:** 10
- Prevent browser resource exhaustion
- Prevent backend overload
- Show warning when limit reached

**Memory Management:**
- Limit events per tab (e.g., last 1000)
- Offer "show all" to load full history from storage
- Clear events when tab closed

**Connection Management:**
- Close EventSource when tab closed
- Reconnect on tab reactivation (future)
- Handle connection failures gracefully

## Implementation Plan

### Phase 1: State Refactoring (2 hours)

**Before:**
```typescript
const [events, setEvents] = useState([]);
const [sessionId, setSessionId] = useState();
const [isRunning, setIsRunning] = useState(false);
```

**After:**
```typescript
const [tabs, setTabs] = useState<ExecutionTab[]>([
  { id: uuid(), sessionId: uuid(), status: 'idle', ... }
]);
const [activeTabId, setActiveTabId] = useState(tabs[0].id);
```

**Changes needed:**
- Create ExecutionTab interface
- Migrate all state to tabs array
- Update all state setters to work with tabs
- Add helper functions (createTab, closeTab, switchTab)

### Phase 2: Tab UI (3 hours)

**Components to create:**
```
<TabBar />
  <Tab /> (for each tab)
  <NewTabButton />

<TabContent />
  Shows active tab content
```

**Styling:**
- Tab bar with horizontal scroll
- Active tab highlight
- Status indicators (spinner, checkmark, error)
- Close button with hover state
- Responsive (mobile: dropdown instead of tabs?)

### Phase 3: Multi-SSE (2 hours)

**Changes:**
- Create EventSource per tab
- Store in tab state
- Handle events for correct tab (by sessionId)
- Close connections on tab close
- Prevent memory leaks

### Phase 4: Tab Persistence (1 hour)

**LocalStorage:**
```typescript
// Save on change
useEffect(() => {
  localStorage.setItem('execution-tabs', JSON.stringify(tabs));
}, [tabs]);

// Restore on mount
useEffect(() => {
  const saved = localStorage.getItem('execution-tabs');
  if (saved) {
    const restored = JSON.parse(saved);
    // Don't restore EventSource (create new if user wants to reconnect)
    setTabs(restored.map(t => ({ ...t, eventSource: undefined })));
  }
}, []);
```

### Phase 5: Polish (2 hours)

**Features:**
- Keyboard shortcuts (Cmd+T, Cmd+W, Cmd+1-9)
- Tab renaming
- Confirm before closing running tab
- Max tabs warning
- Better visual indicators
- Loading states

**Total: ~10 hours**

## Alternative: Batch Execution (Interpretation 5)

If user means "run multiple agents with same prompt":

### UI Design

```
┌─────────────────────────────────────┐
│ Prompt: What's best for state?      │
│                                     │
│ Select Agents:                      │
│ ☑ react-expert                      │
│ ☑ vue-expert                        │
│ ☑ angular-expert                    │
│ ☐ svelte-expert                     │
│                                     │
│ [Run All]                           │
├─────────────────────────────────────┤
│ Results:                            │
│                                     │
│ 📊 react-expert: "Redux or Context" │
│ 📊 vue-expert: "Vuex or Pinia"      │
│ 📊 angular-expert: "Services/RxJS"  │
└─────────────────────────────────────┘
```

**Backend:**
```typescript
POST /api/batch-execution
{
  "agents": ["react-expert", "vue-expert", "angular-expert"],
  "prompt": "What's best for state?"
}

// Server creates 3 parallel executions
// Returns all sessionIds
// Client connects to all SSE streams
```

**This is more specialized** - might be useful but not the primary use case.

## Alternative: Agent Catalog (Interpretation 6)

If user means "browse and select from available agents":

### UI Design

```
┌─────────────────────────────────────┐
│ [My Executions] [Agent Catalog]     │ ← Navigation
├─────────────────────────────────────┤
│                                     │
│ 🔍 Search agents...                 │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 📊 Orchestrator                 │ │
│ │ Coordinates complex tasks       │ │
│ │ Tools: delegate, read, write    │ │
│ │ [Quick Start]                   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 🔍 Code Analyzer                │ │
│ │ Deep code analysis              │ │
│ │ Tools: read, grep, list         │ │
│ │ [Quick Start]                   │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Features:**
- List all agents from `agents/` directory
- Show description from frontmatter
- Show tools available
- Quick start (fills form with agent)
- Search/filter

**Backend needed:**
```typescript
GET /api/agents
Returns: Array<{
  id: string;
  name: string;
  path: string;
  description: string;
  tools: string[];
}>
```

**This is good for discovery** - helps users find the right agent.

## My Recommendation

**Primary:** Tabs (Interpretation 4)
**Secondary (later):** Agent Catalog (Interpretation 6)
**Nice to have:** Batch Execution (Interpretation 5)

### Why Tabs First?

1. **Solves immediate need:** Run multiple agents simultaneously
2. **Familiar UX:** Everyone understands browser tabs
3. **Flexible:** Works for all use cases (experiments, parallel work, multi-tasking)
4. **Progressive enhancement:** Can add catalog later
5. **Reasonable complexity:** ~10 hours, doable

### Why Catalog Second?

1. **Agent discovery:** Helps users find available agents
2. **Better onboarding:** New users see what's possible
3. **Complements tabs:** Click agent in catalog → opens in new tab
4. **Professional feel:** More like a product, less like dev tool

### Why Batch Execution Last?

1. **Niche use case:** Not everyone needs this
2. **Can be achieved with tabs:** Open 3 tabs, run same prompt
3. **More complex backend:** Need parallel execution coordination
4. **Can be added later:** Not blocking for MVP

## Questions for You

Before I implement, I need to know:

**Q1: Is "concurrent executions in tabs" what you meant?**
Or did you mean something else (catalog, batch, etc.)?

**Q2: How important is tab persistence?**
Should tabs survive page refresh?

**Q3: Max concurrent executions?**
10 tabs reasonable? More? Less?

**Q4: Do you want the agent catalog/browser?**
Or just tabs for now?

**Q5: Any specific UX preferences?**
- Tab placement (top, left, etc.)
- Tab naming strategy
- Visual design

Let me know and I'll refine the plan!

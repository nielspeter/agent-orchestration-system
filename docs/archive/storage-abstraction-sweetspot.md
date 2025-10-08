# Storage Abstraction Sweet Spot

## The 80/20 Rule Applied

After review, here's the minimal abstraction that gives 80% of the benefit with 20% of the complexity.

## Core Principle: Abstract Only What Varies

We only need to abstract **agent storage** because:
- Agents are the only entities that might benefit from database storage
- Tools must remain as executable files (security)
- Config should stay simple (files/env vars)
- Sessions already have good abstraction

## The Sweet Spot: One Interface, Two Implementations

### Step 1: Single Interface (30 lines)

```typescript
// src/storage/agent-store.ts
export interface AgentStore {
  // Core operations only
  get(name: string): Promise<Agent | null>;
  list(): Promise<string[]>;

  // Optional - implement later if needed
  reload?(): Promise<void>;
}

export interface Agent {
  id: string;
  name: string;
  prompt: string;
  tools?: string[] | '*';
  model?: string;
  temperature?: number;
  top_p?: number;
}
```

### Step 2: Filesystem Implementation (100 lines)

```typescript
// src/storage/filesystem-agent-store.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import matter from 'gray-matter';

export class FilesystemAgentStore implements AgentStore {
  private cache = new Map<string, Agent>();

  constructor(
    private basePath: string = './agents',
    private useCache: boolean = true
  ) {}

  async get(name: string): Promise<Agent | null> {
    // Check cache first
    if (this.useCache && this.cache.has(name)) {
      return this.cache.get(name)!;
    }

    // Try exact match
    const directPath = path.join(this.basePath, `${name}.md`);
    if (await this.exists(directPath)) {
      return this.loadAgent(directPath, name);
    }

    // Try scanning subdirectories
    const agent = await this.findInSubdirs(name);
    if (agent && this.useCache) {
      this.cache.set(name, agent);
    }

    return agent;
  }

  async list(): Promise<string[]> {
    const agents: string[] = [];

    async function scan(dir: string): Promise<void> {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          await scan(path.join(dir, entry.name));
        } else if (entry.name.endsWith('.md')) {
          agents.push(entry.name.replace('.md', ''));
        }
      }
    }

    await scan(this.basePath);
    return agents;
  }

  async reload(): Promise<void> {
    this.cache.clear();
  }

  private async loadAgent(filePath: string, name: string): Promise<Agent> {
    const content = await fs.readFile(filePath, 'utf-8');
    const { data, content: prompt } = matter(content);

    return {
      id: data.id || name,
      name: data.name || name,
      prompt: prompt.trim(),
      tools: data.tools,
      model: data.model,
      temperature: data.temperature,
      top_p: data.top_p
    };
  }

  private async exists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  private async findInSubdirs(name: string): Promise<Agent | null> {
    // Implementation to search subdirectories
    // Similar to current AgentLoader logic
    return null;
  }
}
```

### Step 3: Update AgentLoader (50 lines of changes)

```typescript
// src/agents/loader.ts
export class AgentLoader {
  constructor(private store: AgentStore) {}

  async loadAgent(nameOrPath: string): Promise<Agent> {
    // Extract name from path if needed
    const name = path.basename(nameOrPath, '.md');

    // Try to load from store
    const agent = await this.store.get(name);

    // Return agent or default
    return agent || this.getDefaultAgent();
  }

  async listAgents(): Promise<string[]> {
    return this.store.list();
  }

  private getDefaultAgent(): Agent {
    return {
      id: 'default',
      name: 'default',
      prompt: 'You are a helpful assistant...',
      tools: '*'
    };
  }
}
```

### Step 4: Integration with SystemBuilder (20 lines)

```typescript
// src/config/system-builder.ts
export class AgentSystemBuilder {
  private agentStore: AgentStore;

  withAgentStore(store: AgentStore): this {
    this.agentStore = store;
    return this;
  }

  // Backward compatible helper
  withAgentsFrom(path: string): this {
    this.agentStore = new FilesystemAgentStore(path);
    return this;
  }

  async build() {
    // Default to filesystem if not specified
    if (!this.agentStore) {
      this.agentStore = new FilesystemAgentStore('./agents');
    }

    const agentLoader = new AgentLoader(this.agentStore);
    // ... rest of build
  }
}
```

## Future Database Implementation (When Needed)

```typescript
// src/storage/database-agent-store.ts
export class DatabaseAgentStore implements AgentStore {
  constructor(private db: Database) {}

  async get(name: string): Promise<Agent | null> {
    const result = await this.db.query(
      'SELECT * FROM agents WHERE name = $1',
      [name]
    );
    return result.rows[0] || null;
  }

  async list(): Promise<string[]> {
    const result = await this.db.query(
      'SELECT name FROM agents ORDER BY name'
    );
    return result.rows.map(r => r.name);
  }
}
```

## What We're NOT Doing

1. **No Repository Pattern** - Just a simple store interface
2. **No Save/Delete** - Agents are managed outside the system
3. **No Complex Queries** - Just get by name and list
4. **No Tool Abstraction** - Tools stay as files
5. **No Config Abstraction** - Config stays as JSON/env
6. **No Migration Tools** - Not needed yet
7. **No Factory Pattern** - Direct instantiation is fine

## Implementation Plan: 2 Days

### Day 1: Morning
- Create `AgentStore` interface
- Implement `FilesystemAgentStore`
- Write unit tests

### Day 1: Afternoon
- Update `AgentLoader` to use store
- Update `AgentSystemBuilder`
- Ensure backward compatibility

### Day 2: Morning
- Test with existing examples
- Update documentation
- Performance testing

### Day 2: Afternoon
- Code review
- Merge to main
- Ship it

## Benefits of This Approach

1. **Minimal Changes**: ~200 lines of new code
2. **Backward Compatible**: Existing code continues working
3. **Testable**: Easy to mock `AgentStore`
4. **Future-Proof**: Can add database later
5. **Simple**: Anyone can understand it in 5 minutes

## Success Criteria

✅ All existing tests pass
✅ No breaking changes
✅ Can swap implementations via config
✅ Performance unchanged
✅ Code coverage maintained

## Example Usage

```typescript
// Current usage - still works
const builder = AgentSystemBuilder.default()
  .withAgentsFrom('./agents');

// New usage - explicit store
const store = new FilesystemAgentStore('./agents');
const builder = AgentSystemBuilder.default()
  .withAgentStore(store);

// Future database usage
const store = new DatabaseAgentStore(db);
const builder = AgentSystemBuilder.default()
  .withAgentStore(store);
```

## Testing Strategy

```typescript
// Easy to test with mock
class MockAgentStore implements AgentStore {
  private agents = new Map<string, Agent>();

  async get(name: string): Promise<Agent | null> {
    return this.agents.get(name) || null;
  }

  async list(): Promise<string[]> {
    return Array.from(this.agents.keys());
  }

  // Helper for tests
  addAgent(agent: Agent): void {
    this.agents.set(agent.name, agent);
  }
}
```

## Why This Is The Sweet Spot

1. **Solves the actual problem**: Decouples agent storage
2. **Doesn't over-engineer**: No unnecessary abstractions
3. **Ships quickly**: 2 days vs 4 weeks
4. **Easy to understand**: Junior dev can maintain it
5. **Room to grow**: Can extend when needed

## Decision Record

**We choose simplicity over flexibility because:**
- This is an MVP/POC system
- We don't have multiple users yet
- Filesystem works fine for current needs
- We can iterate based on real requirements

**We abstract agents only because:**
- They're the most likely to need database storage
- They're read-only in the system
- They're well-defined entities

**We keep everything else as-is because:**
- Tools need filesystem for execution
- Config is better as files/env
- Sessions already have good abstraction

## Next Steps

1. Implement this minimal abstraction
2. Ship and get feedback
3. Only add complexity when we hit real limitations
4. Consider database when we have:
   - Multiple users
   - Need for versioning
   - Performance issues
   - Complex queries

---

**Total Lines of Code: ~200**
**Implementation Time: 2 days**
**Maintenance Burden: Minimal**
**Future Flexibility: High**

This is the sweet spot.
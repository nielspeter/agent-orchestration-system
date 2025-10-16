# CLI and Web Integration Plan

## Decision: Keep Them Separate

The CLI and Web UI serve different purposes and should remain as separate execution paths with minimal coupling.

## Rationale

### Two Different User Personas

**CLI Users (Developers/Automation):**
- Quick execution
- Scriptable
- Terminal output
- CI/CD integration
- Fast iteration

**Web Users (Visual/Non-Technical):**
- Visual interface
- Real-time event streaming
- Team collaboration
- Learning/exploration
- Non-technical users

### Two Different Execution Modes

**CLI Execution:**
```bash
cli run -p "task"
# Agent runs in CLI process
# Output to terminal
# Session stored locally
# Fast, direct
```

**Web Execution:**
```bash
cli serve --open
# Web server starts
# Browser shows form
# User fills form, clicks "Start"
# Agent runs on server
# Events stream to browser via SSE
```

**These are fundamentally different workflows** - trying to merge them creates complexity without clear benefit.

## What We Will Build

### 1. CLI `serve` Command

Add ability for CLI to start the web server:

```bash
cli serve                    # Start web server on default port (3000)
cli serve --port 3001        # Custom port
cli serve --open             # Start server + open browser
cli serve --host 0.0.0.0     # Bind to all interfaces
```

**Purpose:**
- Single entry point for developers
- Easy demos and presentations
- Simplified onboarding ("just run `cli serve`")

### 2. Keep Web Standalone

Web can still be deployed independently:

```bash
# For production deployment
npm run build:web
node packages/web/server/dist/standalone.js

# For development
npm run dev:web
```

**Purpose:**
- Production deployments (Docker, cloud)
- Shared team instances
- Separate from CLI tool

## What We Will NOT Build

### ❌ "Demo" Mode
No special demo command. The web UI already provides the demo experience:
- Form to enter agent/prompt
- Visual execution
- Real-time events

Starting the server IS the demo.

### ❌ Connected Executions
CLI executions stay in CLI, Web executions stay in Web. No cross-visibility.

**Rationale:**
- Different use cases
- Different contexts
- Unnecessary complexity
- Session files already provide audit trail if needed

### ❌ CLI Watching Web Sessions
No `cli watch <session-id>` command to watch web executions from terminal.

**Rationale:**
- If you want visual, use the web
- If you want CLI, use CLI
- Don't mix concerns

## Implementation Plan

### Phase 1: Refactor Web Server (Make it Importable)

**Current state:**
```
packages/web/server/src/index.ts  → Runs express.listen() immediately
```

**New structure:**
```
packages/web/server/src/
  app.ts           → Export createApp() function (no listen)
  standalone.ts    → CLI script that calls createApp().listen()
  index.ts         → Export { createApp, startServer }
```

**Example:**
```typescript
// packages/web/server/src/app.ts
export function createApp(config?: WebServerConfig): Express {
  const app = express();
  // ... all middleware and routes ...
  return app;
}

// packages/web/server/src/index.ts
export { createApp } from './app';

export async function startServer(config: WebServerConfig = {}): Promise<Server> {
  const { port = 3000, host = 'localhost' } = config;
  const app = createApp(config);
  return new Promise((resolve) => {
    const server = app.listen(port, host, () => {
      console.log(`Server running at http://${host}:${port}`);
      resolve(server);
    });
  });
}

// packages/web/server/src/standalone.ts (for npm scripts)
#!/usr/bin/env node
import { startServer } from './index';
startServer({ port: 3000 });
```

### Phase 2: Add CLI `serve` Command

**New file:**
```
packages/cli/src/commands/serve.ts
```

**Implementation:**
```typescript
import { startServer } from '@agent-system/web/server';
import open from 'open';

export interface ServeOptions {
  port?: number;
  host?: string;
  open?: boolean;
}

export async function serveCommand(options: ServeOptions) {
  const { port = 3000, host = 'localhost', open: shouldOpen = false } = options;

  console.log(`Starting web server...`);

  try {
    await startServer({ port, host });

    const url = `http://${host}:${port}`;
    console.log(`\n✅ Server running at ${url}`);
    console.log(`\n📝 Open your browser and use the form to start agents`);

    if (shouldOpen) {
      await open(url);
      console.log('📱 Opened browser automatically');
    }

    console.log('\nPress Ctrl+C to stop\n');

    // Keep process alive
    await new Promise(() => {}); // Never resolves

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}
```

**CLI router update:**
```typescript
// packages/cli/src/index.ts
import { serveCommand } from './commands/serve';

const program = new Command();

program
  .name('cli')
  .description('Agent orchestration CLI');

program
  .command('run')
  .description('Execute an agent task')
  .option('-p, --prompt <prompt>', 'Task prompt')
  .option('-a, --agent <agent>', 'Agent path', 'agents/default.md')
  .action(runCommand);

program
  .command('serve')
  .description('Start web UI server')
  .option('-p, --port <port>', 'Port number', '3000')
  .option('--host <host>', 'Hostname', 'localhost')
  .option('-o, --open', 'Open browser automatically', false)
  .action(serveCommand);

program.parse();
```

### Phase 3: Update Dependencies

**packages/cli/package.json:**
```json
{
  "dependencies": {
    "@agent-system/core": "*",
    "@agent-system/web": "*",  // Add web server dependency
    "commander": "^12.0.0",
    "open": "^10.0.0"  // For --open flag
  }
}
```

**Note:** CLI only depends on `web/server`, not `web/client` (React app).

### Phase 4: Update Documentation

**Update CLAUDE.md:**
```bash
# Development
npm run cli -- run -p "test"     # CLI execution
npm run cli -- serve --open      # Start web UI

# Or when installed globally
cli run -p "test"                # CLI execution
cli serve --open                 # Start web UI
```

**Update README.md:**
```markdown
## Quick Start

### CLI Mode (Fast, for developers)
\`\`\`bash
npm run cli -- run -p "Analyze the codebase"
\`\`\`

### Web UI Mode (Visual, for everyone)
\`\`\`bash
npm run cli -- serve --open
# Fill the form, click Start, watch execution in real-time
\`\`\`
```

**Create new doc:**
```
docs/cli-vs-web.md  → Explains when to use each mode
```

### Phase 5: Update npm Scripts

**Root package.json:**
```json
{
  "scripts": {
    "cli": "tsx packages/cli/src/index.ts",
    "cli:serve": "npm run cli -- serve --open",
    "web": "npm run dev:web",  // Alias for backwards compatibility
    "dev:web": "concurrently \"npm run dev -w @agent-system/web-client\" \"npm run serve -w @agent-system/web-server\""
  }
}
```

## Usage Patterns

### Development Workflow

**Quick CLI task:**
```bash
npm run cli -- run -p "analyze this"
# Fast, terminal output, done
```

**Visual debugging:**
```bash
npm run cli -- serve --open
# Browser opens, fill form, watch execution
```

**Long-running web instance:**
```bash
npm run dev:web
# Traditional web dev: Vite HMR + Express server
```

### Demo/Presentation

```bash
# One command
npm run cli -- serve --open

# Or simpler alias
npm run cli:serve
```

Presenter opens browser, shows form, enters agent + prompt, clicks Start, audience watches.

### Production Deployment

**Option 1: Via CLI**
```bash
cli serve --port 80 --host 0.0.0.0
```

**Option 2: Direct server**
```bash
node packages/web/server/dist/standalone.js
```

**Option 3: Docker**
```dockerfile
FROM node:20
WORKDIR /app
COPY packages/web/server/dist ./
CMD ["node", "standalone.js"]
```

### CI/CD

**CLI for automation:**
```bash
cli run -p "test task" --output json > result.json
```

**Web for integration tests:**
```bash
# Start server
cli serve --port 3001 &
SERVER_PID=$!

# Run tests against web API
npm run test:integration:web

# Cleanup
kill $SERVER_PID
```

## Benefits

### ✅ Single Entry Point
- `cli` command does everything
- Easier to remember
- Better DX

### ✅ Flexibility
- CLI-only deployment (lightweight)
- Web-only deployment (cloud)
- Combined (local dev)

### ✅ Clear Separation
- CLI = execute agents directly
- Web = start server for UI-based execution
- No confusion about which mode you're in

### ✅ Familiar Pattern
Similar to:
- Jupyter: `jupyter notebook` starts web UI
- Playwright: `playwright show-report` starts web UI
- Next.js: `next dev` starts web UI
- Vite: `vite` starts web UI

## Non-Goals

### Not Building
- ❌ Connected executions (CLI visible in Web)
- ❌ Demo mode with pre-configured agents
- ❌ CLI watching web sessions
- ❌ Shared execution context
- ❌ CLI-to-Web or Web-to-CLI tunneling

### Why Not
These add complexity without clear value. The two modes serve different needs:
- **CLI**: Fast, scriptable, terminal-focused
- **Web**: Visual, collaborative, browser-focused

Keeping them separate is simpler and clearer.

## Migration Path

### Current Users
```bash
# Before
npm run dev:web

# After (both work)
npm run dev:web        # Still works
npm run cli -- serve   # New way
```

No breaking changes - we're adding capability, not removing.

### Future
Once `cli serve` is stable, we can:
1. Document it as the recommended way
2. Keep `npm run dev:web` for Vite HMR during web development
3. Eventually simplify to just `cli serve` for normal usage

## Implementation Checklist

- [ ] Phase 1: Refactor web server (createApp + startServer)
- [ ] Phase 2: Add CLI serve command
- [ ] Phase 3: Update dependencies (add 'open' package)
- [ ] Phase 4: Update documentation (CLAUDE.md, README.md)
- [ ] Phase 5: Update npm scripts (add cli:serve alias)
- [ ] Testing: Verify both modes work independently
- [ ] Testing: Verify standalone web deployment still works
- [ ] Documentation: Create cli-vs-web.md guide

## Success Criteria

✅ **Developer onboarding:**
```bash
# Clone repo
git clone ...
npm install

# Try CLI
npm run cli -- run -p "hello"

# Try Web
npm run cli -- serve --open
# Browser opens, form appears, works
```

✅ **Production deployment:**
```bash
# CLI-only
cli run -p "task"

# Web-only
node packages/web/server/dist/standalone.js

# Combined
cli serve --host 0.0.0.0 --port 80
```

✅ **Clear documentation:**
- Users understand when to use CLI vs Web
- Users understand how to start each mode
- Users understand they're separate execution paths

## Timeline

**Phase 1-2:** 2-3 hours (refactor + CLI command)
**Phase 3-5:** 1-2 hours (dependencies + docs + scripts)
**Testing:** 1 hour
**Total:** ~Half day of focused work

## Questions Resolved

**Q: Should CLI and Web be connected?**
A: No, keep them separate.

**Q: Should we have a "demo" mode?**
A: No, `cli serve --open` is the demo.

**Q: Can web run without CLI?**
A: Yes, via standalone server or `npm run dev:web`.

**Q: Can CLI run without web?**
A: Yes, `cli run` is completely independent.

**Q: What happens when user runs web without agent?**
A: Normal - web shows form, user enters agent + prompt, clicks Start.

## Conclusion

**Simple, clean separation:**
- CLI = developer tool (fast, scriptable, terminal)
- Web = visual tool (browser, real-time, collaboration)
- `cli serve` = convenience bridge (developers can start web easily)

No magic, no confusion, just two clear modes for two different needs.

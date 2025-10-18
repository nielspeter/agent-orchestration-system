# Skills Architecture Design

**Version:** 1.0
**Date:** 2025-10-18

## Overview

This document describes the technical architecture for Skills in the agent orchestration system.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ AgentExecutor                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ AgentLoader  │  │ SkillRegistry│  │ ToolRegistry │    │
│  │ ↓            │  │ ↓            │  │ ↓            │    │
│  │ agents/      │  │ skills/      │  │ src/tools/   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│          ↓                ↓                    ↓           │
│  ┌──────────────────────────────────────────────────┐     │
│  │ MiddlewarePipeline                              │     │
│  │  - ContextSetup (agent + skills → prompt)       │     │
│  │  - LLMCall                                      │     │
│  │  - ToolExecution                                │     │
│  └──────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

### Skills Directory Layout

```
skills/
├── danish-tender-guidelines/
│   ├── SKILL.md                    # Main skill definition
│   ├── templates/
│   │   ├── TEKNISK-ANALYSE.md      # Output template
│   │   └── checklist.md            # Validation checklist
│   ├── scripts/                    # Optional: executable code
│   │   ├── calculate_deadline.js
│   │   └── validate_format.js
│   ├── schemas/                    # Optional: validation schemas
│   │   └── tender_schema.json
│   └── examples/                   # Optional: reference data
│       └── sample_tender.md
│
├── complexity-calculator/
│   ├── SKILL.md
│   └── scripts/
│       └── estimate_effort.js
│
└── architecture-analyzer/
    ├── SKILL.md
    └── templates/
        └── architecture_report.md
```

### SKILL.md Format

```yaml
---
name: danish-tender-guidelines
version: 1.0.0
description: Danish public tender compliance rules and formatting guidelines
tags: [tender, danish, compliance, formatting]
capabilities: [validation, formatting, deadline-calculation]
author: Niels Peter
created: 2025-10-18
updated: 2025-10-18
---

# Danish Tender Guidelines

This skill provides expertise in Danish public tender (offentlig udbud) requirements.

## Required Markers

All analysis must use these markers for transparency:
- **[FAKTA]** - Direct from tender material with source
- **[ESTIMAT]** - Your calculations/assessments
- **[ANTAGET]** - Assumptions where data is missing
- **[UKENDT]** - Information not in material
- **[INTERN VURDERING PÅKRÆVET]** - Requires internal assessment

## Output Format

Analysis documents must follow this structure:
[Template details...]

## Deadline Calculation

Use the provided script for accurate deadline calculation:
```javascript
// Available in scripts/calculate_deadline.js
function calculateDeadline(submissionDate, bufferDays) {
  // Implementation...
}
```

## Validation

Before finalizing, validate against:
- All required sections present
- All markers properly used
- Deadline calculations verified
```

## Core Interfaces

### Skill Interface

```typescript
/**
 * A skill is a domain expertise package
 */
interface Skill {
  /** Unique skill identifier (from frontmatter) */
  name: string;

  /** Semantic version (1.0.0) */
  version: string;

  /** Human-readable description */
  description: string;

  /** Tags for discovery and filtering */
  tags: string[];

  /** Capabilities this skill provides */
  capabilities: string[];

  /** Main instructions (markdown content from SKILL.md) */
  instructions: string;

  /** Optional: Templates loaded from templates/ directory */
  templates?: Record<string, string>;

  /** Optional: Scripts loaded from scripts/ directory */
  scripts?: Record<string, string>;

  /** Optional: Schemas loaded from schemas/ directory */
  schemas?: Record<string, unknown>;

  /** Optional: Examples loaded from examples/ directory */
  examples?: Record<string, string>;

  /** Metadata for tracking */
  metadata: {
    author?: string;
    created?: string;
    updated?: string;
    path: string;  // Filesystem path to skill directory
  };
}

/**
 * Skill configuration in agent frontmatter
 */
interface AgentSkillConfig {
  /** Array of skill names to load */
  skills?: string[];
}

/**
 * Extended Agent interface with skills support
 */
interface Agent extends AgentSkillConfig {
  name: string;
  model?: string;
  tools?: string[] | '*';
  thinking?: boolean | ThinkingConfig;
  // ... existing fields

  /** Skills referenced by this agent */
  skills?: string[];
}
```

### SkillRegistry Class

```typescript
/**
 * Central registry for all available skills
 *
 * Responsibilities:
 * - Load skills from filesystem
 * - Provide skill lookup by name
 * - Support skill discovery (tags, capabilities)
 */
export class SkillRegistry {
  private skills = new Map<string, Skill>();
  private skillsDir: string;
  private logger?: AgentLogger;

  constructor(skillsDir: string, logger?: AgentLogger) {
    this.skillsDir = skillsDir;
    this.logger = logger;
  }

  /**
   * Load all skills from the skills directory
   */
  async loadSkills(): Promise<void> {
    // 1. Scan skillsDir for subdirectories
    // 2. For each subdirectory, check for SKILL.md
    // 3. Load skill using SkillLoader
    // 4. Register in skills map
  }

  /**
   * Get a skill by name
   */
  getSkill(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  /**
   * List all available skills
   */
  listSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Find skills by tags
   */
  findByTags(tags: string[]): Skill[] {
    return this.listSkills().filter(skill =>
      tags.some(tag => skill.tags.includes(tag))
    );
  }

  /**
   * Find skills by capabilities
   */
  findByCapabilities(capabilities: string[]): Skill[] {
    return this.listSkills().filter(skill =>
      capabilities.some(cap => skill.capabilities.includes(cap))
    );
  }

  /**
   * Register a skill programmatically (for testing, inline skills)
   */
  registerSkill(skill: Skill): void {
    this.skills.set(skill.name, skill);
  }
}
```

### SkillLoader Class

```typescript
/**
 * Loads individual skills from filesystem
 *
 * Handles:
 * - Parsing SKILL.md (frontmatter + markdown)
 * - Loading resource files (templates, scripts, schemas)
 * - Validation
 */
export class SkillLoader {
  private logger?: AgentLogger;

  constructor(logger?: AgentLogger) {
    this.logger = logger;
  }

  /**
   * Load a skill from a directory
   */
  async loadSkill(skillPath: string): Promise<Skill> {
    // 1. Check for SKILL.md
    const skillFile = path.join(skillPath, 'SKILL.md');
    if (!fs.existsSync(skillFile)) {
      throw new Error(`No SKILL.md found in ${skillPath}`);
    }

    // 2. Parse SKILL.md (frontmatter + content)
    const content = await fs.promises.readFile(skillFile, 'utf-8');
    const parsed = matter(content);

    // 3. Validate frontmatter
    const validated = validateSkillFrontmatter(parsed.data);

    // 4. Load resources
    const templates = await this.loadTemplates(skillPath);
    const scripts = await this.loadScripts(skillPath);
    const schemas = await this.loadSchemas(skillPath);
    const examples = await this.loadExamples(skillPath);

    // 5. Construct Skill object
    return {
      name: validated.name,
      version: validated.version,
      description: validated.description,
      tags: validated.tags || [],
      capabilities: validated.capabilities || [],
      instructions: parsed.content,
      templates,
      scripts,
      schemas,
      examples,
      metadata: {
        author: validated.author,
        created: validated.created,
        updated: validated.updated,
        path: skillPath,
      },
    };
  }

  /**
   * Load template files from templates/ subdirectory
   */
  private async loadTemplates(skillPath: string): Promise<Record<string, string>> {
    const templatesDir = path.join(skillPath, 'templates');
    if (!fs.existsSync(templatesDir)) {
      return {};
    }

    const templates: Record<string, string> = {};
    const files = await fs.promises.readdir(templatesDir);

    for (const file of files) {
      const content = await fs.promises.readFile(
        path.join(templatesDir, file),
        'utf-8'
      );
      templates[file] = content;
    }

    return templates;
  }

  /**
   * Load script files from scripts/ subdirectory
   */
  private async loadScripts(skillPath: string): Promise<Record<string, string>> {
    const scriptsDir = path.join(skillPath, 'scripts');
    if (!fs.existsSync(scriptsDir)) {
      return {};
    }

    const scripts: Record<string, string> = {};
    const files = await fs.promises.readdir(scriptsDir);

    for (const file of files) {
      const content = await fs.promises.readFile(
        path.join(scriptsDir, file),
        'utf-8'
      );
      scripts[file] = content;
    }

    return scripts;
  }

  // Similar methods for schemas, examples...
}
```

## Integration with AgentExecutor

### Phase 1: Static Loading (v1)

In v1, skills are loaded when the agent starts (specified in frontmatter).

```typescript
// In AgentExecutor.execute()

async execute(prompt: string, context: ExecutionContext): Promise<string> {
  // 1. Load agent (existing)
  const agent = await this.agentLoader.loadAgent(this.agentName);

  // 2. Load skills (NEW)
  const skills: Skill[] = [];
  if (agent.skills && agent.skills.length > 0) {
    for (const skillName of agent.skills) {
      const skill = this.skillRegistry.getSkill(skillName);
      if (!skill) {
        this.logger.logSystemMessage(`Warning: Skill '${skillName}' not found`);
        continue;
      }
      skills.push(skill);
      this.logger.logSystemMessage(`Loaded skill: ${skillName} v${skill.version}`);
    }
  }

  // 3. Setup middleware context
  const middlewareContext: MiddlewareContext = {
    agentName: this.agentName,
    agent,        // Agent definition
    skills,       // NEW: Loaded skills
    prompt,
    // ... rest of context
  };

  // 4. Execute middleware pipeline (existing)
  await this.pipeline.execute(middlewareContext, async () => {});

  return middlewareContext.result || '';
}
```

### Context Setup Middleware Changes

```typescript
// In ContextSetupMiddleware

async execute(ctx: MiddlewareContext, next: () => Promise<void>): Promise<void> {
  // 1. Build system prompt from agent
  let systemPrompt = ctx.agent.instructions;

  // 2. Append skills (NEW)
  if (ctx.skills && ctx.skills.length > 0) {
    systemPrompt += '\n\n# Available Skills\n\n';
    systemPrompt += 'You have access to the following domain expertise:\n\n';

    for (const skill of ctx.skills) {
      systemPrompt += `## ${skill.name} (${skill.description})\n\n`;
      systemPrompt += skill.instructions;
      systemPrompt += '\n\n';

      // Add available templates
      if (skill.templates && Object.keys(skill.templates).length > 0) {
        systemPrompt += `**Available templates:** ${Object.keys(skill.templates).join(', ')}\n\n`;
      }
    }
  }

  // 3. Create initial message
  ctx.messages = [
    {
      role: 'user',
      content: systemPrompt,
    },
    {
      role: 'assistant',
      content: 'Understood. I will use the provided skills when relevant to the task.',
    },
    {
      role: 'user',
      content: ctx.prompt,
    },
  ];

  await next();
}
```

## Backward Compatibility

**Critical:** Skills are 100% backward compatible. Existing agents work unchanged.

```yaml
# Old agent (no skills) - still works
---
name: my-agent
tools: [read, write]
---

You are an agent...
```

```yaml
# New agent (with skills) - enhanced
---
name: my-agent
tools: [read, write]
skills: [domain-expertise]
---

You are an agent...
```

If `skills` field is missing or empty, agent behaves exactly as before.

## Resource Loading Strategy

### v1: Eager Loading (Simple)

All skill resources loaded at agent startup:
- ✅ Simple implementation
- ✅ No additional logic needed
- ❌ Loads all templates/scripts even if unused
- ❌ Slower agent startup

```typescript
// Load everything upfront
const skill = await skillLoader.loadSkill(skillPath);
// skill.templates already populated
// skill.scripts already populated
```

### v2: Lazy Loading (Optimized)

Resources loaded on demand:
- ✅ Faster agent startup
- ✅ Lower memory usage
- ❌ More complex implementation
- ❌ Need resource accessor methods

```typescript
// Load metadata only
const skill = await skillLoader.loadSkillMetadata(skillPath);

// Load resources when accessed
const template = await skill.getTemplate('report.md');
```

**Decision:** Start with v1 (eager loading), optimize to v2 if needed.

## Script Execution (Future)

Skills can include executable scripts for deterministic logic.

### Security Requirements

1. **Explicit Opt-In** - Scripts disabled by default
2. **Sandboxing** - Scripts run in isolated environment
3. **Timeout** - Scripts must complete within time limit
4. **No Network** - Scripts cannot make network calls
5. **No File System** - Scripts cannot access filesystem directly

### Implementation Options

**Option 1: vm2 module**
```typescript
import { VM } from 'vm2';

const vm = new VM({
  timeout: 5000,
  sandbox: { input: skillInput },
});

const result = vm.run(skill.scripts['calculate.js']);
```

**Option 2: Isolated Node process**
```typescript
import { fork } from 'child_process';

const child = fork('skill-runner.js', [], {
  stdio: 'pipe',
  timeout: 5000,
});

child.send({ script: skill.scripts['calculate.js'], input: skillInput });
```

**Decision:** Defer to v2+ based on user demand.

## Validation

### Skill Frontmatter Schema

```typescript
import { z } from 'zod';

export const SkillFrontmatterSchema = z.object({
  name: z.string().min(1, 'Skill name is required'),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be semver (e.g., 1.0.0)'),
  description: z.string().min(1, 'Description is required'),
  tags: z.array(z.string()).optional(),
  capabilities: z.array(z.string()).optional(),
  author: z.string().optional(),
  created: z.string().optional(),
  updated: z.string().optional(),
});

export function validateSkillFrontmatter(data: unknown): z.infer<typeof SkillFrontmatterSchema> {
  try {
    return SkillFrontmatterSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.errors.map(e => `  - ${e.path.join('.')}: ${e.message}`).join('\n');
      throw new Error(`Invalid skill frontmatter:\n${issues}`);
    }
    throw error;
  }
}
```

### Agent Skills Reference Validation

```typescript
// Extend AgentFrontmatterSchema
export const AgentFrontmatterSchema = z.object({
  // ... existing fields
  skills: z.array(z.string()).optional(),
});

// Validate at agent load time
if (agent.skills) {
  for (const skillName of agent.skills) {
    const skill = skillRegistry.getSkill(skillName);
    if (!skill) {
      throw new Error(`Agent '${agent.name}' references unknown skill: ${skillName}`);
    }
  }
}
```

## Error Handling

### Graceful Degradation

If a skill fails to load, agent should continue without it:

```typescript
// Load skills with error handling
const skills: Skill[] = [];
for (const skillName of agent.skills || []) {
  try {
    const skill = skillRegistry.getSkill(skillName);
    if (!skill) {
      logger.logSystemMessage(`Warning: Skill '${skillName}' not found`);
      continue;
    }
    skills.push(skill);
  } catch (error) {
    logger.logSystemMessage(`Error loading skill '${skillName}': ${error.message}`);
    // Continue without this skill
  }
}
```

### Validation Errors

Invalid skill frontmatter should fail loudly:

```typescript
// During skill loading
try {
  const validated = validateSkillFrontmatter(parsed.data);
} catch (error) {
  throw new Error(`Failed to load skill from ${skillPath}: ${error.message}`);
}
```

## Testing Strategy

### Unit Tests

```typescript
describe('SkillLoader', () => {
  it('should load skill with valid frontmatter', async () => {
    const skill = await skillLoader.loadSkill('test-fixtures/skills/valid-skill');
    expect(skill.name).toBe('test-skill');
    expect(skill.version).toBe('1.0.0');
  });

  it('should load templates from templates/ directory', async () => {
    const skill = await skillLoader.loadSkill('test-fixtures/skills/with-templates');
    expect(skill.templates).toHaveProperty('report.md');
  });

  it('should throw error for missing SKILL.md', async () => {
    await expect(skillLoader.loadSkill('test-fixtures/skills/no-skill-file'))
      .rejects.toThrow('No SKILL.md found');
  });
});

describe('SkillRegistry', () => {
  it('should register and retrieve skills', async () => {
    await registry.loadSkills('test-fixtures/skills');
    const skill = registry.getSkill('test-skill');
    expect(skill).toBeDefined();
  });

  it('should find skills by tags', () => {
    const skills = registry.findByTags(['danish', 'tender']);
    expect(skills.length).toBeGreaterThan(0);
  });
});
```

### Integration Tests

```typescript
describe('Agent with Skills', () => {
  it('should load skills specified in agent frontmatter', async () => {
    const agent = await agentLoader.loadAgent('technical-analyst');
    expect(agent.skills).toContain('danish-tender-guidelines');

    const skill = skillRegistry.getSkill('danish-tender-guidelines');
    expect(skill).toBeDefined();
  });

  it('should include skill instructions in system prompt', async () => {
    const result = await executor.execute('Analyze this tender');
    // Verify skill knowledge was used
  });
});
```

## Performance Considerations

### Skill Loading Performance

- **Target:** Skill loading adds <100ms per agent invocation
- **Measurement:** Track time from agent start to first LLM call
- **Optimization:** Cache parsed skills in memory (SkillRegistry)

### Context Size Impact

- **Risk:** Multiple skills inflate context size
- **Mitigation:**
  - Load only relevant skills (lazy loading in v2)
  - Monitor context size per agent
  - Set maximum skills per agent (e.g., 5)

### Memory Usage

- **Concern:** Loaded skills consume memory
- **Mitigation:**
  - Skills stored once in SkillRegistry
  - Agents reference skills (no duplication)
  - Lazy load resources (templates, scripts)

## Future Enhancements

### Phase 2: Dynamic Loading

Skills loaded based on task analysis:

```typescript
// Analyze task, load relevant skills
const relevantSkills = await skillDiscovery.findRelevantSkills(prompt);
```

### Phase 3: Skill Composition

Skills can depend on other skills:

```yaml
---
name: advanced-tender-analysis
depends: [danish-tender-guidelines, complexity-calculator]
---
```

### Phase 4: Skill Marketplace

Public registry for sharing skills:

```bash
# Install skill from registry
npm run skill:install @tender/danish-compliance
```

## Migration Path

### Existing Agents → Skills

1. **Identify domain knowledge** in agent markdown
2. **Extract to skill** (create SKILL.md)
3. **Update agent** to reference skill
4. **Test** to ensure behavior unchanged
5. **Remove duplicated knowledge** from agent

Example:

```yaml
# Before (technical-analyst.md)
---
name: technical-analyst
tools: [read, write, grep]
---

You analyze tender materials...

## Danish Tender Requirements
[60 lines of Danish rules]
```

```yaml
# After (technical-analyst.md)
---
name: technical-analyst
tools: [read, write, grep]
skills: [danish-tender-guidelines]
---

You analyze tender materials...
```

```yaml
# New (skills/danish-tender-guidelines/SKILL.md)
---
name: danish-tender-guidelines
version: 1.0.0
description: Danish public tender compliance
---

## Danish Tender Requirements
[60 lines of Danish rules]
```

**Result:** Same behavior, but rules in one place.

## Appendix: File Locations

```
packages/core/
├── src/
│   ├── skills/
│   │   ├── index.ts                 # Public exports
│   │   ├── types.ts                 # Skill interface
│   │   ├── registry.ts              # SkillRegistry class
│   │   ├── loader.ts                # SkillLoader class
│   │   └── validation.ts            # Zod schemas
│   ├── agents/
│   │   └── loader.ts                # Update to support skills
│   └── middleware/
│       └── context-setup.middleware.ts  # Update to inject skills
├── tests/
│   └── unit/
│       └── skills/
│           ├── loader.test.ts
│           ├── registry.test.ts
│           └── validation.test.ts
└── skills/                          # Sample skills
    └── danish-tender-guidelines/
        └── SKILL.md

packages/examples/
└── udbud/
    └── skills/                      # Example-specific skills
        ├── danish-tender-guidelines/
        ├── complexity-calculator/
        └── architecture-analyzer/
```

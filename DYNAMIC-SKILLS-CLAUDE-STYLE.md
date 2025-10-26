# Dynamic Skills Implementation - Claude Code Style

**Branch:** feature/skills-dynamic
**Date:** 2025-10-26
**Approach:** Manual loading only (Claude Code pattern)
**Philosophy:** Agent autonomy and explicit control

---

## Table of Contents

1. [Core Concept](#core-concept)
2. [Architecture Design](#architecture-design)
3. [Implementation Plan](#implementation-plan)
4. [Technical Specification](#technical-specification)
5. [Agent Migration Strategy](#agent-migration-strategy)
6. [Test Strategy](#test-strategy)
7. [Success Criteria](#success-criteria)

---

## Core Concept

### The Claude Code Way

**Skills are tools for loading knowledge** - just like any other tool, but for information rather than actions.

```typescript
// How Claude Code does it
Agent: "I need specialized knowledge for this task"
Agent: skill({name: "domain-expertise"})
System: [Returns skill content as tool result]
Agent: [Uses knowledge to complete task]
```

**Key principles:**
1. **Agent decides** - The agent determines what knowledge it needs
2. **Explicit loading** - Clear skill() calls in conversation
3. **Just-in-time** - Load only when needed
4. **Cache once** - Load once per conversation
5. **Simple mechanism** - No magic, no auto-loading

### Why This Approach

**Simplicity:**
- No pattern matching complexity
- No auto-trigger edge cases
- No configuration needed
- Easy to debug (see skill calls)

**Agent Autonomy:**
- Agent controls its knowledge
- Learns when to load skills
- Adapts to different tasks
- More human-like behavior

**Clarity:**
- Explicit is better than implicit
- Can trace skill usage
- Predictable behavior
- No surprises

---

## Architecture Design

### System Flow

```mermaid
graph TB
    Start[Agent Receives Task] --> Analyze[Agent Analyzes Task]
    Analyze --> Decision{Need Domain Knowledge?}

    Decision -->|No| Proceed[Proceed with Task]
    Decision -->|Yes| CallSkill[Call skill() tool]

    CallSkill --> CheckCache{In Cache?}
    CheckCache -->|Yes| ReturnCached[Return Cached Skill]
    CheckCache -->|No| LoadSkill[Load from Registry]

    LoadSkill --> CacheSkill[Cache for Conversation]
    CacheSkill --> ReturnSkill[Return as Tool Result]
    ReturnCached --> ReturnSkill

    ReturnSkill --> UseKnowledge[Agent Uses Knowledge]
    Proceed --> Complete[Complete Task]
    UseKnowledge --> Complete
```

### Component Architecture

```
┌─────────────────────────────────────────┐
│           Agent Execution               │
├─────────────────────────────────────────┤
│                                         │
│  Agent Instructions                     │
│  "You have access to skill tool..."     │
│                    ↓                    │
│         Decides to load skill          │
│                    ↓                    │
│         skill({name: "..."})           │
│                    ↓                    │
├─────────────────────────────────────────┤
│              SkillTool                  │
├─────────────────────────────────────────┤
│                                         │
│  1. Check SkillCache                   │
│  2. Load from SkillRegistry            │
│  3. Cache for conversation             │
│  4. Return formatted content           │
│                                         │
├─────────────────────────────────────────┤
│          SkillRegistry                  │
├─────────────────────────────────────────┤
│                                         │
│  - getSkill(name): Single skill        │
│  - listSkills(): For catalog           │
│  - Lazy load resources                 │
│                                         │
└─────────────────────────────────────────┘
```

### Key Components

**1. SkillTool**
- Registered like any other tool
- Appears in agent's available tools
- Returns skill content as text
- Includes resource discovery

**2. SkillCache**
- Per-conversation caching
- Prevents redundant loads
- Memory efficient
- Auto-expiry after 1 hour

**3. SkillRegistry**
- Already exists (modify)
- Add single skill getter
- Generate skill catalog
- Lazy resource loading

**4. Agent Instructions**
- Clear guidance on when to load
- List of available skills
- Examples of usage
- Part of agent prompt

---

## Implementation Plan

### Total Effort: 16 hours (2 days)

### Phase 1: Core Infrastructure (6 hours)

#### 1.1 Create SkillCache (1 hour)
```typescript
// packages/core/src/skills/cache.ts
export class SkillCache {
  get(conversationId: string, skillName: string): Skill | undefined;
  set(conversationId: string, skillName: string, skill: Skill): void;
  clear(conversationId?: string): void;
}
```

**Tasks:**
- [ ] Create cache class
- [ ] Implement TTL (1 hour)
- [ ] Add conversation isolation
- [ ] Write unit tests

#### 1.2 Create SkillTool (3 hours)
```typescript
// packages/core/src/tools/builtin/skill.tool.ts
export class SkillTool extends BaseTool {
  name = 'skill';
  description = 'Load domain expertise...';

  async execute(input: {name: string}): Promise<ToolResult> {
    // Check cache → Load skill → Cache it → Return
  }
}
```

**Tasks:**
- [ ] Create tool class
- [ ] Implement execute method
- [ ] Add dynamic catalog to description
- [ ] Format output with resources
- [ ] Handle errors gracefully
- [ ] Write comprehensive tests

#### 1.3 Update SkillRegistry (1 hour)
```typescript
// Add to existing registry
getSkill(name: string): Skill | undefined;
listSkills(): SkillMetadata[];
```

**Tasks:**
- [ ] Add single skill getter
- [ ] Add skill listing for catalog
- [ ] Ensure lazy loading works
- [ ] Update tests

#### 1.4 Register SkillTool (1 hour)
```typescript
// packages/core/src/config/system-builder.ts
private registerBuiltInTools(): void {
  // ... existing tools ...
  this.toolRegistry.registerTool(new SkillTool(this.skillRegistry));
}
```

**Tasks:**
- [ ] Wire into system builder
- [ ] Add to default tools
- [ ] Pass skill registry
- [ ] Test registration

### Phase 2: Remove Static Loading (4 hours)

#### 2.1 Clean Agent Schema (1 hour)
```typescript
// packages/core/src/agents/validation.ts
// Remove skills field from AgentFrontmatterSchema
```

**Tasks:**
- [ ] Remove skills from schema
- [ ] Update validation
- [ ] Update TypeScript types
- [ ] Fix any type errors

#### 2.2 Clean AgentLoader (1 hour)
```typescript
// packages/core/src/agents/loader.ts
// Remove all skill loading logic
```

**Tasks:**
- [ ] Remove loadedSkills code
- [ ] Remove skill loading
- [ ] Simplify loadAgent
- [ ] Update tests

#### 2.3 Clean Middleware (1 hour)
```typescript
// packages/core/src/middleware/context-setup.middleware.ts
// Remove skill injection block
```

**Tasks:**
- [ ] Remove skill injection
- [ ] Simplify system prompt
- [ ] Clean up code
- [ ] Update tests

#### 2.4 Clean Logging (1 hour)
```typescript
// Remove skills parameter from all loggers
```

**Tasks:**
- [ ] Update logging types
- [ ] Update all implementations
- [ ] Remove from events
- [ ] Fix tests

### Phase 3: Agent Migration (4 hours)

#### 3.1 Update Agent Frontmatter (1 hour)
```yaml
# Before
---
name: technical-analyst
tools: [read, write, grep]
skills:
  - danish-tender-guidelines
---

# After
---
name: technical-analyst
tools: [read, write, grep, skill]
---
```

**All 4 agents:**
- [ ] tender-orchestrator.md
- [ ] technical-analyst.md
- [ ] go-no-go-analyzer.md
- [ ] compliance-checker.md

#### 3.2 Update Agent Instructions (3 hours)

**New instruction template:**
```markdown
## Domain Knowledge System

You have access to specialized domain knowledge through the `skill` tool.

### Available Skills

- **danish-tender-guidelines**: Danish public tender compliance rules
  Use when: Analyzing Danish tenders, compliance checking

- **complexity-calculator**: Software estimation methodology
  Use when: Estimating effort, calculating complexity

- **architecture-analyzer**: System design patterns
  Use when: Evaluating architecture, design decisions

### How to Load Skills

When you need domain knowledge:
1. Identify which skill contains relevant expertise
2. Load it: skill({name: "skill-name"})
3. The skill's instructions will be returned
4. Apply the knowledge to your task

### Examples

**Example 1: Danish Tender Analysis**
```
User: "Analyze this Danish tender"
You: First, I'll load Danish tender guidelines
You: skill({name: "danish-tender-guidelines"})
System: [Returns guidelines]
You: Now I'll apply these compliance rules...
```

**Example 2: Complexity Estimation**
```
User: "Estimate the effort for this project"
You: I'll load the complexity calculator
You: skill({name: "complexity-calculator"})
System: [Returns methodology]
You: Using the estimation formulas...
```

### When to Load Skills

Load skills when:
- The task mentions specific domains (Danish, tender, complexity)
- You need specialized methodologies
- You require compliance rules or standards
- Templates or formulas would help

Don't load skills for:
- Simple file operations
- Basic analysis tasks
- General programming questions
```

**Apply to all 4 agents with role-specific adjustments**

### Phase 4: Testing & Validation (2 hours)

#### 4.1 Unit Tests (1 hour)
- [ ] SkillTool tests (load, cache, errors)
- [ ] SkillCache tests (get, set, clear)
- [ ] SkillRegistry tests (new methods)
- [ ] Coverage >95%

#### 4.2 Integration Tests (1 hour)
- [ ] Agent loads skill successfully
- [ ] Cache works across turns
- [ ] Multiple skills in conversation
- [ ] Error handling works

---

## Technical Specification

### SkillTool Implementation

```typescript
import { BaseTool, ToolResult } from '@/tools/base-tool';
import { SkillRegistry } from '@/skills/registry';
import { SkillCache } from '@/skills/cache';

export class SkillTool extends BaseTool {
  public readonly name = 'skill';
  public readonly description: string;
  private cache: SkillCache;

  constructor(
    private skillRegistry: SkillRegistry,
    private conversationId?: string
  ) {
    super();
    this.cache = new SkillCache();
    this.description = this.generateDescription();
  }

  private generateDescription(): string {
    const skills = this.skillRegistry.listSkills();
    const catalog = skills
      .map(s => `  - ${s.name}: ${s.description}`)
      .join('\n');

    return `Load specialized domain knowledge and expertise on-demand.

Usage: skill({name: "skill-name"})

The skill's instructions and guidelines will be returned as text.
You can then apply this knowledge to your current task.

Available Skills:
${catalog}

Load skills when you need:
- Domain-specific rules or compliance guidelines
- Specialized methodologies or formulas
- Industry standards or best practices
- Templates or structured approaches

Examples:
- Danish tender analysis: skill({name: "danish-tender-guidelines"})
- Complexity estimation: skill({name: "complexity-calculator"})
- Architecture patterns: skill({name: "architecture-analyzer"})`;
  }

  async execute(input: { name: string }): Promise<ToolResult> {
    const { name } = input;

    // Check cache first
    if (this.conversationId) {
      const cached = this.cache.get(this.conversationId, name);
      if (cached) {
        return {
          success: true,
          output: this.formatSkillOutput(cached, true)
        };
      }
    }

    // Load from registry
    const skill = this.skillRegistry.getSkill(name);

    if (!skill) {
      const skills = this.skillRegistry.listSkills();
      return {
        success: false,
        output: `Skill '${name}' not found.

Available skills:
${skills.map(s => `  - ${s.name}: ${s.description}`).join('\n')}

Please use one of the skill names listed above.`
      };
    }

    // Cache for this conversation
    if (this.conversationId) {
      this.cache.set(this.conversationId, name, skill);
    }

    return {
      success: true,
      output: this.formatSkillOutput(skill, true)
    };
  }

  private formatSkillOutput(skill: any, includeResources: boolean): string {
    let output = `# Skill Loaded: ${skill.name}\n\n`;

    if (skill.description) {
      output += `*${skill.description}*\n\n`;
    }

    output += `---\n\n${skill.instructions}\n\n---\n\n`;

    // List available resources
    if (includeResources && skill.hasResources()) {
      output += `## Available Resources\n\n`;

      const resources = skill.listResources();
      if (resources.reference?.length > 0) {
        output += `**Reference Documentation:**\n`;
        resources.reference.forEach(r => {
          output += `  - ${skill.name}/reference/${r}\n`;
        });
      }

      if (resources.assets?.length > 0) {
        output += `\n**Templates & Assets:**\n`;
        resources.assets.forEach(a => {
          output += `  - ${skill.name}/assets/${a}\n`;
        });
      }

      if (resources.scripts?.length > 0) {
        output += `\n**Executable Scripts:**\n`;
        resources.scripts.forEach(s => {
          output += `  - ${skill.name}/scripts/${s}\n`;
        });
      }

      output += `\nUse the Read tool to access these resources.\n`;
    }

    return output;
  }
}
```

### SkillCache Implementation

```typescript
export interface CachedSkill {
  skill: Skill;
  loadedAt: number;
}

export class SkillCache {
  private cache = new Map<string, CachedSkill>();
  private readonly TTL = 3600000; // 1 hour

  get(conversationId: string, skillName: string): Skill | undefined {
    const key = `${conversationId}:${skillName}`;
    const cached = this.cache.get(key);

    if (!cached) return undefined;

    // Check TTL
    if (Date.now() - cached.loadedAt > this.TTL) {
      this.cache.delete(key);
      return undefined;
    }

    return cached.skill;
  }

  set(conversationId: string, skillName: string, skill: Skill): void {
    const key = `${conversationId}:${skillName}`;
    this.cache.set(key, {
      skill,
      loadedAt: Date.now()
    });
  }

  clear(conversationId?: string): void {
    if (conversationId) {
      // Clear specific conversation
      const prefix = `${conversationId}:`;
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Clear all
      this.cache.clear();
    }
  }

  size(): number {
    return this.cache.size;
  }
}
```

### Updated SkillRegistry Methods

```typescript
// Add to existing SkillRegistry class

/**
 * Get a single skill by name
 */
getSkill(name: string): Skill | undefined {
  return this.skills.get(name);
}

/**
 * List all available skills (for catalog)
 */
listSkills(): Array<{ name: string; description: string }> {
  return Array.from(this.skills.values()).map(skill => ({
    name: skill.name,
    description: skill.description || 'No description available'
  }));
}
```

---

## Agent Migration Strategy

### Migration Principles

1. **Clear Instructions** - Agents must know when to load skills
2. **Specific Examples** - Show exact usage patterns
3. **Role-Specific** - Tailor instructions to each agent's purpose
4. **Gradual Learning** - Start simple, agents learn over time

### Example: technical-analyst.md

```markdown
---
name: technical-analyst
tools: [read, write, grep, skill]
---

You are a Technical Analyst specializing in software evaluation and tender analysis.

## Your Expertise

You analyze technical requirements, estimate complexity, and evaluate system architectures.
You have access to specialized domain knowledge via the skill tool.

## Domain Knowledge System

### Available Skills

Load these skills when needed for your analysis:

- **danish-tender-guidelines** - Danish public tender compliance rules
  - Load when: Analyzing Danish tenders, checking compliance
  - Contains: Marker system, file locations, neutrality requirements

- **complexity-calculator** - Software estimation methodology
  - Load when: Estimating effort, calculating complexity
  - Contains: Formulas, scoring matrices, estimation patterns

### Loading Skills

When starting analysis:
1. Read the task requirements
2. Determine what domain knowledge you need
3. Load relevant skills before beginning analysis
4. Apply the skill's guidelines to your work

### Task Patterns

**Pattern: Danish Tender Analysis**
```
1. Load Danish guidelines: skill({name: "danish-tender-guidelines"})
2. Read tender documents
3. Apply marker system from skill
4. Generate compliant output
```

**Pattern: Complexity Estimation**
```
1. Load calculator: skill({name: "complexity-calculator"})
2. Analyze components
3. Apply formulas from skill
4. Calculate total complexity
```

## Your Process

1. **Understand** - Read and comprehend the task
2. **Load Knowledge** - Load relevant skills for the domain
3. **Investigate** - Use tools to gather information
4. **Apply Skills** - Use loaded knowledge in your analysis
5. **Deliver** - Provide comprehensive results

Remember: Skills provide domain knowledge. Load them when you need specialized expertise.
```

### Migration Checklist

For each agent:
- [ ] Remove `skills:` from frontmatter
- [ ] Add `skill` to tools list
- [ ] Add "Domain Knowledge System" section
- [ ] List available skills with descriptions
- [ ] Provide loading examples
- [ ] Add task patterns
- [ ] Test the agent

---

## Test Strategy

### Unit Tests

**SkillTool Tests:**
```typescript
describe('SkillTool', () => {
  it('should load skill by name');
  it('should return formatted skill content');
  it('should list resources if available');
  it('should use cache on second call');
  it('should provide helpful error for non-existent skill');
  it('should list all available skills in catalog');
  it('should update description when skills change');
});
```

**SkillCache Tests:**
```typescript
describe('SkillCache', () => {
  it('should cache skill for conversation');
  it('should return cached skill within TTL');
  it('should expire cache after TTL');
  it('should isolate cache by conversation');
  it('should clear specific conversation');
  it('should clear all cache');
});
```

### Integration Tests

**Basic Loading:**
```typescript
test('agent loads skill and uses it', async () => {
  const result = await executor.execute(
    'technical-analyst',
    'Analyze this Danish tender'
  );

  // Should explicitly load skill
  expect(result).toContain('skill({name: "danish-tender-guidelines"})');

  // Should receive skill content
  expect(result).toContain('Skill Loaded: danish-tender-guidelines');

  // Should apply skill knowledge
  expect(result).toContain('[FAKTA]');
});
```

**Caching:**
```typescript
test('skill caches within conversation', async () => {
  const conversationId = 'test-123';

  // First message - loads skill
  const result1 = await executor.execute(
    'agent',
    'Load Danish guidelines',
    { conversationId }
  );
  expect(result1).toContain('skill({name:');

  // Second message - should not reload
  const result2 = await executor.execute(
    'agent',
    'Continue analysis',
    { conversationId }
  );
  // Skill still available, no second load
});
```

**Error Handling:**
```typescript
test('provides helpful error for unknown skill', async () => {
  const result = await executor.execute(
    'agent',
    'Load unknown skill'
  );

  expect(result).toContain("Skill 'unknown' not found");
  expect(result).toContain('Available skills:');
  expect(result).toContain('danish-tender-guidelines');
});
```

---

## Success Criteria

### Technical Success

✅ **Functionality**
- [ ] Agents can load skills via skill() tool
- [ ] Skills cache per conversation
- [ ] Resource discovery works
- [ ] Errors handled gracefully
- [ ] All 4 agents migrated

✅ **Performance**
- [ ] Skill loading <50ms
- [ ] Cache lookup <1ms
- [ ] Memory usage reasonable
- [ ] No memory leaks

✅ **Quality**
- [ ] 95% test coverage
- [ ] TypeScript compilation clean
- [ ] ESLint passing
- [ ] All tests green

### User Experience

✅ **Agent Behavior**
- [ ] Agents load appropriate skills
- [ ] Clear when skills are loaded
- [ ] Skills applied correctly
- [ ] No silent failures

✅ **Developer Experience**
- [ ] Clear error messages
- [ ] Easy to add new skills
- [ ] Simple to debug
- [ ] Well documented

### Architecture Goals

✅ **Design Quality**
- [ ] Matches Claude Code pattern
- [ ] Simple and maintainable
- [ ] Clear separation of concerns
- [ ] Extensible for future

---

## Implementation Schedule

### Day 1: Core System (8 hours)

**Morning (4 hours):**
- Hour 1: Create SkillCache + tests
- Hour 2-4: Create SkillTool + tests

**Afternoon (4 hours):**
- Hour 5: Update SkillRegistry
- Hour 6: Wire into SystemBuilder
- Hour 7-8: Remove static loading

### Day 2: Migration & Testing (8 hours)

**Morning (4 hours):**
- Hour 9-10: Update agent frontmatter
- Hour 11-12: Rewrite agent instructions

**Afternoon (4 hours):**
- Hour 13-14: Integration tests
- Hour 15: Performance validation
- Hour 16: Documentation update

---

## Rollback Plan

If issues arise:

1. **Keep both branches:**
   - `feature/skills-implementation` (static)
   - `feature/skills-dynamic` (dynamic)

2. **Quick revert possible:**
   ```bash
   git checkout feature/skills-implementation
   ```

3. **No data migration needed** - Just code changes

---

## Decision Log

### Decisions Made

1. ✅ **Manual loading only** - No auto-triggering
2. ✅ **Per-conversation cache** - Load once per conversation
3. ✅ **Claude Code pattern** - Match Anthropic's approach
4. ✅ **Explicit over implicit** - Clear skill() calls
5. ✅ **Agent autonomy** - Agent decides what to load

### Rationale

- **Simplicity** - Easier to implement and maintain
- **Clarity** - Can see exactly when skills load
- **Debugging** - Skill calls visible in conversation
- **Proven pattern** - This is how Claude Code works
- **Agent learning** - Agents improve at loading skills

---

## Next Steps

### Immediate Actions

1. **Start with SkillCache:**
   ```bash
   touch packages/core/src/skills/cache.ts
   touch packages/core/tests/unit/skills/cache.test.ts
   ```

2. **TDD approach:**
   - Write cache tests first
   - Implement cache
   - Move to SkillTool

3. **Incremental progress:**
   - Get cache working
   - Get tool working
   - Wire together
   - Remove old code
   - Migrate agents

### Ready to Start?

This plan is **50% simpler** than the dual-mechanism approach:
- 16 hours vs 28 hours
- 5 new files vs 7
- No pattern matching complexity
- Clear, explicit behavior
- True Claude Code style

**Begin implementation?**
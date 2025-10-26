# Dynamic Skills Implementation Plan

**Branch:** feature/skills-dynamic
**Date:** 2025-10-26
**Approach:** Complete implementation with auto-triggering
**Philosophy:** Get it architecturally right from the start

---

## Table of Contents

1. [Architecture Vision](#architecture-vision)
2. [Design Decisions](#design-decisions)
3. [Implementation Phases](#implementation-phases)
4. [Detailed Technical Design](#detailed-technical-design)
5. [File-by-File Changes](#file-by-file-changes)
6. [Test Strategy](#test-strategy)
7. [Migration Strategy](#migration-strategy)
8. [Success Criteria](#success-criteria)

---

## Architecture Vision

### The Goal

Transform skills from **static build-time loading** to **dynamic runtime loading with intelligent auto-triggering**, matching Anthropic's Claude Code pattern.

### Core Principles

1. **Agent Autonomy** - Agents decide what knowledge they need
2. **Just-In-Time Loading** - Load skills only when needed
3. **Smart Defaults** - Auto-trigger for common patterns
4. **Graceful Fallback** - Manual loading always available
5. **Zero Waste** - Never load unnecessary skills
6. **Cache Once** - Load skill once per conversation
7. **Future-Proof** - Support versioning, dependencies (later)

### How It Works

```mermaid
graph TB
    Start[Agent Receives Task] --> Analyze[Auto-Trigger Analyzes Task]
    Analyze --> Match{Keywords Match?}
    Match -->|Yes| AutoLoad[Auto-Load Skills]
    Match -->|No| CheckManual[Agent Checks Task]

    AutoLoad --> Inject[Inject Skills as System Messages]
    CheckManual --> NeedSkill{Need Skill?}
    NeedSkill -->|Yes| CallTool[Call skill() tool]
    NeedSkill -->|No| Proceed[Proceed without skills]

    CallTool --> LoadSkill[Load Skill Content]
    LoadSkill --> AddToConvo[Add as Tool Result]

    Inject --> Execute[Agent Executes with Skills]
    AddToConvo --> Execute
    Proceed --> Execute

    Execute --> Cache{Skill in Cache?}
    Cache -->|No| StoreCache[Cache for Conversation]
    Cache -->|Yes| UseCache[Use Cached Version]
```

### Two Loading Mechanisms

**1. Auto-Triggering (Primary)**
```typescript
User: "Analyze this Danish tender for compliance"
System: [Auto-loads danish-tender-guidelines based on keywords]
Agent: [Has skill available immediately]
```

**2. Manual Tool (Fallback)**
```typescript
User: "Help with this task"
Agent: "I need specialized knowledge"
Agent: skill({name: "complexity-calculator"})
System: [Returns skill content]
Agent: [Uses skill knowledge]
```

**Both work together** - Auto-trigger provides baseline, agent can load more.

---

## Design Decisions

### 1. Skill Tool Design

**Interface:**
```typescript
interface SkillToolInput {
  name: string;           // Skill to load
  includeResources?: boolean;  // List available resources (default: true)
}

interface SkillToolResult {
  success: boolean;
  output: string;         // Skill content or error message
  resources?: {           // Available resources (if any)
    reference: string[];
    assets: string[];
    scripts: string[];
  };
}
```

**Key Features:**
- Returns skill instructions as markdown
- Lists available resources (reference, assets, scripts)
- Provides helpful error messages with available skills
- Cached within conversation (load once)

### 2. Auto-Triggering Design

**Pattern Matching:**
```typescript
interface SkillTriggerPattern {
  keywords: string[];      // Keywords to match
  confidence: number;      // Required confidence (0.0-1.0)
  skill: string;          // Skill to load
}

interface SkillMetadata {
  name: string;
  description: string;
  triggers?: {            // Auto-trigger configuration
    keywords: string[];    // Primary keywords
    patterns: string[];    // Regex patterns (optional)
    confidence: number;    // Default confidence threshold
  };
}
```

**Matching Algorithm:**
1. Extract keywords from user's task
2. Match against skill trigger patterns
3. Calculate confidence score
4. Load skills above threshold
5. Inject as system messages

**Configuration:**
```typescript
{
  autoTrigger: {
    enabled: true,
    confidenceThreshold: 0.6,  // 60% match required
    maxSkills: 3,              // Max auto-loaded skills
    cacheStrategy: 'conversation'  // Cache per conversation
  }
}
```

### 3. Caching Strategy

**Per-Conversation Cache:**
```typescript
class SkillCache {
  private cache = new Map<string, LoadedSkill>();

  get(conversationId: string, skillName: string): LoadedSkill | undefined {
    return this.cache.get(`${conversationId}:${skillName}`);
  }

  set(conversationId: string, skillName: string, skill: LoadedSkill): void {
    this.cache.set(`${conversationId}:${skillName}`, skill);
  }
}
```

**Benefits:**
- Load skill once per conversation
- Reuse across multiple agent turns
- Clear cache between conversations
- Prevents redundant loading

### 4. Resource Handling

**Lazy Loading:**
```typescript
class DynamicSkill {
  private resourcesLoaded = false;
  private resources?: SkillResources;

  async getResources(): Promise<SkillResources> {
    if (!this.resourcesLoaded) {
      this.resources = await this.loadResources();
      this.resourcesLoaded = true;
    }
    return this.resources;
  }
}
```

**Resource Discovery:**
```
skill({name: "danish-tender-guidelines"})
→ Returns:
  Instructions: [Full skill content]
  Available Resources:
    - reference/marker-system.md
    - assets/analysis-template.md
    - scripts/validate.py

  Use Read tool to access resources.
```

### 5. Agent Instructions Pattern

**Dynamic Skills Agent Template:**
```markdown
---
name: technical-analyst
tools: [read, write, grep, skill]
---

You are a Technical Analyst specializing in software evaluation.

## Dynamic Knowledge System

You have access to specialized skills that can be loaded on-demand.

### Available Skills

The `skill` tool provides access to domain expertise. Skills available:
- Will be listed in the tool description
- Auto-loaded based on your task (when relevant)
- Can be manually loaded via: skill({name: "skill-name"})

### When to Load Skills

**Auto-Triggered** (loaded automatically for you):
- Danish tender tasks → danish-tender-guidelines
- Complexity estimation → complexity-calculator

**Manual Loading** (you decide when needed):
- If auto-trigger missed something
- If you need additional expertise
- If task requires specific domain knowledge

### How to Use Skills

1. Check if skills were auto-loaded (see system messages)
2. If not, determine what knowledge you need
3. Load relevant skill: skill({name: "skill-name"})
4. Apply skill guidelines to your work
5. Access skill resources via Read tool if needed

## Your Process

1. Understand the task
2. Use auto-loaded skills (if any)
3. Load additional skills as needed
4. Complete the analysis using skill knowledge
5. Return comprehensive results

Remember: Skills are knowledge, not capabilities. They enhance your expertise.
```

### 6. Error Handling

**Skill Not Found:**
```typescript
skill({name: "non-existent"})
→ Error: Skill 'non-existent' not found.

Available skills:
  - danish-tender-guidelines: Danish tender compliance rules
  - complexity-calculator: Software estimation methodology
  - architecture-analyzer: System architecture patterns

Use one of the above skill names.
```

**Auto-Trigger Failures:**
- Log but don't fail
- Agent can still load manually
- Provide feedback in system message

---

## Implementation Phases

### Phase 1: Core Infrastructure (8 hours)

**Goal:** Build foundation for dynamic skills

**1.1 Create SkillTool (3 hours)**
- [ ] Create `skill.tool.ts` with tool implementation
- [ ] Implement dynamic catalog generation
- [ ] Add resource discovery
- [ ] Handle errors gracefully

**1.2 Update SkillRegistry (2 hours)**
- [ ] Add `getSkill(name)` method
- [ ] Add `listSkills()` for catalog
- [ ] Implement lazy loading
- [ ] Add skill metadata support

**1.3 Create SkillCache (1 hour)**
- [ ] Implement per-conversation caching
- [ ] Add cache management
- [ ] Integration with SkillTool

**1.4 Register SkillTool (1 hour)**
- [ ] Add to tool registry
- [ ] Update system builder
- [ ] Add to default tools

**1.5 Write Tests (1 hour)**
- [ ] Unit tests for SkillTool
- [ ] Cache tests
- [ ] Integration tests

### Phase 2: Remove Static Loading (4 hours)

**Goal:** Clean out old implementation

**2.1 Update Agent Schema (1 hour)**
- [ ] Remove `skills` field from schema
- [ ] Update validation
- [ ] Update types

**2.2 Clean AgentLoader (1 hour)**
- [ ] Remove skill loading logic
- [ ] Remove loadedSkills
- [ ] Simplify loadAgent

**2.3 Clean ContextSetupMiddleware (1 hour)**
- [ ] Remove skill injection
- [ ] Clean system prompt generation
- [ ] Simplify logic

**2.4 Update Logging (1 hour)**
- [ ] Remove skills from logAgentStart
- [ ] Update all logger implementations
- [ ] Clean event types

### Phase 3: Auto-Triggering System (8 hours)

**Goal:** Intelligent skill loading

**3.1 Create Pattern Matcher (3 hours)**
- [ ] Keyword extraction
- [ ] Pattern matching engine
- [ ] Confidence scoring
- [ ] Multi-skill support

**3.2 Create Auto-Trigger Middleware (2 hours)**
- [ ] Task analysis
- [ ] Skill matching
- [ ] Auto-injection
- [ ] Configuration support

**3.3 Update Skill Metadata (1 hour)**
- [ ] Add trigger patterns to skills
- [ ] Define keywords
- [ ] Set confidence thresholds

**3.4 Integration (1 hour)**
- [ ] Wire into middleware pipeline
- [ ] Add configuration
- [ ] Test with agents

**3.5 Write Tests (1 hour)**
- [ ] Pattern matching tests
- [ ] Auto-trigger tests
- [ ] Edge cases

### Phase 4: Agent Migration (4 hours)

**Goal:** Update all agents for dynamic skills

**4.1 Update Agent Frontmatter (1 hour)**
- [ ] Add `skill` to tools
- [ ] Remove `skills` field
- [ ] All 4 agents

**4.2 Rewrite Agent Instructions (2 hours)**
- [ ] Add dynamic skills section
- [ ] Explain when to load
- [ ] Provide examples
- [ ] All 4 agents

**4.3 Test Each Agent (1 hour)**
- [ ] Manual loading works
- [ ] Auto-triggering works
- [ ] Skills applied correctly

### Phase 5: Testing & Documentation (4 hours)

**Goal:** Production readiness

**5.1 Comprehensive Tests (2 hours)**
- [ ] Unit test coverage >90%
- [ ] Integration tests
- [ ] Performance tests
- [ ] Edge cases

**5.2 Update Documentation (1 hour)**
- [ ] Update skills.md
- [ ] Update README
- [ ] Update CLAUDE.md
- [ ] Add examples

**5.3 Migration Guide (1 hour)**
- [ ] Document changes
- [ ] Provide examples
- [ ] Rollback plan

**Total: 28 hours**

---

## Detailed Technical Design

### 1. SkillTool Implementation

**File:** `packages/core/src/tools/builtin/skill.tool.ts`

```typescript
import { BaseTool, ToolResult, ToolInput } from '@/tools/base-tool';
import { SkillRegistry } from '@/skills/registry';
import { SkillCache } from '@/skills/cache';
import { AgentContext } from '@/types';

interface SkillToolInput extends ToolInput {
  name: string;
  includeResources?: boolean;
}

export class SkillTool extends BaseTool {
  public readonly name = 'skill';
  public readonly description: string;

  private cache: SkillCache;

  constructor(
    private skillRegistry: SkillRegistry,
    private context?: AgentContext
  ) {
    super();
    this.cache = new SkillCache();
    this.description = this.generateDescription();
  }

  private generateDescription(): string {
    const skills = this.skillRegistry.listSkills();
    const catalog = skills.map(s =>
      `  - ${s.name}: ${s.description}`
    ).join('\n');

    return `Load domain expertise and specialized knowledge on-demand.

<skills_instructions>
Skills provide guidelines, templates, formulas, and best practices.
Load skills when you need specialized knowledge for your task.

How to use:
- Basic: skill({name: "skill-name"})
- With resources: skill({name: "skill-name", includeResources: true})

The skill's instructions will be added to the conversation.
If the skill has resources, they'll be listed for access via Read tool.

Available Skills:
${catalog}

Examples:
- Danish tender analysis: skill({name: "danish-tender-guidelines"})
- Complexity estimation: skill({name: "complexity-calculator"})
- Architecture patterns: skill({name: "architecture-analyzer"})
</skills_instructions>

Load skills when:
- You need domain-specific knowledge
- Task requires specialized expertise
- You want to follow established standards
- Templates or formulas would help`;
  }

  async execute(input: SkillToolInput): Promise<ToolResult> {
    const { name, includeResources = true } = input;

    // Check cache first (if we have context)
    if (this.context?.conversationId) {
      const cached = this.cache.get(this.context.conversationId, name);
      if (cached) {
        return {
          success: true,
          output: this.formatSkillOutput(cached, includeResources)
        };
      }
    }

    // Load skill from registry
    const skill = this.skillRegistry.getSkill(name);

    if (!skill) {
      const skills = this.skillRegistry.listSkills();
      const suggestions = skills.map(s =>
        `  - ${s.name}: ${s.description}`
      ).join('\n');

      return {
        success: false,
        output: `Skill '${name}' not found.

Available skills:
${suggestions}

Use one of the above skill names.`
      };
    }

    // Load skill content and resources
    const loadedSkill = {
      ...skill,
      resources: includeResources ? await skill.getResources() : undefined
    };

    // Cache for this conversation
    if (this.context?.conversationId) {
      this.cache.set(this.context.conversationId, name, loadedSkill);
    }

    return {
      success: true,
      output: this.formatSkillOutput(loadedSkill, includeResources)
    };
  }

  private formatSkillOutput(skill: any, includeResources: boolean): string {
    let output = `# ${skill.name}\n\n`;

    if (skill.description) {
      output += `*${skill.description}*\n\n`;
    }

    output += skill.instructions;

    if (includeResources && skill.resources) {
      output += '\n\n## Available Resources\n\n';

      if (skill.resources.reference?.length > 0) {
        output += '**Reference Documentation:**\n';
        skill.resources.reference.forEach(r =>
          output += `  - reference/${r}\n`
        );
        output += '\n';
      }

      if (skill.resources.assets?.length > 0) {
        output += '**Assets & Templates:**\n';
        skill.resources.assets.forEach(a =>
          output += `  - assets/${a}\n`
        );
        output += '\n';
      }

      if (skill.resources.scripts?.length > 0) {
        output += '**Executable Scripts:**\n';
        skill.resources.scripts.forEach(s =>
          output += `  - scripts/${s}\n`
        );
        output += '\n';
      }

      output += 'Use the Read tool to access these resources.\n';
    }

    return output;
  }
}
```

### 2. Auto-Trigger Implementation

**File:** `packages/core/src/skills/auto-trigger.ts`

```typescript
import { Skill } from './types';

export interface SkillTrigger {
  skill: Skill;
  confidence: number;
  matchedKeywords: string[];
  reason: string;
}

export class SkillAutoTrigger {
  constructor(private skillRegistry: SkillRegistry) {}

  /**
   * Analyze task and suggest skills to auto-load
   */
  analyzeTask(task: string): SkillTrigger[] {
    const taskLower = task.toLowerCase();
    const taskWords = this.extractWords(taskLower);
    const triggers: SkillTrigger[] = [];

    for (const skill of this.skillRegistry.listSkills()) {
      // Check skill metadata for triggers
      if (!skill.metadata?.triggers) continue;

      const { keywords, patterns, confidence: minConfidence = 0.6 } = skill.metadata.triggers;

      // Match keywords
      let matchedKeywords: string[] = [];
      let score = 0;

      if (keywords) {
        for (const keyword of keywords) {
          if (taskLower.includes(keyword.toLowerCase())) {
            matchedKeywords.push(keyword);
            score += 1;
          }
        }
      }

      // Match patterns (regex)
      if (patterns) {
        for (const pattern of patterns) {
          const regex = new RegExp(pattern, 'i');
          if (regex.test(task)) {
            score += 2; // Patterns worth more
            matchedKeywords.push(`pattern:${pattern}`);
          }
        }
      }

      // Calculate confidence
      const maxScore = (keywords?.length || 0) + (patterns?.length || 0) * 2;
      const confidence = maxScore > 0 ? score / maxScore : 0;

      if (confidence >= minConfidence) {
        triggers.push({
          skill,
          confidence,
          matchedKeywords,
          reason: `Matched: ${matchedKeywords.join(', ')}`
        });
      }
    }

    // Sort by confidence (highest first)
    return triggers.sort((a, b) => b.confidence - a.confidence);
  }

  private extractWords(text: string): string[] {
    return text
      .split(/\s+/)
      .filter(w => w.length > 2)
      .map(w => w.replace(/[^\w]/g, ''));
  }
}
```

**File:** `packages/core/src/middleware/skill-auto-trigger.middleware.ts`

```typescript
export function createSkillAutoTriggerMiddleware(
  skillRegistry: SkillRegistry,
  cache: SkillCache
): Middleware {
  const autoTrigger = new SkillAutoTrigger(skillRegistry);

  return async (ctx, next) => {
    // Only run on first iteration
    if (ctx.iteration !== 1) {
      return next();
    }

    // Check if auto-trigger is enabled
    const config = ctx.config?.skills?.autoTrigger;
    if (!config?.enabled) {
      return next();
    }

    // Get user's task from first message
    const userMessage = ctx.messages.find(m => m.role === 'user');
    if (!userMessage) {
      return next();
    }

    // Analyze task for skill triggers
    const triggers = autoTrigger.analyzeTask(userMessage.content);
    const toLoad = triggers
      .filter(t => t.confidence >= config.confidenceThreshold)
      .slice(0, config.maxSkills || 3);

    if (toLoad.length === 0) {
      return next();
    }

    // Log auto-loading
    ctx.logger?.logSystemMessage(
      `Auto-loading ${toLoad.length} skill(s): ${toLoad.map(t =>
        `${t.skill.name} (${Math.round(t.confidence * 100)}% confidence)`
      ).join(', ')}`
    );

    // Load and inject skills as system messages
    for (const trigger of toLoad) {
      // Check cache first
      const cached = cache.get(ctx.conversationId, trigger.skill.name);
      const skill = cached || await skillRegistry.getSkill(trigger.skill.name);

      if (skill) {
        // Cache if not already
        if (!cached && ctx.conversationId) {
          cache.set(ctx.conversationId, trigger.skill.name, skill);
        }

        // Inject as system message
        const skillMessage = {
          role: 'system' as const,
          content: `## AUTO-LOADED SKILL: ${skill.name}

*${skill.description}*

${skill.instructions}

This skill was automatically loaded based on your task (${trigger.reason}).`
        };

        // Insert after system prompt, before user message
        const systemIndex = ctx.messages.findIndex(m => m.role === 'system');
        if (systemIndex >= 0) {
          ctx.messages.splice(systemIndex + 1, 0, skillMessage);
        } else {
          ctx.messages.unshift(skillMessage);
        }
      }
    }

    return next();
  };
}
```

### 3. Skill Cache Implementation

**File:** `packages/core/src/skills/cache.ts`

```typescript
export interface CachedSkill {
  skill: Skill;
  loadedAt: Date;
  resources?: SkillResources;
}

export class SkillCache {
  private cache = new Map<string, CachedSkill>();
  private maxAge = 3600000; // 1 hour

  get(conversationId: string, skillName: string): CachedSkill | undefined {
    const key = `${conversationId}:${skillName}`;
    const cached = this.cache.get(key);

    if (!cached) return undefined;

    // Check if cache is expired
    const age = Date.now() - cached.loadedAt.getTime();
    if (age > this.maxAge) {
      this.cache.delete(key);
      return undefined;
    }

    return cached;
  }

  set(conversationId: string, skillName: string, skill: Skill): void {
    const key = `${conversationId}:${skillName}`;
    this.cache.set(key, {
      skill,
      loadedAt: new Date(),
      resources: undefined
    });
  }

  clear(conversationId?: string): void {
    if (conversationId) {
      // Clear only for specific conversation
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

### 4. Updated Skill Metadata

**File:** `packages/examples/udbud/skills/danish-tender-guidelines/SKILL.md`

```yaml
---
name: danish-tender-guidelines
description: Danish public tender compliance rules and formatting standards
license: MIT
metadata:
  version: "1.0.0"
  author: "Niels Peter"
  tags: "tender,danish,compliance,formatting"
triggers:
  keywords:
    - "danish tender"
    - "dansk udbud"
    - "offentlig udbud"
    - "tender compliance"
    - "udbudsbetingelser"
  patterns:
    - "analyz.*danish.*tender"
    - "tender.*denmark|danish"
    - "udbud.*analyse"
  confidence: 0.7
---
```

---

## File-by-File Changes

### Files to CREATE (7 new files)

1. `packages/core/src/tools/builtin/skill.tool.ts` (300 lines)
2. `packages/core/src/skills/cache.ts` (100 lines)
3. `packages/core/src/skills/auto-trigger.ts` (200 lines)
4. `packages/core/src/middleware/skill-auto-trigger.middleware.ts` (150 lines)
5. `packages/core/tests/unit/tools/skill.tool.test.ts` (250 lines)
6. `packages/core/tests/unit/skills/cache.test.ts` (150 lines)
7. `packages/core/tests/unit/skills/auto-trigger.test.ts` (200 lines)

**Total new code: ~1,350 lines**

### Files to MODIFY (15 files)

1. `packages/core/src/agents/validation.ts` - Remove skills field
2. `packages/core/src/agents/loader.ts` - Remove skill loading
3. `packages/core/src/agents/types.ts` - Remove skills, loadedSkills
4. `packages/core/src/middleware/context-setup.middleware.ts` - Remove injection
5. `packages/core/src/middleware/agent-loader.middleware.ts` - Remove skills log
6. `packages/core/src/config/system-builder.ts` - Register SkillTool
7. `packages/core/src/skills/registry.ts` - Add getSkill, listSkills
8. `packages/core/src/skills/types.ts` - Add trigger metadata
9. `packages/core/src/logging/types.ts` - Remove skills param
10. `packages/core/src/logging/*.logger.ts` (4 files) - Remove skills
11. `packages/examples/udbud/agents/*.md` (4 files) - Update agents

**Total files modified: 15**

### Files to DELETE

None - we're transforming, not removing functionality

---

## Test Strategy

### Unit Tests (Target: 95% coverage)

**SkillTool Tests:**
```typescript
describe('SkillTool', () => {
  describe('execute', () => {
    it('should load skill by name');
    it('should return skill content as markdown');
    it('should list available resources when requested');
    it('should not include resources when includeResources=false');
    it('should provide helpful error for non-existent skill');
    it('should list all available skills in error message');
    it('should cache skill within conversation');
    it('should use cached skill on second call');
    it('should not share cache between conversations');
  });

  describe('description', () => {
    it('should generate dynamic catalog');
    it('should include all available skills');
    it('should update when skills change');
  });
});
```

**SkillCache Tests:**
```typescript
describe('SkillCache', () => {
  it('should cache skill for conversation');
  it('should return cached skill');
  it('should not return expired cache');
  it('should isolate cache by conversation');
  it('should clear cache for specific conversation');
  it('should clear all cache');
  it('should report cache size');
});
```

**AutoTrigger Tests:**
```typescript
describe('SkillAutoTrigger', () => {
  it('should match keywords in task');
  it('should match regex patterns');
  it('should calculate confidence correctly');
  it('should sort by confidence');
  it('should respect minimum confidence');
  it('should handle no matches');
  it('should handle skills without triggers');
  it('should prioritize pattern matches over keywords');
});
```

### Integration Tests

**Dynamic Loading:**
```typescript
test('agent loads skill dynamically and uses it', async () => {
  const system = await AgentSystemBuilder.default()
    .withAgentsFrom('./agents')
    .withSkillsFrom('./skills')
    .build();

  const result = await system.executor.execute(
    'technical-analyst',
    'Analyze this Danish tender for compliance'
  );

  // Should call skill tool
  expect(result).toContain('skill');
  expect(result).toContain('danish-tender-guidelines');

  // Should apply skill knowledge
  expect(result).toContain('[FAKTA]');
  expect(result).toContain('[ESTIMAT]');
});
```

**Auto-Triggering:**
```typescript
test('skills auto-load based on task keywords', async () => {
  const system = await AgentSystemBuilder.default()
    .withSkillsFrom('./skills')
    .withConfig({
      skills: {
        autoTrigger: {
          enabled: true,
          confidenceThreshold: 0.6
        }
      }
    })
    .build();

  const result = await system.executor.execute(
    'technical-analyst',
    'Analyze Danish tender document'
  );

  // Should auto-load without tool call
  expect(result).toContain('AUTO-LOADED SKILL: danish-tender-guidelines');
});
```

**Caching:**
```typescript
test('skill loads once per conversation', async () => {
  const executor = /* ... */;
  const conversationId = 'test-123';

  // First call - loads skill
  const result1 = await executor.execute(
    'agent',
    'Load danish guidelines',
    { conversationId }
  );
  expect(result1).toContain('Loading skill');

  // Second call - uses cache
  const result2 = await executor.execute(
    'agent',
    'Load danish guidelines again',
    { conversationId }
  );
  expect(result2).toContain('Using cached skill');
});
```

### Performance Tests

```typescript
test('skill loading performance', async () => {
  const start = Date.now();
  await skillTool.execute({name: 'complex-skill'});
  const loadTime = Date.now() - start;

  expect(loadTime).toBeLessThan(50); // Should load in <50ms
});

test('auto-trigger performance', async () => {
  const start = Date.now();
  const triggers = autoTrigger.analyzeTask('Complex task with many keywords');
  const analyzeTime = Date.now() - start;

  expect(analyzeTime).toBeLessThan(10); // Should analyze in <10ms
});
```

---

## Migration Strategy

### Phase 1: Parallel Implementation
- Build dynamic system alongside static
- Both work simultaneously
- No breaking changes yet

### Phase 2: Gradual Migration
- Update agents one by one
- Test each thoroughly
- Keep static as fallback

### Phase 3: Validation
- Run both systems in parallel
- Compare outputs
- Ensure consistency

### Phase 4: Cutover
- Remove static loading code
- Clean up unused code
- Update all tests

### Rollback Plan

**If issues arise:**
1. Keep feature/skills-implementation branch
2. Can revert to static quickly
3. Git reset to previous commit
4. Re-deploy static version

**Safety checks:**
- All tests must pass
- Performance metrics acceptable
- No regression in functionality

---

## Success Criteria

### Functional Success

✅ **Core Functionality**
- [ ] Agents can load skills via tool
- [ ] Skills auto-trigger on keywords
- [ ] Skills cached per conversation
- [ ] Resources discoverable
- [ ] Errors handled gracefully

✅ **Agent Behavior**
- [ ] All 4 agents work with dynamic skills
- [ ] Auto-trigger works reliably
- [ ] Manual loading works as fallback
- [ ] Skills applied correctly

✅ **Performance**
- [ ] Skill loading <50ms
- [ ] Auto-trigger analysis <10ms
- [ ] Cache hit rate >80%
- [ ] No memory leaks

### Quality Metrics

✅ **Code Quality**
- [ ] Unit test coverage >95%
- [ ] Integration tests pass
- [ ] TypeScript compilation clean
- [ ] ESLint clean
- [ ] No console.logs

✅ **Documentation**
- [ ] README updated
- [ ] skills.md updated
- [ ] CLAUDE.md updated
- [ ] Migration guide written
- [ ] Examples provided

### User Experience

✅ **Developer Experience**
- [ ] Clear error messages
- [ ] Helpful skill catalog
- [ ] Good debugging info
- [ ] Easy to add new skills

✅ **Agent Experience**
- [ ] Skills load seamlessly
- [ ] Auto-trigger "just works"
- [ ] Clear instructions
- [ ] Predictable behavior

### Architecture Goals

✅ **Design Goals**
- [ ] Matches Claude Code pattern
- [ ] Scalable to 50+ skills
- [ ] Context efficient
- [ ] Future-proof design
- [ ] Clean separation of concerns

---

## Timeline & Milestones

### Week 1: Core Implementation
- **Monday-Tuesday:** Phase 1 (Core Infrastructure)
  - SkillTool, Cache, Registry updates
  - Basic tests
- **Wednesday-Thursday:** Phase 2 (Remove Static)
  - Clean old code
  - Update schemas
- **Friday:** Phase 3 Start (Auto-Trigger)
  - Pattern matcher
  - Basic auto-triggering

### Week 2: Intelligence & Polish
- **Monday-Tuesday:** Phase 3 Complete (Auto-Trigger)
  - Auto-trigger middleware
  - Integration with pipeline
- **Wednesday:** Phase 4 (Agent Migration)
  - Update all agents
  - Test each thoroughly
- **Thursday-Friday:** Phase 5 (Testing & Docs)
  - Comprehensive tests
  - Documentation
  - Performance validation

### Week 3: Validation & Refinement
- **Monday-Tuesday:** End-to-end testing
- **Wednesday:** Performance optimization
- **Thursday:** Documentation polish
- **Friday:** Final review & merge

---

## Decision Points

### Critical Decisions Made

1. **Include Auto-Triggering:** Yes - It's essential for Claude Code-like UX
2. **Conversation-Level Caching:** Yes - Prevents redundant loads
3. **Resource Discovery:** Yes - Helps agents know what's available
4. **Keep Manual Loading:** Yes - Important fallback mechanism
5. **Lazy Resource Loading:** Yes - Performance optimization

### Open Questions

1. **Skill Dependencies?** - Future enhancement (v2)
2. **Skill Versioning?** - Future enhancement (v2)
3. **Global vs Local Skills?** - Start with global, add scoping later
4. **Max Cache Size?** - Start with 100 skills, monitor memory

---

## Implementation Order

### Recommended Build Order

1. **SkillCache** - Foundation for caching
2. **SkillTool** - Core functionality
3. **Update SkillRegistry** - Support methods
4. **Wire into SystemBuilder** - Integration
5. **Basic Tests** - Verify working
6. **Auto-Trigger** - Pattern matching
7. **Auto-Trigger Middleware** - Integration
8. **Remove Static Loading** - Clean old code
9. **Update Agents** - Migration
10. **Comprehensive Tests** - Full validation
11. **Documentation** - User guide
12. **Performance Tuning** - Optimization

---

## Risk Mitigation

### Technical Risks

**Risk:** Auto-trigger has false positives
- **Mitigation:** Conservative confidence thresholds
- **Mitigation:** Manual loading always available

**Risk:** Cache grows too large
- **Mitigation:** TTL-based expiration
- **Mitigation:** Max cache size limits

**Risk:** Agents don't load skills when needed
- **Mitigation:** Clear agent instructions
- **Mitigation:** Auto-triggering helps

### Migration Risks

**Risk:** Breaking existing workflows
- **Mitigation:** Parallel implementation
- **Mitigation:** Thorough testing
- **Mitigation:** Rollback plan ready

---

## Next Steps

### Immediate Actions

1. **Review this plan** - Is it complete?
2. **Confirm approach** - Any adjustments?
3. **Start Phase 1** - Create SkillCache first
4. **Test-driven** - Write tests before implementation

### Phase 1 Start

Begin with creating:
```bash
packages/core/src/skills/cache.ts
packages/core/tests/unit/skills/cache.test.ts
```

Then move to SkillTool implementation.

---

**This plan represents the architecturally correct approach to dynamic skills, balancing completeness with pragmatism.**
# Skills Implementation Plan

**Version:** 1.0
**Date:** 2025-10-18
**Target Duration:** 4 weeks
**Status:** Planning

## Overview

This document outlines the phased implementation plan for Skills in the agent orchestration system.

## Success Criteria

At completion:
- ✅ SkillRegistry and SkillLoader implemented (Anthropic Spec v1.0 compliant)
- ✅ 3+ skills migrated (danish-tender-guidelines, complexity-calculator, architecture-analyzer)
- ✅ 4+ agents use skills (tender-orchestrator, technical-analyst, go-no-go, response-prep)
- ✅ All existing tests pass (no regressions)
- ✅ Documentation complete
- ✅ 20-30% context reduction measured

## Phase 1: Core Infrastructure (Week 1)

**Goal:** Build foundational skill loading and registry system

### Tasks

#### 1.1 Create Skill Types and Interfaces

**File:** `packages/core/src/skills/types.ts`

```typescript
export interface Skill {
  name: string;
  description: string;
  license?: string;
  allowedTools?: string[];
  metadata?: Record<string, string>;
  instructions: string;
  reference?: Record<string, string>;
  scripts?: Record<string, string>;
  assets?: Record<string, string>;
  path: string;
}

export interface SkillFrontmatter {
  name: string;
  description: string;
  license?: string;
  'allowed-tools'?: string[];
  metadata?: Record<string, string>;
}
```

**Acceptance Criteria:**
- [ ] Types defined with proper TypeScript interfaces
- [ ] JSDoc comments for all interfaces
- [ ] Exported from `packages/core/src/skills/index.ts`

**Estimated Time:** 2 hours

---

#### 1.2 Create Skill Validation

**File:** `packages/core/src/skills/validation.ts`

```typescript
import { z } from 'zod';

export const SkillFrontmatterSchema = z.object({
  // Required fields (Anthropic Spec v1.0)
  name: z.string().min(1, 'Skill name is required').regex(
    /^[a-z0-9-]+$/,
    'Name must be hyphen-case (e.g., my-skill-name)'
  ),
  description: z.string().min(1, 'Description is required'),

  // Optional fields
  license: z.string().optional(),
  'allowed-tools': z.array(z.string()).optional(),
  metadata: z.record(z.string()).optional(),
});

export function validateSkillFrontmatter(
  data: unknown,
  skillName: string
): SkillFrontmatter {
  // Similar to validateAgentFrontmatter
  try {
    return SkillFrontmatterSchema.parse(data);
  } catch (error) {
    // Format error message
    throw new Error(`Invalid skill frontmatter in '${skillName}': ...`);
  }
}
```

**Acceptance Criteria:**
- [ ] Zod schema validates required fields (name, description)
- [ ] Hyphen-case validation for skill name
- [ ] Optional fields validated when present
- [ ] Clear error messages with field names
- [ ] Unit tests cover all validation cases

**Estimated Time:** 3 hours

---

#### 1.3 Implement SkillLoader

**File:** `packages/core/src/skills/loader.ts`

```typescript
export class SkillLoader {
  constructor(private readonly logger?: AgentLogger) {}

  async loadSkill(skillPath: string): Promise<Skill> {
    // 1. Check for SKILL.md
    // 2. Parse frontmatter + content
    // 3. Validate frontmatter
    // 4. Load resources (reference, scripts, assets)
    // 5. Return Skill object
  }

  private async loadReference(skillPath: string): Promise<Record<string, string>> {
    // Load all files from reference/ subdirectory
  }

  private async loadScripts(skillPath: string): Promise<Record<string, string>> {
    // Load all files from scripts/ subdirectory
  }

  private async loadAssets(skillPath: string): Promise<Record<string, string>> {
    // Load all files from assets/ subdirectory
  }
}
```

**Acceptance Criteria:**
- [ ] Loads SKILL.md and parses frontmatter
- [ ] Loads optional resource directories
- [ ] Throws clear errors for missing/invalid files
- [ ] Unit tests with fixture skills

**Estimated Time:** 6 hours

---

#### 1.4 Implement SkillRegistry

**File:** `packages/core/src/skills/registry.ts`

```typescript
export class SkillRegistry {
  private skills = new Map<string, Skill>();

  constructor(
    private readonly skillsDir: string,
    private readonly logger?: AgentLogger
  ) {}

  async loadSkills(): Promise<void> {
    // Scan skillsDir for subdirectories
    // Load each skill using SkillLoader
    // Register in map
  }

  getSkill(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  listSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  findByTags(tags: string[]): Skill[] {
    // Filter skills matching any of the tags
  }

  findByCapabilities(capabilities: string[]): Skill[] {
    // Filter skills matching any of the capabilities
  }

  registerSkill(skill: Skill): void {
    // For testing/inline skills
    this.skills.set(skill.name, skill);
  }
}
```

**Acceptance Criteria:**
- [ ] Loads all skills from directory
- [ ] Provides lookup by name
- [ ] Supports filtering by tags/capabilities
- [ ] Handles errors gracefully (logs, continues)
- [ ] Unit tests with fixture skills directory

**Estimated Time:** 6 hours

---

#### 1.5 Create Unit Tests

**Files:**
- `packages/core/tests/unit/skills/validation.test.ts`
- `packages/core/tests/unit/skills/loader.test.ts`
- `packages/core/tests/unit/skills/registry.test.ts`

**Test Coverage:**
- ✅ Valid skill frontmatter
- ✅ Invalid frontmatter (missing fields, wrong types)
- ✅ Loading templates, scripts, schemas
- ✅ Missing SKILL.md
- ✅ Registry operations (load, get, filter)
- ✅ Error handling

**Acceptance Criteria:**
- [ ] 90%+ code coverage for skills module
- [ ] All edge cases covered
- [ ] Fixture skills in test-fixtures/skills/

**Estimated Time:** 8 hours

---

### Phase 1 Deliverables

- [x] Skill types defined
- [x] Validation with Zod schemas
- [x] SkillLoader implemented
- [x] SkillRegistry implemented
- [x] Comprehensive unit tests
- [x] Documentation in code (JSDoc)

**Total Estimated Time:** 25 hours (~1 week)

---

## Phase 2: Agent Integration (Week 2)

**Goal:** Integrate skills into agent loading and execution pipeline

### Tasks

#### 2.1 Update Agent Interface

**File:** `packages/core/src/agents/types.ts`

```typescript
export interface Agent {
  name: string;
  model?: string;
  tools?: string[] | '*';
  thinking?: boolean | ThinkingConfig;
  // ... existing fields

  /** Skills to load with this agent */
  skills?: string[];
}
```

**File:** `packages/core/src/agents/validation.ts`

```typescript
// Update AgentFrontmatterSchema
export const AgentFrontmatterSchema = z.object({
  // ... existing fields
  skills: z.array(z.string()).optional(),
});
```

**Acceptance Criteria:**
- [ ] Agent interface includes skills field
- [ ] Schema validates skills as string array
- [ ] Backward compatible (skills optional)

**Estimated Time:** 2 hours

---

#### 2.2 Update MiddlewareContext

**File:** `packages/core/src/middleware/middleware-types.ts`

```typescript
export interface MiddlewareContext {
  // ... existing fields
  agent: Agent;

  /** Skills loaded for this agent */
  skills?: Skill[];
}
```

**Acceptance Criteria:**
- [ ] MiddlewareContext includes skills field
- [ ] Optional (for backward compatibility)

**Estimated Time:** 1 hour

---

#### 2.3 Update AgentExecutor

**File:** `packages/core/src/agents/executor.ts`

```typescript
export class AgentExecutor {
  constructor(
    // ... existing parameters
    private readonly skillRegistry?: SkillRegistry  // NEW
  ) {}

  async execute(prompt: string, context: ExecutionContext): Promise<string> {
    // 1. Load agent (existing)
    const agent = await this.agentLoader.loadAgent(this.agentName);

    // 2. Load skills (NEW)
    const skills = await this.loadAgentSkills(agent);

    // 3. Create middleware context
    const middlewareContext: MiddlewareContext = {
      // ... existing fields
      agent,
      skills,  // NEW
    };

    // 4. Execute pipeline (existing)
    await this.pipeline.execute(middlewareContext, async () => {});

    return middlewareContext.result || '';
  }

  /**
   * Load skills referenced by agent
   */
  private async loadAgentSkills(agent: Agent): Promise<Skill[]> {
    if (!agent.skills || agent.skills.length === 0) {
      return [];
    }

    if (!this.skillRegistry) {
      this.logger.logSystemMessage(
        `Warning: Agent '${agent.name}' references skills but SkillRegistry not configured`
      );
      return [];
    }

    const skills: Skill[] = [];
    for (const skillName of agent.skills) {
      const skill = this.skillRegistry.getSkill(skillName);
      if (!skill) {
        this.logger.logSystemMessage(`Warning: Skill '${skillName}' not found`);
        continue;
      }
      skills.push(skill);
      this.logger.logSystemMessage(`Loaded skill: ${skillName} v${skill.version}`);
    }

    return skills;
  }
}
```

**Acceptance Criteria:**
- [ ] AgentExecutor accepts optional SkillRegistry
- [ ] Loads skills before execution
- [ ] Logs skill loading
- [ ] Graceful degradation (missing skills logged, not fatal)
- [ ] Backward compatible (works without SkillRegistry)

**Estimated Time:** 4 hours

---

#### 2.4 Update ContextSetupMiddleware

**File:** `packages/core/src/middleware/context-setup.middleware.ts`

```typescript
export function createContextSetupMiddleware(): Middleware {
  return async (ctx, next) => {
    // 1. Build system prompt from agent (existing)
    let systemPrompt = ctx.agent.instructions || '';

    // 2. Append skills (NEW)
    if (ctx.skills && ctx.skills.length > 0) {
      systemPrompt += '\n\n# Available Skills\n\n';
      systemPrompt += 'You have access to the following domain expertise:\n\n';

      for (const skill of ctx.skills) {
        systemPrompt += `## ${skill.name} - ${skill.description}\n\n`;
        systemPrompt += skill.instructions;
        systemPrompt += '\n\n';

        // Mention available templates
        if (skill.templates && Object.keys(skill.templates).length > 0) {
          systemPrompt += `**Templates available:** ${Object.keys(skill.templates).join(', ')}\n\n`;
        }
      }
    }

    // 3. Create initial messages (existing)
    ctx.messages = [
      { role: 'user', content: systemPrompt },
      { role: 'assistant', content: 'Understood. Ready to assist.' },
      { role: 'user', content: ctx.prompt },
    ];

    await next();
  };
}
```

**Acceptance Criteria:**
- [ ] Skills appended to system prompt
- [ ] Clear section headers for skills
- [ ] Templates mentioned when available
- [ ] Backward compatible (works without skills)

**Estimated Time:** 3 hours

---

#### 2.5 Update AgentSystemBuilder

**File:** `packages/core/src/config/system-builder.ts`

```typescript
export class AgentSystemBuilder {
  private skillsDir?: string;

  /**
   * Specify directory containing skills
   */
  withSkillsFrom(skillsDir: string): this {
    this.skillsDir = skillsDir;
    return this;
  }

  async build(): Promise<{ executor: AgentExecutor; cleanup: () => Promise<void> }> {
    // ... existing setup

    // Load skills (NEW)
    let skillRegistry: SkillRegistry | undefined;
    if (this.skillsDir) {
      skillRegistry = new SkillRegistry(this.skillsDir, logger);
      await skillRegistry.loadSkills();
      logger.logSystemMessage(`Loaded ${skillRegistry.listSkills().length} skills`);
    }

    // Create executor with skill registry
    const executor = new AgentExecutor(
      // ... existing parameters
      skillRegistry  // NEW
    );

    return { executor, cleanup };
  }
}
```

**Acceptance Criteria:**
- [ ] Builder supports .withSkillsFrom()
- [ ] Skills loaded during build
- [ ] Logged to console
- [ ] Backward compatible (optional)

**Estimated Time:** 3 hours

---

#### 2.6 Integration Tests

**File:** `packages/core/tests/unit/skills/agent-integration.test.ts`

```typescript
describe('Agent with Skills', () => {
  it('should load skills specified in agent frontmatter', async () => {
    const agent = await agentLoader.loadAgent('test-agent-with-skills');
    expect(agent.skills).toContain('test-skill');
  });

  it('should inject skill instructions into system prompt', async () => {
    const context = await setupContext(agent, skills);
    const systemPrompt = context.messages[0].content;
    expect(systemPrompt).toContain('# Available Skills');
    expect(systemPrompt).toContain('test-skill');
  });

  it('should work without skills (backward compatibility)', async () => {
    const agent = await agentLoader.loadAgent('test-agent-no-skills');
    expect(agent.skills).toBeUndefined();
    // Should execute normally
  });
});
```

**Acceptance Criteria:**
- [ ] Skills loaded and injected correctly
- [ ] Backward compatibility verified
- [ ] Error handling tested

**Estimated Time:** 4 hours

---

### Phase 2 Deliverables

- [x] Agent interface updated
- [x] Middleware context includes skills
- [x] AgentExecutor loads skills
- [x] ContextSetupMiddleware injects skills
- [x] AgentSystemBuilder supports skills
- [x] Integration tests pass
- [x] All existing tests still pass (backward compatibility)

**Total Estimated Time:** 17 hours (~1 week)

---

## Phase 3: Migration & Validation (Week 3)

**Goal:** Create initial skills and migrate existing agents

### Tasks

#### 3.1 Create Sample Skills Directory

**Location:** `packages/examples/udbud/skills/`

Create structure:
```
packages/examples/udbud/skills/
├── danish-tender-guidelines/
│   ├── SKILL.md
│   ├── reference/
│   │   ├── marker-system.md
│   │   ├── deadline-rules.md
│   │   └── format-validation.md
│   └── assets/
│       ├── analysis-template.md
│       └── checklist-template.md
├── complexity-calculator/
│   ├── SKILL.md
│   └── reference/
│       └── complexity-matrix.json
└── architecture-analyzer/
    ├── SKILL.md
    ├── reference/
    │   └── architecture-patterns.md
    └── assets/
        └── architecture-report.md
```

**Estimated Time:** 2 hours

---

#### 3.2 Extract Danish Tender Guidelines Skill

**Goal:** Extract Danish-specific knowledge from agents into reusable skill

**Source Files (extract from):**
- `packages/examples/udbud/agents/tender-orchestrator.md`
- `packages/examples/udbud/agents/technical-analyst.md`
- `packages/examples/udbud/agents/go-no-go-analyzer.md`
- `packages/examples/udbud/agents/response-preparation.md`

**Target File:** `packages/examples/udbud/skills/danish-tender-guidelines/SKILL.md`

```yaml
---
name: danish-tender-guidelines
description: Danish public tender (offentlig udbud) compliance rules and formatting
license: MIT
metadata:
  version: "1.0.0"
  author: "Niels Peter"
  tags: "tender,danish,compliance,formatting"
---

# Danish Tender Guidelines

Essential compliance rules for analyzing Danish public tenders.

## Marker System

All data must be marked for transparency. See reference/marker-system.md for complete rules.

Quick reference:
- **[FAKTA]** - Direct from tender material with source
- **[ESTIMAT]** - Your calculations/assessments
- **[INTERN VURDERING PÅKRÆVET]** - Requires internal assessment

⚠️ NEVER speculate about bidder's competency! Always mark as [INTERN VURDERING PÅKRÆVET].

## Output Format

Use assets/analysis-template.md as base structure.

Validate output with assets/checklist-template.md before finalizing.

## Detailed Documentation

- Marker system details: reference/marker-system.md
- Deadline calculation: reference/deadline-rules.md
- Format validation: reference/format-validation.md
```

**Acceptance Criteria:**
- [ ] All Danish-specific knowledge extracted
- [ ] Skill covers: markers, format, validation rules
- [ ] Templates included (if applicable)
- [ ] No Danish knowledge remains in agents (DRY)

**Estimated Time:** 6 hours

---

#### 3.3 Create Complexity Calculator Skill

**Target File:** `packages/examples/udbud/skills/complexity-calculator/SKILL.md`

```yaml
---
name: complexity-calculator
description: Software project complexity estimation methodology
license: MIT
metadata:
  version: "1.0.0"
  tags: "estimation,complexity,effort"
---

# Complexity Calculator

Methodology for estimating software development complexity.

## Complexity Factors

Evaluate on 1-10 scale:
1. Integration complexity
2. Data migration complexity
3. Security implementation
4. Performance requirements
5. Technical debt

## Detailed Methodology

For complete complexity matrix and scoring methodology, see reference/complexity-matrix.json.

## Estimation Formula

[Include complexity calculation method]
```

**Acceptance Criteria:**
- [ ] Complexity methodology documented
- [ ] Complexity matrix in reference/ directory (JSON)
- [ ] Reusable across tender types

**Estimated Time:** 4 hours

---

#### 3.4 Create Architecture Analyzer Skill

**Target File:** `packages/examples/udbud/skills/architecture-analyzer/SKILL.md`

```yaml
---
name: architecture-analyzer
description: Software architecture assessment methodology
license: MIT
metadata:
  version: "1.0.0"
  tags: "architecture,design,patterns"
---

# Architecture Analyzer

Systematic approach to analyzing software architecture.

## Assessment Dimensions

1. **Current State**
   - Architecture type (monolith, microservices, etc.)
   - Component breakdown
   - Integration points

2. **Target State**
   - Desired architecture
   - Migration path
   - Risks and dependencies

## Output Template

Use assets/architecture-report.md for standardized output format.

For detailed architecture patterns, see reference/architecture-patterns.md.
```

**Acceptance Criteria:**
- [ ] Architecture assessment framework
- [ ] Template in assets/ directory
- [ ] Reference patterns in reference/ directory
- [ ] Reusable across domains

**Estimated Time:** 4 hours

---

#### 3.5 Update Agents to Use Skills

Update these agents to reference skills:

**Files:**
- `packages/examples/udbud/agents/tender-orchestrator.md`
- `packages/examples/udbud/agents/technical-analyst.md`
- `packages/examples/udbud/agents/go-no-go-analyzer.md`
- `packages/examples/udbud/agents/response-preparation.md`

**Changes:**

```yaml
# Before
---
name: technical-analyst
tools: [read, write, list, grep]
thinking:
  enabled: true
  budget_tokens: 16000
---

You are a Technical Analyst...

[217 lines including 60 lines of Danish rules]
```

```yaml
# After
---
name: technical-analyst
tools: [read, write, list, grep]
skills: [danish-tender-guidelines, complexity-calculator, architecture-analyzer]
thinking:
  enabled: true
  budget_tokens: 16000
---

You are a Technical Analyst specialized in deep technical analysis for development teams.

Use available skills for domain expertise in:
- Danish tender compliance (markers, format, validation)
- Complexity calculation and effort estimation
- Architecture assessment and design evaluation

[150 lines - Danish rules removed, now in skill]
```

**Acceptance Criteria:**
- [ ] 4+ agents updated to reference skills
- [ ] Danish knowledge removed from agents
- [ ] Agents shortened by 20-30%
- [ ] Behavior unchanged (test with real tender)

**Estimated Time:** 6 hours

---

#### 3.6 Update udbud.ts Example

**File:** `packages/examples/udbud/udbud.ts`

```typescript
const system = await AgentSystemBuilder.default()
  .withProvidersConfig(providersConfig)
  .withAgentsFrom(path.join(__dirname, 'agents'))
  .withSkillsFrom(path.join(__dirname, 'skills'))  // NEW
  .build();
```

**Acceptance Criteria:**
- [ ] Skills directory configured
- [ ] Skills loaded at startup
- [ ] Logged to console

**Estimated Time:** 1 hour

---

#### 3.7 Validation Testing

Run full udbud workflow:

```bash
npm run udbud
```

**Validation Checklist:**
- [ ] Skills loaded successfully
- [ ] No errors during execution
- [ ] Output format correct (Danish markers present)
- [ ] Behavior identical to before
- [ ] Context size reduced (measure tokens)

**Estimated Time:** 4 hours

---

### Phase 3 Deliverables

- [x] 3 skills created (danish, complexity, architecture)
- [x] 4 agents migrated to use skills
- [x] udbud example updated
- [x] Full validation testing passed
- [x] Context size reduction measured

**Total Estimated Time:** 27 hours (~1 week)

---

## Phase 4: Documentation & Tooling (Week 4)

**Goal:** Complete documentation and developer tooling

### Tasks

#### 4.1 User Documentation

**File:** `docs/skills/USER-GUIDE.md`

Sections:
1. What are Skills?
2. When to use Skills vs Agents vs Tools
3. Creating your first skill
4. Skill structure and resources
5. Using skills in agents
6. Best practices
7. Troubleshooting

**Estimated Time:** 8 hours

---

#### 4.2 Migration Guide

**File:** `docs/skills/MIGRATION-GUIDE.md`

Sections:
1. Identifying extractable knowledge
2. Step-by-step extraction process
3. Testing after migration
4. Common pitfalls
5. Before/after examples

**Estimated Time:** 4 hours

---

#### 4.3 CLI Commands (Optional)

Add to existing CLI or new commands:

```bash
# List available skills
npm run agent -- skills:list

# Validate skill
npm run agent -- skills:validate danish-tender-guidelines

# Create new skill
npm run agent -- skills:create my-skill
```

**Estimated Time:** 8 hours (optional, defer if time-constrained)

---

#### 4.4 Update Main README

**File:** `README.md`

Add Skills section:
- Overview of Skills feature
- Link to detailed documentation
- Quick example

**Estimated Time:** 2 hours

---

#### 4.5 Create Examples Documentation

**File:** `docs/skills/EXAMPLES.md`

Include:
- Sample skills (Danish tender, Excel analysis, SQL query)
- Complete before/after agent examples
- Real-world use cases

**Estimated Time:** 4 hours

---

### Phase 4 Deliverables

- [x] User guide complete
- [x] Migration guide complete
- [x] README updated
- [x] Examples documented
- [x] (Optional) CLI commands

**Total Estimated Time:** 18-26 hours (~1 week)

---

## Total Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1: Core Infrastructure | 1 week | SkillLoader, SkillRegistry, validation |
| Phase 2: Agent Integration | 1 week | Middleware integration, AgentExecutor |
| Phase 3: Migration & Validation | 1 week | 3 skills, 4 agents migrated, tested |
| Phase 4: Documentation & Tooling | 1 week | User guide, migration guide, examples |
| **Total** | **4 weeks** | **Production-ready Skills system** |

**Total Estimated Hours:** 87-95 hours

---

## Risk Mitigation

### Risk 1: Integration Issues

**Mitigation:**
- Skills are optional in agent frontmatter
- Graceful degradation if skill not found
- Comprehensive unit and integration testing

**Validation:**
- All existing unit tests must pass
- Integration tests verify agents with and without skills
- Error handling tested for missing skills

---

### Risk 2: Performance Regression

**Mitigation:**
- Measure baseline performance before implementation
- Monitor skill loading time (<100ms target)
- Profile context size before/after

**Validation:**
- Benchmark agent startup time
- Track LLM token usage per invocation
- Identify and optimize bottlenecks

---

### Risk 3: Incomplete Migration

**Mitigation:**
- Start with 3 well-defined skills
- Migrate 4 agents completely
- Validate behavior unchanged

**Validation:**
- Run udbud example end-to-end
- Compare output before/after migration
- Verify all Danish markers present

---

### Risk 4: Poor Documentation

**Mitigation:**
- Write docs in Phase 4 (not as afterthought)
- Include real examples
- Get user feedback before v1

**Validation:**
- Another developer can create skill from docs
- Migration guide successfully followed
- No common questions unanswered

---

## Success Metrics

At Phase 3 completion, measure:

1. **Code Duplication**
   ```bash
   # Before: Count Danish rules in agents
   grep -r "\[FAKTA\]" packages/examples/udbud/agents/ | wc -l

   # After: Should be 0 (all in skill)
   grep -r "\[FAKTA\]" packages/examples/udbud/agents/ | wc -l
   ```

2. **Agent Size Reduction**
   ```bash
   # Before
   wc -l packages/examples/udbud/agents/technical-analyst.md
   # 217 lines

   # After
   wc -l packages/examples/udbud/agents/technical-analyst.md
   # ~150 lines (30% reduction)
   ```

3. **Context Size**
   - Measure tokens sent to LLM before/after
   - Target: 20-30% reduction

4. **Test Coverage**
   - Skills module: 90%+ coverage
   - No regression in existing tests

---

## Go/No-Go Checkpoints

### After Phase 1:
- [ ] All unit tests pass (skills module)
- [ ] SkillRegistry loads sample skills
- [ ] Code review approved
- **Decision:** Proceed to Phase 2?

### After Phase 2:
- [ ] Integration tests pass
- [ ] All existing tests pass (no regressions)
- [ ] Performance acceptable (<100ms overhead)
- **Decision:** Proceed to Phase 3?

### After Phase 3:
- [ ] udbud example runs successfully
- [ ] Output quality unchanged
- [ ] Context reduction measured (20-30%)
- **Decision:** Proceed to Phase 4 (documentation)?

### Before v1 Release:
- [ ] Documentation complete
- [ ] Migration guide validated
- [ ] No known critical bugs
- **Decision:** Release v1?

---

## Post-Implementation

### Immediate Next Steps (After v1):
1. Monitor usage in production
2. Collect developer feedback
3. Identify pain points
4. Plan v2 enhancements

### Future Enhancements (v2+):
1. **Dynamic Skill Loading** - Load skills based on task analysis
2. **Skill Dependencies** - Skills can require other skills
3. **Script Execution** - Safe execution of skill scripts
4. **Skill Versioning** - Handle version conflicts
5. **Skill Marketplace** - Share skills publicly

---

## Appendix A: File Checklist

### New Files Created

**Core:**
- [ ] `packages/core/src/skills/index.ts`
- [ ] `packages/core/src/skills/types.ts`
- [ ] `packages/core/src/skills/validation.ts`
- [ ] `packages/core/src/skills/loader.ts`
- [ ] `packages/core/src/skills/registry.ts`

**Tests:**
- [ ] `packages/core/tests/unit/skills/validation.test.ts`
- [ ] `packages/core/tests/unit/skills/loader.test.ts`
- [ ] `packages/core/tests/unit/skills/registry.test.ts`
- [ ] `packages/core/tests/unit/skills/agent-integration.test.ts`
- [ ] `packages/core/tests/test-fixtures/skills/` (sample skills)

**Documentation:**
- [ ] `docs/skills/PRD.md`
- [ ] `docs/skills/ARCHITECTURE.md`
- [ ] `docs/skills/IMPLEMENTATION-PLAN.md`
- [ ] `docs/skills/USER-GUIDE.md`
- [ ] `docs/skills/MIGRATION-GUIDE.md`
- [ ] `docs/skills/EXAMPLES.md`

**Example Skills:**
- [ ] `packages/examples/udbud/skills/danish-tender-guidelines/SKILL.md`
- [ ] `packages/examples/udbud/skills/complexity-calculator/SKILL.md`
- [ ] `packages/examples/udbud/skills/architecture-analyzer/SKILL.md`

### Modified Files

**Core:**
- [ ] `packages/core/src/agents/types.ts`
- [ ] `packages/core/src/agents/validation.ts`
- [ ] `packages/core/src/agents/executor.ts`
- [ ] `packages/core/src/middleware/middleware-types.ts`
- [ ] `packages/core/src/middleware/context-setup.middleware.ts`
- [ ] `packages/core/src/config/system-builder.ts`

**Agents:**
- [ ] `packages/examples/udbud/agents/tender-orchestrator.md`
- [ ] `packages/examples/udbud/agents/technical-analyst.md`
- [ ] `packages/examples/udbud/agents/go-no-go-analyzer.md`
- [ ] `packages/examples/udbud/agents/response-preparation.md`

**Examples:**
- [ ] `packages/examples/udbud/udbud.ts`

**Documentation:**
- [ ] `README.md`

---

## Appendix B: Testing Checklist

### Unit Tests (Phase 1)
- [ ] SkillFrontmatterSchema validates correctly
- [ ] SkillLoader loads valid skills
- [ ] SkillLoader rejects invalid skills
- [ ] SkillLoader loads templates
- [ ] SkillRegistry loads multiple skills
- [ ] SkillRegistry lookup works
- [ ] SkillRegistry filtering (tags, capabilities)

### Integration Tests (Phase 2)
- [ ] Agent with skills loads correctly
- [ ] Skills injected into system prompt
- [ ] Agent without skills field works normally
- [ ] Missing skill handled gracefully

### Validation Tests (Phase 3)
- [ ] udbud example runs end-to-end
- [ ] Output format correct (Danish markers)
- [ ] No errors in execution
- [ ] Context size reduced

### Regression Tests (All Phases)
- [ ] All existing unit tests pass
- [ ] All existing integration tests pass
- [ ] No breaking changes to public API

---

## Appendix C: Rollback Plan

If critical issues discovered during implementation:

1. **During Phase 1-2:** Revert feature branch, no impact on main
2. **During Phase 3:** Keep skill infrastructure, delay agent migration
3. **After Release:** Feature flag to disable skills, rollback if needed

**Rollback Commands:**
```bash
# Disable skills in production
export ENABLE_SKILLS=false

# Revert to previous version
git revert <commit-hash>

# Restore original agents
git checkout HEAD~1 -- packages/examples/udbud/agents/
```

# Dynamic Skills Implementation - Final Production Plan

**Branch:** feature/skills-dynamic
**Date:** 2025-10-26
**Approach:** Simple MVP with time-based cache
**Timeline:** 20-24 hours (3 days realistic)
**Philosophy:** Ship simple, measure, iterate

---

## Executive Summary

### What We're Building

A simple SkillTool that:
1. Loads skills on demand (Claude Code style)
2. Uses time-based cache (no context complexity)
3. Provides strong hints to guide agents
4. Handles errors gracefully
5. Tracks performance metrics

### Key Decisions

✅ **Simple time-based cache** - Prevents redundant loads without context management
✅ **Strong hints** - Guide agents to load required skills
✅ **Error handling** - Graceful failures with helpful messages
✅ **Performance tracking** - Measure from day 1
✅ **Test one agent first** - Validate before full migration

---

## Phase 1: Core Implementation (6 hours)

### 1.1 Create SkillTool with Cache (3 hours)

**File:** `packages/core/src/tools/builtin/skill.tool.ts`

```typescript
import { BaseTool, ToolResult } from '@/tools/base-tool';
import { SkillRegistry } from '@/skills/registry';
import { AgentLogger } from '@/logging';

export class SkillTool extends BaseTool {
  public readonly name = 'skill';
  public readonly description: string;

  // Simple time-based cache - no context needed!
  private cache = new Map<string, {content: string, loaded: number}>();
  private readonly CACHE_TTL = 300000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 20;

  // Performance metrics
  private metrics = {
    totalLoads: 0,
    cacheHits: 0,
    cacheMisses: 0,
    avgLoadTime: 0
  };

  constructor(
    private skillRegistry: SkillRegistry,
    private logger?: AgentLogger
  ) {
    super();
    this.description = this.generateDescription();
  }

  private generateDescription(): string {
    // Keep it concise - categories only
    return `Load specialized domain knowledge on-demand.

Usage: skill({name: "skill-name"})

Available categories:
  - Tender/Compliance: danish-tender-guidelines, uk-procurement
  - Estimation: complexity-calculator, story-points
  - Architecture: system-patterns, design-systems

The skill's instructions will be returned for use in your task.
Skills are cached for 5 minutes to improve performance.`;
  }

  async execute(input: {name?: string}): Promise<ToolResult> {
    const startTime = Date.now();

    // Input validation
    if (!input?.name) {
      return {
        success: false,
        output: 'Error: Skill name is required.\n\nUsage: skill({name: "skill-name"})'
      };
    }

    const skillName = input.name.trim().toLowerCase();
    if (!skillName) {
      return {
        success: false,
        output: 'Error: Skill name cannot be empty.'
      };
    }

    try {
      // Check cache first
      const cached = this.cache.get(skillName);
      if (cached && (Date.now() - cached.loaded < this.CACHE_TTL)) {
        this.metrics.cacheHits++;
        this.logMetrics('cache_hit', skillName, Date.now() - startTime);

        return {
          success: true,
          output: `${cached.content}\n\n*[Loaded from cache]*`
        };
      }

      // Load from registry
      const skill = this.skillRegistry.getSkill(skillName);
      if (!skill) {
        return this.skillNotFound(skillName);
      }

      // Format content
      const content = this.formatSkillContent(skill);

      // Cache it
      this.cache.set(skillName, {
        content: content,
        loaded: Date.now()
      });

      // Clean cache if too big
      if (this.cache.size > this.MAX_CACHE_SIZE) {
        this.cleanCache();
      }

      // Track metrics
      this.metrics.cacheMisses++;
      this.metrics.totalLoads++;
      const loadTime = Date.now() - startTime;
      this.metrics.avgLoadTime =
        (this.metrics.avgLoadTime * (this.metrics.totalLoads - 1) + loadTime) / this.metrics.totalLoads;

      this.logMetrics('cache_miss', skillName, loadTime);

      return {
        success: true,
        output: content
      };

    } catch (error) {
      this.logger?.logError(`Failed to load skill ${skillName}`, error);
      return {
        success: false,
        output: `Error loading skill: ${error.message}\n\nTry: skill({name: "skill-name"})`
      };
    }
  }

  private skillNotFound(name: string): ToolResult {
    const skills = this.skillRegistry.listSkills();

    // Find closest matches (simple string similarity)
    const closeMatches = skills
      .filter(s => s.name.includes(name) || name.includes(s.name))
      .slice(0, 3);

    let output = `Skill '${name}' not found.\n\n`;

    if (closeMatches.length > 0) {
      output += `Did you mean:\n`;
      closeMatches.forEach(s => {
        output += `  - ${s.name}: ${s.description}\n`;
      });
      output += '\n';
    }

    // Show available skills (limited)
    output += `Available skills:\n`;
    const availableSkills = skills.slice(0, 10);
    availableSkills.forEach(s => {
      output += `  - ${s.name}: ${s.description}\n`;
    });

    if (skills.length > 10) {
      output += `  ... and ${skills.length - 10} more\n`;
    }

    return {
      success: false,
      output: output
    };
  }

  private formatSkillContent(skill: any): string {
    let output = `# Skill Loaded: ${skill.name}\n\n`;

    if (skill.description) {
      output += `**Purpose:** ${skill.description}\n\n`;
    }

    output += `${'─'.repeat(60)}\n\n`;
    output += skill.instructions;
    output += `\n\n${'─'.repeat(60)}\n\n`;

    // Handle resources with correct paths
    const resources = skill.listResources?.() || {};
    if (Object.keys(resources).length > 0) {
      output += `## Available Resources\n\n`;

      if (resources.reference?.length) {
        output += `**Reference Documentation:** ${resources.reference.length} file(s)\n`;
        resources.reference.slice(0, 3).forEach(file => {
          // Use relative path from current working directory
          output += `  - Read: packages/examples/udbud/skills/${skill.name}/reference/${file}\n`;
        });
        if (resources.reference.length > 3) {
          output += `  ... and ${resources.reference.length - 3} more\n`;
        }
        output += '\n';
      }

      if (resources.assets?.length) {
        output += `**Templates/Assets:** ${resources.assets.length} file(s)\n`;
        resources.assets.slice(0, 3).forEach(file => {
          output += `  - Read: packages/examples/udbud/skills/${skill.name}/assets/${file}\n`;
        });
        if (resources.assets.length > 3) {
          output += `  ... and ${resources.assets.length - 3} more\n`;
        }
        output += '\n';
      }
    }

    output += `**Apply this knowledge to your current task.**`;

    return output;
  }

  private cleanCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.loaded > this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }

  private logMetrics(type: 'cache_hit' | 'cache_miss', skillName: string, loadTime: number): void {
    if (this.logger) {
      this.logger.logEvent('skill_load', {
        type,
        skill: skillName,
        loadTimeMs: loadTime,
        cacheHitRate: this.metrics.cacheHits / Math.max(1, this.metrics.totalLoads),
        avgLoadTimeMs: this.metrics.avgLoadTime
      });
    }
  }

  // Public method to get metrics
  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }
}
```

### 1.2 Update SkillRegistry (1 hour)

**File:** `packages/core/src/skills/registry.ts`

Add these methods:

```typescript
/**
 * Get a single skill by name (case-insensitive)
 */
getSkill(name: string): Skill | undefined {
  const normalized = name.trim().toLowerCase();

  // Try exact match first
  let skill = this.skills.get(normalized);

  // If not found, try to find by name property
  if (!skill) {
    for (const [key, s] of this.skills.entries()) {
      if (s.name.toLowerCase() === normalized) {
        skill = s;
        break;
      }
    }
  }

  return skill;
}

/**
 * List all skills for catalog
 */
listSkills(): Array<{name: string; description: string}> {
  return Array.from(this.skills.values())
    .map(skill => ({
      name: skill.name,
      description: skill.description || 'No description available'
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Check if skill exists
 */
hasSkill(name: string): boolean {
  return this.getSkill(name) !== undefined;
}

/**
 * Get skill count
 */
getSkillCount(): number {
  return this.skills.size;
}
```

### 1.3 Wire Into System (1 hour)

**File:** `packages/core/src/config/system-builder.ts`

```typescript
private registerBuiltInTools(): void {
  // ... existing tools ...

  // Register SkillTool if we have a skill registry
  if (this.skillRegistry && this.skillRegistry.getSkillCount() > 0) {
    const skillTool = new SkillTool(this.skillRegistry, this.logger);
    this.toolRegistry.registerTool(skillTool);

    // Add 'skill' to default tools
    if (!this.excludedTools.has('skill')) {
      this.defaultTools.add('skill');
    }

    this.logger?.logSystemMessage(
      `SkillTool registered with ${this.skillRegistry.getSkillCount()} available skills`
    );
  }
}
```

### 1.4 Write Tests (1 hour)

**File:** `packages/core/tests/unit/tools/skill.tool.test.ts`

```typescript
describe('SkillTool', () => {
  let skillTool: SkillTool;
  let mockRegistry: SkillRegistry;

  beforeEach(() => {
    mockRegistry = createMockRegistry();
    skillTool = new SkillTool(mockRegistry);
  });

  describe('Basic functionality', () => {
    it('should load existing skill');
    it('should handle non-existent skill');
    it('should handle empty skill name');
    it('should handle undefined input');
    it('should be case-insensitive');
  });

  describe('Caching', () => {
    it('should cache loaded skills');
    it('should use cached version within TTL');
    it('should reload after TTL expires');
    it('should clean cache when size exceeds limit');
  });

  describe('Error handling', () => {
    it('should handle registry errors gracefully');
    it('should provide helpful error messages');
    it('should suggest close matches');
  });

  describe('Performance', () => {
    it('should load skill in <50ms');
    it('should track metrics correctly');
    it('should calculate cache hit rate');
  });

  describe('Resource paths', () => {
    it('should format resource paths correctly');
    it('should limit resource listing');
  });
});
```

---

## Phase 2: Strong Hint System (2 hours)

### 2.1 Implement Strong Hints (1 hour)

**File:** `packages/core/src/middleware/context-setup.middleware.ts`

```typescript
function addSkillHints(prompt: string, systemPrompt: string): string {
  const hints: Array<{skill: string; reason: string; priority: 'required' | 'recommended'}> = [];

  // Danish tender patterns
  if (prompt.match(/danish|dansk|udbud|tender.*denmark|offentlig/i)) {
    hints.push({
      skill: 'danish-tender-guidelines',
      reason: 'Danish tender analysis requires compliance rules',
      priority: 'required'
    });
  }

  // Complexity patterns
  if (prompt.match(/complexity|estimate|effort|story.?point|sizing/i)) {
    hints.push({
      skill: 'complexity-calculator',
      reason: 'Estimation requires structured methodology',
      priority: 'recommended'
    });
  }

  // Architecture patterns
  if (prompt.match(/architecture|design|pattern|system.*structure/i)) {
    hints.push({
      skill: 'architecture-analyzer',
      reason: 'Architecture analysis benefits from patterns',
      priority: 'recommended'
    });
  }

  // Compliance patterns
  if (prompt.match(/compliance|requirement|mandatory|obligatory/i)) {
    hints.push({
      skill: 'compliance-checker',
      reason: 'Compliance checking needs validation rules',
      priority: 'required'
    });
  }

  if (hints.length === 0) {
    return systemPrompt;
  }

  // Add prominent hints section
  systemPrompt += '\n\n' + '═'.repeat(60) + '\n';
  systemPrompt += '⚠️  **SKILL REQUIREMENTS FOR THIS TASK**\n\n';

  // Required skills first
  const required = hints.filter(h => h.priority === 'required');
  if (required.length > 0) {
    systemPrompt += '**REQUIRED Skills (load these first):**\n\n';
    required.forEach((hint, i) => {
      systemPrompt += `${i + 1}. Load: skill({name: "${hint.skill}"})\n`;
      systemPrompt += `   Reason: ${hint.reason}\n\n`;
    });
  }

  // Recommended skills
  const recommended = hints.filter(h => h.priority === 'recommended');
  if (recommended.length > 0) {
    systemPrompt += '**RECOMMENDED Skills:**\n\n';
    recommended.forEach((hint, i) => {
      systemPrompt += `${i + 1}. Consider: skill({name: "${hint.skill}"})\n`;
      systemPrompt += `   Reason: ${hint.reason}\n\n`;
    });
  }

  systemPrompt += '**Load these skills BEFORE starting your analysis.**\n';
  systemPrompt += '═'.repeat(60) + '\n';

  return systemPrompt;
}
```

### 2.2 Test Hint System (1 hour)

```typescript
describe('Skill Hints', () => {
  it('should add required hints for Danish tender');
  it('should add recommended hints for complexity');
  it('should handle multiple hints');
  it('should not add hints for unrelated tasks');
  it('should prioritize required over recommended');
});
```

---

## Phase 3: Remove Static Loading (4 hours)

### 3.1 Update Schema (1 hour)
- Remove `skills` field from AgentFrontmatterSchema
- Update TypeScript types
- Fix type errors

### 3.2 Clean AgentLoader (1 hour)
- Remove skill loading logic
- Remove `loadedSkills` field
- Simplify loadAgent method

### 3.3 Clean Middleware (1 hour)
- Remove skill injection block
- Simplify system prompt generation

### 3.4 Update Logging (1 hour)
- Remove skills from logAgentStart
- Update all logger implementations
- Fix tests

---

## Phase 4: Test with One Agent (3 hours)

### 4.1 Update technical-analyst (1.5 hours)

```markdown
---
name: technical-analyst
tools: [read, write, grep, skill]
---

You are a Technical Analyst specializing in software evaluation.

## Dynamic Skill System

You have access to specialized domain knowledge through the `skill` tool.

### Skills for Your Role

**For Danish Tender Analysis:**
```
ALWAYS load first: skill({name: "danish-tender-guidelines"})
This provides compliance rules, marker system, and formatting standards.
```

**For Complexity Estimation:**
```
Load when needed: skill({name: "complexity-calculator"})
This provides estimation formulas and scoring matrices.
```

### How Skills Work

1. Skills are loaded on-demand when you need them
2. Once loaded, the knowledge is available for your entire conversation
3. Skills are cached for 5 minutes for efficiency
4. Apply skill knowledge to your analysis

### Example Workflow

```
User: "Analyze this Danish tender"

You: "I'll analyze this Danish tender. First, I need to load the guidelines."
You: skill({name: "danish-tender-guidelines"})
System: [Returns comprehensive guidelines]
You: "Now I'll apply these compliance rules to analyze the tender..."
[Proceed with analysis using the loaded knowledge]
```

## Your Process

1. **Understand the task** - Read and comprehend requirements
2. **Load required skills** - Based on task type
3. **Gather information** - Use Read, Grep tools
4. **Apply skill knowledge** - Use loaded expertise
5. **Deliver analysis** - Comprehensive results

Remember: Load skills at the START of your analysis, not midway through.
```

### 4.2 Test Agent Thoroughly (1.5 hours)

```typescript
describe('technical-analyst with dynamic skills', () => {
  it('should load Danish guidelines for tender tasks');
  it('should use cached skills on subsequent calls');
  it('should handle skill not found gracefully');
  it('should load multiple skills when needed');
  it('should apply loaded knowledge correctly');
});
```

---

## Phase 5: Full Migration (5 hours)

### 5.1 Migrate tender-orchestrator (1.5 hours)
### 5.2 Migrate go-no-go-analyzer (1.5 hours)
### 5.3 Migrate compliance-checker (1.5 hours)
### 5.4 Final Integration Tests (0.5 hours)

---

## Performance Monitoring

### Metrics to Track

```typescript
interface SkillMetrics {
  skillName: string;
  loadCount: number;
  cacheHits: number;
  cacheMisses: number;
  avgLoadTimeMs: number;
  agentName: string;
  timestamp: Date;
}
```

### Success Criteria

- ✅ Skills load in <50ms
- ✅ Cache hit rate >80% after warmup
- ✅ Agents load required skills >95% of time
- ✅ No memory leaks
- ✅ Error rate <1%

---

## Rollback Plan

### If Issues Arise

```bash
# Quick revert to static skills
git stash  # Save any debugging work
git checkout feature/skills-implementation
npm test   # Verify static works

# Or hot-fix
git cherry-pick [fix-commit]
```

### Keep Both Branches Ready

- `feature/skills-implementation` - Static (fallback)
- `feature/skills-dynamic` - Dynamic (new)

---

## Risk Mitigation

### High Priority Risks

1. **Agents don't load skills**
   - Mitigation: Strong hints + monitoring
   - Fallback: Add critical skills as required

2. **Performance degradation**
   - Mitigation: Time-based cache
   - Monitoring: Track load times

3. **Resource path issues**
   - Mitigation: Clear documentation
   - Testing: Verify all paths work

---

## Complete Test Suite

```typescript
// Unit Tests (10 tests minimum)
describe('SkillTool', () => {
  describe('Loading', () => {
    test('loads existing skill');
    test('handles missing skill');
    test('provides helpful errors');
  });

  describe('Caching', () => {
    test('caches skills');
    test('expires after TTL');
    test('cleans old entries');
  });

  describe('Performance', () => {
    test('loads in <50ms');
    test('tracks metrics');
  });
});

// Integration Tests (5 tests minimum)
describe('Agent Integration', () => {
  test('agent loads skills on demand');
  test('hints lead to skill loading');
  test('cache works across turns');
  test('resources accessible');
  test('error recovery works');
});

// End-to-End Tests (3 scenarios)
describe('E2E Scenarios', () => {
  test('Danish tender analysis workflow');
  test('Complexity estimation workflow');
  test('Multi-skill workflow');
});
```

---

## Documentation Updates

### Files to Update

1. `docs/skills.md` - Update for dynamic loading
2. `README.md` - Note dynamic skills
3. `CLAUDE.md` - Update examples
4. `CHANGELOG.md` - Document changes

---

## Success Metrics

### Day 1 Success
- [ ] SkillTool works with cache
- [ ] Tests pass
- [ ] Hints appear

### Day 2 Success
- [ ] Static loading removed
- [ ] technical-analyst works
- [ ] Performance acceptable

### Day 3 Success
- [ ] All agents migrated
- [ ] Integration tests pass
- [ ] Documentation complete

---

## Timeline Summary

### Day 1 (8 hours)
- Morning: SkillTool with cache (4h)
- Afternoon: Hints + remove static (4h)

### Day 2 (8 hours)
- Morning: Test technical-analyst (4h)
- Afternoon: Begin migration (4h)

### Day 3 (4-8 hours)
- Morning: Complete migration (4h)
- Afternoon: Testing + docs (optional 4h)

**Total: 20-24 hours**

---

## Start Implementation

```bash
# Step 1: Create SkillTool with cache
mkdir -p packages/core/src/tools/builtin
touch packages/core/src/tools/builtin/skill.tool.ts
touch packages/core/tests/unit/tools/skill.tool.test.ts

# Begin with the implementation above
```

**This plan is production-ready. Start with Phase 1.**
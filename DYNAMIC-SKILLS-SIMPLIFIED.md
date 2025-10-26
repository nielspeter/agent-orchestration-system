# Dynamic Skills Implementation - Simplified Progressive Approach

**Branch:** feature/skills-dynamic
**Date:** 2025-10-26
**Approach:** Simple MVP first, enhance iteratively
**Philosophy:** Ship fast, learn, iterate

---

## Core Strategy

### Start Simple, Add Complexity Only When Needed

**MVP (12 hours):** Basic skill loading, no cache, with hints
**Future:** Add caching if performance requires it
**Future:** Add auto-triggering if agents consistently forget

### Why This Works

1. **No blockers** - Avoids all context/cache complexity
2. **Ships in 2 days** - Not 2 weeks
3. **Real feedback** - See how agents actually behave
4. **Lower risk** - Simple = fewer bugs
5. **Claude Code style** - Manual loading preserved

---

## Phase 1: Simple Working Tool (4 hours)

### What We Build

**A basic SkillTool that just works:**
```typescript
export class SkillTool extends BaseTool {
  name = 'skill';
  description = 'Load specialized domain knowledge...';

  constructor(private skillRegistry: SkillRegistry) {
    super();
  }

  async execute(input: {name: string}): Promise<ToolResult> {
    const skill = this.skillRegistry.getSkill(input.name);

    if (!skill) {
      return this.skillNotFound(input.name);
    }

    return {
      success: true,
      output: this.formatSkillContent(skill)
    };
  }
}
```

**That's it.** No cache. No context. No complexity.

### Implementation Tasks

#### 1.1 Create SkillTool (2 hours)

**File:** `packages/core/src/tools/builtin/skill.tool.ts`

```typescript
import { BaseTool, ToolResult } from '@/tools/base-tool';
import { SkillRegistry } from '@/skills/registry';

export class SkillTool extends BaseTool {
  public readonly name = 'skill';
  public readonly description: string;

  constructor(private skillRegistry: SkillRegistry) {
    super();
    this.description = this.generateDescription();
  }

  private generateDescription(): string {
    // Keep it short - just categories, not full list
    return `Load specialized domain knowledge on-demand.

Usage: skill({name: "skill-name"})

Available categories:
  - Tender/Compliance: danish-tender-guidelines, uk-procurement
  - Estimation: complexity-calculator, story-points
  - Architecture: system-patterns, design-systems

Returns the skill's instructions and guidelines for use in your task.`;
  }

  async execute(input: {name: string}): Promise<ToolResult> {
    // Normalize name (trim, lowercase)
    const skillName = input.name.trim().toLowerCase();

    // Get skill from registry
    const skill = this.skillRegistry.getSkill(skillName);

    if (!skill) {
      return this.skillNotFound(skillName);
    }

    // Return formatted content
    return {
      success: true,
      output: this.formatSkillContent(skill)
    };
  }

  private skillNotFound(name: string): ToolResult {
    const skills = this.skillRegistry.listSkills();
    const suggestions = skills
      .slice(0, 10)  // Limit suggestions
      .map(s => `  - ${s.name}: ${s.description}`)
      .join('\n');

    return {
      success: false,
      output: `Skill '${name}' not found.

Available skills:
${suggestions}${skills.length > 10 ? `\n  ... and ${skills.length - 10} more` : ''}

Check the skill name and try again.`
    };
  }

  private formatSkillContent(skill: any): string {
    let output = `# Skill: ${skill.name}\n\n`;

    if (skill.description) {
      output += `**Purpose:** ${skill.description}\n\n`;
    }

    output += `---\n\n`;
    output += skill.instructions;
    output += `\n\n---\n\n`;

    // List resources if available
    const resources = skill.listResources?.() || {};
    if (Object.keys(resources).length > 0) {
      output += `## Available Resources\n\n`;

      if (resources.reference?.length) {
        output += `**Reference docs:** ${resources.reference.length} files\n`;
        output += `  Example: Read skills/${skill.name}/reference/[filename]\n\n`;
      }

      if (resources.assets?.length) {
        output += `**Templates/Assets:** ${resources.assets.length} files\n`;
        output += `  Example: Read skills/${skill.name}/assets/[filename]\n\n`;
      }
    }

    output += `**Skill loaded successfully. Apply this knowledge to your task.**`;

    return output;
  }
}
```

#### 1.2 Update SkillRegistry (1 hour)

**File:** `packages/core/src/skills/registry.ts`

Add these methods to existing registry:

```typescript
/**
 * Get a single skill by name (case-insensitive)
 */
getSkill(name: string): Skill | undefined {
  const normalized = name.trim().toLowerCase();
  return this.skills.get(normalized);
}

/**
 * List all skills for catalog (limited info)
 */
listSkills(): Array<{name: string, description: string}> {
  return Array.from(this.skills.values())
    .map(skill => ({
      name: skill.name,
      description: skill.description || 'No description'
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Check if skill exists
 */
hasSkill(name: string): boolean {
  return this.skills.has(name.trim().toLowerCase());
}
```

#### 1.3 Register Tool (1 hour)

**File:** `packages/core/src/config/system-builder.ts`

```typescript
private registerBuiltInTools(): void {
  // ... existing tools ...

  // Register SkillTool if we have a skill registry
  if (this.skillRegistry) {
    const skillTool = new SkillTool(this.skillRegistry);
    this.toolRegistry.registerTool(skillTool);

    // Add 'skill' to default tools
    if (!this.excludedTools.has('skill')) {
      this.defaultTools.add('skill');
    }
  }
}
```

---

## Phase 2: Add Safety Hints (2 hours)

### What We Build

**Gentle hints when task matches patterns:**

```typescript
// User: "Analyze this Danish tender"
// System adds hint: "💡 Consider loading skill: danish-tender-guidelines"
```

### Implementation

#### 2.1 Add Hint System (1 hour)

**File:** `packages/core/src/middleware/context-setup.middleware.ts`

```typescript
// After setting up system prompt, add hints
function addSkillHints(prompt: string, systemPrompt: string): string {
  const hints: string[] = [];

  // Danish tender patterns
  if (prompt.match(/danish|dansk|udbud|tender.*denmark/i)) {
    hints.push("danish-tender-guidelines");
  }

  // Complexity estimation patterns
  if (prompt.match(/complexity|estimate|effort|story.?point/i)) {
    hints.push("complexity-calculator");
  }

  // Architecture patterns
  if (prompt.match(/architecture|design|pattern|system.*design/i)) {
    hints.push("architecture-analyzer");
  }

  if (hints.length > 0) {
    systemPrompt += '\n\n💡 **Skill Hints**\n';
    systemPrompt += 'Based on your task, you might want to load:\n';
    hints.forEach(skill => {
      systemPrompt += `  - skill({name: "${skill}"})\n`;
    });
  }

  return systemPrompt;
}
```

#### 2.2 Test Hints (1 hour)

Write tests to verify hints appear correctly:

```typescript
test('adds hints for Danish tender tasks', () => {
  const prompt = "Analyze this Danish tender document";
  const enhanced = addSkillHints(prompt, basePrompt);
  expect(enhanced).toContain('danish-tender-guidelines');
});
```

---

## Phase 3: Remove Static Loading (3 hours)

### What We Remove

All the old static skill loading code.

#### 3.1 Clean Schema (30 min)

**File:** `packages/core/src/agents/validation.ts`

```diff
const AgentFrontmatterSchema = z.object({
  name: z.string(),
  tools: z.union([z.array(z.string()), z.literal('*')]),
- skills: z.array(z.string()).optional(),
  model: z.string().optional(),
  // ... rest
});
```

#### 3.2 Clean AgentLoader (1 hour)

**File:** `packages/core/src/agents/loader.ts`

Remove:
- Skill loading logic
- `loadedSkills` field
- Skills from constructor
- Any skill-related code

#### 3.3 Clean Middleware (30 min)

**File:** `packages/core/src/middleware/context-setup.middleware.ts`

Remove the skill injection block:
```diff
- // Inject skill instructions if any skills are loaded
- if (ctx.agent.loadedSkills && ctx.agent.loadedSkills.length > 0) {
-   systemPrompt += '\n\n## DOMAIN EXPERTISE (SKILLS)';
-   // ... skill injection code
- }
```

#### 3.4 Clean Logging (1 hour)

Remove `skills` parameter from all loggers:
- `logging/types.ts`
- `logging/console.logger.ts`
- `logging/jsonl.logger.ts`
- `logging/composite.logger.ts`

---

## Phase 4: Test with One Agent (2 hours)

### Pick Test Agent: technical-analyst

#### 4.1 Update Agent (1 hour)

**File:** `packages/examples/udbud/agents/technical-analyst.md`

```markdown
---
name: technical-analyst
tools: [read, write, grep, skill]
---

You are a Technical Analyst specializing in software evaluation.

## Skill System

You have access to specialized knowledge via the `skill` tool.

**Available skills for your role:**
- `danish-tender-guidelines` - Load when analyzing Danish tenders
- `complexity-calculator` - Load when estimating effort/complexity

**How to use:**
1. Identify what knowledge you need
2. Load it: skill({name: "skill-name"})
3. Apply the knowledge to your task

**Example workflow:**
```
Task: "Analyze Danish tender"
You: skill({name: "danish-tender-guidelines"})
System: [Returns guidelines]
You: Now I'll apply these rules...
```

## Your Process

1. Read and understand the task
2. Load relevant skills if needed
3. Gather information using tools
4. Apply skill knowledge
5. Deliver comprehensive analysis
```

#### 4.2 Test Agent (1 hour)

```typescript
test('technical-analyst loads skills dynamically', async () => {
  const result = await executor.execute(
    'technical-analyst',
    'Analyze this Danish tender for compliance'
  );

  // Should load skill
  expect(result).toContain('skill({name: "danish-tender-guidelines"})');

  // Should receive content
  expect(result).toContain('Skill: danish-tender-guidelines');

  // Should apply knowledge
  expect(result).toContain('[FAKTA]');
});
```

---

## Phase 5: Migrate Remaining Agents (3 hours)

If test agent works well, migrate the other 3:

### 5.1 tender-orchestrator (1 hour)
- Add `skill` to tools
- Remove `skills:` field
- Add skill usage instructions

### 5.2 go-no-go-analyzer (1 hour)
- Same updates
- Focus on decision-making skills

### 5.3 compliance-checker (1 hour)
- Same updates
- Emphasize compliance skills

---

## Testing Strategy

### Unit Tests (Must Have)

```typescript
describe('SkillTool', () => {
  test('loads existing skill');
  test('handles non-existent skill');
  test('formats content correctly');
  test('lists available skills on error');
  test('handles empty skill name');
  test('is case-insensitive');
});

describe('Hints', () => {
  test('adds hint for Danish tender');
  test('adds hint for complexity');
  test('adds no hints for unrelated tasks');
  test('adds multiple hints when relevant');
});
```

### Integration Tests (Critical)

```typescript
test('end-to-end skill loading', async () => {
  // Agent loads skill and uses it
  const result = await executor.execute(
    'technical-analyst',
    'Estimate complexity of this system'
  );

  expect(result).toContain('skill({name: "complexity-calculator"})');
  expect(result).toContain('Story points:');
});
```

### Manual Testing Checklist

- [ ] Agent loads skill when needed
- [ ] Hints appear for relevant tasks
- [ ] Error messages are helpful
- [ ] Skills content formats well
- [ ] Agent applies skill knowledge
- [ ] No performance issues

---

## Success Metrics

### Must Have (MVP)
- [ ] SkillTool works
- [ ] Agents can load skills
- [ ] Hints guide agents
- [ ] Tests pass
- [ ] No static loading

### Nice to Have (Later)
- [ ] Cache for performance
- [ ] Auto-triggering
- [ ] Skill dependencies
- [ ] Usage analytics

---

## Timeline

### Day 1 (8 hours)

**Morning (4 hours):**
- Hour 1-2: Create SkillTool
- Hour 3: Update SkillRegistry
- Hour 4: Wire into system

**Afternoon (4 hours):**
- Hour 5-6: Add hint system
- Hour 7: Remove static loading
- Hour 8: Update & test technical-analyst

### Day 2 (4 hours)

**Morning (4 hours):**
- Hour 9: Migrate tender-orchestrator
- Hour 10: Migrate go-no-go-analyzer
- Hour 11: Migrate compliance-checker
- Hour 12: Final testing & documentation

**Total: 12 hours**

---

## Risk Mitigation

### Risk: Agents Don't Load Skills

**Mitigation:**
- Hints guide them
- Clear instructions
- Test thoroughly
- Can add stronger hints if needed

### Risk: Performance Issues

**Mitigation:**
- Measure first
- Skills are small (~1-5KB)
- Can add cache later if needed
- Not blocking MVP

### Risk: Complex Edge Cases

**Mitigation:**
- Start simple
- Handle basics well
- Enhance iteratively
- Don't over-engineer

---

## Future Enhancements (Not Now)

### Phase 6: Add Caching (If Needed)
```typescript
// Simple in-memory cache
const skillCache = new Map<string, string>();

execute(input) {
  const cached = skillCache.get(input.name);
  if (cached) return cached;
  // ... load and cache
}
```

### Phase 7: Auto-Triggering (If Needed)
- Pattern matching
- Confidence scoring
- Auto-injection

### Phase 8: Analytics (If Needed)
- Track skill usage
- Measure performance
- Optimize common patterns

---

## Key Decisions

### What We're Building
✅ Simple SkillTool - no cache
✅ Helpful hints - not auto-loading
✅ Clear agent instructions
✅ Test with one agent first

### What We're NOT Building (Yet)
❌ Caching system
❌ Auto-triggering
❌ Complex context management
❌ Skill dependencies

### Why This Works
- Ships in 2 days
- Solves the core need
- Low risk
- Can enhance later
- Real usage data

---

## Implementation Checklist

### Phase 1: Basic Tool ✅
- [ ] Create skill.tool.ts
- [ ] Write execute() method
- [ ] Format output nicely
- [ ] Handle errors well

### Phase 2: Safety ✅
- [ ] Add hint system
- [ ] Test hints work
- [ ] Not too intrusive

### Phase 3: Cleanup ✅
- [ ] Remove skills from schema
- [ ] Remove from loader
- [ ] Remove from middleware
- [ ] Clean logging

### Phase 4: Test Agent ✅
- [ ] Update technical-analyst
- [ ] Test thoroughly
- [ ] Verify works well

### Phase 5: Full Migration ✅
- [ ] Update all agents
- [ ] Test each one
- [ ] Document changes

---

## Start Here

**Step 1:** Create the SkillTool

```bash
# Create file
touch packages/core/src/tools/builtin/skill.tool.ts

# Start with simplest implementation
# No cache, no complexity
# Just load and return
```

**Step 2:** Test immediately

```bash
# Create test
touch packages/core/tests/unit/tools/skill.tool.test.ts

# Test the basics work
```

**Step 3:** Iterate

Get basic version working, then enhance.

---

## Summary

**Simple plan that ships in 2 days:**

1. Basic SkillTool (4 hours)
2. Helpful hints (2 hours)
3. Remove old code (3 hours)
4. Test one agent (2 hours)
5. Migrate others (3 hours)

**Total: 12 hours of focused work**

No complex caching. No context management issues. Just a tool that loads skills.

**Ready to build!**
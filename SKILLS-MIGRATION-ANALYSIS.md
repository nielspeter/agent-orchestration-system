# Skills System: Static vs Dynamic Implementation Analysis

**Date:** 2025-10-26
**Status:** Evaluation Phase
**Current Implementation:** Static/Build-Time (Phase 1-4 Complete)
**Proposed Alternative:** Dynamic/Runtime (Not Implemented)

---

## Executive Summary

We have **two implementation approaches** for the skills system:

| Aspect | Static (Current) | Dynamic (Proposed) |
|--------|------------------|-------------------|
| **Status** | ✅ Complete (Phases 1-4) | ❌ Not Started |
| **Skills Location** | Agent frontmatter | Runtime tool |
| **When Loaded** | Agent initialization | On-demand |
| **Token Cost** | High (repeated) | Low (load once) |
| **Complexity** | Simple | Moderate |
| **Effort to Switch** | N/A | 24-32 hours |
| **Breaking Changes** | N/A | Yes (all agents) |

**Key Question:** Is the token efficiency gain worth rewriting what we just completed?

---

## Current State Analysis (Static Implementation)

### Architecture

```
Agent Frontmatter
  ↓
  skills: [danish-tender-guidelines]
  ↓
AgentLoader.loadAgent()
  ↓
SkillRegistry.getSkills([...])
  ↓
Agent.loadedSkills = [...]
  ↓
ContextSetupMiddleware
  ↓
Inject skills into system prompt
  ↓
EVERY LLM call includes skills
```

### Current Codebase Stats

**Agents:** 4 agents using skills
- `tender-orchestrator.md`
- `technical-analyst.md`
- `go-no-go-analyzer.md`
- `compliance-checker.md`

**Skills:** 3 skills created
- `danish-tender-guidelines`: 228 lines (~912 tokens)
- `complexity-calculator`: 414 lines (~1,656 tokens)
- `architecture-analyzer`: 591 lines (~2,364 tokens)

**Test Coverage:** 97.95% (67 unit, 4 integration tests)

**Implementation Status:** Phase 1-4 Complete ✅

### How It Works (Static)

**Agent Frontmatter:**
```yaml
---
name: technical-analyst
tools: [read, write, grep]
skills:
  - danish-tender-guidelines
---
```

**System Prompt (Generated):**
```
You are a Technical Analyst...

## DOMAIN EXPERTISE (SKILLS)

### danish-tender-guidelines
*Danish public tender compliance rules*

[Full 912 tokens of skill content...]

## SYSTEM INSTRUCTIONS
[Rest of prompt...]
```

**Result:** Skills are present in EVERY message to the LLM

### Token Economics (Static)

**Single Agent (danish-tender-guidelines only):**
- Skill size: 912 tokens
- 10-message conversation: 912 × 10 = **9,120 tokens**
- Cost per conversation: ~$0.01 (input tokens)

**Multi-Skill Agent (all 3 skills):**
- Total skills: 4,932 tokens
- 10-message conversation: 4,932 × 10 = **49,320 tokens**
- Cost per conversation: ~$0.06 (input tokens)

**Annual Cost Estimate (100 conversations/day):**
- Single skill: 9,120 × 100 × 365 = 332M tokens/year = **$4,000/year**
- Multi-skill: 49,320 × 100 × 365 = 1.8B tokens/year = **$21,600/year**

### Pros (Static)

✅ **Simple & Predictable**
- Straightforward implementation
- Agent always has needed knowledge
- No runtime decisions needed

✅ **Complete Implementation**
- All 4 phases done
- 97.95% test coverage
- Production ready

✅ **No Agent Changes Required**
- Agent just uses the knowledge
- No tool calls needed
- Works immediately

✅ **Guaranteed Availability**
- Knowledge always present
- No "forgot to load" errors
- Consistent behavior

### Cons (Static)

❌ **Token Inefficiency**
- Skills in EVERY message
- Pay for repeated context
- Scales poorly (10+ skills)

❌ **Fixed Per Agent**
- Can't load different skills per task
- All skills or nothing
- No runtime flexibility

❌ **Context Window Waste**
- Large skills reduce available context
- May hit limits on complex tasks
- Inefficient for simple queries

---

## Proposed State Analysis (Dynamic Implementation)

### Architecture

```
Agent Starts (No Skills)
  ↓
Receives Task
  ↓
Decides if needs domain knowledge
  ↓
Calls skill tool: skill({name: "danish-tender-guidelines"})
  ↓
SkillTool.execute()
  ↓
SkillRegistry.getSkill(name)
  ↓
Return skill content as tool result
  ↓
Skill added to conversation context
  ↓
Agent uses knowledge in this conversation only
```

### How It Would Work (Dynamic)

**Agent Frontmatter:**
```yaml
---
name: technical-analyst
tools: [read, write, grep, skill]  # Note: 'skill' tool added
# No skills field!
---
```

**Agent Instructions (Updated):**
```markdown
You are a Technical Analyst...

## Available Domain Knowledge

You have access to skills via the `skill` tool:
- danish-tender-guidelines: Load when analyzing Danish tenders
- complexity-calculator: Load when estimating effort

When to load:
- Analyzing Danish tender → Load danish-tender-guidelines
- Estimating complexity → Load complexity-calculator
- Simple queries → No skills needed

## Your Process
1. Analyze task
2. Determine if specialized knowledge needed
3. Load relevant skill(s) via skill tool
4. Apply knowledge to task
```

**Runtime Behavior:**
```
User: "Analyze this Danish tender for compliance"
  ↓
Agent: "I need Danish tender knowledge"
  ↓
Agent: skill({name: "danish-tender-guidelines"})
  ↓
System: [Returns 912 tokens of skill content]
  ↓
Agent: [Uses knowledge to analyze]
  ↓
Subsequent messages: Skill still in context
```

### Token Economics (Dynamic)

**Single Agent (danish-tender-guidelines):**
- Skill loaded once: 912 tokens
- 10-message conversation: 912 × 1 = **912 tokens** (first message) + 0 × 9 = **912 tokens total**
- Cost per conversation: ~$0.001 (input tokens)
- **Savings: 90% vs static** (9,120 → 912 tokens)

**Multi-Skill Agent (loads 2 skills):**
- Skills loaded once: 2,568 tokens (danish + complexity)
- 10-message conversation: **2,568 tokens total**
- Cost per conversation: ~$0.003
- **Savings: 95% vs static** (49,320 → 2,568 tokens)

**Annual Cost Estimate (100 conversations/day):**
- Single skill: 912 × 100 × 365 = 33M tokens/year = **$400/year** (was $4,000)
- Multi-skill: 2,568 × 100 × 365 = 94M tokens/year = **$1,100/year** (was $21,600)

**Total Savings:**
- Single skill: **$3,600/year (90% reduction)**
- Multi-skill: **$20,500/year (95% reduction)**

### Pros (Dynamic)

✅ **Token Efficiency**
- Load once per conversation
- 90-95% token reduction
- Huge cost savings at scale

✅ **Runtime Flexibility**
- Different skills per task
- Load only what's needed
- Adaptive behavior

✅ **Scalable**
- Can have 50+ skills without bloat
- Agent chooses relevant ones
- No context window waste

✅ **Human-Like Behavior**
- Requests knowledge when needed
- More realistic agent autonomy
- Matches Claude Code approach

✅ **Optional Auto-Trigger**
- Can auto-load based on keywords
- Best of both worlds
- Configurable behavior

### Cons (Dynamic)

❌ **Rework Required**
- 24-32 hours implementation
- Throws away Phase 1-4 work
- Breaking change to all agents

❌ **Added Complexity**
- Agent must "know" to load skills
- More complex instructions
- Potential for "forgot to load" errors

❌ **Testing Burden**
- Rewrite all skills tests
- Update integration tests
- Validate agent behavior

❌ **Unpredictable Behavior**
- Agent might not load skill
- Different per conversation
- Harder to debug

❌ **Requires Good Instructions**
- Agent must be told when to load
- Risk of confusion
- Need comprehensive agent docs

---

## Code Changes Required (Detailed)

### Files to CREATE (5-7 files)

#### 1. Core Dynamic Loading (Required)

**`packages/core/src/tools/builtin/skill.tool.ts`** (~250 lines)
```typescript
/**
 * SkillTool - Load domain expertise on-demand
 */
export class SkillTool extends BaseTool {
  name = 'skill';
  description = `Load domain expertise and specialized knowledge...

Available Skills:
{{DYNAMIC_CATALOG}}

Examples:
- Load tender guidelines: skill({name: "danish-tender-guidelines"})
- Load complexity formulas: skill({name: "complexity-calculator"})
`;

  async execute(input: {name: string}): Promise<ToolResult> {
    const skill = this.skillRegistry.getSkill(input.name);

    if (!skill) {
      return {
        success: false,
        output: `Skill "${input.name}" not found.\n\nAvailable skills:\n${this.listSkills()}`
      };
    }

    // Return skill content
    return {
      success: true,
      output: `# ${skill.name}\n\n${skill.instructions}`
    };
  }
}
```

**`packages/core/tests/unit/tools/skill.tool.test.ts`** (~200 lines)
```typescript
describe('SkillTool', () => {
  test('should load skill by name');
  test('should return skill content');
  test('should list available skills when not found');
  test('should include resource discovery');
  test('should handle dynamic catalog generation');
});
```

#### 2. Auto-Triggering (Optional, +12-16 hours)

**`packages/core/src/skills/auto-trigger.ts`** (~300 lines)
```typescript
/**
 * Pattern matching engine for auto-loading skills
 */
export class SkillAutoTrigger {
  analyzeTask(task: string): SkillTrigger[] {
    // Extract keywords from task
    // Match against skill descriptions
    // Return confidence-scored matches
  }
}
```

**`packages/core/src/middleware/skill-auto-trigger.middleware.ts`** (~150 lines)
```typescript
/**
 * Middleware to auto-load skills based on task
 */
export function createSkillAutoTriggerMiddleware(): Middleware {
  // Analyze first user message
  // Match to skills
  // Inject high-confidence matches
}
```

**`packages/core/tests/unit/skills/auto-trigger.test.ts`** (~200 lines)
```typescript
describe('SkillAutoTrigger', () => {
  test('should match keywords');
  test('should calculate confidence');
  test('should handle no matches');
});
```

### Files to MODIFY (13 files)

#### Core System Changes

**1. `packages/core/src/agents/validation.ts`** (-15 lines)
```diff
export const AgentFrontmatterSchema = z.object({
  name: z.string(),
  tools: z.union([z.array(z.string()), z.literal('*')]).optional(),
- skills: z.array(z.string()).optional(),
  model: z.string().optional(),
  // ...
});
```

**2. `packages/core/src/agents/loader.ts`** (-40 lines)
```diff
  async loadAgent(name: string): Promise<Agent> {
    // ... load frontmatter ...

-   // Load skills if specified
-   const loadedSkills =
-     validated.skills && this.skillRegistry
-       ? this.skillRegistry.getSkills(validated.skills)
-       : undefined;
-
-   if (loadedSkills && loadedSkills.length > 0) {
-     this.logger?.logSystemMessage(
-       `Loaded ${loadedSkills.length} skill(s)...`
-     );
-   }

    return {
      // ...
-     skills: validated.skills,
-     loadedSkills,
    };
  }
```

**3. `packages/core/src/middleware/context-setup.middleware.ts`** (-20 lines)
```diff
  let systemPrompt = ctx.agent.description;

- // Inject skill instructions if any skills are loaded
- if (ctx.agent.loadedSkills && ctx.agent.loadedSkills.length > 0) {
-   systemPrompt += '\n\n## DOMAIN EXPERTISE (SKILLS)';
-   for (const skill of ctx.agent.loadedSkills) {
-     systemPrompt += `\n### ${skill.name}`;
-     systemPrompt += `\n\n${skill.instructions}\n`;
-   }
- }

  systemPrompt += '\n\n## SYSTEM INSTRUCTIONS';
```

**4. `packages/core/src/config/system-builder.ts`** (+30 lines)
```diff
  build(): Promise<BuildResult> {
    // Register all tools
    this.registerBuiltInTools();
+   this.registerSkillTool();  // NEW

    // ... rest of build ...
  }

+ private registerSkillTool(): void {
+   if (this.skillRegistry) {
+     const skillTool = new SkillTool(this.skillRegistry);
+     this.toolRegistry.registerTool(skillTool);
+   }
+ }
```

**5. `packages/core/src/skills/registry.ts`** (+40 lines)
```diff
  export class SkillRegistry {
    async loadSkills(): Promise<void> {
      // Existing implementation
    }

    getSkills(names: string[]): Skill[] {
      // Existing implementation
    }
+
+   // NEW: Single skill getter
+   getSkill(name: string): Skill | undefined {
+     return this.skills.get(name);
+   }
+
+   // NEW: List all skills for catalog
+   listSkills(): SkillMetadata[] {
+     return Array.from(this.skills.values()).map(s => ({
+       name: s.name,
+       description: s.description
+     }));
+   }
  }
```

**6. `packages/core/src/logging/types.ts`** (-3 lines)
```diff
  interface AgentLogger {
    logAgentStart(
      agentName: string,
      tools: string[],
-     skills?: string[]
    ): void;
  }
```

**7-11. Logging Implementations** (-5 lines each)
- `console.logger.ts`
- `jsonl.logger.ts`
- `composite.logger.ts`
- Remove `skills` parameter from all logAgentStart implementations

#### Agent Files (4 files × 10 min each)

**12. `packages/examples/udbud/agents/technical-analyst.md`**
```diff
  ---
  name: technical-analyst
- tools: [read, write, grep]
+ tools: [read, write, grep, skill]
- skills:
-   - danish-tender-guidelines
  ---

  You are a Technical Analyst...

+ ## Available Domain Knowledge
+
+ Load skills via the `skill` tool when needed:
+ - danish-tender-guidelines: For Danish tender analysis
+
+ **When to load:**
+ - Analyzing Danish tender → Load danish-tender-guidelines
+ - General analysis → Proceed without skills

  ## Your Process

  1. Read the task
+ 2. Determine if specialized knowledge needed
+ 3. Load relevant skill if needed: skill({name: "skill-name"})
- 2. Apply Danish tender guidelines
+ 4. Apply skill guidelines to your work
```

**13. Similar updates for:**
- `tender-orchestrator.md`
- `go-no-go-analyzer.md`
- `compliance-checker.md`

#### Test Files

**14. `packages/core/tests/integration/skills-system/*.ts`** (Rewrite)
```diff
  test('agent uses skills', async () => {
-   // Agent has skills pre-loaded
+   // Agent loads skills via tool
    const result = await executor.execute(
      'technical-analyst',
      'Analyze Danish tender'
    );

-   expect(result).toContain('[FAKTA]');  // Skill was used
+   // Verify agent called skill tool
+   expect(result).toContain('skill tool');
+   expect(result).toContain('danish-tender-guidelines');
  });
```

**15. Unit test updates** (10+ files)
- Remove skills from test agents
- Update system-builder tests
- Add SkillTool tests

### Total Code Impact

**New Code:**
- Core implementation: ~450 lines
- Auto-trigger (optional): ~650 lines
- Tests: ~400 lines
- **Total new: ~1,500 lines**

**Deleted Code:**
- Static loading: ~80 lines
- Skills from agents: ~20 lines
- Test updates: ~40 lines
- **Total deleted: ~140 lines**

**Modified Code:**
- Agent instructions: ~160 lines changed
- Test updates: ~200 lines changed
- **Total modified: ~360 lines**

**Net Impact: +1,360 lines, 15 files modified, 5-7 files created**

---

## Migration Complexity Assessment

### Effort Breakdown

| Phase | Tasks | Hours | Risk |
|-------|-------|-------|------|
| **Phase 1: SkillTool** | Create tool, register, test | 4-6h | Low |
| **Phase 2: Remove Static** | Delete old code, update schema | 3-4h | Medium |
| **Phase 3: Update Agents** | Rewrite 4 agents, instructions | 2-3h | Medium |
| **Phase 4: Auto-Trigger** | Pattern matching, middleware | 12-16h | High |
| **Phase 5: Testing** | Unit + integration tests | 3-4h | Medium |
| **Total (Core Only)** | Phases 1-3 | **12-16h** | **Medium** |
| **Total (Full)** | Phases 1-5 | **24-32h** | **Medium-High** |

### Risk Analysis

#### Implementation Risks

**Medium Risk:**
- ⚠️ Agent behavior changes (must learn to load skills)
- ⚠️ Test suite needs major updates
- ⚠️ Breaking change affects all users
- ⚠️ Auto-trigger pattern matching might fail

**Low Risk:**
- ✅ Core SkillTool is straightforward
- ✅ SkillRegistry already has most logic
- ✅ SKILL.md format unchanged

#### Migration Risks

**High Risk:**
- ⚠️ Agents might not load skills when needed
- ⚠️ Instructions must be perfect
- ⚠️ Harder to debug skill issues
- ⚠️ Loss of predictable behavior

**Mitigation:**
- Clear agent instructions
- Comprehensive testing
- Fallback to static for critical agents
- Optional auto-trigger helps

### What We'd Lose

1. **Time Investment** - 24-32 hours to complete Phase 1-4
2. **Working System** - Current implementation is production-ready
3. **Simplicity** - Static approach is easier to understand
4. **Predictability** - Skills always present, no surprises

### What We'd Gain

1. **Token Efficiency** - 90-95% reduction ($3,600-$20,500/year savings)
2. **Flexibility** - Different skills per task
3. **Scalability** - Support 50+ skills easily
4. **Claude Code Alignment** - Match Anthropic's approach

---

## Trade-offs Analysis

### When Static Makes Sense

✅ **Choose Static If:**
- Few skills (1-5)
- Known skill requirements per agent
- Simplicity valued over efficiency
- Predictable behavior critical
- Quick time-to-market needed
- **This describes our current situation**

### When Dynamic Makes Sense

✅ **Choose Dynamic If:**
- Many skills (10+)
- Variable skill needs per task
- Token cost is significant
- Runtime flexibility needed
- Scaling to many domains
- **This describes future state with 20+ skills**

### Hybrid Approach (Possible)

**Could we have both?**

```yaml
---
name: technical-analyst
tools: [read, write, skill]
skills:
  - danish-tender-guidelines  # Pre-load (critical)
# Agent can also load additional skills via tool
---
```

**Pros:**
- Guaranteed core knowledge
- Optional dynamic loading
- Best of both worlds

**Cons:**
- More complex implementation
- Adds +8 hours development
- Harder to reason about

---

## Token Cost Analysis (Detailed)

### Scenario 1: Low Volume (Current State)

**Assumptions:**
- 10 conversations/day
- 10 messages per conversation
- 1 skill per agent (danish-tender-guidelines, 912 tokens)

**Static:**
- Daily: 10 conv × 10 msg × 912 tokens = 91,200 tokens
- Monthly: 91,200 × 30 = 2.7M tokens
- Annual: 2.7M × 12 = 33M tokens
- **Cost: $400/year** (at $0.012/M input tokens)

**Dynamic:**
- Daily: 10 conv × 1 load × 912 tokens = 9,120 tokens
- Monthly: 9,120 × 30 = 274K tokens
- Annual: 274K × 12 = 3.3M tokens
- **Cost: $40/year**
- **Savings: $360/year (90%)**

**Verdict:** Not worth 24-32 hours for $360/year savings

### Scenario 2: Medium Volume (Projected Growth)

**Assumptions:**
- 100 conversations/day
- 10 messages per conversation
- 1 skill per agent

**Static:**
- Annual: 333M tokens = **$4,000/year**

**Dynamic:**
- Annual: 33M tokens = **$400/year**
- **Savings: $3,600/year (90%)**

**Verdict:** 24-32 hours = $1,200-$1,600 in time, break-even in 4-6 months

### Scenario 3: High Volume Multi-Skill (Future)

**Assumptions:**
- 500 conversations/day
- 15 messages per conversation
- 3 skills per agent (4,932 tokens total)

**Static:**
- Annual: 13.6B tokens = **$163,000/year**

**Dynamic:**
- Annual: 902M tokens = **$11,000/year**
- **Savings: $152,000/year (93%)**

**Verdict:** ROI in 5 days, definitely worth it

### Break-Even Analysis

**Development Cost:**
- 24 hours @ $50/hour = $1,200
- 32 hours @ $50/hour = $1,600

**Volume needed to justify:**
- At 10 conv/day: Never (need 4,200 days to break even)
- At 100 conv/day: 4-6 months
- At 500 conv/day: 5 days

**Current reality:** We're at ~10 conv/day

---

## Recommendation

### Data-Driven Decision

**Current State:**
- ✅ 4 agents
- ✅ 3 skills
- ✅ ~10 conversations/day
- ✅ Production ready
- ✅ 97.95% test coverage
- ✅ Phase 1-4 complete

**Cost Reality:**
- Current annual cost: ~$400/year
- Dynamic savings: ~$360/year
- Development cost: $1,200-$1,600
- **Break-even: Never (at current volume)**

### Recommendation: **KEEP STATIC FOR NOW**

**Rationale:**

1. **Cost Not Justified** - $360/year savings doesn't justify 24-32 hours rework
2. **Working System** - Current implementation is production-ready
3. **Low Volume** - Only ~10 conversations/day currently
4. **Few Skills** - Only 3 skills, 4 agents using them
5. **Time Investment** - Already spent time building Phase 1-4

### Future Trigger Points

**Reevaluate Dynamic When:**

1. **Volume Threshold:** >100 conversations/day (then ROI positive)
2. **Skills Threshold:** >10 skills total (context efficiency matters)
3. **Multi-Skill Agents:** Agents regularly using 3+ skills
4. **Token Cost:** Monthly token costs >$500/month
5. **User Feedback:** Users complain about slow responses (token loading)

### Alternative: Plan for Future

**Keep Dynamic Plan But Don't Implement:**
- Document kept in `docs/future-enhancements/`
- Revisit quarterly as volume grows
- Monitor token costs monthly
- Make data-driven decision when thresholds hit

### If We Grow Quickly

**Implement Dynamic When:**
```
IF monthly_conversations > 3,000 (100/day)
   OR total_skills > 10
   OR avg_skill_tokens_per_agent > 5,000
THEN implement dynamic loading
ELSE keep static
```

---

## Decision Matrix

| Factor | Weight | Static Score | Dynamic Score | Winner |
|--------|--------|--------------|---------------|--------|
| **Development Time** | 20% | 10/10 (done) | 0/10 (24-32h) | Static |
| **Token Efficiency** | 15% | 3/10 | 10/10 | Dynamic |
| **Current Cost** | 25% | 8/10 ($400/yr) | 10/10 ($40/yr) | Dynamic |
| **Simplicity** | 20% | 10/10 | 5/10 | Static |
| **Scalability** | 10% | 5/10 | 10/10 | Dynamic |
| **Predictability** | 10% | 10/10 | 6/10 | Static |
| **Weighted Score** | | **8.15/10** | **6.05/10** | **STATIC** |

**At current scale, static wins. At 10x scale, dynamic wins.**

---

## Conclusion

### Keep Static Implementation

**Reasons:**
1. Already complete and working
2. Current costs too low to justify rework ($400/year)
3. Simple and predictable behavior
4. Only 3 skills, 4 agents
5. No pressing need for token optimization

### Monitor These Metrics

**Monthly:**
- Total conversations
- Token costs
- Skills created
- Average skills per agent

**Trigger for Reevaluation:**
- >3,000 conversations/month
- >$500/month in token costs
- >10 total skills
- Users request more flexibility

### Keep Dynamic Plan Available

**Actions:**
1. Move `docs/skills-dynamic-implementation-plan.md` to `docs/future-enhancements/`
2. Document decision in CHANGELOG
3. Set quarterly review reminder
4. Continue with static implementation

### Final Verdict

**DO NOT IMPLEMENT DYNAMIC NOW**

Wait until:
- Volume justifies it (100+ conv/day)
- Costs justify it ($500+/month)
- Complexity justifies it (10+ skills)

**Estimated timeline for reevaluation:** 6-12 months

---

**END OF ANALYSIS**

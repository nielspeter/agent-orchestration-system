# Product Requirements Document: Agent Skills

**Version:** 1.0
**Date:** 2025-10-18
**Status:** Draft

## Executive Summary

Skills are domain expertise packages that agents can load dynamically to handle specialized tasks. They separate domain knowledge from agent logic, enabling reuse, composition, and maintainability.

**Core Value:** Write domain expertise once, reuse across all agents.

## Problem Statement

### Current Pain Points

1. **Knowledge Duplication**
   - Danish tender guidelines copied across 4+ agents (orchestrator, technical-analyst, go-no-go, etc.)
   - Update rules → touch multiple files
   - Inconsistency risk when one agent has outdated knowledge

2. **Agent Bloat**
   - technical-analyst.md: 217 lines (50% is Danish-specific)
   - go-no-go-analyzer.md: 214 lines (40% is Danish-specific)
   - Agents become domain-specific instead of role-specific

3. **No Composability**
   - Can't easily adapt technical-analyst for UK tenders
   - Would need to create technical-analyst-uk.md (duplicate logic)
   - No way to say "use Danish rules + EU compliance + GDPR requirements"

4. **Maintenance Burden**
   - Danish format changes → update 4+ files
   - New market (UK) → copy-paste-modify all agents
   - Risk of inconsistency across agents

### Why Now?

- We have 11 tender analysis agents (all contain Danish rules)
- Adding UK/US tender support would require 22+ agents (duplication)
- Anthropic released Skills (Oct 16, 2025) - proven pattern
- Extended thinking (16k tokens) makes context management critical

## Solution: Agent Skills

### What Are Skills?

**Skills** are domain expertise packages containing:
- **Instructions**: How to handle this domain
- **Templates**: Output formats, checklists
- **Scripts**: Executable code (optional, for deterministic logic)
- **Schemas**: Validation rules, data structures
- **Examples**: Reference data, sample outputs

### Conceptual Model

```
┌──────────────────────────────────────────────┐
│ AGENT (technical-analyst)                    │
│ Role: Analyze technical requirements         │
│ Logic: Assessment workflow, tool usage       │
├──────────────────────────────────────────────┤
│ Loads Skills:                                │
│ ┌────────────────────┐ ┌──────────────────┐ │
│ │ danish-tender      │ │ complexity-      │ │
│ │ - DK format rules  │ │ - Estimation     │ │
│ │ - [FAKTA] markers  │ │ - FP calculation │ │
│ │ - Deadline calc    │ │ - Risk matrix    │ │
│ └────────────────────┘ └──────────────────┘ │
├──────────────────────────────────────────────┤
│ Uses Tools: read, write, grep, delegate      │
└──────────────────────────────────────────────┘
```

### Design Principles

1. **Portable** - Same format across agents, API, CLI
2. **Composable** - Multiple skills active simultaneously
3. **Lazy** - Load only when relevant to task
4. **Versioned** - Track skill versions for reproducibility
5. **Secure** - Code execution properly sandboxed
6. **Discoverable** - Agents can scan available skills

## Value Proposition

### Primary Benefits

#### 1. DRY Principle (Don't Repeat Yourself)

**Before:**
```
tender-orchestrator.md       [217 lines, 60 about DK rules]
technical-analyst.md         [217 lines, 60 about DK rules]
go-no-go-analyzer.md         [214 lines, 50 about DK rules]
response-preparation.md      [198 lines, 40 about DK rules]
```

**After:**
```
skills/danish-tender-guidelines/SKILL.md  [Single source of truth]
tender-orchestrator.md       [150 lines, references skill]
technical-analyst.md         [150 lines, references skill]
go-no-go-analyzer.md         [160 lines, references skill]
response-preparation.md      [150 lines, references skill]
```

**Savings:** 210 lines of duplication removed

#### 2. Composability (Mix & Match)

**Before:**
- technical-analyst.md (Danish only)
- technical-analyst-uk.md (duplicate logic)
- technical-analyst-us.md (duplicate logic)

**After:**
```yaml
# Same agent, different markets
technical-analyst + [danish-tender-guidelines]
technical-analyst + [uk-procurement-rules]
technical-analyst + [us-rfp-standards, fedramp-compliance]
```

**Impact:** 1 agent serves 3+ markets

#### 3. Maintenance

**Scenario:** Danish tender format changes

**Before:**
- Update tender-orchestrator.md
- Update technical-analyst.md
- Update go-no-go-analyzer.md
- Update response-preparation.md
- Risk: Miss one, introduce inconsistency

**After:**
- Update skills/danish-tender-guidelines/SKILL.md
- All agents instantly benefit

**Impact:** 75% reduction in maintenance burden

#### 4. Context Efficiency

**Before:**
```
Agent load: 217 lines (all Danish knowledge)
Even for US tender: Still loads Danish rules
Context waste: ~60 lines unused
```

**After:**
```
Agent load: 150 lines (role logic only)
For Danish tender: +60 lines (skill loaded)
For US tender: +50 lines (different skill)
Context savings: Load only what's needed
```

**Impact:** 20-30% context reduction per agent

#### 5. Team Collaboration

**Before:**
- Domain expert updates agent markdown
- Must understand agent system, YAML frontmatter
- Mixes domain knowledge with agent logic

**After:**
- Domain expert maintains skills/ folder
- Clear separation: domain knowledge vs agent logic
- Can version control separately

**Impact:** Easier for non-engineers to contribute domain expertise

### Secondary Benefits

- **Faster agent development** - Start with generic agent, add skills for domain
- **Easier testing** - Test skills independently from agents
- **Knowledge sharing** - Skills can be published, imported
- **Progressive enhancement** - Add skills to existing agents without breaking them

## When to Use Skills

### Use Skills For:

✅ **Domain Knowledge** - Industry-specific rules, formats, standards
- Example: Danish tender compliance, GDPR requirements, medical terminology

✅ **Reusable Expertise** - Knowledge needed by multiple agents
- Example: Excel formulas, SQL query patterns, brand guidelines

✅ **Market/Locale Adaptation** - Geographic variations
- Example: Danish vs UK tender rules, US vs EU regulations

✅ **Complex Calculations** - Deterministic logic better as code
- Example: Complexity scoring, deadline calculation, pricing models

✅ **Output Templates** - Standardized formats
- Example: Tender response structure, report templates, documentation formats

### Don't Use Skills For:

❌ **Agent Logic** - Decision-making, tool orchestration
- Keep in agent: "Analyze documents, then delegate to technical-analyst"

❌ **One-Time Knowledge** - Used by single agent only
- Keep in agent: Ultra-specialized knowledge not reusable

❌ **Tool Implementation** - Low-level capabilities
- Keep in tools/: read, write, grep implementations

❌ **Simple Instructions** - Basic prompting
- Keep in agent: "Be concise" or "Use bullet points"

### Decision Matrix

| Characteristic | Agent | Skill | Tool |
|---|---|---|---|
| **Reused by multiple agents?** | No | Yes | Yes |
| **Contains domain knowledge?** | No | Yes | No |
| **Has execution loop?** | Yes | No | No |
| **Can execute code?** | No | Yes (scripts) | Yes |
| **Loaded dynamically?** | No (at start) | Yes (when needed) | No (registered) |
| **User-facing role?** | Yes | No | No |

## User Stories

### Story 1: Multi-Market Tender Analysis

**As a** tender analysis manager
**I want** to use the same agents for Danish and UK tenders
**So that** I don't maintain duplicate agent systems

**Acceptance Criteria:**
- Same `technical-analyst` agent works for both markets
- Simply reference different skill: `danish-tender-guidelines` vs `uk-procurement-rules`
- Agent behavior adapts to market automatically

### Story 2: Domain Expert Contribution

**As a** Danish tender compliance expert (non-engineer)
**I want** to update tender rules without touching agent code
**So that** I can keep guidelines current without engineering help

**Acceptance Criteria:**
- Edit `skills/danish-tender-guidelines/SKILL.md` directly
- Changes apply to all agents immediately
- No need to understand YAML frontmatter or agent system

### Story 3: New Market Launch

**As a** product manager
**I want** to add US RFP support quickly
**So that** we can enter new market without re-engineering

**Acceptance Criteria:**
- Create `skills/us-rfp-standards/` folder
- Add to existing agents: `skills: [us-rfp-standards]`
- No need to duplicate or modify agent logic

### Story 4: Context Optimization

**As a** developer
**I want** agents to load only relevant domain knowledge
**So that** we stay within context limits with extended thinking

**Acceptance Criteria:**
- Agent loads lightweight (base instructions only)
- Skills loaded dynamically when task requires them
- Monitor: 20-30% context reduction

## Success Metrics

### Quantitative Metrics

1. **Code Duplication**
   - Before: ~210 lines duplicated across 4 agents
   - Target: 0 lines duplicated (single source of truth)
   - Measure: `grep -r "FAKTA.*ESTIMAT" agents/ | wc -l`

2. **Context Efficiency**
   - Before: Average agent = 215 lines
   - Target: Average agent = 150 lines base + skills loaded on demand
   - Measure: Track token usage per agent invocation

3. **Maintenance Time**
   - Before: Update Danish rules = 4 file edits
   - Target: Update Danish rules = 1 file edit
   - Measure: Git commits touching multiple agents

4. **Market Expansion**
   - Before: New market = 11 new agent files
   - Target: New market = 1 new skill + update agent references
   - Measure: Files changed per market launch

### Qualitative Metrics

1. **Developer Experience**
   - Measure: Survey after 1 month usage
   - Target: 80% say "easier to maintain domain knowledge"

2. **Domain Expert Contribution**
   - Measure: Non-engineer commits to skills/
   - Target: 50% of domain updates from non-engineers

3. **Agent Reusability**
   - Measure: Agents used across multiple domains
   - Target: technical-analyst works for 3+ markets

## Non-Goals (Out of Scope for v1)

❌ **Skill Marketplace** - Public sharing/discovery of skills
❌ **AI-Generated Skills** - Automated skill creation from examples
❌ **Skill Dependencies** - Skills requiring other skills
❌ **Version Conflicts** - Multiple versions of same skill active
❌ **Hot Reload** - Updating skills without restarting agents
❌ **Skill Analytics** - Tracking skill usage, performance

These may be added in future versions based on user feedback.

## Risks & Mitigations

### Risk 1: Over-Abstraction

**Risk:** Developers create skills for everything, making system complex
**Mitigation:** Clear guidance on when to use skills vs keep in agents
**Monitoring:** Code review for skill proliferation

### Risk 2: Context Explosion

**Risk:** Agent loads 10+ skills, context larger than before
**Mitigation:** Lazy loading (only load when relevant), skill size guidelines
**Monitoring:** Track context size per invocation

### Risk 3: Version Drift

**Risk:** Agent expects skill v2, but v1 loaded (breaking change)
**Mitigation:** Skill versioning in frontmatter, validation at load time
**Future:** Semantic versioning for skills

### Risk 4: Security (Code Execution)

**Risk:** Malicious skill executes harmful code
**Mitigation:**
- Code execution disabled by default
- Skills with scripts require explicit approval
- Sandbox execution environment (future)

### Risk 5: Maintenance Burden

**Risk:** Skills become new form of technical debt
**Mitigation:**
- Clear ownership model (domain experts own skills)
- Automated testing for skills
- Documentation requirements

## Technical Constraints

1. **Backward Compatibility** - Existing agents must work without skills
2. **Performance** - Skill loading adds <100ms latency per agent invocation
3. **Storage** - Skills stored in filesystem (like agents), no database required
4. **Portability** - Skills use same markdown format as agents (easy to share)

## Open Questions

1. **Skill Selection** - Manual vs automatic?
   - v1: Manual (agent specifies skills in frontmatter)
   - Future: Automatic (agent scans available skills, loads relevant ones)

2. **Skill Composition** - How do multiple skills interact?
   - v1: All skills loaded, agent decides how to use
   - Future: Skills can coordinate, share data

3. **Script Execution** - How to run skill scripts safely?
   - v1: Scripts disabled (instructions only)
   - Future: Sandbox via vm2 or isolated process

4. **Skill Discovery** - How do agents find relevant skills?
   - v1: Listed in agent frontmatter
   - Future: Semantic search, tags, capabilities

## Dependencies

- **Core System** - AgentLoader, ToolRegistry (existing)
- **File System** - Read markdown files (existing capability)
- **YAML Parser** - Parse skill frontmatter (gray-matter, existing)
- **Validation** - Zod schemas (existing)

## Success Criteria

**Launch Readiness:**
1. ✅ SkillRegistry implemented and tested
2. ✅ At least 3 skills migrated (danish-tender-guidelines, complexity-calculator, architecture-analyzer)
3. ✅ 4+ agents use skills (tender-orchestrator, technical-analyst, go-no-go, response-prep)
4. ✅ Documentation complete (how to create, use, test skills)
5. ✅ No regressions (all existing tests pass)

**Post-Launch Success:**
1. 50% reduction in domain knowledge duplication (1 month)
2. 1 new market launched using skills (3 months)
3. 80% positive developer feedback (1 month survey)
4. 0 skill-related production incidents (6 months)

## Next Steps

1. **Review & Approve** - Stakeholder sign-off on PRD
2. **Architecture Design** - Technical design document
3. **Implementation Plan** - Phased rollout plan
4. **Proof of Concept** - Build 1 skill, test with 1 agent
5. **Full Implementation** - Migrate existing agents to use skills

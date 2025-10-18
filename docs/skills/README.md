# Skills Documentation

**Skills** are domain expertise packages that agents can load to handle specialized tasks. They separate domain knowledge from agent logic, enabling reuse, composition, and maintainability.

## Quick Links

- **[PRD.md](PRD.md)** - Product requirements, value proposition, success criteria
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Technical design, interfaces, integration
- **[IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md)** - Phased rollout plan (4 weeks)
- **[EXAMPLES.md](EXAMPLES.md)** - Concrete examples, before/after, use cases

## What Are Skills?

Skills are folders containing:
- **SKILL.md** - Instructions and domain knowledge
- **templates/** - Output templates, checklists (optional)
- **scripts/** - Executable code for deterministic logic (optional)
- **schemas/** - Validation schemas, data structures (optional)
- **examples/** - Reference data, sample outputs (optional)

## When to Use Skills

### ✅ Use Skills For:
- **Domain Knowledge** - Industry rules, standards, formats
- **Reusable Expertise** - Knowledge needed by multiple agents
- **Market/Locale Adaptation** - Geographic variations (DK vs UK tenders)
- **Complex Calculations** - Deterministic logic better as code
- **Output Templates** - Standardized formats

### ❌ Don't Use Skills For:
- **Agent Logic** - Decision-making, tool orchestration (keep in agent)
- **One-Time Knowledge** - Used by single agent only (keep in agent)
- **Tool Implementation** - Low-level capabilities (keep in tools/)
- **Simple Instructions** - Basic prompting (keep in agent)

## Quick Start

### 1. Create a Skill

```bash
mkdir -p skills/my-skill
cat > skills/my-skill/SKILL.md << 'EOF'
---
name: my-skill
version: 1.0.0
description: Brief description of what this skill does
tags: [tag1, tag2]
capabilities: [capability1, capability2]
---

# My Skill

Domain expertise goes here...

## Section 1

Instructions, templates, examples...
EOF
```

### 2. Use in Agent

```yaml
# In agent frontmatter
---
name: my-agent
tools: [read, write]
skills: [my-skill]
---

You are an agent that uses my-skill for domain expertise...
```

### 3. Load in System

```typescript
const system = await AgentSystemBuilder.default()
  .withAgentsFrom('./agents')
  .withSkillsFrom('./skills')  // NEW
  .build();
```

That's it! The agent automatically has access to skill knowledge.

## Value Proposition

### Primary Benefits

1. **DRY Principle** - Write domain knowledge once, reuse everywhere
2. **Composability** - Mix & match skills (danish + complexity + architecture)
3. **Maintenance** - Update rules in one place, all agents benefit
4. **Context Efficiency** - Load only relevant skills (20-30% reduction)
5. **Team Collaboration** - Domain experts maintain skills separately

### ROI Example

**Before Skills:**
```
11 tender agents × 60 lines Danish rules = 660 lines duplicated
Update Danish format = Touch 11 files
```

**After Skills:**
```
1 danish-tender-guidelines skill = 60 lines (single source)
Update Danish format = Touch 1 file
```

**Savings:** 600 lines eliminated, 91% maintenance reduction

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│ AgentExecutor                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Agents   │  │ Skills   │  │ Tools    │ │
│  │ (roles)  │  │ (domain) │  │ (actions)│ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘ │
│       │             │              │        │
│       └─────────────┴──────────────┘        │
│                     ↓                       │
│          MiddlewarePipeline                 │
└─────────────────────────────────────────────┘
```

**Key Concepts:**
- **Agents** = Execution units with roles (orchestrator, analyst)
- **Skills** = Domain expertise packages (danish-rules, sql-expert)
- **Tools** = Actions agents can take (read, write, delegate)

## Implementation Status

**Current:** Planning & Design ✅
**Next:** Phase 1 - Core Infrastructure (Week 1)

See [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md) for detailed timeline.

## Examples

### Example 1: Multi-Market Tender Analysis

```yaml
# Same agent, different markets
---
name: technical-analyst
skills: [danish-tender-guidelines]  # For DK
---

---
name: technical-analyst
skills: [uk-procurement-rules]      # For UK
---

---
name: technical-analyst
skills: [us-rfp-standards]          # For US
---
```

**Result:** 1 agent serves 3 markets instead of 3 separate agents.

### Example 2: Skill Composition

```yaml
# Combine multiple domains
---
name: healthcare-analyst
skills:
  - danish-tender-guidelines  # DK compliance
  - medical-terminology      # Healthcare domain
  - gdpr-privacy            # EU data protection
  - security-compliance     # Security standards
---
```

**Result:** 4 domain expertise areas combined in single agent.

### Example 3: Before/After Migration

**Before (217 lines):**
```yaml
---
name: technical-analyst
tools: [read, write]
---

You analyze tenders...

[60 lines of Danish rules]
[40 lines of complexity calculation]
[30 lines of architecture assessment]
[rest of agent logic]
```

**After (152 lines, 30% reduction):**
```yaml
---
name: technical-analyst
tools: [read, write]
skills: [danish-tender-guidelines, complexity-calculator, architecture-analyzer]
---

You analyze tenders...

Use available skills for domain expertise.

[rest of agent logic]
```

## File Structure

```
your-project/
├── agents/
│   ├── orchestrator.md
│   ├── technical-analyst.md
│   └── go-no-go-analyzer.md
│
├── skills/
│   ├── danish-tender-guidelines/
│   │   ├── SKILL.md
│   │   └── templates/
│   │       └── checklist.md
│   │
│   ├── complexity-calculator/
│   │   ├── SKILL.md
│   │   └── schemas/
│   │       └── scoring-matrix.json
│   │
│   └── architecture-analyzer/
│       ├── SKILL.md
│       └── templates/
│           └── report-template.md
│
└── main.ts
```

## FAQ

### Q: How are skills different from agents?

**Agents** = Execution units with decision-making
**Skills** = Knowledge packages without execution

Agents USE skills, skills DON'T use agents.

### Q: How are skills different from tools?

**Tools** = Single functions (read, write, grep)
**Skills** = Domain expertise bundles (instructions + templates + scripts)

Tools are LOW-level, skills are HIGH-level.

### Q: Can skills use other skills?

Not in v1. Skill dependencies planned for v2+.

### Q: Can skills execute code?

Planned for v2+. v1 focuses on instructions/templates only.

### Q: Are skills loaded dynamically?

v1: Static (specified in agent frontmatter)
v2+: Dynamic (loaded based on task analysis)

### Q: How do I version skills?

Use semantic versioning in frontmatter:
```yaml
version: 1.2.0  # major.minor.patch
```

### Q: Can I share skills publicly?

Not yet. Skill marketplace planned for future.

### Q: What's the performance impact?

Target: <100ms overhead per agent invocation
Measurement: Track skill loading time

### Q: Are skills backward compatible?

Yes! Existing agents work unchanged.
Skills are 100% optional.

## Success Metrics

At v1 completion:
- ✅ 50% reduction in domain knowledge duplication
- ✅ 20-30% context size reduction
- ✅ 1 new market launched using skills
- ✅ 80% positive developer feedback
- ✅ 0 skill-related production incidents

## Timeline

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1: Core Infrastructure | 1 week | SkillLoader, SkillRegistry |
| Phase 2: Agent Integration | 1 week | Middleware integration |
| Phase 3: Migration & Validation | 1 week | 3 skills, 4 agents migrated |
| Phase 4: Documentation | 1 week | User guide, examples |
| **Total** | **4 weeks** | **Production-ready** |

See [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md) for detailed breakdown.

## Getting Involved

### For Developers
1. Read [ARCHITECTURE.md](ARCHITECTURE.md) for technical design
2. Review [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md) for tasks
3. Check Phase 1 tasks for starting points

### For Domain Experts
1. Identify domain knowledge in existing agents
2. Read [EXAMPLES.md](EXAMPLES.md) for skill structure
3. Prepare content for skill migration

### For Product Managers
1. Review [PRD.md](PRD.md) for value proposition
2. Identify high-value use cases
3. Plan skill rollout for your domain

## Resources

- **Inspiration:** [Claude Skills Announcement](https://www.anthropic.com/news/agent-skills) (Oct 16, 2025)
- **Engineering Blog:** [Agent Skills Design Pattern](https://www.anthropic.com/engineering/agent-skills-design-pattern)
- **Tutorial:** [How to Create Skills in Claude Code](https://apidog.com/blog/how-to-create-and-use-skills-in-claude-and-claude-code/)

## Questions?

Open an issue or discussion in the repository.

---

**Last Updated:** 2025-10-18
**Status:** Planning & Design
**Next Milestone:** Phase 1 - Core Infrastructure

# Dynamic Skills System Demo

This example demonstrates the **dynamic skills system** - how agents load domain expertise on-demand using the `skill` tool.

## Overview

The demo shows a realistic tender analysis workflow where an AI agent:

1. **Loads skills dynamically** based on task requirements (not build-time configuration)
2. **Uses multiple skills** in a single session (danish-tender-guidelines, architecture-analyzer, complexity-calculator)
3. **Caches skills** in conversation history (no need to reload)
4. **References resources** from skill directories

## What You'll See

### Scenario 1: Full Tender Analysis
The `tender-analyst` agent receives a Danish public tender document and:
- Loads `danish-tender-guidelines` skill for marker system ([FAKTA], [ESTIMAT], etc.)
- Reads the sample tender document
- Loads `architecture-analyzer` skill for pattern recognition
- Loads `complexity-calculator` skill for effort estimation
- Produces a technical analysis with proper markers and methodology

**Demonstrates**: Dynamic loading of multiple skills based on task needs

### Scenario 2: Follow-up Question
The agent answers a follow-up question about technical risks:
- **Does NOT reload skills** - they're already in conversation context
- Uses cached knowledge from previously loaded skills
- Produces analysis using established marker system

**Demonstrates**: Conversation history as cache (no separate caching mechanism)

### Scenario 3: Resource References
The agent explains available reference documentation:
- Lists reference docs available in skills
- Explains when to use them
- Shows how skills can point to additional resources

**Demonstrates**: Skills can include reference documentation and assets

## Skills Used

This demo uses **real skills** from the `../udbud/skills/` directory:

### 1. danish-tender-guidelines (228 LOC + 5 reference docs)
**Purpose**: Danish public tender compliance rules and output formatting

**Key Features**:
- Marker system: [FAKTA], [ESTIMAT], [ANTAGET], [UKENDT], [INTERN VURDERING PÅKRÆVET]
- Compliance markers: [SKAL], [BØR], [KAN], [UKLAR], [KONFLIKT]
- Neutrality requirements (no GO/NO-GO recommendations)
- Danish naming conventions (TEKNISK-ANALYSE.md, UDBUDSOVERSIGT.md, etc.)

### 2. architecture-analyzer (591 LOC)
**Purpose**: Software architecture pattern recognition and evaluation

**Key Features**:
- Pattern recognition (monolith, microservices, serverless, event-driven)
- Architecture quality assessment (scalability, resilience, fault tolerance)
- Integration complexity analysis (API gateway, service mesh, message brokers)
- Risk assessment (anti-patterns, technical debt identification)
- Cloud architecture patterns (12-factor, Kubernetes, IaC)

### 3. complexity-calculator (414 LOC)
**Purpose**: Software development complexity assessment and effort estimation

**Key Features**:
- Complexity scoring (1-10 scale) with formulas
- Component-based effort estimation (backend, frontend, integrations, data migration)
- Industry-standard multipliers (PM overhead, contingency, team experience)
- FTE calculation formulas
- Testing and documentation effort ratios

## Running the Demo

### Prerequisites

```bash
# API key required
export ANTHROPIC_API_KEY=your-key-here
# OR
export OPENROUTER_API_KEY=your-key-here

# Optional: specify model
export MODEL=anthropic/claude-3-5-sonnet-latest
```

### Run

```bash
# From repository root
npx tsx packages/examples/skills-demo/skills-demo.ts

# OR from packages/examples directory
npx tsx skills-demo/skills-demo.ts
```

### Expected Output

The demo produces three sections:

1. **Scenario 1**: Technical analysis of the sample tender
   - Architecture pattern identified (microservices)
   - Integration complexity score
   - Development effort estimate with methodology
   - Proper use of markers ([FAKTA], [ESTIMAT])

2. **Scenario 2**: Top 3 technical risks
   - Risk assessment based on architecture
   - No skill reloading (uses cached context)
   - Risk markers properly applied

3. **Scenario 3**: Reference documentation listing
   - Available reference docs from skills
   - When to use them

### What to Observe

**Dynamic Loading**:
```
Turn 1: Agent loads danish-tender-guidelines
        → Skill content added to conversation
Turn 2: Agent loads architecture-analyzer
        → Skill content added to conversation
Turn 3: Agent loads complexity-calculator
        → Skill content added to conversation
```

**Conversation Caching**:
```
Turn 4: Agent answers follow-up question
        → Uses skills already in context
        → No skill tool calls needed!
```

**Markers in Output**:
```markdown
Architecture: Microservices [FAKTA - tender section 2.1]
Complexity Score: 7/10 [ESTIMAT - based on 5 services + 6 integrations]
Development Hours: 2,400h [ESTIMAT - 5 services * 160h + 6 integrations * 50h avg]
Team Capability: [INTERN VURDERING PÅKRÆVET]
```

## Key Learnings

### 1. Skills Load On-Demand
Skills are NOT loaded at build-time. Agents load them when needed via the `skill` tool:

```typescript
// In agent frontmatter
tools: [read, write, skill]  // Enable skill tool

// Agent loads when needed
skill({name: "danish-tender-guidelines"})
```

### 2. Conversation History IS the Cache
No separate cache mechanism needed:
- Skill loaded in turn 1 → Available in turn 2, 3, 4...
- Anthropic prompt caching makes this efficient (90% cost savings)
- Simple architecture, fewer edge cases

### 3. Skills Are Reusable Knowledge Packages
Multiple agents can load the same skills:
- `tender-analyst` loads tender-specific skills
- `code-reviewer` could load code-quality skills
- `data-analyst` could load data-analysis skills
- Update skill once → All agents benefit

### 4. Resources Extend Skills
Skills can point to reference documentation:
```
skills/
  danish-tender-guidelines/
    SKILL.md           # Main skill content
    reference/         # Reference docs
      pricing-guide.md
      compliance-checklist.md
    assets/           # Examples, templates
      template-teknisk-analyse.md
```

## Architecture Benefits

**vs. Build-time Configuration**:
- ✅ Load only what you need (efficient)
- ✅ Skills don't count against context until used
- ✅ Easy to add new skills (just add markdown file)
- ✅ No agent rebuilding required

**vs. Separate Cache**:
- ✅ No cache invalidation complexity
- ✅ No TTL management
- ✅ No memory optimization needed
- ✅ Conversation history naturally maintains context

## Sample Tender Document

The demo includes a realistic Danish public tender (`sample-data/sample-tender.md`):

**Project**: Digital citizen portal system
**Contract Value**: 5-8M DKK
**Duration**: 6 months
**Technical Requirements**:
- Microservices architecture (5 services)
- 6 system integrations (REST, SOAP, Database)
- Data migration (45K users, 280K documents)
- Cloud deployment (Kubernetes)
- GDPR compliance

This provides a realistic scenario that exercises all three skills.

## Files Structure

```
skills-demo/
├── README.md                    # This file
├── skills-demo.ts               # Main demo script
├── agents/
│   └── tender-analyst.md        # Agent that uses skills
└── sample-data/
    └── sample-tender.md         # Sample Danish tender document
```

## Next Steps

**Try It Yourself**:
1. Modify the tender document and observe how estimates change
2. Add your own skills in a `skills/` directory
3. Create new agents that use different skill combinations
4. Experiment with follow-up questions to see caching in action

**Learn More**:
- [Skills System Guide](../../../docs/skills.md) - Complete documentation
- [Skills Architecture](../../../docs/skills.md#architecture) - How it works under the hood
- [Creating Skills](../../../docs/skills.md#creating-skills) - Build your own skills

## Troubleshooting

**Skills not found**:
- Ensure you're running from the correct directory
- Check that `../udbud/skills/` exists relative to the demo
- Verify SKILL.md files exist in skill directories

**Agent doesn't load skills**:
- Check agent has `skill` in tools list
- Verify skills registry was loaded: `.withSkillsFrom()`
- Check agent instructions mention how to load skills

**High API costs**:
- Use Anthropic models with prompt caching for 90% cost savings
- Cached skills don't count toward API costs after first load
- Use `anthropic/claude-haiku-4-5` for cost-effective testing

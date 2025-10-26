# Skills System

**Skills** are domain expertise packages that agents load **on-demand** via the `skill` tool. They enable you to write domain knowledge once and reuse it across all agents.

## Table of Contents

- [Quick Start](#quick-start)
- [What Are Skills?](#what-are-skills)
- [When to Use Skills](#when-to-use-skills)
- [Creating Skills](#creating-skills)
  - [Skill Structure](#skill-structure)
  - [SKILL.md Format](#skillmd-format)
  - [Resource Directories](#resource-directories)
- [Using Skills in Agents](#using-skills-in-agents)
  - [The Skill Tool](#the-skill-tool)
  - [Conversation History as Cache](#conversation-history-as-cache)
  - [Hint System](#hint-system)
- [Migration Guide](#migration-guide)
- [Real Examples](#real-examples)
- [Best Practices](#best-practices)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

**Create and use a skill in 3 minutes:**

```bash
# 1. Create skill directory
mkdir -p skills/my-domain-expertise

# 2. Create SKILL.md
cat > skills/my-domain-expertise/SKILL.md << 'EOF'
---
name: my-domain-expertise
description: When and how to use this domain knowledge
---

# My Domain Expertise

## Key Concepts

Your domain knowledge goes here...

## Guidelines

- Rule 1: Important guideline
- Rule 2: Another guideline

## Best Practices

Detailed instructions for this domain...
EOF

# 3. Use in agent
cat > agents/my-agent.md << 'EOF'
---
name: my-agent
tools: [read, write, skill]
---

You are an agent that works with domain expertise.

## Loading Skills

Load domain knowledge when needed using the skill tool:

skill({name: "my-domain-expertise"})

The skill content will be added to the conversation for your use.
EOF

# 4. Configure system with skills directory
```

```typescript
import { AgentSystemBuilder } from '@agent-system/core';

const system = await AgentSystemBuilder.default()
  .withAgentsFrom('./agents')
  .withSkillsFrom('./skills')  // Load skills registry
  .build();

// Agent can now load skills on-demand
const result = await system.executor.execute('my-agent', 'Your task');
```

That's it! The agent loads skills dynamically when needed.

---

## What Are Skills?

Skills separate **domain knowledge** from **agent logic**:

```
┌─────────────────────────────────────────┐
│ AGENT (what the agent DOES)             │
│ - Role and responsibilities             │
│ - Tool usage and orchestration          │
│ - Decision-making logic                 │
├─────────────────────────────────────────┤
│ SKILLS (what the agent KNOWS)           │
│ - Industry rules and standards          │
│ - Compliance requirements               │
│ - Output formatting conventions         │
│ - Calculation methodologies             │
└─────────────────────────────────────────┘
```

**Key Benefits:**

1. **DRY Principle** - Write once, use everywhere
2. **Composability** - Mix and match skills per agent
3. **Maintainability** - Update knowledge in one place
4. **Team Collaboration** - Domain experts maintain skills separately
5. **Context Efficiency** - Load only relevant knowledge

**Real Example:**

Instead of copying Danish tender rules into 4+ agents:

```
BEFORE (without skills):
tender-orchestrator.md    [247 lines, 60 about Danish rules]
technical-analyst.md      [229 lines, 60 about Danish rules]
go-no-go-analyzer.md      [225 lines, 50 about Danish rules]
compliance-checker.md     [304 lines, 70 about Danish rules]
= 240 lines of duplicated knowledge

AFTER (with skills):
danish-tender-guidelines/SKILL.md  [228 lines - single source]
tender-orchestrator.md    [187 lines, references skill]
technical-analyst.md      [169 lines, references skill]
go-no-go-analyzer.md      [175 lines, references skill]
compliance-checker.md     [234 lines, references skill]
= 228 lines total, shared across 4 agents
```

---

## When to Use Skills

### ✅ Use Skills For:

| Use Case | Example |
|----------|---------|
| **Domain Standards** | Danish tender compliance rules, GDPR requirements |
| **Reusable Knowledge** | Multiple agents need the same expertise |
| **Geographic Variations** | UK vs US vs DK tender formats |
| **Industry Rules** | Financial regulations, medical coding standards |
| **Output Templates** | Standard report formats, checklists |
| **Calculation Methods** | Complexity estimation, pricing formulas |

### ❌ Don't Use Skills For:

| What | Why | Use Instead |
|------|-----|-------------|
| **Agent Logic** | Decision-making, orchestration | Keep in agent.md |
| **One-Time Knowledge** | Used by single agent only | Keep in agent.md |
| **Tool Implementation** | Low-level capabilities | Use tools/ directory |
| **Simple Prompts** | Basic instructions | Keep in agent.md |

### Decision Framework

Ask yourself:

1. **Is this knowledge used by 2+ agents?** → Skill
2. **Is this domain expertise vs agent behavior?** → Skill
3. **Would domain experts maintain this separately?** → Skill
4. **Does this knowledge change independently?** → Skill

If you answered "yes" to any, it's probably a skill.

---

## Creating Skills

### Skill Structure

A skill is a directory with this structure:

```
skills/my-skill/
├── SKILL.md           # Required: Instructions and knowledge
├── reference/         # Optional: Detailed documentation
│   ├── api-spec.md
│   └── guidelines.md
├── assets/            # Optional: Templates, output resources
│   ├── template.md
│   └── checklist.md
└── scripts/           # Optional: Executable code
    └── calculate.py
```

**Only SKILL.md is required.** Resources are optional and loaded on-demand.

### SKILL.md Format

SKILL.md has two parts: **frontmatter** (YAML) and **instructions** (Markdown).

```markdown
---
name: my-skill
description: When Claude should use this skill
license: MIT
metadata:
  version: "1.0.0"
  author: "Your Name"
  tags: "domain,expertise"
---

# My Skill

Your domain knowledge and instructions go here...

## Section 1

Detailed guidance...

## Section 2

More instructions...
```

#### Frontmatter Fields

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| `name` | ✅ Yes | Skill identifier (hyphen-case, matches directory) | `danish-tender-guidelines` |
| `description` | ✅ Yes | When Claude should use this skill | `Danish tender compliance rules` |
| `license` | ⬜ No | License identifier or filename | `MIT` or `LICENSE.txt` |
| `allowed-tools` | ⬜ No | Pre-approved tools for Claude Code | `["read", "write"]` |
| `metadata` | ⬜ No | Custom key-value pairs | `{version: "1.0.0"}` |

**Name Requirements:**
- Must be hyphen-case (lowercase with hyphens)
- Must match directory name exactly
- Examples: `my-skill`, `danish-tender`, `sql-query-builder`

#### Instructions Content

The Markdown body contains your domain knowledge. This gets injected into the agent's system prompt.

**Structure your instructions clearly:**

```markdown
# Skill Name

Brief overview of what this skill provides.

## Key Concepts

Core concepts the agent needs to understand...

## Guidelines

- Guideline 1: Explanation
- Guideline 2: Explanation

## When to Apply This Knowledge

Specific scenarios where this applies...

## Common Patterns

Pattern 1: How to handle X
Pattern 2: How to handle Y

## Important Notes

Critical information to remember...
```

### Resource Directories

Skills can include three types of resources, all loaded on-demand:

#### reference/ - Detailed Documentation

Documentation that Claude reads **as needed** during execution.

```
reference/
├── api-specification.md    # API docs
├── detailed-guidelines.md  # Comprehensive rules
├── examples.md             # Usage examples
└── schemas.json            # Data schemas
```

**Allowed formats:** `.md`, `.txt`, `.json`, `.yaml`, `.yml`, `.xml`, `.csv`

**When to use:**
- Detailed specifications too long for main instructions
- API documentation
- Comprehensive guidelines
- Reference examples

#### assets/ - Output Resources

Templates, checklists, and resources for the agent to **output** or **reference**.

```
assets/
├── report-template.md      # Output templates
├── compliance-checklist.md # Checklists
└── logo.svg                # Images/diagrams
```

**Allowed formats:** `.txt`, `.md`, `.json`, `.yaml`, `.yml`, `.xml`, `.csv`, `.html`, `.css`, `.svg`

**When to use:**
- Output templates
- Checklists
- Boilerplate text
- Diagrams/images

#### scripts/ - Executable Code

Deterministic logic better handled as code than LLM reasoning.

```
scripts/
├── calculate_complexity.py  # Python calculations
├── validate_data.js         # JavaScript validation
└── format_output.sh         # Shell formatting
```

**Allowed formats:** `.py`, `.js`, `.ts`, `.sh`, `.bash`, `.zsh`, `.fish`, `.rb`, `.pl`

**When to use:**
- Complex calculations
- Data validation
- Formatting logic
- Deterministic operations

**Note:** Scripts aren't auto-executed. The agent must use a Script or Bash tool to run them.

---

## Using Skills in Agents

### The Skill Tool

Agents load skills on-demand using the **`skill` tool**:

```yaml
---
name: my-agent
tools: [read, write, skill]  # Add 'skill' to tools list
---

You are an agent that analyzes tender documents.

## Available Skills

Load these skills as needed:
- `danish-tender-guidelines` - Danish tender compliance rules
- `complexity-calculator` - Project complexity estimation

## Your Process

1. Load relevant skill: skill({name: "danish-tender-guidelines"})
2. Follow the guidance provided in the skill
3. Complete your task
```

**Key Concepts:**

- **Dynamic Loading**: Skills loaded at runtime via tool call, not at build time
- **On-Demand**: Agents load skills only when needed
- **Conversation Cache**: Once loaded, skill content stays in conversation history
- **No Reloading**: Agents don't need to reload - content persists in context

### How It Works

**Step 1: Agent Calls Skill Tool**

```typescript
// Agent makes tool call
skill({name: "danish-tender-guidelines"})
```

**Step 2: Tool Returns Formatted Content**

```markdown
# Skill Loaded: danish-tender-guidelines

**Purpose:** Danish public tender (offentlig udbud) compliance rules

────────────────────────────────────────────────────────────

[Full skill instructions from SKILL.md...]

────────────────────────────────────────────────────────────

## Available Resources

**Reference docs:**
  - Read: skills/danish-tender-guidelines/reference/deadline-rules.md
  - Read: skills/danish-tender-guidelines/reference/format-validation.md

**Templates:**
  - Read: skills/danish-tender-guidelines/assets/checklist-template.md

**This knowledge is now available for your task.**
```

**Step 3: Content Stays in Conversation**

The skill content is now in the conversation history. The agent can reference it throughout the session without reloading.

### Conversation History as Cache

**Why no separate cache?**

Conversation history **IS** the cache:

```
Turn 1: Agent calls skill({name: "guidelines"})
        → Returns 5KB of guidelines
        → Guidelines now in conversation history

Turn 2-10: Agent continues working
           → Guidelines still in context
           → No need to reload!
```

This is fundamentally different from Claude Code's approach:
- **Claude Code**: New conversation each invocation → needs filesystem cache
- **Agent System**: Persistent conversation → history serves as cache

**Benefits:**
- ✅ Zero caching complexity
- ✅ No TTL management
- ✅ No cache invalidation
- ✅ No memory leaks
- ✅ Skills automatically "expire" when conversation ends

### Hint System

The system can **suggest skills** based on prompt patterns:

```typescript
// User prompt: "Analyze this Danish tender document"
// System detects: "danish", "tender"
// Adds hint to system prompt:

⚠️  **RECOMMENDED SKILLS FOR THIS TASK**

Consider loading these skills FIRST:

1. skill({name: "danish-tender-guidelines"})

════════════════════════════════════════════════════════════
```

**Hints are:**
- Pattern-based (keyword matching)
- Non-invasive (suggestions, not requirements)
- Prominent (visible in system prompt)
- Helpful (guide agents to relevant knowledge)

**Configure hints in `context-setup.middleware.ts`:**

```typescript
// Pattern matching for common tasks
if (prompt.match(/danish|dansk|udbud|tender/i)) {
  hints.push('danish-tender-guidelines');
}

if (prompt.match(/complexity|estimate|effort/i)) {
  hints.push('complexity-calculator');
}
```

### System Builder API

```typescript
// Configure system with skills directory
const system = await AgentSystemBuilder.default()
  .withAgentsFrom('./agents')
  .withSkillsFrom('./skills')    // Loads skills into registry
  .build();

// Multiple skill directories
const system = await AgentSystemBuilder.default()
  .withAgentsFrom('./agents')
  .withSkillsFrom('./skills', './shared-skills')
  .build();

// Skills are optional
const system = await AgentSystemBuilder.default()
  .withAgentsFrom('./agents')
  // No skills directory - skill tool not available
  .build();
```

**What `withSkillsFrom()` does:**
1. Scans directory for skill subdirectories
2. Loads each `SKILL.md` into registry
3. Validates skill frontmatter
4. Registers `skill` tool with registry reference
5. Makes skill tool available to agents that request it

**Skill discovery:**
- Scans for subdirectories containing `SKILL.md`
- Invalid skills logged but don't break loading
- Registry provides `listSkills()` for tool description

---

## Migration Guide

This guide covers two migration scenarios:

1. **Static → Dynamic**: Migrating from static skill loading to dynamic (current system)
2. **Inline → Skills**: Extracting duplicated knowledge into skills

### Migrating from Static to Dynamic Skills

If you have agents using the old static `skills:` frontmatter, follow these steps:

**Step 1: Update Agent Frontmatter**

**Before (Static):**
```yaml
---
name: my-agent
tools: [read, write]
skills: [domain-expertise]  # OLD: Static loading
---

You are an agent...
```

**After (Dynamic):**
```yaml
---
name: my-agent
tools: [read, write, skill]  # NEW: Add skill tool
---

You are an agent...

## Available Skills

Load domain knowledge as needed:
- skill({name: "domain-expertise"})
```

**Step 2: Add Skill Loading Instructions**

Guide the agent on when and how to load skills:

```markdown
## Your Process

1. **Load domain expertise**: skill({name: "domain-expertise"})
2. Apply the guidelines provided in the skill
3. Complete your analysis
4. Generate output following the skill's format requirements
```

**Step 3: Test Dynamic Loading**

```bash
# Run your agent
npm run agent -- -a my-agent -p "test task"

# Verify skill tool is called in logs
# Should see: [tool_call] skill {"name": "domain-expertise"}
```

**Step 4: Remove Old Static References**

The old `skills:` field in frontmatter is no longer used. Remove it from all agents.

---

### Extracting Knowledge into Skills

If you have duplicated knowledge across multiple agents, extract it into a shared skill:

#### Identifying Extractable Knowledge

Look for these patterns in your agents:

**🔴 Red Flags (Extract to Skill):**
- Same information in 2+ agents
- Industry standards, rules, or regulations
- Domain-specific terminology or formats
- Compliance requirements
- Output format specifications
- Calculation methodologies

**Example (compliance-checker.md):**

```markdown
## Critical Guidelines

**ALL requirements MUST be marked:**
- **[SKAL]** - Mandatory requirement
- **[BØR]** - Recommended
- **[KAN]** - Optional
- **[FAKTA]** - Source reference
```

This knowledge appears in multiple agents → Extract to skill!

#### Step-by-Step Extraction

**Step 1: Identify common knowledge**

Search for duplicated sections:

```bash
# Find common text patterns
grep -r "\[FAKTA\]" agents/*.md
grep -r "mandatory requirement" agents/*.md
```

**Step 2: Create skill directory**

```bash
mkdir -p skills/domain-name
```

**Step 3: Create SKILL.md with extracted knowledge**

```markdown
---
name: domain-name
description: Brief description of domain knowledge
---

# Domain Name

[Move duplicated knowledge here...]
```

**Step 4: Update agents to use skill tool**

**Before:**
```yaml
---
name: my-agent
tools: [read, write]
---

You are an agent...

## Domain Guidelines

[100 lines of domain knowledge...]
```

**After:**
```yaml
---
name: my-agent
tools: [read, write, skill]
---

You are an agent...

## Loading Domain Knowledge

Load guidelines: skill({name: "domain-name"})

[Agent-specific logic only...]
```

**Step 5: Test thoroughly**

```bash
# Run tests
npm test

# Test agent with dynamic skill loading
npm run agent -- -a my-agent -p "test task"
```

#### Migration Example (Real)

**Before (compliance-checker.md - 304 lines with static skills):**

```markdown
---
name: compliance-checker
tools: [read, write, grep]
skills: [danish-tender-guidelines]  # OLD: Static
---

You are a Compliance Checker...
```

**After (compliance-checker.md - 234 lines with dynamic loading):**

```markdown
---
name: compliance-checker
tools: [read, write, grep, skill]  # NEW: Dynamic
---

You are a Compliance Checker...

## Domain Knowledge Skills

Load specialized knowledge using the `skill` tool:

**Your skills:**
- `danish-tender-guidelines` - Danish tender compliance rules

**Usage:**
skill({name: "danish-tender-guidelines"})

**Important:** Load this skill at the start to understand requirements.
```

**Result:**
- Agent uses dynamic loading (more flexible)
- Skill loaded only when needed
- Conversation history caches content automatically
- Total system: 228 lines of shared knowledge (1 skill, 4 agents)

---

## Real Examples

### Example 1: Danish Tender Guidelines

**Purpose:** Compliance rules and formatting for Danish public tenders

**Structure:**
```
skills/danish-tender-guidelines/
├── SKILL.md
├── reference/
│   ├── deadline-rules.md
│   ├── format-validation.md
│   └── marker-system.md
└── assets/
    ├── analysis-template.md
    └── checklist-template.md
```

**SKILL.md (excerpt):**

```markdown
---
name: danish-tender-guidelines
description: Danish public tender (offentlig udbud) compliance rules and formatting standards
metadata:
  version: "1.0.0"
  tags: "tender,danish,compliance"
---

# Danish Tender Guidelines

## Critical Marker System

**ALL data MUST be marked for transparency:**

- **[FAKTA]** - Direct facts from tender with source
- **[ESTIMAT]** - Calculations and assessments
- **[ANTAGET]** - Assumptions where data missing
- **[UKENDT]** - Information not found
- **[SKAL]** - Mandatory requirement
- **[BØR]** - Recommended requirement
- **[KAN]** - Optional requirement

## Neutrality Requirement

**YOU MUST REMAIN NEUTRAL:**
- ✅ Extract requirements objectively
- ❌ NEVER assess bidder's capabilities
- ❌ NEVER make GO/NO-GO recommendations
```

**Used by 4 agents dynamically:**

```yaml
---
name: tender-orchestrator
tools: [delegate, todowrite, read, list, skill]
---

## Domain Knowledge Skills

Load specialized knowledge using the `skill` tool:

**Your skills:**
- `danish-tender-guidelines` - Danish tender compliance and formatting

**Usage:**
skill({name: "danish-tender-guidelines"})
```

All 4 agents (`tender-orchestrator`, `technical-analyst`, `go-no-go-analyzer`, `compliance-checker`) load the same skill dynamically when needed.

### Example 2: Complexity Calculator

**Purpose:** Project complexity estimation methodology

**Structure:**
```
skills/complexity-calculator/
├── SKILL.md
└── scripts/
    └── calculate_fp.py
```

**Used with technical-analyst:**

```yaml
---
name: technical-analyst
tools: [read, write, grep, skill]
---

Analyze technical requirements and estimate complexity...

## Available Skills

Load these skills as needed:
- `danish-tender-guidelines` - Tender compliance rules
- `complexity-calculator` - Complexity estimation methodology

## Your Process

1. Load required skills:
   - skill({name: "danish-tender-guidelines"})
   - skill({name: "complexity-calculator"})
2. Analyze requirements following guidelines
3. Calculate complexity using methodology
4. Generate report
```

The agent loads both skills dynamically and uses them together.

### Example 3: Simple Skill (No Resources)

Minimal skill with just instructions:

```markdown
---
name: sql-query-builder
description: SQL query construction best practices
---

# SQL Query Builder

## Query Construction Guidelines

1. Always use parameterized queries (prevent SQL injection)
2. Use explicit column names (not SELECT *)
3. Include appropriate indexes in WHERE clauses
4. Use EXPLAIN to verify query plans

## Common Patterns

### Safe Query Pattern
```sql
SELECT id, name, email
FROM users
WHERE status = ?
  AND created_at > ?
ORDER BY created_at DESC
LIMIT 100;
```

### Avoiding N+1 Queries

Use JOINs instead of multiple queries:

```sql
-- Good
SELECT users.*, orders.id, orders.total
FROM users
LEFT JOIN orders ON orders.user_id = users.id;

-- Bad (N+1)
SELECT * FROM users;
-- Then for each user: SELECT * FROM orders WHERE user_id = ?
```
```

---

## Best Practices

### 1. Keep Skills Focused

**✅ Good:**
```
skills/danish-tender-guidelines/   # Single domain
skills/uk-tender-guidelines/       # Single domain
skills/complexity-calculator/      # Single purpose
```

**❌ Bad:**
```
skills/everything/                 # Too broad
skills/tender-and-pricing/         # Multiple domains
```

### 2. Name Skills Clearly

**✅ Good names:**
- `danish-tender-guidelines`
- `gdpr-compliance-rules`
- `medical-coding-standards`
- `financial-reporting-requirements`

**❌ Bad names:**
- `utils`
- `helpers`
- `common`
- `misc`

### 3. Write Self-Contained Instructions

Skills should be understandable on their own:

**✅ Good:**
```markdown
# Danish Tender Guidelines

## Marker System

Use these markers for transparency:
- [FAKTA] - Facts from tender documents
- [ESTIMAT] - Your calculations
```

**❌ Bad:**
```markdown
# Guidelines

Use the markers.
[Assumes you know what markers are]
```

### 4. Use Resources Wisely

**Instructions (SKILL.md):** Core knowledge the agent always needs

**Reference:** Detailed docs the agent reads occasionally

**Assets:** Templates the agent outputs

**Scripts:** Deterministic calculations

**Example organization:**

```
skills/api-integration/
├── SKILL.md                # Core API usage guidelines (always needed)
├── reference/
│   └── api-spec.md         # Full API spec (read when needed)
├── assets/
│   └── request-template.json  # Template for requests
└── scripts/
    └── sign_request.py     # Authentication signing
```

### 5. Document Skill Dependencies

If a skill expects certain agent capabilities:

```markdown
---
name: database-query-builder
description: SQL query construction and optimization
metadata:
  required-tools: "grep,read"
  required-context: "database schema must be available"
---

**Prerequisites:**
- Agent must have access to database schema files
- Agent should be able to read table definitions
```

### 6. Version Your Skills

Track changes to domain knowledge:

```markdown
---
name: gdpr-compliance
description: GDPR compliance requirements
metadata:
  version: "2.1.0"
  updated: "2025-10-26"
  changelog: "Added UK GDPR divergence notes"
---
```

### 7. Test Skills Independently

Create test agents to verify skills work correctly:

```yaml
---
name: skill-test-agent
tools: [read, write]
skills: [my-skill]
---

Test agent to verify my-skill provides correct guidance...
```

### 8. Avoid Agent-Specific Instructions

**✅ Good (generic):**
```markdown
## Output Format

Generate reports with these sections:
1. Executive Summary
2. Detailed Analysis
3. Recommendations
```

**❌ Bad (agent-specific):**
```markdown
## Output Format

You (the technical-analyst agent) should...
[Assumes specific agent name]
```

Skills should work with ANY agent that needs that knowledge.

---

## API Reference

### Skill Tool

```typescript
interface SkillToolArgs {
  name: string;  // Skill name to load
}

interface SkillToolResult {
  content: string;  // Formatted skill content
  error?: string;   // Error message if skill not found
}

// Usage in agent
skill({name: "my-skill"})
```

**Tool Behavior:**
- Queries SkillRegistry for requested skill
- Returns formatted content with instructions and resource paths
- Provides helpful error with available skills if not found
- Case-insensitive name matching (normalizes to lowercase)

### createSkillTool()

```typescript
function createSkillTool(skillRegistry: SkillRegistry): BaseTool;
```

Factory function that creates the skill tool with dynamic skill list in description.

**Returns:**
- `BaseTool` with name "skill"
- Description includes all available skills from registry
- Execute function handles loading and formatting

### Skill Class

```typescript
class Skill {
  readonly name: string;
  readonly description: string;
  readonly license?: string;
  readonly allowedTools?: string[];
  readonly metadata?: Record<string, string>;
  readonly instructions: string;
  readonly path: string;  // Absolute filesystem path to skill directory

  // Resource access (lazy loaded)
  listReferences(): string[];
  listScripts(): string[];
  listAssets(): string[];

  getReference(filename: string): Promise<string | undefined>;
  getScript(filename: string): Promise<string | undefined>;
  getAsset(filename: string): Promise<string | undefined>;

  loadAllReferences(): Promise<Record<string, string>>;
  loadAllScripts(): Promise<Record<string, string>>;
  loadAllAssets(): Promise<Record<string, string>>;
}
```

### SkillRegistry

```typescript
class SkillRegistry {
  constructor(skillsDir: string, logger?: AgentLogger);

  // Load all skills from directory
  loadSkills(): Promise<void>;

  // Register skill programmatically
  registerSkill(skill: Skill): void;

  // Lookup skills (case-insensitive)
  getSkill(name: string): Skill | undefined;
  getSkills(names: string[]): Skill[];
  hasSkill(name: string): boolean;

  // Discovery
  listSkills(): Array<{name: string, description: string}>;
  findByTags(tags: string[]): Skill[];

  // Management
  clear(): void;
  get size(): number;
}
```

### SkillLoader

```typescript
class SkillLoader {
  constructor(logger?: AgentLogger);

  // Load single skill from directory
  loadSkill(skillPath: string): Promise<Skill>;
}
```

### Agent Frontmatter

```typescript
interface Agent {
  name: string;
  tools?: string[] | '*';  // Include 'skill' to use skill tool
  // Note: 'skills' field removed in dynamic system
  // ... other fields
}
```

**Migration Note:** The `skills:` frontmatter field from the static system is no longer used. Agents now load skills via the `skill` tool at runtime.

### System Builder

```typescript
class AgentSystemBuilder {
  // Add skill directories - loads into registry
  withSkillsFrom(...directories: string[]): AgentSystemBuilder;

  // Build system with skill tool available
  async build(): Promise<{
    executor: AgentExecutor;
    logger: EventLogger;
    cleanup: () => Promise<void>;
  }>;
}
```

**What happens:**
1. `withSkillsFrom()` creates SkillRegistry and loads all skills
2. Skill tool created with reference to registry
3. Skill tool registered as built-in tool
4. Agents that include 'skill' in tools can load skills dynamically

---

## Troubleshooting

### Skill Not Found

**Error:**
```
Error: No SKILL.md found in skills/my-skill
```

**Solutions:**
1. Verify `SKILL.md` exists (case-sensitive)
2. Check skill directory name matches `name` in frontmatter
3. Ensure skills directory path is correct in `withSkillsFrom()`

### Name Mismatch

**Error:**
```
Skill name mismatch: directory 'my-skill' but frontmatter has 'myskill'
```

**Solution:**
Directory name and `name` field must match exactly:

```bash
skills/my-skill/SKILL.md
```

```yaml
---
name: my-skill  # Must match directory name
---
```

### Invalid Name Format

**Error:**
```
Invalid skill name: must be hyphen-case
```

**Solution:**
Use lowercase with hyphens only:

**✅ Valid:** `my-skill`, `danish-tender`, `sql-builder`

**❌ Invalid:** `mySkill`, `My_Skill`, `my skill`

### Agent Not Loading Skills

**Symptoms:** Agent doesn't have skill knowledge

**Checklist:**

1. ✅ Skill tool added to agent's tools?
   ```yaml
   tools: [read, write, skill]  # Must include 'skill'
   ```

2. ✅ Agent instructions mention loading skills?
   ```markdown
   ## Available Skills

   Load: skill({name: "my-skill"})
   ```

3. ✅ Skills directory specified in builder?
   ```typescript
   .withSkillsFrom('./skills')
   ```

4. ✅ Agent actually calling skill tool?
   Check logs for: `[tool_call] skill {"name": "my-skill"}`

5. ✅ SKILL.md has content after frontmatter?
   ```markdown
   ---
   name: my-skill
   ---

   [Instructions must be here, not empty]
   ```

### Skill Tool Not Available

**Error in logs:**
```
Agent requested unknown tool: skill
```

**Solution:**
Skill tool is only available if skills directory specified:

```typescript
const system = await AgentSystemBuilder.default()
  .withAgentsFrom('./agents')
  .withSkillsFrom('./skills')  // Required for skill tool
  .build();
```

### Skill Not Loading Dynamically

**Symptoms:** Agent completes task without loading skill

**Possible causes:**

1. **Agent doesn't know about skill** - Add to agent instructions:
   ```markdown
   ## Available Skills
   - skill({name: "domain-expertise"})
   ```

2. **Agent decided not to load** - Strengthen instructions:
   ```markdown
   **IMPORTANT:** Load domain-expertise FIRST:
   skill({name: "domain-expertise"})
   ```

3. **Hint not showing** - Check if pattern matches in `context-setup.middleware.ts`

### Resource Not Loading

**Error:**
```
Resource not found: reference/doc.md
```

**Solutions:**
1. Check file exists in correct subdirectory
2. Verify file extension is allowed
3. Use correct resource type (reference vs assets vs scripts)

**Allowed extensions:**
- **reference/**: `.md`, `.txt`, `.json`, `.yaml`, `.yml`, `.xml`, `.csv`
- **assets/**: `.txt`, `.md`, `.json`, `.yaml`, `.yml`, `.xml`, `.csv`, `.html`, `.css`, `.svg`
- **scripts/**: `.py`, `.js`, `.ts`, `.sh`, `.bash`, `.zsh`, `.fish`, `.rb`, `.pl`

### Multiple Skills Conflicting

**Symptoms:** Instructions from one skill override another

**Solution:**
Skills are injected in order declared. If there's overlap:

1. Reorganize skill content to be complementary
2. Create a new combined skill
3. Be explicit about which skill handles what

**Example:**

```yaml
skills:
  - base-domain-rules      # General rules
  - specific-requirements  # Specific additions
```

### Performance: Too Many Skills

**Symptoms:** Slow agent loading

**Solution:**
Skills are lazy-loaded (resources on-demand), but instructions load immediately.

If instructions are too large:
1. Move detailed content to `reference/`
2. Keep only essential guidelines in SKILL.md
3. Split into focused skills

### Validation Errors

**Error:**
```
Invalid skill frontmatter in 'my-skill': description is required
```

**Solution:**
Ensure all required fields present:

```yaml
---
name: my-skill          # Required
description: What it does  # Required
---
```

### Skills Directory Not Found

**Warning:**
```
No skills directory found at skills (this is OK - skills are optional)
```

**This is normal if:**
- You haven't created skills yet
- Skills are in a different directory

**To fix:**
```typescript
.withSkillsFrom('./path/to/skills')
```

---

## Summary

**Dynamic Skills enable you to:**
- ✅ Write domain knowledge once, use everywhere
- ✅ Load skills on-demand when needed (not at build time)
- ✅ Compose expertise across agents
- ✅ Maintain knowledge separately from agent logic
- ✅ Leverage conversation history as natural cache
- ✅ Collaborate effectively (agents vs domain experts)

**Getting Started:**
1. Create `skills/my-skill/SKILL.md`
2. Add frontmatter (name, description)
3. Write instructions (markdown)
4. Add `skill` to agent's tools: `tools: [read, write, skill]`
5. Instruct agent to load: `skill({name: "my-skill"})`
6. Build with: `.withSkillsFrom('./skills')`

**Key Concepts:**
- **Dynamic Loading**: Skills loaded at runtime via tool call
- **Conversation Cache**: Once loaded, content persists in conversation history
- **No Reloading**: Agents don't need to reload - already in context
- **On-Demand**: Load only what's needed, when it's needed

**Architecture:**
```
User Prompt → Hint System → Agent Instructions → Skill Tool Call
                                                      ↓
                                            SkillRegistry.getSkill()
                                                      ↓
                                            Return Formatted Content
                                                      ↓
                                          Add to Conversation History
                                                      ↓
                                            Agent Uses Knowledge
```

**Next Steps:**
- Review [real examples](#real-examples) from the codebase
- Study `packages/examples/udbud/skills/` for working skills
- Read [migration guide](#migration-guide) for static→dynamic migration
- Check [best practices](#best-practices) before creating skills
- Explore [hint system](#hint-system) for automatic skill suggestions

For technical details, see the [implementation](../packages/core/src/skills/) or run tests with coverage:
```bash
npm run test:coverage
```

**Test Coverage:**
- Unit tests: 79 tests (skill tool, registry, loader, validation)
- Integration tests: 5 tests (dynamic loading, caching, errors)
- Coverage: **~95%** - Production ready! ✅

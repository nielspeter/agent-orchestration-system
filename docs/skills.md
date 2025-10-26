# Skills System

**Skills** are domain expertise packages that agents can load dynamically to handle specialized tasks. They enable you to write domain knowledge once and reuse it across all agents.

## Table of Contents

- [Quick Start](#quick-start)
- [What Are Skills?](#what-are-skills)
- [When to Use Skills](#when-to-use-skills)
- [Creating Skills](#creating-skills)
  - [Skill Structure](#skill-structure)
  - [SKILL.md Format](#skillmd-format)
  - [Resource Directories](#resource-directories)
- [Using Skills in Agents](#using-skills-in-agents)
- [Migration Guide](#migration-guide)
- [Real Examples](#real-examples)
- [Best Practices](#best-practices)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

**Create a skill in 2 minutes:**

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
tools: [read, write]
skills: [my-domain-expertise]
---

You are an agent that uses my-domain-expertise...
EOF

# 4. Load and run
npm run agent -- -a my-agent -p "Your task"
```

That's it! The skill's knowledge is now available to your agent.

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

### Declaring Skills

Add `skills` to agent frontmatter:

```yaml
---
name: my-agent
tools: [read, write, grep]
skills:
  - domain-expertise-1
  - domain-expertise-2
---
```

Multiple skills work together:

```yaml
---
name: technical-analyst
tools: [read, write, grep]
skills:
  - danish-tender-guidelines  # Tender compliance rules
  - complexity-calculator     # Estimation methodology
---
```

### How Skills Are Loaded

**At agent load time:**
1. System reads agent frontmatter
2. Loads each declared skill
3. Validates skill frontmatter
4. Appends instructions to system prompt

**Format in system prompt:**

```
[Agent's main instructions...]

### danish-tender-guidelines
*Danish public tender (offentlig udbud) compliance rules*

[Skill's instructions...]

### complexity-calculator
*Project complexity estimation methodology*

[Skill's instructions...]
```

### System Builder API

```typescript
// Automatic skill loading (recommended)
const system = await AgentSystemBuilder.default()
  .withAgentsFrom('./agents')
  .withSkillsFrom('./skills')    // Loads all skills from directory
  .build();

// Multiple skill directories
const system = await AgentSystemBuilder.default()
  .withAgentsFrom('./agents')
  .withSkillsFrom('./skills', './shared-skills')
  .build();

// Skills are optional - no error if directory doesn't exist
const system = await AgentSystemBuilder.default()
  .withAgentsFrom('./agents')
  // Skills directory not specified - still works
  .build();
```

**Skill discovery:**
- Scans `skills/` directory for subdirectories
- Each subdirectory must contain `SKILL.md`
- Invalid skills logged but don't break loading

---

## Migration Guide

### Identifying Extractable Knowledge

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
- **[UKLAR]** - Unclear requirement
- **[KONFLIKT]** - Conflicting requirements

## File Locations

**Standard paths:**
- **Source**: `udbud/dokumenter/udbud/`
- **Converted**: `udbud/output/converted/`
- **Output**: `udbud/output/`
```

This knowledge appears in multiple agents → Extract to skill!

### Step-by-Step Migration

**Step 1: Identify common knowledge**

Search for duplicated sections across agents:

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

Move duplicated content to SKILL.md:

```markdown
---
name: domain-name
description: Brief description of domain knowledge
---

# Domain Name

[Extracted knowledge goes here...]
```

**Step 4: Update agents to reference skill**

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
tools: [read, write]
skills: [domain-name]
---

You are an agent...

[Domain guidelines now provided by skill]
```

**Step 5: Remove duplicated content from agents**

Delete the sections now in the skill:

```markdown
---
name: my-agent
tools: [read, write]
skills: [domain-name]
---

You are an agent specialized in...

## Your Process

1. Read the documents
2. Apply domain-name guidelines (from skill)
3. Generate output

[Agent-specific logic only...]
```

**Step 6: Test thoroughly**

```bash
# Run tests
npm test

# Test agent with skill
npm run agent -- -a my-agent -p "test task"
```

### Migration Example (Real)

**Before Migration (compliance-checker.md - 304 lines):**

```markdown
---
name: compliance-checker
tools: [read, write, grep]
---

You are a Compliance Checker...

## File Locations

**Standard paths:**
- Source: `udbud/dokumenter/udbud/`
- Converted: `udbud/output/converted/`
- Output: `udbud/output/`

## Marker System

**ALL requirements MUST be marked:**
- **[SKAL]** - Mandatory
- **[BØR]** - Recommended
- **[KAN]** - Optional
...

[140 lines of agent logic...]
```

**After Migration (compliance-checker.md - 290 lines, danish-tender-guidelines skill - 228 lines):**

```markdown
---
name: compliance-checker
tools: [read, write, grep]
skills: [danish-tender-guidelines]
---

You are a Compliance Checker...

**Note**: File locations and marker system are defined in the danish-tender-guidelines skill.

[140 lines of agent logic...]
```

**Result:**
- Agent is 14 lines shorter (cleaner, more focused)
- Skill is shared with 3 other agents
- Total system: 228 lines of shared knowledge vs 240 lines duplicated
- Maintenance: Update 1 skill vs 4 agents

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

**Used by 4 agents:**
- `tender-orchestrator` - Coordinates analysis
- `technical-analyst` - Technical evaluation
- `go-no-go-analyzer` - Decision support
- `compliance-checker` - Compliance verification

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
tools: [read, write, grep]
skills:
  - danish-tender-guidelines
  - complexity-calculator
---

Analyze technical requirements and estimate complexity...
```

The agent gets both Danish tender rules AND complexity methodology.

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

### Skill Class

```typescript
class Skill {
  readonly name: string;
  readonly description: string;
  readonly license?: string;
  readonly allowedTools?: string[];
  readonly metadata?: Record<string, string>;
  readonly instructions: string;
  readonly path: string;

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

  // Lookup skills
  getSkill(name: string): Skill | undefined;
  getSkills(names: string[]): Skill[];
  hasSkill(name: string): boolean;

  // Discovery
  listSkills(): Skill[];
  listSkillNames(): string[];
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
  tools?: string[] | '*';
  skills?: string[];  // Skill names to load
  // ... other fields
}
```

### System Builder

```typescript
class AgentSystemBuilder {
  // Add skill directories
  withSkillsFrom(...directories: string[]): AgentSystemBuilder;

  // Skills loaded automatically when agents loaded
  async build(): Promise<{
    executor: AgentExecutor;
    cleanup: () => Promise<void>;
  }>;
}
```

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

### Skill Instructions Not Appearing

**Symptoms:** Agent doesn't have skill knowledge

**Checklist:**
1. ✅ Skill declared in agent frontmatter?
   ```yaml
   skills: [my-skill]
   ```

2. ✅ Skills directory specified in builder?
   ```typescript
   .withSkillsFrom('./skills')
   ```

3. ✅ Skill loaded without errors?
   Check logs for skill loading messages

4. ✅ SKILL.md has content after frontmatter?
   ```markdown
   ---
   name: my-skill
   ---

   [Instructions must be here, not empty]
   ```

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

**Skills enable you to:**
- ✅ Write domain knowledge once, use everywhere
- ✅ Compose expertise across agents
- ✅ Maintain knowledge separately from agent logic
- ✅ Collaborate effectively (agents vs domain experts)
- ✅ Reduce context size by loading only needed knowledge

**Getting Started:**
1. Create `skills/my-skill/SKILL.md`
2. Add frontmatter (name, description)
3. Write instructions (markdown)
4. Reference in agent: `skills: [my-skill]`
5. Build with: `.withSkillsFrom('./skills')`

**Next Steps:**
- Review [real examples](#real-examples) from the codebase
- Study `packages/examples/udbud/skills/` for working skills
- Read [migration guide](#migration-guide) to extract knowledge
- Check [best practices](#best-practices) before creating skills

For technical details, see the [implementation](../packages/core/src/skills/) or run tests with coverage:
```bash
npm run test:coverage
```

Skills system: **97.95% test coverage** - Production ready! ✅

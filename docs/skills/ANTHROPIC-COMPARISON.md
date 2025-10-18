# Comparison: Our Plan vs Anthropic's Implementation

**Date:** 2025-10-18
**Source:** `/Users/nps/Documents/Projects/NielsPeter/anthropics/skills/`

This document compares our Skills implementation plan with Anthropic's actual implementation.

## Key Learnings from Anthropic's Implementation

### 1. Minimal Frontmatter (Spec Compliant)

**Anthropic's Official Spec** (`agent_skills_spec.md`):

**Required:**
- `name` - hyphen-case, matches directory name
- `description` - when Claude should use the skill

**Optional:**
- `license` - short license identifier or filename
- `allowed-tools` - pre-approved tools (Claude Code only)
- `metadata` - free-form key-value for custom properties

**Our Plan Had:**
```yaml
name: my-skill
version: 1.0.0           # ❌ Not in spec
description: ...
tags: [tag1, tag2]       # ❌ Not in spec
capabilities: [cap1]     # ❌ Not in spec
author: ...              # ❌ Not in spec
created: ...             # ❌ Not in spec
updated: ...             # ❌ Not in spec
```

**Anthropic's Approach:**
- Keep frontmatter minimal (name + description only)
- Use `metadata` field for custom properties if needed
- No versioning in spec (rely on git/file history)

**Recommendation:** ✅ **Follow Anthropic's minimal spec**
- Required: `name`, `description`
- Optional: `license`, `metadata` (for custom properties like version if needed)

---

### 2. Directory Structure

**Anthropic's Structure:**
```
skill-name/
├── SKILL.md (required)
├── reference/          # Documentation (NOT references/)
│   └── api_docs.md
├── scripts/            # Executable code
│   └── process.py
└── assets/             # Output resources (not in our plan)
    └── template.html
```

**Our Plan Had:**
```
skill-name/
├── SKILL.md
├── templates/          # ❌ Anthropic calls this assets/
│   └── output.md
├── scripts/            # ✅ Same
│   └── calc.js
├── schemas/            # ❌ Would go in reference/
│   └── data.json
└── examples/           # ❌ Would go in reference/
    └── sample.md
```

**Key Differences:**

1. **reference/** (singular, not plural)
   - **Purpose:** Documentation Claude reads AS NEEDED
   - **Examples:** API docs, schemas, policies, detailed guides
   - **NOT loaded into context automatically**
   - **Claude decides when to read them**

2. **assets/** (NEW - we didn't have this)
   - **Purpose:** Files used IN OUTPUT (not loaded to context)
   - **Examples:** Templates, logos, fonts, boilerplate code
   - **NOT for documentation**
   - **Copied or used in final output**

3. **scripts/** (same)
   - **Purpose:** Executable code
   - **Can be executed WITHOUT loading to context**

**Recommendation:** ✅ **Adopt Anthropic's structure**
```
skill-name/
├── SKILL.md
├── reference/    # Docs Claude reads (schemas, API docs)
├── scripts/      # Executable code
└── assets/       # Output resources (templates, logos)
```

---

### 3. Progressive Disclosure Design

**From skill-creator skill:**

> Skills use a three-level loading system to manage context efficiently:
>
> 1. **Metadata (name + description)** - Always in context (~100 words)
> 2. **SKILL.md body** - When skill triggers (<5k words)
> 3. **Bundled resources** - As needed by Claude (Unlimited*)
>
> *Unlimited because scripts can be executed without reading into context window.

**Our Plan:**
- Load all skills at agent startup
- Inject all skill instructions into system prompt

**Anthropic's Approach:**
- Metadata always available (lightweight)
- Full SKILL.md loaded when skill is relevant
- Resources loaded only when Claude needs them

**Recommendation:** ⚠️ **Consider for v2**
- v1: Static loading (all skills injected at start)
- v2: Dynamic loading (skills loaded when relevant)

**Why defer:** Dynamic loading requires:
- Skill discovery mechanism
- Relevance matching (semantic search)
- More complex implementation

v1 focus: Get core infrastructure working with static loading.

---

### 4. Real Examples from Anthropic

#### Example 1: xlsx Skill (Simple)

**Structure:**
```
xlsx/
├── SKILL.md (10KB)
├── recalc.py
└── LICENSE.txt
```

**SKILL.md Contents:**
- Requirements (color coding, formatting, zero errors)
- Workflows (reading, creating, formula construction)
- Best practices (use formulas, not hardcoded values)

**No subdirectories** - just SKILL.md + script

#### Example 2: mcp-builder Skill (Complex)

**Structure:**
```
mcp-builder/
├── SKILL.md (13KB)
├── reference/
│   ├── evaluation.md
│   ├── mcp_best_practices.md
│   ├── node_mcp_server.md
│   └── python_mcp_server.md
├── scripts/
│   ├── connections.py
│   ├── evaluation.py
│   ├── example_evaluation.xml
│   └── requirements.txt
└── LICENSE.txt
```

**SKILL.md References Resources:**
- "See reference/mcp_best_practices.md for guidelines"
- "Use scripts/evaluation.py to test"

**Claude reads reference/ files ONLY when needed**

#### Example 3: brand-guidelines Skill (Medium)

**Structure:**
```
brand-guidelines/
├── SKILL.md (2KB)
└── LICENSE.txt
```

**Just instructions** - no bundled resources

---

### 5. Writing Style

**From skill-creator:**

> Write the entire skill using **imperative/infinitive form** (verb-first instructions), not second person. Use objective, instructional language.

**Examples:**
- ✅ "To rotate a PDF, use scripts/rotate.py"
- ✅ "Check schemas in reference/api_docs.md"
- ❌ "You should rotate the PDF"
- ❌ "If you need to rotate..."

**Recommendation:** ✅ **Follow this style guide**

---

### 6. Skill Creation Process (from skill-creator)

Anthropic's recommended workflow:

1. **Understanding with Examples** - Get concrete use cases
2. **Planning Reusable Contents** - Identify scripts/references/assets needed
3. **Initializing** - Use `init_skill.py` script (generates template)
4. **Editing** - Start with bundled resources, then SKILL.md
5. **Packaging** - Use `package_skill.py` (validates + creates .zip)
6. **Iteration** - Test, get feedback, improve

**Our Plan:**
- Manual skill creation (no init script)
- No validation tool
- No packaging tool

**Recommendation:** ⚠️ **Consider for Phase 4 (Tooling)**
- Create `init_skill.ts` - generates skill template
- Create `validate_skill.ts` - checks frontmatter, structure
- Create `package_skill.ts` - creates distributable .zip

---

## Recommended Changes to Our Plan

### Phase 1: Core Infrastructure

**Keep:**
- SkillLoader, SkillRegistry
- Zod validation

**Change:**
1. **Minimal Frontmatter**
   ```typescript
   const SkillFrontmatterSchema = z.object({
     name: z.string().min(1),
     description: z.string().min(1),
     license: z.string().optional(),
     'allowed-tools': z.array(z.string()).optional(),
     metadata: z.record(z.string()).optional(),
   });
   ```

2. **Updated Directory Structure**
   ```typescript
   interface Skill {
     name: string;
     description: string;
     license?: string;
     allowedTools?: string[];
     metadata?: Record<string, string>;
     instructions: string; // SKILL.md body

     // Resources
     reference?: Record<string, string>;  // Docs Claude reads
     scripts?: Record<string, string>;     // Executable code
     assets?: Record<string, string>;      // Output resources
   }
   ```

3. **SkillLoader Updates**
   ```typescript
   private async loadReference(skillPath: string): Promise<Record<string, string>> {
     const refDir = path.join(skillPath, 'reference'); // Singular!
     // Load .md files
   }

   private async loadAssets(skillPath: string): Promise<Record<string, string>> {
     const assetsDir = path.join(skillPath, 'assets');
     // Load template files
   }
   ```

---

### Phase 3: Migration

**Danish Tender Skill Structure:**
```
skills/danish-tender-guidelines/
├── SKILL.md
│   ---
│   name: danish-tender-guidelines
│   description: Danish public tender compliance for offentlig udbud analysis
│   ---
│
├── reference/
│   ├── marker-system.md        # Detailed [FAKTA], [ESTIMAT] rules
│   ├── deadline-rules.md        # Danish deadline calculation
│   └── format-validation.md     # Output format requirements
│
└── assets/
    ├── analysis-template.md     # Output template (used in final doc)
    └── checklist-template.md    # Validation checklist
```

**SKILL.md keeps only essential instructions:**
```markdown
# Danish Tender Guidelines

Essential instructions for Danish public tender (offentlig udbud) analysis.

## Marker System

All data must be marked. See reference/marker-system.md for complete rules.

Quick reference:
- [FAKTA] - Direct from tender
- [ESTIMAT] - Your calculations
- [INTERN VURDERING PÅKRÆVET] - Internal assessment

## Output Format

Use assets/analysis-template.md as base structure.
Validate with assets/checklist-template.md.

## Deadline Calculation

For Danish tender deadlines, see reference/deadline-rules.md.
```

**Result:**
- SKILL.md is lean (<1KB)
- Detailed docs in reference/ (loaded when needed)
- Templates in assets/ (used in output)

---

### Phase 4: Documentation & Tooling

**Add (inspired by Anthropic):**

1. **init-skill CLI command**
   ```bash
   npm run skill:init my-skill --path ./skills
   ```
   Generates:
   - SKILL.md with template
   - reference/, scripts/, assets/ directories
   - Example files

2. **validate-skill CLI command**
   ```bash
   npm run skill:validate my-skill
   ```
   Checks:
   - Frontmatter format
   - Required fields
   - File structure
   - Description quality

3. **package-skill CLI command**
   ```bash
   npm run skill:package my-skill --output ./dist
   ```
   Creates:
   - my-skill.zip
   - Validates first
   - Ready to distribute

---

## Summary: What to Keep, What to Change

### ✅ Keep from Our Plan

1. **Architecture** - SkillRegistry, SkillLoader, middleware integration
2. **Backward Compatibility** - 100% optional, no breaking changes
3. **Phase 1-2 Tasks** - Core infrastructure and agent integration
4. **Value Proposition** - DRY, composability, maintenance reduction

### 🔄 Change Based on Anthropic

1. **Frontmatter** - Minimal (name + description only)
2. **Directory Structure** - reference/, assets/ (not templates/, schemas/, examples/)
3. **Writing Style** - Imperative/infinitive form (not "you should")
4. **Progressive Disclosure** - Consider for v2 (dynamic loading)
5. **Tooling** - Add init/validate/package scripts (Phase 4)

### 📊 Impact on Timeline

**No change to 4-week timeline**, but:
- Phase 1: Simpler frontmatter (faster validation)
- Phase 3: Clearer directory structure (easier migration)
- Phase 4: More tooling work (init/validate/package scripts)

**Estimated time shift:**
- Phase 1: -2 hours (simpler validation)
- Phase 4: +8 hours (new tooling)
- Net: +6 hours (still within 4 weeks)

---

## Updated Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│ Skill Directory Structure (Anthropic-Compliant)        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  skill-name/                                            │
│  ├── SKILL.md (required)                                │
│  │   ├── Frontmatter (name, description, license)      │
│  │   └── Instructions (markdown body)                   │
│  │                                                       │
│  ├── reference/ (optional)                              │
│  │   ├── api-docs.md      ← Claude reads when needed   │
│  │   ├── schemas.json     ← Reference material         │
│  │   └── examples.md      ← Detailed guides            │
│  │                                                       │
│  ├── scripts/ (optional)                                │
│  │   ├── process.py       ← Executable code            │
│  │   └── requirements.txt ← Dependencies               │
│  │                                                       │
│  └── assets/ (optional)                                 │
│      ├── template.html    ← Used in output             │
│      └── logo.png         ← Output resources           │
│                                                         │
└─────────────────────────────────────────────────────────┘

Progressive Disclosure:
  1. Metadata (name + description) → Always in context
  2. SKILL.md body → Loaded when skill triggers
  3. reference/, scripts/, assets/ → Loaded as needed
```

---

## Next Steps

1. **Review this comparison** - Decide which Anthropic patterns to adopt
2. **Update PRD** - Reflect minimal frontmatter, updated structure
3. **Update ARCHITECTURE.md** - New directory structure, interfaces
4. **Update IMPLEMENTATION-PLAN.md** - Adjust Phase 1 validation, Phase 4 tooling
5. **Begin Phase 1** - Start with Anthropic-compliant implementation

---

## References

- **Anthropic Skills Repo:** `/Users/nps/Documents/Projects/NielsPeter/anthropics/skills/`
- **Official Spec:** `agent_skills_spec.md` (v1.0, 2025-10-16)
- **Skill Creator:** `skill-creator/SKILL.md`
- **Real Examples:** xlsx, mcp-builder, brand-guidelines

**Last Updated:** 2025-10-18

# Skills Examples

**Version:** 1.0
**Date:** 2025-10-18

This document provides concrete examples of Skills and how to use them.

## Table of Contents

1. [Basic Skill Structure](#basic-skill-structure)
2. [Before/After: Agent Migration](#beforeafter-agent-migration)
3. [Sample Skills](#sample-skills)
4. [Real-World Use Cases](#real-world-use-cases)
5. [Multi-Skill Composition](#multi-skill-composition)

---

## Basic Skill Structure

### Minimal Skill (Instructions Only)

```
skills/greeting-expert/
└── SKILL.md
```

**SKILL.md:**
```yaml
---
name: greeting-expert
version: 1.0.0
description: Professional greeting etiquette for business communications
tags: [communication, etiquette, business]
capabilities: [greetings, sign-offs, formality-adjustment]
---

# Greeting Expert

Professional business communication greetings.

## Greeting Formats

**Formal:**
- "Dear [Title] [Last Name],"
- "Good [morning/afternoon], [Title] [Last Name],"

**Semi-Formal:**
- "Hello [First Name],"
- "Hi [First Name],"

**Informal:**
- "Hey [First Name],"

## Sign-Offs

**Formal:**
- "Sincerely,"
- "Best regards,"

**Semi-Formal:**
- "Best,"
- "Thanks,"

**Informal:**
- "Cheers,"
- "Talk soon,"

Use formal greetings when:
- First contact with client
- Communication with executives
- Legal/compliance matters
```

### Rich Skill (With Resources)

```
skills/excel-analysis/
├── SKILL.md
├── templates/
│   ├── pivot-table-guide.md
│   └── formula-library.md
├── schemas/
│   └── workbook-structure.json
└── examples/
    └── sample-workbook.xlsx
```

**SKILL.md:**
```yaml
---
name: excel-analysis
version: 1.0.0
description: Advanced Excel analysis and automation
tags: [excel, spreadsheet, data-analysis, formulas]
capabilities: [formula-creation, pivot-tables, data-validation, chart-generation]
author: Excel Team
created: 2025-10-18
---

# Excel Analysis

Expert knowledge for working with Microsoft Excel spreadsheets.

## Available Templates

Use these templates for consistent Excel work:
- `pivot-table-guide.md` - Step-by-step pivot table creation
- `formula-library.md` - Common formulas with examples

## Formula Categories

### Data Lookup
- VLOOKUP, HLOOKUP
- INDEX/MATCH
- XLOOKUP (Excel 365)

### Aggregation
- SUM, AVERAGE, COUNT
- SUMIF, COUNTIF
- Conditional aggregation

[Full formula guide in templates/formula-library.md]

## Best Practices

1. Always name your ranges
2. Use tables (Ctrl+T) for structured data
3. Avoid volatile functions (NOW, TODAY) in large sheets
4. Test formulas with edge cases
```

---

## Before/After: Agent Migration

### Example: Technical Analyst Agent

#### Before (217 lines, domain knowledge embedded)

**packages/examples/udbud/agents/technical-analyst.md:**
```yaml
---
name: technical-analyst
tools: [read, write, list, grep]
thinking:
  enabled: true
  budget_tokens: 16000
---

You are a Technical Analyst specialized in deep technical analysis of tender materials.

## Extended Thinking Enabled

[10 lines about thinking...]

## ⚠️ CRITICAL - NEUTRALITY REQUIREMENT

[15 lines about neutrality...]

## Danish Tender Requirements

**ALL data in analysis MUST be marked:**
- **[FAKTA]** - Direct from tender material with source
- **[ESTIMAT]** - Your calculations/assessments
- **[ANTAGET]** - Assumptions where data is missing
- **[UKENDT]** - Information not in material
- **[INTERN VURDERING PÅKRÆVET]** - Requires internal assessment

⚠️ **IMPORTANT**: NEVER speculate about bidder's competency!

[50 more lines of Danish tender specifics...]

## File Locations

**CRITICAL - Working Directory Context**:
This script runs from `/packages/examples/` directory.

**IMPORTANT**: Always use these paths:
- **Read from**: `udbud/output/converted/`
- **Write to**: `udbud/output/`

[15 more lines about paths...]

## Your Process

### 1. Technical Deep Dive

Analyze all technical aspects:

#### System Architecture
- Current architecture
- Target architecture
- Integration landscape
[40 lines...]

#### Technology Stack
[30 lines...]

#### Non-Functional Requirements
[30 lines...]

### 2. Complexity Assessment

[30 lines...]

### 3. Resource Estimation

[30 lines...]

[Total: 217 lines, context-heavy]
```

#### After (152 lines, 30% reduction)

**packages/examples/udbud/agents/technical-analyst.md:**
```yaml
---
name: technical-analyst
tools: [read, write, list, grep]
skills: [danish-tender-guidelines, complexity-calculator, architecture-analyzer]
thinking:
  enabled: true
  budget_tokens: 16000
---

You are a Technical Analyst specialized in deep technical analysis of tender materials.

## Extended Thinking Enabled

[10 lines about thinking...]

## ⚠️ CRITICAL - NEUTRALITY REQUIREMENT

[15 lines about neutrality...]

## Your Role

You analyze tender materials from a **technical perspective** for development teams.

Use available skills for:
- **danish-tender-guidelines**: Compliance, markers, format validation
- **complexity-calculator**: Effort estimation, complexity scoring
- **architecture-analyzer**: System design assessment

## File Locations

**Working Directory**: `/packages/examples/`

**Paths**:
- Read from: `udbud/output/converted/`
- Write to: `udbud/output/`

## Your Process

### 1. Technical Deep Dive

Use **architecture-analyzer** skill to assess:
- Current vs target architecture
- Integration landscape
- Technology stack requirements

### 2. Complexity Assessment

Use **complexity-calculator** skill to evaluate:
- Integration complexity (1-10 scale)
- Data migration complexity
- Security/performance requirements

### 3. Resource Estimation

Calculate resources needed:
- Developer hours by technology
- Architect involvement
- Testing resources

### 4. Generate TEKNISK-ANALYSE.md

Use **danish-tender-guidelines** skill for output format.

Write to `udbud/output/TEKNISK-ANALYSE.md` with:
- Executive summary
- System architecture assessment
- Technology stack analysis
- Complexity scores
- Resource estimates
- Risk identification

Ensure all data properly marked ([FAKTA], [ESTIMAT], etc.)

[Total: 152 lines, 30% shorter, cleaner]
```

**New Skill: skills/danish-tender-guidelines/SKILL.md:**
```yaml
---
name: danish-tender-guidelines
version: 1.0.0
description: Danish public tender compliance rules and formatting
tags: [tender, danish, compliance, formatting]
capabilities: [validation, formatting, marker-system]
---

# Danish Tender Guidelines

[60 lines of Danish-specific knowledge extracted from agents]

## Required Markers

**ALL data MUST be marked:**
- **[FAKTA]** - Direct from tender with source
- **[ESTIMAT]** - Calculations/assessments
- **[ANTAGET]** - Assumptions
- **[UKENDT]** - Missing information
- **[INTERN VURDERING PÅKRÆVET]** - Internal assessment needed

[Rest of Danish rules...]
```

**Result:**
- ✅ Agent reduced from 217 → 152 lines (30% reduction)
- ✅ Danish knowledge extracted to reusable skill
- ✅ 4 agents can share same Danish rules
- ✅ Update Danish rules once, all agents benefit

---

## Sample Skills

### 1. Danish Tender Guidelines

**Use Case:** Multiple agents analyzing Danish public tenders need consistent compliance.

**Structure:**
```
skills/danish-tender-guidelines/
├── SKILL.md
├── templates/
│   ├── analysis-checklist.md
│   └── output-template.md
└── schemas/
    └── tender-metadata.json
```

**SKILL.md:**
```yaml
---
name: danish-tender-guidelines
version: 1.0.0
description: Danish public tender (offentlig udbud) compliance
tags: [tender, danish, compliance, public-procurement]
capabilities: [validation, formatting, deadline-calculation, marker-system]
---

# Danish Tender Guidelines

[Full guidelines for Danish tender analysis...]
```

**Used by:**
- tender-orchestrator
- technical-analyst
- go-no-go-analyzer
- response-preparation

---

### 2. SQL Query Expert

**Use Case:** Agents need to generate, validate, and optimize SQL queries.

**Structure:**
```
skills/sql-query-expert/
├── SKILL.md
├── templates/
│   ├── query-patterns.sql
│   └── optimization-guide.md
└── examples/
    ├── join-examples.sql
    └── subquery-examples.sql
```

**SKILL.md:**
```yaml
---
name: sql-query-expert
version: 1.0.0
description: SQL query generation and optimization
tags: [sql, database, query-optimization, data]
capabilities: [query-generation, optimization, validation]
---

# SQL Query Expert

Expert knowledge for writing efficient SQL queries.

## Query Patterns

### Simple SELECT
```sql
SELECT column1, column2
FROM table_name
WHERE condition
ORDER BY column1 DESC;
```

### JOINs
```sql
-- INNER JOIN
SELECT t1.*, t2.*
FROM table1 t1
INNER JOIN table2 t2 ON t1.id = t2.table1_id;

-- LEFT JOIN
SELECT t1.*, t2.*
FROM table1 t1
LEFT JOIN table2 t2 ON t1.id = t2.table1_id;
```

### Aggregation
```sql
SELECT
  category,
  COUNT(*) as count,
  AVG(price) as avg_price
FROM products
GROUP BY category
HAVING COUNT(*) > 10;
```

## Optimization Rules

1. **Use indexes** - Add indexes on WHERE, JOIN, ORDER BY columns
2. **Avoid SELECT *** - Specify only needed columns
3. **Filter early** - WHERE before JOIN when possible
4. **Use EXPLAIN** - Analyze query execution plan

## Validation Checklist

Before executing:
- [ ] SQL injection safe (parameterized queries)
- [ ] Indexes on filter columns
- [ ] Result set bounded (LIMIT clause)
- [ ] No N+1 query patterns

[See examples/ for complete query patterns]
```

**Usage:**
```yaml
# In agent frontmatter
---
name: database-agent
skills: [sql-query-expert]
---
```

---

### 3. Brand Guidelines

**Use Case:** All content generated must follow company brand guidelines.

**Structure:**
```
skills/company-brand-guidelines/
├── SKILL.md
├── templates/
│   ├── email-template.md
│   ├── report-template.md
│   └── presentation-template.md
└── examples/
    ├── good-examples.md
    └── bad-examples.md
```

**SKILL.md:**
```yaml
---
name: company-brand-guidelines
version: 1.0.0
description: Acme Corp brand voice and style guidelines
tags: [branding, style, communication, marketing]
capabilities: [tone-adjustment, formatting, brand-compliance]
---

# Acme Corp Brand Guidelines

Official brand voice and style for all communications.

## Brand Voice

**Tone:** Professional, approachable, innovative

**Attributes:**
- Clear and concise
- Human, not corporate
- Solution-focused
- Optimistic

## Writing Style

### Do's
✅ Use active voice
✅ Write in present tense
✅ Use "we" and "you"
✅ Break up long paragraphs
✅ Use bullet points

### Don'ts
❌ Use jargon or buzzwords
❌ Write long sentences (>25 words)
❌ Use exclamation marks excessively
❌ Start sentences with "So" or "Well"

## Formatting

### Headers
- H1: Title Case
- H2-H6: Sentence case

### Lists
- Use bullets for unordered
- Use numbers for steps
- Keep items parallel

### Emphasis
- **Bold** for key terms
- *Italic* for slight emphasis
- ~~Strikethrough~~ for deprecation

## Examples

**Good:**
> We help teams build better software, faster. Our platform automates repetitive tasks so developers can focus on innovation.

**Bad:**
> Our cutting-edge, next-generation platform leverages AI/ML to synergize cross-functional teams and optimize workflows.

[See templates/ for full document templates]
```

**Usage:**
```yaml
# All customer-facing agents use this
---
name: customer-support
skills: [company-brand-guidelines]
---
```

---

### 4. Medical Terminology

**Use Case:** Healthcare agents need accurate medical terminology and compliance.

**Structure:**
```
skills/medical-terminology/
├── SKILL.md
├── schemas/
│   ├── icd-10-codes.json
│   └── medical-abbreviations.json
└── examples/
    └── clinical-notes-sample.md
```

**SKILL.md:**
```yaml
---
name: medical-terminology
version: 1.0.0
description: Medical terminology, ICD-10 codes, and healthcare compliance
tags: [medical, healthcare, terminology, compliance, hipaa]
capabilities: [diagnosis-coding, medical-writing, hipaa-compliance]
---

# Medical Terminology

Expert knowledge for healthcare documentation and coding.

## Common Abbreviations

### Vital Signs
- BP: Blood Pressure
- HR: Heart Rate
- RR: Respiratory Rate
- Temp: Temperature
- O2Sat: Oxygen Saturation

### Medical Orders
- PRN: As needed (pro re nata)
- PO: By mouth (per os)
- IV: Intravenous
- IM: Intramuscular
- q4h: Every 4 hours

## ICD-10 Coding

### Structure
- Category (3 characters): E11
- Subcategory (4 characters): E11.6
- Full code (5-7 characters): E11.65

### Common Codes
- E11.65: Type 2 diabetes with hyperglycemia
- I10: Essential hypertension
- J44.0: COPD with acute lower respiratory infection

[See schemas/icd-10-codes.json for full code list]

## HIPAA Compliance

**Protected Health Information (PHI):**
- Names
- Dates (except year)
- Phone/fax numbers
- Email addresses
- Social Security numbers
- Medical record numbers

**NEVER include PHI in examples or documentation.**

Use placeholders:
- [Patient Name]
- [Date of Birth]
- [MRN: XXXXXX]
```

---

## Real-World Use Cases

### Use Case 1: Multi-Market Tender Analysis

**Scenario:** Company analyzes tenders in Denmark, UK, and US. Rules differ by market.

**Without Skills:**
```
agents/
├── dk-technical-analyst.md     (217 lines, DK rules)
├── uk-technical-analyst.md     (223 lines, UK rules)
├── us-technical-analyst.md     (201 lines, US rules)
└── [9 more agents × 3 markets = 36 agent files]
```

**With Skills:**
```
agents/
└── technical-analyst.md        (152 lines, no market rules)

skills/
├── danish-tender-guidelines/
├── uk-procurement-rules/
└── us-rfp-standards/
```

**Agent Usage:**
```yaml
# Same agent, different market
---
name: technical-analyst
skills: [danish-tender-guidelines]  # For DK tenders
---

---
name: technical-analyst
skills: [uk-procurement-rules]  # For UK tenders
---

---
name: technical-analyst
skills: [us-rfp-standards]  # For US RFPs
---
```

**Result:**
- 12 agent files instead of 36 (66% reduction)
- Update market rules once, applies to all agents
- Easy to add new markets (1 skill, not 12 agents)

---

### Use Case 2: Compliance & Brand Consistency

**Scenario:** All customer communications must follow brand + legal compliance.

**Skills:**
```
skills/
├── company-brand-guidelines/   (Voice, tone, style)
├── legal-compliance/           (Disclaimers, terms)
└── gdpr-privacy/               (Data handling rules)
```

**Agents:**
```yaml
# Customer support agent
---
name: customer-support
skills: [company-brand-guidelines, legal-compliance, gdpr-privacy]
---

# Marketing agent
---
name: marketing-writer
skills: [company-brand-guidelines, legal-compliance]
---

# Sales agent
---
name: sales-assistant
skills: [company-brand-guidelines, legal-compliance]
---
```

**Result:**
- Consistent brand voice across all agents
- Single source of truth for legal requirements
- GDPR compliance built-in

---

### Use Case 3: Technical Documentation

**Scenario:** Generate technical docs for multiple programming languages.

**Skills:**
```
skills/
├── javascript-best-practices/
├── python-best-practices/
├── typescript-best-practices/
└── api-documentation-standards/
```

**Agent:**
```yaml
---
name: documentation-writer
skills: [api-documentation-standards]
---
```

**Dynamic Usage:**
```typescript
// Load language-specific skill based on project
if (project.language === 'javascript') {
  agent.skills.push('javascript-best-practices');
} else if (project.language === 'python') {
  agent.skills.push('python-best-practices');
}
```

**Result:**
- Same agent generates docs for any language
- Language-specific conventions applied correctly
- Easy to add new languages (1 skill)

---

## Multi-Skill Composition

### Example: Complex Tender Analysis

**Scenario:** Analyzing a Danish government tender for healthcare system.

**Agent:**
```yaml
---
name: healthcare-tender-analyst
skills:
  - danish-tender-guidelines      # DK compliance
  - medical-terminology          # Healthcare domain
  - gdpr-privacy                 # EU data protection
  - architecture-analyzer        # System design
  - security-compliance          # Security requirements
---

You analyze healthcare system tenders for Danish government contracts.

Use available skills:
1. **danish-tender-guidelines** - Output format, markers
2. **medical-terminology** - Clinical terms, ICD codes
3. **gdpr-privacy** - Data protection requirements
4. **architecture-analyzer** - Technical architecture
5. **security-compliance** - Security standards

Combine these to produce comprehensive analysis addressing:
- Danish tender format compliance
- Healthcare-specific requirements
- GDPR compliance assessment
- Technical architecture evaluation
- Security posture analysis
```

**Result:**
- 5 domain expertise areas combined
- Single analysis covers all aspects
- Skills can be reused for other healthcare projects

---

### Example: Multi-Language Customer Support

**Scenario:** Support agent handles multiple languages with brand consistency.

**Agent:**
```yaml
---
name: multilingual-support
skills:
  - company-brand-guidelines     # Brand voice
  - danish-language-etiquette    # DK cultural norms
  - german-language-etiquette    # DE cultural norms
  - english-language-etiquette   # EN cultural norms
---

You provide customer support in multiple languages while maintaining brand voice.

Use skills:
- **company-brand-guidelines** - Base brand voice and tone
- **[language]-etiquette** - Cultural norms for each language

Adapt brand voice to local culture:
- Danish: Direct, informal ("du" not "De")
- German: Formal, structured ("Sie" not "du")
- English (US): Friendly, casual

Maintain core brand attributes while respecting cultural differences.
```

**Result:**
- Culturally-appropriate responses
- Brand consistency across languages
- Easy to add new languages

---

## Best Practices

### 1. Keep Skills Focused

**Good:**
```yaml
---
name: sql-query-optimization
description: SQL query optimization techniques
---
```

**Bad:**
```yaml
---
name: database-everything
description: Everything about databases, SQL, NoSQL, optimization, security, backup, etc.
---
```

**Why:** Focused skills are easier to maintain, test, and compose.

---

### 2. Use Descriptive Names

**Good:**
```yaml
name: danish-tender-guidelines
name: medical-terminology
name: company-brand-guidelines
```

**Bad:**
```yaml
name: denmark
name: medical
name: brand
```

**Why:** Clear names make skill purpose obvious.

---

### 3. Version Your Skills

**Good:**
```yaml
---
name: gdpr-privacy
version: 2.1.0  # Updated for 2025 regulations
---
```

**Why:** Track changes, enable rollback, manage dependencies.

---

### 4. Document Thoroughly

**Good:**
```yaml
---
name: complexity-calculator
description: Estimates software project complexity using function point analysis
tags: [estimation, complexity, function-points]
capabilities: [complexity-scoring, effort-estimation, resource-planning]
---

# Complexity Calculator

This skill provides structured methodology for estimating software complexity.

## When to Use

Use this skill when:
- Analyzing tender requirements
- Planning project resources
- Estimating development effort

## Methodology

[Detailed explanation...]
```

**Why:** Clear documentation ensures proper usage.

---

### 5. Provide Examples

Include `examples/` directory with:
- Good examples (how to use)
- Bad examples (what to avoid)
- Edge cases
- Sample outputs

**Why:** Examples accelerate learning and ensure consistency.

---

## Conclusion

Skills provide a powerful way to:
1. **Eliminate duplication** - Write domain knowledge once
2. **Enable reuse** - Share expertise across agents
3. **Simplify maintenance** - Update in one place
4. **Compose expertise** - Combine multiple skills
5. **Scale across markets** - Same agent, different rules

See [USER-GUIDE.md](USER-GUIDE.md) for step-by-step creation guide.
See [MIGRATION-GUIDE.md](MIGRATION-GUIDE.md) for migrating existing agents.

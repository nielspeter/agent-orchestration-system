# Udbud (Tender) Analysis Agents

A comprehensive system of specialized AI agents for analyzing public and private tender documents. These agents extract all requirements, risks, and deadlines from tender materials in a completely neutral manner, without making assumptions about the bidder's capabilities.

## Overview

The udbud system consists of **10 specialized agents** organized into two categories:

### Core Analysis Agents (Phase 1)
These agents help you **understand the tender**:

1. **tender-setup** - Project initialization and document overview
2. **document-converter** - Format conversion (DOCX/PDF → Markdown)
3. **technical-analyst** - Deep technical analysis for development teams
4. **go-no-go-analyzer** - Decision support document for management
5. **question-clarifier** - Information gaps and ambiguities identification

### Response Requirements Agents (Phase 2)
These agents extract **what must be submitted**:

6. **compliance-checker** - ALL mandatory requirements (mission critical)
7. **pricing-analyst** - Pricing formats and evaluation criteria
8. **cv-team-analyst** - CV and team composition requirements
9. **contract-risk-analyst** - Contract terms, SLAs, penalties, risks
10. **deadline-coordinator** - All deadlines with timezone and method

## Key Principles

### Complete Neutrality
All agents follow strict neutrality guidelines:
- ✅ Extract facts from tender documents objectively
- ✅ Document requirements with source references `[FAKTA - doc, section]`
- ✅ Identify risks and obligations from tender
- ❌ NEVER assess bidder's capability to meet requirements
- ❌ NEVER make recommendations about bidding
- ❌ NEVER assume internal capabilities or resources

### Capability Assessments
When agents identify something requiring internal evaluation, they mark it:
```
[INTERN VURDERING PÅKRÆVET]
```

This means: "The tender requires X, but only you can assess if you can deliver it."

### Data Provenance Markers
All data is clearly marked with Danish markers:
- **[FAKTA]** - Direct from tender material (with source reference)
- **[ESTIMAT]** - Calculated estimates/assessments
- **[ANTAGET]** - Assumptions made where data is missing
- **[UKENDT]** - Information not found in tender material
- **[SKAL]** - Mandatory requirement (MUST)
- **[BØR]** - Recommended (SHOULD)
- **[KAN]** - Optional (MAY)
- **[UKLAR]** - Unclear/ambiguous
- **[KONFLIKT]** - Conflicting requirements between documents

## Quick Start

### Prerequisites

```bash
# Install docling for document conversion
pip install docling

# Optional: For OCR support on scanned PDFs
pip install "docling[ocr]"

# Set API key
export ANTHROPIC_API_KEY=your-key-here
```

### Basic Usage

```bash
# From /packages/examples directory
npx tsx udbud/udbud.ts
```

### Directory Structure

```
udbud/
├── agents/              # Agent definitions (markdown)
├── dokumenter/          # Input tender documents
│   └── udbud/          # Place DOCX/PDF files here
└── output/             # Generated analysis outputs
    ├── converted/      # Converted markdown files
    ├── UDBUDSOVERSIGT.md
    ├── TEKNISK-ANALYSE.md
    ├── BESLUTNINGSGRUNDLAG.md
    ├── INFORMATIONSMANGLER.md
    ├── COMPLIANCE-TJEKLISTE.md
    ├── PRISFASTSÆTTELSE-ANALYSE.md
    ├── CV-TEAM-ANALYSE.md
    ├── KONTRAKT-RISIKO-ANALYSE.md
    └── TIDSPLAN-KOORDINERING.md
```

## Agent Details

### 1. tender-setup
**Thinking**: 8,000 tokens | **Output**: `UDBUDSOVERSIGT.md`

Initializes project structure and creates comprehensive tender overview by scanning all documents to identify key facts (contracting authority, deadline, value).

### 2. document-converter
**Thinking**: 10,000 tokens | **Output**: `output/converted/*.md`

Converts DOCX/PDF/PPTX to markdown using docling, preserving tables, formatting, and structure with error handling.

### 3. technical-analyst
**Thinking**: 16,000 tokens | **Output**: `TEKNISK-ANALYSE.md`

Extracts system architecture, technology stack, non-functional requirements, integration complexity, development estimates, and technical risks.

**Key sections**: Architecture, tech stack, NFRs, estimates, risks, required competencies (from tender only).

### 4. go-no-go-analyzer
**Thinking**: 14,000 tokens | **Output**: `BESLUTNINGSGRUNDLAG.md`

Extracts project overview, economic parameters, competency requirements, evaluation criteria, and identified risks.

**Important**: Does NOT make GO/NO-GO recommendation - provides facts for management decision.

### 5. question-clarifier
**Thinking**: 10,000 tokens | **Output**: `INFORMATIONSMANGLER.md`

Identifies information gaps: `[UKENDT]` missing info, `[UKLAR]` ambiguous requirements, `[MODSTRIDENDE]` conflicts, `[MANGLER]` missing documents.

**Note**: Documents gaps objectively, does NOT formulate questions to submit.

### 6. compliance-checker ⚡ Mission Critical
**Thinking**: 12,000 tokens | **Output**: `COMPLIANCE-TJEKLISTE.md`

Extracts ALL mandatory requirements across 10 categories: administrative, format, content, qualification, timeline, pricing, appendices, conflicts, unclear items.

**Why critical**: Single missed requirement = instant disqualification.

Searches for: SKAL/MUST/obligatorisk/mandatory/påkrævet in ALL documents.

### 7. pricing-analyst
**Thinking**: 12,000 tokens | **Output**: `PRISFASTSÆTTELSE-ANALYSE.md`

Extracts pricing model, required tables/formats, evaluation formula, price vs quality weighting, volume assumptions, commercial terms, pricing risks.

**Important**: Price = 30-60% of evaluation score typically.

### 8. cv-team-analyst
**Thinking**: 10,000 tokens | **Output**: `CV-TEAM-ANALYSE.md`

Extracts CV requirements (number, format, content), role requirements, experience levels, certifications, reference projects, team organization, evaluation weighting.

**Important**: CVs/team = 15-30% of quality evaluation typically.

### 9. contract-risk-analyst
**Thinking**: 12,000 tokens | **Output**: `KONTRAKT-RISIKO-ANALYSE.md`

Extracts SLAs, penalties (dagbod), liability limits, warranties, termination clauses, IP rights, change management, GDPR obligations, dispute resolution, total financial exposure.

**Important**: Contract terms can destroy profitability through unlimited liability/penalties.

### 10. deadline-coordinator
**Thinking**: 8,000 tokens | **Output**: `TIDSPLAN-KOORDINERING.md`

Extracts ALL deadlines (date, time, timezone), submission method, milestones, technical requirements, time remaining calculations.

**Important**: Late submission = instant disqualification regardless of bid quality.

## Workflow

### Typical Analysis Flow

**1. Setup Phase**
```
tender-orchestrator → tender-setup → document-converter
```
Initialize structure, convert documents, create overview.

**2. Phase 1: Understanding** (parallel)
```
├─ technical-analyst
├─ go-no-go-analyzer
└─ question-clarifier
```

**3. Phase 2: Requirements Extraction** (parallel)
```
├─ compliance-checker       (What MUST be submitted?)
├─ pricing-analyst          (What pricing formats?)
├─ cv-team-analyst          (What CVs required?)
├─ contract-risk-analyst    (What are risks?)
└─ deadline-coordinator     (When are deadlines?)
```

**4. Decision Point**
- Review all outputs
- Internal capability assessment
- GO/NO-GO decision
- If GO: Plan bid response

## Use Cases

### 1. Initial Tender Assessment (GO/NO-GO)
**Read**:
- `UDBUDSOVERSIGT.md` - Quick overview
- `BESLUTNINGSGRUNDLAG.md` - Economic/strategic facts
- `TIDSPLAN-KOORDINERING.md` - Time available
- `COMPLIANCE-TJEKLISTE.md` - Can we meet mandatory requirements?

**Then**: Internal assessment → GO/NO-GO decision

### 2. Bid Response Preparation
**Read**:
- `COMPLIANCE-TJEKLISTE.md` - Complete checklist (mission critical!)
- `PRISFASTSÆTTELSE-ANALYSE.md` - Pricing format requirements
- `CV-TEAM-ANALYSE.md` - CV requirements
- `TIDSPLAN-KOORDINERING.md` - Deadlines
- `KONTRAKT-RISIKO-ANALYSE.md` - Contract terms

**Then**: Create response documents matching exact requirements

### 3. Risk Assessment
**Read**:
- `KONTRAKT-RISIKO-ANALYSE.md` - Financial exposure
- `TEKNISK-ANALYSE.md` - Technical risks
- `COMPLIANCE-TJEKLISTE.md` - Compliance risks

**Then**: Assess risk tolerance

### 4. Question Formulation
**Read**:
- `INFORMATIONSMANGLER.md` - Gaps/ambiguities
- All other files flagged `[UKLAR]` or `[KONFLIKT]`

**Then**: Formulate strategic questions

## Extended Thinking Budgets

| Agent | Budget | Purpose |
|-------|--------|---------|
| technical-analyst | 16,000 | Deep technical analysis |
| go-no-go-analyzer | 14,000 | Strategic business analysis |
| compliance-checker | 12,000 | Comprehensive scanning |
| pricing-analyst | 12,000 | Complex pricing models |
| contract-risk-analyst | 12,000 | Legal/financial analysis |
| cv-team-analyst | 10,000 | CV/team requirements |
| question-clarifier | 10,000 | Ambiguity detection |
| document-converter | 10,000 | Format conversion |
| tender-setup | 8,000 | Document scanning |
| deadline-coordinator | 8,000 | Timeline extraction |

## What These Agents DON'T Do

To maintain neutrality, agents **explicitly do NOT**:

❌ Assess your capability to meet requirements
❌ Recommend whether to bid
❌ Set pricing levels or strategy
❌ Recommend people to assign
❌ Assess deadline feasibility for you
❌ Recommend contract negotiation strategies
❌ Evaluate win probability
❌ Compare requirements to your capabilities

**Why?** Zero knowledge of your company/team/situation.

## What You Still Need to Do

1. **Internal Capability Assessment**
   - Check if you have required certifications
   - Check if you have people with required experience
   - Verify similar project experience
   - Confirm financial qualifications

2. **Business Decision**
   - Strategic fit
   - Win probability
   - Resource availability
   - GO/NO-GO

3. **Pricing Strategy**
   - Cost estimation
   - Margin determination
   - Competitive positioning
   - Price setting (using extracted formats)

4. **Bid Response Execution**
   - Task breakdown
   - Team coordination
   - Document drafting
   - Quality reviews
   - Submission

## Value Proposition

### Time Savings
- **Manual**: 5-10 days for complex tender
- **With agents**: 2-4 hours (extraction) + internal assessment
- **Reduction**: ~70% of analysis effort

### Risk Reduction
- Zero missed requirements (comprehensive scanning)
- Complete traceability (all facts sourced)
- Consistent format every time

### Coverage Guarantee
Searches for: SKAL/MUST/obligatorisk/mandatory/påkrævet/BØR/SHOULD across ALL documents (main, annexes, appendices, Q&A).

## Limitations

**1. Document Quality Dependent**
- Vague tender → Flagged `[UKLAR]`
- Contradictory → Flagged `[KONFLIKT]`
- Incomplete → Flagged `[UKENDT]`

**2. No Strategic Judgment**
Agents don't know competitors, customer's real priorities, political factors, or historical relationships.

**3. No Internal Knowledge**
Can't assess your team capabilities, costs, resources, or risk tolerance.

**4. Language Support**
Optimized for Danish/English tenders. Other languages may miss some requirements.

## Troubleshooting

### "Agent didn't find requirement X"
- Check if requirement in `output/converted/`
- Check if non-standard language used
- Check if in referenced-but-missing document

### "Path errors"
Verify:
- Working directory: `/packages/examples/`
- Documents: `udbud/dokumenter/udbud/`
- Output exists: `udbud/output/`

### "Conversion failed"
- Format supported? (DOCX/PDF/PPTX)
- Not password-protected?
- Not corrupted?
- Sufficient disk space?

## Configuration

### Tender Types

```typescript
// Public tender (EU directives)
{ tenderType: 'offentlig' }

// Private tender
{ tenderType: 'privat' }
```

### Verbosity

```typescript
.withConsole({ verbosity: 'minimal' })   // Errors only
.withConsole({ verbosity: 'normal' })    // Progress
.withConsole({ verbosity: 'verbose' })   // Detailed
```

## Contributing

### Agent Design Principles

✅ Extract facts, never assess bidder
✅ Source all data: `[FAKTA - doc, section]`
✅ Use markers: [SKAL], [BØR], [KAN]
✅ Flag unknowns: [UKENDT], [UKLAR], [KONFLIKT]
✅ Mark internal needs: [INTERN VURDERING PÅKRÆVET]
❌ Never make "should bid" recommendations
❌ Never assume bidder capabilities

## License

Part of Agent Orchestration System - see repository root.

---

**Remember**: These agents save massive time and ensure nothing is missed, but they're analysis tools, not decision-makers. GO/NO-GO, pricing, and execution planning require human judgment with internal knowledge.

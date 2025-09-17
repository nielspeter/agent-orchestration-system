# Udbud Tender Analysis Example

This example demonstrates a sophisticated multi-agent system for analyzing and preparing tender/bid documentation, particularly focused on Danish public and private tenders (udbud).

## Overview

The tender analysis system uses specialized agents to:
- Convert documents to accessible formats
- Perform technical analysis
- Create GO/NO-GO decision documents
- Identify clarification questions
- Track progress with structured task management

## Agents

### 1. **tender-orchestrator**
- **Role**: Main coordinator for the tender process
- **Tools**: Task, TodoWrite, Read, List
- **Responsibilities**: Delegates work to specialists and tracks progress

### 2. **tender-setup**
- **Role**: Initializes project structure
- **Tools**: Read, Write, List, Grep, TodoWrite
- **Creates**: PROJECT-CONTEXT.md, UDBUDSOVERSIGT.md, initial TODO list

### 3. **document-converter**
- **Role**: Converts documents using docling CLI
- **Tools**: Read, Write, Shell, List
- **Handles**: PDF, DOCX, XLSX, PPTX → Markdown/JSON/HTML

### 4. **technical-analyst**
- **Role**: Deep technical analysis for development teams
- **Tools**: Read, Write, List, Grep
- **Creates**: TEKNISK-ANALYSE.md with architecture, tech stack, and estimates

### 5. **go-no-go-analyzer**
- **Role**: Business decision analysis
- **Tools**: Read, Write, List, Grep
- **Creates**: GO-NO-GO-BESLUTNING.md with recommendations

### 6. **question-clarifier**
- **Role**: Identifies ambiguities and formulates questions
- **Tools**: Read, Write, List, Grep
- **Creates**: SPØRGSMÅL-AFKLARINGER.md with prioritized questions

## Running the Example

### Prerequisites

1. Install docling for document conversion:
```bash
pip install docling
# Optional: For OCR support
pip install "docling[ocr]"
```

2. Set up your environment:
```bash
export ANTHROPIC_API_KEY=your-key-here
```

### Basic Usage

```bash
# Analyze a public tender
npx tsx examples/udbud/udbud-tender.ts offentlig ./path/to/tender/docs

# Analyze a private tender
npx tsx examples/udbud/udbud-tender.ts privat ./path/to/tender/docs

# Use default settings (public tender, ./dokumenter/udbud)
npx tsx examples/udbud/udbud-tender.ts
```

## Document Structure

Place your tender documents in:
```
examples/udbud/
├── dokumenter/
│   └── udbud/
│       ├── tender_conditions.pdf
│       ├── requirements.docx
│       ├── pricing_template.xlsx
│       └── ...
```

## Output Documents

The system generates:

1. **PROJECT-CONTEXT.md**
   - Project configuration
   - Key dates and deadlines
   - Document references

2. **UDBUDSOVERSIGT.md**
   - Comprehensive tender overview
   - Requirements summary
   - Evaluation criteria
   - Timeline

3. **TEKNISK-ANALYSE.md**
   - System architecture analysis
   - Technology requirements
   - Resource estimations
   - Technical risks

4. **GO-NO-GO-BESLUTNING.md**
   - Executive summary
   - Economic analysis
   - Risk assessment
   - Clear GO/NO-GO recommendation

5. **SPØRGSMÅL-AFKLARINGER.md**
   - Categorized questions (KRITISK/UKLAR/NICE-TO-KNOW)
   - Document references
   - Impact analysis

## Key Features

### FAKTA/ESTIMAT Protocol

All analyses distinguish between:
- **[FAKTA]** - Direct from tender documents with source
- **[ESTIMAT]** - Calculations and estimates
- **[ANTAGET]** - Assumptions where data is missing
- **[UKENDT]** - Missing information
- **[INTERN VURDERING PÅKRÆVET]** - Requires internal assessment

### Pull Architecture

Each agent independently:
- Discovers required information
- Reads relevant documents
- Performs specialized analysis
- Generates structured output

### Quality Assurance

- Source traceability for all facts
- Clear distinction between facts and estimates
- No speculation about internal capabilities
- Structured, actionable outputs

## Workflow

1. **Setup Phase**
   - Initialize project structure
   - Scan and convert documents
   - Create overview

2. **Analysis Phase**
   - Technical analysis (parallel)
   - Business analysis (parallel)
   - Question identification (parallel)

3. **Consolidation Phase**
   - Review all analyses
   - Identify conflicts or gaps
   - Generate recommendations

4. **Output Phase**
   - Structured documents for different stakeholders
   - Clear next steps
   - Tracked TODO items

## Best Practices

1. **Document Preparation**
   - Convert all documents to markdown first
   - Use docling's OCR for scanned PDFs
   - Preserve table structures

2. **Analysis Accuracy**
   - Always cite sources
   - Mark estimates clearly
   - Don't assume capabilities

3. **Question Strategy**
   - Submit critical questions early
   - Group related questions
   - Avoid revealing strategy

## Customization

Modify agent behaviors by editing the markdown files in `agents/`:
- Adjust temperature for creativity vs precision
- Add domain-specific instructions
- Customize output formats

## Notes

- Designed for Danish tender terminology but works internationally
- Supports both public (offentlig) and private (privat) tenders
- Scalable to handle large document sets
- Maintains audit trail through structured logging

This example showcases how specialized agents can collaborate to handle complex, document-heavy workflows while maintaining accuracy and traceability.
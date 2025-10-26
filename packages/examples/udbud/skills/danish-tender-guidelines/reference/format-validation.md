# Danish Tender Output Format Validation

## Overview

This guide ensures all analysis outputs follow Danish tender standards for structure, formatting, and data presentation.

## Required Document Sections

### Technical Analysis (TEKNISK-ANALYSE.md)

**Required Sections (in order):**
1. Executive Technical Summary
2. System Arkitektur
3. Teknologi Stack
4. Non-Functional Requirements
5. Udviklings Estimat
6. Tekniske Risici
7. Påkrævede Kompetencer (fra Udbud)
8. Tekniske Overvejelser

**Section Header Format:**
```markdown
## 1. EXECUTIVE TECHNICAL SUMMARY
## 2. SYSTEM ARKITEKTUR
### Nuværende System
### Target Arkitektur
## 3. TEKNOLOGI STACK
### Påkrævet
### Teknologi Krav Status
```

### Decision Support (BESLUTNINGSGRUNDLAG.md)

**Required Sections (in order):**
1. Executive Summary
2. Projekt Oversigt
3. Økonomisk Analyse
4. Kompetencekrav fra Udbud
5. Evalueringskriterier
6. Identificerede Risici
7. Evalueringskriterie Fordeling
8. Projektbeskrivelse Sammenfatning
9. Beslutningsfaktorer

**Mandatory Footer:**
```markdown
---

**BESLUTNING**: Dette dokument præsenterer FAKTA fra udbudsmaterialet. GO/NO-GO beslutning træffes af ledelsen ved at kombinere:
1. Ovenstående faktuelle grundlag (fra dette dokument)
2. Intern vurdering af tilbyderens kapacitet og strategi
3. Risiko/reward vurdering baseret på virksomhedens situation
```

## Table Formatting Standards

### Technology Requirements Table
```markdown
| Teknologi | Version | Krav | Kilde |
|-----------|---------|------|-------|
| Java | 17+ | MUST | [FAKTA - source: tech-spec.md, section 2.1] |
| PostgreSQL | 14+ | MUST | [FAKTA - source: tech-spec.md, section 2.3] |
| Docker | Latest | SHOULD | [FAKTA - source: deployment.md, page 5] |
```

**Validation Rules:**
- ✅ All rows must have marker ([FAKTA], [ESTIMAT], etc.)
- ✅ Source must include document name and section/page
- ✅ Version numbers must be specific if stated in tender
- ✅ MUST/SHOULD must match tender requirement level

### Competency Requirements Table
```markdown
| Kompetence | Antal | Niveau | Kilde |
|------------|-------|--------|-------|
| Java Developer | 3 | Senior | [FAKTA - source: krav.md, section 6.1] |
| Solution Architect | 1 | Expert | [FAKTA - source: team.md, section 3.2] |
```

**Validation Rules:**
- ✅ All data from tender documents ([FAKTA] required)
- ✅ MUST include footer: `**VIGTIG**: Ovenstående er KUN hvad udbuddet kræver. Vurdering af tilbyderens kompetencer: [INTERN VURDERING PÅKRÆVET]`
- ❌ NEVER include bidder's current capabilities
- ❌ NEVER say "we need" or "company must have"

### Risk Analysis Table
```markdown
| Risiko | Sandsynlighed | Impact | Kilde |
|--------|---------------|--------|-------|
| Legacy SOAP integration | H [ESTIMAT] | H [ESTIMAT] | [FAKTA - source: integration.md] |
| Missing auth specs | M [ESTIMAT] | M [ESTIMAT] | [UKENDT - not in tender] |
```

**Validation Rules:**
- ✅ Risk itself must be [FAKTA] from tender or [ESTIMAT] based on requirements
- ✅ Likelihood and impact are always [ESTIMAT]
- ✅ Source must explain what requirement/gap creates the risk
- ✅ Use H/M/L scale (High/Medium/Low)

### Effort Estimation Table
```markdown
| Komponent | Timer | Kompleksitet | Risiko |
|-----------|-------|--------------|--------|
| Backend API | 400 [ESTIMAT - 5 endpoints * 80h avg] | M | Integration complexity |
| Frontend | 320 [ESTIMAT - 8 views * 40h avg] | L | Standard React patterns |
```

**Validation Rules:**
- ✅ All hour estimates must be [ESTIMAT] with methodology
- ✅ Methodology must be shown: "X components * Y hours average"
- ✅ Complexity must have justification
- ✅ Risk description must relate to tender requirements

## Metadata Headers

### Document Header Format
```markdown
# [DOCUMENT TYPE]
Generated: 2025-10-18
Tender: [Tender Name/ID]
Source Documents: [List of analyzed documents]
```

**Validation Rules:**
- ✅ Generation date in YYYY-MM-DD format
- ✅ Tender name from tender documents ([FAKTA])
- ✅ List all source documents analyzed

## Data Citation Standards

### Source Reference Format
```markdown
[FAKTA - source: document-name.md, section X.Y]
[FAKTA - source: document-name.md, page N]
[FAKTA - source: contract.md, section 2.1 "Contract Duration"]
```

**Validation Rules:**
- ✅ Document name must be exact filename
- ✅ Section/page must be specific
- ✅ Use quotes for important exact text
- ❌ NEVER use vague sources like "from tender" or "in documents"

### Estimation Documentation Format
```markdown
[ESTIMAT - based on X * Y methodology]
[ESTIMAT - 5 microservices * 160 hours average development time]
[ESTIMAT - complexity 7/10 due to 15 integrations + legacy migration]
```

**Validation Rules:**
- ✅ Always explain calculation or assessment basis
- ✅ Show formulas when applicable
- ✅ Reference facts used in calculation
- ✅ Note assumptions if any

## Danish Language Standards

### Required Danish Terms
- **Udbud** - Tender
- **Udbyder** - Contracting authority
- **Tilbyder** - Bidder
- **Kompetence** - Competency
- **Påkrævet** - Required
- **Ønsket** - Desired
- **Risiko** - Risk
- **Estimat** - Estimate

### Section Titles (Always Danish)
```markdown
## TEKNISK ANALYSE
## BESLUTNINGSGRUNDLAG
## KOMPETENCEKRAV
## EVALUERINGSKRITERIER
## ØKONOMISK ANALYSE
```

### Mixed Language Pattern
```markdown
# Titles and headers: DANISH
# Table headers: Danish
# Markers: ENGLISH [FAKTA], [ESTIMAT], etc.
# Technical terms: English (REST API, PostgreSQL, Docker)
# Requirements prose: Danish
```

## Validation Checklist

Before finalizing any document, check:

### Structure Validation
- [ ] All required sections present in correct order
- [ ] Section numbering consistent
- [ ] Headers follow capitalization standards
- [ ] Document has proper metadata header

### Data Validation
- [ ] Every data point has a marker
- [ ] All [FAKTA] markers include source references
- [ ] All [ESTIMAT] markers explain methodology
- [ ] No unmarked data points

### Table Validation
- [ ] All tables have Danish headers
- [ ] All rows properly formatted
- [ ] All data properly cited
- [ ] Competency tables include footer disclaimer

### Language Validation
- [ ] Section titles in Danish
- [ ] Markers in English
- [ ] Technical terms in English
- [ ] Proper use of Danish tender terminology

### Neutrality Validation
- [ ] NO bidder capability assumptions
- [ ] NO GO/NO-GO recommendations
- [ ] NO "should" or "must have" statements to bidder
- [ ] Capability assessments marked [INTERN VURDERING PÅKRÆVET]

### Citation Validation
- [ ] All sources are specific (document + section/page)
- [ ] NO vague citations ("from tender", "in documents")
- [ ] Exact quotes used for critical requirements
- [ ] Multi-source citations when requirement appears in multiple places

## Common Validation Failures

### ❌ Missing Markers
```markdown
Contract duration: 3 years
Required developers: 5 FTE
```

### ✅ Correct
```markdown
Contract duration: 3 years [FAKTA - source: kontrakt.md, section 2.1]
Required hours: 2000/year [FAKTA - source: krav.md]
Estimated developers: 1.0 FTE [ESTIMAT - based on 2000 hours/year]
```

### ❌ Vague Sources
```markdown
Technology: Java [FAKTA - from tender]
Deadline: December 2025 [FAKTA - in documents]
```

### ✅ Correct
```markdown
Technology: Java 17+ [FAKTA - source: tech-spec.md, section 2.1]
Deadline: 2025-12-01 kl. 12:00 [FAKTA - source: udbudsbetingelser.md, section 3.1]
```

### ❌ Missing Methodology
```markdown
Development effort: 800 hours [ESTIMAT]
Testing effort: 200 hours [ESTIMAT]
```

### ✅ Correct
```markdown
Development effort: 800 hours [ESTIMAT - 5 microservices * 160h average]
Testing effort: 200 hours [ESTIMAT - 25% of dev time per industry standard]
```

### ❌ Capability Assumptions
```markdown
Required: Kubernetes [FAKTA]
Our team has Kubernetes experience
```

### ✅ Correct
```markdown
Required technology: Kubernetes [FAKTA - source: tech-krav.md]
Bidder's Kubernetes capability: [INTERN VURDERING PÅKRÆVET]
```

## Error Messages

When validation fails, use these standard error messages:

**Missing Marker:**
```
ERROR: Line X - Data point missing marker. All data must be marked with [FAKTA], [ESTIMAT], [ANTAGET], [UKENDT], or [INTERN VURDERING PÅKRÆVET]
```

**Vague Source:**
```
ERROR: Line X - Source citation too vague. Must include document name and section/page number.
```

**Capability Assumption:**
```
ERROR: Line X - Bidder capability assumption detected. Use [INTERN VURDERING PÅKRÆVET] instead.
```

**Missing Footer:**
```
ERROR: Competency table missing required footer disclaimer about internal assessment.
```

## Document Templates

For complete document templates, see:
- `assets/analysis-template.md` - Technical analysis template
- `assets/checklist-template.md` - Quality validation checklist
